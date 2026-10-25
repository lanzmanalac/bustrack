import { CONFIG } from '../../contracts/config';
import type { Confidence, LeavePlan, PlanB, Urgency } from '../../contracts/types';
import type { ChipTone } from '../../ui/Chip';

export type ViewState =
  | 'relax'
  | 'get_ready'
  | 'leave_now'
  | 'standby'
  | 'missed'
  | 'full'
  | 'delayed'
  | 'no_signal'
  | 'offline'
  | 'location_off';

export type Tone = 'relax' | 'get_ready' | 'leave_now' | 'missed' | 'low';

export interface ViewContext {
  /** worldElapsedSec(plan.computed_at_real_ms): scaled, only for countdowns */
  worldElapsedSec: number;
  /** real seconds since the plan was computed: for data age, never scaled */
  realElapsedSec: number;
  offline: boolean;
  headwayMin: number;
}

export interface HeroModel {
  state: ViewState;
  tone: Tone;
  lowConfidence: boolean;
  accent: string | null;
  minutes: number | null;
  approx: boolean;
  suffix: string | null;
  headline: string | null;
  subhead: string | null;
  sub: string;
  announce: string;
}

export interface ChipModel {
  id: 'phase' | 'crowd' | 'fresh';
  label: string;
  tone: ChipTone;
  live?: boolean;
}

export interface ExplainRow {
  op: '' | '−';
  label: string;
  value: string;
}

export interface ExplainModel {
  title: string;
  rows: ExplainRow[] | null;
  result: string | null;
  note: string | null;
  source: string;
}

export interface PlanBModel {
  kind: PlanB['kind'];
  title: string;
  detail: string | null;
  reason: string;
  why: string;
  aiBadge: string | null;
  alternatives: PlanB['kind'][];
}

const ACCENT: Record<ViewState, string | null> = {
  relax: 'Chill ka muna',
  get_ready: 'Maghanda na',
  leave_now: null,
  standby: 'Naghihintay pa ang bus',
  missed: 'Hindi na aabot',
  full: 'Puno na',
  delayed: 'Na-delay ang bus',
  no_signal: 'Walang live na bus',
  offline: 'Offline ka',
  location_off: null,
};

export const PLAN_B_LABEL: Record<PlanB['kind'], string> = {
  wait: 'Keep waiting',
  next_bus: 'Take the next bus',
  walk: 'Walk',
  ride_hail: 'Book a ride',
};

const PLAN_B_REASON: Record<PlanB['reason'], string> = {
  missed: 'You missed this bus',
  delayed: 'Bus is running late',
  full: 'Bus is full',
  no_signal: 'No live bus',
};

const PLAN_B_DEFAULT_WHY: Record<PlanB['reason'], string> = {
  missed: 'The bus is already past the point where you can catch it.',
  delayed: 'The bus has been stopped longer than usual.',
  full: 'The driver marked this bus full.',
  no_signal: 'No live bus, so this uses the usual gap between buses.',
};

const ticks = (plan: LeavePlan) => plan.phase === 'moving';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Floor, so we never promise more time than there is. */
const leaveMinutes = (sec: number) => Math.max(0, Math.floor(sec / 60));
const walkMinutes = (sec: number) => Math.max(1, Math.round(sec / 60));
const bufferMinutes = (sec: number) => Math.max(0, Math.round(sec / 60));

