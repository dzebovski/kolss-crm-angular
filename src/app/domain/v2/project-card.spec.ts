import { v2ProjectDay, v2ProjectRestoreStatus } from './project-card';

describe('v2ProjectDay', () => {
  it('builds a local date without a UTC shift', () => {
    const day = v2ProjectDay('2026-09-29');
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 8, 29]);
  });
});

describe('v2ProjectRestoreStatus', () => {
  it('returns a closed project to its previous stage, or the first one', () => {
    const closed = (previousStatus: 'factory_approval' | null) => ({
      status: 'cancelled' as const,
      cancellation: { previousStatus },
    });
    expect(v2ProjectRestoreStatus(closed('factory_approval'))).toBe('factory_approval');
    expect(v2ProjectRestoreStatus(closed(null))).toBe('preliminary_estimate');
  });

  it('returns a completed project to installation', () => {
    expect(v2ProjectRestoreStatus({ status: 'completed', cancellation: null })).toBe(
      'installation',
    );
  });
});
