/* Traffic (step 10, rules in v2 step 14): cars and taxis driving the road graph
   near Aldi, on the left, turning at random at junctions (not back the way they
   came unless it's a dead end). Up to 36 at once, spawned 60–260 m away and
   dropped past 320 m; fewer at night. Two instanced meshes (bodies with a colour
   each, and the dark cabins) whatever the count.
   The rules: traffic lights at every junction on a main road (a 50 s cycle: one
   road's green and amber, the other's, then all red while the green man shows and
   beeps); cars stop at the line on amber and red, keep a gap behind the car ahead
   on the same stretch, and stop for Aldi (or Aldi's car) in front, sounding the
   horn when kept waiting. Each car is two solid circles, so Aldi (and Aldi's car)
   can't walk or drive through them. Aldi's car running a red is fined.
   Also exports the car geometry for the ride-hail car and the taxi Aldi rides. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../render/context';
import { S } from '../core/state';
import { player } from '../core/player';
import { timeWarp } from '../core/time';
import { circles } from '../core/collision';
import { sfx } from '../audio/audio';
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
  const parts: THREE.BufferGeometry[] = [c];
  // Four wheels, dark like the windows.
  for (const x of [-1.35, 1.35])
    for (const z of [-0.82, 0.82])
      parts.push(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10).rotateX(Math.PI / 2).translate(x, 0.34, z));
  const g = mergeGeometries(parts);
  parts.forEach(q => q.dispose());
  return g;
}

interface Car {
  on: boolean;
  from: GNode;
  to: GNode;
  prev: number;
  t: number;
  len: number;
  /** Cruising speed, and the speed now. */
  v: number;
  cv: number;
  /** Seconds kept waiting by Aldi (for the horn). */
  wait: number;
  x: number;
  z: number;
  ry: number;
  /** Three solid circles along the body (front, middle, back). */
  c1: { x: number; z: number; r: number };
  c2: { x: number; z: number; r: number };
  c3: { x: number; z: number; r: number };
}

/* ---------- traffic lights ---------- */

interface Junction {
  node: GNode;
  /** Which light group each approach (by the neighbour it comes from) is in: 0 or 1. */
  group: Map<number, 0 | 1>;
  offset: number;
}
const CYCLE = 50;
export const junctions = new Map<number, Junction>();
/** The light for group g at junction j now: 'g', 'a' (amber) or 'r'. Both are red for the last 8 s: the walk. */
export function lightFor(j: Junction, g: 0 | 1): 'g' | 'a' | 'r' {
  const c = (lightClock + j.offset) % CYCLE;
  if (g === 0) return c < 18 ? 'g' : c < 21 ? 'a' : 'r';
  return c < 21 ? 'r' : c < 39 ? 'g' : c < 42 ? 'a' : 'r';
}
export const walkPhase = (j: Junction) => (lightClock + j.offset) % CYCLE >= 42;
let lightClock = 0;
/** The lit junctions: on main roads (not only expressways), three or more ways. */
function buildJunctions() {
  for (const n of nodes) {
    if (n.out.length < 3) continue;
    const ws = n.out.map(e => e.w);
    if (Math.max(...ws) < 9 || Math.min(...ws) >= 14) continue;
    // Group the approaches by their heading (mod π): those along the first road, and the crossing ones.
    const ang = (e: { to: number }) => Math.atan2(nodes[e.to].z - n.z, nodes[e.to].x - n.x);
    const a0 = ang(n.out[0]);
    const group = new Map<number, 0 | 1>();
    for (const e of n.out) {
      let d = Math.abs(ang(e) - a0) % Math.PI;
      if (d > Math.PI / 2) d = Math.PI - d;
      group.set(e.to, d < Math.PI / 4 ? 0 : 1);
    }
    junctions.set(n.id, { node: n, group, offset: (n.id * 7.3) % CYCLE });
  }
}
/** The poles and lamps at each approach, and the zebra stripes: only the junctions within 350 m of Aldi are
    drawn (re-gathered once a second into the front of the instance buffers), lamps recoloured 4 times a second. */
let poles: THREE.InstancedMesh, lamps: THREE.InstancedMesh, stripes: THREE.InstancedMesh;
interface Head {
  j: Junction;
  g: 0 | 1;
  x: number;
  z: number;
  ry: number;
  zebra: [number, number, number][];
}
const heads: Head[] = [];
const shownHeads: Head[] = [];
const LAMP = { g: new THREE.Color('#3fdc6a'), a: new THREE.Color('#f2a93b'), r: new THREE.Color('#e8413c') };
const MAX_HEADS = 160,
  MAX_STRIPES = 1400;
