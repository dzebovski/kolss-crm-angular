import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import type { CrmEmployee } from '@services/users.service';
import { UiMultiSelect } from '@ui/form/ui-multi-select';
import { LeadQuestionDialog } from './lead-question-dialog';

const employees: readonly CrmEmployee[] = [
  {
    id: 'member-kyiv',
    email: null,
    displayName: 'Kyiv member',
    role: 'office_member',
    officeIds: ['kyiv'],
    officeUuids: [],
    status: 'active',
    createdAt: '',
    lastActiveAt: '',
  },
  {
    id: 'member-warsaw',
    email: null,
    displayName: 'Warsaw member',
    role: 'office_member',
    officeIds: ['warsaw'],
    officeUuids: [],
    status: 'active',
    createdAt: '',
    lastActiveAt: '',
  },
  {
    id: 'admin-kyiv',
    email: null,
    displayName: 'Kyiv admin',
    role: 'office_admin',
    officeIds: ['kyiv'],
    officeUuids: [],
    status: 'active',
    createdAt: '',
    lastActiveAt: '',
  },
];

describe('LeadQuestionDialog', () => {
  it('offers only active office members from the lead office as assignees', async () => {
    await TestBed.configureTestingModule({
      imports: [LeadQuestionDialog],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: { employees, officeCode: 'kyiv' },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: KolssApiClient, useValue: { translateText: vi.fn() } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LeadQuestionDialog);
    await fixture.whenStable();

    const picker = fixture.debugElement.query(
      (node) => node.componentInstance instanceof UiMultiSelect,
    ).componentInstance as UiMultiSelect;
    expect(picker.options()).toEqual([{ value: 'member-kyiv', label: 'Kyiv member' }]);
  });
});
