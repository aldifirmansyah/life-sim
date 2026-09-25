/* The MRT's fixed structures: the viaduct (deck, track beds, parapets, pillars)
   and the stations (a wider deck, side platforms with half-height screen doors, a
   canopy, stairs down to the street, name signs). Visuals go into the chunks like
   everything else; the stations' floors and colliders are registered at start-up
   (there are few of them, and the screen-door openings are switched by the
   trains). */
import { addRotCol, type Collider } from '../core/collision';
import { addFloor } from '../core/levels';
import { sign } from '../render/signs';
import { put, putCol, strip } from './gen';
import { LINES, DECK, FLOOR, TRACK, PLAT_IN, PLAT_OUT, PLAT_LEN, STAIR_LEN, type Line, type Station } from './mrtdata';

const CONCRETE = '#c9c5bb',
  BED = '#5d5852',
  TILE = '#d9d5cc',
  CANOPY = '#6d7a80',
  RAIL = '#d4d0c6';

/** Door positions along the platform, from the station's centre (3 cars of 16 m, doors 4 m either side of
    each car's middle). */
export const DOORS = [-20, -12, -4, 4, 12, 20];
export const DOOR_W = 1.5;

/** One side of a station: its screen-door openings and their colliders, switched by the trains. */
export interface PlatformSide {
  line: Line;
  station: Station;
  side: number;
  openings: { x: number; z: number; col: Collider }[];
  open: boolean;
}
export const platformSides: PlatformSide[] = [];

const rot = (dx: number, dz: number) => Math.atan2(-dz, dx);

