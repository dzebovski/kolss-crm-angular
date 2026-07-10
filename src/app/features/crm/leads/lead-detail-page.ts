import { Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import {
  presentEventBodyFromLeadEvent,
  presentEventTitleFromLeadEvent,
  presentHistoryAuditText,
} from '../../../core/i18n/event-presenter';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { canEditLeads } from '../../../core/roles/roles';
import { SessionService } from '../../../core/session/session.service';
import {
  CLOSE_REASON_LABELS,
  employeeInitials,
  FIRST_CALL_RESULT_CODES,
  LEAD_SOURCE_ICONS,
  leadIsTerminal,
  officeName,
  workflowTone,
} from '../../../services/crm-mock.helpers';
import { LeadWorkflowService } from '../../../services/lead-workflow.service';
import { LeadsService } from '../../../services/leads.service';
import { LossReasonsService } from '../../../services/loss-reasons.service';
import { UsersService } from '../../../services/users.service';
import type { CloseReason, LeadEvent, MockLead } from '../../../services/crm-mock.types';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiButton } from '../../../ui/button/ui-button';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { UiModal } from '../../../ui/dialog/ui-modal';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiUser } from '../../../ui/user/ui-user';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiTextField } from '../../../ui/form/ui-text-field';
import { UiTextarea } from '../../../ui/form/ui-textarea';

const NO_MANAGER_VALUE = '__none__';

