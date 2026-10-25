# Prompt for Claude Opus 5.5 — Commuter home redesign

Copy everything below the line into a new Opus 5.5 session.

---

Read `BUILD_PLAN.md` (or `AGENTS.md`) Sections 0, 1, 4, 6, 11, and 12.

You are building for a UX+AI hackathon. I am the **PM + UI/UX**. Follow Section 1 (Rules) and my role section only. **Only edit** `/src/ui/` and `/src/screens/commuter/`. Contracts in Section 4 are frozen — do not rename or remove fields. You may add optional fields only if you announce `CONTRACT CHANGE:` in the PR description.

## Product north star (do not lose this)

Commuters waste time and energy (*pagod*) waiting at bus stops. The app answers one question in one glance: **"When do I leave?"**  
We track buses, not people. The commuter’s location never leaves their phone. Always show freshness/confidence. Never fake precision.

## IMPORTANT: layout override (PM wins)

Ignore the previous Section 11.2 layout and the current screen’s schematic `RouteLine` / chip-stack composition. The PM wants a **new first-viewport composition**:

```
┌─────────────────────────────┐
│  LEAVE IN                   │  ← top: the answer, dominant type
│       12                    │
│     MINUTES                 │
│  short subline only         │
├─────────────────────────────┤
│                             │
│     BIG 3D ROUTE MAP        │  ← middle: the visual heart of the app
│     (edge-to-edge)          │
│                             │
├─────────────────────────────┤
│  [ primary actions ]        │  ← bottom: app buttons / controls
│  [ secondary actions ]      │
└─────────────────────────────┘
```

This is an intentional override of the “no full-screen map” anti-pattern in Section 11.8. The map is **not** a generic tracker map — it exists to make the leave-time answer feel real and situated. The number still wins the glance test; the map supports it.

## Exact composition rules

### 1) Top — Leave-time hero (not a card floating over a dashboard)

- First thing on screen: **LEAVE IN** + giant number + **MINUTES** (or the leave-now / missed / no-signal variants from the Section 12 copy table).
- Brand can sit small in a top bar, but must not overpower the leave-time answer.
- Keep urgency as background/atmosphere behind or around the top zone (relax / get_ready / leave_now / missed / low confidence), always with a text label too — never color alone.
- One short supporting subline under the number (walk time + stop, or the Section 12 sub line). No chip clusters, no stats strip, no schedule widgets in this top zone.
- Tap the number → existing Explain-the-math bottom sheet (keep that behavior).
- Countdown still ticks with `worldElapsedSec(plan.computed_at_real_ms)`. Never round leave minutes up. Standby does not tick (“if the bus left right now”).

### 2) Middle — Big 3D map of the route (the main visual)

- Dominant, edge-to-edge (or near full-bleed within the phone frame). Not a small inset card. Not a side panel. Not a tiled collage.
- Show the **BGC bus route in 3D**: the path, stops, the moving bus, and “You” / walking relationship to the boarding stop.
- Feel: real place / atmosphere — Bonifacio Global City transit, daylight, calm. Not a purple glow dark-mode cyber map. Light mode first.
- Bus position updates should feel smooth (interpolate; respect `prefers-reduced-motion`).
- On leave-now, the bus marker can pulse; don’t animate everything at once.
- Accessibility: the map needs a text alternative / aria label that still answers where the bus is relative to the user. Meaning cannot rely on the map alone.
- If a real Mapbox/MapLibre/Three dependency is required, **do not silently add it** — Rule 5: no new dependencies without telling the group. Prefer:
  1. CSS/SVG/canvas stylized 3D-looking route stage that needs no new deps, **or**
  2. propose the smallest dependency in the PR and gate it so the app still builds without keys.
- Until All-arounder’s real `<RouteLine/>` / map owns this slot, replace `RouteLineSlot` with this new 3D map stage inside PM-owned folders. Keep a clear component boundary so All-arounder can later swap the engine.

### 3) Bottom — App buttons

A clear control dock under the map. Not a junk drawer. Primary actions the commuter actually needs:

Must-have buttons / controls:
- **Where to?** (opens/focuses destination input — keep the AI trip flow UI; editable chips, clarify when unsure)
- **Explain** (same as tapping the number — open the math sheet)
- When Plan B exists: one **primary Plan B CTA** (e.g. “Take next bus” / “Walk 14 min”) plus a way to see other options
- Persistent privacy affordance (lock): “Your location stays on this phone”

Optional if it still feels calm:
- Freshness as a single quiet label near the bottom or as a small status under the hero — not a row of three competing chips in the first glance

Avoid:
- Floating badges/stickers on top of the 3D map
- Card spam
- More than one motion competing with the map
- Fake passenger counts
- Dashboards, settings walls, sign-up

## States you must still support

Keep every fixture/copy state working via `?state=` (hidden switcher when the param is present):

`relax` · `get_ready` · `leave_now` · `standby` · `missed` · `full` · `delayed` · `no_signal` · `offline` · `location_off`

Use Section 12 copy. Filipino accents (“Alis na!”, “Chill ka muna”, etc.) stay as warmth, not clutter.

Special moments to preserve:
- Leave-now takeover (color + “Alis na!” / “Leave now”, one vibration after user activation)
- Live-tap toast when standby → moving: “Bus just left [Stop]”
- Explain-the-math numbers must still add up (bus − walk − buffer = leave)

## Technical constraints

- Stack: React + Vite + TS + Tailwind + `motion` + `lucide-react`
- Mobile-first **390×844**
- Data: keep reading `LeavePlan` from fixtures through `useFixturePlan()` / `?state=` until Backend 2’s `useLeavePlan()` exists — do not call backends directly
- Do not edit `src/contracts/`, `src/data/`, `src/components/`, `src/App.tsx`, driver screens, or package.json unless the group already approved a dependency
- Keep `view.ts` as the copy/math source of truth; update it if the new layout needs different presentation models, and keep/extend vitest coverage
- Honor `prefers-reduced-motion`
- Contrast ≥ 4.5:1 (3:1 only for the giant number if truly large)
- Works at 200% text size without horizontal overflow

## Visual direction (starting point — refine, don’t go generic)

- Transit signage × calm modern mobility app
- Display face for the number (already: Barlow Condensed); clean UI face (Public Sans)
- Urgency atmospheres: teal/green relax · amber get_ready · strong orange-red leave_now · muted slate missed · grey + dashed for low confidence
- Light mode first
- Map should feel like a **real visual anchor** (route through BGC), not a decorative gradient blob

## Definition of done

1. First viewport reads as one composition: **Leave in X minutes → big 3D route map → buttons under it**
2. 5-second test still passes: stranger can say when to leave and why
3. Every `?state=` fixture still looks intentional
4. Explain sheet, Plan B, trip bar, privacy, toast, leave-now takeover still work
5. `tsc`, lint, build, and view tests pass
6. Screenshots at 390×844 for at least: `relax`, `leave_now`, `standby`, `delayed`, `no_signal`
7. Short PR note listing any PM-owned files changed and any dependency ask for the group

## Out of scope

- Driver app
- Real Supabase / Decisions API wiring
- Editing frozen contracts (except optional additive fields, announced)
- Rewriting the pitch/submission docs

Start by inspecting the current `src/screens/commuter/` and `src/ui/` implementation, then redesign the composition in place. Prefer evolving `CommuterHome` + extracting a `RouteMap3D` (or similarly named) stage over a ground-up rewrite of the working copy/math layer.