function buildStation(l: Line, st: Station) {
  const { x, z, dx, dz } = st;
  const qx = -dz,
    qz = dx;
  const ry = rot(dx, dz);
  const P = (u: number, v: number): [number, number] => [x + dx * u + qx * v, z + dz * u + qz * v];
  const box = (
    p: 'solid' | 'glass',
    u: number,
    v: number,
    y0: number,
    len: number,
    w: number,
    h: number,
    c: string,
  ) => {
    const [cx, cz] = P(u, v);
    put({ p, x: cx, y: y0 + h / 2, z: cz, sx: len, sy: h, sz: w, ry, c });
  };
  const col = (u: number, v: number, len: number, w: number, y0: number, y1: number) => {
    const [cx, cz] = P(u, v);
    return addRotCol(cx, cz, len / 2, w / 2, ry, y0, y1);
  };
  // Deck under the whole station, and the piers holding it.
  box('solid', 0, 0, DECK - 0.8, PLAT_LEN + 12, PLAT_OUT * 2 + 0.6, 0.8, CONCRETE);
  for (const u of [-PLAT_LEN / 2 + 4, 0, PLAT_LEN / 2 - 4])
    for (const v of [-4.5, 4.5]) {
      const [cx, cz] = P(u, v);
      put({ p: 'cyl', x: cx, y: (DECK - 0.8) / 2, z: cz, sx: 1.2, sy: DECK - 0.8, sz: 1.2, ry: 0, c: CONCRETE });
      putCol(cx, cz, 1.2, 1.2, 0, -1e9, DECK - 0.8);
    }
  // Track beds through the station.
  for (const v of [-TRACK, TRACK]) box('solid', 0, v, DECK, PLAT_LEN + 12, 2.4, 0.22, BED);
  for (const side of [-1, 1]) {
    const mid = (side * (PLAT_IN + PLAT_OUT)) / 2;
    // The platform and its floor.
    box('solid', 0, mid, DECK, PLAT_LEN, PLAT_OUT - PLAT_IN, FLOOR - DECK, TILE);
    const [fx, fz] = P(0, mid);
    addFloor(fx, fz, PLAT_LEN / 2, (PLAT_OUT - PLAT_IN) / 2, ry, FLOOR);
    // Half-height screen doors along the edge: glass panels between the doorways (fixed), and a collider in
    // each doorway that the trains switch off while their doors are open.
    const edge = side * PLAT_IN;
    const openings: PlatformSide['openings'] = [];
    let u0 = -PLAT_LEN / 2;
    for (const u of [...DOORS, PLAT_LEN / 2 + DOOR_W / 2]) {
      const a = u0,
        b = u - DOOR_W / 2;
      if (b > a) {
        box('glass', (a + b) / 2, edge, FLOOR, b - a, 0.08, 1.6, '#bfe0ea');
        col((a + b) / 2, edge, b - a, 0.2, FLOOR - 0.5, FLOOR + 1.6);
      }
      u0 = u + DOOR_W / 2;
      if (u <= PLAT_LEN / 2) {
        const [ox, oz] = P(u, edge);
        openings.push({ x: ox, z: oz, col: col(u, edge, DOOR_W, 0.2, FLOOR - 0.5, FLOOR + 1.6) });
      }
    }
    platformSides.push({ line: l, station: st, side, openings, open: false });
    // The outer wall, with a gap in the middle for the stairs (or the link to the other line).
    const wall = side * PLAT_OUT;
    const gap = st.link === side ? 8 : 3.4;
    for (const s of [-1, 1]) {
      const a = (s * gap) / 2,
        b = (s * PLAT_LEN) / 2;
      const u = (a + b) / 2,
        len = Math.abs(b - a);
      box('solid', u, wall, FLOOR, len, 0.3, 1.25, RAIL);
      col(u, wall, len, 0.3, FLOOR - 0.5, FLOOR + 3);
    }
    // Ends of the platform.
    for (const s of [-1, 1]) {
      box('solid', (s * PLAT_LEN) / 2, mid, FLOOR, 0.3, PLAT_OUT - PLAT_IN, 1.25, RAIL);
      col((s * PLAT_LEN) / 2, mid, 0.3, PLAT_OUT - PLAT_IN, FLOOR - 0.5, FLOOR + 3);
    }
    // Canopy columns along the outer wall.
    for (const u of [-PLAT_LEN / 2 + 3, -10, 10, PLAT_LEN / 2 - 3]) {
      const [cx, cz] = P(u, wall - side * 0.4);
      put({ p: 'cyl', x: cx, y: FLOOR + 2.2, z: cz, sx: 0.18, sy: 4.4, sz: 0.18, ry: 0, c: '#8a969c' });
      addRotCol(cx, cz, 0.2, 0.2, 0, FLOOR - 0.5, FLOOR + 4.4);
    }
    // Name signs on the wall, facing the tracks.
    const face = Math.atan2(-side * qx, -side * qz);
    for (const u of [-16, 16]) {
      const [sx, sz] = P(u, wall - side * 0.2);
      sign(
        {
          text: st.name,
          sub: `${st.code} · ${l.name}`,
          w: 4.2,
          h: 0.95,
          bg: '#ffffff',
          fg: '#1d1d1b',
          subfg: l.colour,
          border: l.colour,
          font: 'ui',
        },
        sx,
        FLOOR + 2.4,
        sz,
        face,
      );
    }
    if (st.link === side) {
      // A short bridge across to the other line's platform.
      const len = 3.2;
      box('solid', 0, side * (PLAT_OUT + len / 2 - 0.2), DECK, 8, len, FLOOR - DECK, TILE);
      const [bx, bz] = P(0, side * (PLAT_OUT + len / 2 - 0.2));
      addFloor(bx, bz, 4, len / 2 + 0.2, ry, FLOOR);
      continue;
    }
    // Stairs down to the street, straight out from the middle of the platform.
    const sry = rot(qx * side, qz * side);
    const [sx, sz] = P(0, side * (PLAT_OUT + STAIR_LEN / 2));
    const slope = Math.atan2(FLOOR, STAIR_LEN);
    put({
      p: 'solid',
      x: sx,
      y: FLOOR / 2 - 0.25,
      z: sz,
      sx: Math.hypot(STAIR_LEN, FLOOR) + 0.2,
      sy: 0.5,
      sz: 3,
      ry: sry,
      rz: -slope,
      c: '#bdb8ae',
    });
    addFloor(sx, sz, STAIR_LEN / 2, 1.5, sry, FLOOR, 0);
    // Handrails either side of the stairs (blocking only near the stair's own height).
    for (const s of [-1, 1]) {
      const [hx, hz] = P(s * 1.65, side * (PLAT_OUT + STAIR_LEN / 2));
      put({
        p: 'solid',
        x: hx,
        y: FLOOR / 2 + 0.6,
        z: hz,
        sx: Math.hypot(STAIR_LEN, FLOOR),
        sy: 0.1,
        sz: 0.1,
        ry: sry,
        rz: -slope,
        c: RAIL,
      });
      addRotCol(hx, hz, STAIR_LEN / 2, 0.12, sry, 0.8, FLOOR + 1.2);
    }
    // A roof over the stairs.
    put({
      p: 'solid',
      x: sx,
      y: FLOOR / 2 + 3.2,
      z: sz,
      sx: STAIR_LEN + 1,
      sy: 0.25,
      sz: 4,
      ry: sry,
      rz: -slope,
      c: CANOPY,
    });
    // A station sign at the foot of the stairs.
    const [px, pz] = P(2.6, side * (PLAT_OUT + STAIR_LEN + 1));
    put({ p: 'solid', x: px, y: 1.5, z: pz, sx: 0.2, sy: 3, sz: 0.2, ry: 0, c: '#5b6368' });
    sign(
      { text: st.name, sub: st.code, w: 2.2, h: 0.8, bg: l.colour, fg: '#ffffff', border: '#ffffff', font: 'ui' },
      px,
      3.3,
      pz,
      Math.atan2(qx * side, qz * side),
      { both: true },
    );
  }
  // The canopy over both platforms and the tracks.
  box('solid', 0, 0, FLOOR + 4.4, PLAT_LEN + 4, PLAT_OUT * 2 + 1.2, 0.35, CANOPY);
}

