import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.110.1';

export function getSupabaseUrl(): string {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  if (!url) throw new Error('SUPABASE_URL is not configured');
  return url;
}

export function getServiceRoleKey(): string {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return key;
}

export function getAnonKey(): string {
  const key = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!key) throw new Error('SUPABASE_ANON_KEY is not configured');
  return key;
}

export function createAdminClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(authHeader: string): SupabaseClient {
  return createClient(getSupabaseUrl(), getAnonKey(), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
