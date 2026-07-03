import { Component, computed, input, model, signal } from '@angular/core';
import { UiBadge, UiBadgeTone } from '../feedback/ui-badge';
import { UiIcon, UiIconName } from '../icon/ui-icon';
import { UiPagination } from '../pagination/ui-pagination';

export interface UiTableColumn<T> {
  readonly key: keyof T & string;
  readonly label: string;
  readonly sortable?: boolean;
  readonly width?: string;
  readonly badge?: boolean;
  readonly tone?: (row: T) => UiBadgeTone;
  readonly format?: (value: T[keyof T], row: T) => string;
}

type RowKey = string | number;
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-ui-data-table',
  imports: [UiBadge, UiIcon, UiPagination],
  template: `
    <section class="ui-table" [class.ui-table--compact]="density() === 'compact'">
      <div class="ui-table__toolbar">
        <label class="ui-table__search">
          <span class="visually-hidden">Search records</span>
          <app-ui-icon name="search" [size]="18" />
          <input
            type="search"
            placeholder="Search records..."
            [value]="query()"
            (input)="updateQuery($event)"
          />
        </label>
        <span class="ui-table__count">{{ filteredRows().length }} records</span>
      </div>

      <div class="ui-table__viewport">
        <table>
          <thead>
            <tr>
              <th class="ui-table__select">
                <input
                  type="checkbox"
                  aria-label="Select all visible rows"
                  [checked]="allVisibleSelected()"
                  (change)="toggleVisible($event)"
                />
              </th>
              @for (column of columns(); track column.key) {
                <th [style.width]="column.width ?? null" [attr.aria-sort]="ariaSort(column)">
                  @if (column.sortable) {
                    <button type="button" (click)="sort(column.key)">
                      {{ column.label }}
                      <app-ui-icon [name]="sortIcon(column.key)" [size]="16" />
                    </button>
                  } @else {
                    {{ column.label }}
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (row of skeletonRows; track row) {
                <tr class="ui-table__skeleton">
                  <td [attr.colspan]="columns().length + 1"><span></span></td>
                </tr>
              }
            } @else if (error()) {
              <tr>
                <td class="ui-table__state" [attr.colspan]="columns().length + 1">
                  <app-ui-icon name="error" [size]="24" />
                  <strong>Could not load records</strong>
                  <span>{{ error() }}</span>
                </td>
              </tr>
            } @else if (!pagedRows().length) {
              <tr>
                <td class="ui-table__state" [attr.colspan]="columns().length + 1">
                  <app-ui-icon name="inbox" [size]="24" />
                  <strong>No matching records</strong>
                  <span>Try changing the current search.</span>
                </td>
              </tr>
            } @else {
              @for (row of pagedRows(); track rowKey()(row)) {
                <tr [class.ui-table__row--selected]="isSelected(row)">
                  <td class="ui-table__select">
                    <input
                      type="checkbox"
                      [attr.aria-label]="'Select ' + rowLabel()(row)"
                      [checked]="isSelected(row)"
                      (change)="toggleRow(row)"
                    />
                  </td>
                  @for (column of columns(); track column.key) {
                    <td>
                      @if (column.badge) {
                        <app-ui-badge [tone]="column.tone?.(row) ?? 'neutral'">
                          {{ displayCell(row, column) }}
                        </app-ui-badge>
                      } @else {
                        {{ displayCell(row, column) }}
                      }
                    </td>
                  }
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <footer class="ui-table__footer">
        <span>{{ selection().length }} selected</span>
        <app-ui-pagination
          [page]="page()"
          [pageSize]="pageSize()"
          [total]="filteredRows().length"
          (pageChange)="page.set($event)"
        />
      </footer>
    </section>
  `,
  styleUrl: './ui-data-table.scss',
})
export class UiDataTable<T extends object> {
  readonly rows = input.required<readonly T[]>();
  readonly columns = input.required<readonly UiTableColumn<T>[]>();
  readonly rowKey = input.required<(row: T) => RowKey>();
  readonly rowLabel = input<(row: T) => string>((row) => String(this.rowKey()(row)));
  readonly density = input<'comfortable' | 'compact'>('comfortable');
  readonly pageSize = input(5);
  readonly loading = input(false);
  readonly error = input('');
  readonly selection = model<readonly RowKey[]>([]);
  protected readonly query = signal('');
  protected readonly page = signal(0);
  protected readonly sortKey = signal<string | undefined>(undefined);
  protected readonly sortDirection = signal<SortDirection>('asc');
  protected readonly skeletonRows = [1, 2, 3];

  protected readonly filteredRows = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    if (!query) return [...this.rows()];
    return this.rows().filter((row) =>
      this.columns().some((column) =>
        this.displayCell(row, column).toLocaleLowerCase().includes(query),
      ),
    );
  });

  protected readonly sortedRows = computed(() => {
    const rows = [...this.filteredRows()];
    const key = this.sortKey();
    if (!key) return rows;
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return rows.sort(
      (left, right) =>
        String(left[key as keyof T]).localeCompare(String(right[key as keyof T]), undefined, {
          numeric: true,
        }) * direction,
    );
  });

  protected readonly pagedRows = computed(() => {
    const start = this.page() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });

  protected readonly allVisibleSelected = computed(
    () => this.pagedRows().length > 0 && this.pagedRows().every((row) => this.isSelected(row)),
  );

  protected updateQuery(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
    this.page.set(0);
  }

  protected sort(key: string) {
    if (this.sortKey() === key) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
  }

  protected sortIcon(key: string): UiIconName {
    if (this.sortKey() !== key) return 'unfold_more';
    return this.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  protected ariaSort(column: UiTableColumn<T>) {
    if (this.sortKey() !== column.key) return column.sortable ? 'none' : null;
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  protected displayCell(row: T, column: UiTableColumn<T>) {
    const value = row[column.key];
    return column.format ? column.format(value, row) : String(value ?? '—');
  }

  protected isSelected(row: T) {
    return this.selection().includes(this.rowKey()(row));
  }

  protected toggleRow(row: T) {
    const key = this.rowKey()(row);
    this.selection.update((selection) =>
      selection.includes(key) ? selection.filter((item) => item !== key) : [...selection, key],
    );
  }

  protected toggleVisible(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const visibleKeys = this.pagedRows().map((row) => this.rowKey()(row));
    this.selection.update((selection) => {
      const remaining = selection.filter((key) => !visibleKeys.includes(key));
      return checked ? [...remaining, ...visibleKeys] : remaining;
    });
  }
}
