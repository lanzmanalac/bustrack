import { BusFront, CalendarClock, Radio, Users } from 'lucide-react';
import { Chip } from '../../ui/Chip';
import type { ChipModel } from './view';

function ChipIcon({ chip }: { chip: ChipModel }) {
  if (chip.id === 'phase') return <BusFront size={16} aria-hidden />;
  if (chip.id === 'crowd') return <Users size={16} aria-hidden />;
  if (chip.live) return <span className="live-dot size-2 rounded-full bg-current" aria-hidden />;
  return chip.tone === 'muted' ? <CalendarClock size={16} aria-hidden /> : <Radio size={16} aria-hidden />;
}

export function StatusChips({ chips }: { chips: ChipModel[] }) {
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Bus status">
      {chips.map((chip) => (
        <li key={chip.id}>
          <Chip tone={chip.tone} icon={<ChipIcon chip={chip} />}>
            {chip.label}
          </Chip>
        </li>
      ))}
    </ul>
  );
}
