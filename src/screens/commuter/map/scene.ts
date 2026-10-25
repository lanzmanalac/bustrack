import type { Stop } from '../../../contracts/types';
import bgcData from './bgc.json';

export type Vec2 = { x: number; y: number };
export type Vec3 = Vec2 & { z: number };
export type Projected = Vec2 & { depth: number; scale: number };

export interface Shape {
  points: string;
  fill: string;
  stroke?: string;
}

export interface Tree {
  x: number;
  y: number;
  r: number;
  fill: string;
}

export interface Street {
  points: string;
  width: number;
  kind: 'major' | 'minor' | 'walk';
}

export interface StreetLabel {
  x: number;
  y: number;
  angle: number;
  text: string;
}

export interface Scene {
  width: number;
  height: number;
  project: (p: Vec3) => Projected;
  /** World metres per screen pixel near the route: sizes things that should read the same at any zoom. */
  unit: number;
  stops: { world: Vec2; screen: Projected }[];
  you: { world: Vec2; screen: Projected } | null;
  /** World position and heading for a fractional stop index, following the streets. */
  pointAt: (pos: number) => { world: Vec2; heading: Vec2 };
  /** Screen points of the bus path between two fractional stop indexes. */
  slice: (from: number, to: number) => Projected[];
  ground: Shape[];
  streets: Street[];
  /** Top street-name candidates; the map filters these to the visible view when zooming. */
  streetLabelPool: StreetLabel[];
  streetLabels: StreetLabel[];
  /** Ground shadows, drawn as one translucent layer so overlaps don't darken. */
  shadows: string[];
  /** Buildings and trees, painted far to near. */
  city: (Shape | Tree)[];
  attribution: string | null;
}

export interface SceneOptions {
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  userIdx: number;
}

interface MapData {
  attribution: string;
  origin: { lat: number; lng: number };
  stops: { stop_id: string; lat: number; lng: number }[];
  legs: number[][][];
  roads: { c: string; n: string; p: number[][] }[];
  green: { p: number[][]; k: string }[];
  buildings: { p: number[][]; l: number | null }[];
  trees: number[][];
}
const MAP = bgcData as unknown as MapData;

const PITCH = (52 * Math.PI) / 180;
const GRID_LEAN = (62 * Math.PI) / 180; // street grid runs away from the viewer, leaning right
const FOCUS_M = 1200; // stops further than this from the cluster may leave the frame (the 2 km EDSA leg)
const PAD_X = 36;
const YOU_OFFSET_PX = 96; // leave room for the dotted walking leg and its time label
const HEIGHT_K = 0.42; // real towers would hide the route; heights are squashed
const STREET_M = { major: 20, minor: 11, walk: 5 };

const COLOR = {
  park: '#cfe2bf',
  pitch: '#bdd9a9',
  trees: ['#8fbe7e', '#a2ca90', '#7fb371'],
  top: [253, 253, 251] as const,
  lit: [238, 240, 234] as const,
  shade: [214, 219, 209] as const,
  haze: [233, 236, 228] as const,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: Vec2) => Math.hypot(v.x, v.y);
