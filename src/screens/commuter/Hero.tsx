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
          <div className="flex flex-wrap items-baseline gap-x-2 text-[min(12vw,3rem)] leading-tight font-semibold tracking-tight">
            <span>Leave in</span>
            <span className="inline-flex items-baseline">
              {model.approx && <span>~</span>}
              <RollingNumber value={model.minutes!} />
            </span>
            <span>min</span>
            {model.suffix && <span className="text-[0.45em] font-medium">{model.suffix}</span>}
          </div>
        ) : isTakeover ? (
          <div className="text-[min(10vw,2.5rem)] leading-tight font-semibold tracking-tight text-balance">{model.headline}</div>
        ) : (
          <div className="text-[min(9vw,2.25rem)] leading-tight font-semibold tracking-tight text-balance">{model.headline}</div>
        )}
      </button>

      <ul className="flex flex-wrap gap-1.5 px-5 pt-2 pb-8 text-sm font-semibold">
        {model.sub.split(' · ').map((part) => (
          <li key={part} className="rounded-full bg-white/65 px-3 py-1">
            {part}
          </li>
        ))}
        {fresh && (
          <li className="inline-flex items-center gap-1.5 rounded-full bg-white/65 px-3 py-1">
            {fresh.live ? (
              <span className="live-dot size-2 rounded-full bg-current" aria-hidden />
            ) : fresh.tone === 'muted' ? (
              <CalendarClock size={14} aria-hidden />
            ) : (
              <Radio size={14} aria-hidden />
            )}
            {fresh.label.replace(/^Updated /, '')}
          </li>
        )}
      </ul>

      <p aria-live="polite" className="sr-only">
        {model.announce}
      </p>
    </>
  );
}
