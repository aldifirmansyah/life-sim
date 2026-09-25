/* The city generator. The island is cut into 36 m lots; each lot decides what
   stands on it from the ground (landAt), the town around it (its kind and how
   near its centre) and its own seed, keeping clear of roads, town streets and
   the MRT viaduct. The result is plain data, grouped into 128 m chunks: items
   (boxes and shapes for the pools), colliders and floors. Chunks are turned into
   instances only when the player comes near (stream.ts). Seeds come from the
   lot's position, so the city is the same every time and in any build order. */
import { hash, rng, type Rng } from '../core/util';
import { TOWNS, landAt, type Land, type Town, BOUNDS, toGame } from './geo';
import { addRoad, allSegs, nearRoad, type Road } from './roads';
import { nearTrack } from './mrtdata';
import { STYLE } from './facade';

export const CHUNK = 128;
export const LOT = 36;

export type PoolName = 'bldg' | 'solid' | 'roof' | 'cyl' | 'crown' | 'ground' | 'road' | 'glass' | 'dome';
export interface Item {
  p: PoolName;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  ry: number;
  /** Tilt about the item's own z (stairs). */
  rz?: number;
  c: string;
  /** Facade style (bldg only). */
  st?: number;
}
export interface ColDesc {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  ry: number;
  y0: number;
  y1: number;
}
export interface FloorDesc {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  ry: number;
  y0: number;
  y1: number;
}
export interface ChunkData {
  cx: number;
  cz: number;
  items: Item[];
  cols: ColDesc[];
  floors: FloorDesc[];
}

const chunks = new Map<string, ChunkData>();
export const chunkKey = (cx: number, cz: number) => cx + ',' + cz;
export const chunkOf = (x: number, z: number) => [Math.floor(x / CHUNK), Math.floor(z / CHUNK)] as const;
function chunkAt(x: number, z: number): ChunkData {
  const [cx, cz] = chunkOf(x, z);
  const k = chunkKey(cx, cz);
  let c = chunks.get(k);
  if (!c) chunks.set(k, (c = { cx, cz, items: [], cols: [], floors: [] }));
  return c;
}
export const getChunk = (cx: number, cz: number) => chunks.get(chunkKey(cx, cz));
export const allChunks = () => chunks.values();

/* ---------- placing things ---------- */

/** Put an item in the chunk that holds its centre. */
export function put(it: Item) {
  chunkAt(it.x, it.z).items.push(it);
}
export function putCol(cx: number, cz: number, hx: number, hz: number, ry = 0, y0 = -1e9, y1 = 1e9) {
  chunkAt(cx, cz).cols.push({ cx, cz, hx, hz, ry, y0, y1 });
}
export function putFloor(cx: number, cz: number, hx: number, hz: number, ry: number, y0: number, y1 = y0) {
  chunkAt(cx, cz).floors.push({ cx, cz, hx, hz, ry, y0, y1 });
}
/** A building: facade box from the ground, with its collider. */
function building(x: number, z: number, w: number, d: number, h: number, c: string, st: number, ry = 0) {
  put({ p: 'bldg', x, y: h / 2, z, sx: w, sy: h, sz: d, ry, c, st });
  putCol(x, z, w / 2, d / 2, ry, -1e9, h);
}
function box(p: PoolName, x: number, y0: number, z: number, w: number, h: number, d: number, c: string, ry = 0) {
  put({ p, x, y: y0 + h / 2, z, sx: w, sy: h, sz: d, ry, c });
}
function tree(r: Rng, x: number, z: number, s = 1) {
  const h = r.range(3.5, 6) * s;
  put({ p: 'cyl', x, y: h / 2, z, sx: 0.22 * s, sy: h, sz: 0.22 * s, ry: 0, c: '#6b5139' });
  const cr = r.range(2.2, 3.4) * s;
  put({
    p: 'crown',
    x,
    y: h + cr * 0.4,
    z,
    sx: cr,
    sy: cr * 0.8,
    sz: cr,
    ry: r.range(0, 6),
    c: r.pick(['#3f7d3a', '#4f8f45', '#2f6b34', '#5a9a4c', '#46803c']),
  });
}
function palm(r: Rng, x: number, z: number) {
  const h = r.range(6, 9);
  put({ p: 'cyl', x, y: h / 2, z, sx: 0.2, sy: h, sz: 0.2, ry: 0, c: '#8a7355' });
  put({ p: 'crown', x, y: h, z, sx: 2.6, sy: 0.9, sz: 2.6, ry: r.range(0, 6), c: '#4f9a4a' });
}
/** A straight strip (road, runway, deck) cut into ≤ 32 m pieces, each in the chunk of its middle. */
export function strip(
  p: PoolName,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  w: number,
  y0: number,
  h: number,
  c: string,
) {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.01) return;
  const n = Math.max(1, Math.ceil(len / 32));
  const ry = Math.atan2(-(bz - az), bx - ax);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    put({ p, x: ax + (bx - ax) * t, y: y0 + h / 2, z: az + (bz - az) * t, sx: len / n + 0.05, sy: h, sz: w, ry, c });
  }
}