const norm = (v: Vec2): Vec2 => {
  const l = len(v);
  return l === 0 ? { x: 1, y: 0 } : { x: v.x / l, y: v.y / l };
};
const rgb = (c: readonly number[]) => `rgb(${c.map((n) => Math.round(n)).join(' ')})`;
const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((n, i) => n + (b[i] - n) * t);
const pts = (list: Vec2[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** Deterministic 0..1 noise, so the city looks the same on every render and every phone. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const KX = 111_320 * Math.cos((MAP.origin.lat * Math.PI) / 180);
const KY = 110_540;
const toWorld = (p: { lat: number; lng: number }): Vec2 => ({ x: (p.lng - MAP.origin.lng) * KX, y: (p.lat - MAP.origin.lat) * KY });
const vec = ([x, y]: number[]): Vec2 => ({ x, y });

/** The baked street path, if it was baked for these exact stops; straight lines otherwise. */
function routeLegs(stops: Stop[]): Vec2[][] {
  const baked =
    MAP.stops.length === stops.length &&
    stops.every((s, i) => MAP.stops[i].stop_id === s.stop_id && len(sub(toWorld(s), toWorld(MAP.stops[i]))) < 30);
  if (baked) return MAP.legs.map((leg) => leg.map(vec));
  const w = stops.map(toWorld);
  return w.slice(1).map((p, i) => [w[i], p]);
}

/** Dominant street direction (mod 90°), so the camera lines up with BGC's grid. */
const GRID_ANGLE = (() => {
  const bins = new Array(90).fill(0);
  for (const r of MAP.roads) {
    if (r.c === 'walk') continue;
    for (let i = 1; i < r.p.length; i++) {
      const d = sub(vec(r.p[i]), vec(r.p[i - 1]));
      const deg = ((Math.atan2(d.y, d.x) * 180) / Math.PI + 360) % 90;
      bins[Math.floor(deg)] += len(d);
    }
  }
  let best = 0;
  let bestW = -1;
  for (let i = 0; i < 90; i++) {
    const w = bins[(i + 89) % 90] + bins[i] * 2 + bins[(i + 1) % 90];
    if (w > bestW) [best, bestW] = [i, w];
  }
  return ((best + 0.5) * Math.PI) / 180;
})();

function convexHull(points: Vec2[]): Vec2[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Vec2[] = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const shortName = (n: string) =>
  n.replace(/ Avenue$/, ' Ave').replace(/ Street$/, ' St').replace(/ Parkway$/, ' Pkwy').replace(/ Road$/, ' Rd').replace(/ Drive$/, ' Dr');

export function buildScene(routeStops: Stop[], opts: SceneOptions): Scene {
  const ordered = [...routeStops].sort((a, b) => a.seq - b.seq);
  const legs = routeLegs(ordered);
  const stopWorld = ordered.length === 0 ? [] : legs.length === 0 ? [toWorld(ordered[0])] : [legs[0][0], ...legs.map((l) => l[l.length - 1])];
  const legLen = legs.map((l) => l.slice(1).reduce((s, p, i) => s + len(sub(p, l[i])), 0));

  const xs = stopWorld.map((p) => p.x).sort((a, b) => a - b);
  const ys = stopWorld.map((p) => p.y).sort((a, b) => a - b);
  const mid = { x: xs[Math.floor(xs.length / 2)] ?? 0, y: ys[Math.floor(ys.length / 2)] ?? 0 };
  const focus = stopWorld.filter((p) => len(sub(p, mid)) < FOCUS_M);
  const fxs = focus.map((p) => p.x);
  const fys = focus.map((p) => p.y);
  const center = focus.length
    ? { x: (Math.min(...fxs) + Math.max(...fxs)) / 2, y: (Math.min(...fys) + Math.max(...fys)) / 2 }
    : { x: 0, y: 0 };
  const extent = focus.length ? Math.max(Math.max(...fxs) - Math.min(...fxs), Math.max(...fys) - Math.min(...fys), 200) : 200;
  const D = extent * 2.4 + 60;
  const [cp, sp] = [Math.cos(PITCH), Math.sin(PITCH)];
  const availH = opts.height - opts.insetTop - opts.insetBottom - 24;

  // Try the four ways of laying the grid diagonally and keep the one that frames the route biggest.
  const camera = (alpha: number) => {
    const beta = GRID_LEAN - alpha;
    const [cb, sb] = [Math.cos(beta), Math.sin(beta)];
    const rotate = (p: Vec2): Vec2 => {
      const x = p.x - center.x;
      const y = p.y - center.y;
      return { x: x * cb - y * sb, y: x * sb + y * cb };
    };
    const view = (p: Vec3) => {
      const r = rotate(p);
      const vy = r.y * sp + p.z * cp;
      const depth = r.y * cp - p.z * sp;
      const s = D / Math.max(D * 0.25, D + depth);
      return { x: r.x * s, y: -vy * s, depth, s };
    };
    const fit = (extra: Vec2[]) => {
      const fp = [...focus, ...extra].map((p) => view({ ...p, z: 0 }));
      const fx = fp.map((p) => p.x);
      const fy = fp.map((p) => p.y);
      const bw = Math.max(...fx) - Math.min(...fx);
      const bh = Math.max(...fy) - Math.min(...fy);
      const k = Math.min((opts.width - PAD_X * 2) / Math.max(bw, 1), availH / Math.max(bh, 1), 1.4);
      return {
        k,
        ox: opts.width / 2 - k * ((Math.min(...fx) + Math.max(...fx)) / 2),
        oy: opts.insetTop + 12 + availH / 2 - k * ((Math.min(...fy) + Math.max(...fy)) / 2),
      };
    };
    // "You" stands a fixed screen distance from your stop: toward the viewer, and clear of the bus path.
    const youAt = (k: number): Vec2 | null => {
      if (opts.userIdx < 0 || opts.userIdx >= stopWorld.length) return null;
      const p = stopWorld[opts.userIdx];
      const off = YOU_OFFSET_PX / k;
      let best: Vec2 | null = null;
      let bestScore = -Infinity;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const q = { x: p.x + Math.cos(a) * off, y: p.y + Math.sin(a) * off };
        const towardViewer = -rotate(q).y + rotate(p).y;
        const score = Math.min(distToLegs(q), off) + towardViewer * 0.5;
        if (score > bestScore) [best, bestScore] = [q, score];
      }
      return best;
    };
    let f = fit([]);
    let you = youAt(f.k);
    if (you) {
      f = fit([you]);
      you = youAt(f.k);
    }
    return { rotate, view, ...f, you, cb, sb };
  };

  function distToLegs(p: Vec2) {
    let best = Infinity;
    for (const leg of legs) {
      for (let j = 1; j < leg.length; j++) {
        const [a, b] = [leg[j - 1], leg[j]];
        const ab = sub(b, a);
        const l2 = ab.x * ab.x + ab.y * ab.y;
        const t = l2 === 0 ? 0 : clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2, 0, 1);
        best = Math.min(best, len(sub(p, { x: a.x + ab.x * t, y: a.y + ab.y * t })));
      }
    }
    return best;
  }

  function pointAtWith(pos: number) {
    if (legs.length === 0) return { world: stopWorld[0] ?? { x: 0, y: 0 }, heading: { x: 1, y: 0 } };
    const i = clamp(Math.floor(pos), 0, legs.length - 1);
    const t = clamp(pos - i, 0, 1);
    const leg = legs[i];
    let want = t * legLen[i];
    for (let j = 1; j < leg.length; j++) {
      const d = sub(leg[j], leg[j - 1]);
      const l = len(d);
      if (want <= l || j === leg.length - 1) {
        const u = l === 0 ? 0 : clamp(want / l, 0, 1);
        return { world: { x: leg[j - 1].x + d.x * u, y: leg[j - 1].y + d.y * u }, heading: norm(d) };
      }
      want -= l;
    }
    return { world: leg[leg.length - 1], heading: { x: 1, y: 0 } };
  }

  const cam = [0, 1, 2, 3].map((q) => camera(GRID_ANGLE + (q * Math.PI) / 2)).reduce((a, b) => (b.k > a.k ? b : a));
  const { view, k, ox, oy } = cam;
  const youWorld = cam.you;

  const project = (p: Vec3): Projected => {
    const v = view(p);
    return { x: ox + k * v.x, y: oy + k * v.y, depth: v.depth, scale: v.s * k };
  };
  const flat = (p: Vec2) => project({ ...p, z: 0 });
  const onScreen = (list: Vec2[], m = 30) => list.some((p) => p.x > -m && p.x < opts.width + m && p.y > -m * 2 && p.y < opts.height + m);
  /** Loose bounds so pan/zoom can reveal streets outside the first frame. */
  const PAN_MARGIN = 420;
  const bboxOnScreen = (list: Vec2[]) => {
    const lx = list.map((p) => p.x);
    const ly = list.map((p) => p.y);
    return (
      Math.max(...lx) > -PAN_MARGIN &&
      Math.min(...lx) < opts.width + PAN_MARGIN &&
      Math.max(...ly) > -PAN_MARGIN &&
      Math.min(...ly) < opts.height + PAN_MARGIN
    );
  };

  const slice = (from: number, to: number): Projected[] => {
    if (to <= from || legs.length === 0) return [];
    const out = [flat(pointAtWith(from).world)];
    const i0 = clamp(Math.floor(from), 0, legs.length - 1);
    const i1 = clamp(Math.ceil(to) - 1, 0, legs.length - 1);
    for (let i = i0; i <= i1; i++) {
      const leg = legs[i];
      let acc = 0;
      for (let j = 1; j < leg.length; j++) {
        acc += len(sub(leg[j], leg[j - 1]));
        const at = i + (legLen[i] === 0 ? 1 : acc / legLen[i]);
        if (at > from && at < to) out.push(flat(leg[j]));
      }
    }
    out.push(flat(pointAtWith(to).world));
    return out;
  };

  const ground: Shape[] = MAP.green
    .map((g) => g.p.map((p) => flat(vec(p))))
    .map((ring, i) => ({ ring, kind: MAP.green[i].k }))
    .filter(({ ring }) => bboxOnScreen(ring))
    .map(({ ring, kind }) => ({ points: pts(ring), fill: kind === 'pitch' ? COLOR.pitch : COLOR.park }));

  const order = { walk: 0, minor: 1, major: 2 } as const;
  const streets: Street[] = [];
  const labelCandidates = new Map<string, { a: Projected; b: Projected; l: number }>();
  const labelBand = { top: opts.insetTop + 14, bottom: opts.height - opts.insetBottom - 14 };
  for (const r of MAP.roads) {
    const kind = (r.c in order ? r.c : 'minor') as Street['kind'];
    const line = r.p.map((p) => flat(vec(p)));
    if (!bboxOnScreen(line)) continue;
    streets.push({ points: pts(line), width: Math.max(kind === 'walk' ? 1.2 : 2, STREET_M[kind] * k), kind });
    if (!r.n || kind === 'walk') continue;
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1], line[i]];
      const inside = [a, b].every((p) => p.x > 16 && p.x < opts.width - 16 && p.y > labelBand.top && p.y < labelBand.bottom);
      const l = len(sub(b, a));
      const prev = labelCandidates.get(r.n);
      if (inside && (!prev || l > prev.l)) labelCandidates.set(r.n, { a, b, l });
    }
  }
  streets.sort((a, b) => order[a.kind] - order[b.kind]);

  const routeScreen = slice(0, Math.max(0, stopWorld.length - 1));
  const nearRoute = (p: Vec2) => routeScreen.some((q) => len(sub(p, q)) < 22);
  const streetLabelPool: StreetLabel[] = [];
  for (const [name, { a, b, l }] of [...labelCandidates].sort((x, y) => y[1].l - x[1].l)) {
    const text = shortName(name);
    if (l < text.length * 4.8 + 12) continue;
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (streetLabelPool.some((o) => len(sub(o, m)) < 34)) continue;
    let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    streetLabelPool.push({ ...m, angle, text });
    if (streetLabelPool.length >= 28) break;
  }
  const streetLabels = streetLabelPool.filter((l) => !nearRoute(l)).slice(0, 6);

  // Light comes from the screen's upper left; shadows fall to the lower right.
  const lightDir = norm({ x: -0.75 * cam.cb + -0.65 * cam.sb, y: 0.75 * cam.sb + -0.65 * cam.cb });
  const shadowDir = { x: -lightDir.x, y: -lightDir.y };
  type Item = { depth: number; tree?: Tree; box?: { foot: Vec2[]; h: number } };
  const items: Item[] = [];
  const shadows: string[] = [];
  let dMin = Infinity;
  let dMax = -Infinity;

  MAP.buildings.forEach((b, idx) => {
    let foot = b.p.map(vec);
    const signed = foot.reduce((s, p, i) => {
      const q = foot[(i + 1) % foot.length];
      return s + (p.x * q.y - q.x * p.y);
    }, 0);
    if (signed < 0) foot = [...foot].reverse();
    const screen = foot.map(flat);
    if (!bboxOnScreen(screen)) return;
    const levels = b.l ?? 3 + hash(idx + foot[0].x * 0.13) ** 2 * 16;
    const h = clamp(levels, 1, 70) * 3.3 * HEIGHT_K;
    const c = foot.reduce((s, p) => ({ x: s.x + p.x / foot.length, y: s.y + p.y / foot.length }), { x: 0, y: 0 });
    const depth = flat(c).depth;
    dMin = Math.min(dMin, depth);
    dMax = Math.max(dMax, depth);
    const cast = { x: shadowDir.x * h * 0.7, y: shadowDir.y * h * 0.7 };
    shadows.push(pts(convexHull([...foot, ...foot.map((p) => ({ x: p.x + cast.x, y: p.y + cast.y }))]).map(flat)));
    items.push({ depth, box: { foot, h } });
  });

  MAP.trees.forEach((t, i) => {
    const s = project({ ...vec(t), z: 3.5 });
    if (!onScreen([s], 10)) return;
    items.push({ depth: s.depth, tree: { x: s.x, y: s.y, r: Math.max(1.6, 3.4 * s.scale), fill: COLOR.trees[i % 3] } });
  });

  const city: (Shape | Tree)[] = [];
  items.sort((a, b) => b.depth - a.depth);
  for (const item of items) {
    const { box, tree } = item;
    if (tree) city.push(tree);
    if (!box) continue;
    const haze = clamp((item.depth - dMin) / Math.max(1, dMax - dMin), 0, 1) * 0.7;
    const { foot, h } = box;
    for (let e = 0; e < foot.length; e++) {
      const a = foot[e];
      const b = foot[(e + 1) % foot.length];
      const face = [
        { ...a, z: 0 },
        { ...b, z: 0 },
        { ...b, z: h },
        { ...a, z: h },
      ].map(project);
      const area = face.reduce((s, p, idx) => {
        const q = face[(idx + 1) % 4];
        return s + (p.x * q.y - q.x * p.y);
      }, 0);
      if (area >= 0) continue;
      const edge = norm(sub(b, a));
      const outward = { x: edge.y, y: -edge.x };
      const light = clamp(0.5 + 0.5 * (outward.x * lightDir.x + outward.y * lightDir.y), 0, 1);
      city.push({ points: pts(face), fill: rgb(mix(mix(COLOR.shade, COLOR.lit, light), COLOR.haze, haze)) });
    }
    city.push({
      points: pts(foot.map((p) => project({ ...p, z: h }))),
      fill: rgb(mix(COLOR.top, COLOR.haze, haze * 0.5)),
      stroke: 'rgb(255 255 255 / 0.9)',
    });
  }

  return {
    width: opts.width,
    height: opts.height,
    project,
    unit: 1 / k,
    stops: stopWorld.map((world) => ({ world, screen: flat(world) })),
    you: youWorld ? { world: youWorld, screen: flat(youWorld) } : null,
    pointAt: pointAtWith,
    slice,
    ground,
    streets,
    streetLabelPool,
    streetLabels,
    shadows,
    city,
    attribution: MAP.buildings.length ? MAP.attribution : null,
  };
}