function buildLightMeshes() {
  for (const j of junctions.values()) {
    const n = j.node;
    for (const e of n.out) {
      const m = nodes[e.to];
      const len = Math.hypot(m.x - n.x, m.z - n.z) || 1;
      const ux = (m.x - n.x) / len,
        uz = (m.z - n.z) / len;
      // The pole stands on the kerb of the lane coming in (left of the incoming direction −u).
      const back = Math.min(9, len * 0.4);
      const lx = -uz,
        lz = ux;
      const zebra: [number, number, number][] = [];
      // Zebra stripes across the road just before the stop line.
      const zx = n.x + ux * (back - 2.5),
        zz = n.z + uz * (back - 2.5);
      for (let k = -e.w / 2 + 0.6; k < e.w / 2 - 0.3; k += 1.1)
        zebra.push([zx + lx * k, zz + lz * k, Math.atan2(uz, ux)]);
      heads.push({
        j,
        g: j.group.get(e.to)!,
        x: n.x + ux * back - lx * (e.w / 2 + 0.8),
        z: n.z + uz * back - lz * (e.w / 2 + 0.8),
        ry: Math.atan2(-ux, -uz),
        zebra,
      });
    }
  }
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.11, 4.6, 6).translate(0, 2.3, 0), mat, MAX_HEADS);
  lamps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.34, 0.9, 0.26).translate(0, 4.1, 0.14),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    MAX_HEADS,
  );
  stripes = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.02, 0.5), mat, MAX_STRIPES);
  for (let i = 0; i < MAX_HEADS; i++) {
    poles.setColorAt(i, new THREE.Color('#3a4046'));
    lamps.setColorAt(i, LAMP.r);
  }
  for (let i = 0; i < MAX_STRIPES; i++) stripes.setColorAt(i, new THREE.Color('#e8e4da'));
  for (const m of [poles, lamps, stripes]) {
    m.count = 0;
    m.frustumCulled = false;
    scene.add(m);
  }
  poles.castShadow = true;
}
/** Put the junctions near Aldi into the instance buffers. */
function gatherHeads() {
  shownHeads.length = 0;
  let si = 0;
  for (const h of heads) {
    if (Math.abs(h.x - player.x) > 350 || Math.abs(h.z - player.z) > 350 || shownHeads.length >= MAX_HEADS) continue;
    const i = shownHeads.push(h) - 1;
    _e.set(0, h.ry, 0);
    _m.compose(_v.set(h.x, 0, h.z), _q.setFromEuler(_e), _s);
    poles.setMatrixAt(i, _m);
    lamps.setMatrixAt(i, _m);
    for (const [x, z, a] of h.zebra) {
      if (si >= MAX_STRIPES) break;
      _e.set(0, -a, 0);
      _m.compose(_v.set(x, 0.1, z), _q.setFromEuler(_e), _s);
      stripes.setMatrixAt(si++, _m);
    }
  }
  poles.count = lamps.count = shownHeads.length;
  stripes.count = si;
  for (const m of [poles, lamps, stripes]) m.instanceMatrix.needsUpdate = true;
}
let lampAcc = 0,
  beepAcc = 0,
  gatherAcc = 1,
  gx = 1e9,
  gz = 1e9;
function updateLights(dt: number) {
  lightClock += dt * Math.min(timeWarp(), 6);
  gatherAcc += dt;
  if (gatherAcc > 1 && Math.hypot(player.x - gx, player.z - gz) > 40) {
    gatherAcc = 0;
    gx = player.x;
    gz = player.z;
    gatherHeads();
  }
  lampAcc += dt;
  if (lampAcc > 0.25) {
    lampAcc = 0;
    shownHeads.forEach((h, i) => lamps.setColorAt(i, LAMP[lightFor(h.j, h.g)]));
    lamps.instanceColor!.needsUpdate = true;
  }
  // The green man's beeping at the crossing Aldi is standing at.
  beepAcc += dt;
  if (beepAcc > 0.45 && player.y < 1) {
    beepAcc = 0;
    const n = nearestNode(player.x, player.z, 18);
    const j = n && junctions.get(n.id);
    if (j && walkPhase(j)) sfx('greenman');
  }
}
/** For Aldi's car: the light for the approach from `fromId` into junction node `id`, if it's lit. */
export function lightAt(id: number, fromId: number) {
  const j = junctions.get(id);
  const g = j?.group.get(fromId);
  return j && g !== undefined ? lightFor(j, g) : null;
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
    const c1 = { x: 1e6, z: 1e6, r: 0.9 },
      c2 = { x: 1e6, z: 1e6, r: 0.9 },
      c3 = { x: 1e6, z: 1e6, r: 1.15 };
    circles.push(c1, c2, c3);
    cars.push({
      on: false,
      from: null!,
      to: null!,
      prev: -1,
      t: 0,
      len: 1,
      v: 11 + (i % 5),
      cv: 0,
      wait: 0,
      x: 0,
      z: 0,
      ry: 0,
      c1,
      c2,
      c3,
    });
  }
  bodies.instanceColor!.needsUpdate = true;
  buildJunctions();
  buildLightMeshes();
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
  Object.assign(c, { on: true, from: n, to: nodes[e.to], prev: -1, t: 0, len: e.len, cv: c.v, wait: 0 });
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

