import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, MapPin, Route as RouteIcon, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { Stop, TripIntent } from '../../contracts/types';
import { formatClock, TripBar, type TripBarProps } from './TripBar';
import './trip-dropdown.css';

const VERDICT_LABEL = {
  on_time: 'On time',
  tight: 'Tight arrival',
  late: 'Arrives late',
  unknown: 'Arrival unavailable',
} as const;

export interface RouteOption {
  route_id: string;
  name: string;
  direction: string;
  /** False = shown in the picker, but this demo only tracks the live route. */
  live?: boolean;
}

/** A floating trip picker keeps the leave time and map in place while it is open. */
export function TripDropdown({
  stops,
  routes,
  routeId,
  onPickRoute,
  trip,
}: {
  stops: Stop[];
  routes: RouteOption[];
  routeId: string;
  onPickRoute: (routeId: string) => void;
  trip: Omit<TripBarProps, 'stops'>;
}) {
  const [openedFor, setOpenedFor] = useState<TripIntent | null | undefined>(undefined);
  const panelId = useId();
  const panelTitleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const { intent } = trip;
  const dest = stops.find((s) => s.stop_id === intent?.destination_stop_id) ?? null;
  const active = routes.find((r) => r.route_id === routeId) ?? routes[0];
  const settled = intent != null && dest != null && !intent.clarify;
  const open = openedFor !== undefined && !(settled && intent !== openedFor);
  const toggle = () => setOpenedFor(open ? undefined : intent);
  const close = () => {
    setOpenedFor(undefined);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    // A resolved destination closes the panel; keep keyboard focus on its trigger.
    if (openedFor !== undefined && settled && intent !== openedFor) triggerRef.current?.focus();
  }, [intent, openedFor, settled]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpenedFor(undefined);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpenedFor(undefined);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="trip-picker">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={toggle}
        className="trip-picker-trigger"
        data-settled={settled}
        aria-label={settled ? `Trip to ${dest.name}${intent.arrive_by ? `, arrive by ${formatClock(intent.arrive_by)}` : ''}. Change` : undefined}
      >
        <MapPin size={settled ? 16 : 20} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 text-left">
          {!settled && (
            <span className="block truncate text-xs font-semibold tracking-wide text-[var(--ink-muted)] uppercase">
              {active?.name ?? 'BGC Bus'}
              {active?.direction ? ` · ${active.direction}` : ''}
            </span>
          )}
          <span className={`block truncate font-semibold ${settled ? 'text-sm' : 'text-base'}`}>
            {dest ? `To ${dest.name}` : 'Where to?'}
            {settled && intent.arrive_by && <span className="text-[var(--ink-muted)]"> · by {formatClock(intent.arrive_by)}</span>}
          </span>
        </span>
        <ChevronDown size={18} aria-hidden className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {settled && trip.verdict && (
        <p aria-live="polite" className={`mt-1 pr-3 text-right text-xs font-bold ${
          trip.verdict.kind === 'on_time' ? 'text-[var(--chip-good-fg)]'
            : trip.verdict.kind === 'late' ? 'text-[var(--chip-bad-fg)]'
              : 'text-[var(--chip-warn-fg)]'
        }`}>
          {VERDICT_LABEL[trip.verdict.kind]}
        </p>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="dialog"
            aria-labelledby={panelTitleId}
            className="trip-picker-panel"
            initial={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : -4, scale: reduce ? 1 : 0.98 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id={panelTitleId} className="pl-1 text-base font-bold">Plan your trip</h2>
              <button type="button" aria-label="Close trip picker" onClick={close} className="trip-picker-close">
                <X size={18} aria-hidden />
              </button>
            </div>

            <TripBar inline stops={stops} {...trip} />

            <p className="mt-4 mb-2 px-1 text-xs font-bold tracking-wide text-[var(--ink-muted)] uppercase">Bus route</p>
            <div className="trip-route-grid" role="listbox" aria-label="Bus route">
              {routes.map((r) => {
                const selected = r.route_id === routeId;
                const live = r.live !== false;
                return (
                  <button
                    key={r.route_id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-label={`${r.name}, ${r.direction}${live ? '' : ', coming soon'}`}
                    onClick={() => onPickRoute(r.route_id)}
                    className="trip-route-option"
                  >
                    <span className="mb-1 flex items-center justify-between gap-2">
                      <RouteIcon size={16} aria-hidden />
                      {selected ? <Check size={16} aria-hidden /> : <span className="text-[0.6875rem] font-medium text-[var(--ink-muted)]">{live ? 'Live' : 'Soon'}</span>}
                    </span>
                    <span className="block truncate text-sm font-bold">{r.name.replace(/^BGC Bus\s+/, '')}</span>
                    <span className="block truncate text-xs font-medium text-[var(--ink-muted)]">{r.direction}</span>
                  </button>
                );
              })}
            </div>
            {active?.live === false && (
              <p className="mt-3 px-1 text-xs leading-relaxed text-[var(--ink-muted)]">
                North Route has live tracking in this demo. This route is coming soon.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
