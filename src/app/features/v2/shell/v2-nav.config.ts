import type { MessageKey } from '@core/i18n/messages';

// v2 side menu from the "KOLSS CRM v2" canvas (Main.dc.html, SIDE MENU). The menu markup
// (N2) renders these arrays; it never hardcodes items. Order here is the order on screen.

export type V2NavSectionId = 'sales' | 'planning' | 'reports' | 'settings';

/** Icon names for the 18px stroke icons drawn next to each item in the design. */
export type V2NavIcon =
  | 'leads'
  | 'projects'
  | 'clients'
  | 'meetings-calendar'
  | 'tasks'
  | 'lead-reports'
  | 'funnel-reports'
  | 'accounts'
  | 'platform-settings'
  | 'language'
  | 'impersonate'
  | 'design-system'
  | 'logout';

/** Menu actions that are not navigation. Their behaviour is N3. */
export type V2NavAction = 'language' | 'impersonate' | 'logout';

/** What the menu may know about the viewer to decide visibility. */
export interface V2NavAccess {
  readonly isSuperAdmin: boolean;
}

interface V2NavItemBase {
  readonly id: string;
  readonly labelKey: MessageKey;
  readonly icon: V2NavIcon;
  /** `null` for the item below the divider at the end of the menu (Log out). */
  readonly section: V2NavSectionId | null;
  /** Omitted = visible to every authenticated user. */
  readonly visible?: (access: V2NavAccess) => boolean;
}

export interface V2NavLinkItem extends V2NavItemBase {
  readonly kind: 'link';
  /** Absolute router path. */
  readonly route: string;
  /** `true` while the v2 screen isn't built yet and the item opens the v1 screen. */
  readonly v1: boolean;
}

export interface V2NavActionItem extends V2NavItemBase {
  readonly kind: 'action';
  readonly action: V2NavAction;
}

export type V2NavItem = V2NavLinkItem | V2NavActionItem;

export interface V2NavSection {
  readonly id: V2NavSectionId;
  readonly labelKey: MessageKey;
}

const superAdminOnly = (access: V2NavAccess): boolean => access.isSuperAdmin;

export const V2_NAV_SECTIONS: readonly V2NavSection[] = [
  { id: 'sales', labelKey: 'v2.nav.section.sales' },
  { id: 'planning', labelKey: 'v2.nav.section.planning' },
  { id: 'reports', labelKey: 'v2.nav.section.reports' },
  { id: 'settings', labelKey: 'v2.nav.section.settings' },
];

export const V2_NAV_ITEMS: readonly V2NavItem[] = [
  {
    id: 'leads',
    kind: 'link',
    section: 'sales',
    labelKey: 'v2.nav.leads',
    icon: 'leads',
    route: '/v2/leads',
    v1: false,
  },
  {
    id: 'projects',
    kind: 'link',
    section: 'sales',
    labelKey: 'v2.nav.projects',
    icon: 'projects',
    route: '/projects',
    v1: true,
  },
  {
    id: 'clients',
    kind: 'link',
    section: 'sales',
    labelKey: 'v2.nav.clients',
    icon: 'clients',
    route: '/clients',
    v1: true,
  },
  {
    id: 'meetings-calendar',
    kind: 'link',
    section: 'planning',
    labelKey: 'v2.nav.meetingsCalendar',
    icon: 'meetings-calendar',
    route: '/calendar',
    v1: true,
  },
  {
    // v1 has no Tasks page; its dashboard holds the manager tasks.
    id: 'tasks',
    kind: 'link',
    section: 'planning',
    labelKey: 'v2.nav.tasks',
    icon: 'tasks',
    route: '/dashboard',
    v1: true,
  },
  {
    id: 'lead-reports',
    kind: 'link',
    section: 'reports',
    labelKey: 'v2.nav.leadReports',
    icon: 'lead-reports',
    route: '/reports/leads-status',
    v1: true,
  },
  {
    id: 'financial-funnel-reports',
    kind: 'link',
    section: 'reports',
    labelKey: 'v2.nav.financialFunnelReports',
    icon: 'funnel-reports',
    route: '/reports/sales-funnel',
    v1: true,
  },
  {
    id: 'accounts',
    kind: 'link',
    section: 'settings',
    labelKey: 'v2.nav.accounts',
    icon: 'accounts',
    route: '/accounts/users',
    v1: true,
    visible: superAdminOnly,
  },
  {
    id: 'platform-settings',
    kind: 'link',
    section: 'settings',
    labelKey: 'v2.nav.platformSettings',
    icon: 'platform-settings',
    route: '/accounts/settings',
    v1: true,
    visible: superAdminOnly,
  },
  {
    id: 'language',
    kind: 'action',
    section: 'settings',
    labelKey: 'v2.nav.language',
    icon: 'language',
    action: 'language',
  },
  {
    // Impersonation is super admin only in the API and in v1.
    id: 'impersonate',
    kind: 'action',
    section: 'settings',
    labelKey: 'v2.nav.impersonate',
    icon: 'impersonate',
    action: 'impersonate',
    visible: superAdminOnly,
  },
  {
    id: 'design-system',
    kind: 'link',
    section: 'settings',
    labelKey: 'v2.nav.designSystem',
    icon: 'design-system',
    route: '/design',
    v1: true,
    visible: superAdminOnly,
  },
  {
    id: 'logout',
    kind: 'action',
    section: null,
    labelKey: 'v2.nav.logout',
    icon: 'logout',
    action: 'logout',
  },
];

export interface V2NavGroup {
  readonly section: V2NavSection | null;
  readonly items: readonly V2NavItem[];
}

/**
 * Visible items grouped by section in menu order; sections with no visible item are dropped.
 * The trailing group with `section: null` holds the items below the divider.
 */
export function buildV2Nav(
  access: V2NavAccess,
  items: readonly V2NavItem[] = V2_NAV_ITEMS,
  sections: readonly V2NavSection[] = V2_NAV_SECTIONS,
): readonly V2NavGroup[] {
  const visible = items.filter((item) => item.visible?.(access) ?? true);
  const groups: V2NavGroup[] = sections
    .map((section) => ({
      section,
      items: visible.filter((item) => item.section === section.id),
    }))
    .filter((group) => group.items.length > 0);
  const footer = visible.filter((item) => item.section === null);
  if (footer.length > 0) groups.push({ section: null, items: footer });
  return groups;
}
