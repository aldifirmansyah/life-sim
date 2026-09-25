/* MRT trains. Each line runs a fixed timetable: trains leave each terminus at a
   steady headway, run to the other end stopping at every station (accelerate,
   cruise, brake, doors open), wait, and come back on the other track (trains keep
   left). Where every train is comes from one rail clock, so nothing drifts.
   Cars are one instanced mesh (a hollow car with seats, poles and windows) and
   the door leaves another. Aldi rides by walking in through open doors: while
   aboard, movement is in the car's own frame and the car carries Aldi along, the
   clock runs faster so a ride takes about as long as the real one would, and
   stations are announced. The platform screen doors open with the train's. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../render/context';
import { player, type Ride } from '../core/player';
import { timeWarp } from '../core/time';
import { S, inWorld } from '../core/state';
import { toast } from '../ui/hud';
import { sfx } from '../audio/audio';
import { LINES, along, TRACK, CAR_LEN, CARS, type Line, type Station } from './mrtdata';
import { platformSides, DOOR_W } from './mrtbuild';
import { openPanel, closePanel } from '../ui/panel';

/* ---------- the timetable ---------- */

const V = 40; // cruising speed, m/s
const A = 1.8; // acceleration and braking, m/s²
const DWELL = 8; // seconds at each station
const TURN = 14; // seconds at each end
const DOORS_AFTER = 1.2; // doors open this long after stopping, close this long before leaving
/** Between stations, while Aldi is aboard, the whole rail clock runs this much faster (the ride's real
    length); stops keep their normal length so there's time to get on and off. */
const RIDE_RUSH = 2;
/** With a stop chosen, the ride runs this much faster until the train nears that stop. */
const EXPRESS = 8;
/** On the trains and the platforms the game clock follows the rail clock at this rate: a hop between
    stations (about 24 rail seconds with the stop) then takes a little over two game minutes, as it
    would for real. Waiting for a train costs minutes, not hours. */
export const STATION_CLOCK = 0.12;

interface Leg {
  t0: number;
  dur: number;
  dir: 1 | -1;
  /** A stop at a station (index), or a run between two. */
  stop?: number;
  from?: number;
  to?: number;
}
interface Sched {
  line: Line;
  legs: Leg[];
  cycle: number;
  trains: number;
}
function hopTime(L: number) {
  return L >= (V * V) / A ? L / V + V / A : 2 * Math.sqrt(L / A);
}
/** Distance covered after τ seconds of a hop of length L. */
function hopDist(L: number, tau: number) {
  const T = hopTime(L);
  const vmax = Math.min(V, Math.sqrt(L * A));
  const ta = vmax / A;
  if (tau <= 0) return 0;
  if (tau >= T) return L;
  if (tau < ta) return 0.5 * A * tau * tau;
  const da = 0.5 * A * ta * ta;
  if (tau < T - ta) return da + vmax * (tau - ta);
  const r = T - tau;
  return L - 0.5 * A * r * r;
}
function schedule(line: Line, headway: number, trains?: number): Sched {
  const legs: Leg[] = [];
  let t = 0;
  const n = line.stations.length;
  for (const dir of [1, -1] as const) {
    const order = dir === 1 ? [...Array(n).keys()] : [...Array(n).keys()].reverse();
    for (let k = 0; k < n; k++) {
      const i = order[k];
      const dwell = k === 0 ? TURN : k === n - 1 ? 0 : DWELL;
      if (dwell) {
        legs.push({ t0: t, dur: dwell, dir, stop: i });
        t += dwell;
      }
      if (k < n - 1) {
        const j = order[k + 1];
        const dur = hopTime(Math.abs(line.stations[j].s - line.stations[i].s));
        legs.push({ t0: t, dur, dir, from: i, to: j });
        t += dur;
      }
    }
  }
  return { line, legs, cycle: t, trains: trains ?? Math.max(2, Math.round(t / headway)) };
}
/** A train every ~45 s each way on both lines. */
const SCHEDS = [schedule(LINES[0], 45), schedule(LINES[1], 45)];

