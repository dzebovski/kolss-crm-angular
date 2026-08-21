import type { MeResponse } from '@core/api/generated/kolss-api.types';
import type { Lead, LeadEvent } from '@domain/lead.types';
import {
  canArchiveLead,
  canEditLead,
  canManageArchivedLead,
  canMutateEvent,
  canRestoreLeads,
  type LeadPolicyContext,
} from './lead.policy';

type LeadFixture = Pick<Lead, 'archivedAt' | 'officeCode' | 'clientStatus'>;
type EventFixture = Pick<LeadEvent, 'actorId'>;

function permissions(
  overrides: Partial<MeResponse['permissions']> = {},
): MeResponse['permissions'] {
  return {
    canManageUsers: false,
    canEditLeadFields: false,
    canArchiveLeads: false,
    canRestoreLeads: false,
    ...overrides,
  };
}

function context(overrides: Partial<LeadPolicyContext> = {}): LeadPolicyContext {
  return {
    permissions: permissions(),
    isSuperAdmin: false,
    userOffices: [],
    userId: null,
    ...overrides,
  };
}

function lead(overrides: Partial<LeadFixture> = {}): LeadFixture {
  return {
    archivedAt: null,
    officeCode: 'kyiv',
    clientStatus: 'closed_lost',
    ...overrides,
  };
}

describe('lead.policy', () => {
  describe('canEditLead', () => {
    it('allows a super admin regardless of office membership', () => {
      const ctx = context({
        isSuperAdmin: true,
        permissions: permissions({ canEditLeadFields: true }),
        userOffices: [],
      });
      expect(canEditLead(ctx, lead({ officeCode: 'warsaw' }))).toBe(true);
    });

    it('allows an office admin editing a lead in their own office', () => {
      const ctx = context({
        permissions: permissions({ canEditLeadFields: true }),
        userOffices: [{ code: 'kyiv' }],
      });
      expect(canEditLead(ctx, lead({ officeCode: 'kyiv' }))).toBe(true);
    });

    it('denies an office admin editing a lead in another office', () => {
      const ctx = context({
        permissions: permissions({ canEditLeadFields: true }),
        userOffices: [{ code: 'kyiv' }],
      });
      expect(canEditLead(ctx, lead({ officeCode: 'warsaw' }))).toBe(false);
    });

    it('denies editing once the lead is archived, even for a super admin', () => {
      const ctx = context({
        isSuperAdmin: true,
        permissions: permissions({ canEditLeadFields: true }),
      });
      expect(canEditLead(ctx, lead({ archivedAt: '2026-07-01T00:00:00.000Z' }))).toBe(false);
    });

    it('denies editing when /v1/me permissions are missing (not loaded yet)', () => {
      const ctx = context({
        isSuperAdmin: true,
        permissions: undefined,
        userOffices: [{ code: 'kyiv' }],
      });
      expect(canEditLead(ctx, lead())).toBe(false);
    });
  });

  describe('canArchiveLead', () => {
    it('allows a super admin to archive a closed_lost lead', () => {
      const ctx = context({
        isSuperAdmin: true,
        permissions: permissions({ canArchiveLeads: true }),
      });
      expect(canArchiveLead(ctx, lead({ officeCode: 'warsaw' }))).toBe(true);
    });

    it('allows an office admin to archive within their own office', () => {
      const ctx = context({
        permissions: permissions({ canArchiveLeads: true }),
        userOffices: [{ code: 'kyiv' }],
      });
      expect(canArchiveLead(ctx, lead({ officeCode: 'kyiv' }))).toBe(true);
    });

    it('denies an office admin archiving a lead in another office', () => {
      const ctx = context({
        permissions: permissions({ canArchiveLeads: true }),
        userOffices: [{ code: 'kyiv' }],
      });
      expect(canArchiveLead(ctx, lead({ officeCode: 'warsaw' }))).toBe(false);
    });

    it('denies archiving a lead that is not closed_lost', () => {
      const ctx = context({
        isSuperAdmin: true,
        permissions: permissions({ canArchiveLeads: true }),
      });
      expect(canArchiveLead(ctx, lead({ clientStatus: 'thinking' }))).toBe(false);
    });

    it('denies archiving a postponed lead — still non-terminal and awaiting the client', () => {
      const ctx = context({
        isSuperAdmin: true,
        permissions: permissions({ canArchiveLeads: true }),
      });
      expect(canArchiveLead(ctx, lead({ clientStatus: 'postponed' }))).toBe(false);
    });

    it('denies archiving an already-archived lead', () => {
      const ctx = context({
        isSuperAdmin: true,
        permissions: permissions({ canArchiveLeads: true }),
      });
      expect(canArchiveLead(ctx, lead({ archivedAt: '2026-07-01T00:00:00.000Z' }))).toBe(false);
    });

    it('denies an office member without the archive capability', () => {
      const ctx = context({
        permissions: permissions({ canEditLeadFields: true, canArchiveLeads: false }),
        userOffices: [{ code: 'kyiv' }],
      });
      expect(canArchiveLead(ctx, lead({ officeCode: 'kyiv' }))).toBe(false);
    });
  });

  describe('canManageArchivedLead / canRestoreLeads', () => {
    it('allows a super admin to restore an archived lead', () => {
      const ctx = context({
        isSuperAdmin: true,
        permissions: permissions({ canRestoreLeads: true }),
      });
      expect(canManageArchivedLead(ctx, lead({ archivedAt: '2026-07-01T00:00:00.000Z' }))).toBe(
        true,
      );
      expect(canRestoreLeads(ctx)).toBe(true);
    });

    it('denies restoring a lead that is not archived', () => {
      const ctx = context({
        isSuperAdmin: true,
        permissions: permissions({ canRestoreLeads: true }),
      });
      expect(canManageArchivedLead(ctx, lead({ archivedAt: null }))).toBe(false);
    });

    it('denies a non-super-admin office admin from managing archived leads', () => {
      const ctx = context({
        permissions: permissions({ canEditLeadFields: true, canArchiveLeads: true }),
        userOffices: [{ code: 'kyiv' }],
      });
      expect(canManageArchivedLead(ctx, lead({ archivedAt: '2026-07-01T00:00:00.000Z' }))).toBe(
        false,
      );
    });

    it('denies when permissions are missing', () => {
      const ctx = context({ isSuperAdmin: true, permissions: undefined });
      expect(canManageArchivedLead(ctx, lead({ archivedAt: '2026-07-01T00:00:00.000Z' }))).toBe(
        false,
      );
    });
  });

  describe('canMutateEvent', () => {
    const event = (actorId: string): EventFixture => ({ actorId });

    it('lets a super admin mutate any event', () => {
      const ctx = context({ isSuperAdmin: true, userId: 'admin-1' });
      expect(canMutateEvent(ctx, event('someone-else'))).toBe(true);
    });

    it('lets an office member mutate their own event', () => {
      const ctx = context({ userId: 'member-1' });
      expect(canMutateEvent(ctx, event('member-1'))).toBe(true);
    });

    it("denies an office member mutating someone else's event", () => {
      const ctx = context({ userId: 'member-1' });
      expect(canMutateEvent(ctx, event('member-2'))).toBe(false);
    });

    it('denies when there is no current user id', () => {
      const ctx = context({ userId: null });
      expect(canMutateEvent(ctx, event('member-2'))).toBe(false);
    });
  });
});
