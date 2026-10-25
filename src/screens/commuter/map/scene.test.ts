import { describe, expect, it } from 'vitest';
import type { Stop } from '../../../contracts/types';
import route from '../../../data/route.json';
import { buildScene } from './scene';

const stop = (seq: number, name: string, lat: number, lng: number): Stop => ({
  stop_id: `s${seq}`,
  route_id: 'demo-route',
  name,
  lat,
  lng,
  seq,
});

// BGC Bus North Route toward EDSA Ayala (DRIVER__HANDOFF.md): a hook shape with one 2 km leg.
const NORTH: Stop[] = [
  stop(1, 'The Globe Tower', 14.5533, 121.0501),
  stop(2, 'Uptown Parade', 14.5574, 121.054),
  stop(3, 'Uptown Mall', 14.5569, 121.0536),
  stop(4, 'Avida 34th', 14.5548, 121.0546),
  stop(5, 'BGC Turf', 14.5541, 121.0521),
  stop(6, 'HSBC', 14.5536, 121.048),
  stop(7, 'EDSA Ayala', 14.5493, 121.029),
];

const VIEW = { width: 390, height: 480, insetTop: 24, insetBottom: 96 };

describe('buildScene', () => {
  it.each([
    ['route.json', route.stops as Stop[], 3],
    ['BGC North route', NORTH, 3],
  ])('%s: every BGC stop and "You" land inside the visible map area', (_, stops, userIdx) => {
    const scene = buildScene(stops, { ...VIEW, userIdx });
    // EDSA Ayala is 2 km out; the route is allowed to run off the map toward it.
    const points = [...scene.stops.slice(0, -1).map((s) => s.screen), scene.you!.screen];
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(VIEW.width);
      expect(p.y).toBeGreaterThanOrEqual(VIEW.insetTop);
      expect(p.y).toBeLessThanOrEqual(VIEW.height - VIEW.insetBottom);
    }
  });

  it('follows the real streets when the stops match the baked map', () => {
    const scene = buildScene(route.stops as Stop[], { ...VIEW, userIdx: 3 });
    expect(scene.slice(0, 1).length).toBeGreaterThan(2);
    expect(scene.city.length).toBeGreaterThan(100);
  });

  it('falls back to straight lines for stops the map was not baked for', () => {
    const moved = NORTH.map((s) => ({ ...s, lat: s.lat + 0.002 }));
    const scene = buildScene(moved, { ...VIEW, userIdx: 3 });
    expect(scene.slice(0, 1)).toHaveLength(2);
  });

  it('keeps a short 70 m gap visible next to a 2 km leg', () => {
    const { stops } = buildScene(NORTH, { ...VIEW, userIdx: 3 });
    const gap = (i: number) => Math.hypot(stops[i + 1].screen.x - stops[i].screen.x, stops[i + 1].screen.y - stops[i].screen.y);
    expect(gap(1)).toBeGreaterThan(14); // Uptown Parade → Uptown Mall
  });
});
