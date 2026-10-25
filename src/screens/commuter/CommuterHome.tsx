import { AnimatePresence, MotionConfig } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import '../../ui/tokens.css';
import { realNowMs, worldElapsedSec } from '../../contracts/clock';
import { CONFIG } from '../../contracts/config';
import type { BusPhase, LeavePlan, Route, Stop, TripIntent } from '../../contracts/types';
import route from '../../data/route.json';
import { Toast } from '../../ui/Toast';
import { ExplainSheet } from './ExplainSheet';
import { useFixturePlan } from './fixturePlan';
import { Hero } from './Hero';
import { useNow, useOnline } from './hooks';
import { PlanBCard } from './PlanBCard';
import { RouteLineSlot } from './RouteLineSlot';
import { StateSwitcher } from './StateSwitcher';
import { StatusChips } from './StatusChips';
import { StopPicker } from './StopPicker';
import { TripBar, type TripBarProps } from './TripBar';
import { resolveTripStub } from './tripStub';
import { chipsFor, explainFor, heroFor, planBFor, type ViewContext } from './view';

const ROUTE = route as Route;
const TOAST_MS = 4000;

/** "Bus just left [Stop]": visible proof that the driver's tap is live. */
function useLiveTapToast(phase: BusPhase, busAtStop: string | null): string | null {
  const [message, setMessage] = useState<string | null>(null);
  const prev = useRef({ phase, busAtStop });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const before = prev.current;
    prev.current = { phase, busAtStop };
    if (before.phase !== 'standby' || phase !== 'moving') return;
    setMessage(`Bus just left ${before.busAtStop ?? 'the stop'}`);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), TOAST_MS);
  }, [phase, busAtStop]);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return message;
}

interface CommuterScreenProps {
  plan: LeavePlan;
  forceOffline: boolean;
  onPickStop: (stop: Stop) => void;
  trip: Omit<TripBarProps, 'stops'>;
  top?: ReactNode;
}

export function CommuterScreen({ plan, forceOffline, onPickStop, trip, top }: CommuterScreenProps) {
  useNow(1000);
  const online = useOnline();
  const [explainOpen, setExplainOpen] = useState(false);

  // Mock mode syncs tabs with no network, so being offline only matters for live data.
  const offline = forceOffline || (!online && CONFIG.DATA_MODE === 'live');
  const ctx: ViewContext = {
    worldElapsedSec: worldElapsedSec(plan.computed_at_real_ms),
    realElapsedSec: Math.max(0, (realNowMs() - plan.computed_at_real_ms) / 1000),
    offline,
    headwayMin: ROUTE.headway_min,
  };
  const hero = heroFor(plan, ctx);
  const chips = chipsFor(plan, ctx);
  const explain = explainFor(plan, ctx);
  const planB = offline ? null : planBFor(plan);
  const toast = useLiveTapToast(plan.phase, plan.bus_at_stop?.name ?? null);
  const takeover = hero.state === 'leave_now';

  useEffect(() => {
    // Browsers block vibration until the user has tapped the page once.
    if (takeover && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(200);
  }, [takeover]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="commuter min-h-dvh">
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
          {top}
          <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
            <span className="text-[0.9375rem] font-bold">BGC Bus</span>
            <span className="truncate text-[0.8125rem] font-medium text-[var(--ink-muted)]">
              {ROUTE.name} · {ROUTE.direction}
            </span>
          </header>

          <main className="flex flex-1 flex-col gap-3 px-4">
            <Hero model={hero} onExplain={() => setExplainOpen(true)} />
            <StatusChips chips={chips} />
            <AnimatePresence>{planB && <PlanBCard key={`${planB.kind}-${planB.reason}`} model={planB} />}</AnimatePresence>
            {hero.state === 'location_off' ? (
              <section className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <h2 className="mb-3 text-[1.0625rem] font-bold">Which stop do you walk to?</h2>
                <StopPicker stops={ROUTE.stops} onPick={onPickStop} label="Pick your stop" />
              </section>
            ) : (
              <RouteLineSlot plan={plan} stops={ROUTE.stops} pulse={takeover} />
            )}
          </main>

          <TripBar stops={ROUTE.stops} {...trip} />
        </div>

        <ExplainSheet open={explainOpen} model={explain} onClose={() => setExplainOpen(false)} />
        <Toast message={toast} />
      </div>
    </MotionConfig>
  );
}

export function CommuterHome() {
  const fixture = useFixturePlan();
  const [intent, setIntent] = useState<TripIntent | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (text: string) => {
    setPending(true);
    try {
      setIntent(await resolveTripStub(text, ROUTE.stops));
    } finally {
      setPending(false);
    }
  };

  return (
    <CommuterScreen
      plan={fixture.plan}
      forceOffline={fixture.offline}
      onPickStop={fixture.pickStop}
      top={fixture.showSwitcher ? <StateSwitcher current={fixture.name} onSelect={fixture.select} /> : null}
      trip={{
        intent,
        verdict: null,
        pending,
        onSubmit: submit,
        onPickStop: (stop) =>
          setIntent((prev) => ({
            destination_stop_id: stop.stop_id,
            destination_confidence: null,
            arrive_by: prev?.arrive_by ?? null,
            clarify: null,
            decided_by: 'rules',
          })),
        onSetArriveBy: (arrive_by) => setIntent((prev) => (prev ? { ...prev, arrive_by } : prev)),
        onClear: () => setIntent(null),
      }}
    />
  );
}

export default CommuterHome;
