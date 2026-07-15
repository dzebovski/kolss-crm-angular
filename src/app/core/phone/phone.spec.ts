import { formatPhoneDisplay, normalizePhoneForOffice } from './phone';

describe('normalizePhoneForOffice (kyiv)', () => {
  it.each([
    ['0504113144', '+38 050 4113144'],
    ['+380 50 411 31 44', '+38 050 4113144'],
    ['380504113144', '+38 050 4113144'],
    ['38 050 4113144', '+38 050 4113144'],
    ['(067) 214-88-19', '+38 067 2148819'],
    ['0672148819', '+38 067 2148819'],
    ['672148819', '+38 067 2148819'],
  ])('normalizes %s', (raw, expected) => {
    expect(normalizePhoneForOffice(raw, 'kyiv')).toBe(expected);
  });

  it('returns null for empty or invalid values', () => {
    expect(normalizePhoneForOffice('', 'kyiv')).toBeNull();
    expect(normalizePhoneForOffice('—', 'kyiv')).toBeNull();
    expect(normalizePhoneForOffice('123', 'kyiv')).toBeNull();
    expect(normalizePhoneForOffice(null, 'kyiv')).toBeNull();
  });
});

describe('normalizePhoneForOffice (warsaw)', () => {
  it.each([
    ['501223118', '+48 501 223 118'],
    ['+48 501 223 118', '+48 501 223 118'],
    ['48501223118', '+48 501 223 118'],
  ])('normalizes %s', (raw, expected) => {
    expect(normalizePhoneForOffice(raw, 'warsaw')).toBe(expected);
  });

  it('returns null for invalid polish numbers', () => {
    expect(normalizePhoneForOffice('123', 'warsaw')).toBeNull();
  });
});

describe('formatPhoneDisplay', () => {
  it('formats UA numbers to +38 XXX XXXXXXX', () => {
    expect(formatPhoneDisplay('+380501112233', 'kyiv')).toBe('+38 050 1112233');
    expect(formatPhoneDisplay('0931184402')).toBe('+38 093 1184402');
  });

  it('formats PL numbers to +48 XXX XXX XXX', () => {
    expect(formatPhoneDisplay('+48501223118', 'warsaw')).toBe('+48 501 223 118');
    expect(formatPhoneDisplay('501223118')).toBe('+48 501 223 118');
  });

  it('keeps em dash and falls back to raw when incomplete', () => {
    expect(formatPhoneDisplay('—')).toBe('—');
    expect(formatPhoneDisplay(null)).toBe('—');
    expect(formatPhoneDisplay('12', 'kyiv')).toBe('12');
  });
});
