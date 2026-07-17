import { Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  presentEventBodyFromLeadEvent,
  presentEventTitleFromLeadEvent,
} from '../../../core/i18n/event-presenter';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  callStatusTone,
  clientStatusTone,
  defaultCurrencyForOffice,
  leadIsTerminal,
  LEAD_SOURCE_ICONS,
} from '../../../services/crm-mock.helpers';
import type {
  CallStatus,
  ClientStatus,
  LeadEvent,
  MockLead,
} from '../../../services/crm-mock.types';
import { LeadActivitiesService } from '../../../services/lead-activities.service';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiMenu, type UiMenuItem } from '../../../ui/menu/ui-menu';
import { UiUser } from '../../../ui/user/ui-user';
import { RadialActionDialog } from '../../../pages/design/radial-menu/radial-action-dialog';
import type { RadialActionDialogData } from '../../../pages/design/radial-menu/radial-action-dialog';
import {
  CALL_RADIAL_LAYOUT,
  type RadialAction,
} from '../../../pages/design/radial-menu/radial-menu.types';
import {
  CloseStatusDialog,
  type CloseStatusResult,
  ContractStatusDialog,
  type ContractStatusDialogData,
  type ContractStatusResult,
  TextActivityDialog,
  type TextActivityDialogData,
} from './lead-activity-dialogs';

const CALL_ACTIONS: readonly Omit<RadialAction<CallStatus>, 'label'>[] = [
  { id: 'reached', icon: 'check_circle', tone: 'success' },
  { id: 'no_answer', icon: 'phone_missed', tone: 'missed' },
  { id: 'callback_requested', icon: 'schedule', tone: 'callback' },
];

