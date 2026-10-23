import type { V2Client } from './client.types';
import {
  v2ClientApiPhone,
  v2ClientChanges,
  v2ClientFormFrom,
  v2MergeDifferingFields,
  v2MergeSides,
} from './client-form';

const client = (patch: Partial<V2Client> = {}): V2Client =>
  ({
    id: 'c1',
    code: 'W0218',
    name: 'Jakub Michalski',
    phone: '+48 609 145 882',
    officeId: 'warsaw',
    createdAt: '2026-06-16T10:00:00Z',
    rawPhone: '+48609145882',
    secondPhone: null,
    email: 'j.michalski@wp.pl',
    address: 'Legionowo',
    language: 'pl',
    about: null,
    ...patch,
  }) as V2Client;

describe('client form', () => {
  it('sends the compact phone only for a complete +48 / +380 number', () => {
    expect(v2ClientApiPhone('+48 609 145 882')).toBe('+48609145882');
    expect(v2ClientApiPhone('+380 67 214 58 03')).toBe('+380672145803');
    expect(v2ClientApiPhone('+48 609 14')).toBeNull();
    expect(v2ClientApiPhone('609145882')).toBeNull();
  });

  it('starts with no changes and sends only what differs', () => {
    const loaded = client();
    const form = v2ClientFormFrom(loaded);
    expect(v2ClientChanges(form, loaded)).toEqual({});
    expect(
      v2ClientChanges(
        { ...form, name: ' Jakub M. ', secondPhone: '+48 511 402 667', email: '', language: '' },
        loaded,
      ),
    ).toEqual({ name: 'Jakub M.', secondPhone: '+48511402667', email: null, language: null });
  });

  it('puts the older client first and lists only the differing fields', () => {
    const older = client();
    const newer = client({ id: 'c2', createdAt: '2026-09-25T10:00:00Z', address: 'Warszawa' });
    expect(v2MergeSides(newer, older)).toEqual({ older, newer });
    expect(v2MergeDifferingFields(older, newer)).toEqual(['address']);
  });
});
