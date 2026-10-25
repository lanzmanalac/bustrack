import { FIXTURE_STATES } from './fixturePlan';

/** Design-review only; shown when the URL has `?state=`. */
export function StateSwitcher({ current, onSelect }: { current: string; onSelect: (state: string) => void }) {
  return (
    <nav aria-label="Design states" className="flex gap-1.5 overflow-x-auto px-4 pt-3 pb-1">
      {FIXTURE_STATES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          aria-pressed={s === current}
          className={`shrink-0 rounded-full px-3 py-1.5 font-mono text-xs font-semibold ${
            s === current ? 'bg-[var(--ink)] text-white' : 'bg-[var(--chip-muted-bg)] text-[var(--ink-muted)]'
          }`}
        >
          {s}
        </button>
      ))}
    </nav>
  );
}
