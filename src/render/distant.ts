/* The world at a distance (v2 step 19): moving things far off that make the edge
   of the island feel lived in, at little cost (a few instanced meshes, drawn from
   anywhere).
   - Planes: one landing on Changi's west runway from the south, one taking off
     from the east runway to the north, on staggered three-minute cycles; wingtip
     and strobe lights at night.
   - Ships: anchored in the strait south of the island and east of Changi, bobbing,
     a few under way; deck lights at night.
   - Birds: small flocks circling over the green near Aldi, flapping.
   - The Flyer: the wheel turns (one turn in four minutes), its capsules hanging
     level, the rim lit at night.
   - Red aviation lights on the tallest towers, blinking at night.
   - Lamps along the bridges over water, lit at night. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from './context';
import { S } from '../core/state';
import { player } from '../core/player';
import { timeWarp } from '../core/time';
import { hash, rng } from '../core/util';
import { allChunks } from '../city/gen';
import { allSegs } from '../city/roads';
import { landAt } from '../city/geo';

const night = () => {
  const h = (S.time / 60) % 24;
  return h < 6.8 || h >= 19.2;
};
/** Paint a geometry one colour (vertex colours), for merging parts of different colours. */
function paint(g: THREE.BufferGeometry, col: string) {
  const out = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(col);
  const n = out.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  out.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return out;
}
const lit = (col: string) => new THREE.MeshBasicMaterial({ color: col, fog: false });
const _m = new THREE.Matrix4(),
  _q = new THREE.Quaternion(),
  _e = new THREE.Euler(),
  _v = new THREE.Vector3(),
  _s = new THREE.Vector3(1, 1, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function place(
  m: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
  s = 1,
) {
  _e.set(rx, ry, rz, 'YXZ');
  _s.set(s, s, s);
  m.setMatrixAt(i, _m.compose(_v.set(x, y, z), _q.setFromEuler(_e), _s));
}

/* ---------- planes ---------- */

let planes: THREE.InstancedMesh, planeLights: THREE.InstancedMesh;
function planeGeometry() {
  const parts = [
    paint(new THREE.CylinderGeometry(1.9, 1.6, 34, 10).rotateX(Math.PI / 2), '#f4f6f8'),
    paint(new THREE.ConeGeometry(1.9, 4, 10).rotateX(Math.PI / 2).translate(0, 0, 19), '#f4f6f8'),
    paint(new THREE.BoxGeometry(34, 0.5, 5).translate(0, -0.6, 1), '#dfe3e6'),
    paint(new THREE.BoxGeometry(12, 0.4, 3).translate(0, 0.6, -15), '#dfe3e6'),
    paint(new THREE.BoxGeometry(0.5, 6, 4).translate(0, 3.5, -15), '#1d4f91'),
    paint(new THREE.CylinderGeometry(0.9, 0.9, 4, 8).rotateX(Math.PI / 2).translate(-6, -1.6, 2), '#b9c0c6'),
    paint(new THREE.CylinderGeometry(0.9, 0.9, 4, 8).rotateX(Math.PI / 2).translate(6, -1.6, 2), '#b9c0c6'),
  ];
  return mergeGeometries(parts);
}
/** Where plane k is at time t (s): [x, y, z, heading (0 = +z), pitch], or null while it's out of sight. */
function planeAt(k: number, t: number): [number, number, number, number, number] | null {
  const T = 180,
    u = ((t + k * 90) % T) / T;
  if (k % 2 === 0) {
    // Landing on the west runway (x 1385), northbound: from the sea in the south, touching down at z 240.
    const x = 1385;
    if (u < 0.55) {
      const f = u / 0.55;
      const z = 2600 - f * (2600 - 240);
      return [x, Math.max(0, (z - 240) * 0.052), z, Math.PI, 0.05];
    }
    if (u < 0.7) {
      const f = (u - 0.55) / 0.15;
      return [x, 0, 240 - (1 - (1 - f) * (1 - f)) * 380, Math.PI, 0];
    }
    return null;
  }
  // Taking off from the east runway (x 1440), northbound, climbing out over the north.
  const x = 1440;
  if (u < 0.2) return null;
  const f = (u - 0.2) / 0.8;
  const z = 160 - f * f * 3200;
  const y = Math.max(0, -(z + 60) * 0.12);
  return [x + Math.max(0, -z - 800) * 0.2, y, z, Math.PI, y > 0 ? -0.12 : 0];
}

/* ---------- ships ---------- */

interface Ship {
  x: number;
  z: number;
  ry: number;
  s: number;
  v: number;
  ph: number;
}
const ships: Ship[] = [];
let shipMesh: THREE.InstancedMesh, shipLights: THREE.InstancedMesh;
function shipGeometry() {
  const parts = [
    paint(new THREE.BoxGeometry(12, 5, 70).translate(0, 1, 0), '#2b2622'),
    paint(new THREE.BoxGeometry(12.2, 1.2, 70.2).translate(0, -0.9, 0), '#8a2f2a'),
    paint(new THREE.BoxGeometry(11, 9, 8).translate(0, 8, -28), '#f4f1ea'),
    paint(new THREE.BoxGeometry(2, 5, 2).translate(0, 14, -30), '#d7263d'),
  ];
  const cols = ['#d7263d', '#2f6fb3', '#f2c14e', '#3f7d3a', '#e07a1f', '#8e969c'];
  for (let row = 0; row < 7; row++)
    for (let h = 0; h < 2; h++)
      parts.push(
        paint(
          new THREE.BoxGeometry(10.5, 2.4, 6).translate(0, 4.7 + h * 2.4, -18 + row * 7.5),
          cols[(row * 3 + h) % cols.length],
        ),
      );
  return mergeGeometries(parts);
}
function buildShips() {
  const r = rng(hash('ships'));
  for (let k = 0, tries = 0; k < 18 && tries < 400; tries++) {
    const east = k >= 14;
    const x = east ? r.range(1520, 1700) : r.range(-1500, 1450),
      z = east ? r.range(-500, 600) : r.range(990, 1250);
    if (landAt(x, z) !== 'sea' || ships.some(s => Math.hypot(s.x - x, s.z - z) < 120)) continue;
    ships.push({
      x,
      z,
      ry: r.range(0, Math.PI * 2),
      s: r.range(0.7, 1.2),
      v: k % 6 === 0 ? r.range(2, 4) : 0,
      ph: r.range(0, 6),
    });
    k++;
  }
}

/* ---------- birds ---------- */

const FLOCKS = 3,
  PER = 8;
const flocks = Array.from({ length: FLOCKS }, (_, i) => ({
  x: 0,
  z: 0,
  r: 20 + i * 8,
  h: 22 + i * 6,
  ph: i * 2,
  set: false,
}));
let birds: THREE.InstancedMesh;

/* ---------- the Flyer ---------- */

const FLYER = { x: 610, z: 380, r: 32, y: 40, ry: 0.9 };
let wheel: THREE.Mesh, capsules: THREE.InstancedMesh, rimMat: THREE.MeshLambertMaterial;
function buildFlyer() {
  const parts: THREE.BufferGeometry[] = [];
  const n = 28;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    parts.push(
      new THREE.BoxGeometry((Math.PI * 2 * FLYER.r) / n + 0.4, 0.8, 0.8)
        .rotateZ(a + Math.PI / 2)
        .translate(Math.cos(a) * FLYER.r, Math.sin(a) * FLYER.r, 0),
    );
    if (k % 4 === 0) parts.push(new THREE.BoxGeometry(FLYER.r, 0.25, 0.25).translate(FLYER.r / 2, 0, 0).rotateZ(a));
  }
  rimMat = new THREE.MeshLambertMaterial({ color: '#e6e8ea', emissive: '#000000' });
  wheel = new THREE.Mesh(mergeGeometries(parts), rimMat);
  wheel.position.set(FLYER.x, FLYER.y, FLYER.z);
  wheel.rotation.order = 'YXZ';
  wheel.rotation.y = FLYER.ry;
  scene.add(wheel);
  capsules = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1.4, 8, 6),
    new THREE.MeshLambertMaterial({ color: '#cfe6ee' }),
    14,
  );
  capsules.frustumCulled = false;
  scene.add(capsules);
}

