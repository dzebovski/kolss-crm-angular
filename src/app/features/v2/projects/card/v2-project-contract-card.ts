import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate } from '@domain/v2/date-format';
import { v2ContractBar, v2ContractPayments, v2ProjectDay } from '@domain/v2/project-card';
import { formatV2Money } from '@domain/v2/project-money';
import type {
  V2ProjectContract,
  V2ProjectContractKind,
  V2ProjectPayment,
} from '@domain/v2/project.types';
import { V2Button } from '../../ui/v2-button';

const KEYS = {
  intro: {
    title: 'v2.projectCard.intro.title',
    none: 'v2.projectCard.intro.none',
    noneHint: 'v2.projectCard.intro.noneHint',
    add: 'v2.projectCard.intro.add',
  },
  main: {
    title: 'v2.projectCard.main.title',
    none: 'v2.projectCard.main.none',
    noneHint: 'v2.projectCard.main.noneHint',
    add: 'v2.projectCard.main.add',
  },
} as const;

// One contract block of the Project card (pipeline 3): the intro contract (first payment, usually
// 500–1000 zł or 10%) or the main contract (due = total − the paid intro, credited automatically;
// 50% must be paid before Production). Empty state with Add contract, or the contract fields, the
// paid bar (credited intro + own payments, 50% mark on the main contract) and its payments.
// Presentational: the page opens the P5 popups and downloads files.
// Edit / delete on the contract and on each payment row follow `canEdit`; a contract with
// payments cannot be deleted (delete its payments first).
@Component({
  selector: 'app-v2-project-contract-card',
  imports: [TranslatePipe, V2Button],
  templateUrl: './v2-project-contract-card.html',
  styleUrl: './v2-project-contract-card.scss',
})
export class V2ProjectContractCard {
  private readonly i18n = inject(I18nService);

  readonly kind = input.required<V2ProjectContractKind>();
  readonly contract = input<V2ProjectContract | null>(null);
  /** Payments of both contracts; the block shows its own. */
  readonly payments = input<readonly V2ProjectPayment[]>([]);
  readonly now = input.required<Date>();
  readonly canAddContract = input(false);
  readonly canAddPayment = input(false);
  /** The read-only hint, also the tooltip of the locked buttons; empty while the user can act. */
  readonly lockHint = input('');
  /** Contract and payment edit / delete (manager and admins, same rule as Change status). */
  readonly canEdit = input(false);
  /** A failed download or delete, shown in this block. */
  readonly error = input('');
  readonly addContract = output<void>();
  readonly addPayment = output<void>();
  readonly editContract = output<void>();
  readonly deleteContract = output<void>();
  readonly editPayment = output<V2ProjectPayment>();
  readonly deletePayment = output<V2ProjectPayment>();
  /** A contract file or receipt was clicked; the page downloads it. */
  readonly openFile = output<string>();

  protected readonly keys = computed(() => KEYS[this.kind()]);

  protected readonly summary = computed(() => {
    const contract = this.contract();
    if (!contract) return null;
    const locale = this.i18n.locale();
    const covered = { ...contract.paid, amount: contract.paid.amount + contract.credited.amount };
    return {
      contract,
      signed: this.day(contract.signedOn),
      total: formatV2Money(contract.total, locale),
      covered: formatV2Money(covered, locale),
      credited: contract.credited.amount > 0 ? formatV2Money(contract.credited, locale) : null,
      remaining: formatV2Money(contract.remaining, locale),
      target50: contract.target50 ? formatV2Money(contract.target50, locale) : null,
      percent: contract.percentPaid,
      bar: v2ContractBar(contract),
    };
  });

  protected readonly rows = computed(() => {
    const locale = this.i18n.locale();
    return v2ContractPayments(this.payments(), this.kind()).map((payment, index) => ({
      payment,
      number: index + 1,
      amount: formatV2Money(payment.amount, locale),
      date: this.day(payment.paidOn),
    }));
  });

  private day(value: string): string {
    return formatV2CardDate(v2ProjectDay(value), this.now(), this.i18n.locale());
  }
}
