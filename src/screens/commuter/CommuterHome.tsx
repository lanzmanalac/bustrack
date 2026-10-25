import { AnimatePresence, MotionConfig } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import '../../ui/tokens.css';
import { realNowMs, worldElapsedSec } from '../../contracts/clock';
import { CONFIG } from '../../contracts/config';
import type { BusPhase, BusStatus, LeavePlan, Route, Stop, TripIntent } from '../../contracts/types';
import { data } from '../../data/adapter';
import route from '../../data/route.json';
import { loadLastPlan, saveLastPlan } from '../../lib/lastPlan';
import { useLeavePlan } from '../../logic/useLeavePlan';
import { Toast } from '../../ui/Toast';
import { ExplainSheet } from './ExplainSheet';
import { useFixturePlan } from './fixturePlan';
import { TripDropdown } from './Header';
import { Hero } from './Hero';
import { useElementHeight, useNow, useOnline } from './hooks';
import { RouteMap3D } from './map/RouteMap3D';
import { PlanBCard } from './PlanBCard';
import { StateSwitcher } from './StateSwitcher';
import { StopPicker } from './StopPicker';
import { type TripBarProps } from './TripBar';
import { TripCard } from './TripCard';
import { resolveTripStub } from './tripStub';
import { explainFor, heroFor, mapFor, metaFor, planBFor, tripFor, type ViewContext } from './view';

const ROUTE = route as Route;
const TOAST_MS = 4000;
/** Space between the floating card and the route drawn above it. */
const OVERLAY_GAP = 8;
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
  const tripCard = tripFor(plan, ctx, realNowMs());
  const planB = offline ? null : planBFor(plan);
  const toast = useLiveTapToast(plan.phase, plan.bus_at_stop?.name ?? null);
  const takeover = hero.state === 'leave_now';

  useEffect(() => {
    // Browsers block vibration until the user has tapped the page once.
    if (takeover && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(60);
  }, [takeover]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="commuter min-h-dvh">
        <div data-tone={hero.tone} className="tone-backdrop mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
          {top}
          <section className="tone-surface">
            <TripDropdown stops={ROUTE.stops} routeLabel={ROUTE.name.replace(/^BGC Bus\s+/, 'BGC Bus · ')} trip={trip} />
            <Hero model={hero} fresh={meta?.fresh ?? null} onExplain={() => setExplainOpen(true)} />
          </section>

          <main
            className="relative -mt-5 flex flex-1 overflow-hidden rounded-t-[26px] bg-[#f3f4f0]"
            style={{ minHeight: MAP_MIN_ROUTE + overlayHeight + OVERLAY_GAP }}
          >
            <RouteMap3D stops={ROUTE.stops} model={map} pulse={takeover} insetBottom={overlayHeight + OVERLAY_GAP} />
            {/* One card floats over the lower map: the stop picker, Plan B when needed, or the trip timeline. */}
            <div ref={overlayRef} className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-20">
              <AnimatePresence mode="wait">
                {hero.state === 'location_off' ? (
                  <section key="pick" className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-lg">
                    <h2 className="mb-3 text-[1.0625rem] font-bold">Which stop do you walk to?</h2>
                    <StopPicker stops={ROUTE.stops} onPick={onPickStop} label="Pick your stop" />
                  </section>
                ) : planB ? (
                  <PlanBCard key={`${planB.kind}-${planB.reason}`} model={planB} />
                ) : (
                  <TripCard key="trip" model={tripCard} onExplain={() => setExplainOpen(true)} />
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>

        <ExplainSheet open={explainOpen} model={explain} onClose={() => setExplainOpen(false)} />
        <Toast message={toast} />
      </div>
    </MotionConfig>
  );
}

type Trip = Omit<TripBarProps, 'stops'>;

function FixtureCommuter({ trip }: { trip: Trip }) {
  const fixture = useFixturePlan();
  return (
    <CommuterScreen
      plan={fixture.plan}
      forceOffline={fixture.offline}
      onPickStop={fixture.pickStop}
      top={fixture.showSwitcher ? <StateSwitcher current={fixture.name} onSelect={fixture.select} /> : null}
      trip={trip}
    />
  );
}

function LiveCommuter({ trip }: { trip: Trip }) {
  const [pickedStop, setPickedStop] = useState<Stop | null>(null);
  const { plan, buses } = useLeavePlan({ adapter: data, userStop: pickedStop });
  const offline = !useOnline() && CONFIG.DATA_MODE === 'live';
  const saved = useMemo(() => (offline ? loadLastPlan() : null), [offline]);

  useEffect(() => {
    if (!offline) saveLastPlan(plan);
  }, [plan, offline]);

  return (
    <CommuterScreen
      plan={saved?.plan ?? plan}
      buses={offline ? undefined : buses}
      forceOffline={offline}
      onPickStop={setPickedStop}
      trip={trip}
    />
  );
}

/** `/?state=leave_now` shows a design fixture; otherwise the screen runs on live bus data. */
export function CommuterHome() {
  const [fixtureMode] = useState(() => new URLSearchParams(window.location.search).has('state'));
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

  const trip: Trip = {
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
  };

  return fixtureMode ? <FixtureCommuter trip={trip} /> : <LiveCommuter trip={trip} />;
}

export default CommuterHome;
