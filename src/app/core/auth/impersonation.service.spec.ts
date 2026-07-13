import { TestBed } from '@angular/core/testing';

import { ImpersonationService } from './impersonation.service';
import { IMPERSONATION_STORAGE_KEY } from './impersonation.storage';

describe('ImpersonationService', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [ImpersonationService],
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('starts impersonation by writing sessionStorage', () => {
    const service = TestBed.inject(ImpersonationService);

    service.start('manager-42');

    expect(service.isActive()).toBe(true);
    expect(service.targetUserId()).toBe('manager-42');
    expect(sessionStorage.getItem(IMPERSONATION_STORAGE_KEY)).toBe('manager-42');
  });

  it('clears impersonation on stop', () => {
    const service = TestBed.inject(ImpersonationService);
    service.start('manager-42');

    service.stop();

    expect(service.isActive()).toBe(false);
    expect(service.targetUserId()).toBeNull();
    expect(sessionStorage.getItem(IMPERSONATION_STORAGE_KEY)).toBeNull();
  });

  it('ignores empty start values', () => {
    const service = TestBed.inject(ImpersonationService);
    service.start('manager-42');

    service.start('   ');

    expect(service.isActive()).toBe(false);
    expect(sessionStorage.getItem(IMPERSONATION_STORAGE_KEY)).toBeNull();
  });
});
