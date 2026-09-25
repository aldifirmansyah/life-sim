/* Box colliders on the ground plane, indexed by a uniform spatial hash so point
   and circle queries only look at nearby boxes. A collider is axis-aligned
   (x0..x1, z0..z1) or rotated (`rot`: centre, half-sizes and angle; x0..x1 are
   then its bounding box), and spans a height range (y0..y1), so a platform's
   barrier doesn't block the street under it. Candidates come back in insertion
   order, so resolution order is stable. Colliders are never removed: the city
   switches a chunk's colliders off with `on` when it unloads. */

import { clamp } from './util';

export interface Collider {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Height range it blocks (default: everything). */
  y0: number;
  y1: number;
  on: boolean;
  tag?: string;
  /** Rotated box: centre, half-sizes along its own axes, and cos/sin of its angle. */
  rot?: { cx: number; cz: number; hx: number; hz: number; c: number; s: number };
}
export type Rect4 = [number, number, number, number];

export const cols: Collider[] = [];

const CELL = 4;
const OFF = 1 << 14;
const grid = new Map<number, number[]>();
const cellKey = (ix: number, iz: number) => (ix + OFF) * (OFF * 2) + (iz + OFF);
const cell = (v: number) => Math.floor(v / CELL);

function index(c: Collider) {
  const id = cols.push(c) - 1;
  for (let ix = cell(c.x0); ix <= cell(c.x1); ix++)
    for (let iz = cell(c.z0); iz <= cell(c.z1); iz++) {
      const k = cellKey(ix, iz);
      let b = grid.get(k);
      if (!b) grid.set(k, (b = []));
      b.push(id);
    }
  return c;
}

export function addCol(x0: number, x1: number, z0: number, z1: number, tag?: string, y0 = -1e9, y1 = 1e9): Collider {
  return index({
    x0: Math.min(x0, x1),
    x1: Math.max(x0, x1),
    z0: Math.min(z0, z1),
    z1: Math.max(z0, z1),
    y0,
    y1,
    on: true,
    tag,
  });
}

/** A box of half-sizes hx (along its heading) and hz, centred on (cx, cz), turned by `ry` (as a mesh's
    rotation.y), spanning heights y0..y1. */
export function addRotCol(
  cx: number,
  cz: number,
  hx: number,
  hz: number,
  ry: number,
  y0 = -1e9,
  y1 = 1e9,
  tag?: string,
): Collider {
  const c = Math.cos(ry),
    s = Math.sin(ry);
  const ex = Math.abs(c) * hx + Math.abs(s) * hz,
    ez = Math.abs(s) * hx + Math.abs(c) * hz;
  return index({
    x0: cx - ex,
    x1: cx + ex,
    z0: cz - ez,
    z1: cz + ez,
    y0,
    y1,
    on: true,
    tag,
    rot: { cx, cz, hx, hz, c, s },
  });
}

const seen: number[] = [];
let stamp = 0;
const found: number[] = [];
/** Indices of colliders whose cells touch the rect, ascending. The returned array is reused. */
export function query(x0: number, x1: number, z0: number, z1: number): number[] {
  found.length = 0;
  stamp++;
  for (let ix = cell(x0); ix <= cell(x1); ix++)
    for (let iz = cell(z0); iz <= cell(z1); iz++) {
      const b = grid.get(cellKey(ix, iz));
      if (!b) continue;
      for (const id of b)
        if (seen[id] !== stamp) {
          seen[id] = stamp;
          found.push(id);
        }
    }
  return found.sort((a, b) => a - b);
}

export const overlaps = (a: readonly number[], b: readonly number[], m = 0) =>
  a[0] < b[1] + m && a[1] > b[0] - m && a[2] < b[3] + m && a[3] > b[2] - m;

/** Does a body standing at height y (feet) up to y + 1.8 meet this collider's height range? */
const inHeight = (c: Collider, y: number) => c.y1 > y + 0.35 && c.y0 < y + 1.8;

