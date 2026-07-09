export const ASSIGNABLE_ROLES = ['curator', 'office_admin', 'office_member'] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type UserRole = AssignableRole | 'super_admin';

const MIN_PASSWORD_LENGTH = 12;

export function validateUserInput(opts: {
  role: UserRole;
  officeIds: string[];
  password?: string;
  passwordConfirm?: string;
  requirePassword: boolean;
}): void {
  const { role, officeIds, password, passwordConfirm, requirePassword } = opts;

  if (role === 'curator' && officeIds.length < 2) {
    throw new Error('Куратор має мати доступ щонайменше до двох офісів');
  }
  if (role !== 'curator' && officeIds.length < 1) {
    throw new Error('Оберіть хоча б один офіс');
  }

  if (requirePassword) {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів`);
    }
    if (password !== passwordConfirm) {
      throw new Error('Паролі не збігаються');
    }
  } else if (password) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів`);
    }
    if (password !== passwordConfirm) {
      throw new Error('Паролі не збігаються');
    }
  }
}

export function parseRole(role: string): UserRole {
  if (!ASSIGNABLE_ROLES.includes(role as AssignableRole)) {
    throw new Error('Невірна роль');
  }
  return role as UserRole;
}
