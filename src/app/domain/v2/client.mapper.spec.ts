import type { ClientSummary } from '@core/api/generated/kolss-api.types';
import { toV2ClientListItem, toV2ClientListPage } from './client.mapper';

const summary = (patch: Partial<ClientSummary> = {}): ClientSummary => ({
  id: 'c1',
  code: 'w0231',
  name: 'Marta Zielińska',
  phone: '+48601334812',
  secondPhone: null,
  email: null,
  officeId: 'o1',
  office: { id: 'o1', code: 'warsaw', nameUk: 'Легіонова', namePl: 'Legionowo' },
  createdAt: '2026-09-24T10:00:00Z',
  firstChannel: 'office',
  leadsCount: 1,
  projectsCount: 0,
  manager: null,
  ...patch,
});

describe('toV2ClientListItem', () => {
  it('shows the code upper-case and the phone in display form', () => {
    const item = toV2ClientListItem(summary());
    expect(item.code).toBe('W0231');
    expect(item.phone).toBe('+48 601 334 812');
    expect(item.officeId).toBe('warsaw');
  });

  it('marks a client with several leads as returning and names the manager', () => {
    const item = toV2ClientListItem(
      summary({ leadsCount: 2, manager: { id: 'm1', name: 'Kasia Nowak' } }),
    );
    expect(item.returning).toBe(true);
    expect(item.managerName).toBe('Kasia Nowak');
    expect(toV2ClientListItem(summary()).returning).toBe(false);
  });

  it('shows a dash for a client without a phone', () => {
    expect(toV2ClientListItem(summary({ phone: null })).phone).toBe('—');
  });
});

describe('toV2ClientListPage', () => {
  it('turns an empty cursor into null', () => {
    expect(toV2ClientListPage({ items: [], nextCursor: '' }).nextCursor).toBeNull();
    expect(toV2ClientListPage({ items: [], nextCursor: 'abc' }).nextCursor).toBe('abc');
  });
});
