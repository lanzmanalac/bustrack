import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSessionId, randomId } from './session';
import { memoryStorage, throwingStorage } from './test-utils';

const HEX_32 = /^[0-9a-f]{32}$/;
// Asia/Manila is UTC+8, so local midnight is 16:00Z the day before.
const BEFORE_MIDNIGHT = Date.parse('2026-10-25T15:59:59Z');
const AFTER_MIDNIGHT = Date.parse('2026-10-25T16:00:00Z');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('session', () => {
  it('randomId format', () => {
    const a = randomId();
    expect(a).toMatch(HEX_32);
    expect(randomId()).not.toBe(a);
  });

  it('stable within a Manila day', () => {
    const s = memoryStorage();
    const morning = getSessionId(s, Date.parse('2026-10-25T01:00:00Z'));
    expect(getSessionId(s, BEFORE_MIDNIGHT)).toBe(morning);
  });

  it('renews at Manila midnight', () => {
    const s = memoryStorage();
    const today = getSessionId(s, BEFORE_MIDNIGHT);
    const tomorrow = getSessionId(s, AFTER_MIDNIGHT);
    expect(tomorrow).toMatch(HEX_32);
    expect(tomorrow).not.toBe(today);
  });

  it('works without crypto.randomUUID', () => {
    // Plain-http pages (a phone on the dev server's LAN IP) have no randomUUID.
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array<ArrayBuffer>) => real.getRandomValues(a) });
    expect(getSessionId(memoryStorage(), BEFORE_MIDNIGHT)).toMatch(HEX_32);
  });

  it('works when storage throws', () => {
    const s = throwingStorage();
    const first = getSessionId(s, BEFORE_MIDNIGHT);
    expect(first).toMatch(HEX_32);
    expect(getSessionId(s, BEFORE_MIDNIGHT)).toBe(first);
  });

  it('ignores corrupt storage', () => {
    const s = memoryStorage();
    s.setItem('bus-demo:session', '{not json');
    expect(getSessionId(s, BEFORE_MIDNIGHT)).toMatch(HEX_32);
  });
});
