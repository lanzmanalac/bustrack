import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Stop } from '../../../contracts/types';
import type { MapModel } from '../view';
import { buildScene, type Scene, type Vec2, type Vec3 } from './scene';

/**
 * PM-owned stand-in for the route visual. The engine is swappable: anything that takes
 * `stops` + a `MapModel` and renders a labelled figure can replace it.
 */
export interface RouteMap3DProps {
  stops: Stop[];
  model: MapModel;
  pulse: boolean;
  /** Space at the bottom covered by the trip bar, kept clear of the route. */
  insetBottom: number;
}

const INSET_TOP = 34;
/** In screen pixels near the route; the scene converts them to world metres. */
const BUS = { length: 24, width: 10, height: 8.5, lift: 0.8 };
const ROUTE_INK = '#23303f';

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize((prev) => (prev && prev.width === Math.round(width) && prev.height === Math.round(height) ? prev : { width: Math.round(width), height: Math.round(height) }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Glides between positions instead of teleporting. */
function useGlide(target: number | null): number | null {
  const reduce = useReducedMotion() ?? false;
  const mv = useMotionValue(target ?? 0);
  const [pos, setPos] = useState(target);
  const hasPos = useRef(target != null);

  useEffect(() => mv.on('change', setPos), [mv]);
  useEffect(() => {
    if (target == null) {
      hasPos.current = false;
      return;
    }
    if (!hasPos.current || reduce) {
      hasPos.current = true;
      mv.jump(target);
      return;
    }
    const controls = animate(mv, target, { duration: 1, ease: 'easeOut' });
    return () => controls.stop();
  }, [target, reduce, mv]);
  return target == null ? null : (pos ?? target);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pts = (list: { x: number; y: number }[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

const City = memo(function City({ scene }: { scene: Scene }) {
  return (
    <g>
      <rect width={scene.width} height={scene.height} fill="var(--map-land)" />
      {scene.ground.map((s, i) => (
        <polygon key={i} points={s.points} fill={s.fill} />
      ))}
      {scene.streets.map((s, i) => (
        <polyline
          key={`c${i}`}
          points={s.points}
          fill="none"
          stroke={s.kind === 'walk' ? 'none' : '#d7dbcf'}
          strokeWidth={s.width + 1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {scene.streets.map((s, i) => (
        <polyline
          key={i}
          points={s.points}
          fill="none"
          stroke={s.kind === 'walk' ? '#f6f4ec' : '#ffffff'}
          strokeWidth={s.width}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {scene.streetLabels.map((l) => (
        <text key={l.text} x={l.x} y={l.y} transform={`rotate(${l.angle.toFixed(1)} ${l.x.toFixed(1)} ${l.y.toFixed(1)})`} dy="0.35em" textAnchor="middle" className="map-street">
          {l.text}
        </text>
      ))}
      <g opacity={0.09}>
        {scene.shadows.map((s, i) => (
          <polygon key={i} points={s} fill="#1f3320" />
        ))}
      </g>
      {scene.city.map((item, i) =>
        'points' in item ? (
          <polygon key={i} points={item.points} fill={item.fill} stroke={item.stroke} strokeWidth={0.6} strokeLinejoin="round" />
        ) : (
          <g key={i}>
            <circle cx={item.x + item.r * 0.35} cy={item.y + item.r * 0.45} r={item.r} fill="rgb(31 51 32 / 0.16)" />
            <circle cx={item.x} cy={item.y} r={item.r} fill={item.fill} />
          </g>
        ),
      )}
      {scene.attribution && (
        <text x={scene.width - 12} y={14} textAnchor="end" className="map-credit">
          {scene.attribution}
        </text>
      )}
    </g>
  );
});

function busFaces(scene: Scene, world: Vec2, heading: Vec2) {
  const n = { x: -heading.y, y: heading.x };
  const corner = (l: number, w: number, z: number): Vec3 => ({
    x: world.x + heading.x * l * scene.unit + n.x * w * scene.unit,
    y: world.y + heading.y * l * scene.unit + n.y * w * scene.unit,
    z: z * scene.unit,
  });
  const L = BUS.length / 2;
  const W = BUS.width / 2;
  const foot: [number, number][] = [
    [-L, -W],
    [L, -W],
    [L, W],
    [-L, W],
  ];
  const lo = BUS.lift;
  const hi = BUS.lift + BUS.height;
  const sides = foot.map(([l, w], e) => {
    const [l2, w2] = foot[(e + 1) % 4];
    const face = [corner(l, w, lo), corner(l2, w2, lo), corner(l2, w2, hi), corner(l, w, hi)].map(scene.project);
    const win = [corner(l, w, lo + 3.4), corner(l2, w2, lo + 3.4), corner(l2, w2, hi - 1.1), corner(l, w, hi - 1.1)].map(scene.project);
    const depth = face.reduce((s, p) => s + p.depth, 0) / 4;
    const area = face.reduce((s, p, i) => {
      const q = face[(i + 1) % 4];
      return s + (p.x * q.y - q.x * p.y);
    }, 0);
    return { face, win, depth, visible: area < 0, shade: e % 2 === 1 };
  });
  const top = foot.map(([l, w]) => scene.project(corner(l, w, hi)));
  return { sides: sides.filter((s) => s.visible).sort((a, b) => b.depth - a.depth), top };
}

/** A fixed gap in pixels above the roof, so the label's halo never covers the bus at any zoom. */
function busLabelAt(scene: Scene, world: Vec2) {
  const roof = scene.project({ ...world, z: (BUS.lift + BUS.height) * scene.unit });
  return { x: roof.x, y: roof.y - 12 - BUS.width * 0.3 };
}

function ring(scene: Scene, world: Vec2, r: number) {
  return Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return scene.project({ x: world.x + Math.cos(a) * r * scene.unit, y: world.y + Math.sin(a) * r * scene.unit, z: 0 });
  });
}

function Overlay({ scene, names, model, pulse, insetBottom }: { scene: Scene; names: string[]; model: MapModel; pulse: boolean; insetBottom: number }) {
  const pos = useGlide(model.busPos);
  const end = scene.stops.length - 1;
  const hasBus = pos != null;
  const dashed = model.mode === 'none';
  const behind = hasBus ? scene.slice(0, pos) : [];
  const ahead = scene.slice(hasBus ? pos : 0, end);
  const bus = hasBus ? scene.pointAt(pos) : null;
  const faces = bus ? busFaces(scene, bus.world, bus.heading) : null;
  const user = model.userIdx >= 0 ? scene.stops[model.userIdx] : null;

  type Label = { x: number; y: number; text: string; strong: boolean; anchor: 'start' | 'middle' | 'end'; dark?: boolean };
  const labels: Label[] = [];
  const span = (l: Pick<Label, 'x' | 'anchor'>) => {
    const w = 110;
    return l.anchor === 'start' ? [l.x, l.x + w] : l.anchor === 'end' ? [l.x - w, l.x] : [l.x - w / 2, l.x + w / 2];
  };
  const clashes = (l: Pick<Label, 'x' | 'y' | 'anchor'>, others: Pick<Label, 'x' | 'y' | 'anchor'>[]) =>
    others.some((o) => {
      const [a0, a1] = span(l);
      const [b0, b1] = span(o);
      return Math.abs(o.y - l.y) < 16 && a0 < b1 && b0 < a1;
    });
  // Keep labels off the bus's resting spot (not its mid-glide spot), so they don't flicker.
  const busTarget = model.busPos != null ? busLabelAt(scene, scene.pointAt(model.busPos).world) : null;
  const reserved = busTarget ? [{ x: busTarget.x, y: busTarget.y + 10, anchor: 'middle' as const }] : [];
  const place = (p: { x: number; y: number }, text: string, strong = false, dy = 4, preferRight = true) => {
    const fitsRight = p.x < scene.width - 130;
    const fitsLeft = p.x > 130;
    const sides = (preferRight ? [true, false] : [false, true]).filter((r) => (r ? fitsRight : fitsLeft));
    for (const right of sides) {
      const at: Label = { x: p.x + (right ? 14 : -14), y: p.y + dy, text, strong, anchor: right ? 'start' : 'end' };
      if (!clashes(at, [...labels, ...reserved])) return void labels.push(at);
    }
  };
  if (scene.you) {
    const { x, y } = scene.you.screen;
    const you: Label = { x: clamp(x, 70, scene.width - 70), y: y + 22, text: model.walkMin != null ? `You · ${model.walkMin} min walk` : 'You', strong: true, anchor: 'middle', dark: true };
    if (clashes(you, reserved)) you.y = y - 18;
    labels.push(you);
  }
  // The stop's name goes on the far side from "You", so the walk leg stays readable.
  if (user) place(user.screen, names[model.userIdx], true, 4, !scene.you || scene.you.screen.x < user.screen.x);
  if (end > 0 && end !== model.userIdx) {
    const visible = (p: { x: number; y: number }) =>
      p.x > 24 && p.x < scene.width - 24 && p.y > INSET_TOP + 16 && p.y < scene.height - insetBottom - 16;
    const endStop = scene.stops[end].screen;
    // A far terminus (EDSA Ayala, 2 km out) is off the map: label where the route leaves the frame.
    const exit = visible(endStop) ? null : [...scene.slice(0, end)].reverse().find(visible);
    if (!exit) place(endStop, names[end]);
    else place(exit, `To ${names[end]}`, false, 4, exit.x < scene.width / 2);
  }

  return (
    <g>
      {[behind, ahead].map(
        (line, i) =>
          line.length > 1 && (
            <polyline key={i} points={pts(line)} fill="none" stroke="#ffffff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
          ),
      )}
      {behind.length > 1 && (
        <polyline points={pts(behind)} fill="none" stroke="#b9c1ca" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {ahead.length > 1 && (
        <polyline
          points={pts(ahead)}
          fill="none"
          stroke={ROUTE_INK}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? '2 9' : undefined}
        />
      )}

      {scene.you && user && (
        <line
          x1={scene.you.screen.x}
          y1={scene.you.screen.y}
          x2={user.screen.x}
          y2={user.screen.y}
          stroke="var(--ink)"
          strokeWidth={2.5}
          strokeDasharray="1 6"
          strokeLinecap="round"
        />
      )}

      {scene.stops.map((s, i) => {
        const isUser = i === model.userIdx;
        const passed = hasBus && i < pos;
        return (
          <circle
            key={i}
            cx={s.screen.x}
            cy={s.screen.y}
            r={isUser ? 7.5 : 4.5}
            fill="#ffffff"
            stroke={passed && !isUser ? '#c3cad3' : ROUTE_INK}
            strokeWidth={isUser ? 3.5 : 2.5}
          />
        );
      })}

      {scene.you && (
        <g>
          <ellipse cx={scene.you.screen.x} cy={scene.you.screen.y + 2} rx={9} ry={4} fill="rgb(16 24 40 / 0.14)" />
          <circle cx={scene.you.screen.x} cy={scene.you.screen.y - 4} r={8} fill="var(--ink)" stroke="#ffffff" strokeWidth={3} />
        </g>
      )}

      {bus && faces && (
        <g>
          {pulse && <polygon points={pts(ring(scene, bus.world, 15))} fill="var(--map-route)" className="bus-pulse" />}
          <polygon points={pts(ring(scene, bus.world, 14))} fill="rgb(16 24 40 / 0.1)" />
          {faces.sides.map((s, i) => (
            <g key={i}>
              <polygon points={pts(s.face)} fill="var(--map-route)" stroke="var(--map-route)" strokeWidth={0.5} strokeLinejoin="round" />
              {s.shade && <polygon points={pts(s.face)} fill="rgb(0 0 0 / 0.18)" />}
              <polygon points={pts(s.win)} fill="rgb(16 24 40 / 0.55)" />
            </g>
          ))}
          <polygon points={pts(faces.top)} fill="var(--map-route)" stroke="#ffffff" strokeWidth={1.25} strokeLinejoin="round" />
          <polygon points={pts(faces.top)} fill="rgb(255 255 255 / 0.25)" />
        </g>
      )}

      {labels.map((l) => {
        const w = l.text.length * (l.strong ? 7.4 : 6.8) + 18;
        const x0 = l.anchor === 'start' ? l.x - 4 : l.anchor === 'end' ? l.x - w + 4 : l.x - w / 2;
        return (
          <g key={l.text} className="map-pill" data-dark={l.dark ?? false}>
            <rect x={x0} y={l.y - 15} width={w} height={23} rx={11.5} />
            <text x={x0 + w / 2} y={l.y + 0.5} textAnchor="middle" className={`map-label ${l.strong ? 'map-label--strong' : ''}`}>
              {l.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function RouteMap3D({ stops, model, pulse, insetBottom }: RouteMap3DProps) {
  const [ref, size] = useSize<HTMLDivElement>();
  const ordered = useMemo(() => [...stops].sort((a, b) => a.seq - b.seq), [stops]);
  const names = useMemo(() => ordered.map((s) => s.name), [ordered]);
  const scene = useMemo(
    () => (size ? buildScene(ordered, { ...size, insetTop: INSET_TOP, insetBottom, userIdx: model.userIdx }) : null),
    [ordered, size, insetBottom, model.userIdx],
  );

  return (
    <figure role="img" aria-label={model.label} className="route-map absolute inset-0 m-0 overflow-hidden" data-stale={model.stale}>
      <div ref={ref} className="absolute inset-0">
        {scene && (
          <svg width={scene.width} height={scene.height} viewBox={`0 0 ${scene.width} ${scene.height}`} aria-hidden className="block">
            <City scene={scene} />
            <Overlay scene={scene} names={names} model={model} pulse={pulse} insetBottom={insetBottom} />
          </svg>
        )}
      </div>
    </figure>
  );
}
