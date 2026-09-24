/* Procedural row houses along the block edges that face a road. */
import { addCol, overlaps, overlapsAny, type Rect4 } from '../core/collision';
import { R, rand, pick } from '../core/util';
import { Batch, mat, solid, roofs, cyl, lit, C, blob } from '../render/batch';
import {
  XB,
  ZB,
  FRONT,
  RES,
  WALLS,
  ROOFS,
  DOORS,
  TRIMS,
  TERAS,
  BIKES,
  CLOTH,
  dark,
  frame,
  houseRects,
  houseTops,
} from './layout';

export function bike(x: number, z: number, ry: number, c: string) {
  const F = frame(x, z, ry);
  const put = (
    b: Batch,
    lx: number,
    y: number,
    lz: number,
    sx: number,
    sy: number,
    sz: number,
    col: string,
    rx = 0,
    rz = 0,
  ) => {
    const [wx, wz] = F(lx, lz);
    b.add(mat(wx, y, wz, sx, sy, sz, ry, rx, rz), col);
  };
  put(solid, 0, 0.55, 0, 1.45, 0.42, 0.32, c);
  put(solid, -0.1, 0.86, 0, 0.7, 0.12, 0.3, '#1d1d1f');
  put(solid, 0.62, 0.95, 0, 0.08, 0.55, 0.08, '#2a2a2c');
  put(solid, 0.62, 1.2, 0, 0.08, 0.05, 0.62, '#2a2a2c');
  put(cyl, 0.62, 0.3, 0, 0.29, 0.1, 0.29, '#1a1a1a', Math.PI / 2);
  put(cyl, -0.62, 0.3, 0, 0.29, 0.1, 0.29, '#1a1a1a', Math.PI / 2);
}

/** Row houses in build order, with what NPCs need: local frame, door offset, teras depth and bench. */
export type House = ReturnType<typeof buildHouse>;
export const houses: House[] = [];

/** Fixed choices for a specific house; anything left out is rolled from R. */
export interface HouseSpec {
  two?: boolean;
  wall?: string;
  roof?: string;
  door?: string;
  shutters?: boolean;
  pagar?: boolean;
  pagarC?: string;
  awning?: boolean;
  bench?: string;
  plants?: number;
  noBike?: boolean;
  teras?: string;
}
interface HouseArgs {
  cx: number;
  cz: number;
  th: number;
  w: number;
  d: number;
  sb: number;
  sp?: HouseSpec;
}

