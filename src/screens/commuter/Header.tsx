import { ChevronDown, MapPin, Route as RouteIcon } from 'lucide-react';
import { useId, useState } from 'react';
import type { Stop } from '../../contracts/types';
import { TripBar, type TripBarProps } from './TripBar';

export function BrandRow({ label }: { label: string }) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-4">
      <span className="flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--tone-fg)] text-[var(--tone-bg)]" aria-hidden>
          <RouteIcon size={20} />
        </span>
        <span className="text-xl font-bold tracking-tight">SakayKita</span>
      </span>
      <span className="truncate text-xs font-bold tracking-[0.12em] text-[var(--tone-muted)] uppercase">{label}</span>
    </header>
  );
}

/** "To [stop] ⌄": opens the trip chat (TripBar) right under it. */
export function TripDropdown({ stops, trip }: { stops: Stop[]; trip: Omit<TripBarProps, 'stops'> }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const dest = stops.find((s) => s.stop_id === trip.intent?.destination_stop_id) ?? null;

  return (
    <div className="px-4 pt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 text-left text-[var(--ink)] shadow-sm"
      >
        <MapPin size={20} aria-hidden />
        <span className="text-[var(--ink-muted)]">To</span>
        <span className="min-w-0 flex-1 truncate text-[1.0625rem] font-semibold">{dest?.name ?? 'Where are you going?'}</span>
        <ChevronDown size={20} aria-hidden className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={panelId} className="mt-2 text-[var(--ink)]">
          <TripBar inline stops={stops} {...trip} />
        </div>
      )}
    </div>
  );
}
