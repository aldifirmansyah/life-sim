/* Inside Mbah Minah's house (Rumah Raka), real size: the 7 × 6.2 m shell from
   world/houses.ts split into a ruang tamu at the front, the kamar and the dapur
   behind it, and a kamar mandi in the dapur's back corner.
   Two prop sets: the shell and the furniture that is always there (with the
   colliders), and the state of each room, rebuilt whenever a room is restored:
   dust sheets, stains and an old rusty stove until Pak Karyo has been, then
   cushions, curtains, a proper desk and bed, and the things Raka found of Mbah
   Minah's. Where things stand is in interiors/rakalayout.ts; what they do is in
   interiors/rakahome.ts. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { mat, type Batch } from '../render/batch';
import { rakaHouse } from '../world/landmarks';
import { addCol } from '../core/collision';
import { interactables } from '../game/interact';
import { hasRoom, onHouseChange } from '../game/house';
import { Door } from './door';
import { interiors, roomL, type Interior } from './interior';
import * as L from './rakalayout';

export const NAME = 'Rumah Raka';
const { IX, IZ, FL, CE, PZ, PX, MX, MZ } = L;

const WOOD = '#7a5230',
  WOOD_D = '#5e3d22',
  SHEET = '#e6e0d2',
  INNER = '#dfe8dc';

/** Drawing helpers for a prop set, in the house's local frame. */
function kit(set: PropSet) {
  const h = rakaHouse;
  /** Box (or cylinder, cone…) by local centre and size; optional tilt about local x and z. */
  const P = (
    lx: number,
    y: number,
    lz: number,
    sx: number,
    sy: number,
    sz: number,
    c: string,
    b: Batch = set.solid,
    ry = 0,
    rx = 0,
    rz = 0,
  ) => {
    const [x, z] = h.F(lx, lz);
    b.add(mat(x, y, z, sx, sy, sz, h.th + ry, rx, rz), c);
  };
  /** Box by local extents, optionally solid to walk into. */
  const W = (lx0: number, lx1: number, lz0: number, lz1: number, y0: number, y1: number, c: string, col = true) => {
    const a = h.F(lx0, lz0),
      b = h.F(lx1, lz1);
    set.box(Math.min(a[0], b[0]), Math.max(a[0], b[0]), y0, y1, Math.min(a[1], b[1]), Math.max(a[1], b[1]), c, {
      col,
    });
  };
  /** A collider with nothing drawn (furniture made of several parts). */
  const colOnly = (lx0: number, lx1: number, lz0: number, lz1: number) => {
    const a = h.F(lx0, lz0),
      b = h.F(lx1, lz1);
    const c = addCol(a[0], b[0], a[1], b[1]);
    c.on = false;
    set.cols.push(c);
  };
  /** Four legs under a top (x0..x1, z0..z1) of height top. */
  const legs = (x0: number, x1: number, z0: number, z1: number, top: number, c = WOOD_D, t = 0.045) => {
    for (const x of [x0 + t / 2 + 0.02, x1 - t / 2 - 0.02])
      for (const z of [z0 + t / 2 + 0.02, z1 - t / 2 - 0.02]) P(x, FL + top / 2, z, t, top, t, c);
  };
  /** A flat patch on the floor (dust, a rug) or a stain on the plafon. */
  const floorPatch = (x: number, z: number, w: number, d: number, c: string, ry = 0) =>
    P(x, FL + 0.003, z, w, 0.004, d, c, set.solid, ry);
  const ceilPatch = (x: number, z: number, r: number, c: string) => P(x, CE - 0.012, z, r, 0.004, r, c, set.cyl);
  return { P, W, colOnly, legs, floorPatch, ceilPatch };
}

/* ================= the shell and what's always there ================= */

