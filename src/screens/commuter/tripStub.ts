import type { Stop, TripIntent } from '../../contracts/types';

const normalize = (s: string) => s.toLowerCase().replace(/[[\]]/g, '').trim();

function parseArriveBy(text: string): string | null {
  const m = text.match(/(?:by|bago|alas[- ]?)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ?? '00';
  if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
  if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/**
 * Stand-in until Backend 2's destination pick (/api/decide + on-device time parsing) lands.
 * Keyword match only: it reports decided_by 'rules' and no confidence, so the UI never shows a fake AI score.
 */
export async function resolveTripStub(text: string, stops: Stop[]): Promise<TripIntent> {
  const t = normalize(text);
  const hit = stops.find((s) => t.includes(normalize(s.name)));
  return {
    destination_stop_id: hit?.stop_id ?? null,
    destination_confidence: null,
    arrive_by: parseArriveBy(text),
    clarify: hit ? null : 'Which stop do you mean?',
    decided_by: 'rules',
  };
}
