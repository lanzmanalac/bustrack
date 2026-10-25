import { Check, ChevronDown, MapPin, Route as RouteIcon } from 'lucide-react';
import { useId, useState } from 'react';
import type { Stop, TripIntent } from '../../contracts/types';
import { formatClock, TripBar, type TripBarProps } from './TripBar';

export interface RouteOption {
  route_id: string;
  name: string;
  direction: string;
  /** False = shown in the picker, but this demo only tracks the live route. */
  live?: boolean;
}

/**
 * Trip picker: route options + "Where to?" chat in one flush card.
 * Once a trip is set it tucks into a small side pill so the leave time stays on top.
 */
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
  // The trip the panel was opened for; undefined = closed. A newly settled trip closes it.
  const [openedFor, setOpenedFor] = useState<TripIntent | null | undefined>(undefined);
  const panelId = useId();
  const { intent } = trip;
  const dest = stops.find((s) => s.stop_id === intent?.destination_stop_id) ?? null;
  const active = routes.find((r) => r.route_id === routeId) ?? routes[0];
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
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-sm">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left"
        >
          <MapPin size={20} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold tracking-wide text-[var(--ink-muted)] uppercase">
              {active?.name ?? 'BGC Bus'}
              {active?.direction ? ` · ${active.direction}` : ''}
            </span>
            <span className="block truncate text-base font-semibold">{dest ? `To ${dest.name}` : 'Where to?'}</span>
          </span>
          {chevron}
        </button>

        {open && (
          <div id={panelId} className="border-t border-[var(--line)]">
            <div className="px-3 pt-3">
              <p className="mb-2 text-xs font-bold tracking-wide text-[var(--ink-muted)] uppercase">Route</p>
              <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto" role="listbox" aria-label="Bus route">
                {routes.map((r) => {
                  const selected = r.route_id === routeId;
                  const live = r.live !== false;
                  return (
                    <button
                      key={r.route_id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => onPickRoute(r.route_id)}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${
                        selected ? 'bg-[var(--page-bg)]' : 'hover:bg-[var(--page-bg)]'
                      }`}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--tone-bg)] text-[var(--tone-fg)]" aria-hidden>
                        <RouteIcon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-bold">{r.name}</span>
                        <span className="block truncate text-sm text-[var(--ink-muted)]">
                          {r.direction}
                          {!live && ' · Coming soon'}
                        </span>
                      </span>
                      {selected && <Check size={18} aria-hidden className="shrink-0 text-[var(--map-route)]" />}
                    </button>
                  );
                })}
              </div>
              {active?.live === false && (
                <p className="mt-2 px-1 text-xs font-semibold text-[var(--ink-muted)]">
                  This demo tracks North Route live. Other routes are listed so you can see what’s next.
                </p>
              )}
            </div>

            <div className="p-3 pt-2">
              <TripBar inline stops={stops} {...trip} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