function buildShell(set: PropSet) {
  const h = rakaHouse;
  const { P, W, colOnly, legs } = kit(set);

  /* Floor: old cream tegel in a soft check, small green tiles in the kamar mandi. */
  const S = 0.5;
  for (let x = -IX; x < IX - 1e-3; x += S)
    for (let z = -IZ; z < IZ - 1e-3; z += S) {
      const x1 = Math.min(IX, x + S),
        z1 = Math.min(IZ, z + S);
      const cx = (x + x1) / 2,
        cz = (z + z1) / 2;
      if (cx > MX && cz < MZ) continue;
      const odd = (Math.round((x + IX) / S) + Math.round((z + IZ) / S)) % 2;
      P(cx, FL / 2, cz, x1 - x - 0.008, FL, z1 - z - 0.008, odd ? '#d6c9ae' : '#cbbd9f');
    }
  P(0, FL / 2 - 0.004, 0, IX * 2, FL - 0.008, IZ * 2, '#8f846d');
  for (let x = MX; x < IX - 1e-3; x += 0.25)
    for (let z = -IZ; z < MZ - 1e-3; z += 0.25) {
      const x1 = Math.min(IX, x + 0.25),
        z1 = Math.min(MZ, z + 0.25);
      P((x + x1) / 2, FL / 2 - 0.02, (z + z1) / 2, x1 - x - 0.01, FL, z1 - z - 0.01, '#8fb3ad');
    }
  // The threshold stone under the door.
  P(h.dx, FL / 2, h.fz - 0.06, 1.0, FL, 0.13, '#8a7f6c');

  /* Ceiling: plafon boards with strips. */
  P(0, CE + 0.015, 0, IX * 2, 0.03, IZ * 2, '#f1ece0');
  for (let x = -IX + 1.2; x < IX; x += 1.2) P(x, CE - 0.01, 0, 0.05, 0.02, IZ * 2, '#d8d0bf');
  for (let z = -IZ + 1.2; z < IZ; z += 1.2) P(0, CE - 0.01, z, IX * 2, 0.02, 0.05, '#d8d0bf');

  /* Partitions (plastered, painted lighter inside), full height, with doorways. */
  const T = 0.1;
  const along = (lz: number, a: number, b: number, holes: { c: number; w: number; top: number }[]) => {
    let x = a;
    for (const o of [...holes].sort((p, q) => p.c - q.c)) {
      const x0 = o.c - o.w / 2,
        x1 = o.c + o.w / 2;
      if (x0 > x) W(x, x0, lz - T / 2, lz + T / 2, FL, CE, INNER);
      W(x0, x1, lz - T / 2, lz + T / 2, o.top, CE, INNER, false);
      for (const e of [x0, x1]) P(e, (FL + o.top) / 2, lz, 0.06, o.top - FL, T + 0.04, '#7a5a3a');
      P(o.c, o.top + 0.03, lz, o.w + 0.12, 0.06, T + 0.04, '#7a5a3a');
      x = x1;
    }
    if (b > x) W(x, b, lz - T / 2, lz + T / 2, FL, CE, INNER);
  };
  const across = (lx: number, a: number, b: number) => W(lx - T / 2, lx + T / 2, a, b, FL, CE, INNER);
  along(PZ, -IX, IX, [
    { c: L.KAMAR_DOOR, w: 0.8, top: 2.08 },
    { c: L.DAPUR_DOOR, w: 0.9, top: 2.12 },
  ]);
  across(PX, -IZ, PZ - T / 2);
  // Kamar mandi: tiled to shoulder height inside.
  across(MX, -IZ, MZ - T / 2);
  along(MZ, MX + T / 2, IX, [{ c: L.MANDI_DOOR, w: 0.7, top: 2.0 }]);
  const tile = '#a9c8c2';
  P(MX + 0.06, 0.8, (MZ - IZ) / 2 - 0.02, 0.02, 1.4, IZ + MZ - 0.1, tile);
  P((MX + IX) / 2, 0.8, -IZ + 0.015, IX - MX, 1.4, 0.012, tile);
  P(IX - 0.015, 0.8, (MZ - IZ) / 2, 0.012, 1.4, IZ + MZ, tile);
  for (const [a, b] of [
    [MX + T / 2, L.MANDI_DOOR - 0.35],
    [L.MANDI_DOOR + 0.35, IX],
  ])
    P((a + b) / 2, 0.8, MZ - T / 2 - 0.006, b - a, 1.4, 0.012, tile);

  /* Paint on the inside of the outer walls, around the door and windows. */
  const Lw = 0.006;
  P(0, (FL + CE) / 2, -IZ + Lw, IX * 2, CE - FL, 0.01, INNER);
  for (const sx of [-1, 1]) P(sx * (IX - Lw), (FL + CE) / 2, 0, 0.01, CE - FL, IZ * 2, INNER);
  const holes = windowSlots().map(x =>
    Math.abs(x - h.dx) < 0.01
      ? { x0: x - 0.5, x1: x + 0.5, y0: FL, y1: 2.2 }
      : { x0: x - 0.55, x1: x + 0.55, y0: 1.06, y1: 2.04 },
  );
  let hx = -IX;
  for (const o of holes) {
    if (o.x0 > hx) P((hx + o.x0) / 2, (FL + CE) / 2, IZ - Lw, o.x0 - hx, CE - FL, 0.01, INNER);
    if (o.y0 > FL) P((o.x0 + o.x1) / 2, (FL + o.y0) / 2, IZ - Lw, o.x1 - o.x0, o.y0 - FL, 0.01, INNER);
    P((o.x0 + o.x1) / 2, (o.y1 + CE) / 2, IZ - Lw, o.x1 - o.x0, CE - o.y1, 0.01, INNER);
    hx = o.x1;
  }
  if (IX > hx) P((hx + IX) / 2, (FL + CE) / 2, IZ - Lw, IX - hx, CE - FL, 0.01, INNER);

  /* Skirting along the outer walls. */
  const sk = '#6f7d72';
  P(0, FL + 0.05, -IZ + 0.01, IX * 2, 0.1, 0.02, sk);
  for (const sx of [-1, 1]) P(sx * (IX - 0.01), FL + 0.05, 0, 0.02, 0.1, IZ * 2, sk);
  for (const [a, b] of [
    [-IX, h.dx - 0.5],
    [h.dx + 0.5, IX],
  ])
    if (b > a) P((a + b) / 2, FL + 0.05, IZ - 0.01, b - a, 0.1, 0.02, sk);

  /* A batik curtain drawn aside in the kamar doorway, on a rod. */
  P(L.KAMAR_DOOR, 2.06, PZ + 0.09, 0.95, 0.025, 0.025, '#5a3e28');
  P(L.KAMAR_DOOR - 0.3, 1.12, PZ + 0.09, 0.26, 1.88, 0.03, '#8a3b3b', set.cloth);
  P(L.KAMAR_DOOR - 0.3, 1.5, PZ + 0.1, 0.27, 0.12, 0.035, '#d9a441', set.cloth);

  /* The lamp: a cord and an enamel shade over the front room. */
  P(L.LAMP[0], CE - 0.2, L.LAMP[1], 0.01, 0.4, 0.01, '#2a2a2a', set.cyl);
  P(L.LAMP[0], CE - 0.42, L.LAMP[1], 0.2, 0.1, 0.2, '#e6e2d6', set.cone);

  /* ---- Ruang tamu ---- */
  // A three-seat sofa (an old olive velvet one), a coffee table, the TV cabinet facing them.
  const sf = L.SOFA;
  const sx0 = sf.x - sf.w / 2,
    sx1 = sf.x + sf.w / 2,
    sz0 = sf.z - sf.d / 2,
    sz1 = sf.z + sf.d / 2;
  const velvet = '#6b7f5a',
    velvetD = '#56684a';
  P(sf.x, FL + 0.2, sf.z, sf.w, 0.2, sf.d, velvetD);
  for (const o of sf.seats) P(sf.x + o, L.SEAT_Y - 0.07, sf.z + 0.07, 0.56, 0.14, sf.d - 0.24, velvet);
  P(sf.x, FL + 0.66, sz0 + 0.1, sf.w, 0.46, 0.2, velvetD);
  for (const o of sf.seats) P(sf.x + o, FL + 0.66, sz0 + 0.24, 0.54, 0.4, 0.1, velvet, set.solid, 0, -0.12);
  for (const e of [-1, 1]) P(sf.x + e * (sf.w / 2 - 0.08), FL + 0.45, sf.z, 0.16, 0.34, sf.d, velvetD);
  for (const x of [sx0 + 0.06, sx1 - 0.06])
    for (const z of [sz0 + 0.06, sz1 - 0.06]) P(x, FL + 0.05, z, 0.05, 0.1, 0.05, WOOD_D);
  colOnly(sx0, sx1, sz0, sz1);
  const t = L.TABLE;
  P(t.x, FL + t.h - 0.02, t.z, t.w, 0.04, t.d, WOOD);
  P(t.x, FL + 0.12, t.z, t.w - 0.12, 0.02, t.d - 0.1, WOOD_D);
  legs(t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2, t.h - 0.04);
  colOnly(t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2);
  const tc = L.TV_CABINET;
  W(tc.x - tc.w / 2, tc.x + tc.w / 2, tc.z - tc.d / 2, tc.z + tc.d / 2, FL + 0.06, FL + tc.h, WOOD);
  for (const o of [-0.27, 0.27]) P(tc.x + o, FL + 0.28, tc.z - tc.d / 2 - 0.005, 0.5, 0.36, 0.01, WOOD_D);
  legs(tc.x - tc.w / 2, tc.x + tc.w / 2, tc.z - tc.d / 2, tc.z + tc.d / 2, 0.06);
  // The bufet against the right wall, with the radio on it.
  const bf = L.BUFET;
  const bx0 = bf.x - bf.w / 2;
  W(bx0, bf.x + bf.w / 2, bf.z - bf.d / 2, bf.z + bf.d / 2, FL + 0.08, FL + bf.h, WOOD);
  P(bx0 - 0.005, FL + 0.45, bf.z, 0.01, 0.62, bf.d - 0.08, WOOD_D);
  P(bx0 - 0.012, FL + 0.45, bf.z, 0.01, 0.62, 0.012, '#3a2616');
  for (const o of [-0.08, 0.08]) P(bx0 - 0.03, FL + 0.5, bf.z + o, 0.02, 0.05, 0.02, '#c9a44a');
  legs(bx0, bf.x + bf.w / 2, bf.z - bf.d / 2, bf.z + bf.d / 2, 0.08);
  const [rx, ry, rz] = L.RADIO;
  P(rx, ry, rz, 0.16, 0.14, 0.3, '#7a4a2a');
  P(rx - 0.081, ry, rz - 0.05, 0.005, 0.1, 0.14, '#2a2420');
  P(rx - 0.082, ry + 0.02, rz + 0.08, 0.005, 0.04, 0.08, '#e8d9a8');
  for (const o of [0.1, 0.05]) P(rx - 0.085, ry - 0.035, rz + o, 0.012, 0.012, 0.012, '#c9c4b8', set.cyl);
  P(rx, ry + 0.25, rz + 0.1, 0.004, 0.4, 0.004, '#bdbdbd', set.cyl, 0, 0.35);
  // A wall clock above the sofa, and the calendar by the door (a toko emas one, of course).
  P(sf.x, 2.25, PZ + 0.06, 0.16, 0.02, 0.16, '#f4efe2', set.cyl, 0, Math.PI / 2);
  P(sf.x, 2.25, PZ + 0.075, 0.012, 0.1, 0.004, '#222');
  P(sf.x + 0.03, 2.26, PZ + 0.075, 0.07, 0.01, 0.004, '#222', set.solid, 0, 0, 0.6);
  const [cx, cy, cz] = L.CALENDAR;
  P(cx, cy, cz, 0.01, 0.55, 0.4, '#f4f1ea');
  P(cx + 0.003, cy + 0.2, cz, 0.012, 0.12, 0.4, '#c23a2e');
  P(cx + 0.004, cy - 0.06, cz, 0.012, 0.3, 0.32, '#e8e2d2');

  /* ---- Kamar ---- */
  const bd = L.BED;
  const bcx = (bd.x0 + bd.x1) / 2,
    bcz = (bd.z0 + bd.z1) / 2;
  P(bcx, FL + 0.3, bcz, bd.x1 - bd.x0, 0.08, bd.z1 - bd.z0, WOOD);
  P(bcx, FL + 0.55, bd.z0 + 0.04, bd.x1 - bd.x0, 1.1, 0.06, WOOD);
  P(bcx, FL + 0.3, bd.z1 - 0.03, bd.x1 - bd.x0, 0.5, 0.06, WOOD);
  legs(bd.x0, bd.x1, bd.z0, bd.z1, 0.3);
  colOnly(bd.x0, bd.x1, bd.z0, bd.z1);
  const [nx, nz] = L.NIGHTSTAND;
  W(nx - 0.2, nx + 0.2, nz - 0.2, nz + 0.2, FL, FL + 0.55, WOOD);
  P(nx + 0.201, FL + 0.4, nz, 0.005, 0.14, 0.3, WOOD_D);
  const lm = L.LEMARI;
  W(lm.x0, lm.x1, lm.z0, lm.z1, FL, FL + lm.h, '#6b4a2f');
  P(lm.x0 - 0.005, FL + lm.h / 2 + 0.05, (lm.z0 + lm.z1) / 2, 0.01, lm.h - 0.25, 0.012, '#3a2616');
  for (const o of [-0.05, 0.05]) P(lm.x0 - 0.02, FL + 1.0, (lm.z0 + lm.z1) / 2 + o, 0.02, 0.08, 0.02, '#c9a44a');

  /* ---- Dapur ---- */
  const ct = L.COUNTER;
  const bay0 = L.STOVE[0] - 0.36,
    bay1 = L.STOVE[0] + 0.36;
  // Brick-and-plaster base with an open bay for the gas bottle, a tiled top.
  W(ct.x0, bay0, ct.z0, ct.z1, FL, FL + ct.h - 0.05, '#cfc6b4', false);
  W(bay1, ct.x1, ct.z0, ct.z1, FL, FL + ct.h - 0.05, '#cfc6b4', false);
  P((ct.x0 + ct.x1) / 2, FL + ct.h - 0.025, (ct.z0 + ct.z1) / 2, ct.x1 - ct.x0, 0.05, ct.z1 - ct.z0, '#e9e6de');
  colOnly(ct.x0, ct.x1, ct.z0, ct.z1);
  // The gas bottle ("tabung melon") under the stove, and its hose.
  const [sx, sz] = L.STOVE;
  P(sx, FL + 0.22, sz + 0.05, 0.13, 0.36, 0.13, '#5aa84a', set.cyl);
  P(sx, FL + 0.43, sz + 0.05, 0.04, 0.06, 0.04, '#c9c4b8', set.cyl);
  P(sx + 0.05, FL + 0.6, sz + 0.12, 0.012, 0.35, 0.012, '#2a2a2a', set.cyl, 0, 0, 0.3);
  // Rice cooker.
  const [rcx, rcz] = L.RICE_COOKER;
  P(rcx, FL + ct.h + 0.11, rcz, 0.14, 0.2, 0.14, '#f2efe8', set.cyl);
  P(rcx, FL + ct.h + 0.22, rcz, 0.13, 0.04, 0.13, '#e05a8a', set.cyl);
  P(rcx - 0.14, FL + ct.h + 0.08, rcz, 0.02, 0.03, 0.05, '#e8a33a');
  // The small table with a tudung saji, two plastic stools.
  const dn = L.DINING;
  P(dn.x, FL + dn.h - 0.02, dn.z, dn.w, 0.04, dn.d, '#8a6a4a');
  legs(dn.x - dn.w / 2, dn.x + dn.w / 2, dn.z - dn.d / 2, dn.z + dn.d / 2, dn.h - 0.04);
  colOnly(dn.x - dn.w / 2, dn.x + dn.w / 2, dn.z - dn.d / 2, dn.z + dn.d / 2);
  P(dn.x, FL + dn.h + 0.11, dn.z, 0.26, 0.2, 0.26, '#c9a15a', set.cone);
  P(dn.x, FL + dn.h + 0.02, dn.z, 0.27, 0.02, 0.27, '#b88a45', set.cyl);
  for (const [o, c] of [
    [0.55, '#d8392a'],
    [-0.55, '#3b7dd8'],
  ] as const) {
    P(dn.x, FL + 0.2, dn.z + o, 0.15, 0.4, 0.15, c, set.cyl);
    colOnly(dn.x - 0.16, dn.x + 0.16, dn.z + o - 0.16, dn.z + o + 0.16);
  }

  /* ---- Kamar mandi ---- */
  const bk = L.BAK;
  W(bk.x0, bk.x1, bk.z0, bk.z1, FL - 0.02, FL + bk.h, '#8fb8b0');
  P(
    (bk.x0 + bk.x1) / 2,
    FL + bk.h + 0.005,
    (bk.z0 + bk.z1) / 2,
    bk.x1 - bk.x0 - 0.1,
    0.012,
    bk.z1 - bk.z0 - 0.1,
    '#4a86a8',
  );
  // The gayung on the rim.
  P(bk.x0 + 0.12, FL + bk.h + 0.06, bk.z1 - 0.12, 0.07, 0.1, 0.07, '#3b7dd8', set.cyl);
  P(bk.x0 + 0.02, FL + bk.h + 0.07, bk.z1 - 0.12, 0.16, 0.025, 0.025, '#3b7dd8');
  // Squat toilet, a bucket, a soap shelf and a small mirror.
  const [kx, kz] = L.KLOSET;
  P(kx, FL + 0.02, kz, 0.42, 0.04, 0.6, '#f4f2ec');
  P(kx, FL + 0.035, kz - 0.06, 0.13, 0.02, 0.2, '#6a7a78', set.cyl);
  P(2.25, FL + 0.14, -1.8, 0.13, 0.28, 0.13, '#e8b83a', set.cyl);
  P(MX + 0.1, 1.2, -2.3, 0.12, 0.02, 0.3, '#f4f2ec');
  P(MX + 0.08, 1.24, -2.25, 0.05, 0.04, 0.08, '#e86aa0');
  P(MX + 0.07, 1.65, -2.3, 0.01, 0.4, 0.3, '#b9d4dc');
}

