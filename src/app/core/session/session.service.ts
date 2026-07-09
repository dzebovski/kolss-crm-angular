import { computed, effect, inject, Injectable, signal } from '@angular/core';

import type { Office, UserOfficeContext } from '../../models/database';
import { hasOfficeLeadFilter, isSuperAdminRole } from '../roles/roles';
import { injectSupabase } from '../supabase/supabase.service';
import { AuthService } from '../auth/auth.service';
import { readViewAsMode, writeViewAsMode, type ViewAsMode } from './view-as';
import type { LocaleCode, OfficeFilter } from '../../services/crm-mock.types';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly supabase = injectSupabase();
  private readonly auth = inject(AuthService);

  private readonly officesSignal = signal<Office[]>([]);
  private readonly userOfficesSignal = signal<Office[]>([]);
  private readonly loadedSignal = signal(false);
  private readonly viewAsSignal = signal<ViewAsMode>(readViewAsMode());
  private readonly officeFilterSignal = signal<OfficeFilter>('all');
  private readonly localeSignal = signal<LocaleCode>('uk');
  private lastUserId: string | null = null;

  readonly offices = this.officesSignal.asReadonly();
  readonly userOffices = this.userOfficesSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();
  readonly viewAs = this.viewAsSignal.asReadonly();
  readonly officeFilter = this.officeFilterSignal.asReadonly();
  readonly locale = this.localeSignal.asReadonly();

  readonly officeContext = computed<UserOfficeContext | null>(() => {
    const profile = this.auth.profile();
    if (!profile) return null;

    const isSuperAdmin = isSuperAdminRole(profile.role);
    const canFilter = hasOfficeLeadFilter(profile.role);
    const offices = this.officesSignal();
    const userOffices = isSuperAdmin ? offices : this.userOfficesSignal();
    const filterOffices = isSuperAdmin ? offices : userOffices;

    return {
      isSuperAdmin,
      canFilter,
      offices,
      userOffices,
      filterOffices,
      canUseOfficeFilter: canFilter && filterOffices.length > 1,
    };
  });

  readonly selectedOfficeId = computed<string | null>(() => {
    const filter = this.officeFilterSignal();
    if (filter === 'all') return null;
    const offices = this.officeContext()?.filterOffices ?? [];
    return offices.find((office) => office.code === filter)?.id ?? null;
  });

  readonly showOfficeFilter = computed(() => {
    const context = this.officeContext();
    if (!context) return false;
    return context.canUseOfficeFilter || (context.isSuperAdmin && context.filterOffices.length > 1);
  });

  constructor() {
    effect(() => {
      const userId = this.auth.sessionContext()?.user.id ?? null;
      if (userId === this.lastUserId) return;
      this.lastUserId = userId;
      void this.loadOfficeContext();
    });
  }

  async loadOfficeContext(): Promise<void> {
    const ctx = this.auth.sessionContext();
    if (!ctx) {
      this.officesSignal.set([]);
      this.userOfficesSignal.set([]);
      this.loadedSignal.set(false);
      return;
    }

    const isSuperAdmin = isSuperAdminRole(ctx.profile.role);

    const [officesResult, membershipsResult] = await Promise.all([
      this.supabase.from('offices').select('*').eq('is_active', true).order('code'),
      !isSuperAdmin
        ? this.supabase
            .from('user_office_memberships')
            .select('office_id, offices(*)')
            .eq('user_id', ctx.user.id)
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (officesResult.error) throw officesResult.error;
    if (membershipsResult.error) throw membershipsResult.error;

    const offices = (officesResult.data ?? []) as Office[];
    const userOffices: Office[] = isSuperAdmin
      ? offices
      : (membershipsResult.data ?? [])
          .map((row) => row.offices as unknown as Office)
          .filter(Boolean);

    this.officesSignal.set(offices);
    this.userOfficesSignal.set(userOffices);
    this.loadedSignal.set(true);
    this.applyViewAsFilter();
  }

  setOfficeFilter(filter: OfficeFilter): void {
    this.officeFilterSignal.set(filter);
    if (filter === 'kyiv' || filter === 'warsaw') {
      this.setViewAs(filter);
    } else if (this.officeContext()?.isSuperAdmin) {
      this.setViewAs('super_admin');
    }
  }

  setLocale(locale: LocaleCode): void {
    this.localeSignal.set(locale);
  }

  setViewAs(mode: ViewAsMode): void {
    this.viewAsSignal.set(mode);
    writeViewAsMode(mode);
    this.applyViewAsFilter();
  }

  private applyViewAsFilter(): void {
    const mode = this.viewAsSignal();
    if (mode === 'kyiv' || mode === 'warsaw') {
      this.officeFilterSignal.set(mode);
      return;
    }
    if (this.officeFilterSignal() !== 'kyiv' && this.officeFilterSignal() !== 'warsaw') {
      return;
    }
    this.officeFilterSignal.set('all');
  }
}
