import type { MeResponse } from '@core/api/generated/kolss-api.types';
import type { Lead, LeadEvent } from '@domain/lead.types';

/**
 * Everything a lead-permission decision needs, gathered from `AuthService`/
 * `SessionService` at the call site. Kept as plain data (no Angular DI) so
 * every function below is a pure, trivially-testable decision — see
 * `lead.policy.spec.ts`.
 *
 * Capability (can this *kind* of action happen at all) comes from the
 * server's `/v1/me` `permissions` — never re-derived from `role` on the
 * client. Office scope (can this user act on *this lead's* office) is a
 * separate, client-only concern: it is not expressed by `permissions` at all,
 * so it is still resolved from `userOffices`/`isSuperAdmin`.
 */
export interface LeadPolicyContext {
  /** Absent (e.g. `/v1/me` not loaded yet) is treated as "no capability". */
  readonly permissions: MeResponse['permissions'] | undefined;
  readonly isSuperAdmin: boolean;
  readonly userOffices: readonly { readonly code: string }[];
  readonly userId: string | null;
}

function inUserOffice(context: LeadPolicyContext, officeCode: string): boolean {
  return context.isSuperAdmin || context.userOffices.some((office) => office.code === officeCode);
}

/** Can the current user open the "edit lead fields" dialog for this lead. */
export function canEditLead(
  context: LeadPolicyContext,
  lead: Pick<Lead, 'archivedAt' | 'officeCode'>,
): boolean {
  if (lead.archivedAt) return false;
  if (!context.permissions?.canEditLeadFields) return false;
  return inUserOffice(context, lead.officeCode);
}

/** Can the current user archive this lead (only once it is lost/closed). */
export function canArchiveLead(
  context: LeadPolicyContext,
  lead: Pick<Lead, 'archivedAt' | 'officeCode' | 'clientStatus'>,
): boolean {
  if (lead.clientStatus !== 'closed_lost' || lead.archivedAt) return false;
  if (!context.permissions?.canArchiveLeads) return false;
  return inUserOffice(context, lead.officeCode);
}

/** Can the current user restore/permanently delete an already-archived lead. */
export function canRestoreLeads(context: LeadPolicyContext): boolean {
  return context.permissions?.canRestoreLeads ?? false;
}

/** Can the current user restore/permanently delete this specific archived lead. */
export function canManageArchivedLead(
  context: LeadPolicyContext,
  lead: Pick<Lead, 'archivedAt'>,
): boolean {
  return Boolean(lead.archivedAt) && canRestoreLeads(context);
}

/**
 * Can the current user edit/delete this timeline event. There is no server
 * capability for this (it is not part of `/v1/me` permissions): super admins
 * may mutate any event, everyone else only their own.
 */
export function canMutateEvent(
  context: LeadPolicyContext,
  event: Pick<LeadEvent, 'actorId'>,
): boolean {
  if (context.isSuperAdmin) return true;
  return Boolean(context.userId && event.actorId && event.actorId === context.userId);
}
