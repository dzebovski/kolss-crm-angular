import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isOfficeId, OFFICE_CONFIG } from '@core/office/office.config';
import { SessionService } from '@core/session/session.service';
import { toV2LeadListItem } from '@domain/v2/lead-view.mapper';
import { v2PluralCategory } from '@domain/v2/plural';
import { LeadsService } from '@services/leads.service';
import { UsersService } from '@services/users.service';
import { V2_NOW } from '../../core/v2-clock';
import { V2_NAV_ITEMS, type V2NavLinkItem } from '../../shell/v2-nav.config';
import { V2Button } from '../../ui/v2-button';
import { V2LeadsTable } from './v2-leads-table';

/** Default period on the Leads board (`40 days`). */
const DEFAULT_PERIOD_DAYS = 40;

const salesTab = (id: string): V2NavLinkItem =>
  V2_NAV_ITEMS.find((item): item is V2NavLinkItem => item.kind === 'link' && item.id === id)!;

// Leads home from the "KOLSS CRM v2" canvas (Main.dc.html, PAGE): title row with the Sales
// sub-tabs and Create lead, result count, leads table. Data comes from the current API
// (`GET /v1/leads`, the whole period as v1 loads it) mapped to the v2 view model (D1).
@Component({
  selector: 'app-v2-leads-page',
  imports: [RouterLink, TranslatePipe, V2Button, V2LeadsTable],
  templateUrl: './v2-leads-page.html',
  styleUrl: './v2-leads-page.scss',
})
export class V2LeadsPage {
  private readonly leadsService = inject(LeadsService);
  private readonly usersService = inject(UsersService);
  private readonly session = inject(SessionService);
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(V2_NOW);

  protected readonly tabs = [salesTab('leads'), salesTab('projects'), salesTab('clients')];

  private readonly leadsResource = resource({
    params: () => ({
      officeId: this.session.selectedOfficeId(),
      days: DEFAULT_PERIOD_DAYS,
      archived: 'active' as const,
    }),
    loader: ({ params }) => this.leadsService.list(params),
  });

  // Manager names come from the employees list, as in v1.
  private readonly employeesResource = resource({
    loader: () => this.usersService.listManagers(),
  });

  /** Taken when the leads arrive, so ages stay stable between reloads. */
  protected readonly now = computed(() => {
    this.leadsResource.value();
    return this.clock();
  });

  protected readonly leads = computed(() => {
    const names = new Map(
      (this.employeesResource.value() ?? []).map((employee) => [employee.id, employee.displayName]),
    );
    return (this.leadsResource.value() ?? []).map((lead) =>
      toV2LeadListItem(lead, { managerName: (id) => names.get(id) ?? null }),
    );
  });

  protected readonly shownCount = computed(() => this.leads().length);
  protected readonly shownNoun = computed(() =>
    this.i18n.t(`v2.leads.shown.${v2PluralCategory(this.i18n.locale(), this.shownCount())}`),
  );
  protected readonly shownContext = computed(() =>
    this.i18n.t('v2.leads.inPeriod', { office: this.officeLabel() }),
  );

  private readonly officeLabel = computed(() => {
    const filter = this.session.officeFilter();
    return this.i18n.t(isOfficeId(filter) ? OFFICE_CONFIG[filter].nameKey : 'office.all');
  });
}