export function ago(sec: number): string {
  if (sec < 3) return 'just now';
  if (sec < 60) return `${Math.round(sec)}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  return `${Math.floor(sec / 3600)} h ago`;
}

export function liveSec(plan: LeavePlan, sec: number | null, worldElapsedSec: number): number | null {
  if (sec == null) return null;
  return ticks(plan) ? sec - worldElapsedSec : sec;
}

/** Re-derives urgency as the countdown ticks between data updates. */
export function liveUrgency(plan: LeavePlan, leaveInSec: number | null): Urgency {
  if (!ticks(plan) || leaveInSec == null) return plan.urgency;
  const t = CONFIG.URGENCY_SEC;
  if (leaveInSec > t.relax) return 'relax';
  if (leaveInSec > t.get_ready) return 'get_ready';
  if (leaveInSec > t.missed) return 'leave_now';
  return 'missed';
}

export function viewStateFor(plan: LeavePlan, ctx: ViewContext): ViewState {
  if (ctx.offline) return 'offline';
  if (!plan.user_stop) return 'location_off';
  if (plan.phase === 'no_signal') return 'no_signal';
  const urgency = liveUrgency(plan, liveSec(plan, plan.leave_in_sec, ctx.worldElapsedSec));
  if (plan.phase === 'passed' || urgency === 'missed') return 'missed';
  if (plan.crowd === 'full') return 'full';
  if (plan.plan_b?.reason === 'delayed') return 'delayed';
  if (plan.phase === 'standby') return 'standby';
  if (urgency === 'leave_now') return 'leave_now';
  if (urgency === 'get_ready') return 'get_ready';
  if (urgency === 'unknown') return 'no_signal';
  return 'relax';
}

function toneFor(state: ViewState, urgency: Urgency): Tone {
  switch (state) {
    case 'relax':
    case 'get_ready':
    case 'leave_now':
      return state;
    case 'standby':
      return urgency === 'leave_now' || urgency === 'get_ready' ? urgency : 'relax';
    case 'delayed':
      return 'get_ready';
    case 'missed':
    case 'full':
      return 'missed';
    default:
      return 'low';
  }
}

function stopsAwaySentence(stopsAway: number | null): string {
  if (stopsAway == null) return 'Bus is on the way';
  if (stopsAway <= 0) return 'Bus is arriving';
  return `Bus is ${plural(stopsAway, 'stop')} away`;
}

/**
 * Minutes that always add up on screen: bus − walk − buffer = leave.
 * The bus figure is derived from the displayed leave time, so it can
 * differ from the raw ETA by under a minute (it is shown with "~").
 */
export function breakdown(plan: LeavePlan, ctx: ViewContext) {
  const leaveIn = liveSec(plan, plan.leave_in_sec, ctx.worldElapsedSec);
  if (leaveIn == null) return null;
  const leaveMin = leaveMinutes(leaveIn);
  const walkMin = walkMinutes(plan.walk_sec);
  const bufferMin = bufferMinutes(plan.buffer_sec);
  return { leaveIn, leaveMin, walkMin, bufferMin, busMin: leaveMin + walkMin + bufferMin };
}

export function heroFor(plan: LeavePlan, ctx: ViewContext): HeroModel {
  const state = viewStateFor(plan, ctx);
  const leaveIn = liveSec(plan, plan.leave_in_sec, ctx.worldElapsedSec);
  const urgency = liveUrgency(plan, leaveIn);
  const stop = plan.user_stop?.name ?? 'your stop';
  const busStop = plan.bus_at_stop?.name ?? 'the stop';
  const walk = walkMinutes(plan.walk_sec);
  const nextBus = plan.plan_b?.minutes ?? ctx.headwayMin;
  const base = {
    state,
    tone: toneFor(state, urgency),
    lowConfidence: plan.confidence === 'low',
    accent: ACCENT[state],
    minutes: null,
    approx: false,
    suffix: null,
    headline: null,
    subhead: null,
  };

  switch (state) {
    case 'relax':
    case 'get_ready': {
      const m = leaveMinutes(leaveIn ?? 0);
      const sub =
        state === 'relax'
          ? `${stopsAwaySentence(plan.stops_away)} · ${walk} min walk to ${stop}`
          : `Start packing up · ${walk} min walk`;
      return { ...base, minutes: m, sub, announce: `Leave in ${plural(m, 'minute')}` };
    }
    case 'leave_now': {
      const b = breakdown(plan, ctx);
      const eta = b ? ` · bus arrives in ~${b.busMin} min` : '';
      return {
        ...base,
        headline: 'Alis na!',
        subhead: 'Leave now',
        sub: `Walk to ${stop}${eta}`,
        announce: 'Leave now. Alis na!',
      };
    }
    case 'standby': {
      if (leaveIn == null) {
        return { ...base, headline: `Bus is waiting at ${busStop}`, sub: `${walk} min walk to ${stop}`, announce: `Bus is waiting at ${busStop}` };
      }
      if (leaveIn < 60) {
        return {
          ...base,
          headline: 'Leave now',
          sub: `Bus is still waiting at ${busStop} · it can leave any moment`,
          announce: `Leave now. Bus is still waiting at ${busStop}`,
        };
      }
      const m = leaveMinutes(leaveIn);
      return {
        ...base,
        minutes: m,
        approx: true,
        suffix: 'or later',
        sub: `Bus is still waiting at ${busStop}`,
        announce: `Leave in about ${plural(m, 'minute')} or later. Bus is still waiting at ${busStop}`,
      };
    }
    case 'missed':
      return { ...base, headline: "You'll miss this one", sub: `Next bus in ~${nextBus} min`, announce: `You'll miss this bus. Next bus in about ${nextBus} minutes` };
    case 'full':
      return {
        ...base,
        headline: 'This bus is full',
        sub: `Reported by the driver · next bus ~${nextBus} min`,
        announce: `This bus is full. Next bus in about ${nextBus} minutes`,
      };
    case 'delayed': {
      const walkPart = plan.plan_b?.kind === 'walk' && plan.plan_b.minutes ? ` · walking takes ${plan.plan_b.minutes} min` : '';
      const stuckMin = Math.round(CONFIG.DELAY_STANDBY_SEC / 60);
      return {
        ...base,
        headline: 'Bus is running late',
        sub: `Still at ${busStop} for ${stuckMin}+ min${walkPart}`,
        announce: `Bus is running late. Still at ${busStop}`,
      };
    }
    case 'no_signal':
      return {
        ...base,
        headline: `A bus comes every ~${ctx.headwayMin} min`,
        sub: 'No live bus right now · schedule estimate',
        announce: `No live bus. A bus comes about every ${ctx.headwayMin} minutes`,
      };
    case 'offline': {
      const age = (plan.data_age_sec ?? 0) + ctx.realElapsedSec;
      const lastLeave = plan.leave_in_sec;
      const headline = lastLeave != null ? `Last known: leave in ~${leaveMinutes(lastLeave)} min` : 'Last known info';
      return { ...base, headline, sub: `You're offline · showing saved info from ${ago(age)}`, announce: `You're offline. ${headline}` };
    }
    case 'location_off':
      return { ...base, headline: 'Pick your stop', sub: "We'll still tell you when to leave", announce: 'Pick your stop' };
  }
}

