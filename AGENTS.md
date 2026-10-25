# BUILD PLAN — Leave-time co-pilot for BGC Bus
Codex × UX+AI Hackathon · 25 Oct 2026 · Build sprint 12:40–3:25 · **Submissions close 3:45** · Finalist demos 4:15

> **North Star (read this whenever you feel lost):**
> Commuters waste time and energy (*pagod*) waiting at bus stops. Our app tracks the bus so they don't have to,
> and answers one question in one glance: **"When do I leave?"**
> **We track buses, not people.** The commuter's location never leaves their phone.

---

## How to use this file

1. Put this file in the repo root as `BUILD_PLAN.md`. For Codex, also copy it to `AGENTS.md`. For Claude Code, copy it to `CLAUDE.md`. Other tools: paste it in.
2. Start every model session with:
   > "Read BUILD_PLAN.md. I am the **[ROLE]**. Follow Section 1 (Rules) and my role section only. Only edit the files my role owns. Contracts in Section 4 are frozen."
3. Each role section ends with a **Paste-to-model prompt**. Paste it after the line above.
4. If anything here conflicts with what the PM says out loud, the PM wins. Update this file after the change.

---

## 0. The product in one minute

**One-line pitch:** "Stop waiting at the stop. We tell you exactly when to leave."

**Longer pitch:** "We track BGC buses so you don't have to. Our app tells you exactly when to leave your desk, and what to do if the bus is late or full."

**How it works**
- **Driver app:** the driver's phone sends its GPS position. Two big buttons, **Leaving now** and **Bus full**, add status. No hardware is needed, and one operator (BGC Bus) could roll it out with one decision.
- **Commuter app:** downloads bus positions, then computes **on the phone** the walking time to the nearest stop, the bus arrival, and **"Leave in X min."**
- **Gets smarter with riders (opt-in):** a phone that detects it's moving with the bus sends only "+1 on bus 3", **never coordinates**. More reports means a better crowd estimate.
- **Works on day one:** coverage comes from drivers, not users, so the first commuter already gets value.
- **AI that decides, not chats:** OpenAI's **Decisions API** understands where you're going and picks the best Plan B, with a confidence score you can see and override.

**What makes us different from Rush PH and Moovit:** they show *where* the bus is. We tell you *when to leave*, explain why, and give a Plan B.

**Scale story:** start with BGC Bus (one operator, about 41,000 riders a day by an older count), then EDSA Carousel (about 183,000 riders a day in 2025, per DOTr).

**Out of scope today:** operator dashboards, payments, accounts, multi-route support, native apps, background GPS, and real crowd counts.

### 0.5 How we're judged (official criteria, each scored 1–5, weighted)

| Criterion | Weight | Judges ask | How we win it |
|---|---|---|---|
| **Problem & value** | 30% | Does it solve a meaningful problem for a clear user? | Clear user: BGC Bus office commuters. Clear pain: time and *pagod* lost waiting. Sourced numbers: BGC Bus ~41K riders/day (older figure), EDSA Carousel ~183K/day (2025). |
| **User experience** | 30% | Can someone complete the core task **with confidence**? | Core task = know when to leave. "With confidence" is literally our freshness and confidence chips, Explain-the-math, and the 5-second test. |
| **AI mastery** | 25% | How well is AI used to build the product, **and within it**? | **Build:** every role builds with **Codex** from this shared plan; keep a Codex log (Rule 11). **Within:** the **OpenAI Decisions API** picks the destination and the best Plan B, with visible confidence and a human override. |
| **Thoughtful originality** | 15% | What useful idea or design choice sets it apart? | We answer "when do I leave?", not "where's the bus?"; driver taps as the data source; private by design. |

**Shortlisting happens 3:45–4:15, before any live demo.** The submission (live link, video, description) has to win on its own, so the **submission video is our main weapon**.

---

## 1. Rules (everyone, and every model)

1. **Never wait on anyone.** If you need something that isn't ready, use the **mock or fixture** (Section 4) and keep going.
2. **Stay in your folders** (Section 3). Don't edit files another role owns. Need a change? Post it in the group chat and the owner makes it.
3. **Contracts are frozen at 12:55** (types, config, data shapes). After that, changes may only **add** optional fields, never rename or remove. Announce every change as `CONTRACT CHANGE: ...` in the chat.
4. **Commit small and often.** `git pull --rebase` before every push. Push at least every 30 minutes.
5. **No new dependencies** beyond the scaffold list without telling the group first (it avoids lockfile conflicts).
6. **Feature freeze at 2:30.** After that, only bug fixes, polish and rehearsal.
7. **Behind schedule? Cut from the bottom** of the priority list (Section 2). Never cut P0.
8. **Honesty in the UI:** no fake precision, always show how fresh the data is, never present a guess as fact.
9. **Privacy:** the commuter's coordinates are never sent to any server or AI model. Check this in DevTools before the demo.
10. **When unsure, ask:** "Does this help someone know when to leave?" If not, skip it.
11. **Keep a Codex log.** Note 2–3 moments where Codex built something notable, with a screenshot, and post them in the chat. How AI was used to *build* the product is part of the 25% AI score.

---

## 2. Priorities

