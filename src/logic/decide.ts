/**
 * The decision layer behind POST /api/decide.
 *
 * Everything here is pure so it can be tested without a network or a key.
 * `api/decide.ts` is only an HTTP shell that does the fetching.
 *
 * Policy note: this module returns the best answer it can find and reports HOW
 * it decided. It does not apply AI_CONFIDENCE_MIN — deciding whether to trust
 * an answer, ask "did you mean A or B?", or fall back to `planB()` is the
 * client's call, because only the client knows the live bus state.
 *
 * IMPORTANT — no imports on purpose. This module must load inside a Node
 * serverless function, and `src/contracts/config.ts` reads `import.meta.env`
 * at module scope, which throws in Node (it only exists under Vite). The
 * threshold lives in CONFIG and is applied by the client, so nothing here
 * needs it. Keep this file dependency-free.
 */

export type DecisionKind = 'destination' | 'plan_b';
export type DecidedBy = 'decisions_api' | 'responses_api' | 'rules';

export interface DecideRequest {
  decision: DecisionKind;
  evidence: string;
  options: string[];
}

export interface DecideResponse {
  answer: string;
  confidence: number | null;
  decided_by: DecidedBy;
}

/** BUILD_PLAN §8, verbatim shared instruction for the destination decision. */
export const DESTINATION_QUESTION = 'Which stop is the commuter heading to?';
export const PLAN_B_QUESTION = 'What should this commuter do next?';

export const SHARED_INSTRUCTION = `You help BGC Bus commuters in Bonifacio Global City, Philippines.
Messages may be in English, Filipino or Taglish.
Pick exactly one of the provided options. Never invent an option.
If the message doesn't clearly name or describe a stop, pick "Unclear".
Examples:
"need to be at [Stop 4] by 9" -> "[Stop 4]"
"pauwi na ko" -> "Unclear"`;

export const UNCLEAR = 'Unclear';

/** Descriptions only for the fixed Plan B options; stop names describe themselves. */
const OPTION_DESCRIPTIONS: Record<string, string> = {
  'Keep waiting': 'The bus is still expected shortly and waiting is the best option.',
  'Take the next bus': 'This bus is missed, full, or too far away; the following bus is better.',
  Walk: 'Walking to the destination or another stop is faster than waiting.',
  'Book a ride': 'Hailing or booking a car or motorcycle ride is the best option.',
  Unclear: 'The message does not clearly name or describe a stop on this route.',
};

export const PLAN_B_OPTIONS = Object.keys(OPTION_DESCRIPTIONS).filter((o) => o !== UNCLEAR);

// ─────────────────────────────────────────────────────────────────────────────
// Privacy guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Redacts coordinate pairs before any text leaves the device (Rule 9).
 * Matches "14.5480, 121.0560" style pairs only, so a time like "9:30" and a
 * street like "5th Ave" pass through untouched.
 */
const COORD_PAIR = /-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g;

export function scrubCoordinates(text: string): string {
  return text.replace(COORD_PAIR, '[location removed]');
}

export function containsCoordinates(text: string): boolean {
  COORD_PAIR.lastIndex = 0;
  return COORD_PAIR.test(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_OPTIONS = 255; // Decisions API limit
export const MAX_EVIDENCE_CHARS = 4000;

export function parseDecideRequest(body: unknown): DecideRequest | { error: string } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'Body must be a JSON object.' };
  }

  const raw = body as Partial<DecideRequest>;
  const decision = raw.decision;
  if (decision !== 'destination' && decision !== 'plan_b') {
    return { error: 'decision must be "destination" or "plan_b".' };
  }

  if (typeof raw.evidence !== 'string' || raw.evidence.trim() === '') {
    return { error: 'evidence must be a non-empty string.' };
  }
  if (raw.evidence.length > MAX_EVIDENCE_CHARS) {
    return { error: `evidence must be at most ${MAX_EVIDENCE_CHARS} characters.` };
  }

  const options = raw.options;
  if (!Array.isArray(options) || options.length === 0) {
    return { error: 'options must be a non-empty array of strings.' };
  }
  if (!options.every((o) => typeof o === 'string' && o.trim() !== '')) {
    return { error: 'every option must be a non-empty string.' };
  }
  if (options.length > MAX_OPTIONS) {
    return { error: `options must contain at most ${MAX_OPTIONS} entries.` };
  }

  return { decision, evidence: scrubCoordinates(raw.evidence), options };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rules fallback — never invents an option, never needs a key