/* ---------- palettes ---------- */
const HDB = ['#e8d9b8', '#d9e4dc', '#f0d8c8', '#d8dfe8', '#efe6c9', '#e3d2e2', '#cfe0d0', '#f2e2b3', '#e6ddd0'];
const SHOP = ['#f2b8a8', '#9fd3c7', '#f6d98b', '#a9c6e8', '#f4a6b8', '#c8e6a0', '#f7c59f', '#d4b5e0', '#f0e0c0'];
const GLASS = ['#8fa9b8', '#7d97a6', '#a3b5bf', '#6f8a99', '#9fb0a8'];
const OFFICE = ['#cfc9bd', '#b9b4aa', '#d8d2c4', '#c2c8cc'];
const MALL = ['#e6e0d4', '#d9d2c3', '#c9d6de', '#e8d8c8'];
const INDUSTRY = ['#b9bdb8', '#a8b3b8', '#c7c2b3', '#b3b8ad'];
const HOUSE = ['#f1ece0', '#e9dcc4', '#f3e6d0', '#e8e0d8'];
const ROOF = ['#b5553a', '#a8472f', '#c46a45', '#9c4a34'];

/* ---------- ground ---------- */
export const GROUND: Record<string, string> = {
  grass: '#7fa865',
  paved: '#b8b6ae',
  sand: '#e8d7a8',
  forest: '#5d7f47',
  tarmac: '#8e8f8c',
  park: '#86b06a',
  industry: '#a9a79f',
};
/** Ground colour for a 16 m cell, or null for water. */
export function groundAt(x: number, z: number): string | null {
  const land = landAt(x, z);
  if (land === 'sea' || land === 'water') return null;
  if (land === 'beach') return GROUND.sand;
  if (land === 'forest') return GROUND.forest;
  if (land === 'airport') return GROUND.tarmac;
  if (land === 'industry') return GROUND.industry;
  if (land === 'park') return GROUND.park;
  const t = townIn(x, z);
  if (t && ['cbd', 'mall', 'shophouse', 'mixed', 'civic', 'landmark', 'airport'].includes(t.kind)) return GROUND.paved;
  return GROUND.grass;
}