@Component({
  selector: 'app-lead-detail-page',
  imports: [
    RouterLink,
    UiBadge,
    UiButton,
    UiIcon,
    UiModal,
    UiSelect,
    UiTextField,
    UiTextarea,
    UiUser,
    TranslatePipe,
  ],
  template: `
    @if (leadResource.isLoading()) {
      <section
        class="lead-page lead-page--loading"
        aria-busy="true"
        [attr.aria-label]="'lead.loading' | translate"
      >
        <span class="skeleton" style="--skeleton-w: 9rem; --skeleton-h: 1.25rem"></span>

        <header class="lead-header">
          <div class="skeleton-stack">
            <span class="skeleton" style="--skeleton-w: min(100%, 16rem)"></span>
            <span
              class="skeleton"
              style="
                --skeleton-w: min(100%, 22rem);
                --skeleton-h: 2.5rem;
                --skeleton-radius: var(--ui-radius-md);
              "
            ></span>
            <span class="skeleton" style="--skeleton-w: min(100%, 16rem)"></span>
          </div>
          <div class="lead-actions">
            <span
              class="skeleton"
              style="
                --skeleton-w: 8.5rem;
                --skeleton-h: var(--ui-control-height);
                --skeleton-radius: var(--ui-radius-md);
              "
            ></span>
            <span
              class="skeleton"
              style="
                --skeleton-w: 8.5rem;
                --skeleton-h: var(--ui-control-height);
                --skeleton-radius: var(--ui-radius-md);
              "
            ></span>
            <span
              class="skeleton"
              style="
                --skeleton-w: 8.5rem;
                --skeleton-h: var(--ui-control-height);
                --skeleton-radius: var(--ui-radius-md);
              "
            ></span>
          </div>
        </header>

        <div class="lead-layout">
          <main class="lead-main">
            @for (panel of skeletonPanels; track panel) {
              <section class="workflow-panel skeleton-panel">
                <span
                  class="skeleton"
                  style="
                    --skeleton-w: 45%;
                    --skeleton-h: 1.25rem;
                    --skeleton-radius: var(--ui-radius-md);
                  "
                ></span>
                <span class="skeleton" style="--skeleton-w: min(100%, 16rem)"></span>
                <span
                  class="skeleton"
                  style="
                    --skeleton-h: 5.75rem;
                    --skeleton-radius: var(--ui-radius-md);
                  "
                ></span>
              </section>
            }
          </main>

          <aside class="lead-side" aria-hidden="true">
            <section class="summary-panel skeleton-panel">
              <span
                class="skeleton"
                style="
                  --skeleton-w: 2.75rem;
                  --skeleton-h: 2.75rem;
                  --skeleton-radius: var(--ui-radius-lg);
                "
              ></span>
              <span
                class="skeleton"
                style="
                  --skeleton-w: 45%;
                  --skeleton-h: 1.25rem;
                  --skeleton-radius: var(--ui-radius-md);
                "
              ></span>
              <span class="skeleton" style="--skeleton-w: min(100%, 16rem)"></span>
              <span class="skeleton" style="--skeleton-w: min(100%, 16rem)"></span>
              <span class="skeleton" style="--skeleton-w: min(100%, 16rem)"></span>
            </section>
          </aside>
        </div>
      </section>
    } @else if (loadError()) {
      <section class="missing-state" role="alert">
        <app-ui-icon name="inbox" [size]="30" />
        <h1>{{ 'lead.loadFailedTitle' | translate }}</h1>
        <p>{{ loadError() }}</p>
        <a routerLink="/crm/leads">{{ 'lead.backToList' | translate }}</a>
      </section>
    } @else if (lead(); as lead) {
      <section class="lead-page" [attr.aria-labelledby]="'lead-' + lead.id">
        <a class="back-link" routerLink="/crm/leads">
          <app-ui-icon name="arrow_back" [size]="17" />
          {{ 'lead.backToLeads' | translate }}
        </a>

        <header class="lead-header">
          <div>
            <p class="page-kicker">
              {{ officeName(lead.officeCode) }} ·
              <span class="source-pill">
                <app-ui-icon [name]="sourceIcon(lead)" [size]="14" />
                {{ sourceLabel(lead) }}
              </span>
            </p>
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
              {{ 'lead.takeInWork' | translate }}
            </app-ui-button>
            <app-ui-button
              variant="secondary"
              [disabled]="isTerminal(lead)"
              (pressed)="openCloseDialog()"
            >
              {{ 'lead.closeLead' | translate }}
            </app-ui-button>
            <app-ui-button [disabled]="isTerminal(lead)" (pressed)="openSuccessDialog()">
              {{ 'lead.markSuccessful' | translate }}
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
            @if (lead.workflowStatus === 'closed' && lead.close) {
              <div class="terminal-panel__actions">
                <app-ui-button
                  variant="secondary"
                  size="small"
                  (pressed)="openEditCloseDialog(lead)"
                >
                  <app-ui-icon name="edit" [size]="16" />
                  {{ 'common.edit' | translate }}
                </app-ui-button>
                @if (canDeleteLead(lead)) {
                  <app-ui-button
                    variant="danger"
                    size="small"
                    [loading]="deletingLead()"
                    (pressed)="confirmDeleteLead(lead)"
                  >
                    <app-ui-icon name="delete" [size]="16" />
                    {{ 'lead.deleteForeverShort' | translate }}
                  </app-ui-button>
                }
              </div>
            }
          </article>
        }

        <div class="lead-layout">
          <main class="lead-main">
            @if (!lead.firstCall && !isTerminal(lead)) {
              <section class="workflow-panel" aria-labelledby="first-call-title">
                <header>
                  <span>01</span>
                  <div>
                    <h2 id="first-call-title">{{ 'workflow.first_call_done' | translate }}</h2>
                    <p>{{ 'lead.afterSaveHistory' | translate }}</p>
                  </div>
                </header>
                <div class="workflow-grid">
                  <app-ui-select
                    [label]="'common.result' | translate"
                    [options]="firstCallOptions()"
                    [(value)]="firstCallResult"
                  />
                  <app-ui-textarea
                    [label]="'lead.comment' | translate"
                    [rows]="3"
                    [placeholder]="'lead.callCommentPlaceholder' | translate"
                    [(value)]="firstCallComment"
                  />
                </div>
                <app-ui-button (pressed)="saveFirstCall(lead)">
                  {{ 'lead.saveCall' | translate }}
                </app-ui-button>
              </section>
            }

            @if (!isTerminal(lead)) {
              <section class="workflow-panel" aria-labelledby="visit-title">
                <header>
                  <span>02</span>
                  <div>
                    <h2 id="visit-title">{{ 'lead.visitSalon' | translate }}</h2>
                    <p>{{ 'lead.visitHint' | translate }}</p>
                  </div>
                </header>
                <div class="workflow-grid">
                  <app-ui-text-field
                    [label]="'common.date' | translate"
                    type="date"
                    [(value)]="visitDate"
                  />
                  <app-ui-textarea
                    [label]="'lead.comment' | translate"
                    [rows]="3"
                    [placeholder]="'lead.visitCommentPlaceholder' | translate"
                    [(value)]="visitComment"
                  />
                </div>
                <div class="workflow-actions">
                  <app-ui-button variant="secondary" (pressed)="scheduleVisit(lead)">
                    {{ 'lead.schedule' | translate }}
                  </app-ui-button>
                  <app-ui-button
                    variant="secondary"
                    [disabled]="!lead.visit"
                    (pressed)="rescheduleVisit(lead)"
                  >
                    {{ 'lead.reschedule' | translate }}
                  </app-ui-button>
                  <app-ui-button [disabled]="!lead.visit" (pressed)="completeVisit(lead)">
                    {{ 'workflow.visit_completed' | translate }}
                  </app-ui-button>
                </div>
              </section>

              <section class="workflow-panel" aria-labelledby="comment-title">
                <header>
                  <span>03</span>
                  <div>
                    <h2 id="comment-title">{{ 'lead.comment' | translate }}</h2>
                    <p>{{ 'lead.commentHint' | translate }}</p>
                  </div>
                </header>
                <app-ui-textarea
                  [label]="'lead.newComment' | translate"
                  [rows]="3"
                  [placeholder]="'lead.commentPlaceholder' | translate"
                  [(value)]="commentDraft"
                />
                <app-ui-button variant="secondary" (pressed)="addComment(lead)">
                  {{ 'lead.addComment' | translate }}
                </app-ui-button>
              </section>
            }

            <section class="timeline-panel" aria-labelledby="timeline-title">
              <header>
                <h2 id="timeline-title">{{ 'lead.activityHistory' | translate }}</h2>
                <span>{{ 'lead.eventsCount' | translate: { count: lead.events.length } }}</span>
              </header>
              <ol class="timeline-list">
                @for (event of lead.events; track event.id) {
                  <li class="timeline-item">
                    <span class="timeline-dot" aria-hidden="true"></span>
                    <div class="timeline-content">
                      <div class="timeline-item__header">
                        <strong>{{ eventTitle(event) }}</strong>
                        @if (canEditLead(lead)) {
                          <app-ui-button
                            variant="ghost"
                            size="small"
                            (pressed)="openHistoryEditDialog(event)"
                          >
                            <app-ui-icon name="edit" [size]="16" />
                            {{ 'common.edit' | translate }}
                          </app-ui-button>
                        }
                      </div>
                      @if (eventBody(event); as body) {
                        <p>{{ body }}</p>
                      }
                      @if (historyAuditText(event); as auditText) {
                        <p class="timeline-audit">{{ auditText }}</p>
                      }
                      <small>
                        <app-ui-user
                          [userId]="event.actorId || null"
                          [name]="employeeName(event.actorId)"
                          size="xs"
                        />
                        · {{ formatDateTime(event.occurredAt) }}
                      </small>
                    </div>
                  </li>
                }
              </ol>
            </section>
          </main>

          <aside class="lead-side" [attr.aria-label]="'lead.clientData' | translate">
            <section class="summary-panel">
              <header class="summary-panel__header">
                <div class="summary-panel__title">
                  <div class="avatar" aria-hidden="true">{{ initials(lead.name) }}</div>
                  <div>
                    <h2>{{ 'lead.contacts' | translate }}</h2>
                    <p>{{ lead.cityRegion }}</p>
                  </div>
                </div>
                @if (canEditLead(lead)) {
                  <app-ui-button
                    variant="secondary"
                    size="small"
                    (pressed)="openLeadEditDialog(lead)"
                  >
                    <app-ui-icon name="edit" [size]="16" />
                    {{ 'common.edit' | translate }}
                  </app-ui-button>
                }
              </header>
              <dl>
                <div>
                  <dt>{{ 'common.phone' | translate }}</dt>
                  <dd>{{ lead.phone }}</dd>
                </div>
                <div>
                  <dt>{{ 'common.email' | translate }}</dt>
                  <dd>{{ lead.email ?? '—' }}</dd>
                </div>
                <div>
                  <dt>{{ 'common.manager' | translate }}</dt>
                  <dd>
                    @if (lead.assignedToId) {
                      <app-ui-user
                        [userId]="lead.assignedToId"
                        [name]="employeeName(lead.assignedToId)"
                        size="sm"
                      />
                    } @else {
                      <span class="muted">{{ 'common.unassigned' | translate }}</span>
                    }
                  </dd>
                </div>
                <div>
                  <dt>{{ 'common.product' | translate }}</dt>
                  <dd>{{ lead.productInterest }}</dd>
                </div>
                <div>
                  <dt>{{ 'common.budget' | translate }}</dt>
                  <dd>{{ formatMoney(lead.estimatedBudget) }}</dd>
                </div>
                <div>
                  <dt>{{ 'accounts.lastActivity' | translate }}</dt>
                  <dd>{{ formatDateTime(lead.lastActivityAt) }}</dd>
                </div>
              </dl>
            </section>

            <section class="summary-panel">
              <h2>{{ 'lead.initialMessage' | translate }}</h2>
              <p>{{ lead.initialMessage }}</p>
            </section>

            <section class="summary-panel">
              <h2>{{ 'event.attachment' | translate }}</h2>
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
                <p class="muted">{{ 'lead.noFiles' | translate }}</p>
              }
              <app-ui-button variant="secondary" [disabled]="true">
                <app-ui-icon name="add" [size]="17" />
                {{ 'lead.addFile' | translate }}
              </app-ui-button>
            </section>
          </aside>
        </div>

        @if (editLeadDialogOpen()) {
          <app-ui-modal
            [wide]="true"
            labelledBy="edit-lead-dialog-title"
            (dismissed)="closeLeadEditDialog()"
          >
              <h2 id="edit-lead-dialog-title">{{ 'lead.editLeadTitle' | translate }}</h2>
              <p>{{ 'lead.editLeadHint' | translate }}</p>
              @if (dialogError()) {
                <div class="inline-error" role="alert">{{ dialogError() }}</div>
              }

              <div class="modal-section">
                <h3>{{ 'lead.contacts' | translate }}</h3>
                <div class="modal-grid">
                  <app-ui-text-field [label]="'common.name' | translate" [(value)]="editLeadName" />
                  <app-ui-text-field
                    [label]="'common.phone' | translate"
                    type="tel"
                    [(value)]="editLeadPhone"
                  />
                  <app-ui-text-field
                    [label]="'common.email' | translate"
                    type="email"
                    [(value)]="editLeadEmail"
                  />
                  <app-ui-text-field
                    [label]="'common.cityRegion' | translate"
                    [(value)]="editLeadCityRegion"
                  />
                </div>
              </div>

              <div class="modal-section">
                <h3>{{ 'lead.leadData' | translate }}</h3>
                <div class="modal-grid">
                  <app-ui-text-field
                    [label]="'common.product' | translate"
                    [(value)]="editLeadProductInterest"
                  />
                  <app-ui-text-field
                    [label]="'common.budgetEur' | translate"
                    [(value)]="editLeadBudget"
                  />
                  <app-ui-select
                    [label]="'common.manager' | translate"
                    [options]="managerOptions(lead)"
                    [(value)]="editLeadAssignedToId"
                  />
                </div>
                <app-ui-textarea
                  [label]="'lead.initialMessage' | translate"
                  [rows]="4"
                  [(value)]="editLeadInitialMessage"
                />
              </div>

              <div class="modal-actions">
                <app-ui-button variant="ghost" (pressed)="closeLeadEditDialog()">
                  {{ 'common.cancel' | translate }}
                </app-ui-button>
                <app-ui-button (pressed)="submitLeadEdit(lead)">
                  {{ 'common.save' | translate }}
                </app-ui-button>
              </div>
          </app-ui-modal>
        }

        @if (editHistoryDialogOpen()) {
          <app-ui-modal
            labelledBy="edit-history-dialog-title"
            (dismissed)="closeHistoryEditDialog()"
          >
              <h2 id="edit-history-dialog-title">{{ 'lead.editHistory' | translate }}</h2>
              <p>{{ 'lead.editHistoryHint' | translate }}</p>
              @if (dialogError()) {
                <div class="inline-error" role="alert">{{ dialogError() }}</div>
              }
              <app-ui-select
                [label]="'common.type' | translate"
                [options]="historyEventTypeOptions()"
                [(value)]="editHistoryType"
              />
              <app-ui-textarea
                [label]="'common.message' | translate"
                [rows]="4"
                [(value)]="editHistoryComment"
              />
              <div class="modal-actions">
                <app-ui-button variant="ghost" (pressed)="closeHistoryEditDialog()">
                  {{ 'common.cancel' | translate }}
                </app-ui-button>
                <app-ui-button (pressed)="submitHistoryEdit(lead)">
                  {{ 'common.save' | translate }}
                </app-ui-button>
              </div>
          </app-ui-modal>
        }

        @if (closeDialogOpen()) {
          <app-ui-modal labelledBy="close-dialog-title" (dismissed)="closeCloseDialog()">
              <h2 id="close-dialog-title">
                {{
                  closeDialogMode() === 'edit'
                    ? ('lead.editCloseTitle' | translate)
                    : ('lead.closeLead' | translate)
                }}
              </h2>
              <p>
                {{
                  closeDialogMode() === 'edit'
                    ? ('lead.editCloseHint' | translate)
                    : ('lead.closeHint' | translate)
                }}
              </p>
              @if (dialogError()) {
                <div class="inline-error" role="alert">{{ dialogError() }}</div>
              }
              <app-ui-select
                [label]="'common.reason' | translate"
                [options]="closeReasonOptions()"
                [(value)]="closeReason"
              />
              <app-ui-textarea
                [label]="'lead.comment' | translate"
                [rows]="4"
                [(value)]="closeComment"
              />
              <div class="modal-actions">
                <app-ui-button variant="ghost" (pressed)="closeCloseDialog()">
                  {{ 'common.cancel' | translate }}
                </app-ui-button>
                <app-ui-button
                  [variant]="closeDialogMode() === 'edit' ? 'primary' : 'danger'"
                  (pressed)="submitClose(lead)"
                >
                  {{
                    closeDialogMode() === 'edit'
                      ? ('common.save' | translate)
                      : ('common.close' | translate)
                  }}
                </app-ui-button>
              </div>
          </app-ui-modal>
        }

        @if (successDialogOpen()) {
          <app-ui-modal labelledBy="success-dialog-title" (dismissed)="closeSuccessDialog()">
              <h2 id="success-dialog-title">{{ 'workflow.successful' | translate }}</h2>
              <p>{{ 'lead.successHint' | translate }}</p>
              @if (dialogError()) {
                <div class="inline-error" role="alert">{{ dialogError() }}</div>
              }
              <app-ui-text-field
                [label]="'lead.contractNumber' | translate"
                [(value)]="contractNumber"
              />
              <app-ui-text-field
                [label]="'lead.contractAmount' | translate"
                [(value)]="contractAmount"
              />
              <app-ui-text-field
                [label]="'lead.contractPrepayment' | translate"
                [(value)]="contractPrepayment"
              />
              <app-ui-textarea
                [label]="'lead.comment' | translate"
                [rows]="3"
                [(value)]="contractComment"
              />
              <div class="modal-actions">
                <app-ui-button variant="ghost" (pressed)="closeSuccessDialog()">
                  {{ 'common.cancel' | translate }}
                </app-ui-button>
                <app-ui-button (pressed)="submitSuccess(lead)">
                  {{ 'lead.saveContract' | translate }}
                </app-ui-button>
              </div>
          </app-ui-modal>
        }
      </section>
    } @else {
      <section class="missing-state">
        <app-ui-icon name="inbox" [size]="30" />
        <h1>{{ 'lead.notFound' | translate }}</h1>
        <a routerLink="/crm/leads">{{ 'lead.backToList' | translate }}</a>
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

    .source-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      white-space: nowrap;
    }

    .source-pill app-ui-icon {
      color: currentColor;
      transform: translateY(1px);
    }

    h1 {
      margin: 0;
      font-family: var(--ui-font-display), sans-serif;
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
      grid-template-columns: minmax(0, 1fr);
      gap: var(--ui-space-4);
      align-items: start;
    }

    .terminal-panel {
      grid-template-columns: auto 1fr auto;
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

    .terminal-panel__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ui-space-2);
      justify-content: flex-end;
    }

    .summary-panel header,
    .summary-panel__title {
      display: flex;
      gap: var(--ui-space-3);
      align-items: center;
    }

    .summary-panel__header {
      justify-content: space-between;
      align-items: start;
    }

    .summary-panel__title {
      min-width: 0;
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

    .timeline-list {
      margin: 0;
      padding: var(--ui-space-5);
      display: grid;
      list-style: none;
    }

    .timeline-item {
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--ui-space-3);
      padding-bottom: var(--ui-space-4);
    }

    .timeline-item:last-child {
      padding-bottom: 0;
    }

    .timeline-item:not(:last-child)::after {
      content: '';
      position: absolute;
      top: 1.15rem;
      bottom: 0;
      left: 0.3125rem;
      width: 2px;
      border-radius: var(--ui-radius-pill);
      background: color-mix(in srgb, var(--ui-action) 22%, var(--ui-border));
    }

    .timeline-dot {
      position: relative;
      z-index: 1;
      width: 0.75rem;
      height: 0.75rem;
      margin-top: 0.35rem;
      border: 2px solid var(--ui-action);
      border-radius: 50%;
      background: var(--ui-surface-raised);
    }

    .timeline-content {
      min-width: 0;
    }

    .timeline-item__header {
      display: flex;
      justify-content: space-between;
      gap: var(--ui-space-3);
      align-items: start;
    }

    .timeline-content strong,
    .timeline-content p,
    .timeline-content small {
      display: block;
    }

    .timeline-content p {
      margin: var(--ui-space-1) 0;
      color: var(--ui-text-muted);
    }

    .timeline-audit {
      color: var(--ui-action);
      font-size: 0.8125rem;
      font-weight: 650;
    }

    .timeline-content small {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
    }

    .timeline-content small app-ui-user {
      display: inline-flex;
      vertical-align: middle;
      max-width: 16rem;
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

    .modal-section {
      display: grid;
      gap: var(--ui-space-3);
    }

    .modal-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-4);
      align-items: start;
    }

    .modal-actions {
      justify-content: flex-end;
    }

    @media (max-width: 48rem) {
      .lead-header,
      .lead-layout,
      .modal-grid {
        grid-template-columns: minmax(0, 1fr);
      }

      .lead-header {
        display: grid;
        align-items: start;
      }

      .summary-panel__header,
      .timeline-item__header {
        display: grid;
      }
    }

    .lead-page--loading .lead-header {
      align-items: start;
    }

    .skeleton-stack,
    .skeleton-panel {
      display: grid;
      gap: var(--ui-space-3);
    }

    .skeleton {
      display: block;
      width: var(--skeleton-w, 100%);
      height: var(--skeleton-h, 0.875rem);
      border-radius: var(--skeleton-radius, var(--ui-radius-pill));
      background: linear-gradient(
        90deg,
        var(--ui-surface-subtle),
        var(--ui-surface-muted),
        var(--ui-surface-subtle)
      );
      animation: lead-skeleton 1.15s ease-in-out infinite;
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

    .missing-state p {
      margin: 0;
      font-size: 0.875rem;
    }

    @keyframes lead-skeleton {
      50% {
        opacity: 0.58;
      }
    }
  `,
})
export class LeadDetailPage {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(UiDialogService);
  private readonly session = inject(SessionService);
  private readonly leadsService = inject(LeadsService);
  private readonly workflowService = inject(LeadWorkflowService);
  private readonly usersService = inject(UsersService);
  private readonly lossReasonsService = inject(LossReasonsService);
  protected readonly i18n = inject(I18nService);

