/* The city generator. The island is cut into 36 m lots; each lot decides what
   stands on it from the ground (landAt), the town around it (its kind and how
   near its centre) and its own seed, keeping clear of roads, town streets and
   the MRT viaduct. The result is plain data, grouped into 128 m chunks: items
   (boxes and shapes for the pools), colliders and floors. Chunks are turned into
   instances only when the player comes near (stream.ts). Seeds come from the
   lot's position, so the city is the same every time and in any build order. */
import { hash, rng, type Rng } from '../core/util';
import { TOWNS, landAt, segDist, type Land, type Town, BOUNDS } from './geo';
import { addRoad, allSegs, nearRoad, segsNear, type Road } from './roads';
import { nearTrack, EWL } from './mrtdata';
import { sign } from '../render/signs';
import { STYLE } from './facade';
import {
  CHOPEE_HQ,
  CLEMENTI_HAWKER,
  LAU_PA_SAT,
  CITY_OFFICE,
  BOAT_QUAY,
  HOME_SITES,
  MOSQUE,
  TEKKA,
  TB_MARKET,
  HAJI_LANE,
  CT_MARKET,
  LUCKY,
  EMBASSY,
  GETAI,
  KATONG_ROW,
  LAGOON,
  CABLE,
  ZOO,
  CHECKPOINT,
  DRIVE_CENTRE,
  DEALER,
  PETROL,
} from '../places/sites';

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
/** The walk-in places' footprints [x0, x1, z0, z1]: town streets stop short of them. */
function placeRects(): [number, number, number, number][] {
  const r: [number, number, number, number][] = [];
  const box = (o: { x: number; z: number; w: number; d: number }) =>
    r.push([o.x - o.w / 2, o.x + o.w / 2, o.z - o.d / 2, o.z + o.d / 2]);
  for (const o of [
    CLEMENTI_HAWKER,
    LAU_PA_SAT,
    MOSQUE,
    TEKKA,
    TB_MARKET,
    EMBASSY,
    LAGOON,
    ZOO,
    CHECKPOINT,
    DRIVE_CENTRE,
  ])
    box(o);
  for (const o of HOME_SITES) box(o);
  for (const o of [CHOPEE_HQ, CITY_OFFICE, BOAT_QUAY, HAJI_LANE, CT_MARKET, LUCKY, KATONG_ROW])
    r.push([o.x0, o.x1, o.z0, o.z1]);
  return r;
}
/** Town streets: every third lot line through built-up towns, clipped to the town's circle and cut where
    they would run through a walk-in place (so the traffic on them never drives through one). */
