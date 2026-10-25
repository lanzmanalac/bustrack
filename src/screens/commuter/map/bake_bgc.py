"""Bakes real BGC streets, buildings, parks and the bus path from OpenStreetMap into bgc.json.

    python3 src/screens/commuter/map/bake_bgc.py

Map data © OpenStreetMap contributors (ODbL). Rerun when route.json stops change.
"""

import heapq
import json
import math
import os
import urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROUTE = os.path.join(HERE, '../../../data/route.json')
OUT = os.path.join(HERE, 'bgc.json')
CACHE = '/tmp'
AREAS = {
    'bgc.osm': (121.0440, 14.5470, 121.0590, 14.5610),
    'edsa.osm': (121.0260, 14.5460, 121.0445, 14.5580),
}
# Detail (buildings, parks, minor streets) is only kept around the BGC part of the route.
DETAIL = (121.0435, 14.5480, 121.0590, 14.5612)

DRIVE = {
    'trunk': 1, 'primary': 1, 'secondary': 1, 'tertiary': 1, 'trunk_link': 1, 'primary_link': 1,
    'secondary_link': 1, 'tertiary_link': 1, 'residential': 1.2, 'unclassified': 1.2, 'service': 3,
}
ROAD_CLASS = {
    'trunk': 'major', 'primary': 'major', 'secondary': 'major', 'trunk_link': 'minor', 'primary_link': 'minor',
    'secondary_link': 'minor', 'tertiary': 'minor', 'tertiary_link': 'minor', 'residential': 'minor',
    'unclassified': 'minor', 'pedestrian': 'walk',
}
GREEN = {('leisure', 'park'), ('leisure', 'garden'), ('leisure', 'pitch'), ('landuse', 'grass'), ('leisure', 'playground')}


def fetch(name, bbox):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        url = 'https://api.openstreetmap.org/api/0.6/map?bbox=%f,%f,%f,%f' % bbox
        req = urllib.request.Request(url, headers={'User-Agent': 'sakaykita-hackathon/1.0'})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, 'wb') as f:
            f.write(r.read())
    return ET.parse(path).getroot()


route = json.load(open(ROUTE))
stops = sorted(route['stops'], key=lambda s: s['seq'])
LAT0 = sum(s['lat'] for s in stops[:-1]) / (len(stops) - 1)
LNG0 = sum(s['lng'] for s in stops[:-1]) / (len(stops) - 1)
KX = 111_320 * math.cos(math.radians(LAT0))
KY = 110_540


def xy(lat, lng):
    return ((lng - LNG0) * KX, (lat - LAT0) * KY)


def in_detail(lat, lng):
    return DETAIL[0] <= lng <= DETAIL[2] and DETAIL[1] <= lat <= DETAIL[3]


nodes, ways, tree_nodes = {}, {}, []
for name, bbox in AREAS.items():
    root = fetch(name, bbox)
    for n in root.iter('node'):
        nodes[n.get('id')] = (float(n.get('lat')), float(n.get('lon')))
        if any(t.get('k') == 'natural' and t.get('v') == 'tree' for t in n.findall('tag')):
            tree_nodes.append(n.get('id'))
    for w in root.iter('way'):
        ways[w.get('id')] = (
            [r.get('ref') for r in w.findall('nd')],
            {t.get('k'): t.get('v') for t in w.findall('tag')},
        )


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy or 1e-9
    best, idx = 0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
        d = math.hypot(px - ax - t * dx, py - ay - t * dy)
        if d > best:
            best, idx = d, i
    if best <= eps:
        return [pts[0], pts[-1]]
    return rdp(pts[: idx + 1], eps)[:-1] + rdp(pts[idx:], eps)


def r1(p):
    return [round(p[0], 1), round(p[1], 1)]


def area(pts):
    return abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2


# --- Bus path: shortest legal drive between consecutive stops ---------------------------------
graph = {}
snap_nodes = set()
for refs, tags in ways.values():
    hw = tags.get('highway')
    if hw not in DRIVE or tags.get('access') in ('private', 'no'):
        continue
    refs = [r for r in refs if r in nodes]
    oneway = tags.get('oneway') in ('yes', '1', 'true') or tags.get('junction') == 'roundabout'
    reverse = tags.get('oneway') == '-1'
    for a, b in zip(refs, refs[1:]):
        pa, pb = xy(*nodes[a]), xy(*nodes[b])
        cost = math.dist(pa, pb) * DRIVE[hw]
        if not reverse:
            graph.setdefault(a, []).append((b, cost, True))
        if not oneway:
            graph.setdefault(b, []).append((a, cost, True))
        if oneway or reverse:
            # Kept only for the fallback search, when the legal search finds nothing.
            graph.setdefault(b if not reverse else a, []).append((a if not reverse else b, cost, False))
    if hw != 'service':
        snap_nodes.update(refs)


