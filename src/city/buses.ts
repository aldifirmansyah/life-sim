/* Buses. The first route, service 96: Clementi Interchange – NUS Kent Ridge –
   Science Park (Chopee) – one-north – Buona Vista, and back. The buses drive the
   route's polyline on the left of the road, stop at every stop (longer at the
   ends, where they turn round), and run on the world's clock (T speeds them up).
   Each stop has a pole on each side of the road; E at the pole shows when the
   next bus comes. E at a bus's front door while it stands at a stop boards it
   (tapping the EZ-Lah card): Aldi sits by a window, the view turning with the
   bus; E aboard rings the bell for a stop, or gets off while it's standing.
   Near a stop and aboard, the clock slows as it does at MRT stations, so waiting
   and riding cost about the real time. Buses have no collider yet. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { S } from '../core/state';
import { player, type Ride } from '../core/player';
import { timeWarp, RATE } from '../core/time';
import { register } from '../game/interact';
import { openPanel, closePanel, type Row } from '../ui/panel';
import { toast } from '../ui/hud';
import { sfx } from '../audio/audio';
import { wallet, spend, sgd } from '../game/stats';

export const BUS_FARE = 1.09;
/** Near a stop and aboard, the clock runs this much of its normal rate. */
export const BUS_CLOCK = 0.2;
const V = 12,
  A = 1.6,
  DWELL = 9,
  TERMINAL = 18,
  LANE = 2.2,
  KERB = 4.6;

interface Route {
  no: string;
  pts: [number, number][];
  /** Cumulative length at each point. */
  cum: number[];
  len: number;
  stops: { name: string; s: number }[];
}
function route(no: string, pts: [number, number][], stops: [string, number, number][]): Route {
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const r: Route = { no, pts, cum, len: cum[cum.length - 1], stops: [] };
  // Each stop at the nearest point of the route.
  for (const [name, x, z] of stops) {
    let best = Infinity,
      bs = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1],
        [bx, bz] = pts[i];
      const dx = bx - ax,
        dz = bz - az,
        l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best) {
        best = d;
        bs = cum[i - 1] + t * Math.sqrt(l2);
      }
    }
    r.stops.push({ name, s: bs });
  }
  r.stops.sort((a, b) => a.s - b.s);
  return r;
}

export const R96 = route(
  '96',
  [
    [-945, 216],
    [-884.5, 216],
    [-878, 330],
    [-790, 310],
    [-700, 290],
    [-600, 330],
    [-579.4, 342.9],
    [-520, 230],
    [-452, 111],
  ],
  [
    ['Clementi Int', -945, 216],
    ['NUS Kent Ridge', -820, 317],
    ['Science Park (Chopee)', -640, 314],
    ['one-north', -502, 198],
    ['Buona Vista', -452, 111],
  ],
);

/** Point and direction of the route at arc length s. */
function at(r: Route, s: number): [number, number, number, number] {
  s = Math.max(0, Math.min(r.len, s));
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < s) i++;
  const [ax, az] = r.pts[i - 1],
    [bx, bz] = r.pts[i];
  const l = r.cum[i] - r.cum[i - 1];
  const t = (s - r.cum[i - 1]) / l;
  return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / l, (bz - az) / l];
}

interface Bus {
  r: Route;
  s: number;
  /** +1 towards the route's end, −1 back. */
  dir: number;
  v: number;
  /** Seconds left standing at a stop, and which. */
  dwell: number;
  stop: number;
  x: number;
  z: number;
  /** Heading (smoothed) and facing. */
  hx: number;
  hz: number;
  ry: number;
  mesh: THREE.Group;
}
const buses: Bus[] = [];

/* ---------- the bus model ---------- */

function busGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: string) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const col = new THREE.Color(c),
      n = g.attributes.position.count,
      a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    parts.push(g);
  };
  const L = 6,
    W = 1.25;
  const body = '#eeeee6',
    stripe = '#3f9a4a',
    dark = '#2b3035';
  box(-L, L, 0.35, 0.9, -W, W, dark); // chassis and floor
  box(-L, L, 0.88, 0.92, -W + 0.05, W - 0.05, '#6d757c');
  // Lower sides, with the two doorways on the left (−z) side.
  box(-L, L, 0.9, 1.9, W - 0.05, W, body);
  for (const [a, b] of [
    [-L, -1.1],
    [0.3, 3.4],
    [4.8, L],
  ])
    box(a, b, 0.9, 1.9, -W, -W + 0.05, body);
  box(-L, L, 1.6, 1.8, W, W + 0.01, stripe);
  box(-L, L, 1.6, 1.8, -W - 0.01, -W, stripe);
  // Window pillars, the roof, front and back.
  for (let x = -L; x <= L + 0.01; x += 1.5)
    for (const z of [-W, W - 0.08])
      if (!(z < 0 && ((x > -1.2 && x < 0.4) || (x > 3.3 && x < 4.9))))
        box(x - 0.06, x + 0.06, 1.9, 2.95, z, z + 0.08, body);
  box(-L, L, 2.95, 3.2, -W, W, body);
  box(L - 0.05, L, 0.9, 1.5, -W, W, body);
  box(L - 0.05, L, 2.75, 3.0, -W, W, '#f2a33a'); // destination display
  box(-L, -L + 0.05, 0.9, 3.0, -W, W, body);
  // Seats: pairs on the right, singles on the left behind the rear door.
  for (let x = -5.2; x < 2.8; x += 0.95) {
    box(x - 0.22, x + 0.22, 0.9, 1.35, 0.15, W - 0.1, '#7a3a8c');
    box(x - 0.3, x - 0.22, 1.35, 1.95, 0.15, W - 0.1, '#7a3a8c');
    if (x < -1.5) {
      box(x - 0.22, x + 0.22, 0.9, 1.35, -W + 0.1, -0.5, '#7a3a8c');
      box(x - 0.3, x - 0.22, 1.35, 1.95, -W + 0.1, -0.5, '#7a3a8c');
    }
  }
  box(-0.05, 0.05, 0.9, 2.95, -0.4, -0.3, '#c9c4ba'); // a pole
  // Wheels.
  for (const x of [-3.8, 3.8]) for (const z of [-W, W - 0.3]) box(x - 0.5, x + 0.5, 0, 1, z, z + 0.3, '#1d1f22');
  const g = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  return g;
}
function glassGeometry() {
  const g = new THREE.BoxGeometry(12, 1.05, 2.5);
  g.translate(0, 2.42, 0);
  return g;
}

/* ---------- the stops ---------- */

interface Pole {
  r: Route;
  stop: number;
  /** The direction of the buses that stop here. */
  dir: number;
  x: number;
  z: number;
}
const poles: Pole[] = [];

function lateral(r: Route, s: number, dir: number, off: number): [number, number, number, number] {
  const [x, z, dx, dz] = at(r, s);
  const hx = dx * dir,
    hz = dz * dir;
  // Left of the heading (Singapore drives on the left).
  return [x + hz * off, z - hx * off, hx, hz];
}

