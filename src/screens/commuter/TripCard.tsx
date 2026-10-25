import { ArrowUpRight, Bell, BellRing, BusFront, ChevronUp, Footprints, MapPin, ShieldCheck } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { CONFIG } from '../../contracts/config';
import type { TripModel } from './view';
import './trip-card.css';

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

const STEP_ICONS = [Footprints, MapPin, BusFront];

export function TripCard({ model, busContext, onExplain }: { model: TripModel; busContext?: string | null; onExplain: () => void }) {
  const { setFor, toggle } = useReminder();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { steps, leaveInSec, stop, crowd } = model;
  const canRemind = steps != null && leaveInSec != null && leaveInSec > 60 && stop != null;
  const busAt = steps?.[2];
  const waiting = busAt?.label === 'If bus leaves now';

  return (
    <section aria-label="Your trip" className="trip-card" data-open={open}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="trip-card-toggle"
      >
        <span className="trip-card-bus" aria-hidden><BusFront size={21} /></span>
        <span className="trip-card-summary">
          <span className="trip-card-arrival">{busAt ? `${waiting ? 'Earliest' : 'Arrives'} ~${busAt.time}` : 'Your trip'}</span>
          <span className="trip-card-caption">
            {busContext?.replace(/\.$/, '') ?? (busAt ? waiting ? 'If the bus leaves now' : 'At your stop' : 'Live trip times unavailable')}
            {crowd && ` · ${crowd}`}
          </span>
        </span>
        {setFor && <BellRing size={16} aria-label="Reminder set" className="shrink-0 text-[var(--map-route)]" />}
        <span className="trip-card-arrow" aria-hidden><ChevronUp size={19} /></span>
      </button>

      <div id={panelId} className="trip-card-reveal" aria-hidden={!open} inert={!open}>
        <div className="trip-card-clip">
          <div className="trip-card-content">
            {steps ? (
              <ol className="trip-timeline" aria-label="Your trip timeline">
                {steps.map((step, i) => {
                  const Icon = STEP_ICONS[i];
                  const [clock, period] = step.time.split(' ');
                  const title = i === 0 ? 'Leave for your stop' : i === 1 ? 'Reach your stop' : waiting ? 'Earliest bus arrival' : 'Your bus arrives';
                  const detail = i === 0 ? (step.label === 'Leave' ? 'Walking time not estimated' : step.label) : i === 1 ? stop : waiting ? 'If the bus departs now' : stop;
                  return (
                    <li key={i} className="trip-timeline-step" data-final={i === 2}>
                      <p className="trip-step-time" aria-label={`${i === 2 ? 'About ' : ''}${step.time}`}>
                        <span>{i === 2 && '~'}{clock}</span><span className="trip-step-period">{period}</span>
                      </p>
                      <span className="trip-step-track" aria-hidden><span className="trip-step-marker"><Icon size={15} /></span></span>
                      <div className="trip-step-copy"><p className="trip-step-title">{title}</p><p className="trip-step-detail">{detail}</p></div>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="trip-empty">Connect to live bus data to see your trip timeline.</p>}

            {canRemind && (
              <button type="button" aria-pressed={setFor != null} onClick={() => void toggle(leaveInSec, steps[0].time, stop)} className="trip-reminder">
                {setFor ? <BellRing size={18} aria-hidden /> : <Bell size={18} aria-hidden />}
                {setFor ? `Reminder set for ${setFor}` : 'Remind me to leave'}
              </button>
            )}

            <div className="trip-card-footer">
              <button type="button" onClick={onExplain}>See the math <ArrowUpRight size={14} aria-hidden /></button>
              <span><ShieldCheck size={13} aria-hidden /> Location stays on your phone</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
