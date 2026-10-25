import type { LeavePlan } from './types';
import route from '../data/route.json';
const s = route.stops;
const base: LeavePlan = {
  phase: 'moving', urgency: 'relax', leave_in_sec: 720, bus_eta_sec: 1020, walk_sec: 240,
  buffer_sec: 60, user_stop: s[3], bus_id: 'bus-1', bus_at_stop: null, stops_away: 2,
  confidence: 'high', data_age_sec: 8, source: 'driver', crowd: 'seats', crowd_reports: 2,
  plan_b: null, computed_at_real_ms: Date.now(),
};
export const FIXTURES: Record<string, LeavePlan> = {
  relax: base,
  get_ready: { ...base, urgency: 'get_ready', leave_in_sec: 200, bus_eta_sec: 500, stops_away: 1 },
  leave_now: { ...base, urgency: 'leave_now', leave_in_sec: 20, bus_eta_sec: 320, stops_away: 1, crowd: 'busy', crowd_reports: 5 },
  standby: { ...base, phase: 'standby', urgency: 'get_ready', leave_in_sec: 240, bus_at_stop: s[1], stops_away: 2 },
  missed: { ...base, phase: 'passed', urgency: 'missed', leave_in_sec: null, bus_eta_sec: null, stops_away: null,
            plan_b: { kind: 'next_bus', minutes: 10, reason: 'missed' } },
  full: { ...base, crowd: 'full', plan_b: { kind: 'next_bus', minutes: 10, reason: 'full' } },
  delayed: { ...base, phase: 'standby', bus_at_stop: s[2], confidence: 'medium',
             plan_b: { kind: 'walk', minutes: 14, reason: 'delayed' } },
  no_signal: { ...base, phase: 'no_signal', urgency: 'unknown', leave_in_sec: null, bus_eta_sec: null,
               bus_id: null, confidence: 'low', data_age_sec: null, source: 'schedule', crowd: 'unknown',
               crowd_reports: 0, plan_b: { kind: 'next_bus', minutes: 10, reason: 'no_signal' } },
};
