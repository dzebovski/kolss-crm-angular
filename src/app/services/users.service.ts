import { Injectable, inject } from '@angular/core';

import type { Office, Profile, UserRole } from '../models/database';
import { injectSupabase } from '../core/supabase/supabase.service';
import {
  AdminUsersService,
  type AdminUserRow,
  type CreateUserPayload,
  type UpdateUserPayload,
} from './admin-users.service';
import type { OfficeId } from './crm-mock.types';

export interface CrmEmployee {
  readonly id: string;
  readonly email: string | null;
  readonly displayName: string;
  readonly role: UserRole;
  readonly officeIds: readonly OfficeId[];
  readonly officeUuids: readonly string[];
  readonly status: 'active' | 'inactive';
  readonly createdAt: string;
  readonly lastActiveAt: string;
}

interface MembershipRow {
  user_id: string;
  office_id: string;
  offices: Office | Office[] | null;
}

function officeCodeFromMembership(row: MembershipRow): OfficeId | null {
  const office = Array.isArray(row.offices) ? row.offices[0] : row.offices;
  const code = office?.code;
  return code === 'kyiv' || code === 'warsaw' ? code : null;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly supabase = injectSupabase();
  private readonly adminUsers = inject(AdminUsersService);

  async listEmployees(): Promise<readonly CrmEmployee[]> {
    try {
      const users = await this.adminUsers.listUsers(true);
      return users.map((row) => this.mapAdminUser(row));
    } catch {
      const employees = await this.listEmployeesFromProfiles();
      return employees.filter((employee) => employee.status === 'active');
    }
  }

  async listInactiveEmployees(): Promise<readonly CrmEmployee[]> {
    try {
      const users = await this.adminUsers.listUsers(false);
      return users.map((row) => this.mapAdminUser(row));
    } catch {
      const employees = await this.listEmployeesFromProfiles();
      return employees.filter((employee) => employee.status === 'inactive');
    }
  }

  async getEmployee(userId: string): Promise<CrmEmployee | null> {
    try {
      const user = await this.adminUsers.getUser(userId);
      return user ? this.mapAdminUser(user) : null;
    } catch {
      return this.getEmployeeFromProfiles(userId);
    }
  }

  async createEmployee(payload: CreateUserPayload): Promise<string> {
    return this.adminUsers.createUser(payload);
  }

  async updateEmployee(payload: UpdateUserPayload): Promise<void> {
    await this.adminUsers.updateUser(payload);
  }

  async deactivateEmployee(userId: string, confirmEmail: string): Promise<void> {
    await this.adminUsers.deactivateUser(userId, confirmEmail);
  }

  async reactivateEmployee(userId: string): Promise<void> {
    await this.adminUsers.reactivateUser(userId);
  }

  async deleteEmployee(userId: string, confirmEmail: string): Promise<void> {
    await this.adminUsers.deleteUser(userId, confirmEmail);
  }

  private mapAdminUser(row: AdminUserRow): CrmEmployee {
    const officeIds = row.offices
      .map((o) => o.code)
      .filter((code): code is OfficeId => code === 'kyiv' || code === 'warsaw');

    return {
      id: row.id,
      email: row.email || null,
      displayName: row.profile.display_name?.trim() || 'Без імені',
      role: row.profile.role,
      officeIds,
      officeUuids: row.offices.map((o) => o.id),
      status: row.profile.is_active ? 'active' : 'inactive',
      createdAt: row.profile.created_at,
      lastActiveAt: row.profile.updated_at,
    };
  }

  private async listEmployeesFromProfiles(): Promise<readonly CrmEmployee[]> {
    const [{ data: profiles, error: profilesError }, { data: memberships, error: membershipsError }] =
      await Promise.all([
        this.supabase.from('profiles').select('*').order('display_name'),
        this.supabase
          .from('user_office_memberships')
          .select('user_id, office_id, offices(id, code, name_uk, name_pl, is_active)'),
      ]);

    if (profilesError) throw profilesError;
    if (membershipsError) throw membershipsError;

    const officesByUser = this.buildOfficeMaps(memberships as MembershipRow[]);
    return ((profiles ?? []) as Profile[]).map((profile) =>
      this.mapProfileEmployee(profile, officesByUser),
    );
  }

  private async getEmployeeFromProfiles(userId: string): Promise<CrmEmployee | null> {
    const [{ data: profile, error: profileError }, { data: memberships, error: membershipsError }] =
      await Promise.all([
        this.supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        this.supabase
          .from('user_office_memberships')
          .select('user_id, office_id, offices(id, code, name_uk, name_pl, is_active)')
          .eq('user_id', userId),
      ]);

    if (profileError) throw profileError;
    if (membershipsError) throw membershipsError;
    if (!profile) return null;

    const officesByUser = this.buildOfficeMaps(memberships as MembershipRow[]);
    return this.mapProfileEmployee(profile as Profile, officesByUser);
  }

  private buildOfficeMaps(memberships: MembershipRow[]): {
    codes: Map<string, OfficeId[]>;
    uuids: Map<string, string[]>;
  } {
    const codes = new Map<string, OfficeId[]>();
    const uuids = new Map<string, string[]>();
    for (const row of memberships ?? []) {
      const code = officeCodeFromMembership(row);
      if (code) {
        const list = codes.get(row.user_id) ?? [];
        list.push(code);
        codes.set(row.user_id, list);
      }
      const uuidList = uuids.get(row.user_id) ?? [];
      uuidList.push(row.office_id);
      uuids.set(row.user_id, uuidList);
    }
    return { codes, uuids };
  }

  private mapProfileEmployee(
    profile: Profile,
    officesByUser: { codes: Map<string, OfficeId[]>; uuids: Map<string, string[]> },
  ): CrmEmployee {
    return {
      id: profile.id,
      email: null,
      displayName: profile.display_name?.trim() || 'Без імені',
      role: profile.role,
      officeIds: officesByUser.codes.get(profile.id) ?? [],
      officeUuids: officesByUser.uuids.get(profile.id) ?? [],
      status: profile.is_active ? 'active' : 'inactive',
      createdAt: profile.created_at,
      lastActiveAt: profile.updated_at,
    };
  }
}
