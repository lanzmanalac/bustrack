import { MapPin } from 'lucide-react';
import type { Stop } from '../../contracts/types';

export function StopPicker({ stops, onPick, label }: { stops: Stop[]; onPick: (stop: Stop) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {stops.map((stop) => (
        <button
          key={stop.stop_id}
          type="button"
          onClick={() => onPick(stop)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[0.9375rem] font-semibold hover:bg-[var(--page-bg)]"
        >
          <MapPin size={16} aria-hidden />
          {stop.name}
        </button>
      ))}
    </div>
  );
}
