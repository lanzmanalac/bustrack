import { describe, expect, it } from 'vitest';
import route from '../../data/route.json';
import type { LeavePlan, Stop, TripIntent } from '../../contracts/types';
import { tripVerdictFor } from './tripVerdict';

const stops = route.stops as Stop[];
const NOW = Date.parse('2026-10-25T00:41:00Z');
const intent: TripIntent = { destination_stop_id: 's7', destination_confidence: 0.8, arrive_by: '09:30', clarify: null, decided_by: 'decisions_api' };
const plan: LeavePlan = {
  phase: 'moving', urgency: 'relax', leave_in_sec: 600, bus_eta_sec: 900,
  walk_sec: 240, buffer_sec: 60, user_stop: stops[5], bus_id: 'bus-1',
  bus_at_stop: null, stops_away: 1, confidence: 'high', data_age_sec: 8,
  source: 'driver', crowd: 'unknown', crowd_reports: 0, plan_b: null,
  computed_at_real_ms: NOW,
};

describe('tripVerdictFor', () => {
  it('gives an on-time verdict for a catchable downstream trip', () => {
    expect(tripVerdictFor(plan, intent, stops, NOW)?.kind).toBe('on_time');
  });

  it('does not claim an arrival when there is no live bus ETA', () => {
    expect(tripVerdictFor({ ...plan, phase: 'no_signal', bus_eta_sec: null }, intent, stops, NOW)?.kind).toBe('unknown');
  });

  it('does not promise an arrival from stale bus data', () => {
    expect(tripVerdictFor({ ...plan, confidence: 'low', data_age_sec: 180 }, intent, stops, NOW)?.kind).toBe('unknown');
  });

  it('does not promise an arrival on a bus reported full', () => {
    expect(tripVerdictFor({ ...plan, crowd: 'full' }, intent, stops, NOW)?.kind).toBe('unknown');
  });

  it('does not treat a parked bus as though it has departed', () => {
    expect(tripVerdictFor({ ...plan, phase: 'standby' }, intent, stops, NOW)?.kind).toBe('unknown');
  });

  it('does not claim this bus reaches a stop behind the boarding stop', () => {
    expect(tripVerdictFor(plan, { ...intent, destination_stop_id: 's3' }, stops, NOW)?.kind).toBe('unknown');
  });

  it('withholds the verdict until the destination is confirmed', () => {
    expect(tripVerdictFor(plan, { ...intent, clarify: 'Which stop?' }, stops, NOW)).toBeNull();
  });
});
