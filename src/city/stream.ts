/* Streaming the city. Chunks within the load radius of the player are turned
   into pool instances (plus their ground tiles, colliders and floors); chunks
   that fall behind are given back. Loading is spread over frames within a small
   time budget, nearest first, so a fast train never stalls a frame. Beyond the
   loaded chunks the island is drawn cheaply: one flat mesh of the island's shape
   for the ground, a sea plane, and a skyline of every tall building (hidden
   while its own chunk is loaded, so nothing draws twice). */
import * as THREE from 'three';
import { scene, fog } from '../render/context';
import { prismGeo } from '../render/batch';
import { addRotCol, type Collider } from '../core/collision';
import { addFloor, type Floor } from '../core/levels';
import { SETTINGS } from '../core/settings';
import { env, envHooks } from '../render/lighting';
import { Pool } from './pool';
import { facade } from './facade';
import { CHUNK, allChunks, chunkKey, getChunk, groundAt, type ChunkData, type Item, type PoolName } from './gen';
import { ISLANDS, WATERS, BOUNDS } from './geo';

const lam = (o: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color: 0xffffff, ...o });
const BOX = new THREE.BoxGeometry(1, 1, 1);
const DOME = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const roadMat = lam({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });

export const pools: Record<PoolName, Pool> = {
  bldg: new Pool('bldg', BOX, facade.m, 12000, { attrs: ['aStyle'] }),
  solid: new Pool('solid', BOX, lam(), 20000),
  roof: new Pool('roof', prismGeo(), lam(), 8000),
  cyl: new Pool('cyl', new THREE.CylinderGeometry(1, 1, 1, 8), lam(), 12000),
  crown: new Pool('crown', new THREE.IcosahedronGeometry(1, 0), lam({ flatShading: true }), 12000),
  ground: new Pool('ground', BOX, lam(), 16000, { cast: false }),
  road: new Pool('road', BOX, roadMat, 12000, { cast: false }),
  glass: new Pool('glass', BOX, lam({ transparent: true, opacity: 0.35, depthWrite: false }), 4000, {
    cast: false,
    receive: false,
  }),
  dome: new Pool(
    'dome',
    DOME,
    lam({ transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
    64,
    { cast: false },
  ),
};

const _m = new THREE.Matrix4(),
  _q = new THREE.Quaternion(),
  _e = new THREE.Euler(),
  _p = new THREE.Vector3(),
  _s = new THREE.Vector3(),
  _c = new THREE.Color();
function matOf(it: Item) {
  _e.set(0, it.ry, it.rz ?? 0, 'YXZ');
  _q.setFromEuler(_e);
  return _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.sx, it.sy, it.sz));
}

/* ---------- loaded chunks ---------- */

interface Live {
  slots: [Pool, number][];
  sky: number[];
}
const live = new Map<string, Live>();
/** Colliders and floors are made the first time a chunk loads, then only switched on and off. */
const made = new Map<string, { cols: Collider[]; floors: Floor[] }>();
/** Skyline slots of each chunk's tall buildings. */
const skySlots = new Map<string, { i: number; m: THREE.Matrix4 }[]>();

function load(d: ChunkData) {
  const k = chunkKey(d.cx, d.cz);
  const L: Live = { slots: [], sky: [] };
  for (const it of d.items) {
    const pool = pools[it.p];
    const i = pool.add(matOf(it), _c.set(it.c), it.st !== undefined ? { aStyle: it.st } : undefined);
    if (i >= 0) L.slots.push([pool, i]);
  }
  // Ground: 16 m cells, merged into runs along x.
  const N = CHUNK / 16;
  for (let j = 0; j < N; j++) {
    let run: { c: string; i0: number } | null = null;
    const z = d.cz * CHUNK + j * 16 + 8;
    const flush = (i1: number) => {
      if (!run) return;
      const x0 = d.cx * CHUNK + run.i0 * 16,
        w = (i1 - run.i0) * 16;
      _m.compose(_p.set(x0 + w / 2, -0.25, z), _q.identity(), _s.set(w, 0.5, 16));
      const i = pools.ground.add(_m, _c.set(run.c));
      if (i >= 0) L.slots.push([pools.ground, i]);
      run = null;
    };
    for (let i = 0; i < N; i++) {
      const c = groundAt(d.cx * CHUNK + i * 16 + 8, z);
      if (run && run.c !== c) flush(i);
      if (c && !run) run = { c, i0: i };
    }
    flush(N);
  }
  let m = made.get(k);
  if (!m) {
    m = {
      cols: d.cols.map(c => addRotCol(c.cx, c.cz, c.hx, c.hz, c.ry, c.y0, c.y1)),
      floors: d.floors.map(f => addFloor(f.cx, f.cz, f.hx, f.hz, f.ry, f.y0, f.y1)),
    };
    made.set(k, m);
  } else {
    for (const c of m.cols) c.on = true;
    for (const f of m.floors) f.on = true;
  }
  // Its tall buildings are drawn by the chunk now, not the skyline.
  for (const s of skySlots.get(k) ?? []) skyline?.set(s.i, ZERO);
  live.set(k, L);
}
function unload(k: string) {
  const L = live.get(k);
  if (!L) return;
  for (const [p, i] of L.slots) p.remove(i);
  const m = made.get(k);
  if (m) {
    for (const c of m.cols) c.on = false;
    for (const f of m.floors) f.on = false;
  }
  for (const s of skySlots.get(k) ?? []) skyline?.set(s.i, s.m);
  live.delete(k);
}

