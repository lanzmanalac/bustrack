import type { LeavePlan } from '../contracts/types'

// Owner: All-arounder. Remembers the last good plan on THIS phone so the
// offline screen can say "Last known: leave in ~5 min · saved 2 min ago".
// A LeavePlan holds the user's stop, never their coordinates, so this stays private.

const KEY = 'sakaykita:lastPlan:v1'

export type SavedPlan = { plan: LeavePlan; savedAtMs: number }

/** Call whenever a fresh live plan arrives (skip 'no_signal' plans). */
export function saveLastPlan(plan: LeavePlan): void {
  if (plan.phase === 'no_signal') return
  try {
    localStorage.setItem(KEY, JSON.stringify({ plan, savedAtMs: Date.now() }))
  } catch {
    // Storage blocked (private mode, quota). The app works without it.
  }
}

/** The last saved plan, or null if none or unreadable. */
export function loadLastPlan(): SavedPlan | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<SavedPlan>
    if (!saved.plan || typeof saved.savedAtMs !== 'number') return null
    return { plan: saved.plan, savedAtMs: saved.savedAtMs }
  } catch {
    return null
  }
}

/** Seconds since the plan was saved (for "saved 2 min ago"). */
export function savedAgeSec(saved: SavedPlan, nowMs: number = Date.now()): number {
  return Math.max(0, Math.round((nowMs - saved.savedAtMs) / 1000))
}
