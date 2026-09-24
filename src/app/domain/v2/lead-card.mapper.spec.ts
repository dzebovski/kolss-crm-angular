import {
  formatV2Budget,
  joinV2Name,
  splitV2Name,
  v2Initials,
  v2LeadColumnsFromRow,
} from './lead-card.mapper';

describe('v2 lead card mapper', () => {
  it('reads the v2 columns and drops unknown values', () => {
    const columns = v2LeadColumnsFromRow({
      v2_status: 'invited',
      rating: 'warm',
      channel: 'meta_ads',
      no_answer_attempts: 2,
      estimated_budget_text: ' 20 000 – 25 000 ',
      products: ['bathroom', 'boat', 'kitchen'],
    });
    expect(columns).toEqual({
      v2Status: 'invited',
      v2StatusChangedAt: null,
      rating: null,
      channel: 'meta_ads',
      noAnswerAttempts: 2,
      estimatedBudgetText: '20 000 – 25 000',
      products: ['kitchen', 'bathroom'],
      materialFronts: null,
      materialWorktop: null,
      materialAppliances: null,
      expectedLeadTime: null,
      preferredMeasurementAt: null,
    });
  });

  it('works for a row without the v2 columns', () => {
    expect(v2LeadColumnsFromRow({ id: 'x' })).toEqual({
      v2Status: null,
      v2StatusChangedAt: null,
      rating: null,
      channel: null,
      noAnswerAttempts: 0,
      estimatedBudgetText: null,
      products: [],
      materialFronts: null,
      materialWorktop: null,
      materialAppliances: null,
      expectedLeadTime: null,
      preferredMeasurementAt: null,
    });
  });

  it('splits and joins the name for Edit contact info', () => {
    expect(splitV2Name('Olena  Kowal-Nowak Maria')).toEqual({
      first: 'Olena',
      last: 'Kowal-Nowak Maria',
    });
    expect(splitV2Name('Tomasz')).toEqual({ first: 'Tomasz', last: '' });
    expect(joinV2Name(' Olena ', '')).toBe('Olena');
    expect(joinV2Name('Olena', 'Kowal')).toBe('Olena Kowal');
  });

  it('builds initials from the first and last word', () => {
    expect(v2Initials('olena maria kowal')).toBe('OK');
    expect(v2Initials('Tomasz')).toBe('T');
    expect(v2Initials('')).toBe('');
  });

  it('writes the budget with the currency sign after the amount', () => {
    expect(formatV2Budget({ amount: '22 000 – 25 000', currency: 'PLN' }, 'en')).toBe(
      '22 000 – 25 000 zł',
    );
  });
});
