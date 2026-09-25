/* MRT lines: stations placed by hand on the island, and the track path built
   from them. Each station gets a straight stretch of track (its platforms)
   along the average bearing of its neighbours; the track runs straight from one
   station stretch to the next. Both lines are elevated for now: the East-West
   Line with its deck at 8 m, the North-South Line higher (15 m) so it crosses
   over. Underground stations in the city come later (docs/singapore-plan.md). */
import { segDist } from './geo';

export const TRACK = 2.1; // each track's centre, either side of the line's centre
export const PLAT_IN = 3.75; // platform edge (the screen doors)
export const PLAT_OUT = 7.75; // platform's outer wall
export const PLAT_LEN = 56; // platform length
export const CAR_LEN = 16;
export const CARS = 3;

export interface Station {
  name: string;
  code: string;
  x: number;
  z: number;
  /** Unit vector along the platforms (direction of increasing distance along the line). */
  dx: number;
  dz: number;
  /** Distance along the line's path of the station's centre. */
  s: number;
  /** The side (+1/−1 of the station's left-hand normal) joined to another line's platform instead of stairs. */
  link?: number;
}
export interface Line {
  id: 'EW' | 'NS';
  name: string;
  colour: string;
  /** Top of the track bed. */
  deck: number;
  /** Car floor and platform surface (deck + 1). */
  floor: number;
  /** How far the stairs from the middle of each platform reach out to the street. */
  stair: number;
  stations: Station[];
  /** Path points and cumulative distances. */
  pts: [number, number][];
  cum: number[];
  length: number;
}

type Raw = [string, string, number, number];
const EW: Raw[] = [
  ['Changi Airport', 'EW1', 1290, 60],
  ['Bedok', 'EW2', 1020, 120],
  ['Paya Lebar', 'EW3', 780, 30],
  ['Kallang', 'EW4', 540, 180],
  ['Bugis', 'EW5', 320, 120],
  ['City Hall', 'EW6', 230, 270],
  ['Raffles Place', 'EW7', 280, 500],
  ['Tanjong Pagar', 'EW8', 180, 600],
  ['Outram Park', 'EW9', 50, 480],
  ['Tiong Bahru', 'EW10', -80, 390],
  ['Queenstown', 'EW11', -260, 300],
  ['Buona Vista', 'EW12', -440, 120],
  ['Dover', 'EW13', -700, 100],
  ['Clementi', 'EW14', -930, 150],
  ['Jurong East', 'EW15', -1260, 40],
];
const NS: Raw[] = [
  ['Woodlands', 'NS1', -700, -760],
  ['Ang Mo Kio', 'NS2', 140, -600],
  ['Toa Payoh', 'NS3', 90, -320],
  ['Novena', 'NS4', 40, -150],
  ['Orchard', 'NS5', -30, 40],
  ['Dhoby Ghaut', 'NS6', 140, 170],
  ['Esplanade', 'NS7', 380, 340],
  ['Marina Bay', 'NS8', 560, 630],
];

function build(id: Line['id'], name: string, colour: string, deck: number, raw: Raw[]): Line {
  const pos = raw.map(([, , x, z]): [number, number] => [x, z]);
  const stations: Station[] = raw.map(([n, code], i) => {
    const a = pos[Math.max(0, i - 1)],
      b = pos[Math.min(pos.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { name: n, code, x: pos[i][0], z: pos[i][1], dx: (b[0] - a[0]) / l, dz: (b[1] - a[1]) / l, s: 0 };
  });
  const pts: [number, number][] = [];
  const half = PLAT_LEN / 2 + 6;
  for (const st of stations) {
    pts.push([st.x - st.dx * half, st.z - st.dz * half]);
    pts.push([st.x + st.dx * half, st.z + st.dz * half]);
  }
  // Run the ends on a little past the last platforms.
  const [a0, a1] = [pts[0], pts[1]];
  pts.unshift([a0[0] - (a1[0] - a0[0]) * 0.3, a0[1] - (a1[1] - a0[1]) * 0.3]);
  const [b0, b1] = [pts[pts.length - 2], pts[pts.length - 1]];
  pts.push([b1[0] + (b1[0] - b0[0]) * 0.3, b1[1] + (b1[1] - b0[1]) * 0.3]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  stations.forEach((st, i) => (st.s = (cum[1 + 2 * i] + cum[2 + 2 * i]) / 2));
  const floor = deck + 1;
  return { id, name, colour, deck, floor, stair: floor * 1.5, stations, pts, cum, length: cum[cum.length - 1] };
}

export const EWL = build('EW', 'East-West Line', '#009645', 8, EW);
export const NSL = build('NS', 'North-South Line', '#d42e12', 15, NS);
export const LINES = [EWL, NSL];

/** Point and unit direction at distance s along a line's path. */
export function along(l: Line, s: number): [number, number, number, number] {
  s = Math.max(0, Math.min(l.length, s));
  let lo = 1,
    hi = l.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (l.cum[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  const i = lo;
  const [ax, az] = l.pts[i - 1],
    [bx, bz] = l.pts[i];
  const seg = l.cum[i] - l.cum[i - 1] || 1;
  const t = (s - l.cum[i - 1]) / seg;
  return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / seg, (bz - az) / seg];
}

/** Is (x, z) within `margin` of a viaduct (wider round the stations and their stairs)? */
export function nearTrack(x: number, z: number, margin: number) {
  for (const l of LINES) {
    for (const st of l.stations)
      if (Math.hypot(x - st.x, z - st.z) < PLAT_LEN / 2 + PLAT_OUT + l.stair + margin) return true;
    for (let i = 1; i < l.pts.length; i++)
      if (segDist(x, z, l.pts[i - 1][0], l.pts[i - 1][1], l.pts[i][0], l.pts[i][1]) < 5 + margin) return true;
  }
  return false;
}