  protected readonly leadId = this.route.snapshot.paramMap.get('leadId') ?? '';
  protected readonly leadResource = resource({
    params: () => ({ leadId: this.leadId }),
    loader: ({ params }) => this.leadsService.getById(params.leadId),
  });
  protected readonly employeesResource = resource({
    loader: () => this.usersService.listEmployees(),
  });
  protected readonly lossReasonsResource = resource({
    loader: () => this.lossReasonsService.list(),
  });

  protected readonly lead = computed(() => this.leadResource.value() ?? null);
  protected readonly loadError = computed(() => {
    const error = this.leadResource.error();
    return error ? this.i18n.t('error.leadLoadFailed') : '';
  });
  protected readonly actionError = signal('');
  protected readonly dialogError = signal('');
  protected readonly actionPending = signal(false);
  protected readonly deletingLead = signal(false);
  protected readonly closeDialogOpen = signal(false);
  protected readonly closeDialogMode = signal<'close' | 'edit'>('close');
  protected readonly successDialogOpen = signal(false);
  protected readonly editLeadDialogOpen = signal(false);
  protected readonly editHistoryDialogOpen = signal(false);
  protected readonly editingHistoryEvent = signal<LeadEvent | null>(null);

  protected readonly firstCallResult = signal<string>(FIRST_CALL_RESULT_CODES[0]);
  protected readonly firstCallComment = signal('');
  protected readonly visitDate = signal('2026-07-10');
  protected readonly visitComment = signal('');
  protected readonly commentDraft = signal('');
  protected readonly editLeadName = signal('');
  protected readonly editLeadPhone = signal('');
  protected readonly editLeadEmail = signal('');
  protected readonly editLeadCityRegion = signal('');
  protected readonly editLeadProductInterest = signal('');
  protected readonly editLeadBudget = signal('');
  protected readonly editLeadInitialMessage = signal('');
  protected readonly editLeadAssignedToId = signal(NO_MANAGER_VALUE);
  protected readonly editHistoryType = signal('comment');
  protected readonly editHistoryComment = signal('');
  protected readonly closeReason = signal('no_contact');
  protected readonly closeComment = signal('');
  protected readonly contractNumber = signal('');
  protected readonly contractAmount = signal('');
  protected readonly contractPrepayment = signal('');
  protected readonly contractComment = signal('');
  protected readonly skeletonPanels = [1, 2, 3];