interface TrainState {
  s: number;
  dir: 1 | -1;
  stop: number;
  doors: boolean;
  moving: boolean;
  next: number;
}
function stateAt(sc: Sched, tau: number): TrainState {
  tau = ((tau % sc.cycle) + sc.cycle) % sc.cycle;
  let lo = 0,
    hi = sc.legs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sc.legs[mid].t0 <= tau) lo = mid;
    else hi = mid - 1;
  }
  const g = sc.legs[lo];
  const st = sc.line.stations;
  const u = tau - g.t0;
  if (g.stop !== undefined) {
    const doors = u > DOORS_AFTER && u < g.dur - DOORS_AFTER;
    // The next station after this stop (for announcements).
    const nx = sc.legs[(lo + 1) % sc.legs.length];
    return { s: st[g.stop].s, dir: g.dir, stop: g.stop, doors, moving: false, next: nx.to ?? g.stop };
  }
  const a = st[g.from!].s,
    b = st[g.to!].s;
  const d = hopDist(Math.abs(b - a), u);
  return { s: a + Math.sign(b - a) * d, dir: g.dir, stop: -1, doors: false, moving: true, next: g.to! };
}

/* ---------- the cars ---------- */

const W = 1.5; // half-width of a car
const H = 2.35; // interior height
function carGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: string) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const col = new THREE.Color(c);
    const arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) col.toArray(arr, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  };
  const HL = CAR_LEN / 2;
  const SILVER = '#d7dadd',
    GREY = '#4f555b';
  add(-HL, HL, -1.05, -0.02, -W + 0.05, W - 0.05, GREY); // underframe
  add(-HL, HL, -0.02, 0, -W + 0.08, W - 0.08, '#8b8e8a'); // floor
  add(-HL, HL, H, H + 0.25, -W, W, SILVER); // roof
  add(-HL + 0.2, HL - 0.2, H - 0.06, H, -0.2, 0.2, '#f4f2ea'); // light strip
  const doorX = [-4, 4];
  for (const side of [-1, 1]) {
    const z0 = side * W - 0.04,
      z1 = side * W + 0.04;
    const zs: [number, number] = [Math.min(z0, z1), Math.max(z0, z1)];
    // Wall pieces between the doors: a lower panel, the window band (open, with pillars), a top panel.
    const spans: [number, number][] = [
      [-HL, doorX[0] - DOOR_W / 2],
      [doorX[0] + DOOR_W / 2, doorX[1] - DOOR_W / 2],
      [doorX[1] + DOOR_W / 2, HL],
    ];
    for (const [a, b] of spans) {
      add(a, b, 0, 0.9, ...zs, SILVER);
      add(a, b, 0.72, 0.88, zs[0] - 0.01, zs[1] + 0.01, '#009645');
      add(a, b, 1.95, H, ...zs, SILVER);
      for (let x = a; x <= b + 0.01; x += (b - a) / Math.max(1, Math.round((b - a) / 2.2)))
        add(x - 0.08, x + 0.08, 0.9, 1.95, ...zs, SILVER);
      // Long seats along the wall.
      const zi = side * (W - 0.3);
      add(a + 0.15, b - 0.15, 0, 0.46, Math.min(zi - 0.25, zi + 0.25), Math.max(zi - 0.25, zi + 0.25), '#4f8fc0');
    }
    for (const dx of doorX) add(dx - DOOR_W / 2, dx + DOOR_W / 2, 2.05, H, ...zs, SILVER);
  }
  // Poles in the doorways, and the ends.
  for (const dx of doorX) {
    const g = new THREE.CylinderGeometry(0.035, 0.035, H, 6);
    g.translate(dx, H / 2, 0);
    const col = new THREE.Color('#c9ccce');
    const arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) col.toArray(arr, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  }
  for (const s of [-1, 1]) {
    // End walls with a gangway opening in the middle.
    add(s * HL - 0.04, s * HL + 0.04, 0, H, -W, -0.55, SILVER);
    add(s * HL - 0.04, s * HL + 0.04, 0, H, 0.55, W, SILVER);
    add(s * HL - 0.04, s * HL + 0.04, 2.0, H, -0.55, 0.55, SILVER);
  }
  const g = mergeGeometries(parts)!;
  parts.forEach(p => p.dispose());
  return g;
}
/** The cab front on the end cars: a shallow nose closing the gangway. */
function noseGeometry() {
  const g = new THREE.BoxGeometry(0.5, H + 1.2, W * 2);
  g.translate(0, H / 2 - 0.5, 0);
  return g;
}

