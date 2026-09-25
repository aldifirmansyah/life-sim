/* Traffic (step 10): cars and taxis driving the road graph near Aldi, on the
   left, turning at random at junctions (not back the way they came unless it's a
   dead end). Up to 36 at once, spawned 60–260 m away and dropped past 320 m;
   fewer at night. Two instanced meshes (bodies with a colour each, and the dark
   cabins) whatever the count. No collisions or right of way between them yet.
   Also exports the car geometry for the ride-hail car and the taxi Aldi rides. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../render/context';
import { S } from '../core/state';
import { player } from '../core/player';
import { timeWarp } from '../core/time';
import { nodes, nearestNode, type GNode } from './roadgraph';

const N = 36;
const LANE = 1.8;
const BODY_COLS = ['#e8e4da', '#1d1f22', '#8e969c', '#b8342a', '#2f6fb3', '#f4f1ea', '#3a4046', '#6b7378'];
/** Taxis: blue, yellow, and the premium black. */
export const TAXI_COLS = ['#2f6fb3', '#f2c14e', '#1d1f22'];

/** A car's body (unit colour, recoloured per instance) and its cabin (windows, dark). */
export function carBody() {
  const a = new THREE.BoxGeometry(4.3, 0.75, 1.8).translate(0, 0.65, 0);
  const b = new THREE.BoxGeometry(2.2, 0.08, 1.7).translate(-0.2, 1.47, 0);
  const g = mergeGeometries([a, b]);
  a.dispose();
  b.dispose();
  return g;
}
export function carCabin() {
  const c = new THREE.BoxGeometry(2.3, 0.5, 1.66).translate(-0.2, 1.2, 0);
  const w = new THREE.BoxGeometry(0.1, 0.12, 0.9).translate(-0.2, 1.57, 0); // the taxi sign bar (hidden inside for cars)
  const g = mergeGeometries([c, w]);
  c.dispose();
  w.dispose();
  return g;
}

interface Car {
  on: boolean;
  from: GNode;
  to: GNode;
  prev: number;
  t: number;
  len: number;
  v: number;
  x: number;
  z: number;
  ry: number;
}
const cars: Car[] = [];
let bodies: THREE.InstancedMesh, cabins: THREE.InstancedMesh;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(),
  _q = new THREE.Quaternion(),
  _v = new THREE.Vector3(),
  _s = new THREE.Vector3(1, 1, 1),
  _e = new THREE.Euler();

export function buildTraffic() {
  bodies = new THREE.InstancedMesh(carBody(), new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
  cabins = new THREE.InstancedMesh(carCabin(), new THREE.MeshLambertMaterial({ color: 0x1d2b36 }), N);
  for (const m of [bodies, cabins]) {
    m.castShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
  }
  for (let i = 0; i < N; i++) {
    const c = new THREE.Color(i % 5 === 0 ? TAXI_COLS[i % 3] : BODY_COLS[i % BODY_COLS.length]);
    bodies.setColorAt(i, c);
    bodies.setMatrixAt(i, ZERO);
    cabins.setMatrixAt(i, ZERO);
    cars.push({ on: false, from: null!, to: null!, prev: -1, t: 0, len: 1, v: 11 + (i % 5), x: 0, z: 0, ry: 0 });
  }
  bodies.instanceColor!.needsUpdate = true;
}

/** How many cars are out now. */
function wanted() {
  const h = (S.time / 60) % 24;
  const f = h < 6 ? 0.2 : h < 7 ? 0.5 : h < 10 ? 1 : h < 17 ? 0.75 : h < 20 ? 1 : h < 23 ? 0.6 : 0.3;
  return Math.round(N * f);
}

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function spawn(c: Car) {
  const a = rnd() * Math.PI * 2,
    r = 60 + rnd() * 200;
  const n = nearestNode(player.x + Math.cos(a) * r, player.z + Math.sin(a) * r, 80);
  if (!n || !n.out.length || Math.hypot(n.x - player.x, n.z - player.z) < 50) return;
  const e = n.out[Math.floor(rnd() * n.out.length)];
  if (e.w >= 14 && rnd() < 0.5) return; // fewer on the expressways near Aldi
  Object.assign(c, { on: true, from: n, to: nodes[e.to], prev: -1, t: 0, len: e.len });
}
/** At a junction: onwards, not back unless there's no other way. */
function next(c: Car) {
  const outs = c.to.out.filter(e => e.to !== c.from.id);
  const e = outs.length ? outs[Math.floor(rnd() * outs.length)] : c.to.out[0];
  if (!e) return (c.on = false);
  c.from = c.to;
  c.to = nodes[e.to];
  c.t = 0;
  c.len = e.len;
  return true;
}

let acc = 0;
export function updateTraffic(dt: number) {
  const want = wanted();
  let active = 0;
  acc += dt;
  const tick = acc > 0.3;
  if (tick) acc = 0;
  const t = dt * Math.min(timeWarp(), 6);
  for (let i = 0; i < N; i++) {
    const c = cars[i];
    if (!c.on) {
      if (tick && active < want) spawn(c);
      if (!c.on) {
        bodies.setMatrixAt(i, ZERO);
        cabins.setMatrixAt(i, ZERO);
        continue;
      }
    }
    c.t += c.v * t;
    while (c.on && c.t >= c.len) {
      c.t -= c.len;
      next(c);
    }
    const f = c.t / c.len;
    const dx = (c.to.x - c.from.x) / c.len,
      dz = (c.to.z - c.from.z) / c.len;
    // On the left of the way it's going.
    c.x = c.from.x + (c.to.x - c.from.x) * f + dz * LANE;
    c.z = c.from.z + (c.to.z - c.from.z) * f - dx * LANE;
    c.ry = Math.atan2(-dz, dx);
    if (!c.on || Math.hypot(c.x - player.x, c.z - player.z) > 320 || active >= want + 4) {
      c.on = false;
      bodies.setMatrixAt(i, ZERO);
      cabins.setMatrixAt(i, ZERO);
      continue;
    }
    active++;
    _e.set(0, c.ry, 0);
    _m.compose(_v.set(c.x, 0, c.z), _q.setFromEuler(_e), _s);
    bodies.setMatrixAt(i, _m);
    cabins.setMatrixAt(i, _m);
  }
  bodies.instanceMatrix.needsUpdate = true;
  cabins.instanceMatrix.needsUpdate = true;
}
export const trafficDebug = { cars };
