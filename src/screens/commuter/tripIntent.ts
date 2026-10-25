import { CONFIG } from '../../contracts/config';
import type { Stop, TripIntent } from '../../contracts/types';
import { parseArriveBy } from '../../logic/arriveBy';
import { decideByRules, type DecideResponse } from '../../logic/decide';

const REQUEST_TIMEOUT_MS = 9_000;

function isDecision(value: unknown, options: string[]): value is DecideResponse {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Partial<DecideResponse>;
  return typeof result.answer === 'string' && options.includes(result.answer)
    && (result.confidence === null || (typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1))
    && (result.decided_by === 'decisions_api' || result.decided_by === 'responses_api' || result.decided_by === 'rules');
}

/** Resolve only the stop remotely. Deadline parsing and the commuter's position stay on the phone. */
export async function resolveTrip(text: string, stops: Stop[], request: typeof fetch = fetch): Promise<TripIntent> {
  const options = [...stops.map((stop) => stop.name), 'Unclear'];
  const arrive_by = parseArriveBy(text);
  let decision: DecideResponse | null = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await request('/api/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'destination', evidence: text, options }),
      signal: controller.signal,
    });
    if (response.ok) {
      const body: unknown = await response.json();
      if (isDecision(body, options)) decision = body;
    }
  } catch {
    // Local rules keep the trip picker usable when the function or network is unavailable.
  } finally {
    clearTimeout(timer);
  }

  decision ??= decideByRules('destination', text, options);
  const stop = stops.find((candidate) => candidate.name === decision.answer) ?? null;
  const needsClarification = !stop || (decision.decided_by === 'decisions_api'
    && decision.confidence !== null && decision.confidence < CONFIG.AI_CONFIDENCE_MIN);

  return {
    destination_stop_id: stop?.stop_id ?? null,
    destination_confidence: decision.decided_by === 'rules' ? null : decision.confidence,
    arrive_by,
    clarify: needsClarification ? 'Which stop do you mean?' : null,
    decided_by: decision.decided_by,
  };
}