function townStreets() {
  const rects = placeRects();
  const M = 3.5 + 1.5; // half the street, and a kerb
  const blocked = (x: number, z: number) =>
    rects.some(([x0, x1, z0, z1]) => x > x0 - M && x < x1 + M && z > z0 - M && z < z1 + M);
  for (const t of TOWNS) {
    if (STREETLESS.has(t.kind)) continue;
    const add = ([[ax, az], [bx, bz]]: [number, number][]) => {
      // The pieces of the line that stay clear of the places, 1 m at a time; short stubs are dropped.
      const len = Math.hypot(bx - ax, bz - az);
      let start = -1;
      for (let d = 0; d <= Math.ceil(len) + 1; d++) {
        const f = Math.min(1, d / len);
        const free = d <= len && !blocked(ax + (bx - ax) * f, az + (bz - az) * f);
        if (free && start < 0) start = d;
        if (!free && start >= 0) {
          const end = Math.min(d - 1, len);
          if (end - start > 20) {
            const f0 = start / len,
              f1 = end / len;
            const pts: [number, number][] = [
              [ax + (bx - ax) * f0, az + (bz - az) * f0],
              [ax + (bx - ax) * f1, az + (bz - az) * f1],
            ];
            addRoad({ name: `${t.name} street`, kind: 'street', w: 7, pts } as Road);
          }
          start = -1;
        }
      }
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
  return !nearTrack(x, z, Math.hypot(hw, hd) + m) && !isReserved(x, z, Math.hypot(hw, hd));
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
    if (!nearRoad(px, pz, 2) && !nearTrack(px, pz, 2) && !isReserved(px, pz, 2)) tree(r, px, pz, r.range(1, 1.5));
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

/** Hand-placed landmarks keep ordinary lots off their ground. */
const reserved: [number, number, number][] = [];
const reserve = (x: number, z: number, r: number) => reserved.push([x, z, r]);
function isReserved(x: number, z: number, m: number) {
  for (const [rx, rz, r] of reserved) if (Math.hypot(x - rx, z - rz) < r + m) return true;
  return false;
}
/** A landmark sign on a pole or a wall. */
function landmarkSign(
  text: string,
  sub: string,
  x: number,
  y: number,
  z: number,
  ry: number,
  bg = '#1d2b36',
  fg = '#ffffff',
) {
  sign({ text, sub, w: 6, h: 1.4, bg, fg, border: fg, font: 'ui' }, x, y, z, ry, { both: true, glow: true });
}

/** Changi Airport: terminals round the MRT station, the Jool dome, the control tower and two runways. */
function airport() {
  const st = EWL.stations[0];
  const T = (x: number, z: number, w: number, d: number, h: number) => {
    building(x, z, w, d, h, '#d8dde0', STYLE.terminal);
    reserve(x, z, Math.hypot(w, d) / 2);
  };
  // T3 (the arrival hall) is walk-in: built by places/changi.ts; only its ground is kept here.
  reserve(st.x - 20, st.z - 110, 50);
  T(st.x - 150, st.z - 10, 36, 90, 16); // T1
  T(st.x - 10, st.z + 110, 90, 34, 16); // T2
  // The dome with the indoor waterfall (Jool), between the terminals.
  const jx = st.x - 110,
    jz = st.z + 100;
  put({ p: 'dome', x: jx, y: 0, z: jz, sx: 36, sy: 28, sz: 36, ry: 0, c: '#a9d0de' });
  // Walk-in: its walls, gardens and the waterfall are built by places/changi.ts.
  reserve(jx, jz, 40);
  landmarkSign('Jool', 'Changi Airport', jx, 30, jz, 0.3);
  put({ p: 'cyl', x: st.x + 70, y: 30, z: st.z + 170, sx: 3, sy: 60, sz: 3, ry: 0, c: '#e8e8e4' });
  put({ p: 'cyl', x: st.x + 70, y: 62, z: st.z + 170, sx: 7, sy: 6, sz: 7, ry: 0, c: '#5c7f96' });
  putCol(st.x + 70, st.z + 170, 3, 3);
  // Runways, running north–south along the east side.
  for (const [x, z0, z1] of [
    [1385, -250, 270],
    [1440, -140, 180],
  ]) {
    strip('road', x, z0, x, z1, 16, 0, 0.07, '#55585c');
    strip('road', x, z0, x, z1, 0.8, 0.02, 0.07, '#e8e4d8');
  }
}

/** Marina Bay: Marina Bay Stands and its sky park, the podium, the Merlion, the Flyer, the durian domes
    and the supertrees. */
function marinaBay() {
  const mx = 560,
    mz = 520;
  for (const dz of [-38, 0, 38]) {
    building(mx - 6, mz + dz, 22, 18, 170, '#c8ccc6', STYLE.glass);
    building(mx + 8, mz + dz, 10, 18, 160, '#b7bcb6', STYLE.glass);
  }
  put({ p: 'solid', x: mx + 2, y: 172, z: mz, sx: 34, sy: 5, sz: 150, ry: 0, c: '#dcdcd4' });
  for (const dz of [-60, -20, 20, 60])
    put({ p: 'crown', x: mx + 2, y: 176, z: mz + dz, sx: 4, sy: 2, sz: 4, ry: dz, c: '#4f8f45' });
  building(mx - 36, mz, 20, 110, 14, '#e2e0d8', STYLE.mall);
  reserve(mx, mz, 80);
  landmarkSign('Marina Bay Stands', 'Hotel · Sky Park · Shoppes', mx - 47, 16, mz, Math.PI / 2, '#20303a', '#e8d9a8');
  // The Merlion, spouting into the bay at the river mouth.
  const [lx, lz] = [306, 492];
  put({ p: 'solid', x: lx, y: 0.5, z: lz, sx: 10, sy: 1, sz: 10, ry: 0, c: '#c9c5bb' });
  put({ p: 'solid', x: lx, y: 3.5, z: lz, sx: 2.2, sy: 5, sz: 2.6, ry: 0.5, c: '#f2efe8' });
  put({ p: 'crown', x: lx + 0.4, y: 6.8, z: lz, sx: 1.6, sy: 1.5, sz: 1.6, ry: 0, c: '#f2efe8' });
  put({ p: 'cyl', x: lx + 3, y: 5.5, z: lz, sx: 0.25, sy: 0.25, sz: 5, ry: 0, rz: 0, c: '#bfe3f0' });
  putCol(lx, lz, 5, 5);
  reserve(lx, lz, 10);
  // The Flyer: a wheel beside the bay.
  const [fx, fz] = [610, 380],
    fr = 32,
    fy = fr + 8,
    fry = 0.9;
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const u = Math.cos(a) * fr;
    put({
      p: 'solid',
      x: fx + Math.cos(fry) * u,
      y: fy + Math.sin(a) * fr,
      z: fz - Math.sin(fry) * u,
      sx: (Math.PI * 2 * fr) / 28 + 0.4,
      sy: 0.8,
      sz: 0.8,
      ry: fry,
      rz: a + Math.PI / 2,
      c: '#e6e8ea',
    });
    if (k % 2 === 0)
      put({
        p: 'crown',
        x: fx + Math.cos(fry) * u,
        y: fy + Math.sin(a) * fr - 1.5,
        z: fz - Math.sin(fry) * u,
        sx: 1.3,
        sy: 1.1,
        sz: 1.3,
        ry: 0,
        c: '#cfe6ee',
      });
  }
  for (const s of [-1, 1])
    put({ p: 'solid', x: fx + s * 6, y: fy / 2, z: fz, sx: 1.2, sy: fy, sz: 1.2, ry: fry, rz: s * 0.25, c: '#d9dcdf' });
  put({ p: 'solid', x: fx, y: 3, z: fz, sx: 40, sy: 6, sz: 18, ry: fry, c: '#d4d0c6' });
  putCol(fx, fz, 20, 9, fry);
  reserve(fx, fz, 40);
  landmarkSign('Singapore Flyer', 'Marina Bay', fx, 8, fz + 12, fry);
  // The durian domes across the bay.
  for (const [dx, sz] of [
    [-14, 20],
    [16, 16],
  ] as [number, number][]) {
    put({ p: 'crown', x: 390 + dx, y: 2, z: 405, sx: sz, sy: sz * 0.55, sz: sz * 1.2, ry: 0.4, c: '#b7a98a' });
    putCol(390 + dx, 405, sz * 0.8, sz * 0.9);
  }
  reserve(390, 405, 35);
  // The supertrees in the gardens south of the bay.
  const r = rng(hash('supertrees'));
  for (let k = 0; k < 9; k++) {
    const x = 600 + r.range(-40, 50),
      z = 665 + r.range(-18, 20),
      h = r.range(22, 42);
    put({ p: 'cyl', x, y: h / 2, z, sx: 1.4, sy: h, sz: 1.4, ry: 0, c: '#5f4a6e' });
    put({ p: 'cyl', x, y: h * 0.8, z, sx: 2.6, sy: h * 0.3, sz: 2.6, ry: 0, c: '#6d5680' });
    put({ p: 'crown', x, y: h + 1, z, sx: 7, sy: 1.6, sz: 7, ry: r.range(0, 6), c: '#8a5f9e' });
    putCol(x, z, 1.4, 1.4);
  }
  reserve(610, 665, 55);
}

/** The other landmarks, one per district. */
function landmarks() {
  const tn = (id: string) => TOWNS.find(t => t.id === id)!;
  // Chopee's campus at Science Park, north of the drive. The headquarters' first two floors are walk-in
  // (places/chopee.ts builds them); here only the tower above them, and the other blocks.
  {
    const { x0, x1, z0, z1, h } = CHOPEE_HQ;
    const [x, z] = [(x0 + x1) / 2, (z0 + z1) / 2];
    put({
      p: 'bldg',
      x,
      y: (h + 0.35 + 34) / 2,
      z,
      sx: x1 - x0,
      sy: 34 - h - 0.35,
      sz: z1 - z0,
      ry: 0,
      c: '#ee4d2d',
      st: STYLE.glass,
    });
    putCol(x, z, (x1 - x0) / 2, (z1 - z0) / 2, 0, h, 34);
    reserve(x, z, 30);
    landmarkSign('Chopee', 'Science Park Drive', x, 30, z1 + 0.3, 0, '#ee4d2d');
    building(-560, 262, 24, 24, 26, '#f06a45', STYLE.glass);
    building(-600, 255, 22, 18, 18, '#e8e4dc', STYLE.office);
    reserve(-560, 262, 20);
    reserve(-600, 255, 16);
  }
  // The homes to rent (places/homes.ts builds the walk-in parts): the building above the ground floor,
  // which is a void deck (lift homes) or the ground-floor shell (street homes).
  for (const h of HOME_SITES) {
    const y0 = 3.4;
    put({
      p: 'bldg',
      x: h.x,
      y: (y0 + h.h) / 2,
      z: h.z,
      sx: h.w,
      sy: h.h - y0,
      sz: h.d,
      ry: 0,
      c: h.color,
      st: STYLE[h.style],
    });
    if (h.style === 'shophouse' || h.style === 'house')
      put({ p: 'roof', x: h.x, y: h.h, z: h.z, sx: h.w + 0.6, sy: 2.2, sz: h.d + 0.6, ry: 0, c: '#b5553a' });
    reserve(h.x, h.z, Math.hypot(h.w, h.d) / 2 + 4);
  }
  // NUS on Kent Ridge: a sign by the road (the campus itself is generated).
  landmarkSign('NUS', 'National University of Singapore · Kent Ridge', -820, 4, 326, Math.PI);
  // Clementi: the hawker centre and the bus interchange by the MRT (places/clementi.ts).
  reserve(CLEMENTI_HAWKER.x, CLEMENTI_HAWKER.z, 28);
  // one-north Residences: the serviced-apartment tower (its ground-floor studio is places/onenorth.ts).
  building(-532, 148, 24, 18, 46, '#e6e0d4', STYLE.office);
  reserve(-532, 158, 30);
  // Masjid Sultan: the hall is walk-in (places/centre.ts); here the golden dome and the minarets.
  {
    const { x, z, h, d } = MOSQUE;
    put({ p: 'dome', x, y: h, z, sx: 9, sy: 10, sz: 9, ry: 0, c: '#d9b24a' });
    for (const dx of [-12, 12]) {
      const mz = z + d / 2 - 1.5;
      put({ p: 'cyl', x: x + dx, y: h, z: mz, sx: 1.4, sy: 22, sz: 1.4, ry: 0, c: '#efe6cf' });
      put({ p: 'dome', x: x + dx, y: h + 11, z: mz, sx: 1.8, sy: 2.4, sz: 1.8, ry: 0, c: '#d9b24a' });
    }
    reserve(x, z, 24);
    landmarkSign('Masjid Sultan', 'Kampong Glam', x, 8, z + d / 2 + 3.2, 0, '#2f5d3a', '#e8d9a8');
  }
  // The East, Sentosa and the North (places/regions.ts builds them).
  reserve((KATONG_ROW.x0 + KATONG_ROW.x1) / 2, (KATONG_ROW.z0 + KATONG_ROW.z1) / 2, 21);
  reserve(LAGOON.x, LAGOON.z, 22);
  reserve(CABLE.ax, CABLE.az, 8);
  reserve(CABLE.bx, CABLE.bz, 8);
  reserve(ZOO.x, ZOO.z, 42);
  reserve(CHECKPOINT.x, CHECKPOINT.z, 18);
  // The driving centre, the car dealer and the petrol stations.
  reserve(DRIVE_CENTRE.x - 6, DRIVE_CENTRE.z, 40);
  reserve(DEALER.x, DEALER.z, 20);
  for (const s of PETROL) reserve(s.x, s.z, 10);
  // The embassy's compound and the getai field keep their ground clear.
  reserve(EMBASSY.x, EMBASSY.z, 20);
  reserve(GETAI.x, GETAI.z, 11);
  // The other walk-in places of the centre keep their ground clear.
  for (const k of [TEKKA, TB_MARKET]) reserve(k.x, k.z, 22);
  for (const r of [HAJI_LANE, CT_MARKET]) reserve((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2 + 3);
  // A Chinatown temple, red with stacked roofs.
  {
    const t = tn('chinatown');
    building(t.x, t.z, 24, 24, 12, '#b8342a', STYLE.house);
    for (let k = 0; k < 3; k++)
      put({ p: 'roof', x: t.x, y: 12 + k * 3.5, z: t.z, sx: 28 - k * 6, sy: 3, sz: 28 - k * 6, ry: 0, c: '#6b3a2a' });
    reserve(t.x, t.z, 22);
    landmarkSign('Buddha Tooth Temple', 'Chinatown', t.x, 5, t.z - 12.3, 0, '#8a1f17', '#f2d27a');
  }
  // Lau Pa Sat (places/cbd.ts builds the hall): its clock tower over the roof.
  {
    const { x, z } = LAU_PA_SAT;
    put({ p: 'cyl', x, y: 11, z, sx: 2.6, sy: 8, sz: 2.6, ry: 0, c: '#d9d2c3' });
    put({ p: 'crown', x, y: 15.5, z, sx: 2.2, sy: 1.6, sz: 2.2, ry: 0, c: '#8a6a4a' });
    reserve(x, z, 22);
  }
  // Chopee's city office tower at Raffles Place (the lobby and Level 30 are places/cbd.ts).
  {
    const { x0, x1, z0, z1, lobby, top } = CITY_OFFICE;
    const [x, z] = [(x0 + x1) / 2, (z0 + z1) / 2];
    put({
      p: 'bldg',
      x,
      y: (lobby + 0.35 + top) / 2,
      z,
      sx: x1 - x0,
      sy: top - lobby - 0.35,
      sz: z1 - z0,
      ry: 0,
      c: '#9fb2bd',
      st: STYLE.glass,
    });
    reserve(x, z, 24);
  }
  // Boat Quay: shophouses along the river's south bank.
  {
    const { x0, x1, z0, z1 } = BOAT_QUAY;
    const cols = ['#e8c07a', '#d98a6a', '#9fc4b8', '#e6d3a8', '#c9a0c0', '#f0e2c4'];
    let k = 0;
    for (let x = x0 + 3; x < x1 - 2; x += 6, k++) {
      const h = 9 + (k % 3);
      building(x, (z0 + z1) / 2, 5.8, z1 - z0, h, cols[k % cols.length], STYLE.shophouse);
      put({ p: 'roof', x, y: h, z: (z0 + z1) / 2, sx: 6, sy: 2, sz: z1 - z0 + 0.6, ry: Math.PI / 2, c: '#b5553a' });
    }
    reserve((x0 + x1) / 2, (z0 + z1) / 2, 8);
    for (let x = x0 + 10; x < x1; x += 20) reserve(x, (z0 + z1) / 2, 12);
  }
  // The Raffles Hotel: long, white, red roofs.
  {
    const [x, z] = [262, 205];
    building(x, z, 54, 16, 13, '#f4f1e8', STYLE.house);
    put({ p: 'roof', x, y: 13, z, sx: 56, sy: 3, sz: 18, ry: 0, c: '#b5553a' });
    reserve(x, z, 32);
    landmarkSign('Raffles Hotel', 'Beach Road', x, 5, z - 8.3, 0, '#f4f1e8', '#1d2b36');
  }
  // Orchard: EON Orchard and Lucky Place.
  {
    const t = tn('orchard');
    building(t.x - 30, t.z - 30, 40, 30, 22, '#cfd8de', STYLE.mall);
    building(t.x - 36, t.z - 36, 20, 20, 140, '#9fb2bd', STYLE.glass);
    landmarkSign('EON Orchard', 'Orchard Road', t.x - 30, 16, t.z - 14.8, 0, '#1d2b36', '#e6e6e6');
    {
      const { x0, x1, z0, z1, h } = LUCKY;
      put({
        p: 'bldg',
        x: (x0 + x1) / 2,
        y: (h + 0.35 + 24) / 2,
        z: (z0 + z1) / 2,
        sx: x1 - x0,
        sy: 24 - h - 0.35,
        sz: z1 - z0,
        ry: 0,
        c: '#e6ddc8',
        st: STYLE.mall,
      });
      landmarkSign(
        'Lucky Place',
        'Orchard Road · Toko Indonesia',
        (x0 + x1) / 2,
        14,
        z1 + 0.3,
        0,
        '#b8342a',
        '#f2d27a',
      );
    }
    reserve(t.x - 30, t.z - 30, 30);
    reserve(t.x + 48, t.z - 22, 22);
  }
  // HarbourFront's mall and the Sentosa globe.
  {
    const t = tn('harbourfront');
    building(t.x, t.z - 10, 50, 28, 18, '#e6e0d4', STYLE.mall);
    reserve(t.x, t.z - 10, 30);
    landmarkSign('VivaCity', 'HarbourFront', t.x, 12, t.z + 4.2, 0, '#f06a45');
    const [gx, gz] = [120, 830];
    put({ p: 'cyl', x: gx, y: 1, z: gz, sx: 7, sy: 2, sz: 7, ry: 0, c: '#8a969c' });
    put({ p: 'crown', x: gx, y: 9, z: gz, sx: 6.5, sy: 6.5, sz: 6.5, ry: 0.4, c: '#3f7fd0' });
    putCol(gx, gz, 7, 7);
    building(gx + 50, gz + 10, 40, 30, 20, '#f2c14e', STYLE.mall);
    building(gx + 30, gz - 30, 16, 16, 34, '#b35ec2', STYLE.house);
    reserve(gx + 25, gz, 55);
    landmarkSign('Uniworsal Studios', 'Sentosa', gx, 2.5, gz - 8, 0, '#1d2b36', '#f2c14e');
  }
}

/* ---------- build ---------- */

/** Roads drawn to end short of the one they meet: each dead end gets a short street to the nearest road
    within 60 m ahead of it (not through a walk-in place or water), drawn like any street, so buildings keep
    clear of it and the traffic on the road graph never leaves the tarmac. */
function joinDeadEnds() {
  const rects = placeRects();
  const roads = [...new Set(allSegs.map(s => s.road))];
  const ends: [number, number, number, number, Road][] = [];
  for (const r of roads) {
    const n = r.pts.length;
    if (n < 2) continue;
    ends.push([r.pts[0][0], r.pts[0][1], r.pts[1][0], r.pts[1][1], r]);
    ends.push([r.pts[n - 1][0], r.pts[n - 1][1], r.pts[n - 2][0], r.pts[n - 2][1], r]);
  }
  for (const [px, pz, qx, qz, own] of ends) {
    // Already meets another road here?
    if (segsNear(px, pz, 12).some(s => s.road !== own && segDist(px, pz, s.ax, s.az, s.bx, s.bz) < s.w / 2 + 3))
      continue;
    const dx = px - qx,
      dz = pz - qz;
    let best: [number, number] | null = null,
      bd = 60;
    for (const s of segsNear(px, pz, 60)) {
      if (s.road === own) continue;
      const vx = s.bx - s.ax,
        vz = s.bz - s.az;
      const l2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((px - s.ax) * vx + (pz - s.az) * vz) / l2));
      const cx = s.ax + vx * t,
        cz = s.az + vz * t;
      const d = Math.hypot(cx - px, cz - pz);
      if (d >= bd || (cx - px) * dx + (cz - pz) * dz < 0) continue;
      bd = d;
      best = [cx, cz];
    }
    if (!best) continue;
    const [cx, cz] = best;
    let ok = true;
    for (let f = 0; f <= 1 && ok; f += 2 / Math.max(2, bd)) {
      const x = px + (cx - px) * f,
        z = pz + (cz - pz) * f;
      const land = landAt(x, z);
      if (land === 'sea' || land === 'water') ok = false;
      if (rects.some(([x0, x1, z0, z1]) => x > x0 - 5 && x < x1 + 5 && z > z0 - 5 && z < z1 + 5)) ok = false;
      if (f > 0.1 && isReserved(x, z, 3.5)) ok = false;
    }
    if (ok)
      addRoad({
        name: own.kind === 'street' ? own.name : `${own.name} link`,
        kind: 'street',
        w: 7,
        pts: [
          [px, pz],
          [cx, cz],
        ],
      });
  }
}

/** After the streets: every piece of road that doesn't meet the rest (a street cut short by a place, a
    road drawn to end near another) gets one drawn street to the nearest point of the main network that
    it can reach in a straight line: over land, clear of the walk-in places and of the landmarks' walls. */
function joinPieces() {
  const rects = placeRects();
  const clearAt = (x: number, z: number) => {
    const land = landAt(x, z);
    if (land === 'sea' || land === 'water') return false;
    if (rects.some(([x0, x1, z0, z1]) => x > x0 - 4 && x < x1 + 4 && z > z0 - 4 && z < z1 + 4)) return false;
    const [cx, cz] = chunkOf(x, z);
    for (let i = cx - 1; i <= cx + 1; i++)
      for (let j = cz - 1; j <= cz + 1; j++)
        for (const c of getChunk(i, j)?.cols ?? []) {
          if (c.y0 > 2) continue;
          const dx = x - c.cx,
            dz = z - c.cz;
          const cs = Math.cos(c.ry),
            sn = Math.sin(c.ry);
          const lx = dx * cs - dz * sn,
            lz = dx * sn + dz * cs;
          if (Math.abs(lx) < c.hx + 3.5 && Math.abs(lz) < c.hz + 3.5) return false;
        }
    return true;
  };
  const lineClear = (ax: number, az: number, bx: number, bz: number) => {
    const d = Math.hypot(bx - ax, bz - az);
    for (let s = 4; s < d - 4; s += 1) if (!clearAt(ax + ((bx - ax) * s) / d, az + ((bz - az) * s) / d)) return false;
    return true;
  };
  for (let round = 0; round < 40; round++) {
    // Pieces: segments that cross or touch (within 3 m) are one piece.
    const segs = allSegs;
    const parent = segs.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    segs.forEach((a, i) => {
      for (const b of segsNear((a.ax + a.bx) / 2, (a.az + a.bz) / 2, Math.hypot(a.bx - a.ax, a.bz - a.az) / 2 + 4)) {
        const j = segs.indexOf(b);
        if (j <= i || find(i) === find(j)) continue;
        const touch =
          Math.min(
            segDist(a.ax, a.az, b.ax, b.az, b.bx, b.bz),
            segDist(a.bx, a.bz, b.ax, b.az, b.bx, b.bz),
            segDist(b.ax, b.az, a.ax, a.az, a.bx, a.bz),
            segDist(b.bx, b.bz, a.ax, a.az, a.bx, a.bz),
          ) < 3 || crosses(a, b);
        if (touch) parent[find(i)] = find(j);
      }
    });
    const len = new Map<number, number>();
    segs.forEach((s, i) => len.set(find(i), (len.get(find(i)) ?? 0) + Math.hypot(s.bx - s.ax, s.bz - s.az)));
    const main = [...len].sort((a, b) => b[1] - a[1])[0][0];
    // The nearest reachable link from any other piece to the main one.
    let best: [number, number, number, number] | null = null,
      bd = 160;
    segs.forEach((s, i) => {
      if (find(i) === main) return;
      const l = Math.hypot(s.bx - s.ax, s.bz - s.az);
      for (let t = 0; t <= l; t += 6) {
        const ax = s.ax + ((s.bx - s.ax) * t) / (l || 1),
          az = s.az + ((s.bz - s.az) * t) / (l || 1);
        for (const m of segsNear(ax, az, bd)) {
          if (find(segs.indexOf(m)) !== main) continue;
          const vx = m.bx - m.ax,
            vz = m.bz - m.az;
          const u = Math.max(0, Math.min(1, ((ax - m.ax) * vx + (az - m.az) * vz) / (vx * vx + vz * vz || 1)));
          const bx = m.ax + vx * u,
            bz = m.az + vz * u;
          const d = Math.hypot(bx - ax, bz - az);
          if (d < bd && lineClear(ax, az, bx, bz)) {
            bd = d;
            best = [ax, az, bx, bz];
          }
        }
      }
    });
    const link = best as [number, number, number, number] | null;
    if (!link) break;
    const [ax, az, bx, bz] = link;
    addRoad({
      name: 'Link street',
      kind: 'street',
      w: 7,
      pts: [
        [ax, az],
        [bx, bz],
      ],
    });
  }
}
function crosses(p: { ax: number; az: number; bx: number; bz: number }, q: typeof p) {
  const rx = p.bx - p.ax,
    rz = p.bz - p.az,
    sx = q.bx - q.ax,
    sz = q.bz - q.az;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return false;
  const t = ((q.ax - p.ax) * sz - (q.az - p.az) * sx) / den,
    u = ((q.ax - p.ax) * rz - (q.az - p.az) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/* ---------- street furniture (v2 step 15) ---------- */

export type FurnKind = 'vending' | 'atm' | 'bench' | 'news' | 'bikes' | 'fitness' | 'chess';
/** Something to use on the street: where, which way its front faces (unit fx, fz), and the road's direction. */
export interface Furn {
  kind: FurnKind;
  x: number;
  z: number;
  fx: number;
  fz: number;
}
export const furniture: Furn[] = [];
/** Overhead bridges: the middle of the deck and its direction across the road (for the checks and the map). */
export const bridges: { x: number; z: number; nx: number; nz: number; w: number }[] = [];

const FURN_MIX: Record<string, [FurnKind | null, number][]> = {
  hdb: [
    ['bench', 30],
    ['vending', 18],
    ['fitness', 10],
    ['chess', 10],
    ['bikes', 10],
    ['atm', 5],
    ['news', 5],
    [null, 12],
  ],
  cbd: [
    ['bench', 18],
    ['vending', 16],
    ['atm', 20],
    ['news', 16],
    ['bikes', 16],
    [null, 14],
  ],
  mall: [
    ['bench', 22],
    ['vending', 16],
    ['atm', 18],
    ['news', 12],
    ['bikes', 16],
    [null, 16],
  ],
  other: [
    ['bench', 30],
    ['vending', 18],
    ['bikes', 14],
    ['news', 8],
    ['atm', 8],
    [null, 22],
  ],
};
function pickKind(r: Rng, kind: string | undefined): FurnKind | null {
  const mix = FURN_MIX[kind === 'lowhdb' || kind === 'mixed' ? 'hdb' : (kind ?? 'other')] ?? FURN_MIX.other;
  let x = r.next() * mix.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of mix) if ((x -= w) < 0) return k;
  return null;
}
/** A collider-free spot (none of the chunks' colliders within m metres). */
export function freeAt(x: number, z: number, m: number) {
  const [cx, cz] = chunkOf(x, z);
  for (let i = cx - 1; i <= cx + 1; i++)
    for (let j = cz - 1; j <= cz + 1; j++)
      for (const c of getChunk(i, j)?.cols ?? []) {
        if (c.y0 > 2) continue;
        const dx = x - c.cx,
          dz = z - c.cz;
        const cs = Math.cos(c.ry),
          sn = Math.sin(c.ry);
        if (Math.abs(dx * cs - dz * sn) < c.hx + m && Math.abs(dx * sn + dz * cs) < c.hz + m) return false;
      }
  return true;
}
/** Free-standing mural walls near the heritage districts (the Explore app's murals), their ground kept free. */
export const muralSpots: { name: string; x: number; z: number; ry: number }[] = [];
function muralGround() {
  const anchors: [string, number, number][] = [
    ['Chinatown', (CT_MARKET.x0 + CT_MARKET.x1) / 2, CT_MARKET.z1 + 10],
    ['Haji Lane', (HAJI_LANE.x0 + HAJI_LANE.x1) / 2, HAJI_LANE.z1 + 14],
    ['Tiong Bahru', TB_MARKET.x, TB_MARKET.z + TB_MARKET.d / 2 + 12],
    ['Little India', TEKKA.x, TEKKA.z - TEKKA.d / 2 - 12],
    ['Kampong Glam', MOSQUE.x - MOSQUE.w / 2 - 14, MOSQUE.z],
    ['Katong', (KATONG_ROW.x0 + KATONG_ROW.x1) / 2, KATONG_ROW.z1 + 14],
  ];
  for (const [name, ax, az] of anchors) {
    const r = rng(hash('mural', name));
    for (let k = 0; k < 40; k++) {
      const a = r.range(0, Math.PI * 2),
        d = k === 0 ? 0 : r.range(4, 30);
      const x = ax + Math.cos(a) * d,
        z = az + Math.sin(a) * d;
      const land = landAt(x, z);
      if ((land !== 'urban' && land !== 'park') || isReserved(x, z, 4) || nearTrack(x, z, 6) || !freeAt(x, z, 4.5))
        continue;
      if (segsNear(x, z, 12).some(o => segDist(x, z, o.ax, o.az, o.bx, o.bz) < o.w / 2 + 3)) continue;
      // Face the nearest road, so it's seen from the street.
      let best = 1e9,
        ry = 0;
      for (const o of segsNear(x, z, 60)) {
        const vx = o.bx - o.ax,
          vz = o.bz - o.az;
        const t = Math.max(0, Math.min(1, ((x - o.ax) * vx + (z - o.az) * vz) / (vx * vx + vz * vz || 1)));
        const cx = o.ax + vx * t,
          cz = o.az + vz * t;
        const dd = Math.hypot(cx - x, cz - z);
        if (dd < best) {
          best = dd;
          ry = Math.atan2(cx - x, cz - z);
        }
      }
      reserve(x, z, 5);
      muralSpots.push({ name, x, z, ry });
      putCol(x, z, 3.1, 0.2, ry); // the wall runs across its facing (cos ry, −sin ry)
      break;
    }
  }
}
/** The community centre in Clementi (a badminton hall and the karaoke room, game/gigs): ground kept free. */
export const ccSpot = { x: 0, z: 0, ok: false };
function ccGround() {
  const t = TOWNS.find(t => t.name === 'Clementi');
  if (!t) return;
  const r = rng(hash('cc-spot'));
  for (let k = 0; k < 80; k++) {
    const a = r.range(0, Math.PI * 2),
      d = r.range(25, t.r * 0.8);
    const x = t.x + Math.cos(a) * d,
      z = t.z + Math.sin(a) * d;
    if (landAt(x, z) !== 'urban' || isReserved(x, z, 16) || nearTrack(x, z, 18) || !freeAt(x, z, 16)) continue;
    if (segsNear(x, z, 30).some(o => segDist(x, z, o.ax, o.az, o.bx, o.bz) < o.w / 2 + 14)) continue;
    reserve(x, z, 17);
    Object.assign(ccSpot, { x, z, ok: true });
    return;
  }
}
/** A spot per HDB town for a void-deck tent (weddings and wakes, game/incidents), its ground kept free. */
export const tentSpots: { town: string; x: number; z: number }[] = [];
function tentGround() {
  for (const t of TOWNS) {
    if (!['hdb', 'lowhdb', 'mixed'].includes(t.kind as string)) continue;
    const r = rng(hash('tent-spot', t.name));
    for (let k = 0; k < 40; k++) {
      const a = r.range(0, Math.PI * 2),
        d = r.range(20, t.r * 0.6);
      const x = t.x + Math.cos(a) * d,
        z = t.z + Math.sin(a) * d;
      if (landAt(x, z) !== 'urban' || isReserved(x, z, 8) || nearTrack(x, z, 10) || !freeAt(x, z, 7)) continue;
      if (segsNear(x, z, 16).some(o => segDist(x, z, o.ax, o.az, o.bx, o.bz) < o.w / 2 + 8)) continue;
      reserve(x, z, 9);
      tentSpots.push({ town: t.name, x, z });
      break;
    }
  }
}
/** Street things every 30 m along the town roads (not the expressways), on the kerb, facing the road. */
function streetThings() {
  const segs = allSegs.filter(s => s.road.kind !== 'expressway');
  segs.forEach((s, si) => {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    if (len < 30) return;
    const ux = (s.bx - s.ax) / len,
      uz = (s.bz - s.az) / len;
    const nx = -uz,
      nz = ux;
    for (let d = 16, k = 0; d < len - 12; d += 30, k++) {
      const r = rng(hash('furn', si, k));
      const mx = s.ax + ux * d,
        mz = s.az + uz * d;
      const t = townIn(mx, mz);
      if (!t || ['park', 'resort', 'kampung', 'airport', 'industrial'].includes(t.kind)) continue;
      // Not at a junction: no other road within 14 m of this point.
      if (
        segsNear(mx, mz, 16).some(
          o => o !== s && o.road !== s.road && segDist(mx, mz, o.ax, o.az, o.bx, o.bz) < o.w / 2 + 12,
        )
      )
        continue;
      const kind = pickKind(r, t.kind as string);
      if (!kind) continue;
      const side = r.chance(0.5) ? 1 : -1;
      const back = kind === 'fitness' || kind === 'chess' ? s.w / 2 + 4.2 : s.w / 2 + 0.75;
      const x = mx + nx * side * back,
        z = mz + nz * side * back;
      const land = landAt(x, z);
      if (land === 'sea' || land === 'water' || isReserved(x, z, 3) || nearTrack(x, z, 4)) continue;
      const big = kind === 'fitness' || kind === 'chess';
      if (!freeAt(x, z, big ? 1 : 0.2)) continue;
      // The buildings (placed after) keep off the bigger ones.
      if (big) reserve(x, z, 3.2);
      // Not on another road.
      if (segsNear(x, z, 12).some(o => o !== s && segDist(x, z, o.ax, o.az, o.bx, o.bz) < o.w / 2 + 1.2)) continue;
      const fx = -nx * side,
        fz = -nz * side;
      furniture.push({ kind, x, z, fx, fz });
      furnVisual(kind, x, z, fx, fz, r);
    }
  });
}
function furnVisual(kind: FurnKind, x: number, z: number, fx: number, fz: number, r: Rng) {
  // Local frame: along the road (ax, az) and the front (fx, fz).
  const ax = -fz,
    az = fx;
  const ry = Math.atan2(-az, ax); // local x along the road
  const at = (a: number, f: number): [number, number] => [x + ax * a + fx * f, z + az * a + fz * f];
  const bx = (a: number, f: number, y0: number, w: number, h: number, d: number, c: string, p: PoolName = 'solid') => {
    const [px, pz] = at(a, f);
    put({ p, x: px, y: y0 + h / 2, z: pz, sx: w, sy: h, sz: d, ry, c });
  };
  if (kind === 'vending') {
    for (const [a, c] of [
      [-0.55, r.pick(['#d7263d', '#2f6fb3'])],
      [0.55, r.pick(['#3f7d3a', '#f2c14e', '#e07a1f'])],
    ] as const) {
      bx(a, 0, 0, 1, 1.9, 0.8, c);
      bx(a, 0.41, 0.9, 0.7, 0.8, 0.02, '#e8f4f8', 'glass');
    }
    putCol(x, z, 1.1, 0.45, ry);
  } else if (kind === 'atm') {
    bx(0, 0, 0, 0.9, 1.8, 0.7, '#1d4f91');
    bx(0, 0.36, 1.1, 0.5, 0.35, 0.02, '#9fd3e8', 'glass');
    bx(0, 0.4, 0.95, 0.5, 0.06, 0.2, '#3a4046');
    putCol(x, z, 0.5, 0.4, ry);
  } else if (kind === 'news') {
    bx(0, 0, 0, 1.6, 1.3, 0.9, '#3f7d3a');
    bx(0, 0, 2.2, 2.0, 0.12, 1.3, '#2f5a2a');
    for (const a of [-0.9, 0.9]) bx(a, -0.3, 0, 0.08, 2.2, 0.08, '#3a4046');
    for (let k = 0; k < 4; k++)
      bx(-0.6 + k * 0.4, 0.47, 0.9, 0.3, 0.4, 0.02, ['#f4f1ea', '#f2c14e', '#e8a0b8', '#9fd3c7'][k]);
    putCol(x, z, 0.85, 0.5, ry);
  } else if (kind === 'bench') {
    bx(0, 0, 0.42, 1.8, 0.07, 0.45, '#8a6a4a');
    bx(0, -0.24, 0.49, 1.8, 0.45, 0.06, '#8a6a4a');
    for (const a of [-0.8, 0.8]) bx(a, 0, 0, 0.08, 0.42, 0.4, '#3a4046');
    putCol(x, z, 0.95, 0.3, ry, -1e9, 0.5);
  } else if (kind === 'bikes') {
    bx(0, -0.35, 0, 3.2, 0.7, 0.08, '#8e969c');
    for (let k = 0; k < 3; k++) {
      const a = -1 + k,
        c = r.pick(['#f2c14e', '#e07a1f', '#3fa7d6']);
      for (const w of [-0.5, 0.5]) {
        const [px, pz] = at(a, w);
        put({
          p: 'cyl',
          x: px,
          y: 0.34,
          z: pz,
          sx: 0.68,
          sy: 0.05,
          sz: 0.68,
          ry: ry + Math.PI / 2,
          rz: Math.PI / 2,
          c: '#1d1f22',
        });
      }
      bx(a, 0, 0.45, 0.06, 0.08, 1.0, c);
      bx(a, 0.45, 0.62, 0.45, 0.05, 0.06, '#3a4046');
      bx(a, -0.3, 0.72, 0.1, 0.06, 0.22, '#1d1f22');
    }
  } else if (kind === 'fitness') {
    for (const a of [-1.2, 1.2]) bx(a, 0, 0, 0.12, 2.3, 0.12, '#f2c14e');
    bx(0, 0, 2.2, 2.5, 0.08, 0.08, '#e07a1f');
    bx(0, -1.6, 0, 1.8, 0.45, 0.5, '#2f6fb3');
    bx(0, 1.4, 0, 0.12, 1.2, 0.12, '#f2c14e');
    bx(0, 1.4, 1.2, 0.9, 0.08, 0.08, '#e07a1f');
    bx(0, 0, 0, 5, 0.05, 4.5, '#c98a4a');
  } else if (kind === 'chess') {
    const [px, pz] = at(0, 0);
    put({ p: 'cyl', x: px, y: 0.37, z: pz, sx: 1.1, sy: 0.74, sz: 1.1, ry: 0, c: '#b9b4aa' });
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      put({
        p: 'cyl',
        x: px + Math.cos(a) * 1.0,
        y: 0.22,
        z: pz + Math.sin(a) * 1.0,
        sx: 0.4,
        sy: 0.44,
        sz: 0.4,
        ry: 0,
        c: '#b9b4aa',
      });
    }
    bx(0, 0, 0.745, 0.6, 0.01, 0.6, '#e8d9b8');
    putCol(x, z, 0.55, 0.55, 0, -1e9, 0.75);
  }
}
/** Overhead bridges across the busier roads in the towns: stairs up both sides, a covered deck at 5.6 m. */
function overheadBridges() {
  const H = 5.6,
    L = 9,
    SW = 2.2;
  const segs = allSegs.filter(s => s.w >= 9);
  segs.forEach((s, si) => {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    if (len < 60) return;
    const ux = (s.bx - s.ax) / len,
      uz = (s.bz - s.az) / len;
    const nx = -uz,
      nz = ux;
    const half = s.w / 2 + 3.6;
    // The first good spot along the road: in a busy town, away from junctions and other bridges, stairs on land.
    let mx = 0,
      mz = 0,
      found = false;
    for (let d = 30; d < len - 30 && !found; d += 20) {
      mx = s.ax + ux * d;
      mz = s.az + uz * d;
      const t = townIn(mx, mz);
      if (!t || !['cbd', 'mall', 'hdb', 'mixed', 'shophouse'].includes(t.kind as string)) continue;
      if (bridges.some(b => Math.hypot(b.x - mx, b.z - mz) < 220)) continue;
      if (rng(hash('bridge', si, d)).next() < 0.3) continue;
      if (segsNear(mx, mz, 30).some(o => o.road !== s.road && segDist(mx, mz, o.ax, o.az, o.bx, o.bz) < o.w / 2 + 16))
        continue;
      let ok = true;
      for (const side of [-1, 1])
        for (let e = -1.2; e <= L + 1.2 && ok; e += 2) {
          const x = mx + nx * side * (s.w / 2 + 2.4) + ux * e,
            z = mz + nz * side * (s.w / 2 + 2.4) + uz * e;
          const land = landAt(x, z);
          if (land === 'sea' || land === 'water' || isReserved(x, z, 2) || nearTrack(x, z, 4) || !freeAt(x, z, 1))
            ok = false;
          else if (segsNear(x, z, 10).some(o => o !== s && segDist(x, z, o.ax, o.az, o.bx, o.bz) < o.w / 2 + 1))
            ok = false;
        }
      found = ok;
    }
    if (!found) return;
    // The buildings (placed after) keep off the landings and stairs.
    for (const side of [-1, 1])
      for (let e = 0; e <= L + 1.2; e += 3)
        reserve(mx + nx * side * (s.w / 2 + 2.4) + ux * e, mz + nz * side * (s.w / 2 + 2.4) + uz * e, 2.4);
    bridges.push({ x: mx, z: mz, nx, nz, w: s.w });
    const ryN = Math.atan2(-nz, nx),
      ryU = Math.atan2(-uz, ux);
    // The deck across the road (covering the landings), with a roof and railings.
    put({ p: 'solid', x: mx, y: H - 0.2, z: mz, sx: half * 2, sy: 0.4, sz: 2.4, ry: ryN, c: '#c9c5bb' });
    put({ p: 'solid', x: mx, y: H + 2.7, z: mz, sx: half * 2, sy: 0.12, sz: 2.8, ry: ryN, c: '#6d7a80' });
    putFloor(mx, mz, half, 1.2, ryN, H);
    // Railings: the full length on the far side; over the road only on the stairs' side (the landings open onto them).
    for (const e of [-1.15, 1.15]) {
      const ex = mx + ux * e,
        ez = mz + uz * e;
      const hl = e < 0 ? half : s.w / 2 + 1.2;
      put({ p: 'solid', x: ex, y: H + 0.55, z: ez, sx: hl * 2, sy: 1.1, sz: 0.08, ry: ryN, c: '#8e969c' });
      putCol(ex, ez, hl, 0.08, ryN, H - 0.5, H + 1.2);
    }
    for (const side of [-1, 1]) {
      const lx = mx + nx * side * (s.w / 2 + 2.4),
        lz = mz + nz * side * (s.w / 2 + 2.4);
      // The outer end of the deck is closed; the stair leaves along the road.
      put({
        p: 'solid',
        x: lx + nx * side * 1.2,
        y: H + 0.55,
        z: lz + nz * side * 1.2,
        sx: 2.4,
        sy: 1.1,
        sz: 0.08,
        ry: ryU,
        c: '#8e969c',
      });
      putCol(lx + nx * side * 1.2, lz + nz * side * 1.2, 1.2, 0.08, ryU, H - 0.5, H + 1.2);
      for (const e of [-1, 1])
        put({
          p: 'cyl',
          x: lx + nx * side * 0.9 + ux * e * 0.9,
          y: (H + 2.7) / 2,
          z: lz + nz * side * 0.9 + uz * e * 0.9,
          sx: 0.25,
          sy: H + 2.7,
          sz: 0.25,
          ry: 0,
          c: '#b9b4aa',
        });
      // The stair: from the landing (u = 1.2) down to the street (u = 1.2 + L).
      const sx = lx + ux * (1.2 + L / 2),
        sz = lz + uz * (1.2 + L / 2);
      const slope = Math.atan2(H, L);
      put({
        p: 'solid',
        x: sx,
        y: H / 2 - 0.18,
        z: sz,
        sx: Math.hypot(L, H) + 0.3,
        sy: 0.35,
        sz: SW,
        ry: ryU,
        rz: -slope,
        c: '#bdb8ae',
      });
      putFloor(sx, sz, L / 2, SW / 2, ryU, H, 0);
      for (const e of [-1, 1]) {
        const rx = sx + nx * e * (SW / 2 + 0.05),
          rz = sz + nz * e * (SW / 2 + 0.05);
        put({
          p: 'solid',
          x: rx,
          y: H / 2 + 0.9,
          z: rz,
          sx: Math.hypot(L, H),
          sy: 0.08,
          sz: 0.08,
          ry: ryU,
          rz: -slope,
          c: '#8e969c',
        });
        putCol(rx, rz, L / 2, 0.08, ryU, 0.6, H + 1.2);
      }
    }
  });
}

let built = false;
export function generateCity() {
  if (built) return;
  built = true;
  // The landmarks first (they reserve their ground), then the streets that stop short of the places.
  airport();
  marinaBay();
  landmarks();
  townStreets();
  joinDeadEnds();
  joinPieces();
  // Bridges and street things before the lots, so the buildings keep off them.
  overheadBridges();
  streetThings();
  ccGround();
  tentGround();
  muralGround();
  for (let ix = Math.floor(BOUNDS.x0 / LOT); ix < Math.ceil(BOUNDS.x1 / LOT); ix++)
    for (let iz = Math.floor(BOUNDS.z0 / LOT); iz < Math.ceil(BOUNDS.z1 / LOT); iz++) lot(ix, iz);
  // Roads: every segment, cut into pieces per chunk; expressways get a pale divider.
  for (const s of allSegs) {
    const col = s.road.kind === 'street' ? '#5a5d61' : '#484b50';
    strip('road', s.ax, s.az, s.bx, s.bz, s.w, 0, 0.08, col);
    if (s.road.kind === 'expressway') strip('road', s.ax, s.az, s.bx, s.bz, 0.5, 0.01, 0.1, '#d8d4c8');
  }
}