/** Where something is in the way ahead of Aldi's position on the road: Aldi, or Aldi's car (set by game/car). */
export const obstacle = { x: 1e6, z: 1e6, driving: false };

let acc = 0;
const onEdge = new Map<string, Car[]>();
export function updateTraffic(dt: number) {
  updateLights(dt);
  const want = wanted();
  let active = 0;
  acc += dt;
  const tick = acc > 0.3;
  if (tick) acc = 0;
  const t = dt * Math.min(timeWarp(), 6);
  // Who's on which stretch (for keeping a gap to the car ahead).
  onEdge.clear();
  for (const c of cars) {
    if (!c.on) continue;
    const k = c.from.id + '>' + c.to.id;
    let l = onEdge.get(k);
    if (!l) onEdge.set(k, (l = []));
    l.push(c);
  }
  const ox = obstacle.driving ? obstacle.x : player.x,
    oz = obstacle.driving ? obstacle.z : player.z;
  for (let i = 0; i < N; i++) {
    const c = cars[i];
    if (!c.on) {
      if (tick && active < want) spawn(c);
      if (!c.on) {
        hide(i, c);
        continue;
      }
    }
    // How far this car may go: the stop line on a red, the gap behind the car ahead, Aldi in front.
    let room = Infinity;
    const j = junctions.get(c.to.id);
    const g = j?.group.get(c.from.id);
    if (j && g !== undefined && lightFor(j, g) !== 'g') {
      const line = c.len - Math.min(9, c.len * 0.4) - 1;
      if (c.t <= line + 0.5) room = Math.min(room, line - c.t);
    }
    for (const o of onEdge.get(c.from.id + '>' + c.to.id) ?? [])
      if (o !== c && o.t > c.t) room = Math.min(room, o.t - c.t - 7);
    const dx = (c.to.x - c.from.x) / c.len,
      dz = (c.to.z - c.from.z) / c.len;
    const ahead = (ox - c.x) * dx + (oz - c.z) * dz,
      side = Math.abs((ox - c.x) * dz - (oz - c.z) * dx);
    let blocked = false;
    if (player.y < 1.5 && ahead > 0 && ahead < 16 && side < 2.4) {
      room = Math.min(room, ahead - (obstacle.driving ? 6 : 4.5));
      blocked = true;
    }
    // Speed: ease to cruising, brake to stop within the room.
    const stopV = room === Infinity ? c.v : Math.max(0, Math.sqrt(Math.max(0, room) * 2 * 4));
    const target = Math.min(c.v, stopV);
    c.cv = c.cv < target ? Math.min(target, c.cv + 3 * t) : Math.max(target, c.cv - 9 * t);
    let step = Math.min(c.cv * t, Math.max(0, room));
    if (room <= 0.05) {
      c.cv = 0;
      step = 0;
    }
    if (blocked && c.cv < 0.5) {
      c.wait += dt;
      if (c.wait > 2.5 && Math.hypot(c.x - player.x, c.z - player.z) < 40) {
        sfx('horn', 1);
        c.wait = -4;
      }
    } else if (!blocked) c.wait = 0;
    c.t += step;
    while (c.on && c.t >= c.len) {
      c.t -= c.len;
      next(c);
    }
    const f = c.t / c.len;
    const ex = (c.to.x - c.from.x) / c.len,
      ez = (c.to.z - c.from.z) / c.len;
    // On the left of the way it's going.
    c.x = c.from.x + (c.to.x - c.from.x) * f + ez * LANE;
    c.z = c.from.z + (c.to.z - c.from.z) * f - ex * LANE;
    c.ry = Math.atan2(-ez, ex);
    if (!c.on || Math.hypot(c.x - player.x, c.z - player.z) > 320 || active >= want + 4) {
      c.on = false;
      hide(i, c);
      continue;
    }
    active++;
    c.c1.x = c.x + ex * 1.5;
    c.c1.z = c.z + ez * 1.5;
    c.c2.x = c.x - ex * 1.5;
    c.c2.z = c.z - ez * 1.5;
    c.c3.x = c.x;
    c.c3.z = c.z;
    _e.set(0, c.ry, 0);
    _m.compose(_v.set(c.x, 0, c.z), _q.setFromEuler(_e), _s);
    bodies.setMatrixAt(i, _m);
    cabins.setMatrixAt(i, _m);
  }
  bodies.instanceMatrix.needsUpdate = true;
  cabins.instanceMatrix.needsUpdate = true;
}
function hide(i: number, c: Car) {
  bodies.setMatrixAt(i, ZERO);
  cabins.setMatrixAt(i, ZERO);
  c.c1.x = c.c1.z = c.c2.x = c.c2.z = c.c3.x = c.c3.z = 1e6;
}
export const trafficDebug = { cars };
