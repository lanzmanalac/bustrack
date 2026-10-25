import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../contracts/fixtures';
import { CONFIG } from '../contracts/config';
import type { BusStatus, RiderReport } from '../contracts/types';
import { confidence, crowdLevel, urgencyFor } from './evaluate';

const NOW = Date.parse('2026-10-25T01:00:00.000Z');

const bus = (over: Partial<BusStatus> = {}): BusStatus => ({
  bus_id: 'bus-1',
  route_id: 'demo-route',
  lat: 14.55,
  lng: 121.05,
  status: 'moving',
  current_stop_id: null,
  next_stop_id: 's2',
  arrived_at: null,
  departed_at: null,
  is_full: false,
  full_reported_at: null,
  source: 'driver',
  updated_at: new Date(NOW - 8_000).toISOString(),
  ...over,
});

const report = (session_id: string, ageSec: number, over: Partial<RiderReport> = {}): RiderReport => ({
  session_id,
  kind: 'on_bus',
  bus_id: 'bus-1',
  stop_id: null,
  created_at: new Date(NOW - ageSec * 1000).toISOString(),
  ...over,
});

describe('urgencyFor matches the fixture states', () => {
  it('relax: 720s remaining', () => {
    expect(urgencyFor(FIXTURES.relax.leave_in_sec)).toBe(FIXTURES.relax.urgency);
  });

  it('get_ready: 200s remaining', () => {
    expect(urgencyFor(FIXTURES.get_ready.leave_in_sec)).toBe(FIXTURES.get_ready.urgency);
  });

  it('leave_now: 20s remaining', () => {
    expect(urgencyFor(FIXTURES.leave_now.leave_in_sec)).toBe(FIXTURES.leave_now.urgency);
  });

  it('standby: 240s remaining still reads get_ready', () => {
    expect(urgencyFor(FIXTURES.standby.leave_in_sec)).toBe(FIXTURES.standby.urgency);
  });

  it('null never guesses', () => {
    expect(urgencyFor(null)).toBe('unknown');
    expect(urgencyFor(Number.NaN)).toBe('unknown');
  });

  it('missed and no_signal both carry a null countdown, so phase decides them', () => {
    expect(FIXTURES.missed.leave_in_sec).toBeNull();
    expect(FIXTURES.no_signal.leave_in_sec).toBeNull();
    expect(FIXTURES.missed.urgency).toBe('missed'); // from phase: 'passed'
    expect(FIXTURES.no_signal.urgency).toBe('unknown'); // from phase: 'no_signal'
    expect(urgencyFor(FIXTURES.missed.leave_in_sec)).toBe('unknown');
  });

  it('bands are contiguous with no gaps', () => {
    expect(urgencyFor(CONFIG.URGENCY_SEC.relax + 1)).toBe('relax');
    expect(urgencyFor(CONFIG.URGENCY_SEC.relax)).toBe('get_ready');
    expect(urgencyFor(CONFIG.URGENCY_SEC.get_ready + 1)).toBe('get_ready');
    expect(urgencyFor(CONFIG.URGENCY_SEC.get_ready)).toBe('leave_now');
    expect(urgencyFor(CONFIG.URGENCY_SEC.missed + 1)).toBe('leave_now');
    expect(urgencyFor(CONFIG.URGENCY_SEC.missed)).toBe('missed');
    expect(urgencyFor(-10_000)).toBe('missed');
  });
});

describe('confidence', () => {
  it('fresh driver data is high (fixture base: driver, 8s)', () => {
    expect(confidence(FIXTURES.relax.source, FIXTURES.relax.data_age_sec)).toBe('high');
    expect(confidence(FIXTURES.relax.source, FIXTURES.relax.data_age_sec)).toBe(
      FIXTURES.relax.confidence,
    );
  });

  it('schedule is always low, even with no age (fixture no_signal)', () => {
    expect(confidence(FIXTURES.no_signal.source, FIXTURES.no_signal.data_age_sec)).toBe('low');
    expect(confidence(FIXTURES.no_signal.source, FIXTURES.no_signal.data_age_sec)).toBe(
      FIXTURES.no_signal.confidence,
    );
  });

  it('honours the FRESH_SEC thresholds', () => {
    expect(confidence('driver', CONFIG.FRESH_SEC.high)).toBe('high');
    expect(confidence('driver', CONFIG.FRESH_SEC.high + 1)).toBe('medium');
    expect(confidence('driver', CONFIG.FRESH_SEC.medium)).toBe('medium');
    expect(confidence('driver', CONFIG.FRESH_SEC.medium + 1)).toBe('low');
  });

  it('treats a missing age as low rather than assuming freshness', () => {
    expect(confidence('driver', null)).toBe('low');
  });
});

describe('crowdLevel', () => {
  it('driver marking the bus full wins outright (fixture full)', () => {
    const result = crowdLevel(
      bus({ is_full: true, full_reported_at: new Date(NOW - 120_000).toISOString() }),
      [],
      NOW,
    );
    expect(result.level).toBe('full');
  });

  it('ignores a stale full report once FULL_TTL_SEC passes', () => {
    const result = crowdLevel(
      bus({
        is_full: true,
        full_reported_at: new Date(NOW - (CONFIG.FULL_TTL_SEC + 1) * 1000).toISOString(),
      }),
      [],
      NOW,
    );
    expect(result.level).toBe('unknown');
  });

  it('maps report counts to the documented bands', () => {
    const build = (n: number) => Array.from({ length: n }, (_, i) => report(`s${i}`, 30));

    expect(crowdLevel(bus(), [], NOW)).toEqual({ level: 'unknown', count: 0 });
    expect(crowdLevel(bus(), build(1), NOW).level).toBe('seats');
    expect(crowdLevel(bus(), build(3), NOW).level).toBe('seats');
    expect(crowdLevel(bus(), build(4), NOW).level).toBe('busy');
    expect(crowdLevel(bus(), build(7), NOW).level).toBe('busy');
    expect(crowdLevel(bus(), build(CONFIG.CROWD_REPORTS.likely_full), NOW).level).toBe('likely_full');
  });

  it('counts distinct sessions, so one rider spamming is still one report', () => {
    const spam = Array.from({ length: 10 }, () => report('same-session', 30));
    expect(crowdLevel(bus(), spam, NOW).count).toBe(1);
  });

  it('never counts another bus, a waiting report, or an expired one', () => {
    const reports = [
      report('a', 30),
      report('b', 30, { bus_id: 'other-bus' }),
      report('c', 30, { kind: 'waiting' }),
      report('d', CONFIG.RIDER_REPORT_TTL_SEC + 1),
    ];
    const result = crowdLevel(bus(), reports, NOW);
    expect(result.count).toBe(1);
    expect(result.level).toBe('seats');
  });

  it('matches the fixture crowd levels', () => {
    const two = [report('a', 10), report('b', 10)];
    expect(crowdLevel(bus(), two, NOW).level).toBe(FIXTURES.relax.crowd);
    expect(crowdLevel(bus(), two, NOW).count).toBe(FIXTURES.relax.crowd_reports);

    const five = Array.from({ length: 5 }, (_, i) => report(`s${i}`, 10));
    expect(crowdLevel(bus(), five, NOW).level).toBe(FIXTURES.leave_now.crowd);
    expect(crowdLevel(bus(), five, NOW).count).toBe(FIXTURES.leave_now.crowd_reports);

    expect(crowdLevel(bus(), [], NOW).level).toBe(FIXTURES.no_signal.crowd);
  });
});
