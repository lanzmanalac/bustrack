import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../../contracts/fixtures';
import type { LeavePlan } from '../../contracts/types';
import { breakdown, chipsFor, crowdChip, explainFor, freshnessChip, heroFor, planBFor, viewStateFor, type ViewContext } from './view';

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
    expect(h.sub).toBe('Bus is 2 stops away · 4 min walk to [Stop 4]');
    expect(h.announce).toBe('Leave in 12 minutes');
    expect(h.tone).toBe('relax');
  });

  it('never rounds the leave time up', () => {
    expect(heroFor(FIXTURES.relax, ctx({ worldElapsedSec: 1 })).minutes).toBe(11);
  });

  it('leave_now takeover', () => {
    const h = heroFor(FIXTURES.leave_now, ctx());
    expect(h.headline).toBe('Alis na!');
    expect(h.subhead).toBe('Leave now');
    expect(h.sub).toBe('Walk to [Stop 4] · bus arrives in ~5 min');
    expect(h.tone).toBe('leave_now');
  });

  it('standby, missed, full, delayed, no_signal', () => {
    const standby = heroFor(FIXTURES.standby, ctx());
    expect([standby.approx, standby.minutes, standby.suffix, standby.sub]).toEqual([true, 4, 'or later', 'Bus is still waiting at [Stop 2]']);
    expect(heroFor(FIXTURES.missed, ctx()).sub).toBe('Next bus in ~10 min');
    expect(heroFor(FIXTURES.full, ctx()).headline).toBe('This bus is full');
    expect(heroFor(FIXTURES.delayed, ctx()).sub).toBe('Still at [Stop 3] for 3+ min · walking takes 14 min');
    const noSignal = heroFor(FIXTURES.no_signal, ctx());
    expect(noSignal.headline).toBe('A bus comes every ~10 min');
    expect(noSignal.lowConfidence).toBe(true);
  });

  it('offline shows the last known value without ticking it', () => {
    const plan: LeavePlan = { ...FIXTURES.relax, leave_in_sec: 300, data_age_sec: 120 };
    const h = heroFor(plan, ctx({ offline: true, worldElapsedSec: 200 }));
    expect(h.headline).toBe('Last known: leave in ~5 min');
    expect(h.sub).toBe("You're offline · showing saved info from 2 min ago");
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

  it('standby phase chip names the stop', () => {
    expect(chipsFor(FIXTURES.standby, ctx()).map((c) => c.label)).toContain('Bus waiting at [Stop 2]');
  });

  it('drops the crowd chip once you have missed that bus', () => {
    expect(chipsFor(FIXTURES.missed, ctx()).map((c) => c.id)).toEqual(['phase', 'fresh']);
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
