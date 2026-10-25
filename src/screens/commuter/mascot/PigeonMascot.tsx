import { useId } from 'react';
import type { ViewState } from '../view';
import delay from './assets/delay.jpeg';
import missed from './assets/missed.jpeg';
import location from './assets/location.jpeg';
import stale from './assets/stale.jpeg';
import offline from './assets/offline.jpeg';
import full from './assets/full.jpeg';
import './mascot.css';

type Frame = { x: number; width: number; clip?: string };
type Sprite = { src: string; frames: Frame[] };

/** The supplied JPEGs have uneven spacing. These viewports preserve the original art
 * while fitting each pose into a 512px cell of a horizontal 2048 × 512 SVG strip. */
const SPRITES = {
  delay: {
    src: delay,
    frames: [
      { x: 24, width: 254 },
      { x: 280, width: 244 },
      { x: 522, width: 232 },
      { x: 740, width: 276, clip: '754,50 1016,50 1016,484 740,484 740,252 754,252' },
    ],
  },
  missed: {
    src: missed,
    frames: [
      { x: 24, width: 304, clip: '24,50 328,50 328,280 280,304 280,484 24,484' },
      { x: 282, width: 244, clip: '320,50 526,50 526,484 282,484 282,286 320,286' },
      { x: 522, width: 232 },
      { x: 730, width: 252 },
    ],
  },
  location: {
    src: location,
    frames: [
      { x: 24, width: 262 },
      { x: 286, width: 244, clip: '286,50 530,50 530,375 514,375 514,484 286,484' },
      { x: 514, width: 254, clip: '540,50 768,50 768,282 742,298 742,484 514,484 514,370 540,370' },
      { x: 742, width: 252 },
    ],
  },
  stale: {
    src: stale,
    frames: [
      { x: 24, width: 256 },
      { x: 282, width: 256, clip: '282,50 538,50 538,300 522,300 522,484 282,484' },
      { x: 522, width: 216, clip: '548,50 738,50 738,484 522,484 522,330 548,330' },
      { x: 738, width: 276 },
    ],
  },
  offline: {
    src: offline,
    frames: [
      { x: 24, width: 250 },
      { x: 274, width: 282, clip: '274,50 556,50 556,310 520,330 520,484 274,484' },
      { x: 522, width: 220, clip: '560,50 742,50 742,484 522,484 522,300 560,300' },
      { x: 742, width: 216 },
    ],
  },
  full: { src: full, frames: [{ x: 16, width: 274 }, { x: 290, width: 234 }, { x: 526, width: 212 }, { x: 742, width: 258 }] },
} satisfies Record<string, Sprite>;

type PigeonState = keyof typeof SPRITES | 'calm';

function pigeonState(state: ViewState, staleData: boolean): PigeonState {
  switch (state) {
    case 'delayed':
    case 'standby':
      return 'delay';
    case 'missed':
      return 'missed';
    case 'location_off':
      return 'location';
    case 'full':
      return 'full';
    case 'offline':
    case 'no_signal':
      return 'offline';
    default:
      return staleData ? 'stale' : 'calm';
  }
}

export function PigeonMascot({ state, staleData }: { state: ViewState; staleData: boolean }) {
  const id = useId();
  const pose = pigeonState(state, staleData);
  const sprite: Sprite = SPRITES[pose === 'calm' ? 'offline' : pose];

  return (
    <span className="pigeon-mascot" data-pose={pose} aria-hidden="true">
      <svg key={`${state}-${pose}`} className="pigeon-strip" data-animate={pose !== 'calm'} width="2048" height="512" viewBox="0 0 2048 512" focusable="false">
        {sprite.frames.map((frame, i) => (
          <svg key={i} x={i * 512} y="0" width="512" height="512" viewBox={`${frame.x} 50 ${frame.width} 434`} preserveAspectRatio="xMidYMid meet" overflow="hidden">
            <defs>
              <clipPath id={`${id}-${i}`}>
                {frame.clip ? <polygon points={frame.clip} /> : <rect x={frame.x} y="50" width={frame.width} height="434" />}
              </clipPath>
            </defs>
            <image href={sprite.src} width="1024" height="572" clipPath={`url(#${id}-${i})`} />
          </svg>
        ))}
      </svg>
    </span>
  );
}
