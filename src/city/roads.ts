/* Roads: the expressways and main roads as polylines (real lat/lon, compressed),
   plus a coarse grid of their segments so the generator can keep buildings off
   them and each chunk can draw the pieces that cross it. Town streets are
   generated per town (gen.ts) and added to the same index. Later steps build the
   vehicle graph for buses and taxis on top of these. */
import { toGame, segDist } from './geo';

export interface Road {
  name: string;
  /** Full width in metres. */
  w: number;
  kind: 'expressway' | 'main' | 'street';
  pts: [number, number][];
}
type LL = [number, number];
const R = (name: string, kind: Road['kind'], w: number, pts: LL[]): Road => ({
  name,
  kind,
  w,
  pts: pts.map(([la, lo]) => toGame(la, lo)),
});

export const ROADS: Road[] = [
  R('Pan Island Expressway', 'expressway', 16, [
    [1.338, 103.66],
    [1.345, 103.72],
    [1.341, 103.75],
    [1.331, 103.77],
    [1.329, 103.79],
    [1.326, 103.82],
    [1.329, 103.85],
    [1.331, 103.89],
    [1.335, 103.93],
    [1.345, 103.95],
    [1.35, 103.975],
  ]),
  R('Ayer Rajah Expressway', 'expressway', 16, [
    [1.316, 103.65],
    [1.316, 103.71],
    [1.309, 103.75],
    [1.3, 103.77],
    [1.291, 103.795],
    [1.284, 103.81],
    [1.272, 103.83],
    [1.274, 103.855],
  ]),
  R('East Coast Parkway', 'expressway', 16, [
    [1.279, 103.862],
    [1.294, 103.882],
    [1.302, 103.905],
    [1.307, 103.93],
    [1.313, 103.96],
    [1.33, 103.978],
    [1.346, 103.983],
  ]),
  R('Central Expressway', 'expressway', 14, [
    [1.279, 103.84],
    [1.296, 103.84],
    [1.312, 103.842],
    [1.335, 103.853],
    [1.37, 103.857],
    [1.395, 103.868],
    [1.42, 103.862],
  ]),
  R('Bukit Timah Expressway', 'expressway', 14, [
    [1.372, 103.772],
    [1.4, 103.777],
    [1.44, 103.772],
  ]),
  R('Kranji Expressway', 'expressway', 14, [
    [1.385, 103.74],
    [1.375, 103.765],
  ]),
  R('Seletar Expressway', 'expressway', 14, [
    [1.405, 103.777],
    [1.412, 103.84],
    [1.396, 103.868],
  ]),
  R('Tampines Expressway', 'expressway', 14, [
    [1.396, 103.868],
    [1.39, 103.91],
    [1.375, 103.945],
    [1.36, 103.975],
  ]),
  R('Kallang–Paya Lebar Expressway', 'expressway', 14, [
    [1.3, 103.868],
    [1.331, 103.889],
    [1.37, 103.892],
    [1.39, 103.91],
  ]),
  R('Orchard Road', 'main', 12, [
    [1.3068, 103.8245],
    [1.3042, 103.832],
    [1.3005, 103.841],
    [1.297, 103.848],
  ]),
  R('Clementi Road', 'main', 11, [
    [1.335, 103.771],
    [1.315, 103.769],
    [1.298, 103.771],
    [1.29, 103.774],
  ]),
  R('Commonwealth Avenue West', 'main', 11, [
    [1.317, 103.752],
    [1.3151, 103.7652],
    [1.3114, 103.7786],
    [1.3072, 103.7903],
    [1.3025, 103.7982],
  ]),
  R('South Buona Vista Road', 'main', 10, [
    [1.3072, 103.7903],
    [1.2996, 103.7874],
    [1.2915, 103.787],
    [1.283, 103.785],
  ]),
  R('Science Park Drive', 'main', 9, [
    [1.2935, 103.781],
    [1.2915, 103.787],
    [1.2905, 103.792],
  ]),
  R('Upper Changi Road', 'main', 11, [
    [1.33, 103.915],
    [1.3272, 103.9465],
    [1.3355, 103.9615],
    [1.3574, 103.9884],
  ]),
  R('Tampines Avenue', 'main', 11, [
    [1.335, 103.935],
    [1.3544, 103.9453],
    [1.373, 103.9493],
  ]),
  R('Nicoll Highway', 'main', 12, [
    [1.2931, 103.852],
    [1.3, 103.862],
    [1.3065, 103.873],
  ]),
  R('Serangoon Road', 'main', 10, [
    [1.3, 103.851],
    [1.3066, 103.8493],
    [1.32, 103.858],
    [1.3498, 103.8737],
  ]),
  R('Jurong Gateway Road', 'main', 11, [
    [1.3404, 103.707],
    [1.3331, 103.7422],
    [1.3151, 103.7652],
  ]),
  R('Woodlands Avenue', 'main', 11, [
    [1.4491, 103.8201],
    [1.437, 103.7865],
    [1.3784, 103.7621],
  ]),
  R('Ang Mo Kio Avenue', 'main', 11, [
    [1.351, 103.8485],
    [1.37, 103.8496],
    [1.4295, 103.835],
  ]),
  R('Sentosa Gateway', 'main', 10, [
    [1.2653, 103.822],
    [1.2555, 103.8255],
    [1.2494, 103.8303],
  ]),
];

/* A grid of road segments, 64 m cells. */
interface Seg {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  w: number;
  road: Road;
}
const CELL = 64;
const grid = new Map<string, Seg[]>();
export const allSegs: Seg[] = [];

export function addRoad(r: Road) {
  for (let i = 1; i < r.pts.length; i++) {
    const [ax, az] = r.pts[i - 1],
      [bx, bz] = r.pts[i];
    const s: Seg = { ax, az, bx, bz, w: r.w, road: r };
    allSegs.push(s);
    const m = r.w / 2 + 2;
    for (let ix = Math.floor((Math.min(ax, bx) - m) / CELL); ix <= Math.floor((Math.max(ax, bx) + m) / CELL); ix++)
      for (let iz = Math.floor((Math.min(az, bz) - m) / CELL); iz <= Math.floor((Math.max(az, bz) + m) / CELL); iz++) {
        const k = ix + ',' + iz;
        let b = grid.get(k);
        if (!b) grid.set(k, (b = []));
        b.push(s);
      }
  }
}
for (const r of ROADS) addRoad(r);

/** Segments registered in the cells within `r` of (x, z) (may repeat). */
export function segsNear(x: number, z: number, r = 0): Seg[] {
  if (r <= 0) return grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) ?? [];
  const out: Seg[] = [];
  for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++)
    for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++) {
      const b = grid.get(ix + ',' + iz);
      if (b) out.push(...b);
    }
  return out;
}

/** Is (x, z) within `margin` of any road's edge? */
export function nearRoad(x: number, z: number, margin: number) {
  for (const s of segsNear(x, z, margin)) if (segDist(x, z, s.ax, s.az, s.bx, s.bz) < s.w / 2 + margin) return true;
  return false;
}
/** How close the nearest road is (0 far … 1 on it), for the traffic sound. */
export function roadCloseness(x: number, z: number, range = 40) {
  let best = Infinity;
  for (const s of segsNear(x, z, range)) best = Math.min(best, segDist(x, z, s.ax, s.az, s.bx, s.bz) - s.w / 2);
  return Math.max(0, Math.min(1, 1 - best / range));
}