/* ---------- towns ---------- */
function townIn(x: number, z: number): Town | null {
  let best: Town | null = null,
    bd = Infinity;
  for (const t of TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z) / t.r;
    if (d < 1 && d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}
function nearestTown(x: number, z: number) {
  let best = TOWNS[0],
    bd = Infinity;
  for (const t of TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z) - t.r;
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return { t: best, d: bd };
}
const STREETLESS = new Set(['park', 'resort', 'kampung', 'airport', 'landmark']);
/** Town streets: every third lot line through built-up towns, clipped to the town's circle. */
function townStreets() {
  for (const t of TOWNS) {
    if (STREETLESS.has(t.kind)) continue;
    const add = (pts: [number, number][]) => {
      const r: Road = { name: `${t.name} street`, kind: 'street', w: 7, pts };
      addRoad(r);
    };
    for (let ix = Math.ceil((t.x - t.r) / LOT); ix <= Math.floor((t.x + t.r) / LOT); ix++) {
      if (ix % 3) continue;
      const x = ix * LOT,
        h = Math.sqrt(Math.max(0, t.r * t.r - (x - t.x) ** 2));
      if (h > 12)
        add([
          [x, t.z - h],
          [x, t.z + h],
        ]);
    }
    for (let iz = Math.ceil((t.z - t.r) / LOT); iz <= Math.floor((t.z + t.r) / LOT); iz++) {
      if (iz % 3) continue;
      const z = iz * LOT,
        h = Math.sqrt(Math.max(0, t.r * t.r - (z - t.z) ** 2));
      if (h > 12)
        add([
          [t.x - h, z],
          [t.x + h, z],
        ]);
    }
  }
}

/** Is a w × d footprint at (x, z) clear of roads and the viaduct? */
function clear(x: number, z: number, w: number, d: number, m = 1.5) {
  const hw = w / 2,
    hd = d / 2;
  for (const [ox, oz] of [
    [0, 0],
    [-hw, -hd],
    [hw, -hd],
    [-hw, hd],
    [hw, hd],
    [0, -hd],
    [0, hd],
    [-hw, 0],
    [hw, 0],
  ])
    if (nearRoad(x + ox, z + oz, m)) return false;
  return !nearTrack(x, z, Math.hypot(hw, hd) + m);
}
/** Place a building if its footprint is clear, shrinking once if it isn't. */
function tryBuilding(x: number, z: number, w: number, d: number, h: number, c: string, st: number) {
  if (clear(x, z, w, d)) return (building(x, z, w, d, h, c, st), true);
  if (clear(x, z, w * 0.6, d * 0.6)) return (building(x, z, w * 0.6, d * 0.6, h, c, st), true);
  return false;
}

/* ---------- what stands on a lot ---------- */

function hdbLot(r: Rng, x: number, z: number, tall: boolean, core: number) {
  // Near the town centre: the mall over the MRT, a hawker centre.
  if (core < 0.22 && r.chance(0.5)) {
    if (tryBuilding(x, z, 30, 28, r.range(16, 24), r.pick(MALL), STYLE.mall)) return;
  }
  if (core < 0.4 && r.chance(0.2)) {
    if (clear(x, z, 26, 20)) {
      building(x, z, 26, 20, 5.5, '#d9d0c0', STYLE.mall);
      put({ p: 'roof', x, y: 5.5, z, sx: 27, sy: 2.4, sz: 21, ry: 0, c: '#b9443a' });
      return;
    }
  }
  const point = tall ? r.chance(0.35) : r.chance(0.12);
  const col = r.pick(HDB);
  if (point) {
    const h = r.range(70, 110);
    if (tryBuilding(x, z, 17, 17, h, col, STYLE.point)) box('solid', x, h, z, 6, 3, 6, '#9aa0a4');
  } else {
    const turn = r.chance(0.5);
    const h = tall ? r.range(40, 56) : r.range(30, 44);
    const [w, d] = turn ? [11, 30] : [30, 11];
    if (tryBuilding(x, z, w, d, h, col, STYLE.hdb)) box('solid', x, h, z, 5, 3.2, 5, '#9aa0a4');
  }
  if (r.chance(0.6)) tree(r, x + r.range(-15, 15), z + (r.chance(0.5) ? -15 : 15));
}
function shophouseLot(r: Rng, x: number, z: number) {
  // Two rows of narrow shophouses back to back, fronts facing the streets either side.
  const along = r.chance(0.5);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const u = -12 + i * 6;
      const h = r.range(8, 12);
      const [bx, bz] = along ? [x + u, z + side * 7.5] : [x + side * 7.5, z + u];
      const [w, d] = along ? [5.7, 14] : [14, 5.7];
      if (!clear(bx, bz, w, d, 0.5)) continue;
      building(bx, bz, w, d, h, r.pick(SHOP), STYLE.shophouse);
      put({
        p: 'roof',
        x: bx,
        y: h,
        z: bz,
        sx: w + 0.4,
        sy: 1.8,
        sz: d + 0.4,
        ry: along ? Math.PI / 2 : 0,
        c: r.pick(ROOF),
      });
    }
  }
}
function towerLot(r: Rng, x: number, z: number, core: number) {
  const tall = core < 0.5;
  if (r.chance(tall ? 0.75 : 0.5)) {
    const glass = r.chance(0.6);
    const h = tall ? r.range(110, 250) : r.range(60, 130);
    const w = r.range(20, 28),
      d = r.range(20, 28);
    if (tryBuilding(x, z, w, d, h, glass ? r.pick(GLASS) : r.pick(OFFICE), glass ? STYLE.glass : STYLE.office))
      box('solid', x, h, z, w * 0.6, 4, d * 0.6, '#8b9296');
  } else if (clear(x, z, 26, 26)) {
    building(x, z, 26, 26, r.range(20, 40), r.pick(OFFICE), STYLE.office);
  }
}
function mallLot(r: Rng, x: number, z: number, core: number) {
  if (core < 0.6 && r.chance(0.7)) {
    tryBuilding(x, z, 30, 30, r.range(18, 34), r.pick(MALL), STYLE.mall);
    if (r.chance(0.3)) {
      const h = r.range(70, 140);
      tryBuilding(x + r.range(-4, 4), z + r.range(-4, 4), 16, 16, h, r.pick(GLASS), STYLE.glass);
    }
  } else if (r.chance(0.6)) {
    tryBuilding(x, z, 22, 22, r.range(50, 110), r.pick(r.chance(0.5) ? GLASS : OFFICE), STYLE.office);
  } else hdbLot(r, x, z, true, 1);
}
function mixedLot(r: Rng, x: number, z: number, core: number) {
  if (r.chance(0.35)) return shophouseLot(r, x, z);
  if (r.chance(0.6))
    return void tryBuilding(x, z, r.range(18, 28), r.range(18, 26), r.range(25, 70), r.pick(OFFICE), STYLE.office);
  return towerLot(r, x, z, core + 0.3);
}
function campusLot(r: Rng, x: number, z: number) {
  if (r.chance(0.65)) {
    const glass = r.chance(0.6);
    tryBuilding(
      x,
      z,
      r.range(20, 28),
      r.range(14, 22),
      r.range(18, 38),
      glass ? r.pick(GLASS) : r.pick(OFFICE),
      glass ? STYLE.glass : STYLE.office,
    );
  }
  for (let i = 0; i < 3; i++) if (r.chance(0.7)) tree(r, x + r.range(-16, 16), z + r.range(-16, 16));
}
function houseLot(r: Rng, x: number, z: number) {
  const along = r.chance(0.5);
  for (let i = 0; i < 4; i++) {
    const u = -11 + i * 7.3;
    const [bx, bz] = along ? [x + u, z] : [x, z + u];
    const [w, d] = along ? [6.8, 13] : [13, 6.8];
    if (!clear(bx, bz, w, d, 1)) continue;
    const h = r.range(6.5, 9.5);
    building(bx, bz, w, d, h, r.pick(HOUSE), STYLE.house);
    put({
      p: 'roof',
      x: bx,
      y: h,
      z: bz,
      sx: w + 0.6,
      sy: 2,
      sz: d + 0.6,
      ry: along ? Math.PI / 2 : 0,
      c: r.pick(ROOF),
    });
  }
  if (r.chance(0.7)) tree(r, x + r.range(-14, 14), z + (along ? 12 : r.range(-14, 14)));
}
function industryLot(r: Rng, x: number, z: number) {
  if (r.chance(0.7))
    tryBuilding(x, z, r.range(22, 32), r.range(18, 30), r.range(9, 15), r.pick(INDUSTRY), STYLE.industry);
  if (r.chance(0.2)) {
    const h = r.range(18, 40);
    const px = x + r.range(-12, 12),
      pz = z + r.range(-12, 12);
    if (clear(px, pz, 4, 4)) {
      put({ p: 'cyl', x: px, y: h / 2, z: pz, sx: 1.4, sy: h, sz: 1.4, ry: 0, c: '#c9c3b8' });
      putCol(px, pz, 1.4, 1.4);
    }
  }
  if (r.chance(0.15)) {
    const px = x + r.range(-10, 10),
      pz = z + r.range(-10, 10);
    if (clear(px, pz, 12, 12)) {
      put({ p: 'cyl', x: px, y: 5, z: pz, sx: 6, sy: 10, sz: 6, ry: 0, c: '#e2e0da' });
      putCol(px, pz, 6, 6);
    }
  }
}
function forestLot(r: Rng, x: number, z: number, n: number) {
  for (let i = 0; i < n; i++) {
    const px = x + r.range(-17, 17),
      pz = z + r.range(-17, 17);
    if (!nearRoad(px, pz, 2) && !nearTrack(px, pz, 2)) tree(r, px, pz, r.range(1, 1.5));
  }
}
function kampungLot(r: Rng, x: number, z: number) {
  if (r.chance(0.35) && clear(x, z, 8, 7)) {
    const h = 3.2;
    building(x, z, 7, 6, h, r.pick(['#c9a878', '#d8c3a0', '#b89568']), STYLE.house);
    put({ p: 'roof', x, y: h, z, sx: 8, sy: 1.8, sz: 7, ry: 0, c: '#8a6a4a' });
  }
  forestLot(r, x, z, 4);
}