/** House centred at (cx, cz), front facing local +z rotated by th; sb is the teras setback. */
export function buildHouse({ cx, cz, th, w, d, sb, sp = {} }: HouseArgs) {
  const F = frame(cx, cz, th);
  const put = (
    b: Batch,
    lx: number,
    y: number,
    lz: number,
    sx: number,
    sy: number,
    sz: number,
    c: string,
    rx = 0,
    rz = 0,
  ) => {
    const [x, z] = F(lx, lz);
    b.add(mat(x, y, z, sx, sy, sz, th, rx, rz), c);
  };
  const colL = (lx0: number, lx1: number, lz0: number, lz1: number) => {
    const a = F(lx0, lz0),
      b = F(lx1, lz1);
    addCol(a[0], b[0], a[1], b[1]);
  };
  const two = sp.two ?? R() < 0.3;
  const H = two ? 5.8 : 3.2;
  const wall = sp.wall || pick(WALLS);
  const trim = pick(TRIMS);
  const fz = d / 2;
  put(solid, 0, H / 2, 0, w, H, d, wall);
  put(solid, 0, 0.22, 0, w + 0.05, 0.44, d + 0.05, dark(wall, 0.68));
  if (two) put(solid, 0, 3.05, 0, w + 0.08, 0.16, d + 0.08, '#f3efe6');
  // roof
  let roofC = sp.roof || pick(ROOFS);
  if (!sp.roof) {
    const r = R();
    if (r < 0.13) roofC = '#8b9296';
    else if (r < 0.18) roofC = '#4c7ea6';
  }
  if (two && !sp.roof && R() < 0.4) {
    put(solid, 0, H + 0.25, 0, w + 0.1, 0.5, d + 0.1, dark(wall, 0.9));
    put(
      cyl,
      rand(-w / 4, w / 4),
      H + 0.5 + 0.6,
      rand(-d / 4, d / 4),
      0.55,
      1.2,
      0.55,
      pick(['#e2712b', '#2f6fb3', '#e8e4da']),
    );
  } else {
    put(roofs, 0, H, 0, w + 0.7, Math.min(1.7, d * 0.22), d + 0.9, roofC);
  }
  houseRects.push({
    r: (() => {
      const a = F(-w / 2, -d / 2),
        b = F(w / 2, d / 2);
      return [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1])] as Rect4;
    })(),
    c: roofC,
  });
  // openings
  const slots = w >= 5.8 ? [-w * 0.3, 0, w * 0.3] : [-w * 0.22, w * 0.22];
  const di = Math.floor(R() * slots.length);
  const dx = slots[di];
  put(solid, dx, 1.07, fz + 0.035, 0.95, 2.14, 0.07, sp.door || pick(DOORS));
  put(solid, dx, 2.42, fz + 0.03, 1.0, 0.22, 0.06, dark(wall, 0.8));
  const win = (x: number, y: number) => {
    put(solid, x, y, fz + 0.02, 1.34, 1.22, 0.04, trim);
    if (sp.shutters) {
      put(solid, x - 0.28, y, fz + 0.05, 0.52, 1.06, 0.05, '#7a5a3a');
      put(solid, x + 0.28, y, fz + 0.05, 0.52, 1.06, 0.05, '#7a5a3a');
    } else if (R() < 0.58)
      put(lit, x, y, fz + 0.045, 1.08, 0.98, 0.05, R() < 0.12 ? '#9cc2ff' : pick(['#ffd28a', '#ffe0ae', '#ffc978']));
    else put(solid, x, y, fz + 0.045, 1.08, 0.98, 0.05, '#34414b');
  };
  slots.forEach((x, i) => {
    if (i !== di) win(x, 1.55);
    if (two) win(x, 4.35);
  });
  houseTops.push(F(0, fz).concat(H));
  // teras
  const terasC = sp.teras || pick(TERAS);
  put(solid, 0, 0.06, fz + sb / 2, w, 0.12, sb, terasC);
  if (two) {
    put(solid, 0, 3.02, fz + 0.5, w, 0.18, 1.0, '#efe9dc');
    put(solid, 0, 3.55, fz + 0.97, w, 0.85, 0.06, pick(['#2f6a55', '#f4f0e6', '#3a3a3a']));
  }
  if (!two && sb >= 1.55 && (sp.awning ?? R() < 0.5)) {
    put(
      solid,
      0,
      2.72,
      fz + 0.78,
      w,
      0.07,
      1.62,
      R() < 0.5 ? '#8b9296' : pick(['#2d7fc1', '#c9493a', '#3a9a73']),
      -0.1,
    );
    for (const px of [-w / 2 + 0.15, w / 2 - 0.15]) {
      put(solid, px, 1.33, fz + 1.45, 0.12, 2.66, 0.12, '#6f6a62');
      colL(px - 0.06, px + 0.06, fz + 1.39, fz + 1.51);
    }
    if (R() < 0.3) {
      put(solid, 0, 2.25, fz + 1.3, w - 0.4, 0.02, 0.02, '#444');
      for (let x = -w / 2 + 0.6; x < w / 2 - 0.5; x += rand(0.55, 0.9)) {
        const h = rand(0.45, 0.8);
        put(solid, x, 2.24 - h / 2, fz + 1.3, rand(0.35, 0.55), h, 0.02, pick(CLOTH));
      }
    }
  }
  // pagar
  const pz = fz + sb - 0.08;
  if (sb >= 1.5 && (sp.pagar ?? R() < 0.42)) {
    const pc = sp.pagarC || pick(['#f3efe6', '#2f6a55', '#dad3c4', dark(wall, 0.9)]);
    const segs = [
      [-w / 2, dx - 0.7],
      [dx + 0.7, w / 2],
    ];
    for (const [a, b] of segs) {
      if (b - a < 0.3) continue;
      put(solid, (a + b) / 2, 0.45, pz, b - a, 0.9, 0.14, pc);
      colL(a, b, pz - 0.07, pz + 0.07);
    }
  }
  // furniture
  let bench: number | null = null;
  if (R() < 0.32 || sp.bench) {
    const bx = dx < 0 ? w / 2 - 1.1 : -w / 2 + 1.1;
    bench = bx;
    put(solid, bx, 0.23, fz + 0.42, 1.4, 0.46, 0.42, sp.bench || '#8a6443');
    colL(bx - 0.7, bx + 0.7, fz + 0.2, fz + 0.64);
  }
  const plants = sp.plants ?? Math.floor(rand(0, 3.4));
  for (let i = 0; i < plants; i++) {
    const px = rand(-w / 2 + 0.4, w / 2 - 0.4);
    if (Math.abs(px - dx) < 0.8) continue;
    const pzz = fz + rand(0.3, sb - 0.35);
    const [x, z] = F(px, pzz);
    C(x, z, 0, 0.38, 0.2, pick(['#b8603f', '#e8e4da', '#2f5d8a']));
    blob(x, 0.62, z, rand(0.28, 0.45), pick(['#4f8a3a', '#5e9c42', '#3f7a3a', '#6aa84f']), 1.1);
  }
  if (!sp.noBike && sb >= 1.7 && R() < 0.24) {
    const bxx = dx < 0 ? w / 2 - 1.2 : -w / 2 + 1.2;
    const [x, z] = F(bxx, fz + sb * 0.58);
    bike(x, z, th, pick(BIKES));
  }
  if (R() < 0.13) {
    const [x, z] = F(w / 2 - 0.2, fz + sb - 0.25);
    C(x, z, 0, 3.9, 0.03, '#e9e2d0');
    put(solid, w / 2 + 0.26, 3.67, fz + sb - 0.25, 0.9, 0.25, 0.02, '#d8261f');
    put(solid, w / 2 + 0.26, 3.42, fz + sb - 0.25, 0.9, 0.25, 0.02, '#f5f3ee');
  }
  // collider
  colL(-w / 2, w / 2, -d / 2, d / 2);
  return { F, H, fz, dx, sb, th, w, d, bench };
}

