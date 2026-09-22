import axe from 'axe-core';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { UiMenu, type UiMenuItem } from './ui-menu';

const items: readonly UiMenuItem[] = [
  { value: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { value: 'leads', label: 'Leads', icon: 'view_kanban', current: true },
  { value: 'disabled', label: 'Disabled', disabled: true },
];

@Component({
  imports: [UiMenu],
  template: `
    <app-ui-menu
      label="Leads"
      triggerIcon="view_kanban"
      align="start"
      [items]="items"
      (selected)="selection.set($event)"
    />
  `,
})
class MenuHost {
  readonly items = items;
  readonly selection = signal('');
}

describe('UiMenu', () => {
  it('renders a compact trigger with its leading icon', async () => {
    const fixture = TestBed.createComponent(MenuHost);
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector('.ui-menu__trigger') as HTMLButtonElement;

    expect(trigger.textContent).toContain('Leads');
    expect(trigger.querySelectorAll('app-ui-icon')).toHaveLength(2);
    expect(trigger.getAttribute('aria-haspopup')).toBe('true');
  });

  it('renders item icons and marks the current navigation destination', async () => {
    const fixture = TestBed.createComponent(MenuHost);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector('.ui-menu__trigger') as HTMLButtonElement;

    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const renderedItems = Array.from(element.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const current = renderedItems.find((item) => item.getAttribute('aria-current') === 'page');

    expect(renderedItems).toHaveLength(items.length);
    expect(current?.textContent).toContain('Leads');
    expect(current?.querySelector('app-ui-icon')).not.toBeNull();
  });

  it('emits the chosen command and passes an accessibility scan', async () => {
    const fixture = TestBed.createComponent(MenuHost);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector('.ui-menu__trigger') as HTMLButtonElement;

    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const dashboard = Array.from(element.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
      (item) => item.textContent?.includes('Dashboard'),
    );
    dashboard?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.selection()).toBe('dashboard');
    expect((await axe.run(element)).violations).toEqual([]);
  });
});