  protected readonly firstCallOptions = computed((): readonly UiSelectOption[] =>
    FIRST_CALL_RESULT_CODES.map((code) => ({
      value: code,
      label: this.i18n.firstCallResultLabel(code),
    })),
  );
  protected readonly closeReasonOptions = computed((): readonly UiSelectOption[] => {
    const reasons = this.lossReasonsResource.value();
    if (reasons?.length) {
      return reasons.map((reason) => ({
        value: reason.code,
        label: this.i18n.tField(reason as unknown as Record<string, unknown>, 'label', reason.code),
      }));
    }
    return Object.keys(CLOSE_REASON_LABELS).map((value) => ({
      value,
      label: this.i18n.closeReasonLabel(value),
    }));
  });
  protected readonly defaultCloseReason = computed(
    () => this.closeReasonOptions()[0]?.value ?? 'not_target',
  );
  protected readonly historyEventTypeOptions = computed((): readonly UiSelectOption[] => {
    const types = [
      'created',
      'lead_assigned',
      'taken',
      'contact_attempt',
      'first_call',
      'showroom_visit_scheduled',
      'visit_scheduled',
      'visit_rescheduled',
      'showroom_visit_completed',
      'visit_completed',
      'comment',
      'closed',
      'bad_lead',
      'contract_signed',
      'successful',
      'attachment',
      'lead_updated',
    ] as const;
    return types.map((value) => ({ value, label: this.i18n.eventTitle(value) }));
  });

