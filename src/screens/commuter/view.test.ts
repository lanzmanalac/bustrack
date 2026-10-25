import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../../contracts/fixtures';
import type { BusStatus, LeavePlan, Stop } from '../../contracts/types';
import route from '../../data/route.json';
import { breakdown, crowdChip, explainFor, freshnessChip, heroFor, mapFor, metaFor, planBFor, tripFor, viewStateFor, type ViewContext } from './view';

const stopName = (seq: number) => route.stops[seq - 1].name;

const ctx = (over: Partial<ViewContext> = {}): ViewContext => ({
  worldElapsedSec: 0,
  realElapsedSec: 0,
  offline: false,
  headwayMin: 10,
  ...over,
});

describe('viewStateFor', () => {
  it('maps every fixture to its own copy-table state', () => {
    for (const [name, plan] of Object.entries(FIXTURES)) {
      expect(viewStateFor(plan, ctx())).toBe(name);
    }
  });

  it('shows offline and location_off from device context', () => {
    expect(viewStateFor(FIXTURES.relax, ctx({ offline: true }))).toBe('offline');
    expect(viewStateFor({ ...FIXTURES.relax, user_stop: null }, ctx())).toBe('location_off');
  });

  it('walks relax → get_ready → leave_now → missed as the countdown ticks', () => {
    const plan = FIXTURES.relax; // leave_in 720
    expect(viewStateFor(plan, ctx({ worldElapsedSec: 419 }))).toBe('relax'); // 301 left
    expect(viewStateFor(plan, ctx({ worldElapsedSec: 420 }))).toBe('get_ready'); // 300 left
    expect(viewStateFor(plan, ctx({ worldElapsedSec: 600 }))).toBe('leave_now'); // 120 left
    expect(viewStateFor(plan, ctx({ worldElapsedSec: 749 }))).toBe('leave_now'); // -29: still in the grace window
    expect(viewStateFor(plan, ctx({ worldElapsedSec: 750 }))).toBe('missed');
  });

  it('does not tick in standby: leave_in means "if the bus left right now"', () => {
    const later = ctx({ worldElapsedSec: 10_000 });
    expect(viewStateFor(FIXTURES.standby, later)).toBe('standby');
    expect(heroFor(FIXTURES.standby, later).minutes).toBe(4);
  });
});

describe('heroFor copy', () => {
  it('relax', () => {
    const h = heroFor(FIXTURES.relax, ctx());
    expect(h.minutes).toBe(12);
    expect(h.sub).toBe('2 stops away · 4 min walk');
    expect(h.announce).toBe('Leave in 12 minutes');
    expect(h.tone).toBe('relax');
  });

  it('never rounds the leave time up', () => {
    expect(heroFor(FIXTURES.relax, ctx({ worldElapsedSec: 1 })).minutes).toBe(11);
  });

  it('leave_now takeover', () => {
    const h = heroFor(FIXTURES.leave_now, ctx());
    expect(h.headline).toBe('Good time to head out');
    expect(h.subhead).toBeNull();
    expect(h.sub).toBe('4 min walk · Bus in ~5 min');
    expect(h.tone).toBe('leave_now');
  });

  it('standby, missed, full, delayed, no_signal', () => {
    const standby = heroFor(FIXTURES.standby, ctx());
    expect([standby.approx, standby.minutes, standby.suffix, standby.sub]).toEqual([true, 4, 'or later', `Bus waiting at ${stopName(2)}`]);
    expect(heroFor(FIXTURES.missed, ctx()).sub).toBe('Next in ~10 min');
    expect(heroFor(FIXTURES.full, ctx()).headline).toBe('This bus is full');
    expect(heroFor(FIXTURES.delayed, ctx()).sub).toBe(`At ${stopName(3)} 3+ min · 14 min walk`);
    const noSignal = heroFor(FIXTURES.no_signal, ctx());
    expect(noSignal.headline).toBe('A bus comes every ~10 min');
    expect(noSignal.lowConfidence).toBe(true);
  });

  it('trip card: leave, reach the stop, bus arrives, as Manila clock times that add up', () => {
    const now = Date.parse('2026-10-25T10:00:30Z'); // 6:00 PM in Manila
    const t = tripFor(FIXTURES.relax, ctx(), now); // leave in 12, walk 4, buffer 1
    expect(t.steps).toEqual([
      { time: '6:12 PM', label: 'Walk 4 min' },
      { time: '6:16 PM', label: 'At your stop' },
      { time: '6:17 PM', label: 'Bus arrives' },
    ]);
    expect([t.stop, t.crowd]).toEqual([stopName(4), 'Seats likely']);
    expect(tripFor(FIXTURES.standby, ctx(), now).steps?.[2].label).toBe('If bus leaves now');
    expect(tripFor(FIXTURES.missed, ctx(), now).steps).toBeNull();
  });

  it('a picked stop with no GPS has no walk time, so the copy does not invent one', () => {
    const plan: LeavePlan = { ...FIXTURES.relax, walk_sec: 0 };
    expect(heroFor(plan, ctx()).sub).toBe('2 stops away');
    expect(heroFor({ ...FIXTURES.get_ready, walk_sec: 0 }, ctx()).sub).toBe('No rush');
    const rows = explainFor(plan, ctx()).rows ?? [];
    expect(rows[1]).toEqual({ op: '−', label: `Your walk to ${stopName(4)} (location off, not counted)`, value: '0 min' });
  });

  it('offline shows the last known value without ticking it', () => {
    const plan: LeavePlan = { ...FIXTURES.relax, leave_in_sec: 300, data_age_sec: 120 };
    const h = heroFor(plan, ctx({ offline: true, worldElapsedSec: 200 }));
    expect(h.headline).toBe('Last known: leave in ~5 min');
    expect(h.sub).toBe('Offline · Saved 2 min ago');
  });
});