@Component({
  selector: 'app-lead-detail-page',
  imports: [RouterLink, UiBadge, UiButton, UiIcon, UiMenu, UiUser],
  template: `
    @if (leadResource.isLoading()) {
      <section class="lead-state" aria-busy="true" aria-label="Завантаження заявки">
        <span class="lead-state__pulse"></span>
        <span class="lead-state__pulse"></span>
        <span class="lead-state__pulse"></span>
      </section>
    } @else if (loadError()) {
      <section class="lead-state" role="alert">
        <app-ui-icon name="warning" [size]="30" />
        <h1>Не вдалося завантажити заявку</h1>
        <p>{{ loadError() }}</p>
        <a routerLink="/crm/leads">Повернутися до списку</a>
      </section>
    } @else if (lead(); as lead) {
      <section class="lead-page" [attr.aria-labelledby]="'lead-title-' + lead.id">
        <a class="back-link" routerLink="/crm/leads">
          <app-ui-icon name="arrow_back" [size]="17" />
          {{ i18n.t('leadDetail.allLeads') }}
        </a>

        <header class="lead-hero">
          <div>
            <p class="lead-hero__kicker">
              {{ officeName(lead.officeCode) }} · {{ sourceLabel(lead) }}
            </p>
            <h1 [id]="'lead-title-' + lead.id">{{ lead.name }}</h1>
            <p class="lead-hero__meta">
              {{ i18n.t('leadDetail.created') }} {{ formatDateTime(lead.sourceCreatedAt) }}
              @if (lead.assignedToId) {
                · {{ i18n.t('common.manager').toLocaleLowerCase() }} {{ employeeName(lead.assignedToId) }}
              }
            </p>
          </div>
          @if (isTerminal(lead)) {
            <app-ui-button
              variant="secondary"
              [loading]="actionPending()"
              (pressed)="reopenLead(lead)"
            >
              <app-ui-icon name="inbox" [size]="17" />
              {{ i18n.t('leadDetail.reopen') }}
            </app-ui-button>
          }
        </header>

        @if (actionError()) {
          <div class="action-error" role="alert">{{ actionError() }}</div>
        }

        <div class="lead-grid">
          <main class="lead-main">
            <section class="client-panel" aria-labelledby="client-data-title">
              <header class="panel-heading">
                <div>
                  <span>{{ i18n.t('leadDetail.client') }}</span>
                  <h2 id="client-data-title">{{ i18n.t('leadDetail.contactRequest') }}</h2>
                </div>
                <span class="source-mark">
                  <app-ui-icon [name]="sourceIcon(lead)" [size]="16" />
                  {{ sourceLabel(lead) }}
                </span>
              </header>
              <dl class="client-data">
                <div><dt>{{ i18n.t('leadDetail.phone') }}</dt><dd><a [href]="'tel:' + lead.phone">{{ lead.phone }}</a></dd></div>
                <div><dt>{{ i18n.t('leadDetail.email') }}</dt><dd>{{ lead.email || '—' }}</dd></div>
                <div><dt>{{ i18n.t('leadDetail.city') }}</dt><dd>{{ lead.cityRegion || '—' }}</dd></div>
                <div><dt>{{ i18n.t('leadDetail.product') }}</dt><dd>{{ lead.productInterest || '—' }}</dd></div>
                <div><dt>{{ i18n.t('leadDetail.budget') }}</dt><dd>{{ lead.estimatedBudget === null ? '—' : formatMoney(lead.estimatedBudget, defaultCurrency(lead)) }}</dd></div>
                <div class="client-data__message"><dt>{{ i18n.t('leadDetail.clientMessage') }}</dt><dd>{{ lead.initialMessage || '—' }}</dd></div>
              </dl>
            </section>

            <section class="timeline-panel" aria-labelledby="timeline-title">
              <header class="panel-heading">
                <div>
                  <span>{{ i18n.t('leadDetail.history') }}</span>
                  <h2 id="timeline-title">{{ i18n.t('leadDetail.timeline') }}</h2>
                </div>
                <b>{{ timelineEvents().length }}</b>
              </header>
              @if (timelineEvents().length) {
                <ol class="timeline-list">
                  @for (event of timelineEvents(); track event.id) {
                    <li>
                      <span class="timeline-dot" [attr.data-category]="event.category ?? 'legacy'" aria-hidden="true"></span>
                      <article>
                        <header>
                          <strong>{{ eventTitle(event) }}</strong>
                          <time [attr.datetime]="event.occurredAt">{{ formatDateTime(event.occurredAt) }}</time>
                        </header>
                        @if (eventStatusLabel(event); as statusLabel) {
                          <small class="timeline-context">{{ statusLabel }}</small>
                        }
                        @if (eventBody(event); as body) {
                          <p>{{ body }}</p>
                        }
                        <small>{{ eventActorName(event) }}</small>
                      </article>
                    </li>
                  }
                </ol>
              } @else {
                <p class="timeline-empty">{{ i18n.t('leadDetail.timelineEmpty') }}</p>
              }
            </section>
          </main>

          <aside class="status-panel" aria-labelledby="current-status-title">
            <div class="status-panel__glow" aria-hidden="true"></div>
            <header>
              <span>{{ i18n.t('leadDetail.currentState') }}</span>
              <h2 id="current-status-title">{{ i18n.t('leadDetail.clientStatus') }}</h2>
            </header>
            <div class="primary-status" [attr.data-status]="lead.clientStatus">
              <app-ui-badge [tone]="clientTone(lead.clientStatus)">
                {{ clientStatusLabel(lead.clientStatus) }}
              </app-ui-badge>
              <small>{{ i18n.t('leadDetail.updated', { date: formatDateTime(lead.clientStatusChangedAt) }) }}</small>
            </div>
            <div class="call-status">
              <span>{{ i18n.t('leadDetail.lastCall') }}</span>
              @if (lead.callStatus; as callStatus) {
                <app-ui-badge [tone]="callTone(callStatus)">{{ callStatusLabel(callStatus) }}</app-ui-badge>
                @if (lead.callStatusChangedAt) {
                  <small>{{ formatDateTime(lead.callStatusChangedAt) }}</small>
                }
              } @else {
                <strong>{{ i18n.t('leadDetail.notRecorded') }}</strong>
              }
            </div>

            @if (!isTerminal(lead) && !lead.archivedAt) {
              <div class="status-actions" aria-label="Дії зі статусом">
                <app-ui-button [loading]="actionPending()" (pressed)="openCallMenu(lead)">
                  <app-ui-icon name="phone_in_talk" [size]="18" />
                  {{ i18n.t('leadDetail.call') }}
                </app-ui-button>
                <app-ui-button variant="secondary" [disabled]="actionPending()" (pressed)="openComment(lead)">
                  <app-ui-icon name="campaign" [size]="18" />
                  {{ i18n.t('leadDetail.comment') }}
                </app-ui-button>
                <app-ui-menu
                  [label]="i18n.t('leadDetail.clientStatus')"
                  [items]="clientStatusItems(lead)"
                  (selected)="selectClientStatus(lead, $event)"
                />
              </div>
            } @else if (lead.archivedAt) {
              <p class="terminal-note">{{ i18n.t('leadDetail.archivedReadonly') }}</p>
            } @else {
              <p class="terminal-note">{{ i18n.t('leadDetail.terminalReadonly') }}</p>
            }

            @if (lead.contract) {
              <div class="terminal-summary terminal-summary--success">
                <span>Договір №{{ lead.contract.contractNumber }}</span>
                <strong>{{ formatMoney(lead.contract.amount, lead.contract.currency) }}</strong>
              </div>
            } @else if (lead.close) {
              <div class="terminal-summary">
                <span>{{ closeReasonLabel(lead.close.reason) }}</span>
                <p>{{ lead.close.comment }}</p>
              </div>
            }

            <footer class="status-panel__manager">
              @if (lead.assignedToId) {
                <app-ui-user [userId]="lead.assignedToId" [name]="employeeName(lead.assignedToId)" size="sm" />
              } @else {
                <span>{{ i18n.t('leadDetail.autoAssign') }}</span>
              }
            </footer>
          </aside>
        </div>
      </section>
    }
  `,
  styles: `
    .lead-page { display: grid; gap: 1.25rem; }
    .back-link { width: fit-content; color: var(--ui-text-muted); display: inline-flex; align-items: center; gap: .4rem; font-size: .82rem; font-weight: 700; text-decoration: none; }
    .back-link:hover { color: var(--ui-action); }
    .lead-hero { min-height: 8.5rem; padding: clamp(1.25rem, 3vw, 2rem); border: 1px solid var(--ui-border); border-radius: 1.25rem; background: linear-gradient(135deg, var(--ui-surface-raised) 65%, color-mix(in srgb, var(--ui-action) 8%, white)); display: flex; align-items: end; justify-content: space-between; gap: 1rem; box-shadow: var(--ui-shadow-1); }
    .lead-hero__kicker { margin: 0 0 .55rem; color: var(--ui-action); font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .lead-hero h1 { margin: 0; font-family: var(--ui-font-display), sans-serif; font-size: clamp(2rem, 4vw, 3.5rem); line-height: .98; letter-spacing: -.045em; }
    .lead-hero__meta { margin: .75rem 0 0; color: var(--ui-text-muted); font-size: .82rem; }
    .lead-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem); gap: 1.25rem; align-items: start; }
    .lead-main { display: grid; gap: 1.25rem; }
    .client-panel, .timeline-panel, .status-panel { border: 1px solid var(--ui-border); border-radius: 1.15rem; background: var(--ui-surface-raised); box-shadow: var(--ui-shadow-1); }
    .client-panel, .timeline-panel { overflow: hidden; }
    .panel-heading { min-height: 4.8rem; padding: 1.1rem 1.25rem; border-bottom: 1px solid var(--ui-border); background: var(--ui-surface-subtle); display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .panel-heading span, .status-panel > header span { color: var(--ui-text-subtle); font-size: .68rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
    .panel-heading h2, .status-panel h2 { margin: .2rem 0 0; font-family: var(--ui-font-display), sans-serif; font-size: 1.2rem; }
    .source-mark { padding: .45rem .65rem; border: 1px solid var(--ui-border); border-radius: 999px; background: white; display: inline-flex; align-items: center; gap: .4rem; }
    .client-data { margin: 0; padding: 1.25rem; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .client-data div { min-width: 0; padding: .85rem; border-radius: .8rem; background: var(--ui-surface-subtle); }
    .client-data__message { grid-column: 1 / -1; }
    .client-data dt { color: var(--ui-text-subtle); font-size: .7rem; font-weight: 750; text-transform: uppercase; }
    .client-data dd { margin: .35rem 0 0; color: var(--ui-text); font-size: .9rem; font-weight: 650; overflow-wrap: anywhere; }
    .client-data a { color: inherit; }
    .status-panel { position: sticky; top: 5.5rem; padding: 1.4rem; display: grid; gap: 1.2rem; overflow: hidden; }
    .status-panel__glow { position: absolute; inset: -5rem -6rem auto auto; width: 13rem; height: 13rem; border-radius: 50%; background: color-mix(in srgb, var(--ui-action) 12%, transparent); filter: blur(1rem); pointer-events: none; }
    .status-panel > *:not(.status-panel__glow) { position: relative; }
    .primary-status, .call-status { padding: 1rem; border: 1px solid var(--ui-border); border-radius: .9rem; background: var(--ui-surface-subtle); display: grid; justify-items: start; gap: .45rem; }
    .primary-status small, .call-status small, .call-status span { color: var(--ui-text-subtle); font-size: .72rem; }
    .call-status strong { font-size: .86rem; }
    .status-actions { display: grid; gap: .65rem; }
    .status-actions app-ui-button, .status-actions app-ui-menu { width: 100%; }
    .terminal-note { margin: 0; padding: .85rem; border-radius: .75rem; background: var(--ui-surface-muted); color: var(--ui-text-muted); font-size: .8rem; }
    .terminal-summary { padding: 1rem; border-left: .25rem solid var(--ui-danger); border-radius: .6rem; background: color-mix(in srgb, var(--ui-danger) 7%, white); }
    .terminal-summary--success { border-color: var(--ui-success); background: color-mix(in srgb, var(--ui-success) 7%, white); display: grid; gap: .3rem; }
    .terminal-summary p { margin: .4rem 0 0; color: var(--ui-text-muted); font-size: .8rem; }
    .status-panel__manager { padding-top: 1rem; border-top: 1px solid var(--ui-border); color: var(--ui-text-muted); font-size: .78rem; }
    .timeline-list { margin: 0; padding: 1.25rem; list-style: none; display: grid; }
    .timeline-list li { position: relative; min-height: 5.5rem; padding: 0 0 1.25rem 2rem; }
    .timeline-list li:not(:last-child)::before { content: ''; position: absolute; top: .85rem; bottom: -.1rem; left: .42rem; width: 1px; background: var(--ui-border); }
    .timeline-dot { position: absolute; top: .35rem; left: 0; width: .85rem; height: .85rem; border: 3px solid white; border-radius: 50%; background: var(--ui-text-subtle); box-shadow: 0 0 0 1px var(--ui-border); }
    .timeline-dot[data-category='call_status'] { background: var(--ui-info); }
    .timeline-dot[data-category='client_status'] { background: var(--ui-action); }
    .timeline-dot[data-category='comment'] { background: var(--ui-warning); }
    .timeline-list article { display: grid; gap: .35rem; }
    .timeline-list article header { display: flex; justify-content: space-between; gap: 1rem; }
    .timeline-list strong { font-size: .88rem; }
    .timeline-list time, .timeline-list small { color: var(--ui-text-subtle); font-size: .72rem; }
    .timeline-list p { margin: .15rem 0; color: var(--ui-text-muted); font-size: .86rem; white-space: pre-wrap; }
    .timeline-context { width: fit-content; padding: .2rem .45rem; border-radius: 999px; background: var(--ui-surface-muted); color: var(--ui-text-muted) !important; font-weight: 700; }
    .timeline-empty { margin: 0; padding: 2rem; color: var(--ui-text-muted); text-align: center; }
    .action-error { padding: .85rem 1rem; border: 1px solid color-mix(in srgb, var(--ui-danger) 30%, transparent); border-radius: .75rem; background: color-mix(in srgb, var(--ui-danger) 8%, white); color: var(--ui-danger); }
    .lead-state { min-height: 22rem; display: grid; place-content: center; justify-items: center; gap: 1rem; text-align: center; }
    .lead-state__pulse { width: min(32rem, 80vw); height: 4rem; border-radius: 1rem; background: linear-gradient(90deg, var(--ui-surface-muted), var(--ui-surface-subtle), var(--ui-surface-muted)); background-size: 200% 100%; animation: pulse 1.2s infinite; }
    @keyframes pulse { to { background-position: -200% 0; } }
    @media (max-width: 62rem) { .lead-grid { grid-template-columns: 1fr; } .status-panel { position: static; grid-row: 1; } }
    @media (max-width: 40rem) { .lead-hero { align-items: start; flex-direction: column; } .client-data { grid-template-columns: 1fr; } .client-data__message { grid-column: auto; } .timeline-list article header { display: grid; gap: .25rem; } }
    @media (prefers-reduced-motion: reduce) { .lead-state__pulse { animation: none; } }
  `,
})
export class LeadDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly leadsService = inject(LeadsService);
  private readonly activities = inject(LeadActivitiesService);
  private readonly usersService = inject(UsersService);
  private readonly dialog = inject(UiDialogService);
  protected readonly i18n = inject(I18nService);
  private readonly leadId = signal(this.route.snapshot.paramMap.get('leadId') ?? '');

  protected readonly actionPending = signal(false);
  protected readonly actionError = signal('');
  protected readonly leadResource = resource({
    params: () => this.leadId(),
    loader: ({ params }) => this.leadsService.getById(params),
  });
  protected readonly employeesResource = resource({ loader: () => this.usersService.listManagers() });
  protected readonly lead = computed(() => this.leadResource.value() ?? null);
  protected readonly loadError = computed(() => {
    const error = this.leadResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });
  protected readonly timelineEvents = computed(() => this.lead()?.events ?? []);

  protected readonly callTone = callStatusTone;
  protected readonly clientTone = clientStatusTone;
  protected readonly isTerminal = leadIsTerminal;

  protected clientStatusItems(lead: MockLead): readonly UiMenuItem[] {
    const items: readonly { value: Exclude<ClientStatus, 'new_lead'>; label: string; icon: UiMenuItem['icon'] }[] = [
      { value: 'showroom_invited', label: this.clientStatusLabel('showroom_invited'), icon: 'calendar_month' },
      { value: 'calculation_in_progress', label: this.clientStatusLabel('calculation_in_progress'), icon: 'automation' },
      { value: 'thinking', label: this.clientStatusLabel('thinking'), icon: 'warning' },
      { value: 'closed_lost', label: this.clientStatusLabel('closed_lost'), icon: 'close' },
      { value: 'contract_signed', label: this.clientStatusLabel('contract_signed'), icon: 'check_circle' },
    ];
    return items.map((item) => ({ ...item, disabled: item.value === lead.clientStatus }));
  }

  protected async openCallMenu(lead: MockLead): Promise<void> {
    const status = await firstValueFrom(
      this.dialog
        .open<RadialActionDialog, RadialActionDialogData<CallStatus>, CallStatus>(RadialActionDialog, {
          data: {
            title: this.i18n.t('leadDetail.callChoose'),
            hint: this.i18n.t('leadDetail.callHint'),
            actions: CALL_ACTIONS.map((action) => ({
              ...action,
              label: this.i18n.callStatusLabel(action.id),
            })),
            layout: CALL_RADIAL_LAYOUT,
          },
          panelClass: 'radial-menu-dialog-panel',
          backdropClass: 'radial-menu-backdrop',
          ariaLabel: this.i18n.t('leadDetail.callChoose'),
          maxWidth: '100vw',
          enterAnimationDuration: 0,
          exitAnimationDuration: 0,
        })
        .afterClosed(),
    );
    if (!status) return;
    let comment = '';
    if (status === 'reached') {
      const result = await this.openTextDialog({
        eyebrow: this.i18n.t('leadDetail.reachedEyebrow'),
        title: this.i18n.t('leadDetail.reachedTitle'),
        description: this.i18n.t('leadDetail.reachedDescription'),
        placeholder: this.i18n.t('leadDetail.reachedPlaceholder'),
        submitLabel: this.i18n.t('leadDetail.saveCall'),
      });
      if (!result) return;
      comment = result;
    }
    await this.runActivity(() => this.activities.recordCall(lead.id, status, comment));
  }

  protected async openComment(lead: MockLead): Promise<void> {
    const comment = await this.openTextDialog({
      eyebrow: this.i18n.t('leadDetail.noteEyebrow'),
      title: this.i18n.t('leadDetail.addComment'),
      description: this.i18n.t('leadDetail.commentDescription'),
      placeholder: this.i18n.t('leadDetail.commentPlaceholder'),
      submitLabel: this.i18n.t('leadDetail.addTimeline'),
    });
    if (!comment) return;
    await this.runActivity(() => this.activities.addComment(lead.id, comment));
  }

  protected async selectClientStatus(lead: MockLead, value: string): Promise<void> {
    const status = value as Exclude<ClientStatus, 'new_lead'>;
    if (status === lead.clientStatus) return;
    if (status === 'closed_lost') {
      const result = await firstValueFrom(
        this.dialog
          .open<CloseStatusDialog, never, CloseStatusResult>(CloseStatusDialog, {
            ariaLabelledBy: 'close-status-title',
            maxWidth: 'calc(100vw - 1rem)',
          })
          .afterClosed(),
      );
      if (!result) return;
      await this.runActivity(() =>
        this.activities.closeLead(lead.id, result.reason, result.comment),
      );
      return;
    }
    if (status === 'contract_signed') {
      const result = await firstValueFrom(
        this.dialog
          .open<ContractStatusDialog, ContractStatusDialogData, ContractStatusResult>(
            ContractStatusDialog,
            {
              data: { defaultCurrency: defaultCurrencyForOffice(lead.officeCode) },
              ariaLabelledBy: 'contract-status-title',
              maxWidth: 'calc(100vw - 1rem)',
            },
          )
          .afterClosed(),
      );
      if (!result) return;
      await this.runActivity(() =>
        this.activities.signContract(
          lead.id,
          result.contractNumber,
          result.amount,
          result.currency,
        ),
      );
      return;
    }
    await this.runActivity(() => this.activities.setClientStatus(lead.id, status));
  }

  protected async reopenLead(lead: MockLead): Promise<void> {
    await this.runActivity(() => this.activities.reopen(lead.id));
  }

  private async openTextDialog(data: TextActivityDialogData): Promise<string | undefined> {
    return firstValueFrom(
      this.dialog
        .open<TextActivityDialog, TextActivityDialogData, string>(TextActivityDialog, {
          data,
          ariaLabelledBy: 'text-activity-title',
          maxWidth: 'calc(100vw - 1rem)',
        })
        .afterClosed(),
    );
  }

  private async runActivity(action: () => Promise<void>): Promise<void> {
    if (this.actionPending()) return;
    this.actionError.set('');
    this.actionPending.set(true);
    try {
      await action();
      await this.leadResource.reload();
      await this.employeesResource.reload();
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : 'Не вдалося зберегти дію.');
    } finally {
      this.actionPending.set(false);
    }
  }

  protected eventTitle(event: LeadEvent): string {
    return presentEventTitleFromLeadEvent(event, this.i18n.locale());
  }

  protected eventBody(event: LeadEvent): string {
    return presentEventBodyFromLeadEvent(event, this.i18n.locale());
  }

  protected eventStatusLabel(event: LeadEvent): string {
    if (!event.statusCode) return '';
    if (event.category === 'call_status') return this.callStatusLabel(event.statusCode as CallStatus);
    if (event.category === 'client_status' || event.category === 'system') {
      return this.clientStatusLabel(event.statusCode as ClientStatus);
    }
    return '';
  }

  protected eventActorName(event: LeadEvent): string {
    return event.actorName?.trim() || this.employeeName(event.actorId || null);
  }

  protected employeeName(id: string | null): string {
    if (!id) return this.i18n.t('common.unassigned');
    return this.employeesResource.value()?.find((employee) => employee.id === id)?.displayName ?? this.i18n.t('common.unknown');
  }

  protected callStatusLabel(status: CallStatus): string {
    return this.i18n.callStatusLabel(status);
  }

  protected clientStatusLabel(status: ClientStatus): string {
    return this.i18n.clientStatusLabel(status);
  }

  protected sourceLabel(lead: MockLead): string {
    return this.i18n.sourceLabel(lead.source);
  }

  protected sourceIcon(lead: MockLead) {
    return LEAD_SOURCE_ICONS[lead.source];
  }

  protected officeName(code: string): string {
    return this.i18n.officeFilterLabel(code);
  }

  protected closeReasonLabel(code: string): string {
    return this.i18n.closeReasonLabel(code);
  }

  protected defaultCurrency(lead: MockLead): string {
    return defaultCurrencyForOffice(lead.officeCode);
  }

  protected formatDateTime(value: string | null | undefined): string {
    return this.i18n.formatDateTime(value);
  }

  protected formatMoney(value: number | null | undefined, currency: string): string {
    return this.i18n.formatMoney(value, currency);
  }
}