const MAX_TRAINS = SCHEDS.reduce((n, s) => n + s.trains, 0);
const carMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const cars = new THREE.InstancedMesh(carGeometry(), carMat, MAX_TRAINS * CARS);
cars.frustumCulled = false;
cars.castShadow = true;
cars.receiveShadow = true;
cars.name = 'trains';
scene.add(cars);
const noses = new THREE.InstancedMesh(
  noseGeometry(),
  new THREE.MeshLambertMaterial({ color: 0xd7dadd }),
  MAX_TRAINS * 2,
);
noses.frustumCulled = false;
noses.castShadow = true;
scene.add(noses);
const leaves = new THREE.InstancedMesh(
  new THREE.BoxGeometry(DOOR_W / 2, 2.0, 0.06),
  new THREE.MeshLambertMaterial({ color: 0xcfd3d6 }),
  MAX_TRAINS * CARS * 8,
);
leaves.frustumCulled = false;
scene.add(leaves);
// The screen doors' leaves on the platforms.
const psd = new THREE.InstancedMesh(
  new THREE.BoxGeometry(DOOR_W / 2, 1.55, 0.06),
  new THREE.MeshLambertMaterial({ color: 0xbfe0ea, transparent: true, opacity: 0.55 }),
  platformSides.reduce((n, p) => n + p.openings.length * 2, 0) || 1,
);
psd.frustumCulled = false;
scene.add(psd);

/* ---------- running ---------- */

/** The rail clock, in seconds; runs with the world, faster while T is held. */
let railT = 0;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(),
  _q = new THREE.Quaternion(),
  _e = new THREE.Euler(),
  _v = new THREE.Vector3(),
  _s = new THREE.Vector3(1, 1, 1);

interface CarPose {
  x: number;
  z: number;
  /** Heading (rotation.y) of the car's +x. */
  ry: number;
  /** Unit vectors of the car's +x and +z in the world. */
  fx: number;
  fz: number;
}
interface LiveTrain {
  sc: Sched;
  k: number;
  st: TrainState;
  cars: CarPose[];
  hidden?: boolean;
  leavesHidden?: boolean;
}
const liveTrains: LiveTrain[] = [];
for (const sc of SCHEDS) for (let k = 0; k < sc.trains; k++) liveTrains.push({ sc, k, st: stateAt(sc, 0), cars: [] });
liveTrains.forEach(poseCars);

function poseCars(tr: LiveTrain) {
  const { line } = tr.sc;
  tr.cars.length = 0;
  for (let j = 0; j < CARS; j++) {
    // The middle car sits at s; the others ahead and behind along the track.
    const s = tr.st.s + (j - 1) * CAR_LEN;
    const [px, pz, dx, dz] = along(line, s);
    // Keep left: +s trains on the −q track, −s trains on the +q track (q = (−dz, dx)).
    const off = -tr.st.dir * TRACK;
    tr.cars.push({ x: px - dz * off, z: pz + dx * off, ry: Math.atan2(-dz, dx), fx: dx, fz: dz });
  }
}

/** Is the player aboard, and where (car-local)? */
let ride: {
  tr: LiveTrain;
  car: number;
  lx: number;
  lz: number;
  ry: number;
  /** The stop Aldi chose (station index), or null to ride along at normal speed. */
  dest: number | null;
  /** The train has stopped at the chosen stop. */
  reached: boolean;
} | null = null;
let lastNext = -1;
let lastStop = -2;

