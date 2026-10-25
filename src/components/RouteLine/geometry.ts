import type { BusStatus, Stop } from '../../contracts/types'

type XY = { x: number; y: number }

// Flat-earth projection in meters. Accurate enough for a few km in BGC.
function toXY(lat: number, lng: number, lat0: number): XY {
  return {
    x: lng * Math.cos((lat0 * Math.PI) / 180) * 111_320,
    y: lat * 110_540,
  }
}

function projectOnSegment(p: XY, a: XY, b: XY): { t: number; dist: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const raw = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  const t = Math.max(0, Math.min(1, raw))
  return { t, dist: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) }
}

/**
 * Where a bus sits along the route, as a fractional stop index.
 * 0 = first stop, 1.5 = halfway between the 2nd and 3rd stop, etc.
 * `stops` must already be sorted by `seq`.
 */
export function busPosition(bus: BusStatus, stops: Stop[]): number | null {
  if (stops.length === 0) return null
  const indexOf = (id: string | null) => (id ? stops.findIndex((s) => s.stop_id === id) : -1)

  if (bus.status === 'waiting') {
    const i = indexOf(bus.current_stop_id)
    if (i >= 0) return i
  }

  const lat0 = stops[0].lat
  const p = toXY(bus.lat, bus.lng, lat0)
  const pts = stops.map((s) => toXY(s.lat, s.lng, lat0))
  if (pts.length === 1) return 0

  const next = indexOf(bus.next_stop_id)
  if (next === 0) return 0
  if (next > 0) return next - 1 + projectOnSegment(p, pts[next - 1], pts[next]).t

  // No next stop known: snap to the closest segment.
  let best = { pos: 0, dist: Number.POSITIVE_INFINITY }
  for (let i = 0; i < pts.length - 1; i++) {
    const r = projectOnSegment(p, pts[i], pts[i + 1])
    if (r.dist < best.dist) best = { pos: i + r.t, dist: r.dist }
  }
  return best.pos
}
