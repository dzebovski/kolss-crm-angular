import { v2FormatPhoneInput, v2PhoneInfo, v2ValidatePhone } from './phone-mask';

describe('v2FormatPhoneInput', () => {
  it('groups a Polish number as 3-3-3 after +48', () => {
    expect(v2FormatPhoneInput('+48601334812', '+48')).toBe('+48 601 334 812');
  });

  it('groups a Ukrainian number as 2-3-2-2 after +380', () => {
    expect(v2FormatPhoneInput('+380672145803', '+380')).toBe('+380 67 214 58 03');
  });

  it('turns a local 0-prefixed shorthand into +380 (Popup-rules "067… becomes +380 67…")', () => {
    expect(v2FormatPhoneInput('0672145803', '+48')).toBe('+380 67 214 58 03');
  });

  it("adds the office's default code to a bare national number", () => {
    expect(v2FormatPhoneInput('601334812', '+48')).toBe('+48 601 334 812');
    expect(v2FormatPhoneInput('601334812', '+380')).toBe('+380 60 133 48 12');
  });

  it('returns an empty string for an empty value', () => {
    expect(v2FormatPhoneInput('', '+48')).toBe('');
  });
});

describe('v2PhoneInfo', () => {
  it('reports no recognised code for a number without +48/+380', () => {
    expect(v2PhoneInfo('123456')).toEqual({ cc: '', rest: '123456' });
  });

  it('splits the country code from the national digits', () => {
    expect(v2PhoneInfo('+48601334812')).toEqual({ cc: '+48', rest: '601334812' });
  });
});

describe('v2ValidatePhone', () => {
  it('flags an empty value as required', () => {
    expect(v2ValidatePhone('')).toEqual({ kind: 'empty' });
  });

  it('flags a value with no recognised country code', () => {
    expect(v2ValidatePhone('601 33')).toEqual({ kind: 'noCode' });
  });

  it('counts the missing digits for an incomplete number (Popup-rules example: 601 33 → 4 more)', () => {
    expect(v2ValidatePhone('+48 601 33')).toEqual({ kind: 'incomplete', missingDigits: 4 });
  });

  it('accepts a full 9-digit national number', () => {
    expect(v2ValidatePhone('+48 601 334 812')).toEqual({ kind: 'ok' });
  });
});
