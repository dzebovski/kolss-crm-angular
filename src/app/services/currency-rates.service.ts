import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type {
  CurrencyRateSet,
  UpdateCurrencyRatesRequest,
} from '@core/api/generated/kolss-api.types';

@Injectable({ providedIn: 'root' })
export class CurrencyRatesService {
  private readonly api = inject(KolssApiClient);

  load(): Promise<CurrencyRateSet> {
    return this.api.currencyRates();
  }

  update(version: number, rates: UpdateCurrencyRatesRequest): Promise<CurrencyRateSet> {
    return this.api.updateCurrencyRates(version, rates);
  }
}
