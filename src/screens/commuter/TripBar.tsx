import { ArrowUp, CircleCheck, CircleAlert, Clock, Loader2, Lock, MapPin, Pencil, Sparkles, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { CONFIG } from '../../contracts/config';
import type { Stop, TripIntent } from '../../contracts/types';
import { StopPicker } from './StopPicker';

export type TripVerdict = { kind: 'on_time' | 'tight' | 'late'; arriveAt?: string };

export interface TripBarProps {
  stops: Stop[];
  intent: TripIntent | null;
  verdict: TripVerdict | null;
  pending: boolean;
  onSubmit: (text: string) => void;
  onPickStop: (stop: Stop) => void;
  onSetArriveBy: (hhmm: string | null) => void;
  onClear: () => void;
}

function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const VERDICT_COPY: Record<TripVerdict['kind'], string> = {
  on_time: 'This bus gets you there on time',
  tight: 'Tight: this bus gets you there just in time',
  late: 'This bus gets you there late',
};

function EditChip({ icon, children, onClick, label }: { icon: ReactNode; children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--page-bg)] px-3.5 text-[0.9375rem] font-semibold"
    >
      {icon}
      {children}
      <Pencil size={14} className="text-[var(--ink-muted)]" aria-hidden />
    </button>
  );
}

export function TripBar({ stops, intent, verdict, pending, onSubmit, onPickStop, onSetArriveBy, onClear }: TripBarProps) {
  const inputId = useId();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<'stop' | 'time' | null>(null);
  const [userPicked, setUserPicked] = useState(false);

  const stop = stops.find((s) => s.stop_id === intent?.destination_stop_id) ?? null;
  const conf = intent?.destination_confidence ?? null;
  const confident = stop != null && (userPicked || conf == null || conf >= CONFIG.AI_CONFIDENCE_MIN);
  const byAi = intent?.decided_by === 'decisions_api' || intent?.decided_by === 'responses_api';

  const pick = (s: Stop) => {
    setEditing(null);
    setUserPicked(true);
    onPickStop(s);
  };
  const clear = () => {
    setEditing(null);
    setUserPicked(false);
    onClear();
  };

  return (
    <div className="trip-bar-fade sticky bottom-0 z-30 px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      {intent && (
        <section aria-label="Your trip" className="mb-2 rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm">
          {confident ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <EditChip icon={<MapPin size={16} aria-hidden />} onClick={() => setEditing('stop')} label={`Destination ${stop.name}. Change`}>
                  To: {stop.name}
                </EditChip>
                <EditChip
                  icon={<Clock size={16} aria-hidden />}
                  onClick={() => setEditing('time')}
                  label={intent.arrive_by ? `Arrive by ${formatClock(intent.arrive_by)}. Change` : 'Add arrival time'}
                >
                  {intent.arrive_by ? `Arrive by ${formatClock(intent.arrive_by)}` : 'Add arrival time'}
                </EditChip>
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Clear trip"
                  className="ml-auto grid size-11 place-items-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--page-bg)]"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
              <p className="mt-2 flex items-center gap-1.5 px-1 text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                {userPicked ? (
                  'You picked this · tap to change'
                ) : byAi ? (
                  <>
                    <Sparkles size={14} aria-hidden />
                    {conf != null ? `AI pick · ${Math.round(conf * 100)}% sure · tap to change` : 'AI pick · tap to change'}
                  </>
                ) : (
                  'Matched by keyword · tap to change'
                )}
              </p>
              {verdict && (
                <p
                  className={`mt-2 flex items-center gap-1.5 px-1 text-[0.9375rem] font-bold ${
                    verdict.kind === 'on_time' ? 'text-[var(--chip-good-fg)]' : verdict.kind === 'tight' ? 'text-[var(--chip-warn-fg)]' : 'text-[var(--chip-bad-fg)]'
                  }`}
                >
                  {verdict.kind === 'on_time' ? <CircleCheck size={18} aria-hidden /> : <CircleAlert size={18} aria-hidden />}
                  {VERDICT_COPY[verdict.kind]}
                  {verdict.arriveAt ? ` · ${formatClock(verdict.arriveAt)}` : ''}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <p className="px-1 pt-2.5 text-[0.9375rem] font-semibold">{intent.clarify ?? 'Which stop do you mean?'}</p>
              <button
                type="button"
                onClick={clear}
                aria-label="Clear trip"
                className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--page-bg)]"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          )}

          {(!confident || editing === 'stop') && (
            <div className="mt-2">
              <StopPicker stops={stops} onPick={pick} label="Pick your destination stop" />
            </div>
          )}
          {confident && editing === 'time' && (
            <label className="mt-3 flex items-center gap-2 px-1 text-[0.9375rem] font-semibold">
              Arrive by
              <input
                type="time"
                defaultValue={intent.arrive_by ?? ''}
                onChange={(e) => onSetArriveBy(e.target.value || null)}
                onBlur={() => setEditing(null)}
                className="min-h-11 rounded-xl border border-[var(--line)] px-3 text-base"
                autoFocus
              />
            </label>
          )}
        </section>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim();
          if (!value) return;
          setEditing(null);
          setUserPicked(false);
          onSubmit(value);
        }}
        className="flex h-14 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] pr-2 pl-4 shadow-sm focus-within:border-[var(--focus)]"
      >
        <Sparkles size={18} className="shrink-0 text-[#4f46e5]" aria-hidden />
        <label htmlFor={inputId} className="sr-only">
          Where are you going?
        </label>
        <input
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Where to? e.g. High Street by 9"
          autoComplete="off"
          enterKeyHint="go"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#667085]"
        />
        <button
          type="submit"
          aria-label="Plan my trip"
          disabled={!text.trim() || pending}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-white disabled:opacity-35"
        >
          {pending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ArrowUp size={18} aria-hidden />}
        </button>
      </form>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
        <Lock size={14} aria-hidden />
        Your location stays on this phone
      </p>
    </div>
  );
}
