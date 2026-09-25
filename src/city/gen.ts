/* The city generator. The island is cut into 36 m lots; each lot decides what
   stands on it from the ground (landAt), the town around it (its kind and how
   near its centre) and its own seed, keeping clear of roads, town streets and
   the MRT viaduct. The result is plain data, grouped into 128 m chunks: items
   (boxes and shapes for the pools), colliders and floors. Chunks are turned into
   instances only when the player comes near (stream.ts). Seeds come from the
   lot's position, so the city is the same every time and in any build order. */
import { hash, rng, type Rng } from '../core/util';
import { TOWNS, landAt, type Land, type Town, BOUNDS } from './geo';
import { addRoad, allSegs, nearRoad, type Road } from './roads';
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

let built = false;
export function generateCity() {
  if (built) return;
  built = true;
  townStreets();
  airport();
  marinaBay();
  landmarks();
  for (let ix = Math.floor(BOUNDS.x0 / LOT); ix < Math.ceil(BOUNDS.x1 / LOT); ix++)
    for (let iz = Math.floor(BOUNDS.z0 / LOT); iz < Math.ceil(BOUNDS.z1 / LOT); iz++) lot(ix, iz);
  // Roads: every segment, cut into pieces per chunk; expressways get a pale divider.
  for (const s of allSegs) {
    const col = s.road.kind === 'street' ? '#5a5d61' : '#484b50';
    strip('road', s.ax, s.az, s.bx, s.bz, s.w, 0, 0.08, col);
    if (s.road.kind === 'expressway') strip('road', s.ax, s.az, s.bx, s.bz, 0.5, 0.01, 0.1, '#d8d4c8');
  }
}
