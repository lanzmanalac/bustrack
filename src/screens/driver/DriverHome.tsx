import { useEffect, useRef, useState } from 'react';
import { Check, Lock, RotateCcw, WifiOff } from 'lucide-react';
import route from '../../data/route.json';
import { CONFIG } from '../../contracts/config';
import '../../ui/tokens.css'; // loads Barlow Condensed + Public Sans (read-only use of PM's tokens)
import DemoDrawer from './DemoDrawer';
import { HOLD_MS, NO_TAPS, registerTap, type TapState } from './secretGesture';
import { isLastStop, metersToNextStop } from './sim';
import { useDriver } from './useDriver';

const DISPLAY = "'Barlow Condensed', 'Roboto Condensed', 'Arial Narrow', sans-serif";
const UI = "'Public Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatMeters(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`;
}

export default function DriverHome() {
  const { state, stops, simulate, autoDepart, locked, sent, undo, gpsError, actions } = useDriver();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const taps = useRef<TapState>(NO_TAPS);
  const holdTimer = useRef<number | null>(null);
  const now = useNow(1000);

  // Hidden demo drawer: triple-tap the route name (each tap within 0.6 s of the last),
  // or press and hold it for 1 s.
  const onTitleTap = () => {
    const { state: next, open } = registerTap(taps.current, Date.now());
    taps.current = next;
    if (open) setDrawerOpen(true);
  };
  const cancelHold = () => {
    if (holdTimer.current != null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const startHold = () => {
    cancelHold();
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      taps.current = NO_TAPS;
      setDrawerOpen(true);
    }, HOLD_MS);
  };

  const here = stops[state.stopIndex];
  const next = stops[state.stopIndex + 1] ?? null;
  const atEnd = !state.moving && isLastStop(state, stops);
  const toNext = metersToNextStop(state, stops);

  // Primary button: LEAVING NOW (waiting) / ARRIVED (moving) / RESTART (end of route).
  const primary = atEnd
    ? { label: 'RESTART ROUTE', sub: `Back to ${stops[0].name}`, onClick: actions.restartRoute, tone: 'bg-sky-500 text-slate-950' }
    : state.moving
      ? { label: 'ARRIVED', sub: next ? `at ${next.name}` : '', onClick: actions.arrived, tone: 'bg-amber-400 text-slate-950' }
      : { label: 'LEAVING NOW', sub: `from ${here.name}`, onClick: actions.leavingNow, tone: 'bg-green-700 text-white' };

  const sentAgo = sent ? Math.max(0, Math.round((now - sent.atMs) / 1000)) : null;

  return (
    <main
      className="flex min-h-dvh flex-col gap-3 bg-slate-950 p-4 text-white select-none"
      // touch-action: manipulation turns off double-tap-to-zoom, which otherwise eats the 2nd tap on phones
      style={{ fontFamily: UI, touchAction: 'manipulation' }}
    >
      {/* Header: route name (triple-tap or hold 1 s = demo controls) + mode */}
      <header className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onTitleTap}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={(e) => e.preventDefault()}
          className="-m-2 min-h-12 p-2 text-left"
          style={{ touchAction: 'manipulation', WebkitTouchCallout: 'none' }}
          aria-label={`${route.name}, ${route.direction}`}
        >
          <div className="text-lg leading-tight font-bold">{route.name}</div>
          <div className="text-sm text-slate-300">{route.direction}</div>
        </button>
        <span className="shrink-0 rounded-full border border-slate-500 px-3 py-1 text-sm font-semibold">
          {simulate ? `SIM ×${CONFIG.TIME_SCALE}` : 'GPS'}
        </span>
      </header>

      {/* Where the bus is */}
      <section aria-live="polite" className="rounded-2xl bg-slate-800 px-4 py-3">
        {state.offline ? (
          <p className="flex items-center gap-2 text-2xl font-bold text-red-300">
            <WifiOff aria-hidden /> Signal off · commuters see the schedule
          </p>
        ) : state.moving ? (
          <>
            <p className="text-sm font-semibold tracking-wide text-slate-300 uppercase">Next stop</p>
            <p className="text-5xl leading-none font-bold" style={{ fontFamily: DISPLAY }}>
              {next?.name}
            </p>
            {toNext != null && <p className="mt-1 text-lg text-slate-200">{formatMeters(toNext)} away</p>}
          </>
        ) : (
          <>
            <p className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
              {atEnd ? 'End of route' : state.held ? 'At stop · held (delay injected)' : 'At stop'}
            </p>
            <p className="text-5xl leading-none font-bold" style={{ fontFamily: DISPLAY }}>
              {here.name}
            </p>
            {next && <p className="mt-1 text-lg text-slate-200">Next: {next.name}</p>}
          </>
        )}
        {gpsError && !simulate && <p className="mt-2 text-amber-300">{gpsError}</p>}
      </section>

      {/* Giant primary button (≥40% of the screen) */}
      <button
        type="button"
        onClick={primary.onClick}
        disabled={locked || state.offline}
        className={`flex min-h-[42dvh] flex-1 flex-col items-center justify-center rounded-3xl px-4 transition-colors motion-reduce:transition-none active:scale-[0.99] ${
          locked || state.offline ? 'bg-slate-700 text-slate-200' : primary.tone
        }`}
      >
        <span className="text-6xl leading-none font-bold" style={{ fontFamily: DISPLAY }}>
          {primary.label}
        </span>
        {locked ? (
          <span className="mt-3 flex items-center gap-2 text-xl font-semibold">
            <Lock aria-hidden /> Unlocks when stopped
          </span>
        ) : (
          <span className="mt-3 text-xl font-semibold">{primary.sub}</span>
        )}
      </button>

      {/* BUS FULL toggle: state in words, not just color */}
      <button
        type="button"
        onClick={actions.toggleFull}
        disabled={locked || state.offline}
        aria-pressed={state.isFull}
        className={`flex min-h-20 items-center justify-between rounded-2xl px-5 text-2xl font-bold disabled:opacity-50 ${
          state.isFull ? 'bg-red-700 text-white' : 'border-4 border-white text-white'
        }`}
      >
        <span>BUS FULL</span>
        <span className="rounded-lg bg-black/30 px-3 py-1 text-xl">{state.isFull ? 'ON' : 'OFF'}</span>
      </button>

      {/* Feedback row: Sent indicator + 5-second Undo */}
      <footer className="flex min-h-14 items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-base font-semibold">
          {state.offline ? (
            <span className="text-red-300">Not sending (signal off)</span>
          ) : sent?.ok ? (
            <span className="flex items-center gap-1 text-emerald-300">
              <Check aria-hidden size={20} /> Sent · live{sentAgo != null && sentAgo > 2 ? ` · ${sentAgo}s ago` : ''}
            </span>
          ) : sent ? (
            <span className="text-amber-300">Not sent · retrying</span>
          ) : (
            <span className="text-slate-400">Connecting…</span>
          )}
        </p>
        {undo && (
          <button
            type="button"
            onClick={actions.undo}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 font-bold text-slate-950"
          >
            <RotateCcw aria-hidden size={20} /> Undo {undo.label.toLowerCase()} · {Math.max(0, Math.ceil((undo.untilMs - now) / 1000))}s
          </button>
        )}
      </footer>

      <DemoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        stops={stops}
        state={state}
        simulate={simulate}
        autoDepart={autoDepart}
        actions={actions}
      />
    </main>
  );
}