/** Back-row house inside a block. (Currently never fits; see CLAUDE.md known gaps.) */
function infill(x: number, z: number, w: number, d: number) {
  const two = R() < 0.4,
    H = two ? 5.8 : 3.2,
    wall = pick(WALLS),
    rc = R() < 0.15 ? '#8b9296' : pick(ROOFS),
    ry = R() < 0.5 ? 0 : Math.PI / 2;
  solid.add(mat(x, H / 2, z, w, H, d), wall);
  solid.add(mat(x, 0.22, z, w + 0.05, 0.44, d + 0.05), dark(wall, 0.68));
  if (ry === 0) roofs.add(mat(x, H, z, w + 0.6, Math.min(1.6, d * 0.24), d + 0.8), rc);
  else roofs.add(mat(x, H, z, d + 0.8, Math.min(1.6, w * 0.24), w + 0.6, ry), rc);
  const side = pick([
    [0, d / 2 + 0.03, 0],
    [0, -d / 2 - 0.03, 0],
    [w / 2 + 0.03, 0, 1],
    [-w / 2 - 0.03, 0, 1],
  ]);
  for (const o of [-0.25, 0.25]) {
    const wx = side[2] ? x + side[0] : x + o * w,
      wz = side[2] ? z + o * d : z + side[1];
    const sx = side[2] ? 0.06 : 1.0,
      sz = side[2] ? 1.0 : 0.06;
    for (const y of two ? [1.55, 4.35] : [1.55])
      (R() < 0.5 ? lit : solid).add(mat(wx, y, wz, sx, 0.95, sz), R() < 0.5 ? '#ffd28a' : '#34414b');
  }
  addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  houseRects.push({ r: [x - w / 2, x + w / 2, z - d / 2, z + d / 2], c: rc });
}

type Side = 'N' | 'S' | 'E' | 'W';
interface Block {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
/** A row of houses along one side of a block, from s0 to s1 along that edge. */
function genRow(b: Block, side: Side, s0: number, s1: number, maxD: number) {
  let cur = s0;
  while (cur < s1 - 3.6) {
    let w = rand(4.6, 7.2);
    if (cur + w > s1) w = s1 - cur;
    if (w < 3.8) break;
    const sb = rand(1.5, 2.2),
      d = Math.max(4.5, Math.min(rand(6, 8), maxD - sb));
    const a = cur + w / 2;
    let cx: number, cz: number, th: number, fp: Rect4;
    if (side === 'N') {
      th = Math.PI;
      cx = a;
      cz = b.z0 + sb + d / 2;
      fp = [cur, cur + w, b.z0, cz + d / 2];
    } else if (side === 'S') {
      th = 0;
      cx = a;
      cz = b.z1 - sb - d / 2;
      fp = [cur, cur + w, cz - d / 2, b.z1];
    } else if (side === 'W') {
      th = -Math.PI / 2;
      cz = a;
      cx = b.x0 + sb + d / 2;
      fp = [b.x0, cx + d / 2, cur, cur + w];
    } else {
      th = Math.PI / 2;
      cz = a;
      cx = b.x1 - sb - d / 2;
      fp = [cx - d / 2, b.x1, cur, cur + w];
    }
    if (RES.some(r => overlaps(fp, r, 0.25))) {
      cur += 1.4;
      continue;
    }
    houses.push(buildHouse({ cx, cz, th, w, d, sb }));
    cur += w + (R() < 0.35 ? rand(0.5, 1.3) : 0);
  }
}

export function buildBlocks() {
  const XR = 10.4;
  XB.forEach(([x0, x1], ix) =>
    ZB.forEach(([z0, z1], iz) => {
      const b = { x0, x1, z0, z1 };
      const fr = FRONT[ix] as Side[];
      const zd = z1 - z0;
      const hasS = iz < 4;
      for (const s of fr) genRow(b, s, z0, z1, Math.min(10.2, (x1 - x0) / 2 - 0.2));
      const a0 = x0 + (fr.includes('W') ? XR : 0),
        a1 = x1 - (fr.includes('E') ? XR : 0);
      genRow(b, 'N', a0, a1, hasS ? zd / 2 - 0.2 : 10.2);
      if (hasS) genRow(b, 'S', a0, a1, zd / 2 - 0.2);
      for (let i = 0; i < 45; i++) {
        const w = rand(4.5, 7),
          d = rand(4.5, 7);
        if (x1 - x0 < w + 5.4 || z1 - z0 < d + 5.4) continue;
        const x = rand(x0 + 2.7 + w / 2, x1 - 2.7 - w / 2),
          z = rand(z0 + 2.7 + d / 2, z1 - 2.7 - d / 2);
        const fp: Rect4 = [x - w / 2, x + w / 2, z - d / 2, z + d / 2];
        if (overlapsAny(fp, 0.8) || RES.some(r => overlaps(fp, r, 0.6))) continue;
        infill(x, z, w, d);
      }
    }),
  );
}
