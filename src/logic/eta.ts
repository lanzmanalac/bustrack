import type { BusStatus, Stop } from '../contracts/types';
import { CONFIG } from '../contracts/config';
import { indexOfStop, orderedStops, streetMeters } from './geo';

export interface BusEta {
  eta_sec: number;
  stops_away: number;
}

/**
 * Seconds until the bus reaches `target`, plus how many stops it still calls at.
 *
 * Returns null when the bus has already passed the target — the caller turns that
 * into phase 'passed' / urgency 'missed'.
 *
 * Two cases, both measuring "as if it left right now":
 *  - moving:    drive to next_stop, then run the remaining legs to the target
 *  - waiting:   it is already parked at current_stop, so start counting from there
 *
 * Dwell is charged for every stop the bus actually calls at before the target,
 * i.e. every stop from the starting stop (inclusive) up to the target (exclusive).
 */
export function busEtaSeconds(
  bus: BusStatus,
  target: Stop,
  stops: readonly Stop[],
): BusEta | null {
  const ordered = orderedStops(stops);
  const targetIdx = indexOfStop(ordered, target.stop_id);
  if (targetIdx < 0) return null;

  // Where does the bus pick up its journey?
  const waiting = bus.status === 'waiting';
  const currentIdx = waiting ? indexOfStop(ordered, bus.current_stop_id) : -1;
  const nextIdx = indexOfStop(ordered, bus.next_stop_id);

  let anchorIdx: number;
  let parkedAtAnchor: boolean;
  if (waiting && currentIdx >= 0) {
    anchorIdx = currentIdx;
    parkedAtAnchor = true;
  } else if (nextIdx >= 0) {
    anchorIdx = nextIdx;
    parkedAtAnchor = false;
  } else {
    return null; // no known stop -> nothing to measure from
  }

  // Passed the target: the bus will never come back this way.
  if (anchorIdx > targetIdx) return null;

  // Drive distance: from the bus to its anchor, then along the route.
  let driveMeters = 0;
  if (!parkedAtAnchor) driveMeters = streetMeters(bus, ordered[anchorIdx]);
  for (let i = anchorIdx; i < targetIdx; i += 1) {
    driveMeters += streetMeters(ordered[i], ordered[i + 1]);
  }

  // Parked: the bus already cleared its anchor, so count legs from there.
  // Moving: it still has to reach next_stop first, so that stop counts as 1.
  const stops_away = parkedAtAnchor ? targetIdx - anchorIdx : targetIdx - anchorIdx + 1;

  // It dwells at the stops it calls at on the way, never at the target itself,
  // and not at the stop it is already parked at (it leaves right now).
  const dwellStops = parkedAtAnchor
    ? Math.max(0, targetIdx - anchorIdx - 1)
    : Math.max(0, targetIdx - anchorIdx);

  const drive_sec = driveMeters / CONFIG.BUS_SPEED_MPS;
  const dwell_sec = dwellStops * CONFIG.DWELL_SEC_PER_STOP;

  return { eta_sec: Math.round(drive_sec + dwell_sec), stops_away };
}

/**
 * How long the bus has been parked at its current stop, in real seconds.
 * Drives the "delayed" trigger in planB().
 */
export function standbySeconds(bus: BusStatus, nowMs: number): number | null {
  if (bus.status !== 'waiting' || bus.arrived_at === null) return null;
  const arrivedMs = Date.parse(bus.arrived_at);
  if (Number.isNaN(arrivedMs)) return null;
  return Math.max(0, (nowMs - arrivedMs) / 1000);
}

/** Real seconds since the server last touched this bus. Never applies TIME_SCALE. */
export function dataAgeSeconds(bus: BusStatus, nowMs: number): number {
  const updatedMs = Date.parse(bus.updated_at);
  if (Number.isNaN(updatedMs)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (nowMs - updatedMs) / 1000);
}
