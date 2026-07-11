import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';
import type { AdminUserRow } from '../core/api/generated/kolss-api.types';
import type { UserRole } from '../models/database';

export type { AdminUserRow };

export interface CreateUserPayload {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
  readonly passwordConfirm: string;
  readonly role: UserRole;
  readonly officeIds: readonly string[];
}

export interface UpdateUserPayload {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly password?: string;
  readonly passwordConfirm?: string;
  readonly role: UserRole;
  readonly officeIds: readonly string[];
}

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly api = inject(KolssApiClient);

  async listUsers(activeOnly = true): Promise<readonly AdminUserRow[]> {
    return (await this.api.users(activeOnly)).items;
  }

  async getUser(userId: string): Promise<AdminUserRow | null> {
    try {
      return await this.api.user<AdminUserRow>(userId);
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) return null;
      throw error;
    }
  }

  async createUser(payload: CreateUserPayload): Promise<string> {
    const result = await this.api.createUser(payload);
    return result.userId;
  }

  async updateUser(payload: UpdateUserPayload): Promise<void> {
    const { userId, ...body } = payload;
    await this.api.updateUser(userId, body);
  }

  async deactivateUser(userId: string, confirmEmail: string): Promise<void> {
    await this.api.userAction(userId, 'deactivate', { confirmEmail });
  }

  async reactivateUser(userId: string): Promise<void> {
    await this.api.userAction(userId, 'reactivate');
  }

  async deleteUser(userId: string, confirmEmail: string): Promise<void> {
    await this.api.userAction(userId, 'delete', { confirmEmail });
  }
}