describe('explain the math', () => {
  it.each(['relax', 'get_ready', 'leave_now', 'standby', 'delayed'])('%s adds up: bus − walk − buffer = leave', (name) => {
    for (const worldElapsedSec of [0, 7, 23, 49]) {
      const c = ctx({ worldElapsedSec });
      const b = breakdown(FIXTURES[name], c)!;
      expect(b.busMin - b.walkMin - b.bufferMin).toBe(b.leaveMin);
      const rows = explainFor(FIXTURES[name], c).rows!;
      expect(rows.map((r) => r.value)).toEqual([`~${b.busMin} min`, `${b.walkMin} min`, `${b.bufferMin} min`]);
    }
  });

  it('stays close to the real bus ETA', () => {
    for (const name of ['relax', 'get_ready', 'leave_now']) {
      const b = breakdown(FIXTURES[name], ctx())!;
      expect(Math.abs(b.busMin * 60 - FIXTURES[name].bus_eta_sec!)).toBeLessThan(90);
    }
  });

  it('labels where the data came from', () => {
    expect(explainFor(FIXTURES.relax, ctx()).source).toBe('Live from the driver · updated 8s ago');
    expect(explainFor({ ...FIXTURES.relax, source: 'simulated' }, ctx()).source).toMatch(/^Simulated bus for the demo/);
    expect(explainFor(FIXTURES.no_signal, ctx()).source).toBe('Schedule estimate · no live bus data');
  });
});

describe('chips', () => {
  it('freshness ages in real seconds and degrades', () => {
    expect(freshnessChip(FIXTURES.relax, 0)).toMatchObject({ label: 'Live · 8s ago', tone: 'good', live: true });
    expect(freshnessChip(FIXTURES.relax, 52)).toMatchObject({ label: 'Updated 1 min ago', tone: 'warn' });
    expect(freshnessChip(FIXTURES.relax, 300)).toMatchObject({ tone: 'muted' });
    expect(freshnessChip(FIXTURES.no_signal, 0)).toMatchObject({ label: 'Schedule estimate', tone: 'muted' });
  });

  it('crowd shows a level and reports, never a passenger count', () => {
    expect(crowdChip(FIXTURES.relax)!.label).toBe('Seats likely · 2 riders reported');
    expect(crowdChip(FIXTURES.leave_now)!.label).toBe('Busy · 5 riders reported');
    expect(crowdChip(FIXTURES.full)!.label).toBe('Full · driver reported');
    expect(crowdChip(FIXTURES.no_signal)).toBeNull();
  });

  it('meta line: freshness always, crowd only while you can still catch the bus', () => {
    expect(metaFor(FIXTURES.leave_now, ctx())).toMatchObject({ fresh: { label: 'Live · 8s ago' }, crowd: { label: 'Busy · 5 riders reported' } });
    expect(metaFor(FIXTURES.missed, ctx())!.crowd).toBeNull();
    expect(metaFor({ ...FIXTURES.relax, user_stop: null }, ctx())).toBeNull();
  });
});

