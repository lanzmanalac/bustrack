import type { BusStatus, Stop } from '../../contracts/types';
import { CONFIG } from '../../contracts/config';
import { haversineMeters } from '../../logic/geo';

// Pure bus state machine for the driver screen. No timers and no clock reads:
// every function takes `nowMs` (real time) or `worldSec` (TIME_SCALE-adjusted) as input.

export const BUS_ID = 'bus-1';

// The sim moves in straight lines between stops, but Backend 2's ETA multiplies straight-line
// distance by ROAD_FACTOR. Moving at BUS_SPEED / ROAD_FACTOR keeps the sim's arrival times
// equal to the commuter's countdown instead of 25% early.
export const SIM_SPEED_MPS = CONFIG.BUS_SPEED_MPS / CONFIG.ROAD_FACTOR;

export interface DriverState {
  stopIndex: number;        // waiting: the stop we're at. moving: the stop we last left.
  moving: boolean;
  progressM: number;        // meters travelled from stops[stopIndex] toward stops[stopIndex + 1]
  lat: number;
  lng: number;
  arrivedAtMs: number | null;
  departedAtMs: number | null;
  isFull: boolean;
  fullAtMs: number | null;
  offline: boolean;
  held: boolean;            // "Inject delay": blocks auto-depart
}

export const isLastStop = (s: DriverState, stops: readonly Stop[]) => s.stopIndex >= stops.length - 1;

export function atStop(stops: readonly Stop[], index: number, nowMs: number, prev?: DriverState): DriverState {
  const stop = stops[index];
  return {
    stopIndex: index,
    moving: false,
    progressM: 0,
    lat: stop.lat,
    lng: stop.lng,
    arrivedAtMs: nowMs,
    departedAtMs: null,
    isFull: prev?.isFull ?? false,
    fullAtMs: prev?.fullAtMs ?? null,
    offline: false,
    held: false,
  };
}

export function depart(s: DriverState, stops: readonly Stop[], nowMs: number): DriverState {
  if (s.moving || isLastStop(s, stops)) return s;
  return { ...s, moving: true, progressM: 0, departedAtMs: nowMs, held: false };
}

export function arriveNext(s: DriverState, stops: readonly Stop[], nowMs: number): DriverState {
  if (!s.moving) return s;
  return atStop(stops, s.stopIndex + 1, nowMs, s);
}

export function segmentMeters(stops: readonly Stop[], fromIndex: number): number {
  return haversineMeters(stops[fromIndex], stops[fromIndex + 1]);
}

/** Move the simulated bus forward by `worldSec` of world time; arrives when the segment ends. */
export function advance(s: DriverState, stops: readonly Stop[], worldSec: number, nowMs: number): DriverState {
  if (!s.moving || s.offline) return s;
  const total = segmentMeters(stops, s.stopIndex);
  const progressM = s.progressM + SIM_SPEED_MPS * worldSec;
  if (progressM >= total) return arriveNext(s, stops, nowMs);
  const a = stops[s.stopIndex];
  const b = stops[s.stopIndex + 1];
  const f = progressM / total;
  return { ...s, progressM, lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
}

export function metersToNextStop(s: DriverState, stops: readonly Stop[]): number | null {
  if (isLastStop(s, stops)) return null;
  return haversineMeters(s, stops[s.stopIndex + 1]);
}

export function toBusStatus(
  s: DriverState,
  stops: readonly Stop[],
  source: 'driver' | 'simulated',
): Omit<BusStatus, 'updated_at'> {
  const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());
  const next = stops[s.stopIndex + 1] ?? null;
  return {
    bus_id: BUS_ID,
    route_id: CONFIG.ROUTE_ID,
    lat: s.lat,
    lng: s.lng,
    status: s.offline ? 'offline' : s.moving ? 'moving' : 'waiting',
    current_stop_id: s.moving ? null : stops[s.stopIndex].stop_id,
    next_stop_id: next?.stop_id ?? null,
    arrived_at: s.moving ? null : iso(s.arrivedAtMs),
    departed_at: iso(s.departedAtMs),
    is_full: s.isFull,
    full_reported_at: iso(s.fullAtMs),
    source,
  };
}
