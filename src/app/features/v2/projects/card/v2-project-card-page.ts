import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { toV2LeadCard } from '@domain/v2/lead-card.mapper';
import { v2CanDeleteProjectDocument } from '@domain/v2/project-files';
import { v2ProjectActions } from '@domain/v2/project-status';
import { v2ProjectTimeline } from '@domain/v2/project-timeline';
import type { V2ProjectDocument } from '@domain/v2/project.types';
import { UsersService } from '@services/users.service';
import { V2LeadCardService } from '@services/v2/v2-lead-card.service';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { V2_NOW } from '../../core/v2-clock';
import { V2Button } from '../../ui/v2-button';
import { V2_PRODUCT_LABEL } from '../../ui/v2-lead-labels';
import { V2ProjectCancelBanner } from './v2-project-cancel-banner';
import { V2ProjectCardActions } from './v2-project-card-actions';
import { V2ProjectHeader } from './v2-project-header';
import { V2ProjectSkeleton } from './v2-project-skeleton';
import { V2ProjectTabs } from './v2-project-tabs';
import { V2ProjectTimeline } from './v2-project-timeline';

// Project card v4 (`/v2/projects/:projectId`, owner decisions 2026-11-14): breadcrumb, closed /
// finished banner or read-only hint, header (contacts, description, estimate and paid totals,
// actions) with the 6-step tracker, the Documents / Statuses & tasks tabs and the one-line
// timeline. Actions follow `v2ProjectActions`; popups close with the updated project.
@Component({
  selector: 'app-v2-project-card-page',
  imports: [
    RouterLink,
    TranslatePipe,
    V2Button,
    V2ProjectCancelBanner,
    V2ProjectHeader,
    V2ProjectSkeleton,
    V2ProjectTabs,
    V2ProjectTimeline,
  ],
  providers: [V2ProjectCardActions],
  templateUrl: './v2-project-card-page.html',
  styleUrl: './v2-project-card-page.scss',
})
export class V2ProjectCardPage {
  private readonly projects = inject(V2ProjectsService);
  private readonly leads = inject(V2LeadCardService);
  private readonly usersService = inject(UsersService);
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(V2_NOW);
  private readonly auth = inject(AuthService);

  protected readonly act = inject(V2ProjectCardActions);

  /** Route parameter `:projectId`, bound through `withComponentInputBinding()`. */
  readonly projectId = input.required<string>();

  private readonly projectResource = resource({
    params: () => this.projectId(),
    loader: async ({ params }) => {
      try {
        return await this.projects.get(params);
      } catch (error) {
        // 404, or 403 for a project of an office the user cannot see: never show another record.
        if (error instanceof KolssApiError && (error.status === 404 || error.status === 403)) {
          return null;
        }
        throw error;
      }
    },
  });

  protected readonly project = computed(() =>
    this.projectResource.hasValue() ? this.projectResource.value() : null,
  );
  protected readonly loading = computed(
    () => this.projectResource.isLoading() && !this.projectResource.hasValue(),
  );
  protected readonly notFound = computed(
    () => this.projectResource.hasValue() && this.projectResource.value() === null,
  );
  protected readonly loadFailed = computed(() => this.projectResource.status() === 'error');

  // The lead gives the product tags of the breadcrumb and eyebrow.
  private readonly leadResource = resource({
    params: () => this.project()?.leadId,
    loader: ({ params }) => this.leads.load(params),
  });
  private readonly leadCard = computed(() => {
    const loaded = this.leadResource.hasValue() ? this.leadResource.value() : null;
    return loaded ? toV2LeadCard(loaded.lead, loaded.columns) : null;
  });

  private readonly timelineResource = resource({
    // The project's last activity changes with every mutation, so the timeline follows it.
    params: () => {
      const project = this.project();
      return project ? { id: project.id, activityAt: project.lastActivityAt } : undefined;
    },
    loader: ({ params }) => this.projects.timeline(params.id),
  });
  protected readonly timeline = computed(() => {
    const project = this.project();
    const entries = this.timelineResource.hasValue() ? this.timelineResource.value() : [];
    return project ? v2ProjectTimeline(entries, project.code) : [];
  });
  protected readonly timelineLoading = computed(
    () => this.timelineResource.isLoading() && !this.timelineResource.hasValue(),
  );
  protected readonly timelineFailed = computed(() => this.timelineResource.status() === 'error');
  /** Comments are read in the Statuses & tasks tab (newest first, as the timeline). */
  protected readonly comments = computed(() =>
    this.timeline().filter((item) => item.type === 'comment'),
  );

  // Manager names come from the employees list, as on the lead card.
  private readonly employeesResource = resource({
    loader: () => this.usersService.listManagers(),
  });
  private readonly employeeNames = computed(
    () =>
      new Map(
        (this.employeesResource.hasValue() ? this.employeesResource.value() : []).map(
          (employee) => [employee.id, employee.displayName],
        ),
      ),
  );
  /** Bound field so presentational cards can call it detached from `this`. */
  protected readonly personName = (id: string): string | null =>
    this.employeeNames().get(id) ?? null;

  /** Taken when the project arrives, so ages stay stable between reloads. */
  protected readonly now = computed(() => {
    this.projectResource.status();
    return this.clock();
  });

  protected readonly actions = computed(() => {
    const project = this.project();
    return project ? v2ProjectActions(project) : null;
  });
  /** Delete in the Documents tab: the uploader, the project manager and admins. */
  protected readonly canDeleteDocument = computed(() => {
    const project = this.project();
    const access = {
      canUploadDocument: this.actions()?.canUploadDocument ?? false,
      canEdit: project?.canEdit ?? false,
    };
    const userId = this.auth.profile()?.id ?? null;
    return (document: V2ProjectDocument) => v2CanDeleteProjectDocument(document, access, userId);
  });
  /** Read-only hint under the status bar; the same text is the tooltip of the locked buttons. */
  protected readonly lockHint = computed(() => {
    if (this.actions()?.lockReason !== 'viewer') return '';
    const name = this.project()?.manager?.name;
    return name
      ? this.i18n.t('v2.projectCard.readOnlyHint', { name })
      : this.i18n.t('v2.projectCard.readOnlyHintNoManager');
  });

  protected readonly products = computed(() => {
    const card = this.leadCard();
    if (!card) return '';
    const labels = card.products.map((product) => this.i18n.t(V2_PRODUCT_LABEL[product]));
    return labels.length ? labels.join(' + ') : (card.productText ?? '');
  });

  protected retry(): void {
    this.projectResource.reload();
  }

  /** P5 calls this after a popup changed the project; the lead timeline follows `lastActivityAt`. */
  protected reloadProject(): void {
    this.projectResource.reload();
  }

  /** Edit client info changed the shared client: the project and its lead show its contacts. */
  protected async editClient(): Promise<void> {
    if (await this.act.editClient()) {
      this.projectResource.reload();
      this.leadResource.reload();
    }
  }

  protected reloadTimeline(): void {
    this.timelineResource.reload();
  }

  constructor() {
    // Every mutation answers with the whole project; the timeline follows `lastActivityAt`.
    this.act.connect(this.project, (project) => this.projectResource.set(project));
  }
}
