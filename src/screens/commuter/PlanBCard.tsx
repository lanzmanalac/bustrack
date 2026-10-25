import { motion } from 'motion/react';
import { BusFront, CarTaxiFront, Footprints, Hourglass, Sparkles, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { PlanB } from '../../contracts/types';
import { PLAN_B_LABEL, type PlanBModel } from './view';

const KIND_ICON: Record<PlanB['kind'], LucideIcon> = {
  wait: Hourglass,
  next_bus: BusFront,
  walk: Footprints,
  ride_hail: CarTaxiFront,
};

/** Short enough that all three alternatives fit on one row. */
const CHIP_LABEL: Record<PlanB['kind'], string> = {
  wait: 'Keep waiting',
  next_bus: 'Next bus',
  walk: 'Walk',
  ride_hail: 'Book a ride',
};

export function PlanBCard({ model, flush = false }: { model: PlanBModel; flush?: boolean }) {
  const [override, setOverride] = useState<PlanB['kind'] | null>(null);
  const picked = override ?? model.kind;
  const isSuggested = picked === model.kind;
  const Icon = KIND_ICON[picked];
  const others = (['wait', 'next_bus', 'walk', 'ride_hail'] as const).filter((k) => k !== picked);

  return (
    <motion.section
      aria-labelledby="plan-b-title"
      className={
        flush
          ? 'rounded-t-[22px] border border-b-0 border-[var(--line)] bg-[var(--surface)] p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(16_24_40_/_0.12)]'
          : 'rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-lg'
      }
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold tracking-wide text-[var(--ink-muted)] uppercase">Plan B · {model.reason}</p>
        {isSuggested && model.aiBadge && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#3730a3]">
            <Sparkles size={14} aria-hidden />
            {model.aiBadge}
          </span>
        )}
        {!isSuggested && (
          <span className="rounded-full bg-[var(--chip-muted-bg)] px-2.5 py-1 text-xs font-bold text-[var(--ink-muted)]">Your pick</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--page-bg)]">
          <Icon size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="plan-b-title" className="text-lg leading-tight font-bold">
            {PLAN_B_LABEL[picked]}
            {isSuggested && model.detail && <span className="font-semibold text-[var(--ink-muted)]"> · {model.detail}</span>}
          </h2>
          {isSuggested && <p className="mt-0.5 text-sm leading-snug text-[var(--ink-muted)]">{model.why}</p>}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Other options">
        {others.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setOverride(kind === model.kind ? null : kind)}
            className="min-h-11 flex-1 rounded-full border border-[var(--line)] px-2 text-sm font-semibold whitespace-nowrap hover:bg-[var(--page-bg)]"
          >
            {kind === model.kind ? `Back to: ${CHIP_LABEL[kind]}` : CHIP_LABEL[kind]}
          </button>
        ))}
      </div>
    </motion.section>
  );
}
