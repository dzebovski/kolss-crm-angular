import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.1';

import { syncMemberships } from '../_shared/admin/sync-memberships.ts';
import { parseRole, validateUserInput } from '../_shared/admin/validate-user.ts';
import { createAdminClient, createUserClient } from '../_shared/supabase-admin.ts';
import { formatCaughtError, handleOptions, jsonResponse, throwIfSupabaseError } from '../_shared/http.ts';

const BAN_DURATION = '876000h';

type Profile = {
  id: string;
  role: string;
  display_name: string | null;
  is_active: boolean;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
};

type Office = {
  id: string;
  code: string;
  name_uk: string;
  name_pl: string;
  is_active: boolean;
};

export type AdminUserRow = {
  id: string;
  email: string;
  profile: Profile;
  offices: Office[];
};

async function assertSuperAdmin(req: Request): Promise<{ userId: string; authHeader: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new HttpError('Unauthorized', 401);
  }

  const userClient = createUserClient(authHeader);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    throw new HttpError('Unauthorized', 401);
  }

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.is_active || profile.role !== 'super_admin') {
    throw new HttpError('Forbidden', 403);
  }

  return { userId: user.id, authHeader };
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function fetchAllAdminUsers(admin: SupabaseClient): Promise<AdminUserRow[]> {
  const authUsers: { id: string; email?: string }[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    throwIfSupabaseError(error);
    authUsers.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
    if (data.users.length < perPage) break;
    page += 1;
  }

  const userIds = authUsers.map((u) => u.id);
  if (userIds.length === 0) return [];

  const [{ data: profiles }, { data: memberships }, { data: offices }] = await Promise.all([
    admin.from('profiles').select('*').in('id', userIds),
    admin
      .from('user_office_memberships')
      .select('user_id, office_id, offices(*)')
      .in('user_id', userIds),
    admin.from('offices').select('*').eq('is_active', true),
  ]);

  const profileById = new Map((profiles as Profile[] | null)?.map((p) => [p.id, p]) ?? []);
  const officesByUser = new Map<string, Office[]>();
  for (const m of memberships ?? []) {
    const office = m.offices as unknown as Office | null;
    if (!office) continue;
    const list = officesByUser.get(m.user_id) ?? [];
    list.push(office);
    officesByUser.set(m.user_id, list);
  }

  const officeOrder = new Map((offices as Office[] | null)?.map((o, i) => [o.id, i]) ?? []);

  return authUsers
    .map((u) => {
      const profile = profileById.get(u.id);
      if (!profile) return null;
      const userOffices = (officesByUser.get(u.id) ?? []).sort(
        (a, b) => (officeOrder.get(a.id) ?? 0) - (officeOrder.get(b.id) ?? 0),
      );
      return {
        id: u.id,
        email: u.email ?? '',
        profile,
        offices: userOffices,
      };
    })
    .filter((row): row is AdminUserRow => row !== null);
}

async function fetchAdminUserById(
  admin: SupabaseClient,
  userId: string,
): Promise<AdminUserRow | null> {
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);
  if (authError || !authData.user) return null;

  const [{ data: profile }, { data: memberships }, { data: offices }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).single(),
    admin
      .from('user_office_memberships')
      .select('user_id, office_id, offices(*)')
      .eq('user_id', userId),
    admin.from('offices').select('*').eq('is_active', true),
  ]);

  if (!profile) return null;

  const officeOrder = new Map((offices as Office[] | null)?.map((o, i) => [o.id, i]) ?? []);
  const userOffices = (memberships ?? [])
    .map((m) => m.offices as unknown as Office | null)
    .filter((o): o is Office => o !== null)
    .sort((a, b) => (officeOrder.get(a.id) ?? 0) - (officeOrder.get(b.id) ?? 0));

  return {
    id: authData.user.id,
    email: authData.user.email ?? '',
    profile: profile as Profile,
    offices: userOffices,
  };
}

async function handleList(admin: SupabaseClient, activeOnly: boolean) {
  const rows = await fetchAllAdminUsers(admin);
  return rows.filter((r) => (activeOnly ? r.profile.is_active : !r.profile.is_active));
}