  protected formatDateTime = (value: string | null | undefined) => this.i18n.formatDateTime(value);
  protected formatMoney = (value: number | null | undefined) => this.i18n.formatMoney(value);
  protected readonly officeName = officeName;
  protected readonly workflowTone = workflowTone;

  protected canEditLead(lead: MockLead): boolean {
    const role = this.auth.profile()?.role;
    if (!canEditLeads(role)) return false;
    if (role === 'super_admin') return true;
    return (
      role === 'office_admin' &&
      (this.session.officeContext()?.userOffices ?? []).some(
        (office) => office.code === lead.officeCode,
      )
    );
  }

  protected canDeleteLead(lead: MockLead): boolean {
    if (lead.workflowStatus !== 'closed') return false;
    return this.canEditLead(lead);
  }

  protected async confirmDeleteLead(lead: MockLead): Promise<void> {
    if (!this.canDeleteLead(lead) || this.deletingLead()) return;

    const confirmed = await firstValueFrom(
      this.dialog
        .confirm({
          title: this.i18n.t('lead.deleteForever'),
          description: this.i18n.t('lead.deleteForeverDesc', { name: lead.name }),
          confirmLabel: this.i18n.t('common.delete'),
          cancelLabel: this.i18n.t('common.cancel'),
          danger: true,
        })
        .afterClosed(),
    );
    if (!confirmed) return;

    this.actionError.set('');
    this.deletingLead.set(true);
    try {
      await this.leadsService.deleteLead(lead.id);
      await this.router.navigate(['/crm/leads']);
    } catch (error) {
      this.actionError.set(
        error instanceof Error ? error.message : this.i18n.t('error.leadDeleteFailed'),
      );
    } finally {
      this.deletingLead.set(false);
    }
  }