function lot(ix: number, iz: number) {
  const x = (ix + 0.5) * LOT,
    z = (iz + 0.5) * LOT;
  const land: Land = landAt(x, z);
  if (land === 'sea' || land === 'water') return;
  const r = rng(hash('lot', ix, iz));
  if (land === 'beach') {
    if (r.chance(0.5)) palm(r, x + r.range(-15, 15), z + r.range(-15, 15));
    return;
  }
  if (land === 'forest') return forestLot(r, x, z, r.int(4, 7));
  if (land === 'park') return forestLot(r, x, z, r.int(1, 3));
  if (land === 'airport') return;
  if (land === 'industry') return industryLot(r, x, z);
  const t = townIn(x, z);
  if (t) {
    const core = Math.hypot(x - t.x, z - t.z) / t.r;
    switch (t.kind) {
      case 'hdb':
        return hdbLot(
          r,
          x,
          z,
          ['punggol', 'sengkang', 'clementi', 'tampines', 'woodlands', 'bishan'].includes(t.id),
          core,
        );
      case 'lowhdb':
        return void tryBuilding(x, z, 26, 10, r.range(12, 15), r.pick(['#efe6d2', '#e8e0c8', '#f2ead8']), STYLE.hdb);
      case 'cbd':
        return towerLot(r, x, z, core);
      case 'mall':
        return mallLot(r, x, z, core);
      case 'shophouse':
        return shophouseLot(r, x, z);
      case 'mixed':
        return mixedLot(r, x, z, core);
      case 'campus':
        return campusLot(r, x, z);
      case 'civic':
        if (r.chance(0.5)) {
          if (clear(x, z, 28, 18)) {
            building(x, z, 28, 18, 14, '#f1ede2', STYLE.office);
            put({ p: 'roof', x, y: 14, z, sx: 29, sy: 3, sz: 19, ry: 0, c: '#9c4a34' });
          }
        } else forestLot(r, x, z, 2);
        return;
      case 'park':
        return forestLot(r, x, z, r.int(2, 5));
      case 'resort':
        if (r.chance(0.15)) tryBuilding(x, z, 24, 16, r.range(18, 36), r.pick(HOUSE), STYLE.office);
        return forestLot(r, x, z, r.int(2, 4));
      case 'kampung':
        return kampungLot(r, x, z);
      case 'industrial':
        return industryLot(r, x, z);
      case 'lowrise':
        return houseLot(r, x, z);
      case 'airport':
      case 'landmark':
        return; // authored below
    }
  }
  // Between towns: estates near them, houses and greenery further out.
  const { d } = nearestTown(x, z);
  const u = r.next();
  if (d < 90) {
    if (u < 0.5) return hdbLot(r, x, z, false, 1);
    if (u < 0.75) return houseLot(r, x, z);
    return forestLot(r, x, z, r.int(1, 3));
  }
  if (u < 0.35) return forestLot(r, x, z, r.int(2, 5));
  if (u < 0.65) return houseLot(r, x, z);
  if (u < 0.8) return hdbLot(r, x, z, false, 1);
  if (u < 0.9) return industryLot(r, x, z);
}