async function handleGet(admin: SupabaseClient, userId: string) {
  const row = await fetchAdminUserById(admin, userId);
  if (!row) throw new HttpError('Користувача не знайдено', 404);
  return row;
}

async function handleCreate(
  admin: SupabaseClient,
  userClient: SupabaseClient,
  body: Record<string, unknown>,
) {
  const email = String(body.email ?? '').trim().toLowerCase();
  const displayName = String(body.display_name ?? '').trim();
  const password = String(body.password ?? '');
  const passwordConfirm = String(body.password_confirm ?? '');
  const role = parseRole(String(body.role ?? ''));
  const officeIds = Array.isArray(body.office_ids)
    ? body.office_ids.map(String).filter(Boolean)
    : [];

  if (!email) throw new Error('Вкажіть email');
  if (!displayName) throw new Error('Вкажіть імʼя');
  validateUserInput({ role, officeIds, password, passwordConfirm, requirePassword: true });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createErr) throw new Error(formatCaughtError(createErr));
  if (!created.user) throw new Error('Не вдалося створити користувача');

  const userId = created.user.id;

  const { error: profileErr } = await userClient.from('profiles').upsert({
    id: userId,
    role,
    display_name: displayName,
    is_active: true,
    deactivated_at: null,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(userId);
    throwIfSupabaseError(profileErr);
  }

  try {
    await syncMemberships(userClient, userId, officeIds);
  } catch (err) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(formatCaughtError(err));
  }

  return { userId };
}

async function handleUpdate(
  admin: SupabaseClient,
  userClient: SupabaseClient,
  body: Record<string, unknown>,
) {
  const userId = String(body.user_id ?? '');
  const email = String(body.email ?? '').trim().toLowerCase();
  const displayName = String(body.display_name ?? '').trim();
  const password = String(body.password ?? '');
  const passwordConfirm = String(body.password_confirm ?? '');
  const role = parseRole(String(body.role ?? ''));
  const officeIds = Array.isArray(body.office_ids)
    ? body.office_ids.map(String).filter(Boolean)
    : [];

  if (!userId) throw new Error('Вкажіть user_id');
  if (!email) throw new Error('Вкажіть email');
  if (!displayName) throw new Error('Вкажіть імʼя');
  validateUserInput({
    role,
    officeIds,
    password: password || undefined,
    passwordConfirm: passwordConfirm || undefined,
    requirePassword: false,
  });

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (existingProfile?.role === 'super_admin') {
    throw new Error('Неможливо редагувати супер-адміна через цю форму');
  }

  const authUpdate: {
    email?: string;
    password?: string;
    user_metadata?: Record<string, string>;
  } = {
    email,
    user_metadata: { display_name: displayName },
  };
  if (password) authUpdate.password = password;

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, authUpdate);
  throwIfSupabaseError(authErr);

  const { error: profileErr } = await userClient
    .from('profiles')
    .update({ role, display_name: displayName })
    .eq('id', userId);
  throwIfSupabaseError(profileErr);

  await syncMemberships(userClient, userId, officeIds);
  return { ok: true };
}

async function handleDeactivate(
  admin: SupabaseClient,
  userClient: SupabaseClient,
  body: Record<string, unknown>,
) {
  const userId = String(body.user_id ?? '');
  const confirmEmail = String(body.confirm_email ?? '');
  if (!userId) throw new Error('Вкажіть user_id');

  const row = await fetchAdminUserById(admin, userId);
  if (!row) throw new Error('Користувача не знайдено');
  if (row.profile.role === 'super_admin') {
    throw new Error('Неможливо деактивувати супер-адміна');
  }
  if (confirmEmail.trim().toLowerCase() !== row.email.toLowerCase()) {
    throw new Error('Email для підтвердження не збігається');
  }

  const previousDeactivatedAt = row.profile.deactivated_at;

  const { error: profileErr } = await userClient
    .from('profiles')
    .update({ is_active: false, deactivated_at: new Date().toISOString() })
    .eq('id', userId);
  throwIfSupabaseError(profileErr);

  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: BAN_DURATION,
  });
  if (banErr) {
    await userClient
      .from('profiles')
      .update({ is_active: true, deactivated_at: previousDeactivatedAt })
      .eq('id', userId);
    throwIfSupabaseError(banErr);
  }

  return { ok: true };
}

