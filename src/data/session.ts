// Anonymous rider session: a random ID that renews at Asia/Manila midnight.
// Not an account, and never linked to a location.

const KEY = 'bus-demo:session';
const manilaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }); // "YYYY-MM-DD"

type Session = { id: string; day: string };

// Used when storage is blocked, so the ID stays stable for this page's lifetime.
let fallback: Session | null = null;

// getRandomValues works on plain-http pages too; crypto.randomUUID does not.
export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function defaultStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readSaved(storage: Storage | null): Session | null {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    const s = value as Session | null;
    return typeof s?.id === 'string' && typeof s?.day === 'string' ? s : null;
  } catch {
    return fallback;
  }
}

export function getSessionId(storage: Storage | null = defaultStorage(), nowMs: number = Date.now()): string {
  const day = manilaDay.format(nowMs);
  const saved = readSaved(storage);
  if (saved?.day === day) return saved.id;

  const fresh: Session = { id: randomId(), day };
  fallback = fresh;
  try {
    storage?.setItem(KEY, JSON.stringify(fresh));
  } catch {
    // Blocked or full: the in-memory fallback keeps the ID stable.
  }
  return fresh.id;
}
