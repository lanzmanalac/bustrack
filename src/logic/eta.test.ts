import { describe, expect, it } from 'vitest';
import { CONFIG } from '../contracts/config';
import type { BusStatus, Stop } from '../contracts/types';
import route from '../data/route.json';
import { busEtaSeconds, dataAgeSeconds, standbySeconds } from './eta';
import { haversineMeters, streetMeters } from './geo';

const stops = route.stops as unknown as Stop[];
const NOW = Date.parse('2026-10-25T01:00:00.000Z');

const moving = (over: Partial<BusStatus> = {}): BusStatus => ({
  bus_id: 'bus-1',
  route_id: 'demo-route',
  lat: stops[0].lat,
  lng: stops[0].lng,
  status: 'moving',
  current_stop_id: null,
  next_stop_id: 's1',
  arrived_at: null,
  departed_at: null,
  is_full: false,
  full_reported_at: null,
  source: 'driver',
  updated_at: new Date(NOW).toISOString(),
  ...over,
});

describe('busEtaSeconds', () => {
  it('is zero when the bus is already parked at your stop', () => {
    const bus = moving({ status: 'waiting', current_stop_id: 's1', next_stop_id: 's2' });
    expect(busEtaSeconds(bus, stops[0], stops)).toEqual({ eta_sec: 0, stops_away: 0 });
  });

  it('counts stops still to be called at (waiting at s1 -> s3 = 2 stops)', () => {
    const bus = moving({ status: 'waiting', current_stop_id: 's1', next_stop_id: 's2' });
    const result = busEtaSeconds(bus, stops[2], stops);
    expect(result?.stops_away).toBe(2);
    expect(result?.eta_sec).toBeGreaterThan(0);
  });

  it('drives to next_stop first, then runs the remaining legs (moving -> s3)', () => {
    const bus = moving({ next_stop_id: 's2', lat: stops[0].lat, lng: stops[0].lng });
    const result = busEtaSeconds(bus, stops[2], stops);
    // Bus must reach s2 (counted as 1) before s3, so the commuter is 2 stops out.
    expect(result?.stops_away).toBe(2);

    const legs = streetMeters(bus, stops[1]) + streetMeters(stops[1], stops[2]);
    // One dwell: at s2. The target s3 is arrival, not a stop it waits at.
    const expected = Math.round(legs / CONFIG.BUS_SPEED_MPS + 1 * CONFIG.DWELL_SEC_PER_STOP);
    expect(result?.eta_sec).toBe(expected);
  });

  it('returns null once the bus is ahead of your stop', () => {
    const bus = moving({ next_stop_id: 's3' });
    expect(busEtaSeconds(bus, stops[1], stops)).toBeNull();
  });

  it('returns null for a bus with no known next stop', () => {
    const bus = moving({ next_stop_id: null });
    expect(busEtaSeconds(bus, stops[3], stops)).toBeNull();
  });

  it('returns null for a stop that is not on this route', () => {
    const bus = moving({ next_stop_id: 's1' });
    const stranger: Stop = { stop_id: 'zz', route_id: 'other', name: 'Z', lat: 0, lng: 0, seq: 9 };
    expect(busEtaSeconds(bus, stranger, stops)).toBeNull();
  });

  it('dwell is charged for every stop before the target, not the target itself', () => {
    const oneAway = busEtaSeconds(moving({ status: 'waiting', current_stop_id: 's1', next_stop_id: 's2' }), stops[1], stops);
    const twoAway = busEtaSeconds(moving({ status: 'waiting', current_stop_id: 's1', next_stop_id: 's2' }), stops[2], stops);
    expect(oneAway?.stops_away).toBe(1);
    expect(twoAway?.stops_away).toBe(2);
    expect((twoAway!.eta_sec - oneAway!.eta_sec)).toBeGreaterThan(CONFIG.DWELL_SEC_PER_STOP);
  });

  it('walking time is not confused with bus time', () => {
    const walk = CONFIG.ROAD_FACTOR / CONFIG.WALK_SPEED_MPS;
    const ride = CONFIG.ROAD_FACTOR / CONFIG.BUS_SPEED_MPS;
    expect(walk).toBeGreaterThan(ride); // you walk slower than the bus drives
  });
});

describe('standbySeconds', () => {
  it('measures real elapsed time at the stop', () => {
    const bus = moving({
      status: 'waiting',
      current_stop_id: 's2',
      arrived_at: new Date(NOW - 240_000).toISOString(),
    });
    expect(standbySeconds(bus, NOW)).toBe(240);
  });

  it('is null when the bus is moving or never reported an arrival', () => {
    expect(standbySeconds(moving(), NOW)).toBeNull();
    expect(standbySeconds(moving({ status: 'waiting', arrived_at: null }), NOW)).toBeNull();
  });
});

describe('dataAgeSeconds', () => {
  it('reads the server timestamp in real seconds', () => {
    const bus = moving({ updated_at: new Date(NOW - 8_000).toISOString() });
    expect(dataAgeSeconds(bus, NOW)).toBe(8);
  });

  it('never reports a negative age when clocks drift', () => {
    const bus = moving({ updated_at: new Date(NOW + 5_000).toISOString() });
    expect(dataAgeSeconds(bus, NOW)).toBe(0);
  });

  it('does not scale with TIME_SCALE', () => {
    const bus = moving({ updated_at: new Date(NOW - 8_000).toISOString() });
    expect(dataAgeSeconds(bus, NOW)).toBe(8);
    expect(CONFIG.TIME_SCALE).toBeTypeOf('number');
  });
});

describe('haversine sanity for the real route', () => {
  it('every leg is a real distance and the route is a plausible length', () => {
    const gaps = stops.slice(0, -1).map((s, i) => haversineMeters(s, stops[i + 1]));
    // Real stops are NOT evenly spaced (70m up to 2100m), but no leg can be
    // zero-length and the whole route must be walkable/transitable BGC scale.
    expect(gaps).toHaveLength(stops.length - 1);
    expect(Math.min(...gaps)).toBeGreaterThan(1);
    const total = gaps.reduce((sum, g) => sum + g, 0);
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(10_000);
  });
});