export function buildBuses() {
  const p = new PropSet('bus-stops');
  for (const r of [R96]) {
    r.stops.forEach((st, i) => {
      for (const dir of [1, -1]) {
        // The interchange has one pole, where the buses leave from.
        if (i === 0 && dir === -1) continue;
        const [x, z, hx, hz] = lateral(r, st.s, dir, KERB);
        const ry = Math.atan2(-hz, hx);
        poles.push({ r, stop: i, dir, x, z });
        p.post(x, z, 0, 2.6, 0.07, '#8e969c');
        p.put(x, 2.4, z, 0.5, 0.35, 0.05, '#1d2b36', ry);
        // A shelter behind the pole, away from the road.
        const bx = x + hz * 1.6,
          bz = z - hx * 1.6;
        p.put(bx, 2.7, bz, 6, 0.12, 2.2, '#c9ced2', ry);
        for (const e of [-2.8, 2.8]) p.post(bx + hx * e + hz * 0.9, bz + hz * e - hx * 0.9, 0, 2.7, 0.06, '#8e969c');
        p.put(bx + hz * 0.5, 0.45, bz - hx * 0.5, 3, 0.08, 0.5, '#8a6a4a', ry);
        sign(
          {
            text: st.name,
            sub: `Bus ${r.no}`,
            w: 2.4,
            h: 0.5,
            bg: '#1d2b36',
            fg: '#ffffff',
            border: '#1d2b36',
            font: 'ui',
          },
          bx + hz * 0.05,
          2.95,
          bz - hx * 0.05,
          ry + Math.PI / 2,
          { both: true },
        );
        const pole = poles[poles.length - 1];
        register({
          x,
          y: 1.6,
          z,
          reach: 2.8,
          size: 0.8,
          label: () => (player.ride ? null : `Bus stop: ${st.name}`),
          run: () => board(pole),
        });
      }
    });
  }
  // The interchange's canopy and sign, along the Clementi food centre.
  const [ix, iz] = [-930, 209.5];
  p.box(ix - 18, ix + 18, 3.2, 3.4, iz - 2, iz + 2, '#c9ced2');
  for (let x = ix - 16; x <= ix + 16; x += 8) p.post(x, iz + 1.8, 0, 3.2, 0.1, '#8e969c');
  sign(
    {
      text: 'Clementi Bus Interchange',
      sub: 'Service 96 · NUS · Science Park · one-north · Buona Vista',
      w: 7,
      h: 1,
      bg: '#1d2b36',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#f2c14e',
      font: 'ui',
    },
    ix - 10,
    2.6,
    iz + 2.05,
    0,
    { both: true },
  );
  p.build();
  p.show(true);

  // The buses: three on route 96, spread round the loop.
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glassMat = new THREE.MeshLambertMaterial({
    color: 0x9fc3d1,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const geo = busGeometry(),
    glass = glassGeometry();
  for (let k = 0; k < 3; k++) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    g.add(m, new THREE.Mesh(glass, glassMat));
    scene.add(g);
    const u = (k / 3) * 2 * R96.len;
    const dir = u < R96.len ? 1 : -1;
    const s = dir === 1 ? u : 2 * R96.len - u;
    const b: Bus = { r: R96, s, dir, v: V * 0.5, dwell: 0, stop: -1, x: 0, z: 0, hx: 1, hz: 0, ry: 0, mesh: g };
    const [, , hx, hz] = lateral(R96, s, dir, 0);
    b.hx = hx;
    b.hz = hz;
    buses.push(b);
    // Board at the front door while it stands at a stop.
    register({
      get x() {
        return doorAt(b)[0];
      },
      get z() {
        return doorAt(b)[1];
      },
      y: 1.4,
      reach: 3.2,
      size: 1.2,
      label: () => (!player.ride && b.dwell > 0.8 ? `Board bus ${b.r.no} to ${endName(b)} (${sgd(BUS_FARE)})` : null),
      run: () => boardBus(b),
    });
  }
}

const endName = (b: Bus) => (b.dir === 1 ? b.r.stops[b.r.stops.length - 1] : b.r.stops[0]).name;
/** Local point of a bus to world. */
function local(b: Bus, lx: number, lz: number): [number, number] {
  // Local +x is the heading; local +z is to the right of it.
  return [b.x + b.hx * lx - b.hz * lz, b.z + b.hz * lx + b.hx * lz];
}
const doorAt = (b: Bus) => local(b, 4.1, -2);

/* ---------- moving ---------- */

function nextStop(b: Bus) {
  const st = b.r.stops;
  if (b.dir === 1) {
    for (let i = 0; i < st.length; i++) if (st[i].s > b.s + 0.01) return i;
    return st.length - 1;
  }
  for (let i = st.length - 1; i >= 0; i--) if (st[i].s < b.s - 0.01) return i;
  return 0;
}

function step(b: Bus, dt: number) {
  if (b.dwell > 0) {
    b.dwell -= dt;
    if (b.dwell <= 0) {
      b.dwell = 0;
      if (b.stop === 0 || b.stop === b.r.stops.length - 1) b.dir = b.stop === 0 ? 1 : -1;
      if (ride?.b === b) departed(b);
    }
    return;
  }
  const i = nextStop(b);
  const D = Math.abs(b.r.stops[i].s - b.s);
  b.v = Math.min(b.v + A * dt, V, Math.sqrt(2 * A * D) + 0.4);
  const ds = Math.min(b.v * dt, D);
  b.s += ds * b.dir;
  if (D - ds < 0.05) {
    b.s = b.r.stops[i].s;
    b.v = 0;
    b.stop = i;
    b.dwell = i === 0 || i === b.r.stops.length - 1 ? TERMINAL : DWELL;
    if (ride?.b === b) arrived(b, i);
  }
}

function place(b: Bus, dt: number) {
  const [x, z, dx, dz] = at(b.r, b.s);
  // Turn smoothly toward the heading (the U-turn at the ends happens while it stands).
  const tx = dx * b.dir,
    tz = dz * b.dir;
  const k = Math.min(1, dt * 3);
  b.hx += (tx - b.hx) * k;
  b.hz += (tz - b.hz) * k;
  const l = Math.hypot(b.hx, b.hz) || 1;
  b.hx /= l;
  b.hz /= l;
  b.x = x + b.hz * LANE;
  b.z = z - b.hx * LANE;
  b.ry = Math.atan2(-b.hz, b.hx);
  b.mesh.position.set(b.x, 0, b.z);
  b.mesh.rotation.y = b.ry;
}

/* ---------- riding ---------- */

let ride: { b: Bus; dest: number | null; ry: number } | null = null;
const SEAT = { lx: -2.4, lz: 0.7 };

function seatRide(): Ride {
  return {
    step() {
      if (!ride) return;
      const b = ride.b;
      const [x, z] = local(b, SEAT.lx, SEAT.lz);
      player.x = x;
      player.z = z;
      player.y = 0.45;
      player.vx = player.vz = 0;
      let d = b.ry - ride.ry;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      player.yaw += d;
      ride.ry = b.ry;
    },
    label: () => {
      const b = ride!.b;
      const n = b.dwell > 0 ? b.r.stops[b.stop].name : b.r.stops[nextStop(b)].name;
      return `Bus ${b.r.no} to ${endName(b)} · ${b.dwell > 0 ? 'at' : 'next'} ${n}`;
    },
  };
}

function boardBus(b: Bus) {
  if (!wallet.card) return toast('No card', 'Buses take the EZ-Lah card. 8-Twelve sells them.');
  if (!spend(BUS_FARE)) return toast('Not enough money', `The fare is ${sgd(BUS_FARE)}.`);
  sfx('tap');
  ride = { b, dest: null, ry: b.ry };
  player.ride = seatRide();
  player.yaw = b.ry - Math.PI / 2 + 0.35;
  player.pitch = 0;
  toast(
    `Bus ${b.r.no} to ${endName(b)}`,
    `Tapped in · ${sgd(BUS_FARE)}. Press E to ring the bell for your stop.`,
    null,
  );
}

function alight() {
  if (!ride) return;
  const b = ride.b;
  const [x, z] = local(b, 4.1, -2.6);
  ride = null;
  player.ride = null;
  player.x = x;
  player.z = z;
  player.y = 0;
  player.yaw = Math.atan2(b.hz, -b.hx) + Math.PI; // facing away from the bus
  toast(`${b.r.stops[b.stop].name}`, 'Thank you, uncle!', null);
}

function arrived(b: Bus, i: number) {
  if (!ride) return;
  const end = i === 0 || i === b.r.stops.length - 1;
  if (ride.dest === i || end) {
    if (end && ride.dest !== i) toast('End of the line', `${b.r.stops[i].name}. All alight.`, null);
    setTimeout(alight, 600);
  }
}
function departed(b: Bus) {
  if (ride && ride.dest === b.stop) ride.dest = null;
}

/** E aboard: ring the bell for a stop, or get off while standing at one. */
export function busMenu(): boolean {
  if (!ride) return false;
  const b = ride.b;
  const rows: Row[] = [];
  if (b.dwell > 0)
    rows.push({ label: `Get off here (${b.r.stops[b.stop].name})`, run: () => (closePanel(), alight()) });
  const st = b.r.stops;
  for (let i = nextStop(b); i >= 0 && i < st.length; i += b.dir) {
    if (b.dwell > 0 && i === b.stop) continue;
    rows.push({
      label: `Ring the bell for ${st[i].name}`,
      note: ride.dest === i ? 'bell rung' : undefined,
      run: () => {
        if (ride) ride.dest = i;
        sfx('chime');
        closePanel();
        toast('Ding!', `Stopping at ${st[i].name}.`, null);
      },
    });
    if (i === 0 || i === st.length - 1) break;
  }
  rows.push({ label: 'Keep riding', run: () => closePanel() });
  openPanel({ title: `Bus ${b.r.no} to ${endName(b)}`, sub: 'Where are you getting off?', rows });
  return true;
}

/** E at a stop: when the next buses come (in game minutes). */
function board(pole: Pole) {
  const r = pole.r;
  const L2 = 2 * r.len;
  const target = pole.dir === 1 ? r.stops[pole.stop].s : L2 - r.stops[pole.stop].s;
  const etas = buses
    .filter(b => b.r === r)
    .map(b => {
      if (b.dwell > 0 && b.stop === pole.stop && (b.dir === pole.dir || pole.stop === 0)) return 0;
      const u = b.dir === 1 ? b.s : L2 - b.s;
      const d = (target - u + L2) % L2;
      let stops = 0;
      for (const st of r.stops)
        for (const su of [st.s, L2 - st.s]) {
          const dd = (su - u + L2) % L2;
          if (dd > 0.5 && dd < d - 0.5) stops++;
        }
      return (d / (V * 0.85) + stops * DWELL + b.dwell) * RATE * BUS_CLOCK;
    })
    .sort((a, b) => a - b);
  const towards = pole.dir === 1 ? r.stops[r.stops.length - 1].name : r.stops[0].name;
  const fmt = (m: number) => (m < 0.6 ? 'arriving' : `${Math.round(m)} min`);
  openPanel({
    title: r.stops[pole.stop].name,
    sub: `Bus ${r.no} towards ${towards}`,
    body: `Next buses: ${etas.slice(0, 2).map(fmt).join(', then ')}.`,
    rows: [{ label: 'OK', run: () => closePanel() }],
  });
}

/* ---------- every frame ---------- */

export function updateBuses(dt: number) {
  let t = dt * timeWarp();
  while (t > 1e-6) {
    const h = Math.min(t, 0.25);
    for (const b of buses) step(b, h);
    t -= h;
  }
  for (const b of buses) {
    const far = Math.hypot(b.x - player.x, b.z - player.z) > 700;
    b.mesh.visible = !far;
    place(b, dt);
  }
  // Waiting at a stop or riding: the clock slows (as at MRT stations).
  if (ride || (player.y < 1 && poles.some(p => Math.abs(p.x - player.x) + Math.abs(p.z - player.z) < 7)))
    S.clockScale = BUS_CLOCK;
}

export const onBus = () => !!ride;
/** For headless checks. */
export const busDebug = { buses, poles };
