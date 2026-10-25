import type { Stop } from '../../../contracts/types';

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

export interface Scene {
  width: number;
  height: number;
  project: (p: Vec3) => Projected;
  stops: { world: Vec2; screen: Projected }[];
  you: { world: Vec2; screen: Projected } | null;
  /** World position and heading for a fractional stop index. */
  pointAt: (pos: number) => { world: Vec2; heading: Vec2 };
  ground: Shape[];
  /** Road centre line as SVG points, drawn as a stroke `roadWidth` px wide. */
  road: string;
  roadWidth: number;
  /** Buildings and trees, painted far to near. */
  city: (Shape | Tree)[];
}

export interface SceneOptions {
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  userIdx: number;
}

const SEG = 28; // world units for a typical gap between stops
const PITCH = (54 * Math.PI) / 180;
const ROUTE_LEAN = (68 * Math.PI) / 180; // route runs away from the viewer, leaning right
const ROAD_HALF = 3.4;
const YOU_OFFSET = 22;
const PAD_X = 40;
const BLOCK = { u: 15, v: 19, street: 6 };

const COLOR = {
  street: '#f3f4f0',
  lot: '#e9ece6',
  park: '#d5e8cc',
  trees: ['#a6cc9b', '#8fbf86', '#b3d4a8'],
  top: [251, 252, 253] as const,
  lit: [238, 241, 244] as const,
  shade: [212, 218, 226] as const,
  haze: [242, 244, 246] as const,
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

/** Deterministic 0..1 noise, so the city looks the same on every render and every phone. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Real directions between stops; gap lengths evened out so a 2 km leg doesn't squash a 70 m one. */
function layoutRoute(stops: Stop[]): Vec2[] {
  if (stops.length === 0) return [];
  const lat0 = (stops[0].lat * Math.PI) / 180;
  const meters = stops.map((s) => ({ x: s.lng * Math.cos(lat0) * 111_320, y: s.lat * 110_540 }));
  const segs = meters.slice(1).map((p, i) => sub(p, meters[i]));
  const sorted = segs.map(len).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  const pts: Vec2[] = [{ x: 0, y: 0 }];
  segs.forEach((s, i) => {
    const d = norm(s);
    const target = SEG * clamp(len(s) / median, 0.6, 1.6);
    pts.push({ x: pts[i].x + d.x * target, y: pts[i].y + d.y * target });
  });
  return pts;
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  const t = l2 === 0 ? 0 : clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2, 0, 1);
  return len(sub(p, { x: a.x + ab.x * t, y: a.y + ab.y * t }));
}

function distToRoute(p: Vec2, route: Vec2[]): number {
  if (route.length === 1) return len(sub(p, route[0]));
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) best = Math.min(best, distToSegment(p, route[i], route[i + 1]));
  return best;
}