def nearest(lat, lng):
    p = xy(lat, lng)
    return min(snap_nodes, key=lambda n: math.dist(p, xy(*nodes[n])))


def shortest(a, b, legal):
    dist, prev, heap = {a: 0}, {}, [(0, a)]
    while heap:
        d, u = heapq.heappop(heap)
        if u == b:
            path = [b]
            while path[-1] != a:
                path.append(prev[path[-1]])
            return path[::-1]
        if d > dist[u]:
            continue
        for v, c, ok in graph.get(u, []):
            if legal and not ok:
                continue
            if d + c < dist.get(v, math.inf):
                dist[v], prev[v] = d + c, u
                heapq.heappush(heap, (d + c, v))
    return None


snapped = [nearest(s['lat'], s['lng']) for s in stops]
legs = []
for i, (a, b) in enumerate(zip(snapped, snapped[1:])):
    path = shortest(a, b, True) or shortest(a, b, False) or [a, b]
    pts = rdp([xy(*nodes[n]) for n in path], 1.0)
    legs.append([r1(p) for p in pts])
    km = sum(math.dist(pts[j], pts[j + 1]) for j in range(len(pts) - 1)) / 1000
    print(f"leg {stops[i]['name']} -> {stops[i + 1]['name']}: {km:.2f} km")

# --- Streets, buildings, parks, trees ----------------------------------------------------------
roads, buildings, green, trees = [], [], [], []
for wid, (refs, tags) in ways.items():
    pts_ll = [nodes[r] for r in refs if r in nodes]
    if len(pts_ll) < 2:
        continue
    hw = tags.get('highway')
    cls = ROAD_CLASS.get(hw)
    if cls and (cls == 'major' or any(in_detail(*p) for p in pts_ll)):
        if tags.get('area') == 'yes':
            continue
        pts = rdp([xy(*p) for p in pts_ll], 0.8)
        roads.append({'c': cls, 'n': tags.get('name', ''), 'p': [r1(p) for p in pts]})
        continue
    if not any(in_detail(*p) for p in pts_ll) or refs[0] != refs[-1]:
        if tags.get('natural') == 'tree_row' and any(in_detail(*p) for p in pts_ll):
            pts = [xy(*p) for p in pts_ll]
            for a, b in zip(pts, pts[1:]):
                steps = max(1, int(math.dist(a, b) // 9))
                for k in range(steps):
                    t = k / steps
                    trees.append(r1((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)))
        continue
    pts = rdp([xy(*p) for p in pts_ll[:-1]], 0.6)
    if len(pts) < 3:
        continue
    if 'building' in tags and tags.get('building') not in ('roof', 'no'):
        a = area(pts)
        if a < 40:
            continue
        levels = None
        try:
            if 'height' in tags:
                levels = float(tags['height'].split()[0]) / 3.3
            elif 'building:levels' in tags:
                levels = float(tags['building:levels'])
        except ValueError:
            pass
        buildings.append({'p': [r1(p) for p in pts], 'l': round(levels, 1) if levels else None})
    elif any((k, tags.get(k)) in GREEN for k in ('leisure', 'landuse')):
        green.append({'p': [r1(p) for p in pts], 'k': 'pitch' if tags.get('leisure') == 'pitch' else 'park'})

for nid in tree_nodes:
    if in_detail(*nodes[nid]):
        trees.append(r1(xy(*nodes[nid])))

out = {
    'attribution': '© OpenStreetMap contributors',
    'origin': {'lat': LAT0, 'lng': LNG0},
    'stops': [{'stop_id': s['stop_id'], 'lat': s['lat'], 'lng': s['lng']} for s in stops],
    'legs': legs,
    'roads': roads,
    'green': green,
    'buildings': buildings,
    'trees': trees,
}
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print(f'{len(roads)} roads, {len(buildings)} buildings, {len(green)} green, {len(trees)} trees, '
      f'{os.path.getsize(OUT) / 1024:.0f} KB')