function carRide(): Ride {
  return {
    step(dt, vx, vz) {
      if (!ride) return;
      const c = ride.tr.cars[ride.car];
      // Wanted velocity into the car's frame: local x along (fx, fz), local z along (−fz, fx).
      const lvx = vx * c.fx + vz * c.fz,
        lvz = -vx * c.fz + vz * c.fx;
      let lx = ride.lx + lvx * dt,
        lz = ride.lz + lvz * dt;
      // Where the doors are open (the platform side), Aldi can step out.
      const st = ride.tr.st;
      const nearDoor = [-4, 4].some(d => Math.abs(lx - d) < DOOR_W / 2 - 0.25);
      const platformSide = -st.dir * TRACK > 0 ? 1 : -1; // the track is on the platform's inner side
      const lim = nearDoor ? W - 0.32 : 0.95 - 0.32;
      if (st.doors && nearDoor && Math.sign(lz) === platformSide && Math.abs(lz) > W - 0.4) {
        // Stepping out through the doors onto the platform.
        if (Math.abs(lz) > W + 0.35) {
          const [wx, wz] = toWorld(c, lx, lz);
          player.x = wx;
          player.z = wz;
          player.y = ride.tr.sc.line.floor;
          leave();
          return;
        }
      } else lz = Math.max(-lim, Math.min(lim, lz));
      // Walk through the gangways between cars; the end cars are closed.
      const HL = CAR_LEN / 2 - 0.35;
      if (lx > HL) {
        if (ride.car + 1 < CARS && Math.abs(lz) < 0.3) {
          ride.car++;
          lx -= CAR_LEN;
        } else lx = HL;
      } else if (lx < -HL) {
        if (ride.car > 0 && Math.abs(lz) < 0.3) {
          ride.car--;
          lx += CAR_LEN;
        } else lx = -HL;
      }
      ride.lx = lx;
      ride.lz = lz;
      place();
    },
    label: () => {
      const { line } = ride!.tr.sc;
      const last = ride!.tr.st.dir === 1 ? line.stations[line.stations.length - 1] : line.stations[0];
      const d = ride!.dest;
      return `${line.name} to ${last.name}${d !== null ? ` · for ${line.stations[d].name}` : ''}`;
    },
  };
}
function toWorld(c: CarPose, lx: number, lz: number): [number, number] {
  return [c.x + c.fx * lx - c.fz * lz, c.z + c.fz * lx + c.fx * lz];
}
/** Put the player where the ride says, and turn the view with the car. */
function place() {
  if (!ride) return;
  const c = ride.tr.cars[ride.car];
  const [x, z] = toWorld(c, ride.lx, ride.lz);
  player.x = x;
  player.z = z;
  player.y = ride.tr.sc.line.floor;
  let d = c.ry - ride.ry;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  player.yaw += d;
  ride.ry = c.ry;
}
function board(tr: LiveTrain, car: number, lx: number, lz: number) {
  ride = { tr, car, lx, lz, ry: tr.cars[car].ry, dest: null, reached: false };
  player.ride = carRide();
  lastNext = tr.st.next;
  lastStop = tr.st.stop;
  const l = tr.sc.line;
  const end = tr.st.dir === 1 ? l.stations[l.stations.length - 1] : l.stations[0];
  toast(`${l.name} to ${end.name}`, `Next station: ${l.stations[tr.st.next].name}. Press E to choose your stop.`, null);
  sfx('chime');
}
function leave() {
  ride = null;
  player.ride = null;
}