export function freshnessChip(plan: LeavePlan, realElapsedSec: number): ChipModel {
  if (plan.source === 'schedule' || plan.data_age_sec == null) {
    return { id: 'fresh', label: 'Schedule estimate', tone: 'muted' };
  }
  const age = plan.data_age_sec + realElapsedSec;
  const ageLevel: Confidence = age <= CONFIG.FRESH_SEC.high ? 'high' : age <= CONFIG.FRESH_SEC.medium ? 'medium' : 'low';
  const rank: Record<Confidence, number> = { high: 2, medium: 1, low: 0 };
  const level = rank[ageLevel] <= rank[plan.confidence] ? ageLevel : plan.confidence;
  const label = ageLevel === 'high' ? `Live · ${ago(age)}` : `Updated ${ago(age)}`;
  const tone: ChipTone = level === 'high' ? 'good' : level === 'medium' ? 'warn' : 'muted';
  return { id: 'fresh', label, tone, live: level === 'high' };
}

export function phaseChip(plan: LeavePlan, state: ViewState): ChipModel | null {
  if (state === 'location_off' || state === 'offline') return null;
  switch (plan.phase) {
    case 'standby':
      return { id: 'phase', label: `Bus waiting at ${plan.bus_at_stop?.name ?? 'a stop'}`, tone: 'neutral' };
    case 'moving': {
      const n = plan.stops_away;
      const label = n == null ? 'Bus on the way' : n <= 0 ? 'Bus arriving' : `${plural(n, 'stop')} away`;
      return { id: 'phase', label, tone: 'neutral' };
    }
    case 'passed':
      return { id: 'phase', label: 'Bus passed your stop', tone: 'muted' };
    case 'no_signal':
      return { id: 'phase', label: 'No live bus', tone: 'muted' };
  }
}

/** A level and how many riders reported, never a passenger count. */
export function crowdChip(plan: LeavePlan): ChipModel | null {
  const reported = plural(plan.crowd_reports, 'rider') + ' reported';
  switch (plan.crowd) {
    case 'full':
      return { id: 'crowd', label: 'Full · driver reported', tone: 'bad' };
    case 'likely_full':
      return { id: 'crowd', label: `Likely full · ${reported}`, tone: 'bad' };
    case 'busy':
      return { id: 'crowd', label: `Busy · ${reported}`, tone: 'warn' };
    case 'seats':
      return { id: 'crowd', label: `Seats likely · ${reported}`, tone: 'good' };
    case 'unknown':
      return null;
  }
}

export function chipsFor(plan: LeavePlan, ctx: ViewContext): ChipModel[] {
  const state = viewStateFor(plan, ctx);
  if (state === 'location_off') return [];
  const fresh = freshnessChip(plan, ctx.realElapsedSec);
  const crowd = state === 'missed' ? null : crowdChip(plan);
  return [phaseChip(plan, state), crowd, fresh].filter((c): c is ChipModel => c !== null);
}

