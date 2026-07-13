import { HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';

import type { Profile, SessionContext } from '../../models/database';
import { KolssApiClient } from '../api/generated/kolss-api.client';
import type { MeResponse } from '../api/generated/kolss-api.types';
import { SupabaseService } from '../supabase/supabase.service';
import { ImpersonationService } from './impersonation.service';

function isInvalidImpersonationError(error: unknown): boolean {
  if (!(error instanceof Error) || !(error.cause instanceof HttpErrorResponse)) {
    return false;
  }
  if (error.cause.status !== 403) {
    return false;
  }
  const body = error.cause.error as { code?: unknown } | null;
  return body?.code === 'invalid_impersonation';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.getClient();
  private readonly api = inject(KolssApiClient);
  private readonly impersonation = inject(ImpersonationService);

  private readonly sessionSignal = signal<Session | null>(null);
  private readonly profileSignal = signal<Profile | null>(null);
  private readonly meSignal = signal<MeResponse | null>(null);
  private readonly initializedSignal = signal(false);
  private readonly loadingSignal = signal(true);
  private readonly errorSignal = signal<string | null>(null);

  readonly session = this.sessionSignal.asReadonly();
  readonly profile = this.profileSignal.asReadonly();
  readonly me = this.meSignal.asReadonly();
  readonly initialized = this.initializedSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly isAuthenticated = computed(() => Boolean(this.sessionSignal()));
  readonly sessionContext = computed<SessionContext | null>(() => {
    const me = this.meSignal();
    const profile = this.profileSignal();
    if (!me?.user?.id || !profile) return null;
    return {
      user: { id: me.user.id, email: me.user.email ?? this.sessionSignal()?.user.email },
      profile,
    };
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.supabaseService.isConfigured()) return;

      const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
        void this.applySession(session);
      });
      onCleanup(() => data.subscription.unsubscribe());
    });
  }

  async initialize(): Promise<void> {
    if (this.initializedSignal()) return;
    this.loadingSignal.set(true);
    if (!this.supabaseService.isConfigured()) {
      this.sessionSignal.set(null);
      this.profileSignal.set(null);
      this.meSignal.set(null);
      this.errorSignal.set('Supabase не налаштовано для локального середовища.');
      this.loadingSignal.set(false);
      this.initializedSignal.set(true);
      return;
    }

    try {
      const { data, error } = await this.supabase.auth.getSession();
      if (error) throw error;
      await this.applySession(data.session);
    } catch (error) {
      this.errorSignal.set(error instanceof Error ? error.message : 'Не вдалося відновити сесію');
      this.sessionSignal.set(null);
      this.profileSignal.set(null);
      this.meSignal.set(null);
    } finally {
      this.loadingSignal.set(false);
      this.initializedSignal.set(true);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      if (!this.supabaseService.isConfigured()) {
        throw new Error(
          'Supabase URL і anon key не налаштовані. Заповніть .env.local і перезапустіть dev server.',
        );
      }

      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      await this.applySession(data.session);
    } catch (error) {
      this.errorSignal.set(error instanceof Error ? error.message : 'Помилка входу');
      throw error;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.loadingSignal.set(true);
    try {
      this.impersonation.clear();
      if (!this.supabaseService.isConfigured()) {
        this.sessionSignal.set(null);
        this.profileSignal.set(null);
        this.meSignal.set(null);
        return;
      }

      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;
      this.sessionSignal.set(null);
      this.profileSignal.set(null);
      this.meSignal.set(null);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private async applySession(session: Session | null): Promise<void> {
    this.sessionSignal.set(session);
    if (!session?.user) {
      this.profileSignal.set(null);
      this.meSignal.set(null);
      return;
    }

    const me = await this.loadMeOnce();
    if (!me) return;

    const profile = me.profile;
    if (profile && !profile.is_active) {
      await this.supabase.auth.signOut();
      this.impersonation.clear();
      this.sessionSignal.set(null);
      this.profileSignal.set(null);
      this.meSignal.set(null);
      this.errorSignal.set('Обліковий запис деактивовано. Зверніться до адміністратора.');
      return;
    }
    this.meSignal.set(me);
    this.profileSignal.set(profile);
  }

  /** Loads /v1/me; on exact invalid_impersonation clears mode and retries once. */
  private async loadMeOnce(): Promise<MeResponse | null> {
    try {
      return await this.api.me();
    } catch (error) {
      if (!isInvalidImpersonationError(error) || !this.impersonation.isActive()) {
        throw error;
      }
      this.impersonation.clear();
      return await this.api.me();
    }
  }
}
