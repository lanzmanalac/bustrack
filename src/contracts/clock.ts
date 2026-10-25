import { CONFIG } from './config';
// TIME_SCALE speeds up the demo. Use it ONLY for:
// (1) sim bus movement, (2) ticking a countdown between data updates.
// NEVER apply it to timestamps or data age.
export const realNowMs = () => Date.now();
export const worldElapsedSec = (sinceRealMs: number) =>
  ((Date.now() - sinceRealMs) / 1000) * CONFIG.TIME_SCALE;
