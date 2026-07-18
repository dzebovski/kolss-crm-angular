import type { CallStatus, ClientStatus, ContractCurrency } from '../../../services/crm-mock.types';

export type ReportPeriodMode = 'all' | 'month' | 'custom';

export interface ReportPeriod {
  readonly from: string | null;
  readonly to: string | null;
}

export interface ReportTotals {
  readonly total: number;
  readonly active: number;
  readonly contractSigned: number;
  readonly contractTotals: readonly ReportContractTotal[];
  readonly closedLost: number;
  readonly callback: number;
  readonly inactive7d: number;
  readonly conversionPercent: number;
  readonly byClientStatus: Readonly<Record<ClientStatus, number>>;
}

export interface ReportContractTotal {
  readonly currency: ContractCurrency;
  readonly total: number;
}

export interface ReportComment {
  readonly body: string;
  readonly occurredAt: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly eventType: string;
}

export interface ReportLead {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly createdAt: string;
  readonly clientStatus: ClientStatus;
  readonly clientStatusChangedAt: string;
  readonly callStatus: CallStatus | null;
  readonly callStatusChangedAt: string | null;
  readonly lossReason: string | null;
  readonly lastHumanActivityAt: string | null;
  readonly inactiveDays: number;
  readonly inactive7d: boolean;
  readonly comments: readonly ReportComment[];
}

export interface ManagerLeadReport {
  readonly officeCode: string;
  readonly managerId: string | null;
  readonly managerName: string;
  readonly totals: ReportTotals;
  readonly leads: readonly ReportLead[];
}

export interface LossReasonReport {
  readonly code: string;
  readonly labelUk: string;
  readonly labelPl: string;
  readonly labelEn: string;
  readonly count: number;
  readonly percent: number;
}

export interface LeadReportResponse {
  readonly generatedAt: string;
  readonly period: ReportPeriod;
  readonly totals: ReportTotals;
  readonly lossReasons: readonly LossReasonReport[];
  readonly managers: readonly ManagerLeadReport[];
}

export interface ReportStatusGroup {
  readonly status: ClientStatus;
  readonly leads: readonly ReportLead[];
}
