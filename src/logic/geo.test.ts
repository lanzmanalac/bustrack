import { describe, expect, it } from 'vitest';
import { CONFIG } from '../contracts/config';
import type { Stop } from '../contracts/types';
import { haversineMeters, nearestStop, orderedStops, walkSeconds } from './geo';

const s1: Stop = { stop_id: 's1', route_id: 'demo-route', name: 'A', lat: 14.5600, lng: 121.0480, seq: 1 };
const s2: Stop = { stop_id: 's2', route_id: 'demo-route', name: 'B', lat: 14.5555, lng: 121.0490, seq: 2 };
const s3: Stop = { stop_id: 's3', route_id: 'demo-route', name: 'C', lat: 14.5510, lng: 121.0500, seq: 3 };

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters(s1, s1)).toBe(0);
  });

  it('matches the known ~500m spacing of the placeholder stops', () => {
    const meters = haversineMeters(s1, s2);
    expect(meters).toBeGreaterThan(450);
    expect(meters).toBeLessThan(700);
  });

  it('is symmetric', () => {
    expect(haversineMeters(s1, s3)).toBeCloseTo(haversineMeters(s3, s1), 6);
  });
});

describe('nearestStop', () => {
  it('picks the closest stop and reports the distance', () => {
    const user = { lat: 14.5557, lng: 121.0491 };
    const { stop, meters } = nearestStop(user, [s1, s2, s3]);
    expect(stop.stop_id).toBe('s2');
    expect(meters).toBeLessThan(100);
  });

  it('works when stops are not passed in route order', () => {
    const user = { lat: 14.5511, lng: 121.0501 };
    const { stop } = nearestStop(user, [s1, s3, s2]);
    expect(stop.stop_id).toBe('s3');
  });
});

describe('walkSeconds', () => {
  it('applies ROAD_FACTOR then WALK_SPEED_MPS', () => {
    const meters = 240;
    const expected = Math.round((meters * CONFIG.ROAD_FACTOR) / CONFIG.WALK_SPEED_MPS);
    expect(walkSeconds(meters)).toBe(expected);
  });

  it('400m straight line is about 500m of street -> ~7 min', () => {
    expect(walkSeconds(400)).toBe(417);
  });

  it('zero distance is zero seconds', () => {
    expect(walkSeconds(0)).toBe(0);
  });
});

describe('orderedStops', () => {
  it('sorts by seq regardless of input order', () => {
    const shuffled = [s3, s1, s2];
    expect(orderedStops(shuffled).map((s) => s.stop_id)).toEqual(['s1', 's2', 's3']);
  });

  it('does not mutate its input', () => {
    const input = [s3, s1, s2];
    orderedStops(input);
    expect(input.map((s) => s.stop_id)).toEqual(['s3', 's1', 's2']);
  });
});
