import { describe, expect, it } from 'vitest';
import type { LeavePlan } from '../contracts/types';
import { checkArriveBy, parseArriveBy, secondsUntil, type ArriveVerdict } from './arriveBy';

// 2026-10-25T00:41Z is 08:41 in Asia/Manila — the exact moment in the plan's example.
const NOW = Date.parse('2026-10-25T00:41:00.000Z');

const plan = (over: Partial<LeavePlan> = {}): LeavePlan => ({
  phase: 'moving',
  urgency: 'relax',
  leave_in_sec: 720,
  bus_eta_sec: 600,
  walk_sec: 240,
  buffer_sec: 60,
  user_stop: null,
  bus_id: 'bus-1',
  bus_at_stop: null,
  stops_away: 2,
  confidence: 'high',
  data_age_sec: 8,
  source: 'driver',
  crowd: 'seats',
  crowd_reports: 2,
  plan_b: null,
  computed_at_real_ms: NOW,
  ...over,
});

describe('parseArriveBy', () => {
  it('handles the plan examples', () => {
    expect(parseArriveBy('need to be at High Street by 9')).toBe('09:00');
    expect(parseArriveBy('9')).toBe('09:00');
    expect(parseArriveBy('9am')).toBe('09:00');
    expect(parseArriveBy('9:30')).toBe('09:30');
    expect(parseArriveBy('alas-9')).toBe('09:00');
  });

  it('handles the demo script line in Taglish', () => {
    expect(parseArriveBy('kailangan nasa Market Market ako by 9')).toBe('09:00');
  });

  it('reads pm correctly', () => {
    expect(parseArriveBy('by 5pm')).toBe('17:00');
    expect(parseArriveBy('by 12nn')).toBe('12:00');
    expect(parseArriveBy('by 12midnight')).toBe('00:00');
  });

  it('never reads a street name as a time', () => {
    expect(parseArriveBy('drop me at 5th Ave')).toBeNull();
    expect(parseArriveBy('9th Avenue stop')).toBeNull();
    expect(parseArriveBy('meet me at 26th Street')).toBeNull();
  });

  it('returns null when there is no time at all', () => {
    expect(parseArriveBy('pauwi na ko')).toBeNull();
    expect(parseArriveBy('')).toBeNull();
  });
});

describe('secondsUntil', () => {
  it('is 19 minutes from 08:41 to 09:00', () => {
    expect(secondsUntil('09:00', NOW)).toBe(19 * 60);
  });

  it('goes negative when the deadline already passed', () => {
    expect(secondsUntil('08:00', NOW)).toBe(-41 * 60);
  });

  it('rejects nonsense', () => {
    expect(secondsUntil('25:00', NOW)).toBeNull();
    expect(secondsUntil('9', NOW)).toBeNull();
    expect(secondsUntil('', NOW)).toBeNull();
  });
});

describe('checkArriveBy', () => {
  it('on_time when there is real slack', () => {
    // Bus in 10 min, 5 min ride -> arrive 08:56 for a 09:00 deadline.
    expect(checkArriveBy(plan(), 300, '09:00', NOW)).toBe<ArriveVerdict>('on_time');
  });

  it('tight when it only just works', () => {
    // 600 + 510 = 1110s of travel against 1140s of slack -> 30s spare.
    expect(checkArriveBy(plan(), 510, '09:00', NOW)).toBe<ArriveVerdict>('tight');
  });

  it('late when the trip does not fit', () => {
    expect(checkArriveBy(plan(), 600, '09:00', NOW)).toBe<ArriveVerdict>('late');
  });

  it('late when the deadline has already passed', () => {
    expect(checkArriveBy(plan(), 60, '08:00', NOW)).toBe<ArriveVerdict>('late');
  });

  it('refuses to promise anything without a bus ETA', () => {
    expect(checkArriveBy(plan({ bus_eta_sec: null, phase: 'no_signal' }), 300, '09:00', NOW)).toBe<
      ArriveVerdict
    >('unknown');
  });

  it('calls a passed bus late rather than unknown', () => {
    expect(checkArriveBy(plan({ bus_eta_sec: null, phase: 'passed' }), 300, '09:00', NOW)).toBe<
      ArriveVerdict
    >('late');
  });

  it('is unknown until the user gives a time or a destination', () => {
    expect(checkArriveBy(plan(), 300, null, NOW)).toBe<ArriveVerdict>('unknown');
    expect(checkArriveBy(plan(), null, '09:00', NOW)).toBe<ArriveVerdict>('unknown');
    expect(checkArriveBy(plan(), 300, 'not a time', NOW)).toBe<ArriveVerdict>('unknown');
  });
});
