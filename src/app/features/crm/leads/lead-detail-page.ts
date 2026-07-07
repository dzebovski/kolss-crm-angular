import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  CLOSE_REASON_LABELS,
  employeeInitials,
  FIRST_CALL_RESULTS,
  formatDateTime,
  formatMoney,
  LEAD_SOURCE_LABELS,
  leadIsTerminal,
  officeName,
  WORKFLOW_LABELS,
  workflowTone,
} from '../../../services/crm-mock.helpers';
import { CrmMockService } from '../../../services/crm-mock.service';
import type { CloseReason, MockLead } from '../../../services/crm-mock.types';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiButton } from '../../../ui/button/ui-button';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiSelect, UiSelectOption } from '../../../ui/form/ui-select';
import { UiTextField } from '../../../ui/form/ui-text-field';
import { UiTextarea } from '../../../ui/form/ui-textarea';

@Component({
  selector: 'app-lead-detail-page',
  imports: [RouterLink, UiBadge, UiButton, UiIcon, UiSelect, UiTextField, UiTextarea],
  template: `
    @if (lead(); as lead) {
      <section class="lead-page" [attr.aria-labelledby]="'lead-' + lead.id">
        <a class="back-link" routerLink="/crm/leads">
          <app-ui-icon name="arrow_back" [size]="17" />
          До списку лідів
        </a>

        <header class="lead-header">
          <div>
            <p class="page-kicker">{{ officeName(lead.officeCode) }} · {{ sourceLabel(lead) }}</p>
            <h1 [id]="'lead-' + lead.id">{{ lead.name }}</h1>
            <div class="lead-header__meta">
              <app-ui-badge [tone]="workflowTone(lead.workflowStatus)">
                {{ workflowLabel(lead) }}
              </app-ui-badge>
              <span>{{ formatDateTime(lead.sourceCreatedAt) }}</span>
            </div>
          </div>

          <div class="lead-actions">
            <app-ui-button
              variant="secondary"
              [disabled]="lead.assignedToId !== null || isTerminal(lead)"
              (pressed)="takeLead(lead)"
            >
              Взяти в роботу
            </app-ui-button>
            <app-ui-button
              variant="secondary"
              [disabled]="isTerminal(lead)"
              (pressed)="openCloseDialog()"
            >
              Закрити лід
            </app-ui-button>
            <app-ui-button [disabled]="isTerminal(lead)" (pressed)="openSuccessDialog()">
              Позначити успішним
            </app-ui-button>
          </div>
        </header>

        @if (actionError()) {
          <div class="inline-error" role="alert">{{ actionError() }}</div>
        }

        @if (isTerminal(lead)) {
          <article
            class="terminal-panel"
            [class.terminal-panel--success]="lead.workflowStatus === 'successful'"
          >
            <app-ui-icon
              [name]="lead.workflowStatus === 'successful' ? 'check_circle' : 'archive'"
              [size]="24"
              [filled]="lead.workflowStatus === 'successful'"
            />
            <div>
              <h2>{{ terminalTitle(lead) }}</h2>
              <p>{{ terminalDescription(lead) }}</p>
            </div>
          </article>
        }

        <div class="lead-layout">
          <main class="lead-main">
            @if (!lead.firstCall && !isTerminal(lead)) {
              <section class="workflow-panel" aria-labelledby="first-call-title">
                <header>
                  <span>01</span>
                  <div>
                    <h2 id="first-call-title">Перший дзвінок</h2>
                    <p>Після збереження блок стане подією в історії.</p>
                  </div>
                </header>
                <div class="workflow-grid">
                  <app-ui-select
                    label="Результат"
                    [options]="firstCallOptions"
                    [(value)]="firstCallResult"
                  />
                  <app-ui-textarea
                    label="Коментар"
                    [rows]="3"
                    placeholder="Що зʼясували під час дзвінка"
                    [(value)]="firstCallComment"
                  />
                </div>
                <app-ui-button (pressed)="saveFirstCall(lead)">Зберегти дзвінок</app-ui-button>
              </section>
            }

            @if (!isTerminal(lead)) {
              <section class="workflow-panel" aria-labelledby="visit-title">
                <header>
                  <span>02</span>
                  <div>
                    <h2 id="visit-title">Візит у салон</h2>
                    <p>Планування, перенесення або фіксація завершеного візиту.</p>
                  </div>
                </header>
                <div class="workflow-grid">
                  <app-ui-text-field
                    label="Дата і час"
                    placeholder="2026-07-10 13:00"
                    [(value)]="visitDate"
                  />
                  <app-ui-textarea
                    label="Коментар"
                    [rows]="3"
                    placeholder="Причина перенесення або результат візиту"
                    [(value)]="visitComment"
                  />
                </div>
                <div class="workflow-actions">
                  <app-ui-button variant="secondary" (pressed)="scheduleVisit(lead)">
                    Запланувати
                  </app-ui-button>
                  <app-ui-button
                    variant="secondary"
                    [disabled]="!lead.visit"
                    (pressed)="rescheduleVisit(lead)"
                  >
                    Перенести
                  </app-ui-button>
                  <app-ui-button [disabled]="!lead.visit" (pressed)="completeVisit(lead)">
                    Візит відбувся
                  </app-ui-button>
                </div>
              </section>

              <section class="workflow-panel" aria-labelledby="comment-title">
                <header>
                  <span>03</span>
                  <div>
                    <h2 id="comment-title">Коментар</h2>
                    <p>Звичайна нотатка менеджера додається у timeline.</p>
                  </div>
                </header>
                <app-ui-textarea
                  label="Новий коментар"
                  [rows]="3"
                  placeholder="Наступний крок або контекст розмови"
                  [(value)]="commentDraft"
                />
                <app-ui-button variant="secondary" (pressed)="addComment(lead)">
                  Додати коментар
                </app-ui-button>
              </section>
            }

            <section class="timeline-panel" aria-labelledby="timeline-title">
              <header>
                <h2 id="timeline-title">Історія активності</h2>
                <span>{{ lead.events.length }} подій</span>
              </header>
              <ol>
                @for (event of lead.events; track event.id) {
                  <li>
                    <span class="timeline-dot" aria-hidden="true"></span>
                    <div>
                      <strong>{{ event.title }}</strong>
                      <p>{{ event.body }}</p>
                      <small>
                        {{ employeeName(event.actorId) }} · {{ formatDateTime(event.occurredAt) }}
                      </small>
                    </div>
                  </li>
                }
              </ol>
            </section>
          </main>

          <aside class="lead-side" aria-label="Дані клієнта">
            <section class="summary-panel">
              <header>
                <div class="avatar" aria-hidden="true">{{ initials(lead.name) }}</div>
                <div>
                  <h2>Контакти</h2>
                  <p>{{ lead.cityRegion }}</p>
                </div>
              </header>
              <dl>
                <div>
                  <dt>Телефон</dt>
                  <dd>{{ lead.phone }}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{{ lead.email ?? '—' }}</dd>
                </div>
                <div>
                  <dt>Перший менеджер</dt>
                  <dd>{{ employeeName(lead.firstManagerId) }}</dd>
                </div>
                <div>
                  <dt>Продукт</dt>
                  <dd>{{ lead.productInterest }}</dd>
                </div>
                <div>
                  <dt>Бюджет</dt>
                  <dd>{{ formatMoney(lead.estimatedBudget) }}</dd>
                </div>
                <div>
                  <dt>Остання активність</dt>
                  <dd>{{ formatDateTime(lead.lastActivityAt) }}</dd>
                </div>
              </dl>
            </section>

            <section class="summary-panel">
              <h2>Початкове повідомлення</h2>
              <p>{{ lead.initialMessage }}</p>
            </section>

            <section class="summary-panel">
              <h2>Вкладення</h2>
              @if (lead.attachments.length) {
                <ul class="attachments">
                  @for (attachment of lead.attachments; track attachment.id) {
                    <li>
                      <app-ui-icon name="archive" [size]="18" />
                      <span>{{ attachment.name }}</span>
                      <small>{{ attachment.sizeLabel }}</small>
                    </li>
                  }
                </ul>
              } @else {
                <p class="muted">Файлів поки немає.</p>
              }
              <app-ui-button variant="secondary" [disabled]="true">
                <app-ui-icon name="add" [size]="17" />
                Додати файл
              </app-ui-button>
            </section>
          </aside>
        </div>

        @if (closeDialogOpen()) {
          <div class="modal-backdrop" role="presentation">
            <section
              class="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="close-dialog-title"
            >
              <h2 id="close-dialog-title">Закрити лід</h2>
              <p>Після закриття основні дії стануть неактивними.</p>
              @if (dialogError()) {
                <div class="inline-error" role="alert">{{ dialogError() }}</div>
              }
              <app-ui-select
                label="Причина"
                [options]="closeReasonOptions"
                [(value)]="closeReason"
              />
              <app-ui-textarea label="Коментар" [rows]="4" [(value)]="closeComment" />
              <div class="modal-actions">
                <app-ui-button variant="ghost" (pressed)="closeDialogOpen.set(false)"
                  >Скасувати</app-ui-button
                >
                <app-ui-button variant="danger" (pressed)="submitClose(lead)"
                  >Закрити</app-ui-button
                >
              </div>
            </section>
          </div>
        }

        @if (successDialogOpen()) {
          <div class="modal-backdrop" role="presentation">
            <section
              class="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="success-dialog-title"
            >
              <h2 id="success-dialog-title">Договір заключений</h2>
              <p>Номер і сума договору є обовʼязковими.</p>
              @if (dialogError()) {
                <div class="inline-error" role="alert">{{ dialogError() }}</div>
              }
              <app-ui-text-field label="Номер договору" [(value)]="contractNumber" />
              <app-ui-text-field label="Сума договору, EUR" [(value)]="contractAmount" />
              <app-ui-text-field label="Передоплата, EUR" [(value)]="contractPrepayment" />
              <app-ui-textarea label="Коментар" [rows]="3" [(value)]="contractComment" />
              <div class="modal-actions">
                <app-ui-button variant="ghost" (pressed)="successDialogOpen.set(false)"
                  >Скасувати</app-ui-button
                >
                <app-ui-button (pressed)="submitSuccess(lead)">Зберегти договір</app-ui-button>
              </div>
            </section>
          </div>
        }
      </section>
    } @else {
      <section class="missing-state">
        <app-ui-icon name="inbox" [size]="30" />
        <h1>Лід не знайдено</h1>
        <a routerLink="/crm/leads">Повернутись до списку</a>
      </section>
    }
  `,
  styles: `
    .lead-page {
      display: grid;
      gap: var(--ui-space-5);
    }

    .back-link {
      width: fit-content;
      color: var(--ui-text-muted);
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      font-size: 0.875rem;
      text-decoration: none;
    }

    .back-link:hover {
      color: var(--ui-action);
    }

    .lead-header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: var(--ui-space-6);
    }

    .page-kicker {
      margin: 0 0 var(--ui-space-2);
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 750;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-family: var(--ui-font-display);
      font-size: 2.25rem;
      letter-spacing: 0;
    }

    .lead-header__meta,
    .lead-actions,
    .workflow-actions,
    .modal-actions {
      display: flex;
      align-items: center;
      gap: var(--ui-space-2);
      flex-wrap: wrap;
    }

    .lead-header__meta {
      margin-top: var(--ui-space-3);
      color: var(--ui-text-muted);
      font-size: 0.875rem;
    }

    .lead-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 23rem;
      gap: var(--ui-space-5);
      align-items: start;
    }

    .lead-main,
    .lead-side {
      display: grid;
      gap: var(--ui-space-4);
    }

    .workflow-panel,
    .timeline-panel,
    .summary-panel,
    .terminal-panel {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
    }

    .workflow-panel,
    .summary-panel,
    .terminal-panel {
      padding: var(--ui-space-5);
      display: grid;
      gap: var(--ui-space-4);
    }

    .workflow-panel > header {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--ui-space-3);
      align-items: start;
    }

    .workflow-panel header span {
      width: 2rem;
      height: 2rem;
      border-radius: var(--ui-radius-md);
      background: color-mix(in srgb, var(--ui-action) 10%, white);
      color: var(--ui-action);
      display: grid;
      place-items: center;
      font-size: 0.75rem;
      font-weight: 800;
    }

    h2,
    .workflow-panel p,
    .summary-panel p,
    .terminal-panel p,
    .modal p {
      margin: 0;
    }

    h2 {
      font-size: 1rem;
    }

    .workflow-panel p,
    .summary-panel p,
    .terminal-panel p,
    .modal p,
    .muted {
      color: var(--ui-text-muted);
      font-size: 0.875rem;
    }

    .workflow-grid {
      display: grid;
      grid-template-columns: minmax(14rem, 0.8fr) minmax(16rem, 1.2fr);
      gap: var(--ui-space-4);
      align-items: start;
    }

    .terminal-panel {
      grid-template-columns: auto 1fr;
      align-items: start;
      background: var(--ui-danger-soft);
      color: var(--ui-danger);
    }

    .terminal-panel--success {
      background: var(--ui-success-soft);
      color: var(--ui-success);
    }

    .terminal-panel p {
      color: color-mix(in srgb, currentColor 82%, black);
    }

    .summary-panel header {
      display: flex;
      gap: var(--ui-space-3);
      align-items: center;
    }

    .avatar {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: var(--ui-radius-lg);
      background: var(--ui-brand-gradient);
      color: white;
      display: grid;
      place-items: center;
      font-weight: 800;
    }

    dl {
      margin: 0;
      display: grid;
      gap: var(--ui-space-3);
    }

    dl div {
      display: grid;
      gap: 0.125rem;
    }

    dt {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    dd {
      margin: 0;
      color: var(--ui-text);
      font-size: 0.875rem;
    }

    .attachments {
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--ui-space-2);
      list-style: none;
    }

    .attachments li {
      min-height: 2.5rem;
      padding: 0 var(--ui-space-3);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: var(--ui-space-2);
      font-size: 0.8125rem;
    }

    .attachments small {
      color: var(--ui-text-subtle);
    }

    .timeline-panel {
      overflow: hidden;
    }

    .timeline-panel > header {
      min-height: 3.25rem;
      padding: 0 var(--ui-space-5);
      border-bottom: 1px solid var(--ui-border);
      background: var(--ui-surface-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .timeline-panel header span {
      color: var(--ui-text-muted);
      font-size: 0.8125rem;
      font-weight: 650;
    }

    ol {
      margin: 0;
      padding: var(--ui-space-5);
      display: grid;
      gap: var(--ui-space-4);
      list-style: none;
    }

    li {
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--ui-space-3);
    }

    .timeline-dot {
      width: 0.75rem;
      height: 0.75rem;
      margin-top: 0.35rem;
      border: 2px solid var(--ui-action);
      border-radius: 50%;
      background: var(--ui-surface-raised);
    }

    li strong,
    li p,
    li small {
      display: block;
    }

    li p {
      margin: var(--ui-space-1) 0;
      color: var(--ui-text-muted);
    }

    li small {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
    }

    .inline-error {
      padding: var(--ui-space-3) var(--ui-space-4);
      border: 1px solid color-mix(in srgb, var(--ui-danger) 24%, white);
      border-radius: var(--ui-radius-md);
      background: var(--ui-danger-soft);
      color: var(--ui-danger);
      font-size: 0.875rem;
      font-weight: 650;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--ui-z-overlay);
      padding: var(--ui-space-6);
      background: rgb(23 16 32 / 48%);
      display: grid;
      place-items: center;
    }

    .modal {
      width: min(100%, 32rem);
      padding: var(--ui-space-6);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      display: grid;
      gap: var(--ui-space-4);
      box-shadow: var(--ui-shadow-3);
    }

    .modal h2 {
      font-family: var(--ui-font-display);
      font-size: 1.5rem;
    }

    .modal-actions {
      justify-content: flex-end;
    }

    .missing-state {
      min-height: 28rem;
      display: grid;
      place-items: center;
      align-content: center;
      gap: var(--ui-space-3);
      color: var(--ui-text-muted);
    }

    .missing-state h1 {
      font-size: 1.75rem;
    }
  `,
})
export class LeadDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly crm = inject(CrmMockService);

  protected readonly leadId = this.route.snapshot.paramMap.get('leadId') ?? '';
  protected readonly lead = computed(() => this.crm.leadById(this.leadId));
  protected readonly actionError = signal('');
  protected readonly dialogError = signal('');
  protected readonly closeDialogOpen = signal(false);
  protected readonly successDialogOpen = signal(false);

  protected readonly firstCallResult = signal<string>(FIRST_CALL_RESULTS[0]);
  protected readonly firstCallComment = signal('');
  protected readonly visitDate = signal('2026-07-10 13:00');
  protected readonly visitComment = signal('');
  protected readonly commentDraft = signal('');
  protected readonly closeReason = signal('no_contact');
  protected readonly closeComment = signal('');
  protected readonly contractNumber = signal('');
  protected readonly contractAmount = signal('');
  protected readonly contractPrepayment = signal('');
  protected readonly contractComment = signal('');

  protected readonly firstCallOptions: readonly UiSelectOption[] = FIRST_CALL_RESULTS.map(
    (result) => ({
      value: result,
      label: result,
    }),
  );
  protected readonly closeReasonOptions: readonly UiSelectOption[] = Object.entries(
    CLOSE_REASON_LABELS,
  ).map(([value, label]) => ({ value, label }));

  protected readonly formatDateTime = formatDateTime;
  protected readonly formatMoney = formatMoney;
  protected readonly officeName = officeName;
  protected readonly workflowTone = workflowTone;

  protected sourceLabel(lead: MockLead): string {
    return LEAD_SOURCE_LABELS[lead.source];
  }

  protected workflowLabel(lead: MockLead): string {
    return WORKFLOW_LABELS[lead.workflowStatus];
  }

  protected employeeName(employeeId: string | null): string {
    return this.crm.employeeName(employeeId);
  }

  protected initials(name: string): string {
    return employeeInitials(name);
  }

  protected isTerminal(lead: MockLead): boolean {
    return leadIsTerminal(lead);
  }

  protected terminalTitle(lead: MockLead): string {
    return lead.workflowStatus === 'successful' ? 'Лід успішно завершено' : 'Лід закрито';
  }

  protected terminalDescription(lead: MockLead): string {
    if (lead.contract) {
      return `Договір ${lead.contract.contractNumber}, сума ${formatMoney(lead.contract.amount)}.`;
    }
    if (lead.close) {
      return `${CLOSE_REASON_LABELS[lead.close.reason]}. ${lead.close.comment || 'Без додаткового коментаря.'}`;
    }
    return 'Основні дії недоступні для завершеного ліда.';
  }

  protected takeLead(lead: MockLead): void {
    this.clearErrors();
    this.crm.takeLead(lead.id);
  }

  protected saveFirstCall(lead: MockLead): void {
    this.setActionResult(
      this.crm.recordFirstCall(lead.id, this.firstCallResult(), this.firstCallComment()),
    );
    if (!this.actionError()) this.firstCallComment.set('');
  }

  protected scheduleVisit(lead: MockLead): void {
    this.setActionResult(this.crm.scheduleVisit(lead.id, this.visitDate(), this.visitComment()));
    if (!this.actionError()) this.visitComment.set('');
  }

  protected rescheduleVisit(lead: MockLead): void {
    this.setActionResult(this.crm.rescheduleVisit(lead.id, this.visitDate(), this.visitComment()));
    if (!this.actionError()) this.visitComment.set('');
  }

  protected completeVisit(lead: MockLead): void {
    this.setActionResult(this.crm.completeVisit(lead.id, this.visitComment()));
    if (!this.actionError()) this.visitComment.set('');
  }

  protected addComment(lead: MockLead): void {
    this.setActionResult(this.crm.addComment(lead.id, this.commentDraft()));
    if (!this.actionError()) this.commentDraft.set('');
  }

  protected openCloseDialog(): void {
    this.dialogError.set('');
    this.closeDialogOpen.set(true);
  }

  protected openSuccessDialog(): void {
    this.dialogError.set('');
    this.successDialogOpen.set(true);
  }

  protected submitClose(lead: MockLead): void {
    const error = this.crm.closeLead(lead.id, {
      reason: this.closeReason() as CloseReason,
      comment: this.closeComment(),
    });
    this.dialogError.set(error ?? '');
    if (!error) {
      this.closeDialogOpen.set(false);
      this.closeComment.set('');
    }
  }

  protected submitSuccess(lead: MockLead): void {
    const amount = this.parseMoney(this.contractAmount());
    const prepaymentRaw = this.contractPrepayment().trim();
    const prepayment = prepaymentRaw ? this.parseMoney(prepaymentRaw) : null;
    const error = this.crm.markSuccessful(lead.id, {
      contractNumber: this.contractNumber(),
      amount,
      prepayment,
      comment: this.contractComment(),
    });
    this.dialogError.set(error ?? '');
    if (!error) {
      this.successDialogOpen.set(false);
      this.contractNumber.set('');
      this.contractAmount.set('');
      this.contractPrepayment.set('');
      this.contractComment.set('');
    }
  }

  private clearErrors(): void {
    this.actionError.set('');
    this.dialogError.set('');
  }

  private setActionResult(error: string | null): void {
    this.actionError.set(error ?? '');
  }

  private parseMoney(value: string): number {
    return Number(value.replace(/\s/g, '').replace(',', '.'));
  }
}
