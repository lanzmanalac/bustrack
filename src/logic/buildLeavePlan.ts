import type {
  BusPhase,
  BusStatus,
  CrowdLevel,
  LatLng,
  LeavePlan,
  RiderReport,
  Stop,
} from '../contracts/types';
import { CONFIG } from '../contracts/config';
import { realNowMs } from '../contracts/clock';
import { nearestStop, walkSeconds } from './geo';
import { busEtaSeconds, dataAgeSeconds, standbySeconds } from './eta';
import { confidence, crowdLevel, urgencyFor } from './evaluate';
import { planB } from './planB';

export interface BuildLeavePlanInput {
  nowMs?: number;
  stops: readonly Stop[];
  headway_min: number;
  /** Real GPS position, or null when permission was denied. */
  user: LatLng | null;
  /** An explicitly picked stop wins over the nearest one. */
  userStop?: Stop | null;
  /** Null means no bus row at all -> schedule fallback. */
  bus: BusStatus | null;
  reports: readonly RiderReport[];
  /** Trip extras for the deadline check and the delayed Plan B. */
  walkSecToDest?: number | null;
  rideSecToDest?: number | null;
  timeLeftSec?: number | null;
}

/**
 * Turns raw bus data into the one number the whole app exists for.
 *
 * Every branch is honest about what we do not know: no bus, an offline bus, or a
 * bus that already went past all resolve to a schedule estimate with low
 * confidence rather than an invented arrival time.
 */
export function buildLeavePlan(input: BuildLeavePlanInput): LeavePlan {
  const nowMs = input.nowMs ?? realNowMs();
  const { stops, reports } = input;

  const userStop = resolveUserStop(input.userStop, input.user, stops);
  const walk_sec = userStop === null ? 0 : walkToStop(input.user, userStop);

  const bus = input.bus;
  const isUnusable = bus === null || bus.status === 'offline';

  if (isUnusable || userStop === null) {
    return schedulePlan({
      nowMs,
      stops,
      userStop,
      walk_sec,
      headway_min: input.headway_min,
      reason: isUnusable ? 'no_signal' : 'no_signal',
    });
  }

  const ageSec = dataAgeSeconds(bus, nowMs);
  const source = bus.source;
  const conf = confidence(source, ageSec);
  const crowd: CrowdEstimate = crowdLevel(bus, reports, nowMs);

  const eta = busEtaSeconds(bus, userStop, stops);

  if (eta === null) {
    // The bus is ahead of us on the route and not coming back this direction.
    return {
      phase: 'passed',
      urgency: 'missed',
      leave_in_sec: null,
      bus_eta_sec: null,
      walk_sec,
      buffer_sec: CONFIG.BUFFER_SEC,
      user_stop: userStop,
      bus_id: bus.bus_id,
      bus_at_stop: null,
      stops_away: null,
      confidence: conf,
      data_age_sec: ageSec,
      source,
      crowd: crowd.level,
      crowd_reports: crowd.count,
      plan_b: planB({
        phase: 'passed',
        crowd: crowd.level,
        standby_sec: null,
        headway_min: input.headway_min,
        missed: true,
        walk_sec_to_dest: input.walkSecToDest ?? null,
        ride_sec_to_dest: input.rideSecToDest ?? null,
        time_left_sec: input.timeLeftSec ?? null,
      }),
      computed_at_real_ms: nowMs,
    };
  }

  const phase: BusPhase = bus.status === 'waiting' ? 'standby' : 'moving';
  const bus_at_stop = phase === 'standby' ? findStop(stops, bus.current_stop_id) : null;
  const standby_sec = standbySeconds(bus, nowMs);

  const leave_in_sec = eta.eta_sec - walk_sec - CONFIG.BUFFER_SEC;
  const urgency = urgencyFor(leave_in_sec);

  const plan_b = planB({
    phase,
    crowd: crowd.level,
    standby_sec,
    headway_min: input.headway_min,
    // Being too late to catch it is the same problem as the bus passing us.
    missed: urgency === 'missed',
    walk_sec_to_dest: input.walkSecToDest ?? null,
    ride_sec_to_dest: input.rideSecToDest ?? null,
    time_left_sec: input.timeLeftSec ?? null,
  });

  return {
    phase,
    urgency,
    leave_in_sec,
    bus_eta_sec: eta.eta_sec,
    walk_sec,
    buffer_sec: CONFIG.BUFFER_SEC,
    user_stop: userStop,
    bus_id: bus.bus_id,
    bus_at_stop,
    stops_away: eta.stops_away,
    confidence: conf,
    data_age_sec: ageSec,
    source,
    crowd: crowd.level,
    crowd_reports: crowd.count,
    plan_b,
    computed_at_real_ms: nowMs,
  };
}

interface CrowdEstimate {
  level: CrowdLevel;
  count: number;
}

function resolveUserStop(picked: Stop | null | undefined, user: LatLng | null, stops: readonly Stop[]): Stop | null {
  if (picked) return picked;
  if (user && stops.length > 0) return nearestStop(user, stops).stop;
  return null;
}

function walkToStop(user: LatLng | null, userStop: Stop): number {
  if (!user) return 0;
  return walkSeconds(nearestStop(user, [userStop]).meters);
}

function findStop(stops: readonly Stop[], stopId: string | null): Stop | null {
  if (stopId === null) return null;
  return stops.find((s) => s.stop_id === stopId) ?? null;
}

/** Schedule fallback: never invents an arrival, always labelled low confidence. */
function schedulePlan(args: {
  nowMs: number;
  stops: readonly Stop[];
  userStop: Stop | null;
  walk_sec: number;
  headway_min: number;
  reason: 'no_signal';
}): LeavePlan {
  return {
    phase: 'no_signal',
    urgency: 'unknown',
    leave_in_sec: null,
    bus_eta_sec: null,
    walk_sec: args.walk_sec,
    buffer_sec: CONFIG.BUFFER_SEC,
    user_stop: args.userStop,
    bus_id: null,
    bus_at_stop: null,
    stops_away: null,
    confidence: 'low',
    data_age_sec: null,
    source: 'schedule',
    crowd: 'unknown',
    crowd_reports: 0,
    plan_b: planB({
      phase: 'no_signal',
      crowd: 'unknown',
      standby_sec: null,
      headway_min: args.headway_min,
      missed: false,
    }),
    computed_at_real_ms: args.nowMs,
  };
}
