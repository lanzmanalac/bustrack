import { describe, expect, it } from 'vitest';
import type { BusStatus } from '../contracts/types';
import { isRidingBus, type TrackPoint } from './riding';

const NOW = Date.parse('2026-10-25T01:00:00.000Z');

const bus = (over: Partial<BusStatus> = {}): BusStatus => ({
  bus_id: 'bus-1',
  route_id: 'demo-route',
  lat: 14.5500,
  lng: 121.0500,
  status: 'moving',
  current_stop_id: null,
  next_stop_id: 's2',
  arrived_at: null,
  departed_at: null,
  is_full: false,
  full_reported_at: null,
  source: 'driver',
  updated_at: new Date(NOW).toISOString(),
  ...over,
});

/** 14.5500,121.0500 -> about 111m of latitude per 0.001 deg. */
const trackAlongBus = (speedMps: number, seconds = 30): TrackPoint[] =>
  Array.from({ length: 6 }, (_, i) => {
    const t = NOW - (5 - i) * (seconds * 1000) / 5;
    const movedDeg = (speedMps * ((5 - i) * seconds / 5)) / 111_000;
    return { lat: 14.5500 - movedDeg, lng: 121.0500, t };
  });

describe('isRidingBus', () => {
  it('is true for a phone moving at bus speed right next to the bus', () => {
    expect(isRidingBus(trackAlongBus(4.2), bus())).toBe(true);
  });

  it('is false when the phone is far from the bus', () => {
    const far = trackAlongBus(4.2).map((p) => ({ ...p, lng: p.lng + 0.01 }));
    expect(isRidingBus(far, bus())).toBe(false);
  });

  it('is false for someone walking past the stop', () => {
    expect(isRidingBus(trackAlongBus(1.4), bus())).toBe(false);
  });

  it('is false when standing still at the stop', () => {
    const stationary = trackAlongBus(0.1);
    expect(isRidingBus(stationary, bus())).toBe(false);
  });

  it('is false without enough samples to judge speed', () => {
    expect(isRidingBus([], bus())).toBe(false);
    expect(isRidingBus(trackAlongBus(4.2).slice(0, 2), bus())).toBe(false);
  });

  it('is false when the samples are too far apart in time to mean anything', () => {
    const stale = trackAlongBus(4.2).map((p, i) => ({ ...p, t: NOW - (5 - i) * 10 * 60_000 }));
    expect(isRidingBus(stale, bus())).toBe(false);
  });
});
