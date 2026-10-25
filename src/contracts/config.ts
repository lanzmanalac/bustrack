export const CONFIG = {
  ROUTE_ID: 'demo-route',
  BUS_SPEED_MPS: 4.2,          // ~15 km/h average incl. traffic (assumption)
  WALK_SPEED_MPS: 1.2,
  ROAD_FACTOR: 1.25,           // straight line to street distance
  DWELL_SEC_PER_STOP: 30,
  BUFFER_SEC: 60,
  URGENCY_SEC: { relax: 300, get_ready: 120, missed: -30 },
  FRESH_SEC: { high: 30, medium: 120 },
  DELAY_STANDBY_SEC: 180,      // waiting this long at a stop = "delayed"
  FULL_TTL_SEC: 600,
  RIDER_REPORT_TTL_SEC: 300,
  CROWD_REPORTS: { busy: 4, likely_full: 8 },
  AI_CONFIDENCE_MIN: 0.6,      // below this, ask the user instead of guessing
  TIME_SCALE: Number(import.meta.env.VITE_TIME_SCALE ?? 1),   // demo speed-up, e.g. 8
  DATA_MODE: (import.meta.env.VITE_DATA_MODE ?? 'mock') as 'mock' | 'live',
  DEMO_USER_LOCATION: { lat: 14.5527, lng: 121.0473 },        // ~2 min walk to HSBC (stop 6): bus starts ~10 min away, so the demo shows every state
} as const;
