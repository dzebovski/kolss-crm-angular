import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';

import type { Profile, SessionContext } from '../../models/database';
import { KolssApiClient } from '../api/generated/kolss-api.client';
import type { MeResponse } from '../api/generated/kolss-api.types';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.getClient();
  private readonly api = inject(KolssApiClient);

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
    const session = this.sessionSignal();
    const profile = this.profileSignal();
    if (!session?.user || !profile) return null;
    return {
      user: { id: session.user.id, email: session.user.email },
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

    const me = await this.api.me();
    const profile = me.profile;
    if (profile && !profile.is_active) {
      await this.supabase.auth.signOut();
      this.sessionSignal.set(null);
      this.profileSignal.set(null);
      this.meSignal.set(null);
      this.errorSignal.set('Обліковий запис деактивовано. Зверніться до адміністратора.');
      return;
    }
    this.meSignal.set(me);
    this.profileSignal.set(profile);
  }
}
