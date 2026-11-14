import type { ComponentType } from '@angular/cdk/portal';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { I18nService } from '@core/i18n/i18n.service';
import { formatV2Money } from '@domain/v2/project-money';
import { v2ProjectActions } from '@domain/v2/project-status';
import type { V2Project, V2ProjectPayment } from '@domain/v2/project.types';
import { V2ClientsService } from '@services/v2/v2-clients.service';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import {
  V2ClientEditDialog,
  type V2ClientEditData,
} from '../../clients/card/v2-client-edit-dialog';
import { V2DialogService } from '../../ui/dialog/v2-dialog.service';
import {
  V2ProjectCancelDialog,
  type V2ProjectCancelData,
} from '../dialogs/v2-project-cancel-dialog';
import {
  V2ProjectConfirmDialog,
  type V2ProjectConfirmData,
} from '../dialogs/v2-project-confirm-dialog';
import {
  V2ProjectEstimateDialog,
  type V2ProjectEstimateData,
} from '../dialogs/v2-project-estimate-dialog';
import {
  V2ProjectPaymentDialog,
  type V2ProjectPaymentData,
} from '../dialogs/v2-project-payment-dialog';
import {
  V2ProjectStatusDialog,
  type V2ProjectStatusData,
} from '../dialogs/v2-project-status-dialog';
import { V2ProjectCommentDialog, type V2ProjectCommentData } from './v2-project-comment-dialog';

// Actions of the Project card, provided by the page: every popup closes with the updated
// project, which goes back to the page through `connect`. Deletes and Project finished ask in a
// confirm popup first; Restore was confirmed inline in the banner. Failures show in the header
// (`headerError`), the tabs (`fileError`) or the banner (`restoreError`). Guards repeat
// `v2ProjectActions`; the API checks again.
@Injectable()
export class V2ProjectCardActions {
  private readonly dialogs = inject(V2DialogService);
  private readonly projects = inject(V2ProjectsService);
  private readonly clients = inject(V2ClientsService);
  private readonly i18n = inject(I18nService);

  private project: () => V2Project | null = () => null;
  private apply: (project: V2Project) => void = () => undefined;

  private actions() {
    const project = this.project();
    return project ? v2ProjectActions(project) : null;
  }

  /** The page passes its project signal and how to store an updated project. */
  connect(project: () => V2Project | null, apply: (project: V2Project) => void): void {
    this.project = project;
    this.apply = apply;
  }

  /** Edit client info is loading the client before its popup opens. */
  readonly clientLoading = signal(false);
  readonly finishing = signal(false);
  /** A failed Edit client info load, Project finished or payment delete. */
  readonly headerError = signal('');
  readonly restoring = signal(false);
  readonly restoreError = signal('');
  /** A failed document download. */
  readonly fileError = signal('');

  async addComment(): Promise<void> {
    const project = this.project();
    if (!project || !this.actions()?.canComment) return;
    const ref = this.dialogs.open<V2Project | null, V2ProjectCommentData>(V2ProjectCommentDialog, {
      projectId: project.id,
      subtitle: `${project.code} · ${project.clientName}`,
    });
    const updated = await firstValueFrom(ref.closed);
    if (updated) this.apply(updated);
  }

  changeStatus(): Promise<void> {
    return this.openProjectDialog<V2ProjectStatusData>(V2ProjectStatusDialog, (project) => ({
      project,
    }));
  }

  editEstimate(): Promise<void> {
    if (!this.actions()?.canEditEstimate) return Promise.resolve();
    return this.openProjectDialog<V2ProjectEstimateData>(V2ProjectEstimateDialog, (project) => ({
      project,
    }));
  }

  addPayment(): Promise<void> {
    if (!this.actions()?.canAddPayment) return Promise.resolve();
    return this.openProjectDialog<V2ProjectPaymentData>(V2ProjectPaymentDialog, (project) => ({
      project,
    }));
  }

  editPayment(payment: V2ProjectPayment): Promise<void> {
    return this.openProjectDialog<V2ProjectPaymentData>(V2ProjectPaymentDialog, (project) => ({
      project,
      payment,
    }));
  }

