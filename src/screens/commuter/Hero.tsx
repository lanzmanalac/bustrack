import { CalendarClock, ChevronRight, Radio, Users } from 'lucide-react';
import { RollingNumber } from '../../ui/RollingNumber';
import type { HeroModel, MetaModel } from './view';

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

export function Hero({ model, onExplain }: { model: HeroModel; onExplain: () => void }) {
  const isNumber = model.minutes != null;
  const isTakeover = model.state === 'leave_now';

  return (
    <>
      <button
        type="button"
        onClick={onExplain}
        aria-label={`${sentence(model.announce)} ${model.announce.includes(model.sub) ? '' : `${sentence(model.sub)} `}How we worked this out`}
        data-low-confidence={model.lowConfidence}
        className="hero-button block w-full rounded-[22px] px-5 pt-1 pb-3 text-left"
      >
        <div className="flex min-h-7 items-baseline justify-between gap-3">
          <span className="text-lg font-semibold text-[var(--tone-muted)]">{isNumber ? 'Leave in' : ''}</span>
          {model.accent && <span className="text-[0.9375rem] font-semibold text-[var(--tone-muted)] italic">{model.accent}</span>}
        </div>

        {isNumber ? (
          <div className="font-display flex items-end gap-2.5 leading-[0.8] font-bold">
            {/* vw-capped sizes: already huge, so they must not grow with the user's text size and clip */}
            {model.approx && <span className="pb-[0.1em] text-[min(14vw,4rem)]">~</span>}
            <RollingNumber value={model.minutes!} className="text-[min(38vw,9.5rem)]" />
            <span className="flex flex-col pb-[0.16em] leading-none">
              <span className="text-[min(10vw,2.75rem)]">{model.minutes === 1 ? 'minute' : 'minutes'}</span>
              {model.suffix && <span className="text-[min(6vw,1.5rem)] font-semibold">{model.suffix}</span>}
            </span>
          </div>
        ) : isTakeover ? (
          <div className="font-display leading-[0.85] font-bold">
            <div className="text-[min(28vw,8rem)]">{model.headline}</div>
            <div className="mt-1 text-[min(11vw,3rem)] tracking-wide uppercase">{model.subhead}</div>
          </div>
        ) : (
          <div className="font-display text-[clamp(2.75rem,13vw,3.75rem)] leading-[0.95] font-bold text-balance">{model.headline}</div>
        )}

        <p className="mt-2.5 text-base leading-snug font-medium text-pretty text-[var(--tone-muted)]">{model.sub}</p>
        <span className="mt-1.5 inline-flex items-center gap-0.5 text-[0.8125rem] font-semibold text-[var(--tone-muted)] underline decoration-[var(--tone-accent)] decoration-2 underline-offset-4">
          How we worked this out
          <ChevronRight size={16} aria-hidden />
        </span>
      </button>
      <p aria-live="polite" className="sr-only">
        {model.announce}
      </p>
    </>
  );
}

/** One quiet line: how fresh the data is, and the crowd level when known. Never a passenger count. */
export function HeroMeta({ model }: { model: MetaModel }) {
  const { fresh, crowd } = model;
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-8 text-[0.8125rem] font-semibold text-[var(--tone-muted)]">
      <span className="inline-flex items-center gap-1.5">
        {fresh.live ? (
          <span className="live-dot size-2 rounded-full bg-current" aria-hidden />
        ) : fresh.tone === 'muted' ? (
          <CalendarClock size={14} aria-hidden />
        ) : (
          <Radio size={14} aria-hidden />
        )}
        {fresh.label}
      </span>
      {crowd && (
        <span className="inline-flex items-center gap-1.5">
          <Users size={14} aria-hidden />
          {crowd.label}
        </span>
      )}
    </p>
  );
}
