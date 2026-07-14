import { describe, expect, it } from 'vitest';

import type { LocaleCode } from '../../services/crm-mock.types';
import {
  isLegacySystemComment,
  isUserCommentEventType,
  presentEventBody,
  presentEventTitle,
} from './event-presenter';

describe('event-presenter', () => {
  it('renders manager comment as-is for user events', () => {
    const body = presentEventBody(
      {
        event_type: 'comment',
        comment: 'Клієнт обрав іншого постачальника',
        new_value: null,
      },
      'pl',
    );
    expect(body).toBe('Клієнт обрав іншого постачальника');
  });

  it('translates event title by locale without changing comment body', () => {
    const locales: LocaleCode[] = ['uk', 'pl', 'en'];
    const titles = locales.map((locale) => presentEventTitle('taken', locale));
    expect(titles[0]).toContain('взято');
    expect(titles[1]).toContain('przej');
    expect(titles[2]).toContain('taken');

    const body = presentEventBody(
      {
        event_type: 'contact_attempt',
        comment: 'Менеджерський коментар',
        new_value: { result: 'reached' },
      },
      'en',
    );
    expect(body).toBe('Менеджерський коментар');
  });

  it('ignores legacy system comment on taken events', () => {
    expect(isLegacySystemComment('Лід взято в роботу')).toBe(true);
    const body = presentEventBody(
      {
        event_type: 'taken',
        comment: 'Лід взято в роботу',
        new_value: null,
      },
      'uk',
    );
    expect(body).toBe('');
  });

  it('classifies user comment event types', () => {
    expect(isUserCommentEventType('comment')).toBe(true);
    expect(isUserCommentEventType('lead_updated')).toBe(false);
  });

  it('does not throw for created event with unknown source', () => {
    expect(() =>
      presentEventBody(
        {
          event_type: 'created',
          comment: 'Лід створено вручну.',
          new_value: { source: 'legacy_channel' },
        },
        'uk',
      ),
    ).not.toThrow();

    const body = presentEventBody(
      {
        event_type: 'created',
        comment: 'Лід створено вручну.',
        new_value: { source: 'legacy_channel' },
      },
      'uk',
    );
    expect(body).toContain('legacy_channel');
  });
});