function sourceLine(plan: LeavePlan, realElapsedSec: number): string {
  if (plan.source === 'schedule' || plan.data_age_sec == null) return 'Schedule estimate · no live bus data';
  const updated = `updated ${ago(plan.data_age_sec + realElapsedSec)}`;
  return plan.source === 'driver' ? `Live from the driver · ${updated}` : `Simulated bus for the demo · ${updated}`;
}

export function explainFor(plan: LeavePlan, ctx: ViewContext): ExplainModel {
  const state = viewStateFor(plan, ctx);
  const source = sourceLine(plan, ctx.realElapsedSec);
  const stop = plan.user_stop?.name ?? 'your stop';
  const busStop = plan.bus_at_stop?.name ?? 'the stop';
  const nextBus = plan.plan_b?.minutes ?? ctx.headwayMin;
  const b = breakdown(plan, ctx);
  const rows = (busLabel: string): ExplainRow[] | null =>
    b && [
      { op: '', label: busLabel, value: `~${b.busMin} min` },
      { op: '−', label: `Your walk to ${stop}`, value: `${b.walkMin} min` },
      { op: '−', label: 'Safety buffer', value: `${b.bufferMin} min` },
    ];

  switch (state) {
    case 'relax':
    case 'get_ready':
      return { title: 'How we got this', rows: rows(`Bus reaches ${stop}`), result: b ? `Leave in ${b.leaveMin} min` : null, note: null, source };
    case 'leave_now':
      return { title: 'How we got this', rows: rows(`Bus reaches ${stop}`), result: 'Leave now', note: null, source };
    case 'standby':
      return {
        title: 'If the bus left right now',
        rows: rows(`Bus reaches ${stop}`),
        result: b ? (b.leaveIn < 60 ? 'Leave now' : `Leave in ~${b.leaveMin} min or later`) : null,
        note: `The bus is still waiting at ${busStop}. The countdown starts when the driver taps Leaving now.`,
        source,
      };
    case 'delayed':
      return {
        title: 'If the bus left right now',
        rows: rows(`Bus reaches ${stop}`),
        result: b ? `Leave in ~${b.leaveMin} min or later` : null,
        note: `The bus has been waiting at ${busStop} for over ${Math.round(CONFIG.DELAY_STANDBY_SEC / 60)} min, longer than usual.`,
        source,
      };
    case 'missed':
      return {
        title: 'Why you’ll miss it',
        rows: null,
        result: null,
        note: `The bus will reach ${stop} before you can. Next bus in ~${nextBus} min, based on the usual gap between buses.`,
        source,
      };
    case 'full':
      return {
        title: 'Why we suggest the next bus',
        rows: null,
        result: null,
        note: `The driver marked this bus full. Next bus in ~${nextBus} min, based on the usual gap between buses.`,
        source,
      };
    case 'no_signal':
      return {
        title: 'Why this is an estimate',
        rows: null,
        result: null,
        note: `No driver is sending a live position right now. Buses usually come every ~${ctx.headwayMin} min, so this is a schedule estimate, not live data.`,
        source,
      };
    case 'offline':
      return {
        title: 'You’re offline',
        rows: null,
        result: null,
        note: 'These numbers are from the last update and may be out of date. We’ll refresh as soon as you’re back online.',
        source,
      };
    case 'location_off':
      return {
        title: 'Pick your stop',
        rows: null,
        result: null,
        note: 'Pick the stop you walk to and we’ll work out when you should leave.',
        source,
      };
  }
}

export function planBFor(plan: LeavePlan): PlanBModel | null {
  const p = plan.plan_b;
  if (!p) return null;
  const m = p.minutes;
  const detail =
    m == null
      ? null
      : p.kind === 'next_bus'
        ? `Next bus in ~${m} min`
        : p.kind === 'walk'
          ? `${m} min walk`
          : `About ${m} min`;
  const byAi = p.decided_by === 'decisions_api' || p.decided_by === 'responses_api';
  const aiBadge = byAi ? (p.confidence != null ? `AI pick · ${Math.round(p.confidence * 100)}% sure` : 'AI pick') : null;
  const kinds: PlanB['kind'][] = ['wait', 'next_bus', 'walk', 'ride_hail'];
  return {
    kind: p.kind,
    title: PLAN_B_LABEL[p.kind],
    detail,
    reason: PLAN_B_REASON[p.reason],
    why: p.why ?? PLAN_B_DEFAULT_WHY[p.reason],
    aiBadge,
    alternatives: kinds.filter((k) => k !== p.kind),
  };
}