/** Called every frame. */
export function updateTrains(dt: number) {
  const warp = timeWarp();
  const f = railFactor(warp);
  if (inWorld()) railT += dt * f;
  // Time on the MRT follows the rail clock (the clock already multiplies by the warp).
  S.clockScale = ride || stationAt(player.x, player.z, player.y) ? (STATION_CLOCK * f) / warp : 1;
  let ci = 0,
    ni = 0,
    li = 0;
  const px = player.x,
    pz = player.z;
  for (const tr of liveTrains) {
    tr.st = stateAt(tr.sc, railT + (tr.k * tr.sc.cycle) / tr.sc.trains);
    // Far trains only need their middle car (for boarding checks and the map); their instances stay hidden.
    const [mx, mz] = along(tr.sc.line, tr.st.s);
    const far = Math.hypot(mx - px, mz - pz) > 900;
    if (far && tr.hidden) {
      ci += CARS;
      ni += 2;
      li += CARS * 8;
      continue;
    }
    tr.hidden = far;
    const FLOOR = tr.sc.line.floor;
    poseCars(tr);
    for (let j = 0; j < CARS; j++) {
      const c = tr.cars[j];
      if (far) cars.setMatrixAt(ci++, ZERO);
      else {
        _e.set(0, c.ry, 0, 'YXZ');
        cars.setMatrixAt(ci++, _m.compose(_v.set(c.x, FLOOR, c.z), _q.setFromEuler(_e), _s));
      }
    }
    // Cab noses at both ends of the train.
    for (const [j, u] of [
      [0, -CAR_LEN / 2 - 0.25],
      [CARS - 1, CAR_LEN / 2 + 0.25],
    ] as [number, number][]) {
      const c = tr.cars[j];
      if (far) noses.setMatrixAt(ni++, ZERO);
      else {
        _e.set(0, c.ry, 0, 'YXZ');
        noses.setMatrixAt(ni++, _m.compose(_v.set(c.x + c.fx * u, FLOOR, c.z + c.fz * u), _q.setFromEuler(_e), _s));
      }
    }
    // Door leaves: shut, or slid open on the platform side (only near the player).
    const near = Math.hypot(mx - px, mz - pz) < 300;
    if (!near && tr.leavesHidden) {
      li += CARS * 8;
      continue;
    }
    tr.leavesHidden = !near;
    for (let j = 0; j < CARS; j++) {
      const c = tr.cars[j];
      for (const d of [-4, 4])
        for (const side of [-1, 1])
          for (const half of [-1, 1]) {
            if (!near) {
              leaves.setMatrixAt(li++, ZERO);
              continue;
            }
            const platformSide = -tr.st.dir * TRACK > 0 ? 1 : -1;
            const open = tr.st.doors && side === platformSide ? 1 : 0;
            const lx = d + half * (DOOR_W / 4 + open * (DOOR_W / 2 - 0.05)),
              lz = side * (W - 0.02);
            const [x, z] = toWorld(c, lx, lz);
            _e.set(0, c.ry, 0, 'YXZ');
            leaves.setMatrixAt(li++, _m.compose(_v.set(x, FLOOR + 1.02, z), _q.setFromEuler(_e), _s));
          }
    }
  }
  cars.instanceMatrix.needsUpdate = true;
  noses.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  updateScreenDoors();
  if (ride) {
    place();
    announce();
  } else tryBoard();
}

/** Screen doors open where a train is standing with its doors open. */
const psHidden = new Set<(typeof platformSides)[number]>();
function updateScreenDoors() {
  let pi = 0;
  for (const ps of platformSides) ps.open = false;
  for (const tr of liveTrains) {
    if (!tr.st.doors) continue;
    const st: Station = tr.sc.line.stations[tr.st.stop];
    // The train stands on the track on its left: the platform on that side.
    const side = -tr.st.dir;
    const ps = platformSides.find(p => p.station === st && p.line === tr.sc.line && p.side === side);
    if (ps) ps.open = true;
  }
  for (const ps of platformSides) {
    const near = Math.hypot(ps.station.x - player.x, ps.station.z - player.z) < 250;
    // Far platforms' leaves are already hidden: only their colliders follow the doors.
    if (!near && psHidden.has(ps)) {
      for (const o of ps.openings) o.col.on = !ps.open;
      pi += ps.openings.length * 2;
      continue;
    }
    if (near) psHidden.delete(ps);
    else psHidden.add(ps);
    const ry = Math.atan2(-ps.station.dz, ps.station.dx);
    const FLOOR = ps.line.floor;
    for (const o of ps.openings) {
      o.col.on = !ps.open;
      for (const half of [-1, 1]) {
        if (!near) {
          psd.setMatrixAt(pi++, ZERO);
          continue;
        }
        const u = half * (DOOR_W / 4 + (ps.open ? DOOR_W / 2 - 0.05 : 0));
        _e.set(0, ry, 0, 'YXZ');
        psd.setMatrixAt(
          pi++,
          _m.compose(_v.set(o.x + ps.station.dx * u, FLOOR + 0.8, o.z + ps.station.dz * u), _q.setFromEuler(_e), _s),
        );
      }
    }
  }
  psd.instanceMatrix.needsUpdate = true;
}