/* ---------- aviation lights, bridge lamps ---------- */

let aviation: THREE.InstancedMesh, lamps: THREE.InstancedMesh, poles: THREE.InstancedMesh;
function buildLights() {
  // The tallest towers' roofs.
  const tops: [number, number, number][] = [];
  for (const c of allChunks())
    for (const it of c.items)
      if (it.p === 'bldg' && it.y + it.sy / 2 > 140) tops.push([it.x, it.y + it.sy / 2 + 1, it.z]);
  aviation = new THREE.InstancedMesh(new THREE.SphereGeometry(2, 6, 4), lit('#ff2a1a'), Math.max(1, tops.length));
  tops.forEach(([x, y, z], i) => aviation.setMatrixAt(i, _m.makeTranslation(x, y, z)));
  aviation.count = tops.length;
  aviation.frustumCulled = false;
  scene.add(aviation);
  // Bridges: road segments over water, a lamp each side every 30 m.
  const pts: [number, number][] = [];
  for (const s of allSegs) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    const ux = (s.bx - s.ax) / (len || 1),
      uz = (s.bz - s.az) / (len || 1);
    for (let d = 10; d < len; d += 30) {
      const x = s.ax + ux * d,
        z = s.az + uz * d;
      const land = landAt(x, z);
      if (land !== 'water' && land !== 'sea') continue;
      for (const side of [-1, 1]) pts.push([x - uz * side * (s.w / 2 + 0.6), z + ux * side * (s.w / 2 + 0.6)]);
    }
  }
  poles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.1, 0.12, 7, 5).translate(0, 3.5, 0),
    new THREE.MeshLambertMaterial({ color: '#8e969c' }),
    Math.max(1, pts.length),
  );
  lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 6, 4), lit('#ffe7a8'), Math.max(1, pts.length));
  pts.forEach(([x, z], i) => {
    poles.setMatrixAt(i, _m.makeTranslation(x, 0, z));
    lamps.setMatrixAt(i, _m.makeTranslation(x, 7.1, z));
  });
  poles.count = lamps.count = pts.length;
  for (const m of [poles, lamps]) {
    m.frustumCulled = false;
    scene.add(m);
  }
}

