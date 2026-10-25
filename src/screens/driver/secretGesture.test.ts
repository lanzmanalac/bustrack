import { describe, expect, it } from 'vitest';
import { NO_TAPS, registerTap, TAP_GAP_MS } from './secretGesture';

const tapAt = (times: number[]) => {
  let state = NO_TAPS;
  const opened: boolean[] = [];
  for (const t of times) {
    const r = registerTap(state, t);
    state = r.state;
    opened.push(r.open);
  }
  return opened;
};

describe('demo drawer triple-tap', () => {
  it('opens on three quick taps', () => {
    expect(tapAt([1000, 1250, 1500])).toEqual([false, false, true]);
  });

  it('allows a relaxed thumb: 3 taps spread over ~1.1 s (old version needed < 0.7 s total)', () => {
    expect(tapAt([1000, 1550, 2100])).toEqual([false, false, true]);
  });

  it('does not open if one gap is too long', () => {
    expect(tapAt([1000, 1300, 1300 + TAP_GAP_MS + 1])).toEqual([false, false, false]);
  });

  it('a slow tap starts a new count', () => {
    expect(tapAt([1000, 3000, 3200, 3400])).toEqual([false, false, false, true]);
  });

  it('resets after opening, so a 4th tap does not reopen', () => {
    expect(tapAt([1000, 1200, 1400, 1600])).toEqual([false, false, true, false]);
  });
});
