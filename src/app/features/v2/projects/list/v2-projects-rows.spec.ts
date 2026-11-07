import { formatV2ProjectSchedule, joinV2ProductLabels } from './v2-projects-rows';

describe('v2 projects list rows', () => {
  const now = new Date(2026, 8, 28, 11, 20);

  it('names today, tomorrow and yesterday, then follows the card date rule', () => {
    expect(formatV2ProjectSchedule({ date: '2026-09-28', time: null }, now, 'en')).toBe('Today');
    expect(formatV2ProjectSchedule({ date: '2026-09-29', time: '10:00' }, now, 'en')).toBe(
      'Tomorrow, 10:00',
    );
    expect(formatV2ProjectSchedule({ date: '2026-09-27', time: '15:00:00' }, now, 'en')).toBe(
      'Yesterday, 15:00',
    );
    expect(formatV2ProjectSchedule({ date: '2026-10-01', time: null }, now, 'en')).toBe(
      'Thu 1 Oct',
    );
    expect(formatV2ProjectSchedule({ date: '2026-10-12', time: null }, now, 'en')).toBe('12/10');
  });

  it('joins products with a plus sign and lower-cases all but the first', () => {
    expect(joinV2ProductLabels(['Kitchen', 'Wardrobe'])).toBe('Kitchen + wardrobe');
    expect(joinV2ProductLabels(['Hallway'])).toBe('Hallway');
    expect(joinV2ProductLabels([])).toBe('');
  });
});
