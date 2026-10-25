import { CalendarClock, Radio } from 'lucide-react';
import { RollingNumber } from '../../ui/RollingNumber';
import type { ChipModel, HeroModel } from './view';

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

/** Sub clauses the announcement doesn't already say, so the button's name has no repeats. */
const extraSub = (announce: string, sub: string) =>
  sub
    .split(' · ')
    .filter((part) => !announce.includes(part))
    .join(' · ');

export function Hero({ model, fresh, onExplain }: { model: HeroModel; fresh: ChipModel | null; onExplain: () => void }) {
  const isNumber = model.minutes != null;
  const isTakeover = model.state === 'leave_now';
  const extra = extraSub(model.announce, model.sub);

  return (
    <>
      <button
        type="button"
        onClick={onExplain}
        aria-label={`${sentence(model.announce)} ${extra ? `${sentence(extra)} ` : ''}How we worked this out`}
        data-low-confidence={model.lowConfidence}
        className="hero-button mx-2 mt-3 block w-[calc(100%-1rem)] rounded-[20px] px-3 py-2 text-left"
      >
        {isNumber ? (
          <div className="font-display flex flex-wrap items-baseline gap-x-2.5 text-[min(15vw,3.75rem)] leading-none font-bold">
            <span>Leave in</span>
            <span className="inline-flex items-baseline">
              {model.approx && <span>~</span>}
              <RollingNumber value={model.minutes!} />
            </span>
            <span>min</span>
            {model.suffix && <span className="text-[0.45em] font-semibold">{model.suffix}</span>}
          </div>
        ) : isTakeover ? (
          <div className="font-display text-[min(15vw,3.75rem)] leading-[0.95] font-bold">
            <div>{model.headline}</div>
            <div className="mt-1 text-[0.5em] tracking-wide uppercase">{model.subhead}</div>
          </div>
        ) : (
          <div className="font-display text-[min(11vw,2.75rem)] leading-[1.02] font-bold text-balance">{model.headline}</div>
        )}
      </button>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pt-1 pb-8 text-[0.9375rem] font-medium text-[var(--tone-muted)]">
        <p className="text-pretty">
          {model.accent && !isTakeover && <i className="font-semibold">{model.accent}. </i>}
          {model.sub}
        </p>
        {fresh && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-semibold">
            {fresh.live ? (
              <span className="live-dot size-2 rounded-full bg-current" aria-hidden />
            ) : fresh.tone === 'muted' ? (
              <CalendarClock size={14} aria-hidden />
            ) : (
              <Radio size={14} aria-hidden />
            )}
            {fresh.label}
          </span>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {model.announce}
      </p>
    </>
  );
}
