import type { ComponentType } from '@angular/cdk/portal';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { I18nService } from '@core/i18n/i18n.service';
import { formatV2Money } from '@domain/v2/project-money';
import { v2ProjectActions } from '@domain/v2/project-status';
import type { V2Project, V2ProjectContractKind, V2ProjectPayment } from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
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
  V2ProjectContractDialog,
  type V2ProjectContractData,
} from '../dialogs/v2-project-contract-dialog';
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

// Actions of the Project card (P5), provided by the page: every popup closes with the updated
// project, which goes back to the page through `connect`. Deletes ask in a confirm popup first;
// Restore was confirmed inline in the banner. Failures show in the contract block (`blockError`)
// or in the banner (`restoreError`). Guards repeat `v2ProjectActions`; the API checks again.
@Injectable()
export class V2ProjectCardActions {
  private readonly dialogs = inject(V2DialogService);
  private readonly projects = inject(V2ProjectsService);
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

  readonly restoring = signal(false);
  readonly restoreError = signal('');
  /** A failed file download or delete, shown in the contract block it came from. */
  readonly blockError = signal<{
    readonly kind: V2ProjectContractKind;
    readonly message: string;
  } | null>(null);

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

  addContract(kind: V2ProjectContractKind): Promise<void> {
    return this.openProjectDialog<V2ProjectContractData>(V2ProjectContractDialog, (project) => ({
      project,
      kind,
    }));
  }

  editContract(kind: V2ProjectContractKind): Promise<void> {
    return this.openProjectDialog<V2ProjectContractData>(V2ProjectContractDialog, (project) =>
      project.contracts[kind] ? { project, kind, contract: project.contracts[kind] } : null,
    );
  }

  editEstimate(): Promise<void> {
    if (!this.actions()?.canEditEstimate) return Promise.resolve();
    return this.openProjectDialog<V2ProjectEstimateData>(V2ProjectEstimateDialog, (project) => ({
      project,
    }));
  }

  addPayment(kind: V2ProjectContractKind): Promise<void> {
    if (!this.actions()?.canAddPayment) return Promise.resolve();
    return this.openProjectDialog<V2ProjectPaymentData>(V2ProjectPaymentDialog, (project) => ({
      project,
      kind,
    }));
  }

  editPayment(payment: V2ProjectPayment): Promise<void> {
    return this.openProjectDialog<V2ProjectPaymentData>(V2ProjectPaymentDialog, (project) => ({
      project,
      payment,
    }));
  }

  cancelProject(): Promise<void> {
    if (!this.actions()?.canCancel) return Promise.resolve();
    return this.openProjectDialog<V2ProjectCancelData>(V2ProjectCancelDialog, (project) => ({
      project,
    }));
  }

  async deleteContract(kind: V2ProjectContractKind): Promise<void> {
    const contract = this.project()?.contracts[kind];
    if (!contract) return;
    const confirmed = await this.confirm({
      title: this.i18n.t('v2.projectPopup.contract.deleteTitle', { number: contract.number }),
      text: this.i18n.t('v2.projectPopup.contract.deleteText'),
    });
    if (confirmed) await this.mutate(kind, (id) => this.projects.deleteContract(id, contract.id));
  }

  async deletePayment(payment: V2ProjectPayment): Promise<void> {
    const amount = formatV2Money(payment.amount, this.i18n.locale());
    const confirmed = await this.confirm({
      title: this.i18n.t('v2.projectPopup.payment.deleteTitle', { amount }),
      text: this.i18n.t('v2.projectPopup.payment.deleteText'),
    });
    if (confirmed) {
      await this.mutate(payment.contractKind, (id) => this.projects.deletePayment(id, payment.id));
    }
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

  async openFile(fileId: string, kind: V2ProjectContractKind): Promise<void> {
    this.blockError.set(null);
    try {
      await this.projects.openFile(fileId);
    } catch (error) {
      this.blockError.set({ kind, message: this.errorText(error) });
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

  private async confirm(texts: { title: string; text: string }): Promise<boolean> {
    const ref = this.dialogs.open<boolean, V2ProjectConfirmData>(V2ProjectConfirmDialog, {
      ...texts,
      confirmLabel: this.i18n.t('v2.projectPopup.delete'),
      cancelLabel: this.i18n.t('v2.projectPopup.cancel'),
    });
    return (await firstValueFrom(ref.closed)) === true;
  }

  /** A delete from a contract block; a failure shows in that block. */
  private async mutate(
    kind: V2ProjectContractKind,
    run: (projectId: string) => Promise<V2Project>,
  ): Promise<void> {
    const project = this.project();
    if (!project) return;
    this.blockError.set(null);
    try {
      this.apply(await run(project.id));
    } catch (error) {
      this.blockError.set({ kind, message: this.errorText(error) });
    }
  }

  private errorText(error: unknown): string {
    return this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed');
  }
}
