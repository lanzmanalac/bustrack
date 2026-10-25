import type { ReactNode } from 'react';

export type ChipTone = 'neutral' | 'good' | 'warn' | 'bad' | 'muted';

const TONE_CLASS: Record<ChipTone, string> = {
  neutral: 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)]',
  good: 'bg-[var(--chip-good-bg)] text-[var(--chip-good-fg)] border-transparent',
  warn: 'bg-[var(--chip-warn-bg)] text-[var(--chip-warn-fg)] border-transparent',
  bad: 'bg-[var(--chip-bad-bg)] text-[var(--chip-bad-fg)] border-transparent',
  muted: 'bg-[var(--chip-muted-bg)] text-[var(--chip-muted-fg)] border-dashed border-[#9aa3b2]',
};

export function Chip({ icon, tone = 'neutral', children }: { icon?: ReactNode; tone?: ChipTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.9375rem] leading-tight font-semibold ${TONE_CLASS[tone]}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