/** Local coordinates of a point in a rotated collider's frame. */
function toLocal(r: NonNullable<Collider['rot']>, x: number, z: number) {
  const dx = x - r.cx,
    dz = z - r.cz;
  // A mesh turned by ry maps local (lx, lz) to (c·lx + s·lz, −s·lx + c·lz).
  return [r.c * dx - r.s * dz, r.s * dx + r.c * dz];
}
function toWorld(r: NonNullable<Collider['rot']>, lx: number, lz: number) {
  return [r.cx + r.c * lx + r.s * lz, r.cz - r.s * lx + r.c * lz];
}

/** Is point (x, z) (at height y) inside any active collider grown by m? */
export function hit(x: number, z: number, m = 0, y = 0): boolean {
  for (const id of query(x - m, x + m, z - m, z + m)) {
    const c = cols[id];
    if (!c.on || !inHeight(c, y)) continue;
    if (c.rot) {
      const [lx, lz] = toLocal(c.rot, x, z);
      if (Math.abs(lx) < c.rot.hx + m && Math.abs(lz) < c.rot.hz + m) return true;
    } else if (x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m) return true;
  }
  return false;
}

/** Does footprint fp overlap any collider (active or not) grown by m? (Bounding boxes.) */
export function overlapsAny(fp: Rect4, m = 0): boolean {
  for (const id of query(fp[0] - m, fp[1] + m, fp[2] - m, fp[3] + m)) {
    const c = cols[id];
    if (overlaps(fp, [c.x0, c.x1, c.z0, c.z1], m)) return true;
  }
  return false;
}

/** Push a circle of radius r at (p.x, p.z), feet at height y, out of every active collider. Two passes. */
export function collide(p: { x: number; z: number }, r = 0.32, y = 0) {
  const M = 2; // slack so boxes reached by an earlier push in the same pass are still candidates
  for (let it = 0; it < 2; it++)
    for (const id of query(p.x - r - M, p.x + r + M, p.z - r - M, p.z + r + M)) {
      const c = cols[id];
      if (!c.on || !inHeight(c, y)) continue;
      if (c.rot) {
        const [lx, lz] = toLocal(c.rot, p.x, p.z);
        const q = { x: lx, z: lz };
        if (pushOut(q, -c.rot.hx, c.rot.hx, -c.rot.hz, c.rot.hz, r)) {
          const [wx, wz] = toWorld(c.rot, q.x, q.z);
          p.x = wx;
          p.z = wz;
        }
      } else pushOut(p, c.x0, c.x1, c.z0, c.z1, r);
    }
}
/** Push a circle out of an axis-aligned box; true when it moved. */
function pushOut(p: { x: number; z: number }, x0: number, x1: number, z0: number, z1: number, r: number) {
  if (p.x < x0 - r || p.x > x1 + r || p.z < z0 - r || p.z > z1 + r) return false;
  const qx = clamp(p.x, x0, x1),
    qz = clamp(p.z, z0, z1);
  const dx = p.x - qx,
    dz = p.z - qz;
  const d2 = dx * dx + dz * dz;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    if (d >= r) return false;
    p.x += (dx / d) * (r - d);
    p.z += (dz / d) * (r - d);
    return true;
  }
  const l = p.x - x0,
    rr = x1 - p.x,
    t = p.z - z0,
    b = z1 - p.z;
  const m = Math.min(l, rr, t, b);
  if (m === l) p.x = x0 - r;
  else if (m === rr) p.x = x1 + r;
  else if (m === t) p.z = z0 - r;
  else p.z = z1 + r;
  return true;
}

/** Moving circles (people near the player), refilled every frame by the crowd system. */
export const circles: { x: number; z: number; r: number }[] = [];

/** Push a circle of radius r out of every moving circle. */
export function collideCircles(p: { x: number; z: number }, r = 0.32) {
  for (const c of circles) {
    const dx = p.x - c.x,
      dz = p.z - c.z,
      d = Math.hypot(dx, dz),
      min = r + c.r;
    if (d < min && d > 1e-6) {
      p.x += (dx / d) * (min - d);
      p.z += (dz / d) * (min - d);
    }
  }
}
