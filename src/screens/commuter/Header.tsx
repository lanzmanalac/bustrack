import { ChevronDown, MapPin } from 'lucide-react';
import { useId, useState } from 'react';
import type { Stop, TripIntent } from '../../contracts/types';
import { formatClock, TripBar, type TripBarProps } from './TripBar';

/**
 * "Where to?" with the route name. Opens the trip chat (TripBar) under it, and once a trip
 * is set it tucks into a small pill on the side so the leave time stays on top.
 */
export function TripDropdown({ stops, routeLabel, trip }: { stops: Stop[]; routeLabel: string; trip: Omit<TripBarProps, 'stops'> }) {
  // The trip the panel was opened for; undefined = closed. A newly settled trip closes it.
  const [openedFor, setOpenedFor] = useState<TripIntent | null | undefined>(undefined);
  const panelId = useId();
  const { intent } = trip;
  const dest = stops.find((s) => s.stop_id === intent?.destination_stop_id) ?? null;
  const settled = intent != null && dest != null && !intent.clarify;
  const open = openedFor !== undefined && !(settled && intent !== openedFor);
  const toggle = () => setOpenedFor(open ? undefined : intent);
  const chevron = <ChevronDown size={18} aria-hidden className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />;

  if (settled && !open) {
    return (
      <div className="flex justify-end px-4 pt-3">
        <button
          type="button"
          aria-expanded={false}
          aria-controls={panelId}
          onClick={toggle}
          aria-label={`Trip to ${dest.name}${intent.arrive_by ? `, arrive by ${formatClock(intent.arrive_by)}` : ''}. Change`}
          className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] shadow-sm"
        >
          <MapPin size={16} aria-hidden />
          <span className="truncate">
            {dest.name}
            {intent.arrive_by && <span className="text-[var(--ink-muted)]"> · by {formatClock(intent.arrive_by)}</span>}
          </span>
          {chevron}
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-left text-[var(--ink)] shadow-sm"
      >
        <MapPin size={20} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold tracking-wide text-[var(--ink-muted)] uppercase">{routeLabel}</span>
          <span className="block truncate text-base font-semibold">{dest ? `To ${dest.name}` : 'Where to?'}</span>
        </span>
        {chevron}
      </button>
      {open && (
        <div id={panelId} className="mt-2 text-[var(--ink)]">
          <TripBar inline stops={stops} {...trip} />
        </div>
      )}
    </div>
  );
}
