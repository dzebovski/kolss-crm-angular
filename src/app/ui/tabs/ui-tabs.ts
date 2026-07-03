import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { Component, input, model } from '@angular/core';

export interface UiTabItem {
  readonly value: string;
  readonly label: string;
  readonly content: string;
  readonly disabled?: boolean;
}

@Component({
  selector: 'app-ui-tabs',
  imports: [Tab, TabContent, TabList, TabPanel, Tabs],
  template: `
    <div ngTabs class="ui-tabs">
      <div
        ngTabList
        class="ui-tabs__list"
        selectionMode="follow"
        [selectedTab]="selected()"
        (selectedTabChange)="select($event)"
      >
        @for (tab of tabs(); track tab.value) {
          <button ngTab type="button" [value]="tab.value" [disabled]="tab.disabled ?? false">
            {{ tab.label }}
          </button>
        }
      </div>
      @for (tab of tabs(); track tab.value) {
        <div ngTabPanel class="ui-tabs__panel" [value]="tab.value">
          <ng-template ngTabContent>{{ tab.content }}</ng-template>
        </div>
      }
    </div>
  `,
  styles: `
    .ui-tabs__list {
      width: fit-content;
      padding: 0.2rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-subtle);
      display: flex;
      gap: 0.15rem;
    }

    button {
      min-height: 2rem;
      padding: 0 var(--ui-space-3);
      border: 0;
      border-radius: calc(var(--ui-radius-md) - 0.2rem);
      background: transparent;
      color: var(--ui-text-muted);
      cursor: pointer;
      font-size: 0.8125rem;
      font-weight: 600;
    }

    button[aria-selected='true'] {
      background: white;
      color: var(--ui-action);
      box-shadow: var(--ui-shadow-1);
    }

    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .ui-tabs__panel {
      padding: var(--ui-space-4) var(--ui-space-1);
      color: var(--ui-text-muted);
      font-size: 0.875rem;
    }

    .ui-tabs__panel[inert] {
      display: none;
    }
  `,
})
export class UiTabs {
  readonly tabs = input.required<readonly UiTabItem[]>();
  readonly selected = model<string>('');

  protected select(value: string | undefined) {
    if (value) {
      this.selected.set(value);
    }
  }
}
