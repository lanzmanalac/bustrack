import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../contracts/fixtures';
import type { BusPhase, CrowdLevel } from '../contracts/types';
import route from '../data/route.json';
import { planB, type PlanBCtx } from './planB';

const HEADWAY = route.headway_min;

const ctx = (over: Partial<PlanBCtx> = {}): PlanBCtx => ({
  phase: 'moving',
  crowd: 'seats',
  standby_sec: 0,
  headway_min: HEADWAY,
  ...over,
});

describe('planB', () => {
  it('is null when everything is fine', () => {
    expect(planB(ctx())).toBeNull();
    expect(planB(ctx({ phase: 'standby', standby_sec: 60 }))).toBeNull();
  });

  it('matches the missed fixture', () => {
    const result = planB(ctx({ phase: FIXTURES.missed.phase as BusPhase }));
    expect(result).toMatchObject({
      kind: FIXTURES.missed.plan_b!.kind,
      minutes: FIXTURES.missed.plan_b!.minutes,
      reason: FIXTURES.missed.plan_b!.reason,
      decided_by: 'rules',
    });
  });

  it('matches the full fixture', () => {
    const result = planB(ctx({ crowd: FIXTURES.full.crowd as CrowdLevel }));
    expect(result).toMatchObject({
      kind: FIXTURES.full.plan_b!.kind,
      minutes: FIXTURES.full.plan_b!.minutes,
      reason: FIXTURES.full.plan_b!.reason,
      decided_by: 'rules',
    });
  });

  it('matches the no_signal fixture', () => {
    const result = planB(ctx({ phase: FIXTURES.no_signal.phase as BusPhase }));
    expect(result).toMatchObject({
      kind: FIXTURES.no_signal.plan_b!.kind,
      minutes: FIXTURES.no_signal.plan_b!.minutes,
      reason: FIXTURES.no_signal.plan_b!.reason,
      decided_by: 'rules',
    });
  });

  it('matches the delayed fixture when walking beats waiting', () => {
    const result = planB(
      ctx({
        phase: FIXTURES.delayed.phase as BusPhase,
        standby_sec: 300,
        walk_sec_to_dest: 14 * 60,
      }),
    );
    expect(result).toMatchObject({
      kind: FIXTURES.delayed.plan_b!.kind,
      minutes: FIXTURES.delayed.plan_b!.minutes,
      reason: FIXTURES.delayed.plan_b!.reason,
      decided_by: 'rules',
    });
  });

  it('does not call it delayed until DELAY_STANDBY_SEC is crossed', () => {
    expect(planB(ctx({ phase: 'standby', standby_sec: 180 }))).toBeNull();
    expect(planB(ctx({ phase: 'standby', standby_sec: 181 }))?.reason).toBe('delayed');
  });

  it('swaps walking for a ride when the deadline rules walking out', () => {
    const result = planB(
      ctx({
        phase: 'standby',
        standby_sec: 300,
        walk_sec_to_dest: 20 * 60,
        ride_sec_to_dest: 8 * 60,
        time_left_sec: 12 * 60,
      }),
    );
    expect(result?.kind).toBe('ride_hail');
    expect(result?.reason).toBe('delayed');
  });

  it('keeps walking when a ride is not clearly better', () => {
    const result = planB(
      ctx({
        phase: 'standby',
        standby_sec: 300,
        walk_sec_to_dest: 10 * 60,
        time_left_sec: 30 * 60,
      }),
    );
    expect(result?.kind).toBe('walk');
  });

  it('ranks an uncatchable bus above why it is uncatchable', () => {
    // Passed the stop and also marked full -> the reason is that you missed it.
    const result = planB(ctx({ phase: 'passed', crowd: 'full' }));
    expect(result?.reason).toBe('missed');

    // No signal outranks everything: there is no bus to be full or missed.
    expect(planB(ctx({ phase: 'no_signal', crowd: 'full' }))?.reason).toBe('no_signal');
  });

  it('treats "missed" as a flag, not only a phase', () => {
    // Bus parked at your stop and about to leave while you are still walking.
    const result = planB(ctx({ phase: 'standby', standby_sec: 30, missed: true }));
    expect(result?.reason).toBe('missed');
  });
});
