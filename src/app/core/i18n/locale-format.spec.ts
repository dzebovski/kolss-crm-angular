import { formatShortDateForLocale } from './locale-format';

describe('formatShortDateForLocale', () => {
  it.each([
    ['uk', '22.07'],
    ['pl', '22.07'],
    ['en', '22/07'],
  ] as const)('formats %s without a year', (locale, expected) => {
    const formatted = formatShortDateForLocale('2026-07-22T12:00:00.000Z', locale);

    expect(formatted).toBe(expected);
    expect(formatted).not.toContain('2026');
  });
});
