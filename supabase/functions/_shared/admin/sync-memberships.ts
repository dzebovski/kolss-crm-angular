import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.1';

export async function syncMemberships(
  admin: SupabaseClient,
  userId: string,
  officeIds: string[],
): Promise<void> {
  const { error: deleteErr } = await admin
    .from('user_office_memberships')
    .delete()
    .eq('user_id', userId);
  if (deleteErr) throw deleteErr;

  if (officeIds.length === 0) return;

  const { error: insertErr } = await admin.from('user_office_memberships').insert(
    officeIds.map((office_id) => ({ user_id: userId, office_id })),
  );
  if (insertErr) throw insertErr;
}
