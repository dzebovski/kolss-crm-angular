import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { LeadDetailPage } from './lead-detail-page';

describe('LeadDetailPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadDetailPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ leadId: 'lead-1007' }),
            },
          },
        },
      ],
    }).compileComponents();
  });

  it('renders successful terminal state for a converted lead', async () => {
    const fixture = TestBed.createComponent(LeadDetailPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Катерина Савчук');
    expect(element.textContent).toContain('Лід успішно завершено');
    expect(element.textContent).toContain('K-KY-2026-0618');
  });
});
