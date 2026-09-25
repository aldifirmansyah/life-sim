/* Roads: the expressways and main roads as polylines (game metres),
   plus a coarse grid of their segments so the generator can keep buildings off
   them and each chunk can draw the pieces that cross it. Town streets are
   generated per town (gen.ts) and added to the same index. Later steps build the
   vehicle graph for buses and taxis on top of these. */
import { segDist } from './geo';

export interface Road {
  name: string;
  /** Full width in metres. */
  w: number;
  kind: 'expressway' | 'main' | 'street';
  pts: [number, number][];
}
type P = [number, number];
const R = (name: string, kind: Road['kind'], w: number, pts: P[]): Road => ({ name, kind, w, pts });

export const ROADS: Road[] = [
  R('Pan Island Expressway', 'expressway', 16, [
    [-1450, -90],
    [-1050, -80],
    [-620, -170],
    [-150, -200],
    [300, -160],
    [700, -110],
    [1000, -60],
    [1200, -60],
  ]),
  R('Ayer Rajah Expressway', 'expressway', 16, [
    [-1440, 250],
    [-1150, 290],
    [-800, 470],
    [-450, 500],
    [-150, 560],
    [120, 640],
    [330, 660],
  ]),
  R('East Coast Parkway', 'expressway', 16, [
    [330, 660],
    [620, 660],
    [900, 560],
    [1150, 460],
    [1330, 300],
    [1370, 160],
  ]),
  R('Central Expressway', 'expressway', 14, [
    [170, 640],
    [150, 430],
    [110, 180],
    [60, -100],
    [40, -450],
    [0, -900],
  ]),
  R('Bukit Timah Expressway', 'expressway', 14, [
    [-620, -170],
    [-700, -500],
    [-760, -900],
  ]),
  R('Kallang–Paya Lebar Expressway', 'expressway', 14, [
    [460, 300],
    [560, -150],
    [680, -560],
    [980, -520],
    [1200, -330],
  ]),
  R('Orchard Road', 'main', 12, [
    [-240, 10],
    [-40, 30],
    [150, 70],
    [240, 150],
  ]),
  R('Clementi Road', 'main', 11, [
    [-900, -80],
    [-890, 120],
    [-870, 470],
  ]),
  R('Commonwealth Avenue West', 'main', 11, [
    [-1250, 90],
    [-950, 90],
    [-700, 80],
    [-440, 90],
    [-280, 160],
  ]),
  R('South Buona Vista Road', 'main', 10, [
    [-440, 90],
    [-520, 230],
    [-620, 420],
    [-700, 500],
  ]),
  R('Science Park Drive', 'main', 9, [
    [-700, 290],
    [-600, 330],
    [-520, 380],
  ]),
  R('Nicoll Highway', 'main', 12, [
    [240, 290],
    [400, 270],
    [520, 250],
  ]),
  R('Serangoon Road', 'main', 10, [
    [240, 150],
    [180, -60],
    [150, -330],
  ]),
  R('Upper Changi Road', 'main', 11, [
    [780, 40],
    [1030, 170],
    [1230, 60],
  ]),
  R('Tampines Avenue', 'main', 11, [
    [1030, 170],
    [1060, -220],
    [1220, -440],
  ]),
  R('Ang Mo Kio Avenue', 'main', 11, [
    [90, -330],
    [150, -640],
    [650, -680],
  ]),
  R('Woodlands Avenue', 'main', 11, [
    [-720, -800],
    [-380, -760],
    [150, -640],
  ]),
  R('Marina Boulevard', 'main', 10, [
    [300, 600],
    [520, 640],
    [620, 520],
    [560, 400],
  ]),
  R('Sentosa Gateway', 'main', 10, [
    [-60, 650],
    [20, 720],
    [80, 800],
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
