/* Axis-aligned box colliders on the ground plane, indexed by a uniform spatial
   hash so point and circle queries only look at nearby boxes. Candidates are
   always returned in insertion order, so resolution order matches a plain
   linear scan over `cols`. */

import { clamp } from './util';

export interface Collider {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  on: boolean;
  tag?: string;
}
export type Rect4 = [number, number, number, number];

export const cols: Collider[] = [];

const CELL = 4;
const OFF = 1 << 12;
const grid = new Map<number, number[]>();
const cellKey = (ix: number, iz: number) => (ix + OFF) * (OFF * 2) + (iz + OFF);
const cell = (v: number) => Math.floor(v / CELL);

export function addCol(x0: number, x1: number, z0: number, z1: number, tag?: string): Collider {
  const c: Collider = {
    x0: Math.min(x0, x1),
    x1: Math.max(x0, x1),
    z0: Math.min(z0, z1),
    z1: Math.max(z0, z1),
    on: true,
    tag,
  };
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

/** Is point (x, z) inside any active collider grown by m? */
export function hit(x: number, z: number, m = 0): boolean {
  for (const id of query(x - m, x + m, z - m, z + m)) {
    const c = cols[id];
    if (c.on && x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m) return true;
  }
  return false;
}

/** Does footprint fp overlap any collider (active or not) grown by m? */
export function overlapsAny(fp: Rect4, m = 0): boolean {
  for (const id of query(fp[0] - m, fp[1] + m, fp[2] - m, fp[3] + m)) {
    const c = cols[id];
    if (overlaps(fp, [c.x0, c.x1, c.z0, c.z1], m)) return true;
  }
  return false;
}

/** Push a circle of radius r at (p.x, p.z) out of every active collider. Two passes. */
export function collide(p: { x: number; z: number }, r = 0.32) {
  const M = 2; // slack so boxes reached by an earlier push in the same pass are still candidates
  for (let it = 0; it < 2; it++)
    for (const id of query(p.x - r - M, p.x + r + M, p.z - r - M, p.z + r + M)) {
      const c = cols[id];
      if (!c.on) continue;
      if (p.x < c.x0 - r || p.x > c.x1 + r || p.z < c.z0 - r || p.z > c.z1 + r) continue;
      const qx = clamp(p.x, c.x0, c.x1),
        qz = clamp(p.z, c.z0, c.z1);
      const dx = p.x - qx,
        dz = p.z - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        if (d < r) {
          p.x += (dx / d) * (r - d);
          p.z += (dz / d) * (r - d);
        }
      } else {
        const l = p.x - c.x0,
          rr = c.x1 - p.x,
          t = p.z - c.z0,
          b = c.z1 - p.z;
        const m = Math.min(l, rr, t, b);
        if (m === l) p.x = c.x0 - r;
        else if (m === rr) p.x = c.x1 + r;
        else if (m === t) p.z = c.z0 - r;
        else p.z = c.z1 + r;
      }
    }
}

/** Moving circles (NPC bodies near the player), refilled every frame by the NPC system. */
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