/* ---------- authored landmarks (blockout) ---------- */

/** Changi Airport: terminals, the glass dome, the control tower and the two runways. */
function airport() {
  const [ax, az] = toGame(1.3574, 103.9884);
  // Terminals round the MRT station (which stands in the middle), clear of its stairs.
  const T = (dx: number, dz: number, w: number, d: number, h: number) =>
    tryBuilding(ax + dx, az + dz, w, d, h, '#d8dde0', STYLE.terminal);
  T(-105, 5, 60, 32, 16); // T1
  T(10, 100, 34, 70, 16); // T2
  T(-25, -100, 76, 32, 18); // T3
  // The dome with the indoor waterfall (Jool), in front of T1.
  const jx = ax - 95,
    jz = az - 70;
  put({ p: 'dome', x: jx, y: 0, z: jz, sx: 40, sy: 30, sz: 40, ry: 0, c: '#a9d0de' });
  putCol(jx, jz, 28, 28);
  put({ p: 'cyl', x: ax + 55, y: 30, z: az + 40, sx: 3, sy: 60, sz: 3, ry: 0, c: '#e8e8e4' });
  put({ p: 'cyl', x: ax + 55, y: 62, z: az + 40, sx: 7, sy: 6, sz: 7, ry: 0, c: '#5c7f96' });
  putCol(ax + 55, az + 40, 3, 3);
  // Runways, running a little east of north.
  for (const [la0, lo0, la1, lo1] of [
    [1.335, 103.99, 1.372, 104.0],
    [1.332, 104.004, 1.368, 104.015],
  ]) {
    const [x0, z0] = toGame(la0, lo0),
      [x1, z1] = toGame(la1, lo1);
    strip('road', x0, z0, x1, z1, 16, 0, 0.07, '#55585c');
    strip('road', x0, z0, x1, z1, 0.8, 0.02, 0.07, '#e8e4d8');
  }
}

