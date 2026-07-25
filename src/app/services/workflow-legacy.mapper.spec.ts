import { toSimplifiedWorkflowStatus } from './workflow-legacy.mapper';

describe('toSimplifiedWorkflowStatus', () => {
  it('maps legacy workflow statuses to simplified model', () => {
    expect(toSimplifiedWorkflowStatus('showroom_scheduled')).toBe('visit_scheduled');
    expect(toSimplifiedWorkflowStatus('bad_lead')).toBe('closed');
    expect(toSimplifiedWorkflowStatus('taken')).toBe('taken');
  });
});
