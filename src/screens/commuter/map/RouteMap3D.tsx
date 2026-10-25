import { Minus, Plus } from 'lucide-react';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
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
const ZOOM_MAX = 3.2;
const ZOOM_MIN = 1;

type ViewBox = { x: number; y: number; w: number; h: number };

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

function labelsInView(scene: Scene, view: ViewBox, zoom: number) {
  const pad = 24 / zoom;
  const inView = (x: number, y: number) => x >= view.x - pad && x <= view.x + view.w + pad && y >= view.y - pad && y <= view.y + view.h + pad;
  const cap = zoom >= 1.8 ? 14 : zoom >= 1.25 ? 10 : 6;
  const gap = zoom >= 1.5 ? 28 : 40;
  const picked: typeof scene.streetLabelPool = [];
  for (const l of scene.streetLabelPool) {
    if (!inView(l.x, l.y)) continue;
    if (picked.some((o) => Math.hypot(o.x - l.x, o.y - l.y) < gap)) continue;
    picked.push(l);
    if (picked.length >= cap) break;
  }
  return picked.length ? picked : scene.streetLabels;
}

const City = memo(function City({ scene, view, zoom }: { scene: Scene; view: ViewBox; zoom: number }) {
  const streetLabels = useMemo(() => labelsInView(scene, view, zoom), [scene, view, zoom]);
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
          vectorEffect="non-scaling-stroke"
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
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {streetLabels.map((l) => (
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

function Overlay({
  scene,
  names,
  model,
  pulse,
  insetBottom,
  zoom,
}: {
  scene: Scene;
  names: string[];
  model: MapModel;
  pulse: boolean;
  insetBottom: number;
  zoom: number;
}) {
  const uiScale = 1 / clamp(zoom, 1, ZOOM_MAX);
  const pos = useGlide(model.busPos);
  const end = scene.stops.length - 1;
  const hasBus = pos != null;
  const dashed = model.mode === 'none';
  const behind = hasBus ? scene.slice(0, pos) : [];
  const ahead = scene.slice(hasBus ? pos : 0, end);
  const bus = hasBus ? scene.pointAt(pos) : null;
  const faces = bus ? busFaces(scene, bus.world, bus.heading) : null;
  const user = model.userIdx >= 0 ? scene.stops[model.userIdx] : null;

  type Label = { x: number; y: number; text: string; strong: boolean; anchor: 'start' | 'middle' | 'end'; dark?: boolean; minor?: boolean };
  type Box = Pick<Label, 'x' | 'y' | 'anchor'> & { text?: string; minor?: boolean };
  const labels: Label[] = [];
  // Minor stop labels are measured by their text; the main labels keep the original 110px box.
  const span = (l: Box) => {
    const w = l.minor && l.text ? l.text.length * 6.2 + 14 : 110;
    return l.anchor === 'start' ? [l.x, l.x + w] : l.anchor === 'end' ? [l.x - w, l.x] : [l.x - w / 2, l.x + w / 2];
  };
  const clashes = (l: Box, others: Box[]) =>
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
  const visible = (p: { x: number; y: number }) =>
    p.x > 24 && p.x < scene.width - 24 && p.y > INSET_TOP + 16 && p.y < scene.height - insetBottom - 16;
  if (end > 0 && end !== model.userIdx) {
    const endStop = scene.stops[end].screen;
    // A far terminus (EDSA Ayala, 2 km out) is off the map: label where the route leaves the frame.
    const exit = visible(endStop) ? null : [...scene.slice(0, end)].reverse().find(visible);
    if (!exit) place(endStop, names[end]);
    else place(exit, `To ${names[end]}`, false, 4, exit.x < scene.width / 2);
  }

  // Every other visible stop gets a small label. Stops that sit almost on top of each other on
  // screen share one label (Uptown Parade and Uptown Mall are only 70 m apart: "Uptown Parade · Mall").
  const placeMinor = (p: { x: number; y: number }, text: string) => {
    const options: Label[] = [
      { x: p.x + 12, y: p.y + 4, text, strong: false, anchor: 'start', minor: true },
      { x: p.x - 12, y: p.y + 4, text, strong: false, anchor: 'end', minor: true },
      { x: p.x, y: p.y - 14, text, strong: false, anchor: 'middle', minor: true },
      { x: p.x, y: p.y + 22, text, strong: false, anchor: 'middle', minor: true },
    ];
    const fits = (l: Label) => {
      const [a0, a1] = span(l);
      return a0 > 4 && a1 < scene.width - 4;
    };
    const spot = options.find((l) => fits(l) && !clashes(l, [...labels, ...reserved]));
    if (spot) labels.push(spot);
  };
  const joinNames = (list: string[]) => {
    const first = list[0].split(' ')[0];
    return list.map((n, k) => (k > 0 && n.startsWith(`${first} `) ? n.slice(first.length + 1) : n)).join(' · ');
  };
  const groups: { p: { x: number; y: number }; names: string[] }[] = [];
  scene.stops.forEach((s, i) => {
    if (i === model.userIdx || i === end || !visible(s.screen)) return;
    const last = groups[groups.length - 1];
    if (last && Math.hypot(s.screen.x - last.p.x, s.screen.y - last.p.y) < 30) last.names.push(names[i]);
    else groups.push({ p: s.screen, names: [names[i]] });
  });
  for (const g of groups) placeMinor(g.p, joinNames(g.names));

  return (
    <g>
      {[behind, ahead].map(
        (line, i) =>
          line.length > 1 && (
            <polyline
              key={i}
              points={pts(line)}
              fill="none"
              stroke="#ffffff"
              strokeWidth={9}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
      )}
      {behind.length > 1 && (
        <polyline
          points={pts(behind)}
          fill="none"
          stroke="#b9c1ca"
          strokeWidth={5}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {ahead.length > 1 && (
        <polyline
          points={pts(ahead)}
          fill="none"
          stroke={ROUTE_INK}
          strokeWidth={5}
          vectorEffect="non-scaling-stroke"
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
        const w = l.minor ? l.text.length * 6.2 + 14 : l.text.length * (l.strong ? 7.4 : 6.8) + 18;
        const h = l.minor ? 19 : 23;
        const x0 = l.anchor === 'start' ? l.x - 4 : l.anchor === 'end' ? l.x - w + 4 : l.x - w / 2;
        return (
          <g
            key={l.text}
            className="map-pill"
            data-dark={l.dark ?? false}
            transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) scale(${uiScale.toFixed(3)}) translate(${(-l.x).toFixed(1)} ${(-l.y).toFixed(1)})`}
          >
            <rect x={x0} y={l.y - (l.minor ? 13 : 15)} width={w} height={h} rx={h / 2} />
            <text
              x={x0 + w / 2}
              y={l.y + (l.minor ? 0 : 0.5)}
              textAnchor="middle"
              className={`map-label ${l.strong ? 'map-label--strong' : ''}`}
              style={l.minor ? { fontSize: 11 } : undefined}
            >
              {l.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function fullView(w: number, h: number): ViewBox {
  return { x: 0, y: 0, w, h };
}

/** Keep some of the map on screen so panning doesn't lose the route entirely. */
function clampView(v: ViewBox, baseW: number, baseH: number): ViewBox {
  const marginX = v.w * 0.35;
  const marginY = v.h * 0.35;
  return {
    w: v.w,
    h: v.h,
    x: clamp(v.x, -marginX, baseW - v.w + marginX),
    y: clamp(v.y, -marginY, baseH - v.h + marginY),
  };
}

function focalZoom(v: ViewBox, baseW: number, baseH: number, factor: number, fx: number, fy: number): ViewBox {
  const w = clamp(v.w / factor, baseW / ZOOM_MAX, baseW / ZOOM_MIN);
  const h = clamp(v.h / factor, baseH / ZOOM_MAX, baseH / ZOOM_MIN);
  const tx = (fx - v.x) / v.w;
  const ty = (fy - v.y) / v.h;
  return clampView({ x: fx - tx * w, y: fy - ty * h, w, h }, baseW, baseH);
}

/** Map-style zoom: move the SVG viewBox toward the pointer, not a CSS scale on the whole layer. */
function useMapViewBox(ref: RefObject<HTMLElement | null>, baseW: number, baseH: number) {
  const [view, setView] = useState<ViewBox>(() => fullView(baseW, baseH));
  const viewRef = useRef(view);
  const sizeKey = useRef('');
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (baseW <= 0 || baseH <= 0) return;
    const key = `${baseW}x${baseH}`;
    if (!sizeKey.current || sizeKey.current !== key) setView(fullView(baseW, baseH));
    sizeKey.current = key;
  }, [baseW, baseH]);

  useEffect(() => {
    const el = ref.current;
    if (!el || baseW <= 0 || baseH <= 0) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; view: ViewBox; midFx: number; midFy: number } | null = null;
    let pan: { px: number; py: number; view: ViewBox } | null = null;
    let lastTap = 0;

    const rectOf = () => el.getBoundingClientRect();
    const toMap = (clientX: number, clientY: number, v: ViewBox) => {
      const r = rectOf();
      return {
        fx: v.x + ((clientX - r.left) / r.width) * v.w,
        fy: v.y + ((clientY - r.top) / r.height) * v.h,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2 || viewRef.current.w < baseW - 2) e.preventDefault();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const v = viewRef.current;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const midClient = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const mid = toMap(midClient.x, midClient.y, v);
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), view: v, midFx: mid.fx, midFy: mid.fy };
        pan = null;
      } else if (pointers.size === 1) {
        pan = { px: e.clientX, py: e.clientY, view: v };
        const now = Date.now();
        if (now - lastTap < 280) setView(fullView(baseW, baseH));
        lastTap = now;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const factor = dist / Math.max(1, pinch.dist);
        setView(focalZoom(pinch.view, baseW, baseH, factor, pinch.midFx, pinch.midFy));
      } else if (pan && pointers.size === 1 && pan.view.w < baseW - 2) {
        const r = rectOf();
        const dx = ((e.clientX - pan.px) / r.width) * pan.view.w;
        const dy = ((e.clientY - pan.py) / r.height) * pan.view.h;
        setView(clampView({ ...pan.view, x: pan.view.x - dx, y: pan.view.y - dy }, baseW, baseH));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) pan = null;
      else if (pointers.size === 1) {
        const only = [...pointers.values()][0];
        pan = { px: only.x, py: only.y, view: viewRef.current };
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const { fx, fy } = toMap(e.clientX, e.clientY, v);
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView(focalZoom(v, baseW, baseH, factor, fx, fy));
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [ref, baseW, baseH]);

  const zoom = baseW > 0 ? baseW / view.w : 1;

  const zoomBy = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      if (baseW <= 0 || baseH <= 0) return;
      const el = ref.current;
      const v = viewRef.current;
      const r = el?.getBoundingClientRect();
      const fx =
        clientX != null && r
          ? v.x + ((clientX - r.left) / r.width) * v.w
          : v.x + v.w / 2;
      const fy =
        clientY != null && r
          ? v.y + ((clientY - r.top) / r.height) * v.h
          : v.y + v.h / 2;
      setView(focalZoom(v, baseW, baseH, factor, fx, fy));
    },
    [baseW, baseH, ref],
  );

  const resetView = useCallback(() => {
    if (baseW > 0 && baseH > 0) setView(fullView(baseW, baseH));
  }, [baseW, baseH]);

  return { view, zoom, zoomBy, resetView };
}

export function RouteMap3D({ stops, model, pulse, insetBottom }: RouteMap3DProps) {
  const [ref, size] = useSize<HTMLDivElement>();
  const baseW = size?.width ?? 0;
  const baseH = size?.height ?? 0;
  const { view, zoom, zoomBy, resetView } = useMapViewBox(ref, baseW, baseH);
  const ordered = useMemo(() => [...stops].sort((a, b) => a.seq - b.seq), [stops]);
  const names = useMemo(() => ordered.map((s) => s.name), [ordered]);
  const scene = useMemo(
    () =>
      size
        ? buildScene(ordered, {
            ...size,
            insetTop: INSET_TOP,
            insetBottom,
            userIdx: model.userIdx,
          })
        : null,
    [ordered, size, insetBottom, model.userIdx],
  );

  return (
    <figure
      role="img"
      aria-label={`${model.label} Pinch or scroll to zoom the map. Double-tap to reset.`}
      className="route-map absolute inset-0 m-0 overflow-hidden [touch-action:none]"
      data-stale={model.stale}
      data-zoom={zoom >= 1.2 ? 'in' : 'out'}
    >
      <div ref={ref} className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing">
        {scene && (
          <svg
            width={scene.width}
            height={scene.height}
            viewBox={`${view.x.toFixed(2)} ${view.y.toFixed(2)} ${view.w.toFixed(2)} ${view.h.toFixed(2)}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
            className="block h-full w-full"
          >
            <City scene={scene} view={view} zoom={zoom} />
            <Overlay scene={scene} names={names} model={model} pulse={pulse} insetBottom={insetBottom} zoom={zoom} />
          </svg>
        )}
      </div>
      <div className="pointer-events-auto absolute right-3 z-10 flex flex-col gap-2" style={{ bottom: insetBottom + 12 }}>
        <button
          type="button"
          aria-label="Zoom in"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-md"
          onClick={(e) => zoomBy(1.25, e.clientX, e.clientY)}
        >
          <Plus size={20} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= 1.02}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-md disabled:opacity-40"
          onClick={(e) => zoomBy(1 / 1.25, e.clientX, e.clientY)}
        >
          <Minus size={20} aria-hidden />
        </button>
        {zoom > 1.05 && (
          <button
            type="button"
            aria-label="Reset map view"
            className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink)] shadow-md"
            onClick={resetView}
          >
            Reset
          </button>
        )}
      </div>
    </figure>
  );
}
