import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';
import { AuthService } from '../core/auth/auth.service';
import type { UserRole } from '../models/database';
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

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly adminUsers = inject(AdminUsersService);
  private readonly api = inject(KolssApiClient);
  private readonly auth = inject(AuthService);

  async listManagers(): Promise<readonly CrmEmployee[]> {
    return (await this.api.managers<CrmEmployee>()).items;
  }

  async listEmployees(): Promise<readonly CrmEmployee[]> {
    if (this.auth.profile()?.role !== 'super_admin') {
      return this.listManagers();
    }
    return (await this.adminUsers.listUsers(true)).map((row) => this.mapAdminUser(row));
  }

  async listInactiveEmployees(): Promise<readonly CrmEmployee[]> {
    return (await this.adminUsers.listUsers(false)).map((row) => this.mapAdminUser(row));
  }

  async getEmployee(userId: string): Promise<CrmEmployee | null> {
    const user = await this.adminUsers.getUser(userId);
    return user ? this.mapAdminUser(user) : null;
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
      .map((office) => office.code)
      .filter((code): code is OfficeId => code === 'kyiv' || code === 'warsaw');
    return {
      id: row.id,
      email: row.email || null,
      displayName: row.profile.display_name?.trim() || 'Без імені',
      role: row.profile.role,
      officeIds,
      officeUuids: row.offices.map((office) => office.id),
      status: row.profile.is_active ? 'active' : 'inactive',
      createdAt: row.profile.created_at,
      lastActiveAt: row.profile.updated_at,
    };
  }
}