export function buildScene(routeStops: Stop[], opts: SceneOptions): Scene {
  const ordered = [...routeStops].sort((a, b) => a.seq - b.seq);
  const route = layoutRoute(ordered);
  const first = route[0] ?? { x: 0, y: 0 };
  const last = route[route.length - 1] ?? first;
  const axis = norm(sub(last, first));
  const alpha = Math.atan2(axis.y, axis.x);
  const beta = ROUTE_LEAN - alpha;
  const [cb, sb] = [Math.cos(beta), Math.sin(beta)];
  const [cp, sp] = [Math.cos(PITCH), Math.sin(PITCH)];

  const xs = route.map((p) => p.x);
  const ys = route.map((p) => p.y);
  const center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), SEG);
  const D = extent * 2.4 + 60;

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

  // "You" stands beside your stop, on the side facing the viewer.
  let youWorld: Vec2 | null = null;
  if (opts.userIdx >= 0 && opts.userIdx < route.length) {
    const p = route[opts.userIdx];
    const dir = norm(sub(route[Math.min(route.length - 1, opts.userIdx + 1)], route[Math.max(0, opts.userIdx - 1)]));
    const n = { x: -dir.y, y: dir.x };
    const towardViewer = rotate({ x: center.x + n.x, y: center.y + n.y }).y < 0 ? 1 : -1;
    youWorld = { x: p.x + n.x * YOU_OFFSET * towardViewer, y: p.y + n.y * YOU_OFFSET * towardViewer };
  }

  const fitPts = [...route, ...(youWorld ? [youWorld] : [])].map((p) => view({ ...p, z: 0 }));
  const fx = fitPts.map((p) => p.x);
  const fy = fitPts.map((p) => p.y);
  const bw = Math.max(...fx) - Math.min(...fx);
  const bh = Math.max(...fy) - Math.min(...fy);
  const availH = opts.height - opts.insetTop - opts.insetBottom - 24;
  const k = Math.min((opts.width - PAD_X * 2) / Math.max(bw, 1), availH / Math.max(bh, 1), 7);
  const ox = opts.width / 2 - k * ((Math.min(...fx) + Math.max(...fx)) / 2);
  const oy = opts.insetTop + 12 + availH / 2 - k * ((Math.min(...fy) + Math.max(...fy)) / 2);

  const project = (p: Vec3): Projected => {
    const v = view(p);
    return { x: ox + k * v.x, y: oy + k * v.y, depth: v.depth, scale: v.s * k };
  };
  const poly = (pts: Vec3[]) =>
    pts
      .map(project)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');

  const pointAt = (pos: number) => {
    if (route.length === 1) return { world: route[0], heading: axis };
    const i = clamp(Math.floor(pos), 0, route.length - 2);
    const t = clamp(pos - i, 0, 1);
    const a = route[i];
    const b = route[i + 1];
    return { world: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, heading: norm(sub(b, a)) };
  };

  // Ground plane and city blocks on a grid aligned with the route, like BGC's street grid.
  const u = axis;
  const v = { x: -axis.y, y: axis.x };
  const toWorld = (a: number, b: number): Vec2 => ({ x: center.x + u.x * a + v.x * b, y: center.y + u.y * a + v.y * b });
  const uv = route.map((p) => ({ a: (p.x - center.x) * u.x + (p.y - center.y) * u.y, b: (p.x - center.x) * v.x + (p.y - center.y) * v.y }));
  const margin = 70 + extent * 0.35;
  const aMin = Math.min(...uv.map((p) => p.a)) - margin;
  const aMax = Math.max(...uv.map((p) => p.a)) + margin;
  const bMin = Math.min(...uv.map((p) => p.b)) - margin;
  const bMax = Math.max(...uv.map((p) => p.b)) + margin;

  const onScreen = (pts: Projected[]) =>
    pts.some((p) => p.x > -30 && p.x < opts.width + 30 && p.y > -60 && p.y < opts.height + 30);

  const ground: Shape[] = [
    { points: poly([toWorld(aMin, bMin), toWorld(aMax, bMin), toWorld(aMax, bMax), toWorld(aMin, bMax)].map((p) => ({ ...p, z: 0 }))), fill: COLOR.street },
  ];
  const lightDir = norm({ x: -0.75 * cb + -0.65 * sb, y: 0.75 * sb + -0.65 * cb }); // world vector toward screen upper-left
  type Item = { depth: number; tree?: Tree; box?: { foot: Vec2[]; h: number } };
  const items: Item[] = [];
  let dMin = Infinity;
  let dMax = -Infinity;

  const pitchU = BLOCK.u + BLOCK.street;
  const pitchV = BLOCK.v + BLOCK.street;
  for (let i = Math.floor(aMin / pitchU); i * pitchU < aMax; i++) {
    for (let j = Math.floor(bMin / pitchV); j * pitchV < bMax; j++) {
      const a0 = i * pitchU;
      const b0 = j * pitchV;
      const c = toWorld(a0 + BLOCK.u / 2, b0 + BLOCK.v / 2);
      const halfDiag = Math.hypot(BLOCK.u, BLOCK.v) / 2;
      const dRoad = distToRoute(c, route);
      if (dRoad - halfDiag < ROAD_HALF + 1.5) continue;
      if (youWorld && len(sub(c, youWorld)) < halfDiag + 4) continue;
      const corners = [toWorld(a0, b0), toWorld(a0 + BLOCK.u, b0), toWorld(a0 + BLOCK.u, b0 + BLOCK.v), toWorld(a0, b0 + BLOCK.v)];
      const projected = corners.map((p) => project({ ...p, z: 0 }));
      if (!onScreen(projected)) continue;

      const seed = i * 73.13 + j * 179.7;
      const park = hash(seed) < 0.2;
      ground.push({ points: poly(corners.map((p) => ({ ...p, z: 0 }))), fill: park ? COLOR.park : COLOR.lot });

      if (park) {
        for (let t = 0; t < 5; t++) {
          const p = toWorld(a0 + 2.5 + hash(seed + t) * (BLOCK.u - 5), b0 + 2.5 + hash(seed + t + 9) * (BLOCK.v - 5));
          const s = project({ ...p, z: 2.6 });
          items.push({ depth: s.depth, tree: { x: s.x, y: s.y, r: 2.4 * s.scale, fill: COLOR.trees[t % 3] } });
        }
        continue;
      }

      const split = hash(seed + 1) > 0.45;
      const lots = split
        ? [
            [a0, a0 + BLOCK.u / 2],
            [a0 + BLOCK.u / 2, a0 + BLOCK.u],
          ]
        : [[a0, a0 + BLOCK.u]];
      lots.forEach(([l0, l1], n) => {
        const inset = 1.3;
        const foot = [
          toWorld(l0 + inset, b0 + inset),
          toWorld(l1 - inset, b0 + inset),
          toWorld(l1 - inset, b0 + BLOCK.v - inset),
          toWorld(l0 + inset, b0 + BLOCK.v - inset),
        ];
        const r = hash(seed + 3 + n * 5);
        const falloff = clamp((dRoad - 8) / 40, 0.16, 1);
        const h = (3 + r ** 1.5 * 20) * falloff + 1.5;
        const depth = project({ ...toWorld((l0 + l1) / 2, b0 + BLOCK.v / 2), z: 0 }).depth;
        dMin = Math.min(dMin, depth);
        dMax = Math.max(dMax, depth);
        items.push({ depth, box: { foot, h } });
      });
    }
  }

  // Shade boxes now that the depth range is known: far buildings fade into the haze.
  const city: (Shape | Tree)[] = [];
  items.sort((a, b) => b.depth - a.depth);
  for (const item of items) {
    const { box, tree } = item;
    if (tree) city.push(tree);
    if (!box) continue;
    const haze = clamp((item.depth - dMin) / Math.max(1, dMax - dMin), 0, 1) * 0.65;
    const { foot, h } = box;
    for (let e = 0; e < 4; e++) {
      const a = foot[e];
      const b = foot[(e + 1) % 4];
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
      city.push({
        points: face.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
        fill: rgb(mix(mix(COLOR.shade, COLOR.lit, light), COLOR.haze, haze)),
      });
    }
    city.push({
      points: poly(foot.map((p) => ({ ...p, z: h }))),
      fill: rgb(mix(COLOR.top, COLOR.haze, haze * 0.5)),
      stroke: 'rgb(255 255 255 / 0.9)',
    });
  }

  // The road extends a little past both ends so the route doesn't stop in a field.
  const ext = (p: Vec2, from: Vec2) => {
    const d = norm(sub(p, from));
    return { x: p.x + d.x * 18, y: p.y + d.y * 18 };
  };
  // A round-joined stroke, not an offset polygon: the route has hairpin turns that would fold a ribbon.
  const roadLine = route.length > 1 ? [ext(route[0], route[1]), ...route, ext(last, route[route.length - 2])] : route;
  const road = poly(roadLine.map((p) => ({ ...p, z: 0 })));
  const roadWidth = ROAD_HALF * 2 * project({ ...center, z: 0 }).scale;

  return {
    width: opts.width,
    height: opts.height,
    project,
    stops: route.map((world) => ({ world, screen: project({ ...world, z: 0 }) })),
    you: youWorld ? { world: youWorld, screen: project({ ...youWorld, z: 0 }) } : null,
    pointAt,
    ground,
    road,
    roadWidth,
    city,
  };
}
