import { describe, expect, it } from 'vitest';
import { v2StoredPhone } from './phone-storage';

describe('v2StoredPhone', () => {
  it('follows the typed country code, not the showroom', () => {
    expect(v2StoredPhone('+380 67 214 58 03', 'warsaw')).toBe('+38 067 2145803');
    expect(v2StoredPhone('+48 601 334 812', 'kyiv')).toBe('+48 601 334 812');
  });

  it('uses the showroom when the code is missing and rejects incomplete numbers', () => {
    expect(v2StoredPhone('601334812', 'warsaw')).toBe('+48 601 334 812');
    expect(v2StoredPhone('+48 601', 'warsaw')).toBeNull();
  });
});
