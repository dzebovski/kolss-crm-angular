import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { UiModal } from './ui-modal';

@Component({
  imports: [UiModal],
  template: `
    <app-ui-modal labelledBy="test-title" (dismissed)="dismissed = true">
      <h2 id="test-title">Test</h2>
    </app-ui-modal>
  `,
})
class HostComponent {
  dismissed = false;
}

describe('UiModal', () => {
  it('emits dismissed when backdrop is clicked', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.ui-modal-backdrop') as HTMLElement;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.dismissed).toBe(true);
  });

  it('does not emit dismissed when modal content is clicked', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('.ui-modal') as HTMLElement;
    modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.dismissed).toBe(false);
  });
});