// ─────────────────────────────────────────────────────────────────────────────

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Lexical match of the typed message against the offered options.
 * `confidence` here is a match STRENGTH (0–1), not a model probability —
 * `decided_by: 'rules'` is what tells the client not to read it as AI output.
 */
export function rulesDestination(evidence: string, options: string[]): DecideResponse {
  const haystack = ` ${normalize(evidence)} `;
  let bestOption: string | null = null;
  let bestScore = 0;
  let bestMatched = 0;

  for (const option of options) {
    if (normalize(option) === normalize(UNCLEAR)) continue;

    const tokens = normalize(option).split(' ').filter(Boolean);
    if (tokens.length === 0) continue;

    const matched = tokens.filter((token) => haystack.includes(` ${token} `)).length;
    const score = matched / tokens.length;

    // Prefer covering more of a longer name: "Bonifacio High Street" beating
    // a stray "High" only when it covers more tokens overall.
    if (matched > 0 && (score > bestScore || (score === bestScore && matched > bestMatched))) {
      bestScore = score;
      bestMatched = matched;
      bestOption = option;
    }
  }

  if (bestOption === null || bestScore < 0.5) {
    return { answer: firstUnclear(options), confidence: 0, decided_by: 'rules' };
  }

  return {
    answer: bestOption,
    // Verbatim coverage reads as high confidence; a partial token match does not.
    confidence: bestScore >= 1 ? 0.95 : 0.7,
    decided_by: 'rules',
  };
}

/** Plan B cues in English and Filipino, highest priority first. */
const PLAN_B_CUES: Array<{ tokens: string[]; answer: string }> = [
  { answer: 'Take the next bus', tokens: ['full', 'puno', 'missed', 'lumipas', 'hindi na aabot', 'next bus'] },
  { answer: 'Book a ride', tokens: ['mabigat', 'heavy', 'ulan', 'rain', 'umuulan', 'grab', 'book'] },
  { answer: 'Walk', tokens: ['walk', 'lakad', 'delay', 'late', 'na-delay', 'traffic'] },
];

export function rulesPlanB(evidence: string, options: string[]): DecideResponse {
  const haystack = normalize(evidence);
  const available = options.map((o) => ({ option: o, normalized: normalize(o) }));

  for (const cue of PLAN_B_CUES) {
    const target = available.find((o) => o.normalized === normalize(cue.answer));
    if (!target) continue; // never invent an option we were not offered
    if (cue.tokens.some((token) => haystack.includes(normalize(token)))) {
      return { answer: target.option, confidence: 0.7, decided_by: 'rules' };
    }
  }

  const keepWaiting = available.find((o) => o.normalized === normalize('Keep waiting'));
  if (keepWaiting) {
    return { answer: keepWaiting.option, confidence: 0.5, decided_by: 'rules' };
  }

  return { answer: firstUnclear(options), confidence: 0, decided_by: 'rules' };
}

export function decideByRules(decision: DecisionKind, evidence: string, options: string[]): DecideResponse {
  return decision === 'destination'
    ? rulesDestination(evidence, options)
    : rulesPlanB(evidence, options);
}

