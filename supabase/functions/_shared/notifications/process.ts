import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.1';

import { getSlackWebhookUrl, getTelegramBotToken, getTelegramChatId } from '../office-env.ts';

type NotificationRow = {
  id: string;
  lead_id: string;
  channel: 'telegram' | 'slack';
  destination: string;
  payload: Record<string, unknown>;
  attempts: number;
};

async function sendTelegram(
  text: string,
  officeCode: string | undefined,
  destination: string,
): Promise<void> {
  const token = getTelegramBotToken(officeCode);
  const chatId = destination.trim() || getTelegramChatId(officeCode);
  if (!token || !chatId) {
    throw new Error(`Missing Telegram config for office: ${officeCode ?? 'unknown'}`);
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Telegram error: ${res.status} ${await res.text()}`);
  }
}

async function sendSlack(text: string, officeCode: string | undefined): Promise<void> {
  const webhook = getSlackWebhookUrl(officeCode);
  if (!webhook) throw new Error('Missing Slack webhook for office');
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Slack error: ${res.status} ${await res.text()}`);
  }
}

const SOURCE_LABELS: Record<string, string> = {
  meta_lead_ads: 'Facebook Forms',
  google_ads: 'Google Ads',
  site_form: 'Site Form',
  manual: 'Вручну',
};

function payloadValue(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return value === null || value === undefined ? '' : String(value).trim();
}

function escapeHtml(value: string): string {
  const escaped: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => escaped[character] ?? character);
}

function messageValues(payload: Record<string, unknown>) {
  const source = String(payload.source_system ?? '');
  const sourceLabel = SOURCE_LABELS[source] ?? (source || '—');
  const name = payloadValue(payload, 'name') || '—';
  const phone = payloadValue(payload, 'phone') || '—';
  const clientInfo = payloadValue(payload, 'client_info');
  const crmUrl = payloadValue(payload, 'crm_url');
  return { sourceLabel, name, phone, clientInfo, crmUrl };
}

function buildTelegramMessage(payload: Record<string, unknown>): string {
  const { sourceLabel, name, phone, clientInfo, crmUrl } = messageValues(payload);
  const lines = ['🔔 Нова заявка!', `👤 Ім'я: ${escapeHtml(name)}`];
  if (clientInfo) {
    lines.push('', escapeHtml(clientInfo));
  }
  lines.push(`📞 Тел: ${escapeHtml(phone)}`, `🌐 Джерело: ${escapeHtml(sourceLabel)}`);
  if (crmUrl) {
    lines.push(`🔗 Посилання на CRM: <a href="${escapeHtml(crmUrl)}">Відкрити в CRM</a>`);
  }
  return lines.join('\n');
}

function buildSlackMessage(payload: Record<string, unknown>): string {
  const { sourceLabel, name, phone, clientInfo, crmUrl } = messageValues(payload);
  const lines = ['🔔 Нова заявка!', `👤 Ім'я: ${name}`];
  if (clientInfo) lines.push('', clientInfo);
  lines.push(`📞 Тел: ${phone}`, `🌐 Джерело: ${sourceLabel}`);
  if (crmUrl) lines.push(`🔗 Посилання на CRM: ${crmUrl}`);
  return lines.join('\n');
}

export async function processPendingNotifications(supabase: SupabaseClient) {
  const { data: pending, error } = await supabase
    .from('lead_notifications')
    .select('id, lead_id, channel, destination, payload, attempts')
    .in('status', ['pending', 'failed'])
    .lt('attempts', 10)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) throw error;
  if (!pending?.length) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const row of pending as NotificationRow[]) {
    const payload = row.payload as Record<string, unknown>;
    const officeCode = payload.office_code as string | undefined;

    try {
      if (row.channel === 'telegram') {
        await sendTelegram(buildTelegramMessage(payload), officeCode, row.destination);
      } else {
        await sendSlack(buildSlackMessage(payload), officeCode);
      }
      await supabase
        .from('lead_notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          attempts: row.attempts + 1,
          last_error: null,
        })
        .eq('id', row.id);
      sent++;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      await supabase
        .from('lead_notifications')
        .update({
          status: 'failed',
          attempts: row.attempts + 1,
          last_error: message,
        })
        .eq('id', row.id);
      failed++;
    }
  }

  return { processed: pending.length, sent, failed };
}
