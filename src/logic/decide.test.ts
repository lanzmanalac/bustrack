import { describe, expect, it } from 'vitest';
import {
  buildDecisionsBody,
  buildResponsesBody,
  confineToOptions,
  containsCoordinates,
  decideByRules,
  parseDecideRequest,
  parseDecisionsAnswer,
  parseResponsesText,
  rulesDestination,
  rulesPlanB,
  scrubCoordinates,
  DECISIONS_MODEL,
  MAX_OPTIONS,
  UNCLEAR,
} from './decide';

const STOPS = ['Market Market', 'Ayala', 'SM Aura', 'Bonifacio High Street', 'Uptown Bonifacio', UNCLEAR];
const PLAN_B = ['Keep waiting', 'Take the next bus', 'Walk', 'Book a ride'];

describe('privacy guard — coordinates never leave the device', () => {
  it('redacts a lat/lng pair', () => {
    const text = 'I am at 14.5480, 121.0560 right now';
    expect(scrubCoordinates(text)).toBe('I am at [location removed] right now');
    expect(containsCoordinates(text)).toBe(true);
  });

  it('leaves times and street numbers alone', () => {
    expect(scrubCoordinates('by 9:30 at 5th Ave')).toBe('by 9:30 at 5th Ave');
    expect(containsCoordinates('by 9:30 at 5th Ave')).toBe(false);
  });

  it('leaves a clean message untouched', () => {
    expect(scrubCoordinates('need to be at High Street by 9')).toBe(
      'need to be at High Street by 9',
    );
  });
});

describe('parseDecideRequest', () => {
  it('accepts a well-formed body and scrubs coordinates on the way in', () => {
    const parsed = parseDecideRequest({
      decision: 'destination',
      evidence: 'meet at 14.5480, 121.0560 by 9',
      options: STOPS,
    });
    expect(parsed).toEqual({
      decision: 'destination',
      evidence: 'meet at [location removed] by 9',
      options: STOPS,
    });
  });

  it('rejects a bad decision name', () => {
    expect(parseDecideRequest({ decision: 'nope', evidence: 'x', options: STOPS })).toHaveProperty(
      'error',
    );
  });

  it('rejects empty evidence and empty options', () => {
    expect(parseDecideRequest({ decision: 'destination', evidence: '  ', options: STOPS })).toHaveProperty(
      'error',
    );
    expect(parseDecideRequest({ decision: 'destination', evidence: 'hi', options: [] })).toHaveProperty(
      'error',
    );
  });

  it('rejects more options than the API allows', () => {
    const options = Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => `s${i}`);
    expect(parseDecideRequest({ decision: 'destination', evidence: 'hi', options })).toHaveProperty(
      'error',
    );
  });

  it('rejects a non-object body', () => {
    expect(parseDecideRequest(null)).toHaveProperty('error');
    expect(parseDecideRequest('nope')).toHaveProperty('error');
  });
});

