import { ArrowUpRight, Bell, BellRing, BusFront, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../../contracts/config';
import type { TripModel } from './view';

/** One local reminder at leave time: a notification if allowed, a vibration either way. Nothing leaves the phone. */
function useReminder() {
  const [setFor, setSetFor] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const toggle = async (leaveInWorldSec: number, time: string, stop: string) => {
    window.clearTimeout(timer.current);
    if (setFor) return setSetFor(null);
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    timer.current = window.setTimeout(
      () => {
        navigator.vibrate?.(200);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Alis na! Time to leave', { body: `Walk to ${stop} now to catch the bus.` });
        }
        setSetFor(null);
      },
      Math.max(0, (leaveInWorldSec / CONFIG.TIME_SCALE) * 1000),
    );
    setSetFor(time);
  };
  return { setFor, toggle };
}

export function TripCard({ model, onExplain }: { model: TripModel; onExplain: () => void }) {
  const { setFor, toggle } = useReminder();
  const { steps, leaveInSec, stop, crowd } = model;
  const canRemind = steps != null && leaveInSec != null && leaveInSec > 60 && stop != null;

  return (
    <section aria-label="Your trip" className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--tone-bg)] text-[var(--tone-fg)]" aria-hidden>
          <BusFront size={20} />
        </span>
        <p className="min-w-0 flex-1 truncate text-[1.0625rem] font-bold">
          BGC Bus{stop && <span className="font-medium text-[var(--ink-muted)]"> · {stop}</span>}
        </p>
        {crowd && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[var(--ink-muted)]">
            <Users size={16} aria-hidden />
            {crowd}
          </span>
        )}
      </div>

      {steps && (
        <ol className="mt-4 grid grid-cols-3 gap-2">
          {steps.map((s, i) => (
            <li key={s.label}>
              <div className="flex items-center gap-1" aria-hidden>
                <span className="size-2 shrink-0 rounded-full bg-[var(--map-route)]" />
                {i < steps.length - 1 && <span className="h-0.5 flex-1 rounded-full bg-[var(--line)]" />}
              </div>
              <p className="mt-2 text-lg font-bold tabular-nums">{s.time}</p>
              <p className="text-sm leading-snug text-[var(--ink-muted)]">{s.label}</p>
            </li>
          ))}
        </ol>
      )}

      {canRemind && (
        <button
          type="button"
          aria-pressed={setFor != null}
          onClick={() => void toggle(leaveInSec, steps[0].time, stop)}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--tone-bg)] text-base font-bold text-[var(--tone-fg)]"
        >
          {setFor ? <BellRing size={18} aria-hidden /> : <Bell size={18} aria-hidden />}
          {setFor ? `Reminder set · ${setFor}` : 'Remind me to leave'}
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 text-sm">
        <button type="button" onClick={onExplain} className="inline-flex min-h-11 items-center gap-1 font-semibold">
          See the math
          <ArrowUpRight size={16} aria-hidden />
        </button>
        <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
          <ShieldCheck size={16} aria-hidden />
          Location stays on your phone
        </span>
      </div>
    </section>
  );
}
