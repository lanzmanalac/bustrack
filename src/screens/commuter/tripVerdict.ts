import { CONFIG } from '../../contracts/config';
import type { LeavePlan, Stop, TripIntent } from '../../contracts/types';
import { checkArriveBy } from '../../logic/arriveBy';
import { orderedStops, streetMeters } from '../../logic/geo';
import type { TripVerdict } from './TripBar';

/** Use the same speed, road factor and intermediate dwell assumptions as the bus ETA. */
function rideSecondsBetween(from: Stop, to: Stop, stops: Stop[]): number | null {
  const ordered = orderedStops(stops);
  const fromIndex = ordered.findIndex((stop) => stop.stop_id === from.stop_id);
  const toIndex = ordered.findIndex((stop) => stop.stop_id === to.stop_id);
  if (fromIndex < 0 || toIndex <= fromIndex) return null;

  let distance = 0;
  for (let index = fromIndex; index < toIndex; index += 1) {
    distance += streetMeters(ordered[index], ordered[index + 1]);
  }
  const intermediateStops = Math.max(0, toIndex - fromIndex - 1);
  return Math.round(distance / CONFIG.BUS_SPEED_MPS + intermediateStops * CONFIG.DWELL_SEC_PER_STOP);
}

export function tripVerdictFor(plan: LeavePlan, intent: TripIntent | null, stops: Stop[], nowMs: number): TripVerdict | null {
  if (!intent?.arrive_by || !intent.destination_stop_id || intent.clarify) return null;
  const destination = stops.find((stop) => stop.stop_id === intent.destination_stop_id);
  if (!destination || !plan.user_stop) return { kind: 'unknown' };

  const rideSeconds = rideSecondsBetween(plan.user_stop, destination, stops);
  if (rideSeconds === null || plan.phase === 'standby' || plan.confidence === 'low' || plan.crowd === 'full'
    || plan.bus_eta_sec === null || plan.leave_in_sec === null || plan.leave_in_sec < 0) {
    return { kind: 'unknown' };
  }

  return { kind: checkArriveBy(plan, rideSeconds, intent.arrive_by, nowMs) };
}