async function handleReactivate(
  admin: SupabaseClient,
  userClient: SupabaseClient,
  body: Record<string, unknown>,
) {
  const userId = String(body.user_id ?? '');
  if (!userId) throw new Error('Вкажіть user_id');

  const row = await fetchAdminUserById(admin, userId);
  if (!row) throw new Error('Користувача не знайдено');

  const previousDeactivatedAt = row.profile.deactivated_at;

  const { error: profileErr } = await userClient
    .from('profiles')
    .update({ is_active: true, deactivated_at: null })
    .eq('id', userId);
  throwIfSupabaseError(profileErr);

  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  });
  if (banErr) {
    await userClient
      .from('profiles')
      .update({ is_active: false, deactivated_at: previousDeactivatedAt })
      .eq('id', userId);
    throwIfSupabaseError(banErr);
  }

  return { ok: true };
}

async function handleImpersonate(admin: SupabaseClient, body: Record<string, unknown>) {
  const userId = String(body.user_id ?? '');
  if (!userId) throw new Error('Вкажіть user_id');

  const row = await fetchAdminUserById(admin, userId);
  if (!row) throw new Error('Користувача не знайдено');
  if (!row.profile.is_active) throw new Error('Користувача деактивовано');
  if (!row.email) throw new Error('Email користувача не знайдено');

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: row.email,
  });
  throwIfSupabaseError(error);

  const hashedToken = data.properties.hashed_token;
  if (!hashedToken) throw new Error('Не вдалося згенерувати token_hash');

  return { ok: true, token_hash: hashedToken, type: 'magiclink' as const };
}

async function handleDelete(admin: SupabaseClient, body: Record<string, unknown>) {
  const userId = String(body.user_id ?? '');
  const confirmEmail = String(body.confirm_email ?? '');
  if (!userId) throw new Error('Вкажіть user_id');

  const row = await fetchAdminUserById(admin, userId);
  if (!row) throw new Error('Користувача не знайдено');
  if (row.profile.is_active) {
    throw new Error('Спочатку деактивуйте користувача');
  }
  if (row.profile.role === 'super_admin') {
    throw new Error('Неможливо видалити супер-адміна');
  }
  if (confirmEmail.trim().toLowerCase() !== row.email.toLowerCase()) {
    throw new Error('Email для підтвердження не збігається');
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  throwIfSupabaseError(error);

  return { ok: true };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const { authHeader } = await assertSuperAdmin(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const action = String(body.action ?? '');
    const admin = createAdminClient();
    const userClient = createUserClient(authHeader);

    switch (action) {
      case 'list': {
        const activeOnly = body.active_only !== false;
        const users = await handleList(admin, activeOnly);
        return jsonResponse({ ok: true, users });
      }
      case 'get': {
        const user = await handleGet(admin, String(body.user_id ?? ''));
        return jsonResponse({ ok: true, user });
      }
      case 'create': {
        const result = await handleCreate(admin, userClient, body);
        return jsonResponse({ ok: true, ...result });
      }
      case 'update': {
        const result = await handleUpdate(admin, userClient, body);
        return jsonResponse(result);
      }
      case 'deactivate': {
        const result = await handleDeactivate(admin, userClient, body);
        return jsonResponse(result);
      }
      case 'reactivate': {
        const result = await handleReactivate(admin, userClient, body);
        return jsonResponse(result);
      }
      case 'impersonate': {
        const result = await handleImpersonate(admin, body);
        return jsonResponse(result);
      }
      case 'delete': {
        const result = await handleDelete(admin, body);
        return jsonResponse(result);
      }
      default:
        return jsonResponse({ error: 'Unknown action' }, 400);
    }
  } catch (e) {
    if (e instanceof HttpError) {
      return jsonResponse({ error: e.message }, e.status);
    }
    const message = formatCaughtError(e);
    console.error('[admin-users]', e);
    return jsonResponse({ error: message }, 400);
  }
});
