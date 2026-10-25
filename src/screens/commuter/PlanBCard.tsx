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

export function PlanBCard({ model }: { model: PlanBModel }) {
  const [override, setOverride] = useState<PlanB['kind'] | null>(null);
  const picked = override ?? model.kind;
  const isSuggested = picked === model.kind;
  const Icon = KIND_ICON[picked];
  const others = (['wait', 'next_bus', 'walk', 'ride_hail'] as const).filter((k) => k !== picked);

  return (
    <motion.section
      aria-labelledby="plan-b-title"
      className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-lg"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold tracking-wide text-[var(--ink-muted)] uppercase">Plan B · {model.reason}</p>
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
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--page-bg)]">
          <Icon size={24} aria-hidden />
        </span>
        <div>
          <h2 id="plan-b-title" className="text-xl leading-tight font-bold">
            {PLAN_B_LABEL[picked]}
          </h2>
          {isSuggested && model.detail && <p className="text-base font-semibold text-[var(--ink-muted)]">{model.detail}</p>}
        </div>
      </div>

      {isSuggested && <p className="mt-2 text-[0.9375rem] leading-snug text-[var(--ink-muted)]">{model.why}</p>}

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Other options">
        {others.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setOverride(kind === model.kind ? null : kind)}
            className="min-h-11 rounded-full border border-[var(--line)] px-4 text-[0.9375rem] font-semibold hover:bg-[var(--page-bg)]"
          >
            {kind === model.kind ? `Back to: ${PLAN_B_LABEL[kind]}` : PLAN_B_LABEL[kind]}
          </button>
        ))}
      </div>
    </motion.section>
  );
}