/* ---------- build and update ---------- */

export function buildDistant() {
  const vc = new THREE.MeshLambertMaterial({ vertexColors: true });
  planes = new THREE.InstancedMesh(planeGeometry(), vc, 2);
  planeLights = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.7, 6, 4),
    new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }),
    6,
  );
  buildShips();
  shipMesh = new THREE.InstancedMesh(shipGeometry(), vc, ships.length);
  shipLights = new THREE.InstancedMesh(new THREE.SphereGeometry(2.2, 6, 4), lit('#fff1c9'), ships.length * 2);
  birds = new THREE.InstancedMesh(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([0, 0, 0.25, -0.55, 0, -0.1, 0, 0, -0.1, 0, 0, 0.25, 0, 0, -0.1, 0.55, 0, -0.1]),
        3,
      ),
    ),
    new THREE.MeshBasicMaterial({ color: '#2b2622', side: THREE.DoubleSide }),
    FLOCKS * PER,
  );
  for (const m of [planes, planeLights, shipMesh, shipLights, birds]) {
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
  }
  for (let i = 0; i < 6; i++) planeLights.setColorAt(i, new THREE.Color(['#ff2a1a', '#2aff5a', '#ffffff'][i % 3]));
  planes.castShadow = shipMesh.castShadow = false;
  buildFlyer();
  buildLights();
}

let clock = 0,
  nearPlane = 0;
