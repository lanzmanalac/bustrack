# Team handoff — PM / UI · 25 Oct 2026, ~1:10 Asia/Manila

**Who I am:** PM + UI/UX  
**What I own:** `src/ui/`, `src/screens/commuter/`, pitch, demo script, scope  
**PR:** https://github.com/lanzmanalac/bustrack/pull/1 · branch `cursor/commuter-home-c34d`

---

## 1. What just shipped

The **commuter home screen** is built and reviewable. It does **not** talk to any backend yet. It reads from `FIXTURES` in `src/contracts/fixtures.ts`, switched by a URL param.

| Open this | You should see |
|---|---|
| `/?state=relax` | Leave in ~12 min · Chill ka muna · Live chip |
| `/?state=get_ready` | Amber hero · Maghanda na |
| `/?state=leave_now` | Orange-red **Alis na!** takeover · bus dot pulses |
| `/?state=standby` | ~4 min or later · Bus waiting at [Stop 2] |
| `/?state=missed` | You'll miss this one · Plan B: next bus |
| `/?state=full` | This bus is full · Plan B |
| `/?state=delayed` | Bus is running late · Plan B: Walk 14 min |
| `/?state=no_signal` | Schedule estimate · dashed low-confidence outline |
| `/?state=offline` | Last known · You're offline |
| `/?state=location_off` | Pick your stop chips |

A row of state buttons appears at the top **only when `?state=` is present**. That switcher is for design review, not the demo.

**Already in the UI (works against fixtures):**
- Hero countdown that ticks between updates (`worldElapsedSec`)
- Freshness + crowd + phase chips
- Tap the big number → “How we worked this out” sheet (math always adds up)
- Plan B card with other options one tap away
- “Bus just left [Stop]” toast when standby → moving
- Privacy chip: “Your location stays on this phone”
- “Where to?” trip bar UI (keyword stand-in only — not real AI yet)
- Placeholder route line until All-arounder’s `<RouteLine/>` lands

**Checks I ran:** `tsc`, lint, production build, 22 unit tests on the copy/math layer. Screenshots are on the PR.

---

## 2. What each of you should do next

### All-arounder — do these first (unblocks everyone)

1. **Merge or land the scaffold + get a Vercel URL** that opens on phones. Share the URL in chat.
2. Build real **`<RouteLine/>`** in `src/components/RouteLine/` per Section 10.
3. **Integration ask for me:** `LeavePlan` does not carry `BusStatus[]`. Please either:
   - have Backend 2’s `useLeavePlan()` also return `{ plan, buses }`, **or**
   - pass buses another way the screen can consume.
4. Until that lands, keep my `RouteLineSlot` — I’ll swap it for yours in one place: `CommuterHome.tsx`.
5. Manifest / offline cache can wait until after Checkpoint B.

### Backend 1 — data + sync

1. Ship **mock adapter** that syncs `/` and `/driver` via `BroadcastChannel('bus-demo')` with Wi-Fi off.
2. Ship **live adapter** (Supabase) + 3s polling fallback.
3. Export `data` from `src/data/adapter.ts` chosen by `CONFIG.DATA_MODE`.
4. **Do not store or send user coordinates.** Ever.
5. When mock works two-tab offline, post in chat: `[Backend1] mock sync OK`.

### Backend 2 — logic + AI (I need you most for integration)

1. Pure functions + vitest against fixtures (Section 8).
2. Ship **`useLeavePlan()`** that returns a `LeavePlan` and recomputes every 1s.
3. **Wire into my screen** — one-line swap in `CommuterHome.tsx`:
   - today: `useFixturePlan()`
   - after you: `useLeavePlan()` (and keep `?state=` switcher behind a flag or only when fixtures mode)
4. Also return **`buses`** (or equivalent) so All-arounder’s RouteLine has positions.
5. Destination AI via `/api/decide`:
   - replace my `resolveTripStub` in `src/screens/commuter/tripStub.ts`
   - my trip bar already shows editable chips + “Did you mean…?” — feed it a real `TripIntent`
   - never send coordinates in evidence
6. Optional contract add (announce as `CONTRACT CHANGE:` if you do it):
   - `full_reported_age_sec` on `LeavePlan` so copy can say “driver reported 2 min ago”

### Driver / Company

1. Fill real **`route.json`** (one BGC route, one direction, 5–8 real stops) by Checkpoint A freeze.
2. Build `/driver` with LEAVING NOW / BUS FULL / sim / demo drawer (Section 9).
3. Write through `data.upsertBus` — don’t invent your own store.
4. When your Leaving now tap changes my screen (even ugly), shout Checkpoint B.

---

## 3. How we integrate (don’t invent a new path)

```
Driver taps Leaving now
  → data.upsertBus (Backend 1)
  → useLeavePlan() recomputes (Backend 2)
  → CommuterHome re-renders (PM / UI)   ← already built against LeavePlan shape
```

**Contracts are frozen after Checkpoint A.** Only add optional fields. Never rename/remove. Announce every change as:

```
CONTRACT CHANGE: <what> · reason · who needs to pull
```

---

## 4. What I still own (don’t wait on me for your P0)

| Item | When |
|---|---|
| Location onboarding sheet (“Allow location / Pick stop”) | after `useLeavePlan` lands |
| Rider opt-in sheet (“+1 on this bus”) | P1 / after Checkpoint B |
| Swap RouteLineSlot → real RouteLine | when All-arounder ships props |
| Wire real AI trip intent | when Backend 2 ships `/api/decide` |
| Pitch + demo script + submission text | 2:30–3:35 |
| Call checkpoints / cut scope / protect 2:30 freeze | ongoing |

**Not cutting yet:** P0 AI destination pick.  
**First to cut if behind:** Filipino toggle (P2), photo crowd (P2), then offline polish.

---

## 5. Demo / review tips for everyone

1. Phone or Chrome device mode at **390×844**.
2. Open `/?state=leave_now` once and **tap the screen** — browsers block vibration until the first tap.
3. Prefer light mode / sunlight; we designed light-first.
4. Privacy check before any demo: DevTools → Network → **no user lat/lng in any request**.
5. App name on the scaffold is currently `sakaykita` — we’ll lock the public name later (ideas still: Alis Na, Sakto). Tell me if you hate either.

---

## 6. Paste this in the group chat (Checkpoint A style)

```
[PM/UI] Done: commuter home all fixture states, Plan B, explain sheet, AI bar UI (PR #1)
| Next: wire useLeavePlan + RouteLine + real /api/decide; onboarding sheet
| Blocked: none (need buses list for RouteLine; need useLeavePlan for live)
| Cutting: none
| Review: open /?state=leave_now (and flip states with the top chips)
```

---

## 7. One ask per role (shortest version)

| Role | Your next concrete deliverable |
|---|---|
| **All-arounder** | Vercel URL + `<RouteLine/>` that takes `RouteLineProps` |
| **Backend 1** | Mock adapter: two tabs sync with Wi-Fi off |
| **Backend 2** | `useLeavePlan()` + drop-in replace of my fixture hook |
| **Driver** | Real `route.json` + LEAVING NOW writes through `data` |
| **PM/UI (me)** | Integration polish + pitch once your hooks exist |

Questions / contract fights → group chat. If it conflicts with what I say out loud, I win — then we update `BUILD_PLAN.md` / `AGENTS.md`.
