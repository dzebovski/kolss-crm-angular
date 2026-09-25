import { v2IsValidEmailInput } from './email-check';

describe('v2IsValidEmailInput', () => {
  it('accepts an empty value (email is optional everywhere)', () => {
    expect(v2IsValidEmailInput('')).toBe(true);
    expect(v2IsValidEmailInput('   ')).toBe(true);
  });

  it('accepts name@example.com', () => {
    expect(v2IsValidEmailInput('marta.zielinska@gmail.com')).toBe(true);
  });

  it('rejects a value with no top-level domain (Create-lead-errors.dc.html "anna.melnyk@gmail")', () => {
    expect(v2IsValidEmailInput('anna.melnyk@gmail')).toBe(false);
  });

  it('rejects a value with no @', () => {
    expect(v2IsValidEmailInput('not-an-email')).toBe(false);
  });
});
