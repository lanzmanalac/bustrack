import { ArrowUpRight, Bell, BellRing, BusFront, ChevronUp, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
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
          new Notification('Good time to head out', { body: `An easy walk to ${stop} gets you to the bus.` });
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
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { steps, leaveInSec, stop, crowd } = model;
  const canRemind = steps != null && leaveInSec != null && leaveInSec > 60 && stop != null;
  const busAt = steps?.[2];

  return (
    <section aria-label="Your trip" className="rounded-t-[22px] border border-b-0 border-[var(--line)] bg-[var(--surface)] shadow-[0_-8px_24px_rgb(16_24_40_/_0.12)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--tone-bg)] text-[var(--tone-fg)]" aria-hidden>
          <BusFront size={18} />
        </span>
        <span className="min-w-0 flex-1 truncate font-bold">
          {busAt ? (
            <>
              Bus <span className="tabular-nums">{busAt.time}</span>
            </>
          ) : (
            'BGC Bus'
          )}
        </span>
        {crowd && (
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--ink-muted)]">
            <Users size={15} aria-hidden />
            {crowd}
          </span>
        )}
        <ChevronUp size={18} aria-hidden className={`shrink-0 text-[var(--ink-muted)] transition-transform duration-200 ${open ? '' : 'rotate-180'}`} />
        {setFor && <BellRing size={16} aria-label="Reminder set" className="shrink-0 text-[var(--map-route)]" />}
      </button>

      {open && (
        <div id={panelId} className="px-3.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {steps && (
            <ol className="grid grid-cols-3 gap-0 border-t border-[var(--line)] pt-3">
              {steps.map((s, i) => (
                <li key={s.label} className="min-w-0 pr-2 last:pr-0">
                  <div className="flex items-center" aria-hidden>
                    <span className="size-2 shrink-0 rounded-full bg-[var(--map-route)]" />
                    {i < steps.length - 1 && <span className="ml-0 h-0.5 flex-1 bg-[var(--line)]" />}
                  </div>
                  <p className="mt-1.5 text-base font-bold tabular-nums">{s.time}</p>
                  <p className="text-[0.8125rem] leading-snug text-[var(--ink-muted)]">{s.label}</p>
                </li>
              ))}
            </ol>
          )}

          {canRemind && (
            <button
              type="button"
              aria-pressed={setFor != null}
              onClick={() => void toggle(leaveInSec, steps[0].time, stop)}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--tone-bg)] text-[0.9375rem] font-bold text-[var(--tone-fg)]"
            >
              {setFor ? <BellRing size={17} aria-hidden /> : <Bell size={17} aria-hidden />}
              {setFor ? `Reminder · ${setFor}` : 'Remind me to leave'}
            </button>
          )}

          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-[0.8125rem]">
            <button type="button" onClick={onExplain} className="inline-flex min-h-11 items-center gap-1 font-semibold">
              See the math
              <ArrowUpRight size={15} aria-hidden />
            </button>
            <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
              <ShieldCheck size={15} aria-hidden />
              Location stays on your phone
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
