import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { Component, computed, inject, signal } from '@angular/core';
import { email, form, FormField, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../ui/button/ui-button';
import { UiIconButton } from '../../ui/button/ui-icon-button';
import { UiDialogService } from '../../ui/dialog/ui-dialog';
import { UiAlert } from '../../ui/feedback/ui-alert';
import { UiBadge, UiBadgeTone } from '../../ui/feedback/ui-badge';
import { UiChip } from '../../ui/feedback/ui-chip';
import { UiCheckbox } from '../../ui/form/ui-checkbox';
import { UiRadio } from '../../ui/form/ui-radio';
import { UiSelect, UiSelectOption } from '../../ui/form/ui-select';
import { UiSwitch } from '../../ui/form/ui-switch';
import { UiTextField } from '../../ui/form/ui-text-field';
import { UiTextarea } from '../../ui/form/ui-textarea';
import { UiIcon, UiIconName } from '../../ui/icon/ui-icon';
import { UiMenu, UiMenuItem } from '../../ui/menu/ui-menu';
import { UiDataTable, UiTableColumn } from '../../ui/table/ui-data-table';
import { UiTabItem, UiTabs } from '../../ui/tabs/ui-tabs';
import { UiTooltip } from '../../ui/tooltip/ui-tooltip';

type CatalogTab = 'foundation' | 'components' | 'sections';
type TableState = 'ready' | 'loading' | 'empty' | 'error';

interface AccountRow {
  readonly id: number;
  readonly account: string;
  readonly owner: string;
  readonly status: 'Active' | 'At risk' | 'Onboarding' | 'Paused';
  readonly value: number;
  readonly updated: string;
}

@Component({
  selector: 'app-design-page',
  imports: [
    RouterLink,
    FormField,
    Tabs,
    TabList,
    Tab,
    TabPanel,
    TabContent,
    UiAlert,
    UiBadge,
    UiButton,
    UiCheckbox,
    UiChip,
    UiIcon,
    UiIconButton,
    UiMenu,
    UiRadio,
    UiSelect,
    UiSwitch,
    UiTabs,
    UiTextField,
    UiTextarea,
    UiTooltip,
    UiDataTable,
  ],
  templateUrl: './design-page.html',
})
export class DesignPage {
  private readonly dialog = inject(UiDialogService);

  protected readonly activeTab = signal<CatalogTab | undefined>('foundation');
  protected readonly density = signal<'comfortable' | 'compact'>('comfortable');
  protected readonly notifications = signal(true);
  protected readonly includeInactive = signal(false);
  protected readonly priority = signal('medium');
  protected readonly notes = signal('Follow up after the quarterly review.');
  protected readonly chipVisible = signal(true);
  protected readonly menuAction = signal('No action selected');
  protected readonly tableState = signal<TableState>('ready');

  protected readonly formModel = signal({
    company: '',
    email: '',
    stage: 'qualified',
  });

  protected readonly contactForm = form(this.formModel, (schema) => {
    required(schema.company, { message: 'Company name is required.' });
    required(schema.email, { message: 'Email is required.' });
    email(schema.email, { message: 'Enter a valid email address.' });
    required(schema.stage);
  });

  protected readonly stageOptions: readonly UiSelectOption[] = [
    { value: 'new', label: 'New lead' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'proposal', label: 'Proposal sent' },
    { value: 'won', label: 'Closed won' },
  ];

  protected readonly sampleTabs: readonly UiTabItem[] = [
    {
      value: 'overview',
      label: 'Overview',
      content: 'A concise account overview with current health.',
    },
    { value: 'activity', label: 'Activity', content: 'Recent calls, notes and workflow events.' },
    {
      value: 'billing',
      label: 'Billing',
      content: 'Invoices and payment details.',
      disabled: true,
    },
  ];

  protected readonly menuItems: readonly UiMenuItem[] = [
    { value: 'edit', label: 'Edit account', icon: 'edit' },
    { value: 'duplicate', label: 'Duplicate', icon: 'content_copy' },
    { value: 'archive', label: 'Archive', icon: 'archive' },
    { value: 'delete', label: 'Delete permanently', icon: 'delete', disabled: true },
  ];

  protected readonly swatches = [
    { name: 'Ink', token: '--ui-ink-950', value: 'oklch(19% 0.012 302)' },
    { name: 'Violet', token: '--ui-violet', value: 'oklch(53% 0.25 296)' },
    { name: 'Magenta', token: '--ui-magenta', value: 'oklch(62% 0.25 340)' },
    { name: 'Coral', token: '--ui-coral', value: 'oklch(66% 0.23 25)' },
    { name: 'Success', token: '--ui-success', value: 'oklch(44% 0.13 153)' },
    { name: 'Warning', token: '--ui-warning', value: 'oklch(49% 0.13 74)' },
  ] as const;

  protected readonly spacing = [4, 8, 12, 16, 24, 32, 48, 64];
  protected readonly icons: readonly UiIconName[] = [
    'search',
    'add',
    'filter_list',
    'view_kanban',
    'calendar_month',
    'history',
    'automation',
    'more_horiz',
  ];

  protected readonly accountRows: readonly AccountRow[] = [
    {
      id: 1001,
      account: 'Northstar Studio',
      owner: 'Maya Chen',
      status: 'Active',
      value: 48200,
      updated: '2 min ago',
    },
    {
      id: 1002,
      account: 'Orbital Works',
      owner: 'Jon Bell',
      status: 'Onboarding',
      value: 31800,
      updated: '18 min ago',
    },
    {
      id: 1003,
      account: 'Fieldnote Labs',
      owner: 'Ava Singh',
      status: 'At risk',
      value: 24600,
      updated: '1 hour ago',
    },
    {
      id: 1004,
      account: 'Common Ground',
      owner: 'Maya Chen',
      status: 'Active',
      value: 65500,
      updated: '3 hours ago',
    },
    {
      id: 1005,
      account: 'Aperture Health',
      owner: 'Jon Bell',
      status: 'Paused',
      value: 19700,
      updated: 'Yesterday',
    },
    {
      id: 1006,
      account: 'Daybreak Retail',
      owner: 'Ava Singh',
      status: 'Active',
      value: 72300,
      updated: 'Yesterday',
    },
    {
      id: 1007,
      account: 'Morrow & Co.',
      owner: 'Maya Chen',
      status: 'Onboarding',
      value: 41400,
      updated: '2 days ago',
    },
  ];

  protected readonly tableColumns: readonly UiTableColumn<AccountRow>[] = [
    { key: 'account', label: 'Account', sortable: true, width: '30%' },
    { key: 'owner', label: 'Owner', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      badge: true,
      tone: (row) => this.statusTone(row.status),
    },
    {
      key: 'value',
      label: 'Pipeline',
      sortable: true,
      format: (value) => `$${Number(value).toLocaleString('en-US')}`,
    },
    { key: 'updated', label: 'Updated' },
  ];
  protected readonly accountRowKey = (row: AccountRow) => row.id;
  protected readonly accountRowLabel = (row: AccountRow) => row.account;

  protected readonly visibleRows = computed(() =>
    this.tableState() === 'empty' ? [] : this.accountRows,
  );

  protected setActiveTab(value: string | undefined) {
    if (value === 'foundation' || value === 'components' || value === 'sections') {
      this.activeTab.set(value);
    }
  }

  protected toggleDensity() {
    this.density.update((density) => (density === 'comfortable' ? 'compact' : 'comfortable'));
  }

  protected fieldError(field: 'company' | 'email') {
    const state = this.contactForm[field]();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected selectMenuItem(value: string) {
    this.menuAction.set(this.menuItems.find((item) => item.value === value)?.label ?? value);
  }

  protected openDialog() {
    this.dialog.confirm({
      title: 'Archive this account?',
      description: 'The account will leave active workflows but remain available in history.',
      confirmLabel: 'Archive account',
      danger: true,
    });
  }

  protected setTableState(state: TableState) {
    this.tableState.set(state);
  }

  protected statusTone(status: AccountRow['status']): UiBadgeTone {
    return (
      {
        Active: 'success',
        'At risk': 'danger',
        Onboarding: 'info',
        Paused: 'warning',
      } as const
    )[status];
  }
}
