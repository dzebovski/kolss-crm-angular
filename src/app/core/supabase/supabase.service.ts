import { Injectable } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';

const FALLBACK_SUPABASE_URL = 'http://127.0.0.1:54321';
const FALLBACK_SUPABASE_ANON_KEY = 'prototype-anon-key';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly configured = Boolean(
    environment.supabaseUrl &&
    environment.supabaseAnonKey &&
    environment.supabaseUrl !== FALLBACK_SUPABASE_URL &&
    environment.supabaseAnonKey !== FALLBACK_SUPABASE_ANON_KEY,
  );
  private readonly client = createClient(
    this.configured ? environment.supabaseUrl : FALLBACK_SUPABASE_URL,
    this.configured ? environment.supabaseAnonKey : FALLBACK_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );

  getClient(): SupabaseClient {
    return this.client;
  }

  isConfigured(): boolean {
    return this.configured;
  }
}
