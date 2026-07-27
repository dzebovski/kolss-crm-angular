import { supabaseAuthStorageKey } from './supabase.service';

describe('supabaseAuthStorageKey', () => {
  it('reproduces the localStorage key @supabase/supabase-js derives for a known project URL', () => {
    // Formula lifted from the client-construction helper in @supabase/supabase-js
    // (dist/index.mjs): `sb-${baseUrl.hostname.split('.')[0]}-auth-token`. Getting this wrong
    // logs out every signed-in user on deploy, since the browser can no longer find their
    // stored session.
    expect(supabaseAuthStorageKey('https://fpqolqiivzokwpmymqsr.supabase.co')).toBe(
      'sb-fpqolqiivzokwpmymqsr-auth-token',
    );
  });

  it('derives the key from the first hostname label for any project', () => {
    expect(supabaseAuthStorageKey('https://abcdefghijklmnop.supabase.co')).toBe(
      'sb-abcdefghijklmnop-auth-token',
    );
  });

  it('works for a bare host with no subdomain (local Supabase)', () => {
    expect(supabaseAuthStorageKey('http://127.0.0.1:54321')).toBe('sb-127-auth-token');
  });
});
