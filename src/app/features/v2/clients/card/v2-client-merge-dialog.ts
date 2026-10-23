import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, resource, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { v2MergeDifferingFields, v2MergeSides, type V2MergeField } from '@domain/v2/client-form';
import type { V2Client } from '@domain/v2/client.types';
import { formatV2ReportDate } from '@domain/v2/date-format';
import { v2PluralCategory } from '@domain/v2/plural';
import { V2ClientsService } from '@services/v2/v2-clients.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';

export interface V2ClientMergeData {
  /** The card the merge was started from. */
  readonly client: V2Client;
  readonly duplicateId: string;
}

export interface V2ClientMergeResult {
  /** The older client, which stays. */
  readonly survivor: V2Client;
  /** The code that now opens the survivor. */
  readonly mergedCode: string;
}

type Side = 'older' | 'newer';

const FIELD_LABEL = {
  email: 'v2.card.email',
  address: 'v2.client.address',
  about: 'v2.client.merge.about',
} as const;

// Merge clients popup (Client-merge.dc.html and Client-merge-errors): two records of one person.
// The older client survives (the API decides, whichever id is in the path); per differing field
// (email, address, note) the person picks which value stays. Needs the confirmation checkbox.
// Irreversible, so the request carries one Idempotency-Key for all retries of this popup.
@Component({
  selector: 'app-v2-client-merge-dialog',
  imports: [TranslatePipe, V2DialogShell],
  templateUrl: './v2-client-merge-dialog.html',
  styleUrl: './v2-client-merge-dialog.scss',
})
export class V2ClientMergeDialog {
  private readonly dialogRef = inject<DialogRef<V2ClientMergeResult>>(DialogRef);
  private readonly service = inject(V2ClientsService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject<V2ClientMergeData>(DIALOG_DATA);
  private readonly idempotencyKey = crypto.randomUUID();

  private readonly duplicate = resource({
    params: () => this.data.duplicateId,
    loader: ({ params }) => this.service.get(params),
  });

  protected readonly loading = computed(() => this.duplicate.isLoading());
  protected readonly loadFailed = computed(() => this.duplicate.status() === 'error');
  protected readonly sides = computed(() =>
    this.duplicate.hasValue() ? v2MergeSides(this.data.client, this.duplicate.value()) : null,
  );
  protected readonly differing = computed<readonly V2MergeField[]>(() => {
    const sides = this.sides();
    return sides ? v2MergeDifferingFields(sides.older, sides.newer) : [];
  });
  protected readonly keep = signal<Readonly<Record<V2MergeField, Side>>>({
    email: 'older',
    address: 'older',
    about: 'older',
  });
  protected readonly confirmed = signal(false);
  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');

  protected readonly fieldLabel = FIELD_LABEL;
  protected readonly confirmError = computed(() =>
    this.attempted() && !this.confirmed() ? this.i18n.t('v2.client.merge.confirmRequired') : '',
  );
  protected readonly invalid = computed(() => !this.confirmed() || !this.sides());
  protected readonly missingCount = computed(() => (this.confirmed() ? 0 : 1));

  protected readonly since = (client: V2Client): string => formatV2ReportDate(client.createdAt);
  protected readonly counts = (client: V2Client): string => this.countsOf(client);
  protected readonly sameIdentity = computed(() => {
    const sides = this.sides();
    return (
      !!sides && sides.older.name === sides.newer.name && sides.older.phone === sides.newer.phone
    );
  });

  protected readonly footerHint = computed(() => {
    const sides = this.sides();
    return sides
      ? this.i18n.t('v2.client.merge.footer', {
          newer: sides.newer.code,
          older: sides.older.code,
          counts: this.countsOf(sides.newer),
        })
      : '';
  });
  protected readonly happens = computed(() => {
    const sides = this.sides();
    return sides
      ? this.i18n.t('v2.client.merge.happens', {
          counts: this.countsOf(sides.newer),
          newer: sides.newer.code,
          older: sides.older.code,
        })
      : '';
  });

  protected pick(field: V2MergeField, side: Side): void {
    this.keep.update((value) => ({ ...value, [field]: side }));
  }

  protected value(client: V2Client, field: V2MergeField): string {
    return client[field]?.trim() || this.i18n.t('v2.card.notSet');
  }

  protected async save(): Promise<void> {
    const sides = this.sides();
    if (!sides || this.saving() || !this.confirmed()) return;
    this.saving.set(true);
    this.saveError.set('');
    try {
      const choices = this.keep();
      const survivor = await this.service.merge(
        this.data.client.id,
        {
          duplicateId: this.data.duplicateId,
          keep: Object.fromEntries(this.differing().map((field) => [field, choices[field]])),
        },
        this.idempotencyKey,
      );
      this.dialogRef.close({ survivor, mergedCode: sides.newer.code });
    } catch (error) {
      this.saveError.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private countsOf(client: V2Client): string {
    const locale = this.i18n.locale();
    const leads = client.leads.length;
    const projects = client.projects.length;
    return `${leads} ${this.i18n.t(`v2.clients.leads.${v2PluralCategory(locale, leads)}`)}, ${projects} ${this.i18n.t(`v2.clients.projects.${v2PluralCategory(locale, projects)}`)}`;
  }
}
