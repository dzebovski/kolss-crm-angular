import type { ComponentType } from '@angular/cdk/portal';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { I18nService } from '@core/i18n/i18n.service';
import { formatV2Money } from '@domain/v2/project-money';
import { v2ProjectActions } from '@domain/v2/project-status';
import { v2ProjectFileError } from '@domain/v2/project-files';
import type { V2ProjectMeeting } from '@domain/v2/project-meetings';
import type { V2Task } from '@domain/v2/task.types';
import type { CrmEmployee } from '@services/users.service';
import { V2TasksService } from '@services/v2/v2-tasks.service';
import type { V2Project, V2ProjectDocument, V2ProjectPayment } from '@domain/v2/project.types';
import { V2ClientsService } from '@services/v2/v2-clients.service';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import {
  V2ClientEditDialog,
  type V2ClientEditData,
} from '../../clients/card/v2-client-edit-dialog';
import { V2NewTaskDialog, type V2NewTaskData } from '../../tasks/v2-new-task-dialog';
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
  V2ProjectMeetingDialog,
  type V2ProjectMeetingData,
} from '../dialogs/v2-project-meeting-dialog';
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
  private readonly tasks = inject(V2TasksService);
  private readonly i18n = inject(I18nService);

  private project: () => V2Project | null = () => null;
  private apply: (project: V2Project) => void = () => undefined;

  private actions() {
    const project = this.project();
    return project ? v2ProjectActions(project) : null;
  }

  private employees: () => readonly CrmEmployee[] = () => [];
  private activitiesChanged: () => void = () => undefined;

  /**
   * Statuses & tasks tab (P12): the people a task or meeting can go to, and what to reload after
   * a task or meeting changed (its list, and the project for the timeline).
   */
  connectActivities(employees: () => readonly CrmEmployee[], changed: () => void): void {
    this.employees = employees;
    this.activitiesChanged = changed;
  }

  /** The task or meeting being changed now. */
  readonly activityBusy = signal<string | null>(null);
  /** A failed task or meeting change. */
  readonly activityError = signal('');

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
  /** A failed document upload, delete or download. */
  readonly fileError = signal('');
  /** The document being uploaded now and its progress (0–100). */
  readonly uploading = signal<{ readonly name: string; readonly percent: number } | null>(null);

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

  /**
   * Uploads the chosen files one by one (presigned PUT, then confirm). A wrong type or size skips
   * that file; the first failure is shown in the tabs and the rest still upload.
   */
  async uploadDocuments(files: readonly File[]): Promise<void> {
    if (!this.actions()?.canUploadDocument || this.uploading() || !files.length) return;
    this.fileError.set('');
    const failures: string[] = [];
    for (const file of files) {
      const project = this.project();
      if (!project) break;
      const invalid = v2ProjectFileError(file);
      if (invalid) {
        const key = invalid === 'type' ? 'v2.projectPopup.fileType' : 'v2.projectPopup.fileSize';
        failures.push(`${file.name}: ${this.i18n.t(key)}`);
        continue;
      }
      this.uploading.set({ name: file.name, percent: 0 });
      try {
        const fileId = await this.projects.uploadFile(project.id, 'document', file, (percent) =>
          this.uploading.set({ name: file.name, percent }),
        );
        this.apply(await this.projects.addDocument(project.id, fileId));
      } catch (error) {
        failures.push(`${file.name}: ${this.errorText(error)}`);
      }
    }
    this.uploading.set(null);
    if (failures.length) this.fileError.set(failures.join(' · '));
  }

  async deleteDocument(document: V2ProjectDocument): Promise<void> {
    const project = this.project();
    if (!project) return;
    const confirmed = await this.confirm({
      title: this.i18n.t('v2.projectCard.documents.deleteTitle', { name: document.fileName }),
      text: this.i18n.t('v2.projectCard.documents.deleteText'),
    });
    if (!confirmed) return;
    this.fileError.set('');
    try {
      this.apply(await this.projects.deleteDocument(project.id, document.id));
    } catch (error) {
      this.fileError.set(this.errorText(error));
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

  /** New task linked to the project (the Tasks page popup with the link fixed). */
  async addTask(): Promise<void> {
    const project = this.project();
    if (!project || !this.actions()?.canComment) return;
    const ref = this.dialogs.open<string, V2NewTaskData>(V2NewTaskDialog, {
      employees: this.employees(),
      lists: [],
      listId: null,
      project: {
        id: project.id,
        officeId: project.officeId,
        label: `${project.code} · ${project.clientName}`,
      },
    });
    if (await firstValueFrom(ref.closed)) this.activitiesChanged();
  }

  /** Done ⇄ to do of a manual task the user may manage. */
  async toggleTask(task: V2Task): Promise<void> {
    if (!task.canManage || this.activityBusy()) return;
    await this.runActivity(task.id, () =>
      this.tasks.setStatus(task, task.status === 'done' ? 'todo' : 'done'),
    );
  }

  async addMeeting(): Promise<void> {
    await this.openMeetingDialog();
  }

  async rescheduleMeeting(meeting: V2ProjectMeeting): Promise<void> {
    await this.openMeetingDialog(meeting);
  }

  /** Held / No-show right away; Cancel after a confirm popup. */
  async meetingOutcome(
    meeting: V2ProjectMeeting,
    status: 'visited' | 'no_show' | 'canceled',
  ): Promise<void> {
    if (this.activityBusy()) return;
    if (status === 'canceled') {
      const confirmed = await this.confirm({
        title: this.i18n.t('v2.projectMeetings.cancelTitle'),
        text: this.i18n.t('v2.projectMeetings.cancelText'),
        confirmLabel: this.i18n.t('v2.projectMeetings.cancel'),
      });
      if (!confirmed) return;
    }
    await this.runActivity(meeting.id, () => this.projects.updateMeeting(meeting, { status }));
  }

  private async openMeetingDialog(meeting?: V2ProjectMeeting): Promise<void> {
    const project = this.project();
    if (!project || !this.actions()?.canComment) return;
    const ref = this.dialogs.open<boolean, V2ProjectMeetingData>(V2ProjectMeetingDialog, {
      project,
      employees: this.employees(),
      meeting,
    });
    if ((await firstValueFrom(ref.closed)) === true) this.activitiesChanged();
  }

  private async runActivity(id: string, run: () => Promise<unknown>): Promise<void> {
    this.activityBusy.set(id);
    this.activityError.set('');
    try {
      await run();
      this.activitiesChanged();
    } catch (error) {
      this.activityError.set(this.errorText(error));
    } finally {
      this.activityBusy.set(null);
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
