export type OfficeId = 'kyiv' | 'warsaw';
export type OfficeFilter = 'all' | OfficeId;

export interface CrmOffice {
  readonly id: OfficeId;
  readonly code: OfficeId;
  readonly nameUk: string;
  readonly namePl: string;
}
