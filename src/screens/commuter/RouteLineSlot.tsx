import { motion } from 'motion/react';
import type { LeavePlan, Stop } from '../../contracts/types';

/**
 * Stand-in for the All-arounder's <RouteLine/> (src/components/RouteLine/).
 * It only knows the LeavePlan, so the bus position is approximate.
 */
function busIndex(plan: LeavePlan, stops: Stop[], userIdx: number): number | null {
  if (plan.phase === 'standby' && plan.bus_at_stop) {
    return stops.findIndex((s) => s.stop_id === plan.bus_at_stop!.stop_id);
  }
  if (userIdx < 0) return null;
  if (plan.phase === 'passed') return Math.min(stops.length - 1, userIdx + 0.5);
  if (plan.phase === 'moving' && plan.stops_away != null) {
    return plan.stops_away <= 0 ? userIdx : Math.max(0, userIdx - plan.stops_away + 0.5);
  }
  return null;
}

const W = 340;
const PAD = 22;
const Y = 46;

export function RouteLineSlot({ plan, stops, pulse }: { plan: LeavePlan; stops: Stop[]; pulse: boolean }) {
  const userIdx = stops.findIndex((s) => s.stop_id === plan.user_stop?.stop_id);
  const bus = busIndex(plan, stops, userIdx);
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, stops.length - 1);
  const userStop = userIdx >= 0 ? stops[userIdx] : null;
  const label =
    bus == null
      ? `Route with ${stops.length} stops. No live bus position.`
      : `Route with ${stops.length} stops. Your stop is ${userStop?.name ?? 'not set'}.`;

  return (
    <section className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-3 pt-2 pb-1">
      <svg viewBox={`0 0 ${W} 96`} role="img" aria-label={label} className="block w-full">
        <line x1={PAD} x2={W - PAD} y1={Y} y2={Y} stroke="#cbd2dc" strokeWidth={6} strokeLinecap="round" />
        {userStop && (
          <g>
            <line x1={x(userIdx)} x2={x(userIdx)} y1={14} y2={Y - 10} stroke="var(--ink)" strokeWidth={2} strokeDasharray="3 4" />
            <text x={x(userIdx)} y={11} textAnchor="middle" className="fill-[var(--ink)] text-[11px] font-bold">
              You
            </text>
          </g>
        )}
        {stops.map((s, i) => (
          <g key={s.stop_id}>
            <circle
              cx={x(i)}
              cy={Y}
              r={i === userIdx ? 9 : 5}
              fill={i === userIdx ? 'var(--ink)' : '#fff'}
              stroke={i === userIdx ? '#fff' : '#8a94a6'}
              strokeWidth={i === userIdx ? 3 : 2}
            />
          </g>
        ))}
        {userStop && (
          <text x={x(userIdx)} y={Y + 30} textAnchor="middle" className="fill-[var(--ink)] text-[12px] font-semibold">
            {userStop.name}
          </text>
        )}
        {bus != null && (
          <motion.g initial={false} animate={{ x: x(bus) }} transition={{ duration: 1, ease: 'easeOut' }}>
            {pulse && <circle cx={0} cy={Y} r={11} fill="#c4360f" className="bus-pulse" />}
            <circle cx={0} cy={Y} r={11} fill={pulse ? '#c4360f' : '#0e7a6d'} stroke="#fff" strokeWidth={3} />
            <text x={0} y={Y - 18} textAnchor="middle" className="fill-[var(--ink-muted)] text-[10px] font-bold uppercase">
              Bus
            </text>
          </motion.g>
        )}
      </svg>
    </section>
  );
}