/** Walking into a car through its open doors puts Aldi aboard. */
function tryBoard() {
  for (const tr of liveTrains) {
    if (!tr.st.doors || tr.hidden || Math.abs(player.y - tr.sc.line.floor) > 0.6) continue;
    for (let j = 0; j < CARS; j++) {
      const c = tr.cars[j];
      const dx = player.x - c.x,
        dz = player.z - c.z;
      if (dx * dx + dz * dz > 100) continue;
      const lx = dx * c.fx + dz * c.fz,
        lz = -dx * c.fz + dz * c.fx;
      if (Math.abs(lx) < CAR_LEN / 2 - 0.3 && Math.abs(lz) < W - 0.36) return board(tr, j, lx, lz);
    }
  }
}

/** How fast the rail clock runs this frame: with the world, a little faster while riding along, and much
    faster on the way to a chosen stop (back to normal for the last stretch into it). */
function railFactor(warp: number) {
  if (!ride) return warp;
  const st = ride.tr.st;
  if (ride.dest === null) return warp === 1 && st.moving ? RIDE_RUSH : warp;
  const l = ride.tr.sc.line;
  const arriving =
    st.stop === ride.dest || (st.moving && st.next === ride.dest && Math.abs(l.stations[ride.dest].s - st.s) < 70);
  return arriving ? warp : Math.max(warp, EXPRESS);
}

/** E aboard: choose the stop to get off at; the train runs fast until it nears it. */
export function pickStop() {
  if (!ride) return;
  const l = ride.tr.sc.line,
    st = ride.tr.st;
  const n = l.stations.length;
  const ahead: number[] = [];
  for (let i = st.moving ? st.next : st.stop + st.dir; i >= 0 && i < n; i += st.dir) ahead.push(i);
  const end = st.dir === 1 ? l.stations[n - 1] : l.stations[0];
  const r = ride;
  openPanel({
    title: `${l.name} to ${end.name}`,
    sub: 'Where are you getting off?',
    body: 'The train speeds through the stations in between and slows down for your stop.',
    rows: [
      ...ahead.map((i, k) => ({
        label: l.stations[i].name,
        note: `${l.stations[i].code} · about ${Math.round((k + 1) * 2.3)} min`,
        run: () => {
          r.dest = i;
          r.reached = false;
          closePanel();
          toast(`Getting off at ${l.stations[i].name}`, 'Hold on; the train will slow down for your stop.', null);
        },
      })),
      {
        label: 'Just ride along',
        note: 'normal speed',
        run: () => {
          r.dest = null;
          closePanel();
        },
      },
    ],
  });
}

/** Next-station announcements while aboard. */
function announce() {
  if (!ride) return;
  const st = ride.tr.st;
  const l = ride.tr.sc.line;
  // The chosen stop: once the train has stood there and moves off again, ride along at normal speed.
  if (ride.dest !== null) {
    if (st.stop === ride.dest) ride.reached = true;
    else if (ride.reached) ride.dest = null;
  }
  if (st.stop !== lastStop) {
    lastStop = st.stop;
    if (st.stop >= 0) {
      const at = l.stations[st.stop];
      const end = st.dir === 1 ? st.stop === l.stations.length - 1 : st.stop === 0;
      toast(at.name, end ? 'This train terminates here. Please alight.' : 'Doors opening. Please mind the gap.', null);
      sfx('chime');
    }
  }
  if (st.moving && st.next !== lastNext) {
    lastNext = st.next;
    toast(`Next station: ${l.stations[st.next].name}`, l.stations[st.next].code, null);
    sfx('chime');
  }
}

/** Where the player is riding, for the HUD, or null. */
export const rideLabel = () => (ride ? (player.ride?.label() ?? null) : null);
/** The station a player on a platform is at (for the HUD). */
export function stationAt(x: number, z: number, y: number) {
  for (const l of LINES)
    for (const st of l.stations)
      if (y > l.floor - 1 && y < l.floor + 3 && Math.hypot(x - st.x, z - st.z) < 40) return { line: l, st };
  return null;
}
