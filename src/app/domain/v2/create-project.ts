import type { UpdateLeadInfoRequest } from '@core/api/generated/kolss-api.types';
import type { OfficeId } from '@domain/office.types';
import type { ContractCurrency, Lead } from '@domain/lead.types';
import { v2StoredPhone } from './phone-storage';
import type { V2LeadCard, V2LeadColumns, V2LeadProduct } from './lead-card.types';
import type { V2LeadChannel } from './lead-view.types';

export type V2CreateProjectChecklistField =
  | 'checklistBudget'
  | 'checklistLocation'
  | 'checklistPeriod'
  | 'checklistMaterials'
  | 'checklistProduct'
  | 'clientInformed';

/** The Create project popup's form: the Edit contact and Fill lead info fields in one model. */
export interface V2CreateProjectForm {
  name: string;
  phone: string;
  email: string;
  channel: V2LeadChannel;
  referredBy: string;
  budget: string;
  currency: ContractCurrency;
  location: string;
  aboutClient: string;
  checklistBudget: boolean;
  checklistLocation: boolean;
  checklistPeriod: boolean;
  checklistMaterials: boolean;
  checklistProduct: boolean;
  clientInformed: boolean;
  responsibleManagerId: string;
}

/** Contact fields `PATCH /v1/leads/{id}` audits (`editedFields`). */
export type V2CreateProjectContactField = 'name' | 'phone' | 'email' | 'channel';

export interface V2CreateProjectContact {
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly channel: V2LeadChannel;
}

export function v2SameProducts(a: readonly V2LeadProduct[], b: readonly V2LeadProduct[]): boolean {
  return a.length === b.length && a.every((product) => b.includes(product));
}

/** The v1 numeric budget as the free-text field shows it. */
export function v2BudgetFromLead(lead: Lead): string {
  return lead.estimatedBudget == null ? '' : String(lead.estimatedBudget);
}

/** Only a referral keeps its `referredBy`; any other channel clears it. */
export function v2PersistedReferrer(form: V2CreateProjectForm): string {
  return form.channel === 'referral' ? form.referredBy.trim() : '';
}

/** Which of the four contact fields differ (already normalized values). */
export function v2ChangedContactFields(
  before: V2CreateProjectContact,
  after: V2CreateProjectContact,
): V2CreateProjectContactField[] {
  const fields: V2CreateProjectContactField[] = [];
  if (before.name !== after.name) fields.push('name');
  if (before.phone !== after.phone) fields.push('phone');
  if (before.email !== after.email) fields.push('email');
  if (before.channel !== after.channel) fields.push('channel');
  return fields;
}

const CHECKLIST_FIELDS: readonly V2CreateProjectChecklistField[] = [
  'checklistBudget',
  'checklistLocation',
  'checklistPeriod',
  'checklistMaterials',
  'checklistProduct',
  'clientInformed',
];

/**
 * The lead-info fields that changed, for `PATCH /v1/leads/{id}/info`. The responsible manager is
 * not part of it: the project request carries it. The lead's project type is left alone (pipeline
 * 3: every project starts in Estimate; the popup asks for the estimate lines instead).
 */
export function v2CreateProjectInfoChanges(
  value: V2CreateProjectForm,
  initial: V2CreateProjectForm,
  products: readonly V2LeadProduct[],
  initialProducts: readonly V2LeadProduct[],
): UpdateLeadInfoRequest {
  const referrer = v2PersistedReferrer(value);
  const checklist: Partial<Record<V2CreateProjectChecklistField, boolean>> = {};
  for (const field of CHECKLIST_FIELDS) {
    if (value[field] !== initial[field]) checklist[field] = value[field];
  }
  return {
    ...(referrer !== v2PersistedReferrer(initial) ? { referredBy: referrer } : {}),
    ...(value.budget.trim() !== initial.budget.trim()
      ? { estimatedBudgetText: value.budget.trim() }
      : {}),
    ...(value.currency !== initial.currency ? { estimatedBudgetCurrency: value.currency } : {}),
    ...(value.location.trim() !== initial.location.trim()
      ? { cityRegion: value.location.trim() }
      : {}),
    ...(v2SameProducts(products, initialProducts) ? {} : { products: [...products] }),
    ...(value.aboutClient.trim() !== initial.aboutClient.trim()
      ? { aboutClient: value.aboutClient.trim() }
      : {}),
    ...checklist,
  };
}

/**
 * What the lead holds now, as the popup's form. The manager defaults to the responsible manager,
 * then the lead's owner (the order the API uses), but only when that person may be picked.
 */
export function v2CreateProjectInitial(
  lead: Lead,
  card: V2LeadCard,
  columns: V2LeadColumns,
  pickableManagerIds: readonly string[],
): V2CreateProjectForm {
  const manager = columns.responsibleManagerId ?? lead.assignedToId ?? '';
  return {
    name: card.name,
    phone: card.phone,
    email: card.email ?? '',
    channel: card.channel,
    referredBy: columns.referredBy ?? '',
    budget: columns.estimatedBudgetText ?? v2BudgetFromLead(lead),
    currency: lead.estimatedBudgetCurrency,
    location: lead.cityRegion,
    aboutClient: columns.aboutClient ?? '',
    checklistBudget: columns.checklistBudget ?? false,
    checklistLocation: columns.checklistLocation ?? false,
    checklistPeriod: columns.checklistPeriod ?? false,
    checklistMaterials: columns.checklistMaterials ?? false,
    checklistProduct: columns.checklistProduct ?? false,
    clientInformed: columns.clientInformed ?? false,
    responsibleManagerId: pickableManagerIds.includes(manager) ? manager : '',
  };
}

/** The contact part of the form as `PATCH /v1/leads/{id}` takes it (phone normalized). */
export function v2CreateProjectContact(
  form: V2CreateProjectForm,
  officeCode: OfficeId,
  managerId: string | null,
): V2CreateProjectContact & { readonly managerId: string | null } {
  return {
    name: form.name.trim(),
    phone: v2StoredPhone(form.phone, officeCode) ?? form.phone.trim(),
    email: form.email.trim() || null,
    managerId,
    channel: form.channel,
  };
}
