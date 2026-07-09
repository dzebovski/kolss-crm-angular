export type OfficeEnvPrefix = 'KYIV' | 'WARSAW';

export function officeEnvPrefix(officeCode: string | undefined): OfficeEnvPrefix | null {
  if (officeCode === 'kyiv') return 'KYIV';
  if (officeCode === 'warsaw') return 'WARSAW';
  return null;
}

export function getTelegramBotToken(officeCode: string | undefined): string | null {
  const prefix = officeEnvPrefix(officeCode);
  if (prefix) {
    const officeToken = Deno.env.get(`TELEGRAM_BOT_TOKEN_${prefix}`)?.trim();
    if (officeToken) return officeToken;
  }
  return Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim() ?? null;
}

export function getTelegramChatId(officeCode: string | undefined): string | null {
  const prefix = officeEnvPrefix(officeCode);
  if (prefix) {
    const chatId = Deno.env.get(`TELEGRAM_CHAT_ID_${prefix}`)?.trim();
    if (chatId) return chatId;
  }
  return Deno.env.get('TELEGRAM_CHAT_ID_KYIV')?.trim() ?? null;
}

export function telegramConfigured(officeCode: string | undefined): boolean {
  return !!(getTelegramBotToken(officeCode) && getTelegramChatId(officeCode));
}

export function getSlackWebhookUrl(officeCode: string | undefined): string | null {
  const prefix = officeEnvPrefix(officeCode);
  const webhook =
    (prefix && Deno.env.get(`SLACK_WEBHOOK_URL_${prefix}`)?.trim()) ||
    Deno.env.get('SLACK_WEBHOOK_URL_KYIV')?.trim();
  return webhook || null;
}

export function getSiteUrlPublic(): string {
  return (
    Deno.env.get('SITE_URL_PUBLIC')?.trim() ||
    Deno.env.get('NEXT_PUBLIC_SITE_URL_PUBLIC')?.trim() ||
    Deno.env.get('NEXT_PUBLIC_SITE_URL')?.trim() ||
    ''
  );
}
