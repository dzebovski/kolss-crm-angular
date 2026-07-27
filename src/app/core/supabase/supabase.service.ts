import { Injectable } from '@angular/core';
import { GoTrueClient } from '@supabase/auth-js';

import { environment } from '@env/environment';

const FALLBACK_SUPABASE_URL = 'http://127.0.0.1:54321';
const FALLBACK_SUPABASE_ANON_KEY = 'prototype-anon-key';

/**
 * Reproduces the localStorage key `@supabase/supabase-js`'s `createClient` derives internally
 * (`sb-${first-hostname-label}-auth-token`, see `node_modules/@supabase/supabase-js/dist/index.mjs`).
 * Now that this service builds a `GoTrueClient` directly instead of going through the
 * `supabase-js` umbrella package, nothing computes this for us — get it wrong and every signed-in
 * user is logged out on deploy because the browser can no longer find their stored session.
 */
export function supabaseAuthStorageKey(supabaseUrl: string): string {
  const hostname = new URL(supabaseUrl).hostname;
  return `sb-${hostname.split('.')[0]}-auth-token`;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly configured = Boolean(
    environment.supabaseUrl &&
    environment.supabaseAnonKey &&
    environment.supabaseUrl !== FALLBACK_SUPABASE_URL &&
    environment.supabaseAnonKey !== FALLBACK_SUPABASE_ANON_KEY,
  );
  private readonly url = this.configured ? environment.supabaseUrl : FALLBACK_SUPABASE_URL;
  private readonly anonKey = this.configured
    ? environment.supabaseAnonKey
    : FALLBACK_SUPABASE_ANON_KEY;

  // Mirrors the defaults `@supabase/supabase-js`'s `createClient` passes to its internal
  // GoTrueClient (see `_initSupabaseAuthClient` in `dist/index.mjs`): the anon key doubles as
  // both `apikey` and the bearer `Authorization` header for unauthenticated auth requests, and
  // `storageKey`/`flowType` match its computed defaults exactly.
  private readonly client = new GoTrueClient({
    url: new URL('auth/v1', this.url).href,
    storageKey: supabaseAuthStorageKey(this.url),
    headers: {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.anonKey}`,
      'X-Client-Info': 'kolss-crm-angular-auth-js',
    },
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  });

  getClient(): GoTrueClient {
    return this.client;
  }

  isConfigured(): boolean {
    return this.configured;
  }
}
