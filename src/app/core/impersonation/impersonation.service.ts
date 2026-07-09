import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';

import { AuthService } from '../auth/auth.service';
import { injectSupabase } from '../supabase/supabase.service';
import { environment } from '../../../environments/environment';

const SUPER_ADMIN_SESSION_KEY = 'kolss_super_admin_session';

interface StoredSession {
  readonly user_id: string;
  readonly access_token: string;
  readonly refresh_token: string;
}

function canStoreSession(session: Session | null | undefined): session is Session {
  return Boolean(session?.access_token && session?.refresh_token && session?.user?.id);
}

function readStoredSession(): StoredSession | null {
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return null;
  const raw = localStorage.getItem(SUPER_ADMIN_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.user_id || !parsed.access_token || !parsed.refresh_token) return null;
    return {
      user_id: String(parsed.user_id),
      access_token: String(parsed.access_token),
      refresh_token: String(parsed.refresh_token),
    };
  } catch {
    return null;
  }
}

function writeStoredSession(value: StoredSession | null): void {
  if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') return;
  if (!value) {
    if (typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
    }
    return;
  }
  localStorage.setItem(SUPER_ADMIN_SESSION_KEY, JSON.stringify(value));
}

@Injectable({ providedIn: 'root' })
export class ImpersonationService {
  private readonly supabase = injectSupabase();
  private readonly auth = inject(AuthService);

  private readonly superAdminSessionSignal = signal<StoredSession | null>(readStoredSession());

  readonly superAdminSession = this.superAdminSessionSignal.asReadonly();

  readonly isImpersonating = computed(() => {
    const stored = this.superAdminSessionSignal();
    const currentUserId = this.currentSession()?.user?.id ?? null;
    if (!stored || !currentUserId) return false;
    return currentUserId !== stored.user_id;
  });

  constructor() {
    effect(() => {
      const session = this.currentSession();
      if (!session) {
        this.doClearStoredSuperAdminSession();
      }
    });
  }

  superAdminAccessToken(): string | null {
    const stored = this.superAdminSessionSignal();
    if (stored) return stored.access_token;
    return this.currentSession()?.access_token ?? null;
  }

  async startImpersonation(targetUserId: string): Promise<void> {
    const currentSession = this.currentSession();
    if (!canStoreSession(currentSession)) {
      throw new Error('Немає активної сесії super_admin');
    }

    if (!this.superAdminSessionSignal()) {
      const stored: StoredSession = {
        user_id: currentSession.user.id,
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
      };
      this.superAdminSessionSignal.set(stored);
      writeStoredSession(stored);
    }

    const superAdminToken = this.superAdminSessionSignal()?.access_token ?? currentSession.access_token;

    const url = `${environment.supabaseUrl.replace(/\/+$/, '')}/functions/v1/admin-users`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'impersonate', user_id: targetUserId }),
    });

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      payload = undefined;
    }

    if (!res.ok) {
      const msg =
        (payload as { error?: unknown })?.error ??
        `Edge Function returned ${res.status} ${res.statusText}`;
      throw new Error(typeof msg === 'string' ? msg : 'Не вдалося виконати імперсонацію');
    }

    const tokenHash = (payload as { token_hash?: unknown })?.token_hash;
    if (typeof tokenHash !== 'string' || !tokenHash) {
      throw new Error('Не вдалося отримати token_hash для імперсонації');
    }

    const { error: verifyError } = await this.supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash,
    });
    if (verifyError) throw verifyError;
  }

  async stopImpersonation(): Promise<void> {
    const stored = this.superAdminSessionSignal();
    if (!stored) return;

    const { error } = await this.supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    if (error) throw error;
  }

  clearStoredSuperAdminSession(): void {
    this.doClearStoredSuperAdminSession();
  }

  private doClearStoredSuperAdminSession(): void {
    this.superAdminSessionSignal.set(null);
    writeStoredSession(null);
  }

  private currentSession(): Session | null {
    const session = (this.auth as unknown as { session?: unknown }).session;
    if (typeof session === 'function') {
      return (session as () => Session | null)();
    }
    return null;
  }
}