  protected managerOptions(lead: MockLead): readonly UiSelectOption[] {
    const employees = this.employeesResource.value() ?? [];
    const options = employees
      .filter(
        (employee) =>
          employee.status === 'active' &&
          employee.role !== 'super_admin' &&
          employee.officeIds.includes(lead.officeCode),
      )
      .map((employee) => ({
        value: employee.id,
        label: employee.displayName,
      }));
    if (lead.assignedToId && !options.some((option) => option.value === lead.assignedToId)) {
      options.push({
        value: lead.assignedToId,
        label: this.employeeName(lead.assignedToId),
      });
    }
    return [{ value: NO_MANAGER_VALUE, label: this.i18n.t('common.unassigned') }, ...options];
  }

  protected eventTitle(event: LeadEvent): string {
    this.i18n.locale();
    return presentEventTitleFromLeadEvent(event, this.i18n.locale());
  }

  protected eventBody(event: LeadEvent): string {
    this.i18n.locale();
    return presentEventBodyFromLeadEvent(event, this.i18n.locale());
  }

  protected historyAuditText(event: LeadEvent): string {
    this.i18n.locale();
    return presentHistoryAuditText(event, this.i18n.locale(), (value) =>
      this.i18n.formatDateTime(value),
    );
  }

  protected sourceLabel(lead: MockLead): string {
    return this.i18n.sourceLabel(lead.source);
  }

  protected sourceIcon(lead: MockLead) {
    return LEAD_SOURCE_ICONS[lead.source];
  }

  protected workflowLabel(lead: MockLead): string {
    return this.i18n.workflowLabel(lead.workflowStatus);
  }

  protected employeeName(employeeId: string | null): string {
    const employees = this.employeesResource.value() ?? [];
    if (!employeeId) return this.i18n.t('common.unassigned');
    return (
      employees.find((employee) => employee.id === employeeId)?.displayName ??
      this.i18n.t('common.unknown')
    );
  }

  protected initials(name: string): string {
    return employeeInitials(name);
  }

  protected isTerminal(lead: MockLead): boolean {
    return leadIsTerminal(lead);
  }

  protected terminalTitle(lead: MockLead): string {
    return lead.workflowStatus === 'successful'
      ? this.i18n.t('lead.terminalSuccess')
      : this.i18n.t('lead.terminalClosed');
  }

