import { Injectable } from '@angular/core';

import type { Office, Profile, UserRole } from '../models/database';
import { injectSupabase } from '../core/supabase/supabase.service';
import type { OfficeId } from './crm-mock.types';

export interface CrmEmployee {
  readonly id: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly officeIds: readonly OfficeId[];
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

  async listEmployees(): Promise<readonly CrmEmployee[]> {
    const [{ data: profiles, error: profilesError }, { data: memberships, error: membershipsError }] =
      await Promise.all([
        this.supabase.from('profiles').select('*').order('display_name'),
        this.supabase
          .from('user_office_memberships')
          .select('user_id, office_id, offices(id, code, name_uk, name_pl, is_active)'),
      ]);

    if (profilesError) throw profilesError;
    if (membershipsError) throw membershipsError;

    const officesByUser = new Map<string, OfficeId[]>();
    for (const row of (memberships ?? []) as MembershipRow[]) {
      const code = officeCodeFromMembership(row);
      if (!code) continue;
      const list = officesByUser.get(row.user_id) ?? [];
      list.push(code);
      officesByUser.set(row.user_id, list);
    }

    return ((profiles ?? []) as Profile[]).map((profile) => this.mapEmployee(profile, officesByUser));
  }

  async getEmployee(userId: string): Promise<CrmEmployee | null> {
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

    const officesByUser = new Map<string, OfficeId[]>();
    for (const row of (memberships ?? []) as MembershipRow[]) {
      const code = officeCodeFromMembership(row);
      if (!code) continue;
      const list = officesByUser.get(row.user_id) ?? [];
      list.push(code);
      officesByUser.set(row.user_id, list);
    }

    return this.mapEmployee(profile as Profile, officesByUser);
  }

  async updateEmployeeStatus(userId: string, isActive: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('profiles')
      .update({
        is_active: isActive,
        deactivated_at: isActive ? null : new Date().toISOString(),
      })
      .eq('id', userId);
    if (error) throw error;
  }

  private mapEmployee(
    profile: Profile,
    officesByUser: Map<string, OfficeId[]>,
  ): CrmEmployee {
    return {
      id: profile.id,
      displayName: profile.display_name?.trim() || 'Без імені',
      role: profile.role,
      officeIds: officesByUser.get(profile.id) ?? [],
      status: profile.is_active ? 'active' : 'inactive',
      createdAt: profile.created_at,
      lastActiveAt: profile.updated_at,
    };
  }
}
