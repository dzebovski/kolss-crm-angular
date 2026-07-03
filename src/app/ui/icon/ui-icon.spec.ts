import { TestBed } from '@angular/core/testing';
import { UiIcon } from './ui-icon';
import { UI_ICON_PATHS, UiIconName } from './ui-icon.registry';

describe('UiIcon', () => {
  it('renders every registered name as SVG without ligature text', async () => {
    const names = Object.keys(UI_ICON_PATHS) as UiIconName[];

    for (const name of names) {
      const fixture = TestBed.createComponent(UiIcon);
      fixture.componentRef.setInput('name', name);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('svg')).toBeTruthy();
      expect(element.querySelector('path')?.getAttribute('d')).toBe(UI_ICON_PATHS[name].outline);
      expect(element.textContent?.trim()).toBe('');
    }
  });

  it('applies accessible semantics only when a label is provided', async () => {
    const fixture = TestBed.createComponent(UiIcon);
    fixture.componentRef.setInput('name', 'search');
    await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');

    fixture.componentRef.setInput('label', 'Search');
    await fixture.whenStable();
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Search');
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
  });

  it('uses the filled path when the icon provides one', async () => {
    const fixture = TestBed.createComponent(UiIcon);
    fixture.componentRef.setInput('name', 'check_circle');
    fixture.componentRef.setInput('filled', true);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('path')?.getAttribute('d')).toBe(
      UI_ICON_PATHS.check_circle.filled,
    );
  });

  it('keeps the requested control sizes pixel-aligned', async () => {
    const fixture = TestBed.createComponent(UiIcon);
    fixture.componentRef.setInput('name', 'search');

    for (const size of [16, 18, 20, 24]) {
      fixture.componentRef.setInput('size', size);
      await fixture.whenStable();
      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg.style.width).toBe(`${size}px`);
      expect(svg.style.height).toBe(`${size}px`);
    }
  });
});
