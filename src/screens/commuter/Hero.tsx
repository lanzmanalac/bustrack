import { RollingNumber } from '../../ui/RollingNumber';
import { PigeonMascot } from './mascot/PigeonMascot';
import type { ChipModel, HeroModel } from './view';
import './hero.css';

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

export function Hero({ model, fresh, onExplain }: { model: HeroModel; fresh: ChipModel | null; onExplain: () => void }) {
  const isNumber = model.minutes != null;
  const isTakeover = model.state === 'leave_now';

  return (
    <>
      <button
        type="button"
        onClick={onExplain}
        aria-label={`${sentence(model.announce)} How we worked this out`}
        data-low-confidence={model.lowConfidence}
        className="hero-button hero-heading mx-2 mt-3 w-[calc(100%-1rem)] rounded-[20px] px-3 py-2 text-left"
      >
        <div className="hero-heading-copy">
          {isNumber ? (
            <div className="hero-countdown">
              <span className="hero-count-label">Leave in</span>
              <span className="hero-count-amount" data-long={model.minutes! >= 100}>
                <span className="hero-count-value">
                  {model.approx && <span className="hero-count-approx">~</span>}
                  <RollingNumber value={model.minutes!} />
                </span>
                <span className="hero-count-unit">min</span>
              </span>
              {model.suffix && <span className="hero-count-suffix">{model.suffix}</span>}
            </div>
          ) : isTakeover ? (
            <div className="text-[min(10vw,2.5rem)] leading-tight font-semibold tracking-tight text-balance">{model.headline}</div>
          ) : (
            <div className="text-[min(9vw,2.25rem)] leading-tight font-semibold tracking-tight text-balance">{model.headline}</div>
          )}
        </div>
        <PigeonMascot state={model.state} staleData={model.lowConfidence || fresh?.tone === 'muted'} />
      </button>

      <p aria-live="polite" className="sr-only">
        {model.announce}
      </p>
    </>
  );
}