/** The window positions along the front wall (world/houses.ts places them the same way). */
function windowSlots() {
  const w = rakaHouse.w;
  return w >= 5.8 ? [-w * 0.3, 0, w * 0.3] : [-w * 0.22, w * 0.22];
}

/* ================= each room's state ================= */

let stateSet: PropSet | null = null;

/** Neglected rooms (dust sheets, stains, an old stove) or restored ones, and the things found in them. */
function buildState() {
  const set = new PropSet('rumah-keadaan');
  const { P, legs, floorPatch, ceilPatch } = kit(set);
  const done = (id: string) => hasRoom(id);

  /* Ruang tamu. */
  const t = L.TABLE,
    sf = L.SOFA,
    tc = L.TV_CABINET;
  const tvTop = FL + tc.h;
  if (!done('ruangtamu')) {
    // Dust sheets over the sofa (seat and back, close to the shape) and the coffee table.
    P(sf.x, L.SEAT_Y + 0.012, sf.z + 0.05, sf.w + 0.04, 0.02, sf.d - 0.1, SHEET, set.cloth);
    P(sf.x, (FL + L.SEAT_Y) / 2, sf.z + sf.d / 2 + 0.01, sf.w + 0.04, L.SEAT_Y - FL - 0.04, 0.02, SHEET, set.cloth);
    P(sf.x, FL + 0.9, sf.z - sf.d / 2 + 0.16, sf.w + 0.04, 0.02, 0.34, SHEET, set.cloth);
    P(
      sf.x,
      (L.SEAT_Y + FL + 0.9) / 2,
      sf.z - sf.d / 2 + 0.32,
      sf.w + 0.04,
      FL + 0.9 - L.SEAT_Y,
      0.02,
      SHEET,
      set.cloth,
    );
    for (const e of [-1, 1]) P(sf.x + e * (sf.w / 2 - 0.08), FL + 0.44, sf.z, 0.2, 0.38, sf.d + 0.03, SHEET, set.cloth);
    P(sf.x - 0.4, L.SEAT_Y + 0.03, sf.z + 0.1, 0.5, 0.03, 0.35, '#d8d1c0', set.cloth, 0.3);
    P(t.x, FL + t.h + 0.012, t.z, t.w + 0.08, 0.02, t.d + 0.08, SHEET, set.cloth);
    // An old box TV with a crocheted doily on top.
    P(tc.x, tvTop + 0.21, tc.z + 0.02, 0.6, 0.42, 0.42, '#3a3834');
    P(tc.x, tvTop + 0.2, tc.z - 0.2, 0.46, 0.34, 0.01, '#20262a');
    P(tc.x, tvTop + 0.425, tc.z + 0.02, 0.4, 0.006, 0.3, '#f4efe4', set.cloth);
    for (const [x, z, w, d, r] of [
      [1.2, 1.3, 0.9, 0.6, 0.3],
      [-2.4, 1.6, 0.7, 0.5, -0.4],
      [0.9, 2.3, 0.5, 0.4, 0.8],
    ])
      floorPatch(x, z, w, d, '#b9ae95', r);
    // Peeling paint by the window and a cobweb in the corner.
    P(1.0, 1.9, IZ - 0.012, 0.35, 0.5, 0.004, '#c6cfbf');
    P(IX - 0.1, CE - 0.1, IZ - 0.1, 0.25, 0.004, 0.25, '#f2f2f2', set.cloth, Math.PI / 4, 0.5);
  } else {
    // Batik throw pillows, a crocheted cover on the back, a lace taplak with a jar of kue kering, a rug, a flat TV.
    for (const [o, c] of [
      [-0.72, '#b0503a'],
      [0.72, '#d9a441'],
    ] as const)
      P(sf.x + o, L.SEAT_Y + 0.2, sf.z - 0.12, 0.34, 0.34, 0.12, c, set.solid, 0, -0.3);
    P(sf.x, FL + 0.9, sf.z - sf.d / 2 + 0.1, 0.7, 0.015, 0.26, '#f4efe4', set.cloth);
    P(t.x, FL + t.h + 0.003, t.z, t.w - 0.1, 0.004, t.d + 0.1, '#f4efe4', set.cloth);
    P(t.x - 0.25, FL + t.h + 0.08, t.z, 0.07, 0.15, 0.07, '#d8e8e8', set.cyl);
    P(t.x - 0.25, FL + t.h + 0.165, t.z, 0.075, 0.02, 0.075, '#d8392a', set.cyl);
    P(t.x + 0.25, FL + t.h + 0.08, t.z - 0.05, 0.05, 0.15, 0.05, '#e8e2d2', set.cyl);
    for (const [o, c] of [
      [-0.04, '#e24a3b'],
      [0.04, '#f2c14e'],
    ] as const)
      P(t.x + 0.25 + o, FL + t.h + 0.2, t.z - 0.05, 0.05, 0.05, 0.05, c, set.cone);
    P(tc.x, tvTop + 0.02, tc.z + 0.05, 0.3, 0.04, 0.16, '#222326');
    P(tc.x, tvTop + 0.12, tc.z + 0.05, 0.06, 0.18, 0.04, '#222326');
    P(tc.x, tvTop + 0.42, tc.z + 0.05, 0.86, 0.5, 0.04, '#1a1b1e');
    floorPatch(t.x, t.z - 0.15, 2.2, 1.2, '#8a4a3a');
    floorPatch(t.x, t.z - 0.15, 2.0, 1.0, '#a8664a');
    // Curtains in the front windows, tied back.
    for (const wx of windowSlots())
      if (Math.abs(wx - rakaHouse.dx) > 0.01) {
        P(wx, 2.14, IZ - 0.06, 1.3, 0.02, 0.02, '#5a3e28');
        for (const s of [-1, 1]) P(wx + s * 0.55, 1.5, IZ - 0.07, 0.24, 1.2, 0.02, '#e8c9a0', set.cloth);
      }
    // The 17 Agustus photo on the wall above the bufet.
    const b = L.BUFET;
    P(IX - 0.02, 1.75, b.z, 0.03, 0.42, 0.55, '#3a2616');
    P(IX - 0.037, 1.75, b.z, 0.004, 0.34, 0.47, '#b8a07a');
    P(IX - 0.04, 1.7, b.z + 0.1, 0.004, 0.08, 0.05, '#d8392a');
  }

  /* Meja kerja: an old folding table and a plastic stool, or a real desk with a lamp and a chair. */
  const dk = L.DESK,
    dc = L.DESK_CHAIR;
  const top = done('meja') ? dk.h : 0.72;
  if (!done('meja')) {
    P(dk.x, FL + top - 0.015, dk.z + 0.02, 0.9, 0.03, 0.5, '#a88a62');
    legs(dk.x - 0.45, dk.x + 0.45, dk.z - 0.23, dk.z + 0.27, top - 0.03, '#8a8a8a', 0.03);
    P(dc.x, FL + 0.2, dc.z, 0.16, 0.4, 0.16, '#d8392a', set.cyl);
    P(dc.x, FL + 0.41, dc.z, 0.17, 0.02, 0.17, '#e04a3a', set.cyl);
    for (let i = 0; i < 5; i++) P(1.62, FL + 0.03 + i * 0.03, 2.75, 0.4, 0.028, 0.3, i % 2 ? '#e8e4da' : '#d8d2c2');
  } else {
    P(dk.x, FL + top - 0.02, dk.z, dk.w, 0.04, dk.d, WOOD);
    P(dk.x + dk.w / 2 - 0.22, FL + (top - 0.04) / 2, dk.z, 0.42, top - 0.04, dk.d - 0.04, WOOD);
    for (const y of [0.25, 0.5]) P(dk.x + dk.w / 2 - 0.22, FL + y, dk.z - dk.d / 2 + 0.01, 0.36, 0.2, 0.01, WOOD_D);
    legs(dk.x - dk.w / 2, dk.x - dk.w / 2 + 0.1, dk.z - dk.d / 2, dk.z + dk.d / 2, top - 0.04);
    // Desk lamp.
    P(dk.x - 0.45, FL + top + 0.01, dk.z + 0.15, 0.07, 0.02, 0.07, '#2f6b4a', set.cyl);
    P(dk.x - 0.45, FL + top + 0.2, dk.z + 0.15, 0.012, 0.38, 0.012, '#2f6b4a', set.cyl);
    P(dk.x - 0.45, FL + top + 0.38, dk.z + 0.08, 0.09, 0.1, 0.09, '#2f6b4a', set.cone);
    // Chair with a back.
    P(dc.x, FL + 0.44, dc.z, 0.44, 0.04, 0.42, WOOD);
    P(dc.x, FL + 0.72, dc.z - 0.2, 0.42, 0.5, 0.04, WOOD);
    legs(dc.x - 0.21, dc.x + 0.21, dc.z - 0.2, dc.z + 0.2, 0.42);
    // A few books, and the RT ledger.
    for (let i = 0; i < 4; i++)
      P(
        dk.x + 0.3,
        FL + top + 0.02 + i * 0.035,
        dk.z + 0.12,
        0.26,
        0.032,
        0.2,
        ['#2f6fb3', '#c23a2e', '#e8d9a8', '#3a7a4a'][i],
      );
    P(dk.x - 0.15, FL + top + 0.012, dk.z - 0.12, 0.22, 0.02, 0.3, '#3f5a3a');
  }
  // The laptop.
  P(dk.x, FL + top + 0.006, dk.z - 0.05, 0.34, 0.012, 0.24, '#2b2d31');
  P(dk.x, FL + top + 0.12, dk.z + 0.07, 0.34, 0.22, 0.012, '#2b2d31', set.solid, 0, -0.25);
  P(dk.x, FL + top + 0.12, dk.z + 0.064, 0.3, 0.19, 0.004, '#5a7fa8', set.solid, 0, -0.25);

  /* Kamar: a thin old kasur, or a proper mattress with batik sheets; the lemari under a sheet or not. */
  const bd = L.BED;
  const bcx = (bd.x0 + bd.x1) / 2,
    bcz = (bd.z0 + bd.z1) / 2;
  const bw = bd.x1 - bd.x0 - 0.06,
    bl = bd.z1 - bd.z0 - 0.14;
  const lm = L.LEMARI;
  if (!done('kamar')) {
    P(bcx, FL + 0.38, bcz, bw, 0.08, bl, '#d8d0bc');
    for (let k = -3; k <= 3; k++) P(bcx + k * 0.15, FL + 0.421, bcz, 0.03, 0.004, bl, '#b8b09a');
    P(bcx + 0.2, FL + 0.422, bcz + 0.3, 0.4, 0.004, 0.3, '#b8a37a', set.cyl);
    P(bcx, FL + 0.46, bd.z0 + 0.3, 0.5, 0.08, 0.3, '#cfc8b4');
    P(
      (lm.x0 + lm.x1) / 2,
      FL + lm.h / 2 + 0.05,
      (lm.z0 + lm.z1) / 2,
      lm.x1 - lm.x0 + 0.08,
      lm.h + 0.12,
      lm.z1 - lm.z0 + 0.08,
      SHEET,
      set.cloth,
    );
    P(-1.1, FL + 0.18, -2.7, 0.4, 0.36, 0.35, '#b89a62');
    P(-1.05, FL + 0.44, -2.68, 0.3, 0.16, 0.28, '#a8885a');
  } else {
    P(bcx, FL + 0.42, bcz, bw, 0.16, bl, '#f4f1ea');
    P(bcx, FL + 0.505, bcz + 0.1, bw + 0.02, 0.012, bl - 0.2, '#3f5f8a');
    for (let k = 0; k < 6; k++) P(bcx, FL + 0.512, bcz - 0.6 + k * 0.28, bw, 0.004, 0.05, '#d9a441');
    P(bcx - 0.02, FL + 0.56, bd.z0 + 0.32, 0.8, 0.1, 0.34, '#f8f6f0');
    P(bcx + 0.4, FL + 0.58, bcz + 0.1, 0.1, 0.9, 0.1, '#f2e8d6', set.cyl, 0, Math.PI / 2);
    P(bcx, FL + 0.53, bd.z1 - 0.3, bw, 0.05, 0.3, '#c9a15a');
    // A mirror on the lemari, a batik on the wall, a rug.
    P(lm.x0 - 0.012, FL + 1.25, lm.z0 + 0.3, 0.005, 0.8, 0.3, '#b9d4dc');
    P(-IX + 0.012, 1.7, bcz, 0.005, 0.7, 1.1, '#6b3a22', set.cloth);
    for (let k = 0; k < 5; k++) P(-IX + 0.016, 1.45 + k * 0.12, bcz, 0.004, 0.03, 1.0, '#d9a441');
    floorPatch(-1.5, -1.5, 0.7, 1.1, '#6a8a5a');
    // Her letters on the nightstand, tied with raffia.
    const [nx, nz] = L.NIGHTSTAND;
    P(nx, FL + 0.58, nz, 0.2, 0.05, 0.13, '#efe6cf');
    P(nx, FL + 0.585, nz, 0.21, 0.052, 0.02, '#c9a15a');
  }

  /* Dapur: a rusty one-burner stove and a sooty wall, or a new stove, shelves, jars and her recipe tin. */
  const ct = L.COUNTER;
  const [sx, sz] = L.STOVE;
  const ctop = FL + ct.h;
  const [shx, shz] = L.SHELF;
  if (!done('dapur')) {
    P(sx, ctop + 0.05, sz, 0.34, 0.1, 0.3, '#6a4a3a');
    P(sx, ctop + 0.105, sz, 0.09, 0.012, 0.09, '#2a2420', set.cyl);
    P(sx, 1.35, -IZ + 0.012, 0.6, 0.6, 0.004, '#a9a698');
    P(sx, 1.25, -IZ + 0.014, 0.4, 0.35, 0.004, '#8f8b7e');
    P(shx, 1.55, shz + 0.05, 0.8, 0.03, 0.18, '#8a7a62');
    P(L.RICE_COOKER[0], ctop + 0.15, L.RICE_COOKER[1], 0.3, 0.3, 0.3, '#d8d1c0', set.cloth);
    P(-0.1, CE - 0.12, -IZ + 0.1, 0.25, 0.004, 0.25, '#f2f2f2', set.cloth, Math.PI / 4, -0.5);
  } else {
    P(sx, ctop + 0.04, sz, 0.62, 0.08, 0.36, '#b8bcc0');
    for (const o of [-0.16, 0.16]) {
      P(sx + o, ctop + 0.085, sz, 0.1, 0.012, 0.1, '#2a2a2a', set.cyl);
      P(sx + o, ctop + 0.03, sz + 0.185, 0.025, 0.02, 0.025, '#222', set.cyl, 0, Math.PI / 2);
    }
    P(sx - 0.16, ctop + 0.13, sz, 0.15, 0.07, 0.15, '#3a3a3c', set.cyl);
    P(sx - 0.16, ctop + 0.14, sz + 0.2, 0.012, 0.012, 0.12, '#5a3a22');
    // A tiled splashback, the shelf with jars and her tin, the rak piring.
    P((ct.x0 + ct.x1) / 2, ctop + 0.25, -IZ + 0.012, ct.x1 - ct.x0, 0.5, 0.006, '#f2f0ea');
    P(shx, 1.55, shz + 0.05, 0.8, 0.03, 0.18, WOOD);
    for (const [o, c] of [
      [-0.3, '#e24a3b'],
      [-0.15, '#f2c14e'],
      [0.0, '#58b368'],
    ] as const)
      P(shx + o, 1.64, shz + 0.05, 0.05, 0.14, 0.05, c, set.cyl);
    P(shx + 0.22, 1.63, shz + 0.05, 0.1, 0.12, 0.1, '#b8312a', set.cyl);
    P(shx + 0.22, 1.695, shz + 0.05, 0.105, 0.015, 0.105, '#d9a441', set.cyl);
    P(1.6, 1.45, -IZ + 0.1, 0.5, 0.04, 0.16, '#9a9a9a');
    for (let k = 0; k < 5; k++)
      P(1.42 + k * 0.09, 1.6, -IZ + 0.1, 0.12, 0.015, 0.12, '#f4f2ec', set.cyl, 0, 0, Math.PI / 2);
  }

  /* Atap: until the roof is redone it leaks, into a bucket in the ruang tamu and a basin in the kamar. */
  if (!done('atap')) {
    for (const [x, z] of [L.LEAK, L.LEAK_KAMAR]) {
      ceilPatch(x, z, 0.45, '#b8a67e');
      ceilPatch(x, z, 0.28, '#9a8a66');
    }
    P(L.LEAK[0], FL + 0.15, L.LEAK[1], 0.14, 0.3, 0.14, '#3b7dd8', set.cyl);
    P(L.LEAK[0], FL + 0.26, L.LEAK[1], 0.12, 0.01, 0.12, '#6aa0c8', set.cyl);
    P(L.LEAK_KAMAR[0], FL + 0.05, L.LEAK_KAMAR[1], 0.2, 0.1, 0.2, '#d8392a', set.cyl);
  } else {
    // The tin of coins she saved, on the bufet.
    const b = L.BUFET;
    P(b.x, FL + b.h + 0.06, b.z - 0.35, 0.08, 0.12, 0.08, '#8a5a3a', set.cyl);
  }
  // The guest book, on the bufet, once it's been found under the teras tile.
  if (done('teras')) {
    const b = L.BUFET;
    P(b.x, FL + b.h + 0.01, b.z - 0.05, 0.2, 0.02, 0.28, '#2f6fb3');
  }
  set.build();
  return set;
}

