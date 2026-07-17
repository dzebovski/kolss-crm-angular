import { computeRadialLayout } from './radial-menu.geometry';
import { CALL_ACTIONS, RADIAL_DEMO_VARIANTS } from './radial-menu.types';

describe('computeRadialLayout', () => {
  it('places every action center on the configured orbit', () => {
    const layout = computeRadialLayout(CALL_ACTIONS, {
      radiusRem: 12,
      gridWidthRem: 30,
      gridHeightRem: 23,
    });

    expect(layout.gridWidthRem).toBe(30);
    expect(layout.gridHeightRem).toBe(23);
    expect(layout.actions.map((action) => action.angleDeg)).toEqual([-90, -210, -330]);

    for (const action of layout.actions) {
      expect(Math.hypot(action.xRem, action.yRem)).toBeCloseTo(layout.radiusRem, 3);
    }
  });

  it('increases the automatic radius when seven actions need more chord space', () => {
    const fiveActions = RADIAL_DEMO_VARIANTS.find((variant) => variant.id === 'five-actions')!;
    const sevenActions = RADIAL_DEMO_VARIANTS.find((variant) => variant.id === 'seven-actions')!;
    const fiveActionLayout = computeRadialLayout(fiveActions.actions);
    const sevenActionLayout = computeRadialLayout(sevenActions.actions);

    expect(fiveActionLayout.radiusRem).toBe(12);
    expect(sevenActionLayout.radiusRem).toBeGreaterThan(fiveActionLayout.radiusRem);
    expect(sevenActionLayout.gridWidthRem).toBeGreaterThan(fiveActionLayout.gridWidthRem);
  });

  it('applies radius, angle, direction, and grid overrides', () => {
    const layout = computeRadialLayout(CALL_ACTIONS, {
      radiusRem: 9,
      startAngleDeg: 45,
      direction: 'clockwise',
      gridWidthRem: 24,
      gridHeightRem: 20,
    });

    expect(layout.radiusRem).toBe(9);
    expect(layout.gridWidthRem).toBe(24);
    expect(layout.gridHeightRem).toBe(20);
    expect(layout.actions.map((action) => action.angleDeg)).toEqual([45, 165, 285]);
  });
});
