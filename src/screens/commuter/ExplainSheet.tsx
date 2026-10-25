import { Lock, Radio } from 'lucide-react';
import { BottomSheet } from '../../ui/BottomSheet';
import type { ExplainModel } from './view';

export function ExplainSheet({ open, model, onClose }: { open: boolean; model: ExplainModel; onClose: () => void }) {
  return (
    <BottomSheet open={open} title={model.title} onClose={onClose}>
      {model.rows && (
        <dl className="divide-y divide-[var(--line)] rounded-2xl bg-[var(--page-bg)] px-4">
          {model.rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-[1.0625rem]">
                <span className="inline-block w-5 font-bold text-[var(--ink-muted)]" aria-hidden>
                  {row.op}
                </span>
                <span className="sr-only">{row.op ? 'minus ' : ''}</span>
                {row.label}
              </dt>
              <dd className="font-display text-2xl font-bold">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {model.result && (
        <p className="font-display mt-4 text-[2.5rem] leading-none font-bold">
          <span aria-hidden>= </span>
          {model.result}
        </p>
      )}
      {model.note && <p className="mt-4 text-[1.0625rem] leading-snug">{model.note}</p>}
      <p className="mt-5 flex items-center gap-2 text-[0.9375rem] font-semibold text-[var(--ink-muted)]">
        <Radio size={16} aria-hidden />
        {model.source}
      </p>
      <p className="mt-2 flex items-center gap-2 text-[0.9375rem] text-[var(--ink-muted)]">
        <Lock size={16} aria-hidden />
        Worked out on this phone. Your location isn’t sent anywhere.
      </p>
    </BottomSheet>
  );
}