  /**
   * Edit client info: the project's client is the same record as its lead's, so this opens the
   * client page's Edit client popup. Resolves `true` when something was saved.
   */
  async editClient(): Promise<boolean> {
    const clientId = this.project()?.clientId;
    if (!clientId || this.clientLoading()) return false;
    this.clientLoading.set(true);
    this.headerError.set('');
    let client;
    try {
      client = await this.clients.get(clientId);
    } catch (error) {
      this.headerError.set(this.errorText(error));
      return false;
    } finally {
      this.clientLoading.set(false);
    }
    if (!client.canEdit) {
      this.headerError.set(this.i18n.t('v2.projectCard.clientReadOnly'));
      return false;
    }
    const ref = this.dialogs.open<boolean, V2ClientEditData>(V2ClientEditDialog, { client });
    return (await firstValueFrom(ref.closed)) === true;
  }

  cancelProject(): Promise<void> {
    if (!this.actions()?.canCancel) return Promise.resolve();
    return this.openProjectDialog<V2ProjectCancelData>(V2ProjectCancelDialog, (project) => ({
      project,
    }));
  }

  /** Project finished (Installation → Completed), after a confirm popup. */
  async finishProject(): Promise<void> {
    const project = this.project();
    if (!project || !this.actions()?.canFinish || this.finishing()) return;
    const confirmed = await this.confirm({
      title: this.i18n.t('v2.projectCard.finishConfirm.title'),
      text: this.i18n.t('v2.projectCard.finishConfirm.text'),
      confirmLabel: this.i18n.t('v2.projectCard.finish'),
      variant: 'primary',
    });
    if (!confirmed) return;
    this.finishing.set(true);
    this.headerError.set('');
    try {
      this.apply(await this.projects.finish(project.id));
    } catch (error) {
      this.headerError.set(this.errorText(error));
    } finally {
      this.finishing.set(false);
    }
  }

  async deletePayment(payment: V2ProjectPayment): Promise<void> {
    const amount = formatV2Money(payment.amount, this.i18n.locale());
    const confirmed = await this.confirm({
      title: this.i18n.t('v2.projectPopup.payment.deleteTitle', { amount }),
      text: this.i18n.t('v2.projectPopup.payment.deleteText'),
    });
    if (confirmed) await this.mutate((id) => this.projects.deletePayment(id, payment.id));
  }

  /** The banner asked "Restore to …?" inline; the API returns the project to the saved stage. */
  async restoreProject(): Promise<void> {
    const project = this.project();
    if (!project || !this.actions()?.canRestore || this.restoring()) return;
    this.restoring.set(true);
    this.restoreError.set('');
    try {
      this.apply(await this.projects.restore(project.id));
    } catch (error) {
      this.restoreError.set(this.errorText(error));
    } finally {
      this.restoring.set(false);
    }
  }

  async openFile(fileId: string): Promise<void> {
    this.fileError.set('');
    try {
      await this.projects.openFile(fileId);
    } catch (error) {
      this.fileError.set(this.errorText(error));
    }
  }

  /** Opens a popup on the current project; it closes with the updated project or null. */
  private async openProjectDialog<D>(
    component: ComponentType<unknown>,
    data: (project: V2Project) => D | null,
  ): Promise<void> {
    const project = this.project();
    const payload = project && data(project);
    if (!payload) return;
    const ref = this.dialogs.open<V2Project | null, D>(component, payload);
    const updated = await firstValueFrom(ref.closed);
    if (updated) this.apply(updated);
  }

  private async confirm(texts: {
    title: string;
    text: string;
    confirmLabel?: string;
    variant?: V2ProjectConfirmData['variant'];
  }): Promise<boolean> {
    const ref = this.dialogs.open<boolean, V2ProjectConfirmData>(V2ProjectConfirmDialog, {
      ...texts,
      confirmLabel: texts.confirmLabel ?? this.i18n.t('v2.projectPopup.delete'),
      cancelLabel: this.i18n.t('v2.projectPopup.cancel'),
    });
    return (await firstValueFrom(ref.closed)) === true;
  }

  /** A delete; a failure shows in the header. */
  private async mutate(run: (projectId: string) => Promise<V2Project>): Promise<void> {
    const project = this.project();
    if (!project) return;
    this.headerError.set('');
    try {
      this.apply(await run(project.id));
    } catch (error) {
      this.headerError.set(this.errorText(error));
    }
  }

  private errorText(error: unknown): string {
    return this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed');
  }
}
