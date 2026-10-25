import type { BusStatus } from '../contracts/types';
import { haversineMeters } from './geo';

export interface TrackPoint {
  lat: number;
  lng: number;
  t: number; // epoch ms
}

/** Assumptions to tune, same as CONFIG. */
const WINDOW_SEC = 60;
const NEAR_BUS_M = 60;
const VEHICLE_MIN_SPEED_MPS = 3; // brisk walking tops out around 1.8 m/s
const SPEED_TOLERANCE_MPS = 3;

/**
 * P2, on-device only: is this phone physically on the bus?
 *
 * Uses proximity plus a speed that no pedestrian can sustain. Everything runs
 * locally — the raw track is never sent anywhere; if we decide "yes", the app
 * may send "+1 on this bus" and nothing else.
 */
export function isRidingBus(track: readonly TrackPoint[], bus: BusStatus): boolean {
  if (track.length < 3) return false;

  const ordered = [...track].sort((a, b) => a.t - b.t);
  const newest = ordered[ordered.length - 1];
  const oldest = ordered[0];

  const elapsedSec = (newest.t - oldest.t) / 1000;
  if (elapsedSec <= 0) return false;
  // A single GPS sample proves nothing about speed.
  if ((newest.t - ordered[ordered.length - 2].t) / 1000 > WINDOW_SEC) return false;

  const distanceToBus = haversineMeters(newest, bus);
  if (distanceToBus > NEAR_BUS_M) return false;

  const traveledM = haversineMeters(oldest, newest);
  const speedMps = traveledM / elapsedSec;

  if (speedMps < VEHICLE_MIN_SPEED_MPS) return false;
  if (speedMps > CONFIG_LIKE_BUS_SPEED + SPEED_TOLERANCE_MPS) return false;

  return true;
}

// Kept local so this module stays free of import.meta.env concerns.
const CONFIG_LIKE_BUS_SPEED = 4.2;