function firstUnclear(options: string[]): string {
  const unclear = options.find((o) => normalize(o) === normalize(UNCLEAR));
  return unclear ?? UNCLEAR;
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Decisions API  —  POST /v1/decisions
// ─────────────────────────────────────────────────────────────────────────────

export const DECISIONS_URL = 'https://api.openai.com/v1/decisions';
export const DECISIONS_MODEL = 'gpt-6-luna';

export function buildDecisionsBody(decision: DecisionKind, evidence: string, options: string[]): unknown {
  return {
    model: DECISIONS_MODEL,
    input: evidence,
    questions: [
      {
        type: 'choice',
        name: decision,
        instructions: decision === 'destination'
          ? `${SHARED_INSTRUCTION}\n${DESTINATION_QUESTION}`
          : `${SHARED_INSTRUCTION}\n${PLAN_B_QUESTION}`,
        choices: options.map((value) => ({
          value,
          description: OPTION_DESCRIPTIONS[value] ?? value,
        })),
      },
    ],
  };
}

interface DecisionsAnswer {
  type?: string;
  name?: string | null;
  choice?: string | boolean;
  confidence?: number;
}

interface DecisionsPayload {
  answers?: DecisionsAnswer[];
}

/** Returns null when the payload is unusable, so the caller can fall back. */
export function parseDecisionsAnswer(payload: unknown, decision: DecisionKind): DecideResponse | null {
  const answers = (payload as DecisionsPayload | null)?.answers;
  if (!Array.isArray(answers)) return null;

  const answer = answers.find((a) => a?.name === decision) ?? answers[0];
  if (!answer || answer.type !== 'choice') return null;
  if (typeof answer.choice !== 'string') return null;

  const confidence = typeof answer.confidence === 'number' ? answer.confidence : null;

  return { answer: answer.choice, confidence, decided_by: 'decisions_api' };
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Responses API  —  fallback when Decisions is not enabled for our key
// ─────────────────────────────────────────────────────────────────────────────

export const RESPONSES_URL = 'https://api.openai.com/v1/responses';

export function buildResponsesBody(decision: DecisionKind, evidence: string, options: string[]): unknown {
  return {
    model: DECISIONS_MODEL,
    reasoning: { effort: 'none' },
    input: [
      {
        role: 'system',
        content: decision === 'destination'
          ? `${SHARED_INSTRUCTION}\n${DESTINATION_QUESTION}`
          : `${SHARED_INSTRUCTION}\n${PLAN_B_QUESTION}`,
      },
      { role: 'user', content: evidence },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'decision',
        strict: true,
        // Only one field, constrained to the options we supplied.
        schema: {
          type: 'object',
          properties: { answer: { type: 'string', enum: options } },
          required: ['answer'],
          additionalProperties: false,
        },
      },
    },
  };
}

// `decision` is unused: both decisions share one response shape. It stays in the
// signature so callers read the same way as parseDecisionsAnswer.
export function parseResponsesText(payload: unknown, _decision: DecisionKind): DecideResponse | null {
  const data = payload as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> } | null;
  if (!data) return null;

  let text = typeof data.output_text === 'string' ? data.output_text : '';
  if (!text && Array.isArray(data.output)) {
    text = data.output
      .flatMap((item) => item.content ?? [])
      .map((part) => part.text ?? '')
      .join('');
  }

  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as { answer?: unknown } | string;
    // A bare JSON string is a valid answer on its own.
    if (typeof parsed === 'string') {
      return parsed ? { answer: parsed, confidence: null, decided_by: 'responses_api' } : null;
    }
    if (typeof parsed.answer !== 'string') return null;
    return { answer: parsed.answer, confidence: null, decided_by: 'responses_api' };
  } catch {
    // Not JSON at all: never present garbage as an answer.
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guard rail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The models are told never to invent an option. If one does anyway, we drop
 * back to rules rather than echo something the UI cannot render.
 */
export function confineToOptions(result: DecideResponse, options: string[]): DecideResponse | null {
  if (options.includes(result.answer)) return result;
  const fallback = options.find((o) => normalize(o) === normalize(result.answer));
  if (fallback) return { ...result, answer: fallback };
  return null;
}
