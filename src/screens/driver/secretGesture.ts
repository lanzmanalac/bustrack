// Hidden demo-drawer gesture on the route name: triple-tap, or press and hold.
// Pure so it can be tested without a phone.

export const TAP_GAP_MS = 600;   // max time between one tap and the next
export const TAPS_NEEDED = 3;
export const HOLD_MS = 1000;     // press-and-hold fallback

export interface TapState {
  count: number;
  lastMs: number;
}

export const NO_TAPS: TapState = { count: 0, lastMs: 0 };

/** Register one tap. Returns the new state and whether the drawer should open. */
export function registerTap(prev: TapState, nowMs: number): { state: TapState; open: boolean } {
  const count = nowMs - prev.lastMs <= TAP_GAP_MS ? prev.count + 1 : 1;
  if (count >= TAPS_NEEDED) return { state: NO_TAPS, open: true };
  return { state: { count, lastMs: nowMs }, open: false };
}
