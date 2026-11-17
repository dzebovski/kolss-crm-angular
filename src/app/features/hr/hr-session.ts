import { computed, inject, resource, Service } from '@angular/core';

import type { HrEmployee, HrMe } from '@core/api/generated/kolss-api.types';
import { AuthService } from '@core/auth/auth.service';
import { SessionService } from '@core/session/session.service';
import { HrService } from '@services/hr/hr.service';

/**
 * The viewer's HR context (`GET /v1/hr/me`), shared by the HR screens and popups and reloaded
 * after every saved change. `canManageHr` comes from `/v1/me` permissions (server-issued).
 */
@Service()
export class HrSession {
  private readonly hr = inject(HrService);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);

  readonly me = resource({
    params: () => ({ version: this.hr.changes() }),
    loader: () => this.hr.me(),
  });

  readonly value = computed<HrMe | undefined>(() =>
    this.me.hasValue() ? this.me.value() : undefined,
  );

  readonly canManageHr = computed(() => this.auth.me()?.permissions.canManageHr ?? false);

  readonly employee = computed<HrEmployee | null>(() => this.value()?.employee ?? null);

  /** Offices the viewer may pick in the HR screens: all for HR admins, own otherwise. */
  readonly offices = computed(() =>
    (this.canManageHr() ? this.session.offices() : this.session.userOffices()).filter(
      (office) => office.is_active !== false,
    ),
  );

  /** Default office: the viewer's HR office, else the first one they can pick. */
  readonly defaultOfficeId = computed(
    () => this.employee()?.officeId ?? this.offices()[0]?.id ?? '',
  );
}
