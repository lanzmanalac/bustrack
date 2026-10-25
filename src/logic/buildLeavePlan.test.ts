import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../contracts/fixtures';
import type { BusStatus, RiderReport, Stop } from '../contracts/types';
import route from '../data/route.json';
import { buildLeavePlan } from './buildLeavePlan';
import { CONFIG } from '../contracts/config';
import { pickLeadBus, resolveStop } from './useLeavePlan';

const stops = route.stops as unknown as Stop[];
const NOW = Date.parse('2026-10-25T01:00:00.000Z');

const bus = (over: Partial<BusStatus> = {}): BusStatus => ({
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
  updated_at: new Date(NOW - 8_000).toISOString(),
  ...over,
});

const base = (over: Partial<Parameters<typeof buildLeavePlan>[0]> = {}) =>
  buildLeavePlan({
    nowMs: NOW,
    stops,
    headway_min: route.headway_min,
    user: { lat: stops[3].lat, lng: stops[3].lng }, // standing at Stop 4
    bus: null,
    reports: [],
    ...over,
  });

describe('buildLeavePlan — honest fallbacks', () => {
  it('no bus row becomes a schedule estimate, never an invented arrival', () => {
    const plan = base();
    expect(plan.phase).toBe('no_signal');
    expect(plan.urgency).toBe('unknown');
    expect(plan.bus_eta_sec).toBeNull();
    expect(plan.leave_in_sec).toBeNull();
    expect(plan.source).toBe('schedule');
    expect(plan.confidence).toBe('low');
    expect(plan.data_age_sec).toBeNull();
    expect(plan.plan_b).toMatchObject({ reason: 'no_signal', minutes: route.headway_min });
  });

  it('an offline bus also falls back to the schedule', () => {
    const plan = base({ bus: bus({ status: 'offline' }) });
    expect(plan.phase).toBe('no_signal');
    expect(plan.confidence).toBe('low');
  });

  it('no location and no picked stop leaves us with nothing to promise', () => {
    const plan = base({ user: null });
    expect(plan.phase).toBe('no_signal');
    expect(plan.user_stop).toBeNull();
    expect(plan.walk_sec).toBe(0);
  });

  it('an explicitly picked stop beats the nearest one', () => {
    const plan = base({ user: { lat: stops[3].lat, lng: stops[3].lng }, userStop: stops[5] });
    expect(plan.user_stop?.stop_id).toBe('s6');
  });
});

