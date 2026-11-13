"""Generates world-land.ts from Natural Earth 1:110m admin-0 countries.

Usage (from frontend/, after downloading ne_110m_admin_0_countries.geojson v5.1.2 from
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson
into a directory outside the repository):
  python -I scripts/gen-world-land.py <dir>/ne_110m_admin_0_countries.geojson src/app/shared/map/world-land.ts
then run Prettier on the output.

Takes each country's outer rings (holes are dropped), simplifies them (Ramer-Douglas-Peucker,
0.05 degrees), winds them clockwise as d3-geo expects for spherical polygons and writes flat
[lon, lat, ...] rings rounded to 2 decimals.
"""
import json
import sys

TOLERANCE = 0.05


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


def signed_area(points):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1])) / 2


def main():
    source, target = sys.argv[1], sys.argv[2]
    data = json.load(open(source, encoding='utf-8'))
    rings = []
    for feature in data['features']:
        geometry = feature['geometry']
        polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        for polygon in polygons:
            outer = [tuple(p[:2]) for p in polygon[0]]
            if outer[0] == outer[-1]:
                outer = outer[:-1]
            ring = simplify(outer + [outer[0]], TOLERANCE)[:-1]
            if len(ring) < 3 or abs(signed_area(ring)) < 0.01:
                continue
            if signed_area(ring) > 0:  # counter-clockwise on a north-up plane: reverse
                ring.reverse()
            rings.append([round(v, 2) for p in ring for v in p])

    def fmt(v):
        text = f'{v:.2f}'.rstrip('0').rstrip('.')
        return '0' if text in ('-0', '') else text

    header = """/**
 * Land and country shapes for the globe, as flat [longitude, latitude, ...] rings.
 *
 * Source: Natural Earth 1:110m Admin 0 - Countries (v5.1.2), public domain
 * (https://www.naturalearthdata.com/about/terms-of-use/). Outer rings only, simplified
 * (Ramer-Douglas-Peucker, %s degrees) and wound clockwise for d3-geo.
 * Generated data: regenerate with scripts/gen-world-land.py rather than edit by hand.
 */
export const LAND_RINGS: readonly (readonly number[])[] = [
""" % TOLERANCE
    body = ''.join('  [' + ', '.join(fmt(v) for v in ring) + '],\n' for ring in rings)
    open(target, 'w', encoding='utf-8', newline='\n').write(header + body + '];\n')
    print(f'{len(rings)} rings, {sum(len(r) // 2 for r in rings)} points')


main()