/** Marina Bay: the three-tower hotel and its sky park (Marina Bay Stands), at a gentler scale. */
function marinaBay() {
  const [mx, mz] = toGame(1.2826, 103.8607);
  // Three towers in a row running north–south, joined by the sky park on top.
  for (const dz of [-38, 0, 38]) {
    building(mx - 6, mz + dz, 22, 18, 170, '#c8ccc6', STYLE.glass);
    building(mx + 8, mz + dz, 10, 18, 160, '#b7bcb6', STYLE.glass);
  }
  put({ p: 'solid', x: mx + 2, y: 172, z: mz, sx: 34, sy: 5, sz: 150, ry: 0, c: '#dcdcd4' });
  put({ p: 'crown', x: mx + 2, y: 176, z: mz + 70, sx: 7, sy: 3, sz: 7, ry: 0, c: '#4f8f45' });
  // The podium mall along the water.
  building(mx - 34, mz, 20, 110, 14, '#e2e0d8', STYLE.mall);
  // The durian domes on the other side of the bay.
  const [ex, ez] = toGame(1.2898, 103.8558);
  for (const [dx, s] of [
    [-10, 20],
    [16, 16],
  ] as [number, number][]) {
    put({ p: 'crown', x: ex + dx, y: 2, z: ez, sx: s, sy: s * 0.55, sz: s * 1.2, ry: 0.4, c: '#b7a98a' });
    putCol(ex + dx, ez, s * 0.8, s * 0.9);
  }
}

/* ---------- build ---------- */

let built = false;
export function generateCity() {
  if (built) return;
  built = true;
  townStreets();
  airport();
  marinaBay();
  for (let ix = Math.floor(BOUNDS.x0 / LOT); ix < Math.ceil(BOUNDS.x1 / LOT); ix++)
    for (let iz = Math.floor(BOUNDS.z0 / LOT); iz < Math.ceil(BOUNDS.z1 / LOT); iz++) lot(ix, iz);
  // Roads: every segment, cut into pieces per chunk; expressways get a pale divider.
  for (const s of allSegs) {
    const col = s.road.kind === 'street' ? '#5a5d61' : '#484b50';
    strip('road', s.ax, s.az, s.bx, s.bz, s.w, 0, 0.08, col);
    if (s.road.kind === 'expressway') strip('road', s.ax, s.az, s.bx, s.bz, 0.5, 0.01, 0.1, '#d8d4c8');
  }
}