function buildLine(l: Line) {
  const q = (i: number) => {
    const [ax, az] = l.pts[i - 1],
      [bx, bz] = l.pts[i];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    return { ax, az, bx, bz, dx: (bx - ax) / len, dz: (bz - az) / len, len };
  };
  for (let i = 1; i < l.pts.length; i++) {
    // Station stretches are segments 2, 4, 6… and are built with the station.
    if (i % 2 === 0 && i / 2 - 1 < l.stations.length) continue;
    const s = q(i);
    const nx = -s.dz,
      nz = s.dx;
    const off = (v: number): [number, number, number, number] => [
      s.ax + nx * v,
      s.az + nz * v,
      s.bx + nx * v,
      s.bz + nz * v,
    ];
    strip('solid', s.ax, s.az, s.bx, s.bz, 9, DECK - 0.8, 0.8, CONCRETE);
    for (const v of [-TRACK, TRACK]) strip('solid', ...off(v), 2.4, DECK, 0.22, BED);
    for (const v of [-4.4, 4.4]) strip('solid', ...off(v), 0.25, DECK, 1.1, RAIL);
    // Pillars every 24 m.
    const n = Math.max(1, Math.round(s.len / 24));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const px = s.ax + (s.bx - s.ax) * t,
        pz = s.az + (s.bz - s.az) * t;
      put({ p: 'cyl', x: px, y: (DECK - 0.8) / 2, z: pz, sx: 1.1, sy: DECK - 0.8, sz: 1.1, ry: 0, c: CONCRETE });
      putCol(px, pz, 1.1, 1.1, 0, -1e9, DECK - 0.8);
    }
  }
  for (const st of l.stations) buildStation(l, st);
}

let built = false;
export function buildMrt() {
  if (built) return;
  built = true;
  for (const l of LINES) buildLine(l);
}
