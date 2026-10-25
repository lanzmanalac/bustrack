import { describe, expect, it } from 'vitest';
import type { Stop } from '../../contracts/types';
import route from '../../data/route.json';
import { advance, arriveNext, atStop, depart, segmentMeters, SIM_SPEED_MPS, toBusStatus } from './sim';

const stops = route.stops as Stop[];
const T0 = Date.parse('2026-10-25T05:00:00Z');

describe('driver sim', () => {
  it('starts waiting at the first stop with a correct BusStatus', () => {
    const s = atStop(stops, 0, T0);
    const bus = toBusStatus(s, stops, 'simulated');
    expect(bus.status).toBe('waiting');
    expect(bus.current_stop_id).toBe('s1');
    expect(bus.next_stop_id).toBe('s2');
    expect(bus.arrived_at).toBe(new Date(T0).toISOString());
    expect(bus.source).toBe('simulated');
    expect(bus).not.toHaveProperty('updated_at'); // the adapter/server sets it
  });

  it('LEAVING NOW sets moving and departed_at', () => {
    const s = depart(atStop(stops, 0, T0), stops, T0 + 1000);
    const bus = toBusStatus(s, stops, 'simulated');
    expect(bus.status).toBe('moving');
    expect(bus.current_stop_id).toBeNull();
    expect(bus.next_stop_id).toBe('s2');
    expect(bus.departed_at).toBe(new Date(T0 + 1000).toISOString());
  });

  it('moves part-way, then auto-arrives and waits at the next stop', () => {
    const moving = depart(atStop(stops, 0, T0), stops, T0);
    const total = segmentMeters(stops, 0);
    const half = advance(moving, stops, total / 2 / SIM_SPEED_MPS, T0 + 1000);
    expect(half.moving).toBe(true);
    expect(half.progressM).toBeCloseTo(total / 2, 3);

    const arrived = advance(half, stops, total / SIM_SPEED_MPS, T0 + 2000);
    expect(arrived.moving).toBe(false);
    expect(arrived.stopIndex).toBe(1);
    expect(arrived.lat).toBe(stops[1].lat);
    expect(toBusStatus(arrived, stops, 'simulated').current_stop_id).toBe('s2');
  });

  it('cannot depart from the last stop', () => {
    const last = atStop(stops, stops.length - 1, T0);
    expect(depart(last, stops, T0)).toBe(last);
    expect(toBusStatus(last, stops, 'simulated').next_stop_id).toBeNull();
  });

  it('keeps BUS FULL across stops and reports offline', () => {
    const full = { ...depart(atStop(stops, 0, T0), stops, T0), isFull: true, fullAtMs: T0 };
    const next = arriveNext(full, stops, T0 + 5000);
    expect(next.isFull).toBe(true);
    expect(toBusStatus({ ...next, offline: true }, stops, 'driver').status).toBe('offline');
  });
});
