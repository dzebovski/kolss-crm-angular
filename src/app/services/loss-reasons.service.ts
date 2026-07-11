import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';

export interface LossReasonRow {
  readonly code: string;
  readonly label_uk: string;
  readonly label_pl: string;
}

@Injectable({ providedIn: 'root' })
export class LossReasonsService {
  private readonly api = inject(KolssApiClient);

  async list(): Promise<readonly LossReasonRow[]> {
    return (await this.api.lossReasons<LossReasonRow>()).items;
  }
}
