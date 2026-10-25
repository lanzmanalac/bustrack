import { ChevronRight } from 'lucide-react';
import { RollingNumber } from '../../ui/RollingNumber';
import type { HeroModel } from './view';

export function Hero({ model, onExplain }: { model: HeroModel; onExplain: () => void }) {
  const isNumber = model.minutes != null;
  const isTakeover = model.state === 'leave_now';
  const height = isNumber || isTakeover ? 'min-h-[42dvh]' : 'min-h-[30dvh]';

  return (
    <>
      <button
        type="button"
        onClick={onExplain}
        data-tone={model.tone}
        data-low-confidence={model.lowConfidence}
        className={`tone-surface relative flex ${height} w-full flex-col justify-between gap-4 rounded-[28px] p-6 text-left`}
      >
        <div className="flex min-h-8 items-start justify-between gap-3">
          <span className="text-lg font-semibold text-[var(--tone-muted)]">{isNumber ? 'Leave in' : ''}</span>
          {model.accent && (
            <span className="rounded-full bg-[var(--tone-pill)] px-3 py-1 text-sm font-semibold text-[var(--tone-fg)] italic">
              {model.accent}
            </span>
          )}
        </div>

        {isNumber ? (
          <div className="font-display flex items-end gap-2 leading-[0.8] font-bold">
            {/* vw-capped sizes: already huge, so they must not grow with the user's text size and clip */}
            {model.approx && <span className="pb-[0.12em] text-[min(15vw,4.5rem)]">~</span>}
            <RollingNumber value={model.minutes!} className="text-[min(40vw,10rem)]" />
            <span className="flex flex-col pb-[0.2em] text-[min(10vw,2.75rem)] leading-none">
              <span>min</span>
              {model.suffix && <span className="font-display text-[min(6vw,1.625rem)] font-semibold">{model.suffix}</span>}
            </span>
          </div>
        ) : isTakeover ? (
          <div className="font-display leading-[0.85] font-bold">
            <div className="text-[min(28vw,8rem)]">{model.headline}</div>
            <div className="mt-2 text-[min(11vw,3rem)] tracking-wide uppercase">{model.subhead}</div>
          </div>
        ) : (
          <div className="font-display text-[clamp(2.75rem,14vw,4rem)] leading-[0.95] font-bold text-balance">{model.headline}</div>
        )}

        <div className="flex flex-col gap-3">
          <p className="text-[1.0625rem] leading-snug font-medium text-[var(--tone-muted)]">{model.sub}</p>
          <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-[var(--tone-fg)] underline decoration-[var(--tone-accent)] decoration-2 underline-offset-4">
            How we worked this out
            <ChevronRight size={16} aria-hidden />
          </span>
        </div>
      </button>
      <p aria-live="polite" className="sr-only">
        {model.announce}
      </p>
    </>
  );
}
