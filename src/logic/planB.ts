import type { BusPhase, CrowdLevel, PlanB } from '../contracts/types';
import { CONFIG } from '../contracts/config';

export interface PlanBCtx {
  phase: BusPhase;
  crowd: CrowdLevel;
  /** Real seconds the bus has been parked at its stop. Null when it is not waiting. */
  standby_sec: number | null;
  /** Schedule headway, used as "next bus in about N minutes". */
  headway_min: number;
  /**
   * True when the commuter cannot catch this bus, even if the bus has not
   * formally "passed" them — e.g. it is parked at their stop and about to go.
   * Defaults to `phase === 'passed'`.
   */
  missed?: boolean;
  /** Walking time to the final destination, seconds. Null when we do not know it. */
  walk_sec_to_dest?: number | null;
  /** Riding time to the final destination, seconds. Null when we do not know it. */
  ride_sec_to_dest?: number | null;
  /** Seconds from now until the commuter's deadline. Null when they gave no time. */
  time_left_sec?: number | null;
}

/**
 * Rules-only Plan B. Runs first, always available, never calls the network.
 *
 * Precedence is deliberate: a bus you cannot catch at all outranks why you cannot
 * catch it, so no_signal > passed > full > delayed. Returns null when nothing is wrong.
 */
export function planB(ctx: PlanBCtx): PlanB | null {
  const missed = ctx.missed ?? ctx.phase === 'passed';

  if (ctx.phase === 'no_signal') {
    return {
      kind: 'next_bus',
      minutes: ctx.headway_min,
      reason: 'no_signal',
      decided_by: 'rules',
    };
  }

  if (missed) {
    return {
      kind: 'next_bus',
      minutes: ctx.headway_min,
      reason: 'missed',
      decided_by: 'rules',
    };
  }

  if (ctx.crowd === 'full') {
    return {
      kind: 'next_bus',
      minutes: ctx.headway_min,
      reason: 'full',
      decided_by: 'rules',
    };
  }

  if (ctx.phase === 'standby' && ctx.standby_sec !== null && ctx.standby_sec > CONFIG.DELAY_STANDBY_SEC) {
    return pickDelayedOption(ctx);
  }

  return null;
}

/**
 * Delayed at a stop: walk by default, but switch to a ride when walking would
 * blow the deadline and a car would not. Deterministic, so tests can pin it.
 */
function pickDelayedOption(ctx: PlanBCtx): PlanB {
  const walkSec = ctx.walk_sec_to_dest ?? null;
  const rideSec = ctx.ride_sec_to_dest ?? null;
  const timeLeftSec = ctx.time_left_sec ?? null;

  const walkMakesIt =
    walkSec !== null && timeLeftSec !== null && walkSec <= timeLeftSec;
  const rideMakesIt =
    rideSec !== null && timeLeftSec !== null && rideSec <= timeLeftSec;

  if (walkSec !== null && !walkMakesIt && rideMakesIt) {
    return {
      kind: 'ride_hail',
      minutes: Math.max(1, Math.round(rideSec / 60)),
      reason: 'delayed',
      decided_by: 'rules',
    };
  }

  return {
    kind: 'walk',
    minutes: walkSec !== null ? Math.max(1, Math.round(walkSec / 60)) : null,
    reason: 'delayed',
    decided_by: 'rules',
  };
}