/** The TV's screen (local centre and size): the old box TV, or the flat one once the ruang tamu is done. */
export function tvScreen() {
  const tc = L.TV_CABINET,
    top = FL + tc.h;
  return hasRoom('ruangtamu')
    ? { x: tc.x, y: top + 0.42, z: tc.z + 0.028, w: 0.8, h: 0.44 }
    : { x: tc.x, y: top + 0.2, z: tc.z - 0.207, w: 0.44, h: 0.32 };
}

function refreshState() {
  if (stateSet) {
    stateSet.show(false);
    stateSet.dispose();
  }
  stateSet = buildState();
}

/* ================= put together ================= */

export function buildRakaInterior(): Interior {
  const h = rakaHouse;
  const set = new PropSet('rumah-dalam');
  buildShell(set);
  set.build();
  refreshState();
  onHouseChange(refreshState);

  /* The door, the lamp, the sandals on the teras mat. */
  const door = new Door(h.F, h.th, h.dx, h.fz, h.doorC);
  const [lx, lz] = h.F(L.LAMP[0], L.LAMP[1]);
  const sandals = new THREE.Group();
  const sm = new THREE.MeshLambertMaterial({ color: '#3b5f8a' });
  for (const o of [-0.09, 0.09]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.26), sm);
    s.position.set(o, 0.13, 0);
    s.rotation.y = o * 1.2;
    sandals.add(s);
  }
  const sp = h.F(h.dx + 0.62, h.fz + 0.42);
  sandals.position.set(sp[0], 0, sp[1]);
  sandals.rotation.y = h.th;
  sandals.visible = false;
  scene.add(sandals);

  const it: Interior = {
    name: NAME,
    rooms: [
      roomL(h.F, 'Kamar mandi', MX, IX, -IZ, MZ),
      roomL(h.F, 'Kamar', -IX, PX, -IZ, PZ),
      roomL(h.F, 'Dapur', PX, IX, -IZ, PZ),
      roomL(h.F, 'Ruang tamu', -IX, IX, PZ, IZ + 0.02),
    ],
    props: set,
    extra: () => stateSet,
    door,
    lamp: [lx, CE - 0.45, lz],
    lampOn: () => true,
    // An old dim bulb until the front room is done.
    lampPower: () => (hasRoom('ruangtamu') ? 1 : 0.55),
    sandals,
  };
  interiors.push(it);

  interactables.push({
    x: door.x,
    z: door.z,
    y: 1.1,
    size: 0.7,
    reach: 2.0,
    inside: '*',
    label: () => (door.target > 0.5 ? 'Close the door' : 'Open the door'),
    run: () => door.toggle(),
  });
  return it;
}
