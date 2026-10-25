export type LatLng = { lat: number; lng: number };

export interface Stop {
  stop_id: string;
  route_id: string;
  name: string;
  lat: number;
  lng: number;
  seq: number; // order along the route: 1, 2, 3...
}

export interface Route {
  route_id: string;
  name: string;
  direction: string;
  headway_min: number;      // typical minutes between buses (schedule fallback)
  service_hours: string;    // e.g. "06:00-22:00"
  stops: Stop[];
}

export type BusState = 'waiting' | 'moving' | 'offline';

export interface BusStatus {
  bus_id: string;
  route_id: string;
  lat: number;
  lng: number;
  status: BusState;
  current_stop_id: string | null; // set when waiting
  next_stop_id: string | null;
  arrived_at: string | null;      // ISO, when it started waiting at current stop
  departed_at: string | null;     // ISO, when "Leaving now" was tapped
  is_full: boolean;
  full_reported_at: string | null;
  source: 'driver' | 'simulated';
  updated_at: string;             // ISO, set by the server
}

export interface RiderReport {
  session_id: string;             // random, changes daily, not an account
  kind: 'on_bus' | 'waiting';
  bus_id: string | null;
  stop_id: string | null;
  created_at: string;
}

export type BusPhase = 'standby' | 'moving' | 'passed' | 'no_signal';
export type Urgency = 'relax' | 'get_ready' | 'leave_now' | 'missed' | 'unknown';
export type Confidence = 'high' | 'medium' | 'low';
export type CrowdLevel = 'unknown' | 'seats' | 'busy' | 'likely_full' | 'full';

export interface PlanB {
  kind: 'wait' | 'next_bus' | 'walk' | 'ride_hail';
  minutes: number | null;
  reason: 'missed' | 'delayed' | 'full' | 'no_signal';
  why?: string;                   // one plain sentence shown under the pick
  confidence?: number | null;     // 0–1 when chosen by the Decisions API
  decided_by?: 'decisions_api' | 'responses_api' | 'rules';
}

export interface LeavePlan {
  phase: BusPhase;
  urgency: Urgency;
  leave_in_sec: number | null;    // in 'standby' = "if the bus left right now"
  bus_eta_sec: number | null;     // bus to your stop
  walk_sec: number;               // you to your stop
  buffer_sec: number;
  user_stop: Stop | null;
  bus_id: string | null;
  bus_at_stop: Stop | null;       // set in 'standby'
  stops_away: number | null;
  confidence: Confidence;
  data_age_sec: number | null;    // real seconds since last bus update
  source: 'driver' | 'simulated' | 'schedule';
  crowd: CrowdLevel;
  crowd_reports: number;          // rider reports counted (NOT passengers)
  plan_b: PlanB | null;
  computed_at_real_ms: number;    // for ticking the countdown between updates
}

export interface TripIntent {     // from /api/decide + on-device time parsing
  destination_stop_id: string | null;
  destination_confidence: number | null; // 0–1, from the Decisions API
  arrive_by: string | null;       // "HH:MM", 24h, Asia/Manila (regex on device, not AI)
  clarify: string | null;         // shown when confidence is low: "Did you mean A or B?"
  decided_by: 'decisions_api' | 'responses_api' | 'rules';
}

export interface RouteLineProps {
  stops: Stop[];
  buses: BusStatus[];
  userStopId: string | null;
  walkSec?: number;
  urgency?: Urgency;
}