/** How far chunks are loaded (from the chunk's centre), by quality. */
export const loadRadius = () => [300, 420, 560][SETTINGS.quality];

let lastCx = NaN,
  lastCz = NaN;
let want: [number, number, number][] = [];
/** Load and unload around (x, z). `budget` ms per call; `all` loads everything wanted now. */
export function updateStream(x: number, z: number, budget = 3, all = false) {
  const R = loadRadius();
  const cx = Math.floor(x / CHUNK),
    cz = Math.floor(z / CHUNK);
  if (cx !== lastCx || cz !== lastCz || all) {
    lastCx = cx;
    lastCz = cz;
    const n = Math.ceil(R / CHUNK) + 1;
    want = [];
    for (let i = cx - n; i <= cx + n; i++)
      for (let j = cz - n; j <= cz + n; j++) {
        const d = Math.hypot((i + 0.5) * CHUNK - x, (j + 0.5) * CHUNK - z);
        if (d < R && getChunk(i, j)) want.push([i, j, d]);
      }
    want.sort((a, b) => a[2] - b[2]);
    // Unload what has fallen well behind.
    for (const k of [...live.keys()]) {
      const [i, j] = k.split(',').map(Number);
      if (Math.hypot((i + 0.5) * CHUNK - x, (j + 0.5) * CHUNK - z) > R + CHUNK * 0.75) unload(k);
    }
  }
  const t0 = performance.now();
  for (const [i, j] of want) {
    const k = chunkKey(i, j);
    if (live.has(k)) continue;
    load(getChunk(i, j)!);
    if (!all && performance.now() - t0 > budget) break;
  }
  for (const p of Object.values(pools)) p.flush();
  skyline?.flushAll();
}
export const liveChunks = () => live.size;

/* ---------- the skyline ---------- */

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
class SkyPool {
  mesh: THREE.InstancedMesh;
  private dirty = false;
  constructor(n: number) {
    const g = BOX.clone();
    g.setAttribute('aStyle', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    this.mesh = new THREE.InstancedMesh(g, facade.m, n);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.name = 'skyline';
    scene.add(this.mesh);
  }
  set(i: number, m: THREE.Matrix4) {
    this.mesh.setMatrixAt(i, m);
    this.dirty = true;
  }
  flushAll() {
    if (!this.dirty) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.dirty = false;
  }
}
let skyline: SkyPool | null = null;
/** Every building at least this tall is part of the skyline. */
const SKY_H = 26;
function buildSkyline() {
  const tall: [string, Item][] = [];
  for (const d of allChunks())
    for (const it of d.items) if (it.p === 'bldg' && it.sy >= SKY_H) tall.push([chunkKey(d.cx, d.cz), it]);
  skyline = new SkyPool(tall.length);
  const st = skyline.mesh.geometry.getAttribute('aStyle') as THREE.InstancedBufferAttribute;
  tall.forEach(([k, it], i) => {
    const m = matOf(it).clone();
    skyline!.mesh.setMatrixAt(i, m);
    skyline!.mesh.setColorAt(i, _c.set(it.c));
    st.setX(i, it.st ?? 0);
    let a = skySlots.get(k);
    if (!a) skySlots.set(k, (a = []));
    a.push({ i, m });
  });
  skyline.mesh.instanceMatrix.needsUpdate = true;
  skyline.mesh.instanceColor!.needsUpdate = true;
}

/* ---------- far ground and the sea ---------- */

function buildFarGround() {
  const shapes: THREE.Shape[] = [];
  for (const pts of Object.values(ISLANDS)) {
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    if (pts === ISLANDS.main)
      for (const w of Object.values(WATERS)) sh.holes.push(new THREE.Path(w.map(([x, z]) => new THREE.Vector2(x, -z))));
    shapes.push(sh);
  }
  const g = new THREE.ShapeGeometry(shapes);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, lam({ color: 0x7a9c62 }));
  m.position.y = -0.6;
  m.receiveShadow = true;
  scene.add(m);
}

const seaMat = new THREE.MeshLambertMaterial({ color: 0x3f7f93 });
const sea = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), seaMat);
sea.rotation.x = -Math.PI / 2;
sea.scale.set(BOUNDS.x1 - BOUNDS.x0 + 6000, BOUNDS.z1 - BOUNDS.z0 + 6000, 1);
sea.position.set((BOUNDS.x0 + BOUNDS.x1) / 2, -1.2, (BOUNDS.z0 + BOUNDS.z1) / 2);
sea.receiveShadow = true;
scene.add(sea);
const _sea = new THREE.Color(0x3f7f93);
envHooks.push(() => {
  // The sea takes a little of the sky's colour, and darkens at night.
  seaMat.color
    .copy(_sea)
    .lerp(env.hor, 0.25)
    .multiplyScalar(1 - env.night * 0.55);
});

/** Build the far layers (once, after the city is generated). */
export function initStream() {
  buildSkyline();
  buildFarGround();
}

/** Fog for the city: a long haze so the skyline reads, by quality. */
export function applyCityFog() {
  const q = SETTINGS.quality;
  fog.near = [90, 130, 170][q];
  fog.far = [1100, 1500, 1900][q];
  if (skyline) skyline.mesh.visible = q > 0;
}
