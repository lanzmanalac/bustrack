import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import type { ViewState } from '../view';
import delay from './assets/delay.jpeg';
import missed from './assets/missed.jpeg';
import location from './assets/location.jpeg';
import stale from './assets/stale.jpeg';
import offline from './assets/offline.jpeg';
import full from './assets/full.jpeg';
import './mascot.css';

type Head = { x: number; y: number; width: number; height: number; pivotX: number; pivotY: number };
type Artwork = { src: string; x: number; width: number; clip?: string; head?: Head; blink?: boolean };

/** Each supplied drawing is a key pose, not an in-between animation frame.
 * Keep one expression per status and animate its layers continuously instead. */
const ARTWORK: Record<string, Artwork> = {
  relax: {
    src: offline, x: 742, width: 216,
    head: { x: 826, y: 122, width: 110, height: 144, pivotX: 874, pivotY: 252 },
  },
  calm: {
    src: offline, x: 24, width: 250, blink: true,
    head: { x: 178, y: 120, width: 100, height: 140, pivotX: 222, pivotY: 250 },
  },
  delay: {
    src: delay, x: 280, width: 244,
    head: { x: 404, y: 116, width: 98, height: 140, pivotX: 444, pivotY: 246 },
  },
  missed: { src: missed, x: 730, width: 252 },
  location: {
    src: location, x: 286, width: 244,
    clip: '286,50 530,50 530,375 514,375 514,484 286,484',
  },
  stale: { src: stale, x: 24, width: 256 },
  offline: {
    src: offline, x: 274, width: 282,
    clip: '274,50 556,50 556,310 520,330 520,484 274,484',
    head: { x: 380, y: 124, width: 100, height: 138, pivotX: 425, pivotY: 252 },
  },
  full: { src: full, x: 526, width: 212 },
};

function pigeonState(state: ViewState, staleData: boolean): string {
  switch (state) {
    case 'relax': return 'relax';
    case 'delayed':
    case 'standby': return 'delay';
    case 'missed': return 'missed';
    case 'location_off': return 'location';
    case 'full': return 'full';
    case 'offline':
    case 'no_signal': return 'offline';
    default: return staleData ? 'stale' : 'calm';
  }
}

export function PigeonMascot({ state, staleData }: { state: ViewState; staleData: boolean }) {
  const id = useId();
  const reduce = useReducedMotion();
  const pose = pigeonState(state, staleData);
  const art = ARTWORK[pose];
  const head = art.head;

  return (
    <span className="pigeon-mascot" data-pose={pose} aria-hidden="true">
      <AnimatePresence initial={false} mode="wait">
        <motion.svg
          key={pose}
          className="pigeon-art"
          width="512" height="512"
          viewBox={`${art.x} 50 ${art.width} 434`}
          preserveAspectRatio="xMidYMid meet"
          focusable="false"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.16 }}
        >
          <defs>
            <clipPath id={`${id}-${pose}-frame`}>
              {art.clip ? <polygon points={art.clip} /> : <rect x={art.x} y="50" width={art.width} height="434" />}
            </clipPath>
            {head && (
              <>
                <clipPath id={`${id}-${pose}-head`}>
                  <rect x={head.x} y={head.y} width={head.width} height={head.height} />
                </clipPath>
                <mask id={`${id}-${pose}-body`} maskUnits="userSpaceOnUse" x={art.x} y="50" width={art.width} height="434">
                  <rect x={art.x} y="50" width={art.width} height="434" fill="white" />
                  {/* An overlapping neck seam keeps the head attached as it turns. */}
                  <rect x={head.x} y={head.y} width={head.width} height={head.height - 14} fill="black" />
                </mask>
              </>
            )}
          </defs>
          <g clipPath={`url(#${id}-${pose}-frame)`}>
            <g className="pigeon-body" style={{ transformOrigin: `${art.x + art.width / 2}px 445px` }}>
              <image href={art.src} width="1024" height="572" mask={head ? `url(#${id}-${pose}-body)` : undefined} />
              {head && (
                <g className="pigeon-head" style={{ transformOrigin: `${head.pivotX}px ${head.pivotY}px` }}>
                  <image href={art.src} width="1024" height="572" clipPath={`url(#${id}-${pose}-head)`} />
                  {art.blink && (
                    <g className="pigeon-blink">
                      <ellipse cx="218" cy="188" rx="11" ry="12" fill="#484a49" />
                      <path d="M210 188 Q218 193 226 188" fill="none" stroke="#242524" strokeWidth="2.5" strokeLinecap="round" />
                      <ellipse cx="257" cy="187" rx="6" ry="8" fill="#484a49" />
                      <path d="M253 187 Q257 190 261 187" fill="none" stroke="#242524" strokeWidth="2" strokeLinecap="round" />
                    </g>
                  )}
                </g>
              )}
            </g>
          </g>
        </motion.svg>
      </AnimatePresence>
    </span>
  );
}
