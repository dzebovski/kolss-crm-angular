import { Component, computed, inject, input, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2Client, V2ClientDuplicate } from '@domain/v2/client.types';
import { formatV2CardDate, formatV2ReportDate } from '@domain/v2/date-format';
import { formatV2Money } from '@domain/v2/project-money';
import { v2PluralCategory } from '@domain/v2/plural';
import { V2ClientsService } from '@services/v2/v2-clients.service';
import { V2_NOW } from '../../core/v2-clock';
import { V2CreateLeadLauncher } from '../../leads/list/v2-create-lead-launcher';
import { V2DialogService } from '../../ui/dialog/v2-dialog.service';
import { V2Button } from '../../ui/v2-button';
import { V2CodeChip } from '../../ui/v2-code-chip';
import { V2_CHANNEL_LABEL } from '../../ui/v2-lead-labels';
import { V2StatePanel } from '../../ui/v2-state-panel';
import { V2ClientEditDialog, type V2ClientEditData } from './v2-client-edit-dialog';
import {
  V2ClientMergeDialog,
  type V2ClientMergeData,
  type V2ClientMergeResult,
} from './v2-client-merge-dialog';
import { V2ClientLeadsTable, V2ClientProjectsTable } from './v2-client-rows';

const LANGUAGE_LABEL: Record<string, MessageKey> = {
  pl: 'v2.client.lang.pl',
  uk: 'v2.client.lang.uk',
  en: 'v2.client.lang.en',
  ru: 'v2.client.lang.ru',
};

// Client card from the "KOLSS CRM v2" canvas (Client-card.dc.html and its loading / error /
// not-found boards): breadcrumb, duplicate banner, header with contacts, three stat tiles, the
// client's Leads and Projects. Edit client and Merge are popups. Data: `GET /v1/clients/{id}`
// through `V2ClientsService`; a merged-away id answers with the survivor (`redirectedFromCode`).
@Component({
  selector: 'app-v2-client-card-page',
  imports: [
    RouterLink,
    TranslatePipe,
    V2Button,
    V2ClientLeadsTable,
    V2ClientProjectsTable,
    V2CodeChip,
    V2StatePanel,
  ],
  templateUrl: './v2-client-card-page.html',
  styleUrl: './v2-client-card-page.scss',
})
export class V2ClientCardPage {
  private readonly clients = inject(V2ClientsService);
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(V2_NOW);
  private readonly router = inject(Router);
  private readonly dialogs = inject(V2DialogService);
  private readonly createLead = inject(V2CreateLeadLauncher);

  /** Route parameter `:clientId`, bound through `withComponentInputBinding()`. */
  readonly clientId = input.required<string>();
  /** `?merged=W0240` after a merge: the code that now opens this card. */
  readonly merged = input<string>();

  private readonly resource = resource({
    params: () => this.clientId(),
    loader: ({ params }) => this.clients.get(params),
  });

  protected readonly client = computed<V2Client | null>(() =>
    this.resource.hasValue() ? this.resource.value() : null,
  );
  protected readonly loading = computed(() => this.resource.isLoading() && !this.client());
  /** 404 / 403: the client does not exist, was never visible, or no access. */
  protected readonly notFound = computed(() => {
    const error = this.resource.error();
    return (
      this.resource.status() === 'error' &&
      error instanceof KolssApiError &&
      (error.status === 404 || error.status === 403)
    );
  });
  protected readonly failed = computed(
    () => this.resource.status() === 'error' && !this.notFound(),
  );
  protected readonly now = computed(() => {
    this.resource.status();
    return this.clock();
  });

  protected readonly mergedCode = computed(
    () => this.merged()?.toUpperCase() || this.client()?.redirectedFromCode || null,
  );
  protected readonly languageLabel = computed(() => {
    const language = this.client()?.language;
    return language ? LANGUAGE_LABEL[language] : null;
  });
  protected readonly channelLabel = computed(() => {
    const channel = this.client()?.firstChannel;
    return channel ? V2_CHANNEL_LABEL[channel] : null;
  });
  protected readonly since = computed(() => {
    const client = this.client();
    return client ? formatV2ReportDate(client.createdAt) : '';
  });
  protected readonly phones = computed(() => {
    const client = this.client();
    if (!client) return '';
    return [client.phone, client.secondPhoneDisplay].filter(Boolean).join(' · ');
  });
  protected readonly leadsSub = computed(() => {
    const client = this.client();
    if (!client) return '';
    const became = client.leads.length - client.openLeadsCount;
    return this.i18n.t('v2.client.stat.leadsSub', { open: client.openLeadsCount, became });
  });
  protected readonly projectsSub = computed(() => {
    const client = this.client();
    if (!client) return '';
    const closed = client.projects.length - client.activeProjectsCount;
    return this.i18n.t('v2.client.stat.projectsSub', {
      active: client.activeProjectsCount,
      closed,
    });
  });
  protected readonly contractTiles = computed(() => {
    const locale = this.i18n.locale();
    return (this.client()?.contractValue ?? []).map((value) => ({
      total: formatV2Money(value.total, locale),
      sub: this.i18n.t('v2.client.stat.contractSub', {
        paid: formatV2Money(value.paid, locale),
        remaining: formatV2Money(value.remaining, locale),
      }),
    }));
  });
  protected readonly duplicates = computed(() => {
    const locale = this.i18n.locale();
    return (this.client()?.duplicates ?? []).map((duplicate) => ({
      duplicate,
      same: this.sameText(duplicate),
      detail: this.i18n.t('v2.client.dup.detail', {
        date: formatV2CardDate(duplicate.createdAt, this.now(), locale),
        leads: `${duplicate.leadsCount} ${this.leadsWord(duplicate.leadsCount)}`,
        projects: `${duplicate.projectsCount} ${this.projectsWord(duplicate.projectsCount)}`,
      }),
    }));
  });

  protected retry(): void {
    this.resource.reload();
  }

  protected edit(client: V2Client): void {
    const ref = this.dialogs.open<boolean, V2ClientEditData>(V2ClientEditDialog, { client });
    ref.closed.subscribe((saved) => saved && this.resource.reload());
  }

  protected merge(client: V2Client, duplicate: V2ClientDuplicate): void {
    const ref = this.dialogs.open<V2ClientMergeResult, V2ClientMergeData>(V2ClientMergeDialog, {
      client,
      duplicateId: duplicate.id,
    });
    ref.closed.subscribe((result) => {
      if (!result) return;
      void this.router.navigate(['/v2/clients', result.survivor.id], {
        queryParams: { merged: result.mergedCode },
      });
      this.resource.reload();
    });
  }

  protected newLead(client: V2Client): void {
    void this.createLead.open({
      name: client.name,
      phone: client.rawPhone ?? '',
      email: client.email,
      showroom: client.officeId,
    });
  }

  private sameText(duplicate: V2ClientDuplicate): string {
    const both = duplicate.matchedBy.length > 1;
    if (both) return this.i18n.t('v2.client.dup.samePhoneEmail');
    return duplicate.matchedBy[0] === 'email'
      ? this.i18n.t('v2.client.dup.sameEmail', { value: duplicate.email ?? '' })
      : this.i18n.t('v2.client.dup.samePhone', { value: duplicate.phone });
  }

  private leadsWord(count: number): string {
    return this.i18n.t(`v2.clients.leads.${v2PluralCategory(this.i18n.locale(), count)}`);
  }

  private projectsWord(count: number): string {
    return this.i18n.t(`v2.clients.projects.${v2PluralCategory(this.i18n.locale(), count)}`);
  }
}
