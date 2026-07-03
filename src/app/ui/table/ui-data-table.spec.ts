import { TestBed } from '@angular/core/testing';
import { UiDataTable, UiTableColumn } from './ui-data-table';

interface TestRow {
  id: number;
  name: string;
  status: string;
}

describe('UiDataTable', () => {
  const rows: readonly TestRow[] = [
    { id: 1, name: 'Zephyr', status: 'Active' },
    { id: 2, name: 'Aperture', status: 'Paused' },
  ];
  const columns: readonly UiTableColumn<TestRow>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status' },
  ];

  function createTable() {
    const fixture = TestBed.createComponent(UiDataTable<TestRow>);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('rowKey', (row: TestRow) => row.id);
    fixture.componentRef.setInput('rowLabel', (row: TestRow) => row.name);
    return fixture;
  }

  it('filters, sorts and selects client-side rows', async () => {
    const fixture = createTable();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const search = element.querySelector<HTMLInputElement>('input[type="search"]')!;
    const searchIcon = element.querySelector('.ui-table__search app-ui-icon');

    expect(searchIcon?.querySelector('svg')).toBeTruthy();
    expect(searchIcon?.textContent?.trim()).toBe('');

    search.value = 'Aperture';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(element.querySelector('tbody')?.textContent).toContain('Aperture');

    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    const sortButton = element.querySelector<HTMLButtonElement>('th button')!;
    sortButton.click();
    await fixture.whenStable();
    expect(element.querySelector('tbody tr td:nth-child(2)')?.textContent).toContain('Aperture');

    const rowCheckboxes = element.querySelectorAll<HTMLInputElement>(
      'tbody input[type="checkbox"]',
    );
    rowCheckboxes[0].click();
    await fixture.whenStable();
    expect(element.querySelector('.ui-table__footer')?.textContent).toContain('1 selected');
  });

  it('renders loading, empty and error states', async () => {
    const fixture = createTable();
    fixture.componentRef.setInput('loading', true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.ui-table__skeleton')).toHaveLength(3);

    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('rows', []);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No matching records');

    fixture.componentRef.setInput('error', 'Offline');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Could not load records');
  });
});
