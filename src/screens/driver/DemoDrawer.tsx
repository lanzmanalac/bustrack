import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Stop } from '../../contracts/types';
import type { DriverState } from './sim';

interface Props {
  open: boolean;
  onClose: () => void;
  stops: Stop[];
  state: DriverState;
  simulate: boolean;
  autoDepart: boolean;
  actions: {
    setSimulate: (v: boolean) => void;
    setAutoDepart: (v: boolean) => void;
    placeAtStop: (i: number) => void;
    injectDelay: () => void;
    toggleSignal: () => void;
    addRiders: (n?: number) => Promise<void>;
    resetDemo: () => Promise<void>;
  };
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-left font-semibold ${
        on ? 'bg-white text-slate-950' : 'border-2 border-slate-500 text-white'
      }`}
    >
      <span>{label}</span>
      <span>{on ? 'ON' : 'OFF'}</span>
    </button>
  );
}

function Action({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-12 w-full rounded-xl bg-slate-700 px-4 text-left font-semibold text-white disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function DemoDrawer({ open, onClose, stops, state, simulate, autoDepart, actions }: Props) {
  const [note, setNote] = useState<string | null>(null);

  // Escape closes the drawer (keyboard / laptop backup during the demo).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const done = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <section
        role="dialog"
        aria-label="Demo controls"
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-slate-900 p-5 pb-8 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Demo controls</h2>
          <button type="button" onClick={onClose} aria-label="Close demo controls" className="grid size-12 place-items-center rounded-full bg-slate-700">
            <X aria-hidden />
          </button>
        </div>

        <div className="space-y-2">
          <Toggle label="Simulate movement" on={simulate} onClick={() => actions.setSimulate(!simulate)} />
          <Toggle label="Auto-depart at stops" on={autoDepart} onClick={() => actions.setAutoDepart(!autoDepart)} />
        </div>

        <h3 className="mt-5 mb-2 text-sm font-semibold tracking-wide text-slate-300 uppercase">Place bus at stop</h3>
        <div className="grid grid-cols-2 gap-2">
          {stops.map((s, i) => (
            <button
              key={s.stop_id}
              type="button"
              onClick={() => {
                actions.placeAtStop(i);
                done(`Bus placed at ${s.name}`);
              }}
              className={`min-h-12 rounded-xl px-3 text-left text-sm font-semibold ${
                !state.moving && state.stopIndex === i ? 'bg-white text-slate-950' : 'bg-slate-700'
              }`}
            >
              {i + 1}. {s.name}
            </button>
          ))}
        </div>

        <h3 className="mt-5 mb-2 text-sm font-semibold tracking-wide text-slate-300 uppercase">Scenarios</h3>
        <div className="space-y-2">
          <Action
            disabled={state.moving}
            onClick={() => {
              actions.injectDelay();
              done('Delay injected: bus held at this stop');
            }}
          >
            Inject delay {state.moving ? '(stop the bus first)' : `(hold at ${stops[state.stopIndex].name})`}
          </Action>
          <Action
            onClick={() => {
              actions.toggleSignal();
              done(state.offline ? 'Signal restored' : 'Signal killed: commuters see the schedule');
            }}
          >
            {state.offline ? 'Restore signal' : 'Kill signal'}
          </Action>
          <Action
            onClick={() => {
              void actions.addRiders(6).then(() => done('6 rider reports added'));
            }}
          >
            Add 6 riders
          </Action>
          <Action
            onClick={() => {
              void actions.resetDemo().then(() => done('Demo reset'));
            }}
          >
            Reset demo
          </Action>
        </div>

        <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm text-emerald-300">
          {note}
        </p>
      </section>
    </div>
  );
}
