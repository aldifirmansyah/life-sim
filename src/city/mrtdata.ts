/* MRT lines: stations at their real positions (compressed), and the track path
   built from them. Each station gets a straight stretch of track (its platforms)
   along the average bearing of its neighbours; the track runs straight from one
   station stretch to the next. Everything is elevated in this first version: a
   viaduct with its deck at 8 m, side platforms at 9 m. Underground stations in
   the city come later (see docs/singapore-plan.md, step 4). */
import { toGame, segDist } from './geo';

export const DECK = 8.0; // top of the track bed
export const FLOOR = 9.0; // car floor and platform surface
export const TRACK = 2.1; // each track's centre, either side of the line's centre
export const PLAT_IN = 3.75; // platform edge (the screen doors)
export const PLAT_OUT = 7.75; // platform's outer wall
export const PLAT_LEN = 56; // platform length
export const CAR_LEN = 16;
export const CARS = 3;
/** Stairs down from each platform at the middle of the station: how far out they reach. */
export const STAIR_LEN = 13.5;

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
  id: 'EW' | 'CG';
  name: string;
  colour: string;
  stations: Station[];
  /** Path points and cumulative distances. */
  pts: [number, number][];
  cum: number[];
  length: number;
}

type Raw = [string, string, number, number];
const EW: Raw[] = [
  ['Pasir Ris', 'EW1', 1.373, 103.9493],
  ['Tampines', 'EW2', 1.3544, 103.9453],
  ['Simei', 'EW3', 1.3432, 103.9533],
  ['Tanah Merah', 'EW4', 1.3272, 103.9465],
  ['Bedok', 'EW5', 1.324, 103.93],
  ['Kembangan', 'EW6', 1.321, 103.913],
  ['Eunos', 'EW7', 1.3197, 103.903],
  ['Paya Lebar', 'EW8', 1.3176, 103.8926],
  ['Aljunied', 'EW9', 1.3164, 103.8829],
  ['Kallang', 'EW10', 1.3114, 103.8714],
  ['Lavender', 'EW11', 1.3072, 103.8631],
  ['Bugis', 'EW12', 1.3008, 103.8559],
  ['City Hall', 'EW13', 1.2931, 103.852],
  ['Raffles Place', 'EW14', 1.284, 103.8515],
  ['Tanjong Pagar', 'EW15', 1.2764, 103.8457],
  ['Outram Park', 'EW16', 1.2803, 103.8395],
  ['Tiong Bahru', 'EW17', 1.2862, 103.827],
  ['Redhill', 'EW18', 1.2896, 103.8168],
  ['Queenstown', 'EW19', 1.2945, 103.806],
  ['Commonwealth', 'EW20', 1.3025, 103.7982],
  ['Buona Vista', 'EW21', 1.3072, 103.7903],
  ['Dover', 'EW22', 1.3114, 103.7786],
  ['Clementi', 'EW23', 1.3151, 103.7652],
  ['Jurong East', 'EW24', 1.3331, 103.7422],
  ['Chinese Garden', 'EW25', 1.3423, 103.7326],
  ['Lakeside', 'EW26', 1.3442, 103.721],
  ['Boon Lay', 'EW27', 1.3386, 103.706],
  ['Pioneer', 'EW28', 1.3376, 103.6973],
  ['Joo Koon', 'EW29', 1.3277, 103.6783],
  ['Gul Circle', 'EW30', 1.3195, 103.6606],
  ['Tuas Crescent', 'EW31', 1.321, 103.649],
  ['Tuas West Road', 'EW32', 1.33, 103.6397],
  ['Tuas Link', 'EW33', 1.3404, 103.6368],
];
const CG: Raw[] = [
  ['Tanah Merah', 'CG0', 0, 0], // placed beside the EW platforms below
  ['Expo', 'CG1', 1.3355, 103.9615],
  ['Changi Airport', 'CG2', 1.3574, 103.9884],
];

function build(
  id: Line['id'],
  name: string,
  colour: string,
  raw: Raw[],
  first?: { at: [number, number]; dir: [number, number]; link: number },
): Line {
  const pos = raw.map(([, , la, lo], i) => (i === 0 && first ? first.at : toGame(la, lo)));
  const stations: Station[] = raw.map(([n, code], i) => {
    const a = pos[Math.max(0, i - 1)],
      b = pos[Math.min(pos.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (i === 0 && first)
      return { name: n, code, x: pos[0][0], z: pos[0][1], dx: first.dir[0], dz: first.dir[1], s: 0, link: first.link };
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
  return { id, name, colour, stations, pts, cum, length: cum[cum.length - 1] };
}

export const EWL = build('EW', 'East-West Line', '#009645', EW);
/** The Changi Airport branch starts from its own platforms beside the East-West Line at Tanah Merah. */
const tm = EWL.stations[3];
const toExpo = toGame(1.3355, 103.9615);
// The side of Tanah Merah facing Expo (along the normal q = (−dz, dx)), a platform width further out.
const side = Math.sign(-tm.dz * (toExpo[0] - tm.x) + tm.dx * (toExpo[1] - tm.z)) || 1;
const OFF = PLAT_OUT * 2 + 1.5;
tm.link = side;
// The branch's platforms run parallel, pointing the way the trains leave for Expo.
const ahead = Math.sign(tm.dx * (toExpo[0] - tm.x) + tm.dz * (toExpo[1] - tm.z)) || 1;
export const CGL = build('CG', 'Changi Airport Branch', '#009645', CG, {
  at: [tm.x - tm.dz * side * OFF, tm.z + tm.dx * side * OFF],
  dir: [tm.dx * ahead, tm.dz * ahead],
  link: -side * ahead,
});
export const LINES = [EWL, CGL];

/** Point and unit direction at distance s along a line's path. */
export function along(l: Line, s: number): [number, number, number, number] {
  s = Math.max(0, Math.min(l.length, s));
  let i = 1;
  // Binary search for the segment.
  let lo = 1,
    hi = l.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (l.cum[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  i = lo;
  const [ax, az] = l.pts[i - 1],
    [bx, bz] = l.pts[i];
  const seg = l.cum[i] - l.cum[i - 1] || 1;
  const t = (s - l.cum[i - 1]) / seg;
  return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / seg, (bz - az) / seg];
}

/** Is (x, z) within `margin` of the viaduct (wider round the stations and their stairs)? */
export function nearTrack(x: number, z: number, margin: number) {
  for (const l of LINES) {
    for (const st of l.stations)
      if (Math.hypot(x - st.x, z - st.z) < PLAT_LEN / 2 + PLAT_OUT + STAIR_LEN + margin) return true;
    for (let i = 1; i < l.pts.length; i++)
      if (segDist(x, z, l.pts[i - 1][0], l.pts[i - 1][1], l.pts[i][0], l.pts[i][1]) < 5 + margin) return true;
  }
  return false;
}
