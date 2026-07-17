import { RadialAction, RadialDirection, RadialLayoutConfig } from './radial-menu.types';

const ACTION_WIDTH_REM = 11;
const ACTION_HEIGHT_REM = 4.25;
const ACTION_GAP_REM = 1;
const MIN_RADIUS_REM = 12;
const MOBILE_RADIUS_REM = 9;
const DEFAULT_START_ANGLE_DEG = -90;

export interface PositionedRadialAction<TId extends string = string> extends RadialAction<TId> {
  readonly angleDeg: number;
  readonly xRem: number;
  readonly yRem: number;
  readonly mobileXRem: number;
  readonly mobileYRem: number;
  readonly animationDelayMs: number;
}

export interface ResolvedRadialLayout<TId extends string = string> {
  readonly radiusRem: number;
  readonly gridWidthRem: number;
  readonly gridHeightRem: number;
  readonly actions: readonly PositionedRadialAction<TId>[];
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function directionMultiplier(direction: RadialDirection | undefined): number {
  return direction === 'clockwise' ? 1 : -1;
}

function automaticRadius(actionCount: number): number {
  if (actionCount < 2) return MIN_RADIUS_REM;

  const chordRadius = (ACTION_WIDTH_REM + ACTION_GAP_REM) / (2 * Math.sin(Math.PI / actionCount));
  return Math.max(MIN_RADIUS_REM, chordRadius);
}

export function computeRadialLayout<TId extends string>(
  actions: readonly RadialAction<TId>[],
  config: RadialLayoutConfig = {},
): ResolvedRadialLayout<TId> {
  const radiusRem = config.radiusRem ?? automaticRadius(actions.length);
  const startAngleDeg = config.startAngleDeg ?? DEFAULT_START_ANGLE_DEG;
  const direction = directionMultiplier(config.direction);
  const angleStepDeg = actions.length > 0 ? 360 / actions.length : 0;

  return {
    radiusRem: round(radiusRem),
    gridWidthRem: round(
      config.gridWidthRem ?? radiusRem * 2 + ACTION_WIDTH_REM + ACTION_GAP_REM * 2,
    ),
    gridHeightRem: round(
      config.gridHeightRem ?? radiusRem * 2 + ACTION_HEIGHT_REM + ACTION_GAP_REM * 2,
    ),
    actions: actions.map((action, index) => {
      const angleDeg = startAngleDeg + direction * angleStepDeg * index;
      const angleRad = (angleDeg * Math.PI) / 180;

      return {
        ...action,
        angleDeg: round(angleDeg),
        xRem: round(Math.cos(angleRad) * radiusRem),
        yRem: round(Math.sin(angleRad) * radiusRem),
        mobileXRem: round(Math.cos(angleRad) * MOBILE_RADIUS_REM),
        mobileYRem: round(Math.sin(angleRad) * MOBILE_RADIUS_REM),
        animationDelayMs: 40 + index * 45,
      };
    }),
  };
}
