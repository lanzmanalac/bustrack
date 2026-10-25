/**
 * POST /api/decide — the OpenAI proxy (BUILD_PLAN §8).
 *
 * Thin HTTP shell. ALL decision logic lives in `src/logic/decide.ts` so it is
 * unit-testable without a network or a key; this file only validates, fetches
 * and falls back.
 *
 * Fallback chain (nothing blocks, nothing 500s):
 *   1. Decisions API   POST /v1/decisions  (preferred)
 *   2. Responses API   POST /v1/responses  (strict enum schema)
 *   3. rules           decideByRules()     (no key needed)
 * The API reports `decided_by`; it never applies AI_CONFIDENCE_MIN, because
 * only the client knows the live bus state.
 *
 * Rules honoured here:
 *   - Rule 5  no new dependencies: the Vercel types below are declared
 *             structurally instead of adding `@vercel/node`.
 *   - Rule 8  no fake precision: an unusable payload returns null and we fall
 *             back rather than echoing garbage as an answer.
 *   - Rule 9  coordinates never leave the device: `parseDecideRequest` scrubs
 *             evidence on the way in, and we re-check before sending. Nothing
 *             else from the request is forwarded to OpenAI.
 *
 * IMPORTANT: do not import `src/contracts/config.ts` (directly or transitively).
 * It reads `import.meta.env` at module scope, which throws under Node — that is
 * why `src/logic/decide.ts` is deliberately dependency-free.
 */

import {
  DECISIONS_URL,
  RESPONSES_URL,
  buildDecisionsBody,
  buildResponsesBody,
  confineToOptions,
  containsCoordinates,
  decideByRules,
  parseDecisionsAnswer,
  parseDecideRequest,
  parseResponsesText,
  scrubCoordinates,
  type DecideRequest,
  type DecideResponse,
} from '../src/logic/decide';

/** Structural stand-in for @vercel/node's NextApiRequest (Rule 5). */
interface HttpIn {
  method?: string;
  body?: unknown;
}

/** Structural stand-in for @vercel/node's NextApiResponse (Rule 5). */
interface HttpOut {
  status(code: number): HttpOut;
  json(payload: unknown): void;
  setHeader(name: string, value: string): void;
}

/** Whole-request budget. Vercel hobby functions cap at 10s; leave headroom. */
const DEADLINE_MS = 8_000;

/**
 * One OpenAI call, bounded by the shared deadline. Returns the parsed JSON, or
 * null for ANY failure (4xx/5xx, timeout, network) so the caller falls back —
 * an AI outage must never surface as an error to the commuter.
 */
async function callOpenAI(url: string, payload: unknown, key: string, deadline: number): Promise<unknown | null> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse an AI payload and accept it only if we actually offered that option.
 *
 * `api` must name the endpoint that produced the payload — NOT `request.decision`.
 * The two endpoints have unrelated response shapes (`.answers[]` vs `.output[]`),
 * so keying off the decision kind would parse a Decisions payload with the
 * Responses parser and silently discard a perfectly good answer.
 */
function confinedFrom(
  payload: unknown,
  request: DecideRequest,
  api: 'decisions' | 'responses',
): DecideResponse | null {
  const parsed =
    api === 'decisions'
      ? parseDecisionsAnswer(payload, request.decision)
      : parseResponsesText(payload, request.decision);
  if (parsed === null) return null;
  return confineToOptions(parsed, request.options);
}

export default async function handler(req: HttpIn, res: HttpOut): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    res.status(405).json({ error: 'Use POST.' });
    return;
  }

  let body: unknown = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'Body must be valid JSON.' });
      return;
    }
  }

  const request = parseDecideRequest(body);
  if ('error' in request) {
    res.status(400).json({ error: request.error });
    return;
  }

  // Belt and braces for Rule 9 — already scrubbed by parseDecideRequest.
  const evidence = containsCoordinates(request.evidence)
    ? scrubCoordinates(request.evidence)
    : request.evidence;

  const deadline = Date.now() + DEADLINE_MS;
  const key = process.env.OPENAI_API_KEY;

  // No key configured (or an early deploy): rules still answer. Never a 500.
  if (key) {
    const decisionsPayload = await callOpenAI(
      DECISIONS_URL,
      buildDecisionsBody(request.decision, evidence, request.options),
      key,
      deadline,
    );
    const decisions = decisionsPayload === null ? null : confinedFrom(decisionsPayload, request, 'decisions');
    if (decisions !== null) {
      res.status(200).json(decisions);
      return;
    }

    const responsesPayload = await callOpenAI(
      RESPONSES_URL,
      buildResponsesBody(request.decision, evidence, request.options),
      key,
      deadline,
    );
    const responses = responsesPayload === null ? null : confinedFrom(responsesPayload, request, 'responses');
    if (responses !== null) {
      res.status(200).json(responses);
      return;
    }
  }

  // Rules only ever pick from the options we were handed, so no confine needed.
  res.status(200).json(decideByRules(request.decision, evidence, request.options));
}
