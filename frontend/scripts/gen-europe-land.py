"""Generates europe-land.ts from Natural Earth admin-0 countries.

Usage (from frontend/, after downloading ne_50m_admin_0_countries.geojson v5.1.2 from
https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson):
  python -I scripts/gen-europe-land.py ne_50m_admin_0_countries.geojson
    src/app/shared/map/europe-land.ts -30 48 33 63
then run Prettier on the output. The box must match LAND_WEST/LAND_EAST in route-map.ts.


Clips each country's outer rings to the lon/lat box (Sutherland-Hodgman),
simplifies them (Ramer-Douglas-Peucker, 0.05 degrees) and writes flat
[lon, lat, ...] rings rounded to 2 decimals.
"""
import json
import sys

TOLERANCE = 0.05


def clip(ring, west, east, south, north):
    def clip_edge(points, inside, intersect):
        out = []
        for i, current in enumerate(points):
            previous = points[i - 1]
            if inside(current):
                if not inside(previous):
                    out.append(intersect(previous, current))
                out.append(current)
            elif inside(previous):
                out.append(intersect(previous, current))
        return out

    def at_x(x):
        return lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))

    def at_y(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y)

    points = [tuple(p[:2]) for p in ring]
    for inside, intersect in (
        (lambda p: p[0] >= west, at_x(west)),
        (lambda p: p[0] <= east, at_x(east)),
        (lambda p: p[1] >= south, at_y(south)),
        (lambda p: p[1] <= north, at_y(north)),
    ):
        if not points:
            break
        points = clip_edge(points, inside, intersect)
    return points


def simplify(points, tolerance):
    if len(points) < 3:
        return points

    def distance(p, a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        if dx == 0 and dy == 0:
            return ((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2) ** 0.5
        t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        return ((p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2) ** 0.5

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        best, index = 0.0, -1
        for i in range(start + 1, end):
            d = distance(points[i], points[start], points[end])
            if d > best:
                best, index = d, i
        if best > tolerance and index > 0:
            keep[index] = True
            stack.append((start, index))
            stack.append((index, end))
    return [p for p, k in zip(points, keep) if k]


def area(points):
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1]))) / 2


def main():
    source, target = sys.argv[1], sys.argv[2]
    west, east, south, north = (float(v) for v in sys.argv[3:7])
    data = json.load(open(source, encoding='utf-8'))
    rings = []
    for feature in data['features']:
        geometry = feature['geometry']
        polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        for polygon in polygons:
            clipped = clip(polygon[0], west, east, south, north)
            if len(clipped) > 1 and clipped[0] == clipped[-1]:
                clipped = clipped[:-1]
            ring = simplify(clipped + [clipped[0]], TOLERANCE)[:-1] if len(clipped) >= 3 else []
            if len(ring) >= 3 and area(ring) >= 0.01:
                rings.append([round(v, 2) for p in ring for v in p])

    def fmt(v):
        text = f'{v:.2f}'.rstrip('0').rstrip('.')
        return '0' if text in ('-0', '') else text

    header = f"""/**
 * Land and country shapes for the route map, as flat [longitude, latitude, ...] rings.
 *
 * Source: Natural Earth 1:50m Admin 0 - Countries (v5.1.2), public domain
 * (https://www.naturalearthdata.com/about/terms-of-use/). Clipped to
 * longitude {fmt(west)}..{fmt(east)} and latitude {fmt(south)}..{fmt(north)} and simplified (Ramer-Douglas-Peucker,
 * {TOLERANCE} degrees). Generated data: regenerate rather than edit by hand.
 */
export const LAND_RINGS: readonly (readonly number[])[] = [
"""
    body = ''.join('  [' + ', '.join(fmt(v) for v in ring) + '],\n' for ring in rings)
    open(target, 'w', encoding='utf-8', newline='\n').write(header + body + '];\n')
    print(f'{len(rings)} rings, {sum(len(r) // 2 for r in rings)} points')


main()
