import { Injectable, inject } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';

import type { Office, Profile, UserRole } from '../models/database';
import { injectSupabase } from '../core/supabase/supabase.service';
import { ImpersonationService } from '../core/impersonation/impersonation.service';

export interface AdminUserRow {
  readonly id: string;
  readonly email: string;
  readonly profile: Profile;
  readonly offices: readonly Office[];
}

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

interface AdminInvokeResult<T> {
  readonly ok?: boolean;
  readonly error?: string;
  readonly users?: T;
  readonly user?: T;
  readonly userId?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly supabase = injectSupabase();
  private readonly impersonation = inject(ImpersonationService);

  async listUsers(activeOnly = true): Promise<readonly AdminUserRow[]> {
    const result = await this.invoke<readonly AdminUserRow[]>('list', { active_only: activeOnly });
    return result.users ?? [];
  }

  async getUser(userId: string): Promise<AdminUserRow | null> {
    const result = await this.invoke<AdminUserRow>('get', { user_id: userId });
    return result.user ?? null;
  }

  async createUser(payload: CreateUserPayload): Promise<string> {
    const result = await this.invoke<{ userId: string }>('create', {
      email: payload.email,
      display_name: payload.displayName,
      password: payload.password,
      password_confirm: payload.passwordConfirm,
      role: payload.role,
      office_ids: [...payload.officeIds],
    });
    if (!result.userId) throw new Error('Не вдалося створити користувача');
    return result.userId;
  }

  async updateUser(payload: UpdateUserPayload): Promise<void> {
    await this.invoke('update', {
      user_id: payload.userId,
      email: payload.email,
      display_name: payload.displayName,
      password: payload.password ?? '',
      password_confirm: payload.passwordConfirm ?? '',
      role: payload.role,
      office_ids: [...payload.officeIds],
    });
  }

  async deactivateUser(userId: string, confirmEmail: string): Promise<void> {
    await this.invoke('deactivate', { user_id: userId, confirm_email: confirmEmail });
  }

  async reactivateUser(userId: string): Promise<void> {
    await this.invoke('reactivate', { user_id: userId });
  }

  async deleteUser(userId: string, confirmEmail: string): Promise<void> {
    await this.invoke('delete', { user_id: userId, confirm_email: confirmEmail });
  }

  private async invoke<T>(action: string, body: Record<string, unknown>): Promise<AdminInvokeResult<T>> {
    const superAdminToken = this.impersonation.superAdminAccessToken();
    const { data, error } = await this.supabase.functions.invoke('admin-users', {
      body: { action, ...body },
      headers: superAdminToken ? { Authorization: `Bearer ${superAdminToken}` } : undefined,
    });

    if (error) {
      throw new Error(await this.extractInvokeError(error));
    }

    const result = data as AdminInvokeResult<T> & { error?: string };
    if (result?.error) {
      throw new Error(result.error);
    }

    return result;
  }

  private async extractInvokeError(error: unknown): Promise<string> {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response | undefined;
      if (response) {
        try {
          const payload = (await response.clone().json()) as { error?: unknown };
          if (typeof payload?.error === 'string' && payload.error.trim()) {
            return payload.error;
          }
        } catch {
          // Response body is not JSON — fall through to generic message.
        }
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return 'Admin API error';
  }
}
