import type { LatLng, Stop } from '../contracts/types';
import { CONFIG } from '../contracts/config';

const EARTH_RADIUS_M = 6371000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two points, in meters.
 * Pure: no clock, no config, no side effects.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Sort stops by their position along the route (seq 1, 2, 3...).
 * route.json is hand-authored, so we never assume it arrives sorted.
 */
export function orderedStops(stops: readonly Stop[]): Stop[] {
  return [...stops].sort((a, b) => a.seq - b.seq);
}

export function indexOfStop(stops: readonly Stop[], stopId: string | null): number {
  if (stopId === null) return -1;
  return stops.findIndex((s) => s.stop_id === stopId);
}

/** Nearest stop to the user. Assumes a non-empty route (route.json always has stops). */
export function nearestStop(user: LatLng, stops: readonly Stop[]): { stop: Stop; meters: number } {
  let best = stops[0];
  let bestMeters = Number.POSITIVE_INFINITY;

  for (const stop of stops) {
    const meters = haversineMeters(user, stop);
    if (meters < bestMeters) {
      bestMeters = meters;
      best = stop;
    }
  }

  return { stop: best, meters: bestMeters };
}

/**
 * Walking time in whole seconds.
 * meters are straight-line, so ROAD_FACTOR converts them to street distance first.
 */
export function walkSeconds(meters: number): number {
  return Math.round((meters * CONFIG.ROAD_FACTOR) / CONFIG.WALK_SPEED_MPS);
}

/** Straight-line meters between two stops, corrected to street distance. */
export function streetMeters(a: LatLng, b: LatLng): number {
  return haversineMeters(a, b) * CONFIG.ROAD_FACTOR;
}
