import type { LeavePlan } from '../contracts/types';
import { CONFIG } from '../contracts/config';

/**
 * Verdict for "can this trip make my deadline?".
 * 'unknown' is deliberately included: Rule 8 says never present a guess as fact,
 * and with no bus ETA we have no basis to promise either outcome.
 * (This type lives in Section 8, not in the frozen contracts file.)
 */
export type ArriveVerdict = 'on_time' | 'tight' | 'late' | 'unknown';

const MANILA_OFFSET_MIN = 480; // UTC+8, no DST

/**
 * "HH:MM" (24h, Asia/Manila) -> seconds from now, or null when unparseable.
 * A deadline already in the past returns a negative number, so the caller
 * reports 'late' rather than silently rolling over to tomorrow.
 */
export function secondsUntil(arriveBy: string, nowMs: number): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(arriveBy.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  // Read wall-clock parts in Manila, then convert back to epoch ms.
  const manila = new Date(nowMs + MANILA_OFFSET_MIN * 60_000);
  const targetUtcMs = Date.UTC(
    manila.getUTCFullYear(),
    manila.getUTCMonth(),
    manila.getUTCDate(),
    hours,
    minutes,
    0,
    0,
  );
  const targetMs = targetUtcMs - MANILA_OFFSET_MIN * 60_000;

  return Math.round((targetMs - nowMs) / 1000);
}

/**
 * Pull an arrive-by time out of typed text. Runs entirely on the device —
 * the AI never sees or produces the time.
 *
 * Handles: "9", "9am", "9:30", "by 9", "alas-9", "hanggang 5pm".
 * Bare numbers only count when a time preposition introduces them, so
 * "High Street by 9" reads 09:00 while "5th Ave" does not read as 05:00.
 */
export function parseArriveBy(text: string): string | null {
  // Filipino / 24h habits that no digit pattern can express: "12nn", "12 midnight".
  if (/\b(?:12\s*)?(?:midnight|mn)\b/i.test(text)) return '00:00';
  if (/\b(?:12\s*)?(?:nn|noon)\b/i.test(text)) return '12:00';

  const patterns: RegExp[] = [
    // by / at / before / until + optional "alas" + optional clock + optional meridiem.
    // The lookahead rejects "5th Ave" and "2026" so a street name never reads as a time.
    /\b(?:by|at|before|until|hanggang|bago)\b\s+(?:alas[\s-]?)?(\d{1,2})(?![\d])(?!\s*(?:st|nd|rd|th)\b)(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i,
    // "alas-9", "alas 9:30"
    /alas[\s-]?(\d{1,2})(?![\d])(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i,
    // explicit clock time, "9:30", "09:30 pm"
    /\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/i,
    // "9am", "9 pm" — groups stay (1) hours (2) minutes (3) meridiem like every other pattern
    /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i,
    // Last resort: the message IS a bare number. Anchored to the whole string so
    // "Stop 4" or "5th Ave" can never be read as a departure deadline.
    /^\s*(\d{1,2})(?![\d])\s*$/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;

    const hours = Number(match[1]);
    const minutes = match[2] ? Number(match[2]) : 0;
    const meridiem = match[3];

    const normalized = normalizeTime(hours, minutes, meridiem);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeTime(hours: number, minutes: number, meridiem: string | undefined): string | null {
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;

  let h = hours;
  const hasMeridiem = meridiem !== undefined && meridiem !== '';
  const isPm = hasMeridiem && /^p/i.test(meridiem);

  if (hasMeridiem) {
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
  } else if (h >= 1 && h <= 5) {
    // Service starts at 06:00, so "by 4" from a daytime commuter means 16:00.
    // Assumption to tune — flagged like every other number in CONFIG.
    h += 12;
  }

  return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Can this trip make the deadline?
 *
 * You leave in time to reach the stop when the bus does, then ride to the
 * destination, so arrival lands at bus_eta + ride. Anything inside the buffer
 * window is 'tight' — it works, but there is no room for a slow light.
 */
export function checkArriveBy(
  plan: LeavePlan,
  rideSecToDest: number | null,
  arriveBy: string | null,
  nowMs: number,
): ArriveVerdict {
  if (arriveBy === null || rideSecToDest === null) return 'unknown';

  const timeLeftSec = secondsUntil(arriveBy, nowMs);
  if (timeLeftSec === null) return 'unknown';

  if (plan.bus_eta_sec === null) {
    // Passed the stop: late, no ambiguity. Otherwise we simply do not know.
    return plan.phase === 'passed' ? 'late' : 'unknown';
  }

  const arrivalOffsetSec = plan.bus_eta_sec + rideSecToDest;
  const slackSec = timeLeftSec - arrivalOffsetSec;

  if (slackSec < 0) return 'late';
  if (slackSec < CONFIG.BUFFER_SEC) return 'tight';
  return 'on_time';
}
