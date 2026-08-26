import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type { AppliedReportCriteria, LeadReportResponse } from './reports.types';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(KolssApiClient);

  load(officeId: string | null, criteria: AppliedReportCriteria): Promise<LeadReportResponse> {
    return this.api.report<LeadReportResponse>({
      officeId,
      cohort: criteria.cohort,
      from: criteria.period.from,
      to: criteria.period.to,
      callStatus: criteria.callStatuses.length ? criteria.callStatuses.join(',') : null,
      clientStatus: criteria.clientStatuses.length ? criteria.clientStatuses.join(',') : null,
    });
  }
}
