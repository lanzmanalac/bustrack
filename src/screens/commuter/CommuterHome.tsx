import { AnimatePresence, MotionConfig } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import '../../ui/tokens.css';
import { realNowMs, worldElapsedSec } from '../../contracts/clock';
import { CONFIG } from '../../contracts/config';
import type { BusPhase, BusStatus, LeavePlan, Route, Stop, TripIntent } from '../../contracts/types';
import route from '../../data/route.json';
import { Toast } from '../../ui/Toast';
import { ExplainSheet } from './ExplainSheet';
import { useFixturePlan } from './fixturePlan';
import { Hero, HeroMeta } from './Hero';
import { useElementHeight, useNow, useOnline } from './hooks';
import { RouteMap3D } from './map/RouteMap3D';
import { PlanBCard } from './PlanBCard';
import { StateSwitcher } from './StateSwitcher';
import { StopPicker } from './StopPicker';
import { TripBar, type TripBarProps } from './TripBar';
import { resolveTripStub } from './tripStub';
import { explainFor, heroFor, mapFor, metaFor, planBFor, type ViewContext } from './view';

const ROUTE = route as Route;
const TOAST_MS = 4000;
/** The trip bar overlaps the bottom of the map by 88px; the route stays clear of it. */
const MAP_INSET_BOTTOM = 104;
/** Height the route itself always gets, even with Plan B open. */
const MAP_MIN_ROUTE = 180;

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
  /** Live bus positions from useLeavePlan(); without them the map places the bus from the plan. */
  buses?: BusStatus[];
  forceOffline: boolean;
  onPickStop: (stop: Stop) => void;
  trip: Omit<TripBarProps, 'stops'>;
  top?: ReactNode;
}

export function CommuterScreen({ plan, buses, forceOffline, onPickStop, trip, top }: CommuterScreenProps) {
  useNow(1000);
  const online = useOnline();
  const [explainOpen, setExplainOpen] = useState(false);
  const [overlayRef, overlayHeight] = useElementHeight<HTMLDivElement>();

  // Mock mode syncs tabs with no network, so being offline only matters for live data.
  const offline = forceOffline || (!online && CONFIG.DATA_MODE === 'live');
  const ctx: ViewContext = {
    worldElapsedSec: worldElapsedSec(plan.computed_at_real_ms),
    realElapsedSec: Math.max(0, (realNowMs() - plan.computed_at_real_ms) / 1000),
    offline,
    headwayMin: ROUTE.headway_min,
  };
  const hero = heroFor(plan, ctx);
  const meta = metaFor(plan, ctx);
  const map = mapFor(plan, ctx, ROUTE.stops, buses);
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
        <div data-tone={hero.tone} className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
          {top}
          <section className="tone-surface">
            <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-1">
              <span className="text-[0.9375rem] font-bold">BGC Bus</span>
              <span className="truncate text-[0.8125rem] font-medium text-[var(--tone-muted)]">
                {ROUTE.name} · {ROUTE.direction}
              </span>
            </header>
            <Hero model={hero} onExplain={() => setExplainOpen(true)} />
            {meta && <HeroMeta model={meta} />}
          </section>

          <main className="relative -mb-[88px] flex flex-1" style={{ minHeight: MAP_MIN_ROUTE + MAP_INSET_BOTTOM + overlayHeight }}>
            <RouteMap3D stops={ROUTE.stops} model={map} pulse={takeover} insetBottom={MAP_INSET_BOTTOM + overlayHeight} />
            {/* Plan B and the stop picker float over the lower map, just above the trip bar. */}
            <div ref={overlayRef} className="absolute inset-x-3 z-20 bottom-[76px]">
              <AnimatePresence>{planB && <PlanBCard key={`${planB.kind}-${planB.reason}`} model={planB} />}</AnimatePresence>
              {hero.state === 'location_off' && (
                <section className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
                  <h2 className="mb-3 text-[1.0625rem] font-bold">Which stop do you walk to?</h2>
                  <StopPicker stops={ROUTE.stops} onPick={onPickStop} label="Pick your stop" />
                </section>
              )}
            </div>
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
