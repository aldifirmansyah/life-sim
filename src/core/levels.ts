/* Floors above the ground: platforms, stairs and ramps, decks and upper storeys.
   A floor is a box on the ground plane (axis-aligned or turned by `ry`) with a
   walking surface at height y0, or a slope from y0 to y1 along its local x (a
   stair or ramp). The player stands on the highest surface under their feet that
   isn't more than a step above them, or the ground (height 0). Indexed by a
   coarse grid; floors of unloaded chunks are switched off with `on`. */

export interface Floor {
  cx: number;
  cz: number;
  /** Half-sizes along the floor's own x and z. */
  hx: number;
  hz: number;
  c: number;
  s: number;
  /** Surface height at local x = −hx (y0) and x = +hx (y1); equal for a flat floor. */
  y0: number;
  y1: number;
  on: boolean;
}

const floors: Floor[] = [];
const CELL = 16;
const grid = new Map<string, number[]>();

export function addFloor(cx: number, cz: number, hx: number, hz: number, ry: number, y0: number, y1 = y0): Floor {
  const c = Math.cos(ry),
    s = Math.sin(ry);
  const f: Floor = { cx, cz, hx, hz, c, s, y0, y1, on: true };
  const id = floors.push(f) - 1;
  const ex = Math.abs(c) * hx + Math.abs(s) * hz,
    ez = Math.abs(s) * hx + Math.abs(c) * hz;
  for (let ix = Math.floor((cx - ex) / CELL); ix <= Math.floor((cx + ex) / CELL); ix++)
    for (let iz = Math.floor((cz - ez) / CELL); iz <= Math.floor((cz + ez) / CELL); iz++) {
      const k = ix + ',' + iz;
      let b = grid.get(k);
      if (!b) grid.set(k, (b = []));
      b.push(id);
    }
  return f;
}

/** Surface height of a floor at (x, z), or null when the point isn't on it. */
function surface(f: Floor, x: number, z: number): number | null {
  const dx = x - f.cx,
    dz = z - f.cz;
  const lx = f.c * dx - f.s * dz,
    lz = f.s * dx + f.c * dz;
  if (Math.abs(lx) > f.hx || Math.abs(lz) > f.hz) return null;
  return f.y0 + ((lx + f.hx) / (2 * f.hx)) * (f.y1 - f.y0);
}

/** Where feet at height y over (x, z) come to rest: the highest surface at most `step` above y, or 0. */
export function groundAt(x: number, z: number, y: number, step = 0.55): number {
  let best = 0;
  const b = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));
  if (b)
    for (const id of b) {
      const f = floors[id];
      if (!f.on) continue;
      const h = surface(f, x, z);
      if (h !== null && h <= y + step && h > best) best = h;
    }
  return best;
}
