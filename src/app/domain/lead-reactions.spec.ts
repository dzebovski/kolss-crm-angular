import { FIXTURE_LEADS } from '@testing/fixtures/leads.fixture';
import { leadHasAnyReaction, sortLeadsByActivity, withUserReaction } from './lead-reactions';
import type { LeadReaction } from './lead.types';

describe('lead reactions', () => {
  const me = { id: 'u-1', name: 'Я' };
  const star: LeadReaction = { kind: 'star', count: 1, userIds: ['u-2'], userNames: ['Олена'] };

  it("adds my reaction next to someone else's and keeps canonical kind order", () => {
    const like = withUserReaction([star], 'like', me, true);
    expect(like.map((reaction) => reaction.kind)).toEqual(['like', 'star']);

    const both = withUserReaction(like, 'star', me, true);
    expect(both[1]).toEqual({
      kind: 'star',
      count: 2,
      userIds: ['u-2', 'u-1'],
      userNames: ['Олена', 'Я'],
    });
  });

  it('removes only my reaction and drops a kind nobody uses any more', () => {
    const both = withUserReaction([star], 'star', me, true);
    expect(withUserReaction(both, 'star', me, false)).toEqual([star]);
    expect(withUserReaction(withUserReaction([], 'like', me, true), 'like', me, false)).toEqual([]);
  });

  it('filters by any of the selected kinds, empty selection = everything', () => {
    const lead = { ...FIXTURE_LEADS[0]!, reactions: [star] };
    expect(leadHasAnyReaction(lead, [])).toBe(true);
    expect(leadHasAnyReaction(lead, ['like', 'star'])).toBe(true);
    expect(leadHasAnyReaction(lead, ['question'])).toBe(false);
  });

  it('sorts by last activity, newest first', () => {
    const a = { ...FIXTURE_LEADS[0]!, id: 'a', lastActivityAt: '2026-07-01T00:00:00.000Z' };
    const b = { ...FIXTURE_LEADS[1]!, id: 'b', lastActivityAt: '2026-07-05T00:00:00.000Z' };
    expect(sortLeadsByActivity([a, b]).map((lead) => lead.id)).toEqual(['b', 'a']);
  });
});