| Tier | Feature | Owner |
|---|---|---|
| **P0** | Commuter home: big "Leave in X min" plus walking time to nearest stop | PM / UI, Backend 2 |
| **P0** | Bus phases: waiting at stop ("Bus waiting at [Stop]"), moving (countdown), passed | Backend 2, PM / UI |
| **P0** | Driver app: **Leaving now** and **Bus full** buttons, GPS or simulated movement | Driver / Company |
| **P0** | Live sync: driver tap shows on the commuter phone within about 2 s | Backend 1 |
| **P0** | Route line with smoothly moving bus dot and "You" marker | All-arounder |
| **P0** | Freshness and confidence chip ("Live · 8s ago" / "Schedule estimate") | Backend 2, PM / UI |
| **P0** | Mock mode works with Wi-Fi off (two tabs on one laptop) | Backend 1 |
| **P1** | Plan B card (missed, delayed, full, or no driver signal) | Backend 2, PM / UI |
| **P1** | Crowd chip from **Bus full** and rider reports | Backend 2, Backend 1 |
| **P1** | "Explain the math" sheet (tap the big number) | PM / UI |
| **P0** | **AI destination pick (OpenAI Decisions API):** "need to be at High Street by 9" → editable chips with AI confidence → on-time verdict, with rules fallback | Backend 2, PM / UI |
| **P1** | **AI Plan B chooser (Decisions API):** picks keep waiting / next bus / walk / book a ride, shows why and confidence; rules when unsure | Backend 2, PM / UI |
| **P1** | Offline: last known data cached on the phone | All-arounder |
| **P1** | Installable look (web app manifest, icon, full screen) | All-arounder |
| **P2** | Automatic "I'm on this bus" detection (opt-in) | Backend 2 |
| **P2** | Filipino / Taglish copy toggle | PM / UI |
| **P2** | Real street map view (optional toggle) | All-arounder |
| **P2** | Photo crowd check via Decisions API image input (only if everything else is done; photos of people weaken our privacy story) | Backend 2 |

---

## 3. Stack, structure and ownership