  protected terminalDescription(lead: MockLead): string {
    if (lead.contract) {
      return this.i18n.t('lead.contractSummary', {
        number: lead.contract.contractNumber,
        amount: this.i18n.formatMoney(lead.contract.amount),
      });
    }
    if (lead.close) {
      const reasonLabel = this.i18n.closeReasonLabel(
        lead.close.reason,
        this.lossReasonsResource.value(),
      );
      return `${reasonLabel}. ${lead.close.comment || this.i18n.t('common.noAdditionalComment')}`;
    }
    return this.i18n.t('lead.terminalUnavailable');
  }

  protected async takeLead(lead: MockLead): Promise<void> {
    await this.runAction(() => this.workflowService.takeLead(lead.id));
  }

  protected async saveFirstCall(lead: MockLead): Promise<void> {
    await this.runAction(async () => {
      const error = await this.workflowService.recordFirstCall(
        lead.id,
        this.firstCallResult() as (typeof FIRST_CALL_RESULT_CODES)[number],
        this.firstCallComment(),
      );
      if (error) return error;
      this.firstCallComment.set('');
      return;
    });
  }

  protected async scheduleVisit(lead: MockLead): Promise<void> {
    await this.runAction(async () => {
      const error = await this.workflowService.scheduleVisit(
        lead.id,
        this.normalizedVisitDate(),
        this.visitComment(),
      );
      if (error) return error;
      this.visitComment.set('');
      return;
    });
  }

  protected async rescheduleVisit(lead: MockLead): Promise<void> {
    await this.runAction(async () => {
      const error = await this.workflowService.rescheduleVisit(
        lead.id,
        this.normalizedVisitDate(),
        this.visitComment(),
      );
      if (error) return error;
      this.visitComment.set('');
      return;
    });
  }

  protected async completeVisit(lead: MockLead): Promise<void> {
    await this.runAction(async () => {
      const error = await this.workflowService.completeVisit(lead.id, this.visitComment());
      if (error) return error;
      this.visitComment.set('');
      return;
    });
  }

  protected async addComment(lead: MockLead): Promise<void> {
    await this.runAction(async () => {
      const error = await this.workflowService.addComment(lead.id, this.commentDraft());
      if (error) return error;
      this.commentDraft.set('');
      return;
    });
  }

  protected openLeadEditDialog(lead: MockLead): void {
    this.dialogError.set('');
    this.editLeadName.set(lead.name === this.i18n.t('lead.noName') ? '' : lead.name);
    this.editLeadPhone.set(lead.phone === '—' ? '' : lead.phone);
    this.editLeadEmail.set(lead.email ?? '');
    this.editLeadCityRegion.set(lead.cityRegion);
    this.editLeadProductInterest.set(lead.productInterest);
    this.editLeadBudget.set(lead.estimatedBudget == null ? '' : String(lead.estimatedBudget));
    this.editLeadInitialMessage.set(lead.initialMessage);
    this.editLeadAssignedToId.set(lead.assignedToId ?? NO_MANAGER_VALUE);
    this.editLeadDialogOpen.set(true);
  }

  protected closeLeadEditDialog(): void {
    this.dialogError.set('');
    this.editLeadDialogOpen.set(false);
  }

  protected async submitLeadEdit(lead: MockLead): Promise<void> {
    this.dialogError.set('');
    if (!this.canEditLead(lead)) {
      this.dialogError.set(this.i18n.t('lead.editForbidden'));
      return;
    }

    const name = this.editLeadName().trim();
    const phone = this.editLeadPhone().trim();
    const email = this.nullableText(this.editLeadEmail());
    const estimatedBudget = this.parseOptionalMoney(this.editLeadBudget());
    if (!name) {
      this.dialogError.set(this.i18n.t('lead.nameRequired'));
      return;
    }
    if (!phone) {
      this.dialogError.set(this.i18n.t('lead.phoneRequired'));
      return;
    }
    if (email && !this.isValidEmail(email)) {
      this.dialogError.set(this.i18n.t('lead.emailInvalid'));
      return;
    }
    if (Number.isNaN(estimatedBudget) || (estimatedBudget != null && estimatedBudget < 0)) {
      this.dialogError.set(this.i18n.t('lead.budgetInvalid'));
      return;
    }

    const payload = {
      name,
      phone,
      email,
      cityRegion: this.editLeadCityRegion().trim(),
      productInterest: this.editLeadProductInterest().trim(),
      estimatedBudget,
      initialMessage: this.editLeadInitialMessage().trim(),
      assignedToId:
        this.editLeadAssignedToId() === NO_MANAGER_VALUE ? null : this.editLeadAssignedToId(),
    };
    const changedFields = this.changedLeadFields(lead, payload);
    if (!changedFields.length) {
      this.editLeadDialogOpen.set(false);
      return;
    }

    try {
      await this.leadsService.updateLeadDetails(lead.id, payload, changedFields);
      this.editLeadDialogOpen.set(false);
      await this.leadResource.reload();
    } catch (error) {
      this.dialogError.set(
        error instanceof Error ? error.message : this.i18n.t('lead.saveChangesFailed'),
      );
    }
  }

  protected openHistoryEditDialog(event: LeadEvent): void {
    this.dialogError.set('');
    this.editingHistoryEvent.set(event);
    this.editHistoryType.set(event.rawType ?? event.type);
    this.editHistoryComment.set(event.comment ?? '');
    this.editHistoryDialogOpen.set(true);
  }

  protected closeHistoryEditDialog(): void {
    this.dialogError.set('');
    this.editHistoryDialogOpen.set(false);
    this.editingHistoryEvent.set(null);
  }