describe('buildLeavePlan — live bus', () => {
  it('the countdown is exactly eta minus walk minus buffer', () => {
    const plan = base({ bus: bus({ next_stop_id: 's1' }) });
    expect(plan.phase).toBe('moving');
    expect(plan.bus_eta_sec).not.toBeNull();
    expect(plan.leave_in_sec).toBe(
      plan.bus_eta_sec! - plan.walk_sec - CONFIG.BUFFER_SEC,
    );
    expect(plan.urgency).toBe('relax');
  });

  it('a parked bus reports standby and names where it is waiting', () => {
    const plan = base({
      bus: bus({
        status: 'waiting',
        current_stop_id: 's2',
        next_stop_id: 's3',
        arrived_at: new Date(NOW - 60_000).toISOString(),
      }),
      user: { lat: stops[4].lat, lng: stops[4].lng },
    });
    expect(plan.phase).toBe('standby');
    expect(plan.bus_at_stop?.stop_id).toBe('s2');
    // 3 stops out (~8 min), you are already standing at your stop -> relax.
    expect(plan.urgency).toBe('relax');
    expect(plan.leave_in_sec).toBeGreaterThan(CONFIG.URGENCY_SEC.relax);
    expect(plan.plan_b).toBeNull(); // 60s parked is not yet a delay
  });

  it('a bus past your stop is a miss, with a next bus on the way', () => {
    const plan = base({
      bus: bus({ next_stop_id: 's5' }),
      user: { lat: stops[1].lat, lng: stops[1].lng }, // you are at Stop 2
    });
    expect(plan.phase).toBe('passed');
    expect(plan.urgency).toBe('missed');
    expect(plan.leave_in_sec).toBeNull();
    expect(plan.plan_b).toMatchObject({
      kind: 'next_bus',
      reason: 'missed',
      minutes: route.headway_min,
    });
  });

  it('driver marking the bus full drives the crowd level and Plan B', () => {
    const plan = base({
      bus: bus({ is_full: true, full_reported_at: new Date(NOW - 60_000).toISOString() }),
    });
    expect(plan.crowd).toBe('full');
    expect(plan.plan_b).toMatchObject({ reason: 'full', kind: 'next_bus' });
  });

  it('parking past DELAY_STANDBY_SEC swaps in a delayed Plan B', () => {
    const plan = base({
      bus: bus({
        status: 'waiting',
        current_stop_id: 's2',
        next_stop_id: 's3',
        arrived_at: new Date(NOW - (CONFIG.DELAY_STANDBY_SEC + 60) * 1000).toISOString(),
      }),
      walkSecToDest: 14 * 60,
    });
    expect(plan.plan_b).toMatchObject({ reason: 'delayed', kind: 'walk', minutes: 14 });
  });

  it('fresh driver data reads high confidence, stale data does not', () => {
    expect(base({ bus: bus({ updated_at: new Date(NOW - 8_000).toISOString() }) }).confidence).toBe('high');
    expect(base({ bus: bus({ updated_at: new Date(NOW - 600_000).toISOString() }) }).confidence).toBe('low');
  });

  it('picks the soonest bus, not merely the first in the list', () => {
    const far = bus({ bus_id: 'far', next_stop_id: 's1' }); // far behind
    const near = bus({ bus_id: 'near', next_stop_id: 's3', lat: stops[2].lat, lng: stops[2].lng });
    const plan = base({ bus: near, user: { lat: stops[3].lat, lng: stops[3].lng } });
    expect(plan.bus_id).toBe('near');
    expect(pickLeadBus([far, near], stops[3], stops)?.bus_id).toBe('near');
  });

  it('ignores offline buses when choosing a lead', () => {
    const offline = bus({ bus_id: 'dead', status: 'offline' });
    const live = bus({ bus_id: 'live', next_stop_id: 's3' });
    expect(pickLeadBus([offline, live], stops[3], stops)?.bus_id).toBe('live');
    expect(pickLeadBus([offline], stops[3], stops)).toBeNull();
  });

  it('falls back to the closest bus when every one has passed you', () => {
    const past = bus({ bus_id: 'past', next_stop_id: 's6' });
    const plan = base({ bus: pickLeadBus([past], stops[1], stops) });
    expect(plan.phase).toBe('passed');
  });
});

describe('rider reports feed the crowd level', () => {
  const reports = (n: number): RiderReport[] =>
    Array.from({ length: n }, (_, i) => ({
      session_id: `s${i}`,
      kind: 'on_bus' as const,
      bus_id: 'bus-1',
      stop_id: null,
      created_at: new Date(NOW - 30_000).toISOString(),
    }));

  it('five distinct riders read as busy, never as a passenger count', () => {
    const plan = base({ bus: bus(), reports: reports(5) });
    expect(plan.crowd).toBe('busy');
    expect(plan.crowd_reports).toBe(5);
  });

  it('matches the fixture crowd band', () => {
    const plan = base({ bus: bus(), reports: reports(2) });
    expect(plan.crowd).toBe(FIXTURES.relax.crowd);
    expect(plan.crowd_reports).toBe(FIXTURES.relax.crowd_reports);
  });
});

describe('resolveStop', () => {
  it('returns the stop nearest the user', () => {
    expect(resolveStop({ lat: stops[5].lat, lng: stops[5].lng }, stops)?.stop_id).toBe('s6');
  });

  it('returns null without a location', () => {
    expect(resolveStop(null, stops)).toBeNull();
  });
});
