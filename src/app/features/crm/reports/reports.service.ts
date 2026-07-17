import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '../../../core/api/generated/kolss-api.client';
import type { LeadReportResponse, ReportPeriod } from './reports.types';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(KolssApiClient);

  load(officeId: string | null, period: ReportPeriod): Promise<LeadReportResponse> {
    return this.api.report<LeadReportResponse>({
      officeId,
      from: period.from,
      to: period.to,
    });
  }
}
