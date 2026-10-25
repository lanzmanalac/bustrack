import { CONFIG } from '../../contracts/config';
import type { LeavePlan } from '../../contracts/types';
import { breakdown, type ViewContext, type ViewState } from './view';

export interface HeroDetail {
  kind: 'bus' | 'walk' | 'status';
  text: string;
}

/** Keep the bus, the person walking, and the boarding stop explicit. */
export function heroDetailsFor(plan: LeavePlan, ctx: ViewContext, state: ViewState): HeroDetail[] {
  const stop = plan.user_stop?.name ?? 'your stop';
  const at = plan.bus_at_stop?.name ?? 'its current stop';
  const b = breakdown(plan, ctx);
  const walk: HeroDetail = {
    kind: 'walk',
    text: plan.walk_sec > 0
      ? `Your walk to ${stop} takes ${Math.max(1, Math.round(plan.walk_sec / 60))} min.`
      : 'Your walking time has not been estimated.',
  };
  const next: HeroDetail = { kind: 'bus', text: `The next bus is expected in ~${plan.plan_b?.minutes ?? ctx.headwayMin} min.` };

  switch (state) {
    case 'location_off':
      return [{ kind: 'walk', text: 'Choose the stop you will walk to so we can help time your trip.' }];
    case 'offline':
      return [{ kind: 'status', text: 'You are offline. This is saved trip information.' }];
    case 'no_signal':
      return [{ kind: 'bus', text: 'No live bus location is available. We are using the usual bus schedule.' }, walk];
    case 'missed':
      return [next];
    case 'full':
      return [{ kind: 'status', text: 'The driver marked this bus as full.' }, next];
    case 'delayed':
      return [
        { kind: 'bus', text: `The bus has been waiting at ${at} for over ${Math.round(CONFIG.DELAY_STANDBY_SEC / 60)} min.` },
        ...(plan.plan_b?.kind === 'walk' && plan.plan_b.minutes
          ? [{ kind: 'walk' as const, text: `You could walk to your destination in about ${plan.plan_b.minutes} min.` }]
          : [walk]),
      ];
    case 'standby':
      return [{ kind: 'bus', text: `The bus is waiting at ${at}.` }, walk];
    case 'leave_now':
      return [{ kind: 'bus', text: b ? `The bus reaches your stop in ~${b.busMin} min.` : 'The bus is approaching your stop.' }, walk];
    default: {
      const count = plan.stops_away;
      const text = count == null
        ? 'The bus is on its way to your stop.'
        : count <= 0
          ? 'The bus is approaching your stop.'
          : `The bus is ${count} ${count === 1 ? 'stop' : 'stops'} from your stop.`;
      return [{ kind: 'bus', text }, walk];
    }
  }
}
