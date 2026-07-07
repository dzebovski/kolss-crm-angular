import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';

import type { Profile, SessionContext } from '../../models/database';
import { SupabaseService } from '../supabase/supabase.service';

const PROFILE_COLUMNS =
  'id, role, display_name, is_active, deactivated_at, created_at, updated_at';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).getClient();

  private readonly sessionSignal = signal<Session | null>(null);
  private readonly profileSignal = signal<Profile | null>(null);
  private readonly initializedSignal = signal(false);
  private readonly loadingSignal = signal(true);
  private readonly errorSignal = signal<string | null>(null);

  readonly session = this.sessionSignal.asReadonly();
  readonly profile = this.profileSignal.asReadonly();
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
      const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
        void this.applySession(session);
      });
      onCleanup(() => data.subscription.unsubscribe());
    });
  }

  async initialize(): Promise<void> {
    if (this.initializedSignal()) return;
    this.loadingSignal.set(true);
    try {
      const { data, error } = await this.supabase.auth.getSession();
      if (error) throw error;
      await this.applySession(data.session);
    } catch (error) {
      this.errorSignal.set(error instanceof Error ? error.message : 'Не вдалося відновити сесію');
      this.sessionSignal.set(null);
      this.profileSignal.set(null);
    } finally {
      this.loadingSignal.set(false);
      this.initializedSignal.set(true);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        const profile = await this.fetchProfile(data.user.id);
        if (profile && !profile.is_active) {
          await this.supabase.auth.signOut();
          throw new Error('Обліковий запис деактивовано. Зверніться до адміністратора.');
        }
      }

      await this.applySession(data.session);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.loadingSignal.set(true);
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;
      this.sessionSignal.set(null);
      this.profileSignal.set(null);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private async applySession(session: Session | null): Promise<void> {
    this.sessionSignal.set(session);
    if (!session?.user) {
      this.profileSignal.set(null);
      return;
    }

    const profile = await this.fetchProfile(session.user.id);
    if (profile && !profile.is_active) {
      await this.supabase.auth.signOut();
      this.sessionSignal.set(null);
      this.profileSignal.set(null);
      this.errorSignal.set('Обліковий запис деактивовано. Зверніться до адміністратора.');
      return;
    }
    this.profileSignal.set(profile);
  }

  private async fetchProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data as Profile | null;
  }
}