  protected async submitHistoryEdit(lead: MockLead): Promise<void> {
    this.dialogError.set('');
    if (!this.canEditLead(lead)) {
      this.dialogError.set(this.i18n.t('error.historyEditForbidden'));
      return;
    }
    const event = this.editingHistoryEvent();
    if (!event) {
      this.dialogError.set(this.i18n.t('error.historyNotFound'));
      return;
    }
    const comment = this.editHistoryComment().trim();
    if (!comment) {
      this.dialogError.set(this.i18n.t('lead.messageRequired'));
      return;
    }

    try {
      await this.leadsService.updateHistoryEvent(lead.id, event.id, {
        eventType: this.editHistoryType(),
        comment,
      });
      this.closeHistoryEditDialog();
      await this.leadResource.reload();
    } catch (error) {
      this.dialogError.set(
        error instanceof Error ? error.message : this.i18n.t('lead.saveHistoryFailed'),
      );
    }
  }

  protected openCloseDialog(): void {
    this.dialogError.set('');
    this.closeDialogMode.set('close');
    this.closeReason.set(this.defaultCloseReason());
    this.closeComment.set('');
    this.closeDialogOpen.set(true);
  }

  protected openEditCloseDialog(lead: MockLead): void {
    if (!lead.close) return;
    this.dialogError.set('');
    this.closeDialogMode.set('edit');
    this.closeReason.set(lead.close.reason);
    this.closeComment.set(lead.close.comment);
    this.closeDialogOpen.set(true);
  }

  protected closeCloseDialog(): void {
    this.dialogError.set('');
    this.closeDialogMode.set('close');
    this.closeDialogOpen.set(false);
  }

  protected closeSuccessDialog(): void {
    this.dialogError.set('');
    this.successDialogOpen.set(false);
  }

  protected openSuccessDialog(): void {
    this.dialogError.set('');
    this.successDialogOpen.set(true);
  }

  protected async submitClose(lead: MockLead): Promise<void> {
    this.dialogError.set('');
    const payload = {
      reason: this.closeReason() as CloseReason,
      comment: this.closeComment(),
    };

    const validationError =
      this.closeDialogMode() === 'edit'
        ? await this.leadsService.updateCloseDetails(lead.id, payload)
        : await this.workflowService.closeLead(lead.id, payload);
    if (validationError) {
      this.dialogError.set(validationError);
      return;
    }

    this.closeCloseDialog();
    this.closeComment.set('');
    await this.leadResource.reload();
  }

  protected async submitSuccess(lead: MockLead): Promise<void> {
    const amount = this.parseMoney(this.contractAmount());
    const prepaymentRaw = this.contractPrepayment().trim();
    const prepayment = prepaymentRaw ? this.parseMoney(prepaymentRaw) : null;
    const validationError = await this.workflowService.markSuccessful(lead.id, {
      contractNumber: this.contractNumber(),
      amount,
      prepayment,
      comment: this.contractComment(),
    });
    if (validationError) {
      this.dialogError.set(validationError);
      return;
    }
    this.successDialogOpen.set(false);
    this.contractNumber.set('');
    this.contractAmount.set('');
    this.contractPrepayment.set('');
    this.contractComment.set('');
    await this.leadResource.reload();
  }

  private async runAction(action: () => Promise<string | null | void>): Promise<void> {
    this.clearErrors();
    this.actionPending.set(true);
    try {
      const error = await action();
      if (error) {
        this.actionError.set(this.i18n.localizeError(error));
        return;
      }
      await this.leadResource.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error.actionFailed';
      this.actionError.set(this.i18n.localizeError(message));
    } finally {
      this.actionPending.set(false);
    }
  }

  private clearErrors(): void {
    this.actionError.set('');
    this.dialogError.set('');
  }

  private normalizedVisitDate(): string {
    const date = this.visitDate().trim();
    return date ? `${date}T12:00:00` : '';
  }

  private changedLeadFields(
    lead: MockLead,
    payload: {
      readonly name: string;
      readonly phone: string;
      readonly email: string | null;
      readonly cityRegion: string;
      readonly productInterest: string;
      readonly estimatedBudget: number | null;
      readonly initialMessage: string;
      readonly assignedToId: string | null;
    },
  ): readonly string[] {
    const fields: string[] = [];
    if ((lead.name === this.i18n.t('lead.noName') ? '' : lead.name) !== payload.name) fields.push('name');
    if ((lead.phone === '—' ? '' : lead.phone) !== payload.phone) fields.push('phone');
    if ((lead.email ?? null) !== payload.email) fields.push('email');
    if (lead.cityRegion !== payload.cityRegion) fields.push('cityRegion');
    if (lead.productInterest !== payload.productInterest) fields.push('product');
    if ((lead.estimatedBudget ?? null) !== payload.estimatedBudget) fields.push('budget');
    if (lead.initialMessage !== payload.initialMessage) fields.push('initialMessage');
    if ((lead.assignedToId ?? null) !== payload.assignedToId) fields.push('manager');
    return fields;
  }

  private nullableText(value: string): string | null {
    const text = value.trim();
    return text || null;
  }

  private parseOptionalMoney(value: string): number | null {
    const normalized = value.trim();
    return normalized ? this.parseMoney(normalized) : null;
  }

  private parseMoney(value: string): number {
    return Number(value.replace(/\s/g, '').replace(',', '.'));
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