describe('rulesDestination', () => {
  it('matches a partial stop name in the typed message', () => {
    const result = rulesDestination('need to be at High Street by 9', STOPS);
    expect(result.answer).toBe('Bonifacio High Street');
    expect(result.decided_by).toBe('rules');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('returns Unclear when the message names no stop', () => {
    const result = rulesDestination('pauwi na ko', STOPS);
    expect(result.answer).toBe(UNCLEAR);
    expect(result.confidence).toBe(0);
  });

  it('scores a verbatim match higher than a partial one', () => {
    const exact = rulesDestination('Ayala', STOPS);
    const partial = rulesDestination('need to be at High Street by 9', STOPS);
    expect(exact.answer).toBe('Ayala');
    expect(exact.confidence!).toBeGreaterThan(partial.confidence!);
  });

  it('never returns a stop that was not offered', () => {
    const result = rulesDestination('I want to go to Trinoma', ['Ayala', UNCLEAR]);
    expect(['Ayala', UNCLEAR]).toContain(result.answer);
  });

  it('is case and punctuation insensitive', () => {
    expect(rulesDestination('MARKET-MARKET by 9', STOPS).answer).toBe('Market Market');
  });
});

describe('rulesPlanB', () => {
  it('a full bus means take the next one', () => {
    expect(rulesPlanB('bus is full, driver said so', PLAN_B).answer).toBe('Take the next bus');
  });

  it('carrying something heavy means book a ride', () => {
    expect(rulesPlanB('may dala akong mabigat', PLAN_B).answer).toBe('Book a ride');
  });

  it('a delay means walk', () => {
    expect(rulesPlanB('na-delay ang bus, stuck in traffic', PLAN_B).answer).toBe('Walk');
  });

  it('defaults to keep waiting when nothing is wrong', () => {
    expect(rulesPlanB('normal day, bus on time', PLAN_B).answer).toBe('Keep waiting');
  });

  it('never invents an option the caller did not offer', () => {
    const narrow = ['Keep waiting', 'Walk'];
    const result = rulesPlanB('bus is full and puno na', narrow);
    expect(narrow).toContain(result.answer);
    // "Take the next bus" was not offered, so it falls through rather than invents.
    expect(result.answer).toBe('Keep waiting');
  });

  it('ranks full/missed above a heavy bag', () => {
    expect(rulesPlanB('bus is full and may dala akong mabigat', PLAN_B).answer).toBe(
      'Take the next bus',
    );
  });
});

describe('decideByRules dispatches on the decision kind', () => {
  it('routes destination', () => {
    expect(decideByRules('destination', 'Ayala by 9', STOPS).answer).toBe('Ayala');
  });

  it('routes plan_b', () => {
    expect(decideByRules('plan_b', 'bus is full', PLAN_B).answer).toBe('Take the next bus');
  });
});

describe('Decisions API request shape', () => {
  it('matches the format verified against the live endpoint', () => {
    const body = buildDecisionsBody('destination', 'need to be at High Street by 9', STOPS) as any;
    expect(body.model).toBe(DECISIONS_MODEL);
    expect(body.input).toBe('need to be at High Street by 9');
    expect(body.questions).toHaveLength(1);
    expect(body.questions[0].type).toBe('choice');
    expect(body.questions[0].name).toBe('destination');
    expect(body.questions[0].instructions).toContain('Pick exactly one of the provided options');
    expect(body.questions[0].choices.map((c: any) => c.value)).toEqual(STOPS);
    expect(body.questions[0].choices[3].description).toBeTypeOf('string');
  });

  it('uses the Plan B question for plan_b', () => {
    const body = buildDecisionsBody('plan_b', 'x', PLAN_B) as any;
    expect(body.questions[0].name).toBe('plan_b');
    expect(body.questions[0].instructions).toContain('What should this commuter do next?');
  });

  it('parses the real 200 response captured during the test call', () => {
    const real = {
      model: 'gpt-6-luna',
      answers: [
        {
          type: 'choice',
          name: 'destination',
          choice: 'Bonifacio High Street',
          probabilities: [
            { value: 'Market Market', probability: 0.02 },
            { value: 'Bonifacio High Street', probability: 0.63 },
          ],
          confidence: 0.57,
        },
      ],
      usage: { input_tokens: 496, output_tokens: 0, total_tokens: 496 },
    };

    expect(parseDecisionsAnswer(real, 'destination')).toEqual({
      answer: 'Bonifacio High Street',
      confidence: 0.57,
      decided_by: 'decisions_api',
    });
  });

  it('parses the real Plan B response', () => {
    const real = {
      model: 'gpt-6-luna',
      answers: [
        {
          type: 'choice',
          name: 'plan_b',
          choice: 'Book a ride',
          probabilities: [{ value: 'Book a ride', probability: 0.76 }],
          confidence: 0.68,
        },
      ],
    };
    expect(parseDecisionsAnswer(real, 'plan_b')?.answer).toBe('Book a ride');
  });

  it('returns null for an unusable payload so the caller falls back', () => {
    expect(parseDecisionsAnswer(null, 'destination')).toBeNull();
    expect(parseDecisionsAnswer({}, 'destination')).toBeNull();
    expect(parseDecisionsAnswer({ answers: [{ type: 'refusal', name: 'destination' }] }, 'destination')).toBeNull();
    expect(parseDecisionsAnswer({ answers: [{ type: 'choice', name: 'destination', choice: 42 }] }, 'destination')).toBeNull();
  });
});

describe('Responses API fallback', () => {
  it('emits a strict single-field enum schema', () => {
    const body = buildResponsesBody('plan_b', 'x', PLAN_B) as any;
    expect(body.model).toBe(DECISIONS_MODEL);
    expect(body.reasoning.effort).toBe('none');
    expect(body.text.format.type).toBe('json_schema');
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.properties.answer.enum).toEqual(PLAN_B);
    expect(body.text.format.schema.additionalProperties).toBe(false);
  });

  it('parses output_text', () => {
    const payload = { output_text: '{"answer":"Walk"}' };
    expect(parseResponsesText(payload, 'plan_b')).toEqual({
      answer: 'Walk',
      confidence: null,
      decided_by: 'responses_api',
    });
  });

  it('parses a fragmented output array', () => {
    const payload = { output: [{ content: [{ text: '{"answer":"Ayala"}' }] }] };
    expect(parseResponsesText(payload, 'destination')?.answer).toBe('Ayala');
  });

  it('returns null when there is nothing usable', () => {
    expect(parseResponsesText(null, 'destination')).toBeNull();
    expect(parseResponsesText({ output_text: '' }, 'destination')).toBeNull();
    expect(parseResponsesText({ output_text: '{bad json' }, 'destination')).toBeNull();
  });
});

describe('confineToOptions', () => {
  it('passes through an answer we actually offered', () => {
    const result = { answer: 'Walk', confidence: 0.68, decided_by: 'decisions_api' as const };
    expect(confineToOptions(result, PLAN_B)).toEqual(result);
  });

  it('tolerates case differences', () => {
    const result = { answer: 'walk', confidence: 0.68, decided_by: 'decisions_api' as const };
    expect(confineToOptions(result, PLAN_B)?.answer).toBe('Walk');
  });

  it('rejects an invented option', () => {
    const result = { answer: 'Teleport', confidence: 0.9, decided_by: 'decisions_api' as const };
    expect(confineToOptions(result, PLAN_B)).toBeNull();
  });
});
