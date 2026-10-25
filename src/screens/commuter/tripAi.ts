import { CONFIG } from '../../contracts/config';
import type { Stop, TripIntent } from '../../contracts/types';
import { parseArriveBy } from '../../logic/arriveBy';
import { resolveTripStub } from './tripStub';

// Trip chat → OpenAI Decisions API (via Backend 2's /api/decide).
// The AI only picks WHICH STOP from our fixed list; the time is parsed on the
// device and all timing math stays deterministic. Only the typed text and the
// stop names are sent: never the user's location (the server also scrubs coordinates).

const UNCLEAR = 'Unclear';
const TIMEOUT_MS = 9000;

interface DecideResponse {
  answer?: unknown;
  confidence?: unknown;
  decided_by?: unknown;
}

const isDecidedBy = (v: unknown): v is TripIntent['decided_by'] =>
  v === 'decisions_api' || v === 'responses_api' || v === 'rules';

export async function resolveTripAi(text: string, stops: Stop[]): Promise<TripIntent> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('/api/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'destination', evidence: text, options: [...stops.map((s) => s.name), UNCLEAR] }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`decide ${res.status}`);
    const data = (await res.json()) as DecideResponse;

    const decidedBy = isDecidedBy(data.decided_by) ? data.decided_by : 'rules';
    const confidence = typeof data.confidence === 'number' ? data.confidence : null;
    const stop = typeof data.answer === 'string' ? (stops.find((s) => s.name === data.answer) ?? null) : null;
    const byAi = decidedBy !== 'rules';
    // AI answers below the threshold ask instead of guessing; a rules match is taken as is.
    const sure = stop !== null && (!byAi || (confidence ?? 0) >= CONFIG.AI_CONFIDENCE_MIN);

    return {
      destination_stop_id: sure ? stop.stop_id : null,
      destination_confidence: byAi ? confidence : null,
      arrive_by: parseArriveBy(text),
      clarify: sure ? null : stop ? `Did you mean ${stop.name}?` : 'Which stop do you mean?',
      decided_by: decidedBy,
    };
  } catch {
    // Local `npm run dev` has no /api, or the network failed: keep working with the keyword match.
    return resolveTripStub(text, stops);
  } finally {
    window.clearTimeout(timer);
  }
}
