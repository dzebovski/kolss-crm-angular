import { normalizePhoneForOffice } from './phone.ts';

export type ColumnMap = Partial<Record<keyof typeof DEFAULT_META_COLUMNS, string>>;

const DEFAULT_META_COLUMNS = {
  id: 'id',
  created_time: 'created_time',
  phone_number: 'phone_number',
  full_name: 'full_name',
  email: 'email',
  product_interest: 'що_ви_хочете_замовити?',
  project_stage_source: 'на_якому_етапі_ваш_проєкт?',
  ad_id: 'ad_id',
  ad_name: 'ad_name',
  campaign_id: 'campaign_id',
  campaign_name: 'campaign_name',
  form_id: 'form_id',
  form_name: 'form_name',
  platform: 'platform',
  is_organic: 'is_organic',
} as const;

export type MetaColumns = Record<keyof typeof DEFAULT_META_COLUMNS, string>;

export function resolveMetaColumns(columnMap: Record<string, unknown> | null | undefined): MetaColumns {
  const overrides = columnMap ?? {};
  const resolved = { ...DEFAULT_META_COLUMNS };
  for (const key of Object.keys(DEFAULT_META_COLUMNS) as (keyof typeof DEFAULT_META_COLUMNS)[]) {
    const value = overrides[key];
    if (typeof value === 'string' && value.trim()) {
      resolved[key] = value.trim();
    }
  }
  return resolved;
}

export type MappedLeadRow = {
  source_system: string;
  external_lead_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  product_interest: string | null;
  project_stage_source: string | null;
  source_created_at: string | null;
  ad_id: string | null;
  ad_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  form_id: string | null;
  form_name: string | null;
  platform: string | null;
  is_organic: string | null;
  raw_payload: Record<string, unknown>;
  isTestLead: boolean;
};

function parseCreatedTime(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isTestLead(email: string | null, raw: Record<string, unknown>): boolean {
  if (Deno.env.get('IMPORT_INCLUDE_TEST_LEADS') === 'true') return false;
  if (email?.toLowerCase() === 'test@meta.com') return true;
  const serialized = JSON.stringify(raw).toLowerCase();
  return serialized.includes('<test lead:');
}

function normalizeRecord(record: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!key.trim()) continue;
    if (value === null || value === undefined) {
      normalized[key.trim()] = '';
    } else {
      normalized[key.trim()] = String(value).trim();
    }
  }
  return normalized;
}

function get(record: Record<string, string>, key: string): string | undefined {
  const v = record[key];
  return v?.trim() ? v.trim() : undefined;
}

function mapRecordToLead(
  record: Record<string, string>,
  options: {
    rowNumber: number;
    spreadsheetId: string;
    sheetName: string;
    officeCode: string;
    columns: MetaColumns;
  },
): MappedLeadRow {
  const raw_payload = { ...record } as Record<string, unknown>;
  const columns = options.columns;

  let externalId = get(record, columns.id);
  const source_system = 'meta_lead_ads';

  if (!externalId) {
    externalId = `google_sheet:${options.spreadsheetId}:${options.sheetName}:${options.rowNumber}`;
  } else if (!externalId.startsWith('l:')) {
    externalId = `l:${externalId}`;
  }

  const email = get(record, columns.email) ?? null;

  const mapped: MappedLeadRow = {
    source_system,
    external_lead_id: externalId,
    name: get(record, columns.full_name) ?? null,
    phone: normalizePhoneForOffice(get(record, columns.phone_number), options.officeCode),
    email,
    product_interest: get(record, columns.product_interest) ?? null,
    project_stage_source: get(record, columns.project_stage_source) ?? null,
    source_created_at: parseCreatedTime(get(record, columns.created_time)),
    ad_id: get(record, columns.ad_id) ?? null,
    ad_name: get(record, columns.ad_name) ?? null,
    campaign_id: get(record, columns.campaign_id) ?? null,
    campaign_name: get(record, columns.campaign_name) ?? null,
    form_id: get(record, columns.form_id) ?? null,
    form_name: get(record, columns.form_name) ?? null,
    platform: get(record, columns.platform) ?? null,
    is_organic: get(record, columns.is_organic) ?? null,
    raw_payload,
    isTestLead: false,
  };

  mapped.isTestLead = isTestLead(email, raw_payload);
  return mapped;
}

export function mapLeadRecord(
  record: Record<string, unknown>,
  options: {
    rowNumber?: number;
    spreadsheetId: string;
    sheetName: string;
    officeCode: string;
    columnMap?: Record<string, unknown> | null;
  },
): MappedLeadRow {
  return mapRecordToLead(normalizeRecord(record), {
    rowNumber: options.rowNumber ?? 0,
    spreadsheetId: options.spreadsheetId,
    sheetName: options.sheetName,
    officeCode: options.officeCode,
    columns: resolveMetaColumns(options.columnMap),
  });
}
