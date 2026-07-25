import type { UserRole } from '@models/database';
import type { OfficeId } from './office.types';
import type { LocaleCode } from './i18n.types';

export type EmployeeStatus = 'active' | 'inactive';

export interface Employee {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: UserRole;
  readonly officeIds: readonly OfficeId[];
  readonly status: EmployeeStatus;
  readonly locale: LocaleCode;
  readonly createdAt: string;
  readonly lastActiveAt: string;
}