/** How close the nearest plane is (0 far … 1 overhead), for the sound. */
export const planeNear = () => nearPlane;
export function updateDistant(dt: number) {
  nearPlane = 0;
  clock += dt * Math.min(timeWarp(), 6);
  const t = clock;
  const dark = night();
  const blink = Math.floor(performance.now() / 700) % 2 === 0;
  // Planes and their lights.
  for (let k = 0; k < 2; k++) {
    const p = planeAt(k, t);
    if (!p) {
      planes.setMatrixAt(k, ZERO);
      for (let j = 0; j < 3; j++) planeLights.setMatrixAt(k * 3 + j, ZERO);
      continue;
    }
    const [x, y, z, head, pitch] = p;
    nearPlane = Math.max(nearPlane, 1 - Math.hypot(x - player.x, y - player.y, z - player.z) / 700);
    place(planes, k, x, y + 2.6, z, pitch, head, 0);
    const sx = Math.cos(head),
      sz = -Math.sin(head);
    const show = dark || y > 60;
    for (let j = 0; j < 3; j++) {
      const w = j === 0 ? -17 : j === 1 ? 17 : 0;
      if (!show || (j === 2 && !blink)) planeLights.setMatrixAt(k * 3 + j, ZERO);
      else planeLights.setMatrixAt(k * 3 + j, _m.makeTranslation(x + sx * w, y + 2.2 + (j === 2 ? 3 : 0), z + sz * w));
    }
  }
  planes.instanceMatrix.needsUpdate = true;
  planeLights.instanceMatrix.needsUpdate = true;
  planeLights.instanceColor!.needsUpdate = true;
  // Ships: bobbing, a few under way (wrapping along the strait).
  ships.forEach((s, i) => {
    if (s.v) {
      s.x += Math.cos(s.ry) * s.v * dt;
      s.z -= Math.sin(s.ry) * s.v * dt;
      if (s.x > 1700) s.x = -1500;
      if (s.x < -1500) s.x = 1700;
      if (landAt(s.x, s.z) !== 'sea') s.ry += Math.PI;
    }
    const roll = Math.sin(t * 0.5 + s.ph) * 0.02;
    place(shipMesh, i, s.x, 0, s.z, roll, s.ry + Math.PI / 2, 0, s.s);
    for (let j = 0; j < 2; j++) {
      if (!dark) shipLights.setMatrixAt(i * 2 + j, ZERO);
      else {
        const along = (j ? -28 : 30) * s.s;
        shipLights.setMatrixAt(
          i * 2 + j,
          _m.makeTranslation(s.x + Math.cos(s.ry) * along, (j ? 17 : 8) * s.s, s.z - Math.sin(s.ry) * along),
        );
      }
    }
  });
  shipMesh.instanceMatrix.needsUpdate = true;
  shipLights.instanceMatrix.needsUpdate = true;
  // Birds: flocks over the nearest green, by day.
  const h = (S.time / 60) % 24;
  flocks.forEach((f, fi) => {
    if (!f.set || Math.hypot(f.x - player.x, f.z - player.z) > 220) {
      // Find some green (park or forest) near Aldi.
      f.set = false;
      for (let k = 0; k < 20 && !f.set; k++) {
        const a = Math.random() * Math.PI * 2,
          d = 40 + Math.random() * 140;
        const x = player.x + Math.cos(a) * d,
          z = player.z + Math.sin(a) * d;
        const land = landAt(x, z);
        if (land === 'park' || land === 'forest' || (land === 'urban' && k > 12)) Object.assign(f, { x, z, set: true });
      }
    }
    for (let b = 0; b < PER; b++) {
      const i = fi * PER + b;
      if (!f.set || h < 6.3 || h > 19.3) {
        birds.setMatrixAt(i, ZERO);
        continue;
      }
      const a = t * 0.35 + f.ph + b * 0.5;
      const r = f.r + Math.sin(b * 1.7) * 4;
      const x = f.x + Math.cos(a) * r,
        z = f.z + Math.sin(a) * r,
        y = f.h + Math.sin(a * 2 + b) * 2;
      const flap = 0.3 + 0.7 * Math.abs(Math.sin(t * 9 + b));
      _e.set(0, -a, 0, 'YXZ');
      _s.set(1.2 * flap + 0.3, 1, 1.2);
      birds.setMatrixAt(i, _m.compose(_v.set(x, y, z), _q.setFromEuler(_e), _s));
    }
  });
  birds.instanceMatrix.needsUpdate = true;
  // The Flyer turns; its capsules hang level.
  const turn = (t / 240) * Math.PI * 2;
  wheel.rotation.z = turn;
  const ax = Math.cos(FLYER.ry),
    az = -Math.sin(FLYER.ry);
  for (let k = 0; k < 14; k++) {
    const a = turn + (k / 14) * Math.PI * 2;
    const u = Math.cos(a) * FLYER.r;
    capsules.setMatrixAt(
      k,
      _m.makeTranslation(FLYER.x + ax * u, FLYER.y + Math.sin(a) * FLYER.r - 1.6, FLYER.z + az * u),
    );
  }
  capsules.instanceMatrix.needsUpdate = true;
  rimMat.emissive.set(dark ? '#3f7fd0' : '#000000');
  // Night lights.
  aviation.visible = dark && blink;
  lamps.visible = dark;
}
export const distantDebug = {
  planeAt,
  get clock() {
    return clock;
  },
  ships,
  get towers() {
    return aviation.count;
  },
  get bridgeLamps() {
    return lamps.count;
  },
};
