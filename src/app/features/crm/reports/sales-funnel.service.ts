import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type {
  SalesFunnelReportQuery,
  SalesFunnelReportResponse,
} from '@core/api/generated/kolss-api.types';

@Injectable({ providedIn: 'root' })
export class SalesFunnelService {
  private readonly api = inject(KolssApiClient);

  load(query: SalesFunnelReportQuery): Promise<SalesFunnelReportResponse> {
    return this.api.salesFunnelReport(query);
  }
}