describe('mapFor: where the bus sits and the text alternative', () => {
  const stops = route.stops as Stop[];

  it('moving: bus sits between stops, counted from the plan', () => {
    const m = mapFor(FIXTURES.relax, ctx(), stops);
    expect([m.busPos, m.userIdx, m.mode]).toEqual([1.5, 3, 'live']);
    expect(m.label).toBe(`Bus is between ${stopName(2)} and ${stopName(3)}, 2 stops before your stop, ${stopName(4)}. You are a 4 min walk from ${stopName(4)}.`);
  });

  it('standby and delayed: bus waits at the named stop', () => {
    const standby = mapFor(FIXTURES.standby, ctx(), stops);
    expect([standby.busPos, standby.mode]).toEqual([1, 'waiting']);
    expect(standby.label).toMatch(new RegExp(`^Bus is waiting at ${stopName(2)}, 2 stops before your stop, ${stopName(4)}\\.`));
    const delayed = mapFor(FIXTURES.delayed, ctx(), stops);
    expect(delayed.busPos).toBe(2);
    expect(delayed.label).toMatch(new RegExp(`^Bus is waiting at ${stopName(3)}, 1 stop before your stop`));
  });

  it('passed: bus is beyond your stop', () => {
    const m = mapFor(FIXTURES.missed, ctx(), stops);
    expect([m.busPos, m.mode]).toEqual([3.5, 'passed']);
    expect(m.label).toBe(`Bus has passed your stop, ${stopName(4)}.`);
  });

  it('no signal: no bus on the map, and it says so', () => {
    const m = mapFor(FIXTURES.no_signal, ctx(), stops);
    expect([m.busPos, m.mode, m.stale]).toEqual([null, 'none', true]);
    expect(m.label).toBe(`No live bus position. Your stop is ${stopName(4)}, a 4 min walk away.`);
  });

  it('offline: last known position, marked stale', () => {
    const m = mapFor(FIXTURES.relax, ctx({ offline: true }), stops);
    expect(m.stale).toBe(true);
    expect(m.label).toMatch(/^Last known: Bus is between/);
  });

  it('location off: route only, no "You"', () => {
    const m = mapFor({ ...FIXTURES.relax, user_stop: null }, ctx(), stops);
    expect([m.userIdx, m.walkMin]).toEqual([-1, null]);
    expect(m.label).toBe(`Route map with ${route.stops.length} stops. Pick your stop to see the bus relative to you.`);
  });

  it('live buses win over the plan estimate', () => {
    const bus: BusStatus = {
      bus_id: 'bus-1', route_id: 'demo-route', lat: stops[4].lat, lng: stops[4].lng, status: 'waiting',
      current_stop_id: 's5', next_stop_id: 's6', arrived_at: null, departed_at: null, is_full: false,
      full_reported_at: null, source: 'simulated', updated_at: new Date().toISOString(),
    };
    expect(mapFor(FIXTURES.relax, ctx(), stops, [bus]).busPos).toBe(4);
  });
});

describe('planBFor', () => {
  it('uses rules copy when no AI decided', () => {
    const m = planBFor(FIXTURES.delayed)!;
    expect([m.title, m.detail, m.aiBadge]).toEqual(['Walk', '14 min walk', null]);
    expect(m.alternatives).toEqual(['wait', 'next_bus', 'ride_hail']);
  });

  it('shows AI confidence when the Decisions API picked', () => {
    const plan: LeavePlan = {
      ...FIXTURES.delayed,
      plan_b: { kind: 'walk', minutes: 14, reason: 'delayed', why: 'Walking beats the wait.', confidence: 0.82, decided_by: 'decisions_api' },
    };
    const m = planBFor(plan)!;
    expect(m.aiBadge).toBe('AI pick · 82% sure');
    expect(m.why).toBe('Walking beats the wait.');
  });
});