**Stack (decide by 12:40, don't switch later):** React + Vite + TypeScript, Tailwind CSS, Supabase (Postgres + Realtime), deployed on Vercel. In-product AI is the **OpenAI Decisions API** (`POST /v1/decisions`, model `gpt-6-luna`, public beta since 6 Oct 2026) behind a Vercel serverless function at `/api/decide`, so the key stays server-side. The code itself is built with **Codex**. If the team knows Next.js much better, use it, but decide once.

**Scaffold dependencies (install all at once at 12:40):** `react-router-dom`, `@supabase/supabase-js`, `tailwindcss`, `motion` (animations), `lucide-react` (icons), `vitest` (tests).

**Screens:** `/` is the commuter app. `/driver` is the driver app, with a hidden **Demo controls** drawer. There's no separate operator dashboard.

```
/api/decide.ts                    Backend 2        OpenAI Decisions API proxy (server-side key)
/src/contracts/                   frozen 12:55     types.ts, config.ts, clock.ts, fixtures.ts
/src/data/route.json              Driver/Company   stops for ONE route, ONE direction
/src/data/adapter.ts, mock.ts,
          live.ts, session.ts     Backend 1
/src/logic/                       Backend 2        pure functions + tests + useLeavePlan hook + location
/src/ui/                          PM / UI          design tokens, shared components
/src/screens/commuter/            PM / UI
/src/screens/driver/              Driver/Company   driver screen + sim engine + demo drawer
/src/components/RouteLine/        All-arounder
/src/App.tsx, main.tsx, vite/
  vercel/tailwind config          All-arounder     router, scaffold, deploy
/public/manifest.webmanifest      All-arounder
```

---

## 4. Contracts (paste these verbatim at 12:40 to 12:55)

### 4.1 `src/contracts/types.ts`

```ts
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
```

### 4.2 `src/contracts/config.ts`

All numbers are **assumptions to tune**, not measured values.

```ts
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
  DEMO_USER_LOCATION: { lat: 14.5480, lng: 121.0560 },        // PLACEHOLDER
} as const;
```

### 4.3 `src/contracts/clock.ts`

```ts
import { CONFIG } from './config';
// TIME_SCALE speeds up the demo. Use it ONLY for:
// (1) sim bus movement, (2) ticking a countdown between data updates.
// NEVER apply it to timestamps or data age.
export const realNowMs = () => Date.now();
export const worldElapsedSec = (sinceRealMs: number) =>
  ((Date.now() - sinceRealMs) / 1000) * CONFIG.TIME_SCALE;
```

### 4.4 `src/data/route.json` (PLACEHOLDER until Driver/Company replaces it by 12:55)

The coordinates below are **fake**. Replace them with the real stops of one BGC Bus route in one direction, using names and coordinates from Google Maps.

```json
{
  "route_id": "demo-route",
  "name": "[BGC Bus route name]",
  "direction": "[toward ...]",
  "headway_min": 10,
  "service_hours": "[06:00-22:00]",
  "stops": [
    { "stop_id": "s1", "route_id": "demo-route", "name": "[Stop 1]", "lat": 14.5600, "lng": 121.0480, "seq": 1 },
    { "stop_id": "s2", "route_id": "demo-route", "name": "[Stop 2]", "lat": 14.5555, "lng": 121.0490, "seq": 2 },
    { "stop_id": "s3", "route_id": "demo-route", "name": "[Stop 3]", "lat": 14.5510, "lng": 121.0500, "seq": 3 },
    { "stop_id": "s4", "route_id": "demo-route", "name": "[Stop 4]", "lat": 14.5465, "lng": 121.0510, "seq": 4 },
    { "stop_id": "s5", "route_id": "demo-route", "name": "[Stop 5]", "lat": 14.5420, "lng": 121.0520, "seq": 5 },
    { "stop_id": "s6", "route_id": "demo-route", "name": "[Stop 6]", "lat": 14.5375, "lng": 121.0530, "seq": 6 }
  ]
}
```

`headway_min` (10) is also a placeholder. Verify it or label it "approx."

### 4.5 `src/contracts/fixtures.ts`: one `LeavePlan` per state

PM / UI designs every state from these **without waiting for the backend**. Backend 2 uses them as test expectations.

```ts
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
```

### 4.6 Data adapter interface (Backend 1 implements both mock and live)

```ts
export interface DataAdapter {
  getBuses(routeId: string): Promise<BusStatus[]>;
  subscribeBuses(routeId: string, onChange: (buses: BusStatus[]) => void): () => void; // emits the full list
  upsertBus(bus: Omit<BusStatus, 'updated_at'>): Promise<void>;
  addRiderReport(r: Omit<RiderReport, 'created_at'>): Promise<void>;
  getRecentRiderReports(sinceIso: string): Promise<RiderReport[]>;
  subscribeRiderReports(onChange: (reports: RiderReport[]) => void): () => void;
  resetDemo(): Promise<void>;
}
// src/data/adapter.ts exports `data: DataAdapter`, chosen by CONFIG.DATA_MODE
```

---

## 5. Timeline and checkpoints

| Time | Phase | Everyone delivers |
|---|---|---|
| 12:20–12:40 | **Read and align** | Everyone has read Sections 0–4. Stack, route and roles confirmed. |
| 12:40–12:55 | **Foundations** | Repo live and deployed, contracts committed, Supabase ready, route.json real |
| **12:55** | **Checkpoint A** (3 min) | Deploy URL opens on everyone's phone. Contracts frozen. |
| 12:55–1:40 | **Build in isolation** | Every role builds against mocks and fixtures |
| **1:40** | **Checkpoint B: walking skeleton** | Driver taps Leaving now on phone A, and the commuter screen on phone B changes (even if ugly) |
| 1:40–2:30 | **Integrate and P1** | Real logic in UI, Plan B, crowd, AI input, polish |
| **2:30** | **Checkpoint C: FEATURE FREEZE** | All P0 green. Unfinished P1s are cut or become "next steps" in the pitch. |
| 2:30–3:00 | **Polish and rehearse** | Bug fixes, the 5-second test, one full demo rehearsal |
| **3:00–3:20** | **Submission video** | 60–90 s polished demo video (Section 14). This is what gets us shortlisted. |
| 3:20 | Final deploy | Nobody pushes after this unless the PM says so |
| **3:25–3:45** | **Submit** (closes 3:45, aim for 3:35) | Live link, video, description, "Built with Codex" notes |
| 3:45–4:15 | Shortlisting and break | Rehearse the live demo twice; charge both phones |
| 4:15–5:25 | **Finalist demos** | Live demo (Section 14) if shortlisted |

**At each checkpoint, everyone posts in the chat:**
```
[ROLE] Done: ...  | Next: ...  | Blocked: ... (or "none")  | Cutting: ... (if any)
```

---

## 6. Role: PM + UI/UX

**Mission:** make the app feel like the obvious future of commuting. Own the vision, the clock, the screens and the pitch.

**Owns:** `/src/ui/`, `/src/screens/commuter/`, pitch, demo script, submission text, scope decisions.

**Timeline**
- **12:40–12:55:** wireframe every state from the fixtures (paper is fine), set the design tokens, finalize copy (Section 12).
- **12:55–1:40:** build the commuter home screen against `FIXTURES` with a hidden state switcher (`?state=leave_now`).
- **1:40–2:30:** switch from fixtures to `useLeavePlan()` from Backend 2. Add the Plan B card, the Explain-the-math sheet and the AI input bar.
- **2:30–3:00:** polish motion, run the 5-second test, rehearse. **3:00–3:20:** direct the submission video. **3:25–3:35:** submit (form closes 3:45).

**Done when:** every fixture state looks finished, the 5-second test passes, and the demo script has been rehearsed twice.

**Also owns the clock:** call the checkpoints, cut scope, and protect the 2:30 freeze.

> **Paste-to-model prompt (PM + UI/UX)**
> You are building the commuter screen of a mobile-first web app (React + Vite + TS + Tailwind + `motion`). Read BUILD_PLAN.md Sections 0, 1, 4, 11 and 12. Only edit `/src/ui/` and `/src/screens/commuter/`. Build `CommuterHome` that renders a `LeavePlan` (types in `src/contracts/types.ts`). Until `useLeavePlan()` exists, read from `FIXTURES` in `src/contracts/fixtures.ts`, chosen by the URL param `?state=`. Implement every state in the Section 12 copy table, the hero countdown that ticks with `worldElapsedSec(plan.computed_at_real_ms)`, status chips (bus phase, crowd, freshness/confidence), a slot for `<RouteLine/>`, a Plan B card, an "Explain the math" bottom sheet, and a privacy chip. Follow the Section 11 UX rules strictly: glanceable, honest, accessible, smooth and calm motion, `prefers-reduced-motion` respected. Mobile 390×844 first. Do not call any backend directly.

---

## 7. Role: Backend 1 (Data and sync)

**Mission:** make a driver's tap appear on the commuter's phone within about 2 seconds, and keep working when the Wi-Fi doesn't.

**Owns:** `/src/data/adapter.ts`, `mock.ts`, `live.ts`, `session.ts`, the Supabase project, env vars (shared with the All-arounder for Vercel).

**Timeline**
- **12:40–12:55:** create the Supabase project, run the SQL below, share `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` privately with the team.
- **12:55–1:40:** implement `mock.ts` (in-memory + `BroadcastChannel('bus-demo')` + `localStorage`, so two tabs sync with **no internet**) and `live.ts` (Supabase upsert, Realtime subscription, and a **3-second polling fallback** if Realtime drops).
- **1:40–2:30:** rider reports (add, recent, subscribe), `resetDemo()`, `session.ts` (random ID stored in localStorage, renewed daily). Then help with integration and Vercel env vars.
- **2:30–3:10:** stress test (switch tabs, airplane mode, reload) and fix.

**SQL (run once in the Supabase SQL editor)**
```sql
create table bus_status (
  bus_id text primary key,
  route_id text not null,
  lat double precision not null,
  lng double precision not null,
  status text not null check (status in ('waiting','moving','offline')),
  current_stop_id text,
  next_stop_id text,
  arrived_at timestamptz,
  departed_at timestamptz,
  is_full boolean not null default false,
  full_reported_at timestamptz,
  source text not null default 'driver' check (source in ('driver','simulated')),
  updated_at timestamptz not null default now()
);

create table rider_reports (
  id bigint generated always as identity primary key,
  session_id text not null,
  kind text not null check (kind in ('on_bus','waiting')),
  bus_id text,
  stop_id text,
  created_at timestamptz not null default now()
);

-- server time for freshness (avoids phone clock differences)
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
create trigger bus_touch before insert or update on bus_status
for each row execute function touch_updated_at();

alter publication supabase_realtime add table bus_status, rider_reports;

-- DEMO-ONLY open policies. In production, only authenticated drivers can write.
alter table bus_status enable row level security;
alter table rider_reports enable row level security;
create policy demo_read_bus on bus_status for select using (true);
create policy demo_insert_bus on bus_status for insert with check (true);
create policy demo_update_bus on bus_status for update using (true);
create policy demo_read_reports on rider_reports for select using (true);
create policy demo_insert_reports on rider_reports for insert with check (true);
```

**Done when:** in **mock mode**, two tabs (`/driver` and `/`) sync with Wi-Fi off; in **live mode**, two phones sync within about 2 s; and Realtime failure falls back to polling without errors.

> **Paste-to-model prompt (Backend 1)**
> Read BUILD_PLAN.md Sections 0, 1, 4 and 7. Only edit `/src/data/` (except `route.json`). Implement the `DataAdapter` interface from Section 4.6 twice: `mock.ts` (in-memory store, synced across tabs with `BroadcastChannel('bus-demo')`, persisted to `localStorage`, works offline) and `live.ts` (Supabase JS v2: `upsert` on `bus_status`, initial `select`, `postgres_changes` subscription filtered by `route_id`, and a 3-second polling fallback if the channel errors or closes). `adapter.ts` exports `data` chosen by `CONFIG.DATA_MODE`. Add `session.ts` with `getSessionId()` (random, stored in localStorage, renewed daily). Never send or store user coordinates. Don't set `updated_at` from the client. Write small tests for the mock adapter.

---

## 8. Role: Backend 2 (Logic and AI)

**Mission:** turn bus data into a correct, honest "Leave in X min", plus the one AI feature.

**Owns:** `/src/logic/`, `/api/decide.ts`, `/src/logic/useLeavePlan.ts`, `/src/logic/location.ts`.

**Pure functions (all take `now` or ages as parameters so they're testable):**

```ts
haversineMeters(a: LatLng, b: LatLng): number
nearestStop(user: LatLng, stops: Stop[]): { stop: Stop; meters: number }
walkSeconds(meters: number): number                 // meters * ROAD_FACTOR / WALK_SPEED_MPS
busEtaSeconds(bus: BusStatus, target: Stop, stops: Stop[]): { eta_sec: number; stops_away: number } | null
  // null if the bus has passed the target (next stop seq > target seq, or current stop seq > target seq)
  // moving: (dist(bus, next_stop) + sum of segments next_stop..target) * ROAD_FACTOR / BUS_SPEED_MPS
  //         + DWELL_SEC_PER_STOP * intermediate stops
  // waiting at stop X: same from X, as if it left right now ("standby")
confidence(source: string, dataAgeSec: number | null): Confidence  // FRESH_SEC thresholds; 'schedule' = low
urgencyFor(leaveInSec: number | null): Urgency                      // URGENCY_SEC thresholds
crowdLevel(bus: BusStatus, reports: RiderReport[], nowMs: number): { level: CrowdLevel; count: number }
  // is_full and full_reported_at within FULL_TTL_SEC → 'full'
  // else distinct session_ids with kind 'on_bus' for this bus within RIDER_REPORT_TTL_SEC:
  //   0 → 'unknown', 1–3 → 'seats', 4–7 → 'busy', 8+ → 'likely_full'
planB(ctx): PlanB | null
  // missed → next_bus (headway_min) | full → next_bus | standby longer than DELAY_STANDBY_SEC → walk or ride_hail
  // no_signal → next_bus (headway, schedule estimate)
buildLeavePlan(input): LeavePlan                     // combines all of the above
checkArriveBy(plan, rideSecToDest, arriveBy, nowMs): 'on_time' | 'tight' | 'late'   // P1
isRidingBus(track: {lat,lng,t}[], bus: BusStatus): boolean                          // P2, on-device only
```

**Hook:** `useLeavePlan()` gets the user location via `location.ts` (real GPS, or `CONFIG.DEMO_USER_LOCATION` when the URL has `?demo=1`), subscribes through `data`, picks the nearest upcoming bus, and returns a `LeavePlan` that recomputes on every update and every 1 s. If there's no bus row, or the status is `offline`, it returns the `no_signal` plan from the schedule.

**AI in the product: OpenAI Decisions API (destination = P0, Plan B = P1)**

Why this API: it **picks from answers we define** instead of writing free text, returns **confidence**, and is fast and cheap (reported at $0.10 per 1M input tokens, no output charge). That matches our principle: **AI understands, math decides.**

- **API facts (from launch coverage, verify in the official docs):** `POST /v1/decisions`, model `gpt-6-luna`, public beta since 6 Oct 2026. You send shared evidence (text, or inline images) plus an array of questions. Question types: **choice** (pick one option), **predicate** (true/false), **score** (ordered levels). Choice and score answers include probabilities. Independent questions can go in one request.
- **First thing at 12:40:** open OpenAI's official Decisions API docs, copy the exact request and response format, and make **one test call** with the team key. Earlier preview users got a "not enabled for this user" error, so confirm access before building on it. Post the result in the chat.
- **Our proxy:** `POST /api/decide` (Vercel function; key in `OPENAI_API_KEY`, never in the browser).
  - Body: `{ decision: 'destination' | 'plan_b', evidence: string, options: string[] }`
  - Returns: `{ answer: string, confidence: number | null, decided_by: 'decisions_api' | 'responses_api' | 'rules' }`
- **Never put coordinates in the evidence.** Evidence is the typed text or computed facts only.

**Decision 1, destination (P0, a choice question)**
- Question: "Which stop is the commuter heading to?"
- Options: every stop name on the route, plus "Unclear".
- Evidence: the commuter's typed text only (English, Filipino or Taglish).
- `arrive_by` is parsed **on the device** with a regex ("9", "9am", "9:30", "alas-9"), not by AI.
- Confidence below `AI_CONFIDENCE_MIN`, or "Unclear" → the UI asks "Did you mean [A] or [B]?" with tappable chips instead of guessing.

**Decision 2, Plan B (P1, a choice question)**
- Question: "What should this commuter do next?"
- Options: "Keep waiting", "Take the next bus", "Walk", "Book a ride".
- Evidence is facts only, for example: "Bus has been stopped at [Stop 3] for 4 minutes. Driver marked the bus full. Next bus in about 10 minutes. Walking to [Stop 6] takes 14 minutes. Commuter must arrive by 9:00; it is 8:41. Commuter note: 'may dala akong mabigat' (carrying something heavy)."
- Confidence at or above the threshold → show the AI pick, a one-line "why", and the other options one tap away. Below → use `planB()` rules.

**Fallback chain (build in this order so nothing blocks)**
1. **Rules first:** keyword stop match, regex time, `planB()`. Ship by 1:40.
2. **Decisions API** on top of the rules.
3. If the Decisions API isn't enabled for our key: the **Responses API** with `gpt-6-luna`, reasoning effort none, and a strict JSON schema whose only field is an enum of the same options. Same proxy, same response shape.

Shared instruction (question context for the Decisions API, or system prompt for the Responses API fallback):
```
You help BGC Bus commuters in Bonifacio Global City, Philippines.
Messages may be in English, Filipino or Taglish.
Pick exactly one of the provided options. Never invent an option.
If the message doesn't clearly name or describe a stop, pick "Unclear".
Examples:
"need to be at [Stop 4] by 9" -> "[Stop 4]"
"pauwi na ko" -> "Unclear"
```

**Timeline**
- **12:40–12:50:** read the Decisions API docs, make one test call with the team key, post the result.
- **12:50–1:20:** pure functions and tests (vitest) against the fixtures' expected states, including the rules fallbacks.
- **1:20–1:40:** `location.ts` and `useLeavePlan()` with the mock adapter.
- **1:40–2:30:** `/api/decide` (destination first, then Plan B), crowd, and `checkArriveBy`.

**Done when:** tests pass, the hook drives the real commuter screen through standby, moving, leave now and missed during a simulated run, the destination pick works through the Decisions API (or its fallback) with confidence returned, and no user coordinates appear in any network request.

> **Paste-to-model prompt (Backend 2)**
> Read BUILD_PLAN.md Sections 0, 1, 4 and 8. Only edit `/src/logic/` and `/api/decide.ts`. Implement the pure functions listed in Section 8 exactly as specified, using constants from `CONFIG` and types from `src/contracts/types.ts`, with vitest tests. Then implement `location.ts` (GPS via `navigator.geolocation`, demo override with `?demo=1`) and the React hook `useLeavePlan()` that uses `data` from `src/data/adapter.ts` and returns a `LeavePlan`, recomputing every second and on each update, with the `no_signal` schedule fallback. Then build `/api/decide.ts`, a Vercel serverless function that calls the OpenAI Decisions API (`POST /v1/decisions`, model `gpt-6-luna`; I will paste the exact request format from the official docs) for the two choice decisions in Section 8, and returns `{ answer, confidence, decided_by }`. Fall back to the Responses API with a strict enum JSON schema, then to the rules. Keep the API key server-side. User coordinates must never be sent to any server or model. The logic returns codes, not UI copy.

---

## 9. Role: Driver / Company

**Mission:** make the driver side believable, safe and demo-able, and own the operator story.

**Owns:** `/src/data/route.json`, `/src/screens/driver/` (screen, sim engine, demo drawer), the operator and safety answers in the pitch.

**Timeline**
- **12:40–12:55:** pick ONE BGC Bus route, ONE direction, 5–8 stops. Fill in `route.json` with real names and coordinates from Google Maps. Check `headway_min` if possible, or mark it as approximate.
- **12:55–1:40:** driver screen and sim engine (spec below), writing through `data.upsertBus`.
- **1:40–2:30:** demo drawer, safety lock, haptics, undo.
- **2:30–3:20:** rehearse being "the driver"; play the driver in the submission video.

**Driver screen spec**
- Full screen, high contrast, readable at arm's length. The top shows the route name and next stop.
- **One giant primary button** (at least 40% of the screen):
  - When waiting: **LEAVING NOW** → status `moving`, `departed_at` set.
  - When moving: auto-arrives within 40 m of the next stop (sim: on reaching it), and a manual **ARRIVED** fallback appears.
- **BUS FULL** toggle (sets `is_full` and `full_reported_at`), clearly on or off, with text and not just color.
- **Safety lock:** buttons disabled while GPS speed is above about 5 km/h, labeled "Unlocks when stopped." In sim mode, locked while moving.
- **Feedback:** vibration (`navigator.vibrate`), a "Sent ✓ · live" indicator, and a 5-second **Undo**.
- GPS: `watchPosition`, write at most every 3 s or every 15 m.

**Sim engine (`sim.ts`)**
- Moves the bus along straight segments between stops at `BUS_SPEED_MPS × TIME_SCALE`, writing its position every 1 s with `source: 'simulated'`.
- On reaching a stop, sets `waiting` and `arrived_at`, then **waits for the driver's Leaving now tap** (or auto-departs if that toggle is on).

**Demo drawer** (hidden: triple-tap the route name)
- Simulate on/off, auto-depart on/off, place bus at stop N.
- **Inject delay** (hold at the current stop beyond `DELAY_STANDBY_SEC`, which triggers Plan B).
- **Kill signal** (set `offline`, which triggers the schedule fallback).
- **Add 6 riders** (writes 6 `on_bus` rider reports with random session IDs, which changes the crowd level).
- **Reset demo** (`data.resetDemo()`).

**Operator story (give the PM by 2:30):** why BGC Bus would adopt this (fewer complaints, better ridership data, no hardware cost), why drivers will tap (it's part of the job, one tap per stop, only while stopped), and safety (taps locked while moving).

**Done when:** a teammate can "drive" the bus through 3 stops live, every demo drawer action works, and buttons lock while moving.

> **Paste-to-model prompt (Driver / Company)**
> Read BUILD_PLAN.md Sections 0, 1, 4 and 9. Only edit `/src/screens/driver/` and `/src/data/route.json`. Build the `/driver` screen exactly as the Section 9 spec describes (giant primary button LEAVING NOW / ARRIVED, BUS FULL toggle, safety lock while moving, vibration, Sent indicator, 5-second Undo), writing through `data.upsertBus` from `src/data/adapter.ts`. Build `sim.ts`, which moves the bus along straight segments between stops at `CONFIG.BUS_SPEED_MPS * CONFIG.TIME_SCALE`, writes every 1 s, and waits at each stop for the driver's tap. Build the hidden demo drawer (triple-tap the route name) with: simulate, auto-depart, place bus at stop, inject delay, kill signal, add 6 rider reports, reset demo. Use large touch targets and high contrast; it must be usable at a glance.

---

## 10. Role: All-arounder

**Mission:** keep the team shipping. Scaffold, deploy, build the route visual, and catch bugs early.

**Owns:** scaffold, `App.tsx` router, configs, Vercel deploy, `/src/components/RouteLine/`, `manifest.webmanifest`, the offline cache, QA, the backup video.

**Timeline**
- **12:40–12:55:** scaffold the repo with all dependencies (Section 3), paste the contracts (Section 4), set up routes `/` and `/driver` with placeholder screens, **deploy to Vercel**, and share the URL. Everyone can then pull.
- **12:55–1:40:** `RouteLine`: a schematic transit line (not a street map) with stops as dots, your stop highlighted with a "You" marker and a dashed walking leg, and the bus dot **interpolating smoothly** between updates (about 1 s ease). Build it against fake `BusStatus` data first.
- **1:40–2:30:** web app manifest (name, icon, theme color, `display: standalone`), offline cache of `route.json` and the last `LeavePlan` (`localStorage`), and an offline banner. Then QA on two real phones.
- **2:30–3:00:** bug bash, checking every item in Section 13 on phones. **3:00–3:20:** record and edit the submission video with the PM (it doubles as the backup).

**Done when:** the deploy URL works on every phone, the route line animates smoothly with no jumps, and the backup video is saved in two places.

> **Paste-to-model prompt (All-arounder)**
> Read BUILD_PLAN.md Sections 0, 1, 3, 4, 10 and 11. First scaffold a React + Vite + TypeScript + Tailwind app with `react-router-dom`, `@supabase/supabase-js`, `motion`, `lucide-react` and `vitest`; add the contract files from Section 4 verbatim; set routes `/` (CommuterHome) and `/driver` (DriverHome) with placeholders; prepare it for Vercel. Then build `RouteLine` (props in `RouteLineProps`): a schematic SVG transit line, stops in order, the user's stop highlighted with a "You" marker and a dashed walking leg, bus dots positioned by projecting lat/lng onto the line and animated smoothly between updates with `motion`, accessible labels, `prefers-reduced-motion` respected. Then add a web app manifest and a localStorage cache of the route and last plan, plus an offline banner.

---

## 11. World-class UX: the bar for this hackathon

This is a **UX+AI** event, so the UI is judged as hard as the idea. The bar: **a stranger understands the screen in 3 seconds and trusts it.**

### 11.1 Experience pillars
1. **One question, one answer.** The home screen answers "When do I leave?" before anything else. No searching, no map reading, no taps needed.
2. **Glanceable.** The biggest thing on screen is a number. Readable at arm's length, in sunlight, while walking.
3. **Honest.** Always show how fresh the data is and how sure we are. "~6 min" beats "6:13." When we're guessing, say so.
4. **Calm, then urgent.** Quiet when you have time; impossible to miss when it's time to go.
5. **Explainable.** Tap the number to see the math. Trust comes from transparency, especially with AI.
6. **Private by design, and visibly so.** A small, permanent lock chip: "Your location stays on this phone."
7. **Local warmth.** Friendly, human copy, with a Filipino touch where it adds charm ("Alis na!").

### 11.2 Commuter home layout (mobile 390×844)
1. **Hero (top ~45%):** "Leave in" plus a **giant number** (tabular numerals, about 120–160px) plus "min". Below it: "to catch the bus at [Stop] · 4 min walk". The background color follows urgency.
2. **Status chips row:** bus phase ("Bus waiting at [Stop]" / "2 stops away"), crowd ("Busy · 5 riders reported"), freshness ("Live · 8s ago" or "Schedule estimate").
3. **RouteLine:** the schematic line, the bus dot, "You" and a dashed walking leg.
4. **Plan B card:** slides up only when needed, with one clear alternative and one tap.
5. **Bottom bar:** AI input "Where to? e.g. High Street by 9" and the privacy chip.

### 11.3 Signature moments (what judges will remember)
1. **The "Leave now" takeover:** the hero crossfades to the urgent color (about 400 ms), the number becomes **"Alis na!" / "Leave now"**, the phone vibrates once, and the bus dot pulses. Nothing else on screen moves.
2. **The live tap:** when the driver taps Leaving now, a subtle toast on the commuter phone says "Bus just left [Stop]", and the countdown starts. It's visible proof the data is real.
3. **Explain the math:** tap the number to get a bottom sheet: "Bus arrives in 9 min − 4 min walk − 1 min buffer = **leave in 4 min**. Live from the driver, updated 6s ago."
4. **AI you can see and correct:** typing "need to be at High Street by 9" shows chips **[To: High Street ✎] [Arrive by 9:00 ✎]** and a verdict: "✓ This bus gets you there by 8:52." Each chip is tappable to fix. When the Decisions API is unsure, it asks "Did you mean [A] or [B]?" instead of guessing. When it picks a Plan B ("Walk · 14 min"), the card says why in one line and keeps the other options one tap away. **AI suggests, shows its confidence, and you stay in control.**
5. **Opt-in that respects you:** a sheet explains "Help others see how full the bus is. We send '+1 on this bus', never your location." Buttons: **[Count me in] [No thanks]**, both equally prominent.

### 11.4 Visual direction (PM decides; this is a starting point)
- **Feel:** transit signage meets a calm modern app: bold numerals, generous space, few colors.
- **Type:** one condensed display face for numbers (e.g. Oswald or Barlow Condensed) and one clean UI face (e.g. Public Sans or Inter). Tabular numerals for all times.
- **Urgency colors, always with a text label too:**
  - relax: calm teal or green
  - get_ready: amber
  - leave_now: strong orange-red with white text
  - missed: muted slate
  - low confidence: grey plus a dashed outline
- **Light mode first** (sunlight readability), dark mode as a bonus.

### 11.5 Motion rules
- The countdown number rolls between values, never jumps.
- The bus dot interpolates between updates (about 1 s ease-out), never teleports.
- Urgency changes crossfade in about 400 ms. Only one thing animates at a time.
- Honor `prefers-reduced-motion`: swap animations for instant changes.

### 11.6 Accessibility checklist
- Text contrast at least 4.5:1 (3:1 for very large numbers).
- Meaning never relies on color alone; every state has words.
- The hero number sits in an `aria-live="polite"` region; it announces "Leave in 4 minutes" when the minute changes, not every second.
- Touch targets at least 44×44 px (driver buttons far larger).
- Works at 200% text size without overlapping.

### 11.7 Onboarding (2 taps max)
1. One sheet: "We use your location **on this phone only** to find your nearest stop." **[Allow location] [Pick my stop instead]**
2. Home screen. Done.

### 11.8 Anti-patterns (don't do these)
- A full-screen map as the main view (it makes us look like every other tracker).
- Fake precision ("6:13:42"), or spinners with no text.
- Dashboards, settings walls, sign-up forms.
- Color-only status, tiny text, or a dark pattern on the location permission.
- More than one animation at once.

### 11.9 The 5-second test (run at every checkpoint)
Show the screen to someone for 5 seconds, then hide it. Ask: "When should you leave, and why?" If they can't answer, simplify.

---

## 12. Copy table (every state)

| State | Big line | Sub line | Filipino accent (optional) |
|---|---|---|---|
| relax | Leave in 12 min | Bus is 2 stops away · 4 min walk to [Stop] | Chill ka muna |
| get_ready | Leave in 4 min | Start packing up · 4 min walk | Maghanda na |
| leave_now | Leave now | Walk to [Stop] · bus arrives in ~5 min | **Alis na!** |
| standby | Leave in ~6 min or later | Bus is still waiting at [Stop] | Naghihintay pa ang bus |
| missed | You'll miss this one | Next bus in ~10 min | Hindi na aabot |
| full | This bus is full | Reported by the driver 2 min ago · next bus ~10 min | Puno na |
| delayed | Bus is running late | Still at [Stop] for 4 min · walking takes 14 min | Na-delay ang bus |
| no_signal | A bus comes every ~10 min | No live bus right now · schedule estimate | Walang live na bus |
| offline | Last known: leave in ~5 min | You're offline · showing saved info from 2 min ago | Offline ka |
| location_off | Pick your stop | We'll still tell you when to leave | — |

Freshness chip: "Live · 8s ago" (high), "Updated 1 min ago" (medium), "Schedule estimate" (low).
Crowd chip: "Seats likely · 2 riders reported", "Busy · 5 riders reported", "Likely full · 9 riders reported", "Full · driver reported 3 min ago". **Never show a passenger count.**

---

## 13. Demo-ready checklist (all P0 must pass by 2:30)

- [ ] Opening `/` on a phone shows an answer in under 2 s, and the 5-second test passes.
- [ ] Driver taps **Leaving now** → commuter phone updates in about 2 s (live mode).
- [ ] The countdown ticks smoothly, and the bus dot moves without jumping.
- [ ] Standby shows "Bus waiting at [Stop]".
- [ ] Bus passes your stop → "You'll miss this one" plus Plan B.
- [ ] **Bus full** tap → crowd chip "Full · driver reported just now". (P1)
- [ ] **Kill signal** → schedule estimate with the low-confidence chip.
- [ ] **Inject delay** → delayed Plan B card. (P1)
- [ ] Explain-the-math numbers add up correctly. (P1)
- [ ] Mock mode works with Wi-Fi off (two tabs on one laptop).
- [ ] DevTools Network: **no user coordinates** in any request.
- [ ] AI: "need to be at [Stop] by 9" → Decisions API picks the stop with confidence → chips → verdict; low confidence asks "Did you mean…?"; works without a key via fallback. (P0)
- [ ] AI Plan B: inject a delay → AI pick with a one-line "why" and the other options one tap away. (P1)
- [ ] Submission video (60–90 s, captioned) exported, uploaded, and saved in two places.
- [ ] Live link opens on a fresh phone that has never visited it.

---

## 14. Demo plan

**Setup:** Phone A runs `/driver` with sim on (held by Driver / Company). Phone B runs `/?demo=1` (commuter, mirrored to the projector if possible). The laptop has both tabs open in mock mode as a backup, plus the backup video. `VITE_TIME_SCALE` is around 6–8 so the bus moves visibly.

**Script (about 2 minutes, PM narrates)**
1. **Hook (15 s):** "Every BGC commuter knows this: you rush to the stop, then wait. Pagod. Apps show where the bus is, but not when *you* should leave."
2. **Calm state (15 s):** commuter screen: "Bus waiting at [Stop 2]. Leave in about 6 min or later."
3. **Live tap (20 s):** the driver taps **Leaving now**. The commuter phone instantly shows "Bus just left [Stop 2]" and the countdown starts.
4. **Signature moment (20 s):** the countdown reaches the leave-now takeover. "Alis na!" with a vibration. Tap the number to explain the math.
5. **Crowd and Plan B (20 s):** the driver taps **Bus full** → crowd chip, then Plan B: "Next bus in ~10 min."
6. **AI (20 s):** type "kailangan nasa [Stop 6] ako by 9" → the OpenAI Decisions API picks the stop → chips → "✓ You'll make it." Then **inject a delay** → the AI Plan B suggests "Walk · 14 min" and says why.
7. **Data and privacy (15 s):** "Drivers' phones are the data. No hardware. It works on day one. It gets smarter as commuters opt in, and it never sends your location. We track buses, not people."
8. **Close (10 s):** "One operator can switch this on tomorrow. Next: EDSA Carousel, about 183,000 riders a day."

**Submission video (60–90 s, recorded 3:00–3:20; this is what gets us shortlisted)**
1. **0–10 s:** the problem, with real footage or a photo of a BGC Bus stop queue plus the line "You can see where the bus is. Not when to leave."
2. **10–40 s:** split screen with the driver phone and the commuter phone: Leaving now tap → instant update → countdown → "Alis na!" takeover.
3. **40–60 s:** AI: typed Taglish trip → Decisions API pick with chips → delay → AI Plan B with its "why".
4. **60–75 s:** "We track buses, not people," plus Explain-the-math.
5. **75–90 s:** "Built by five people in parallel with Codex" (2 quick Codex log shots) → team name and live link.
- Add captions (judges may watch muted). Show the real app, not mockups.

---

## 15. Judge Q&A (one sentence each)

- **Where does real data come from?** "The driver's phone: its GPS plus two taps. No hardware, and one operator decision rolls it out."
- **Isn't this just mock data?** "Only the bus movement is simulated for the stage. The sync, logic, alerts and Plan B are all real."
- **Why not Rush PH or Moovit?** "They show where the bus is. We tell you when to leave, explain why, and give you a Plan B."
- **Why would drivers tap?** "It's part of the job, one tap per stop, and buttons only work while stopped."
- **Isn't tapping while driving dangerous?** "Buttons lock while the bus moves; GPS is automatic."
- **How do you know crowding?** "The driver's Full button, plus opt-in rider reports. We show a level, never a fake count."
- **Privacy?** "Your location never leaves your phone. Riders who opt in send only '+1 on this bus', with a random ID that resets daily."
- **What's the AI doing?** "OpenAI's Decisions API picks from answers we define, like which stop you mean or the best Plan B, with a confidence score. The timing math stays deterministic, and you can always override it."
- **Why the Decisions API instead of a chatbot?** "Commuters need a decision, not a paragraph. It's fast, returns confidence, and can't invent options."
- **How did you use AI to build it?** "Five of us built in parallel with Codex from one shared plan file: [fill in 2–3 real examples from the Codex log]."
- **How does it scale?** "Same engine, more routes. EDSA Carousel is next."
- **What if the driver's signal drops?** "We fall back to the schedule and say so with a low-confidence label."

---

## 16. Risks and fallbacks

| Risk | Fallback | Owner |
|---|---|---|
| Venue Wi-Fi dies | Mock mode, two tabs on one laptop, no internet needed | Backend 1 |
| Supabase Realtime doesn't fire | 3-second polling fallback | Backend 1 |
| GPS denied or indoors | `?demo=1` uses the demo location | Backend 2 |
| Decisions API not enabled for our key (beta) | Responses API with `gpt-6-luna` and a strict enum schema, then rules | Backend 2 |
| No AI key, or the API fails | Rules: keyword stop match, regex time, `planB()` | Backend 2 |
| Submission form closes at 3:45 | Aim to submit by 3:35; the video is ready by 3:20 | PM |
| Deploy breaks late | Run locally on the laptop, plus the backup video | All-arounder |
| Behind at 2:30 | Cut P1 items from the bottom and mention them as "next steps" | PM |
| Merge conflicts | Folder ownership, pull before push, small commits | Everyone |

---

## 17. Open items to confirm at 12:40

- [ ] Stack confirmed (Vite + React, or Next.js).
- [ ] Demo route and direction chosen, `route.json` real by 12:55.
- [ ] `headway_min` verified, or labeled approximate.
- [ ] OpenAI key ready, and the **Decisions API test call passes** (Backend 2, 12:40–12:50). If not, use the Responses API fallback.
- [ ] **Codex log** started: everyone posts 2–3 notable Codex moments with screenshots (feeds the 25% AI score).
- [ ] App name (ideas: "Alis Na", "Sakto"; check that the name isn't already taken).
- [ ] Who presents, and who plays the driver.
