/* Taxis and ride-hail (step 10). Aldi is a passenger:
   - At a taxi stand (E): choose where to go; a taxi comes down the road, pulls
     up, and Aldi gets in (E at the car).
   - Nab, on the phone: the same from anywhere near a road, a little dearer at
     the rush hours; the car's plate shows in the marker.
   The car drives the road graph's shortest way (city/roadgraph.ts) on the left,
   Aldi in the back seat with the view turning with it; E aboard stops early.
   At the end it pulls up and Aldi steps out on the kerb; the fare (by distance)
   goes on the card. The clock slows aboard as on the buses, and the car runs a
   little faster than the traffic so rides stay short. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { S } from '../core/state';
import { player, type Ride } from '../core/player';
import { timeWarp } from '../core/time';
import { register } from './interact';
import { openPanel, closePanel, type Row } from '../ui/panel';
import { toast } from '../ui/hud';
import { sfx } from '../audio/audio';
import { wallet, spend, sgd } from './stats';
import { markTo } from './marker';
import { route, pathLength, nearestNode } from '../city/roadgraph';
import { carBody, carCabin, TAXI_COLS } from '../city/traffic';
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { home, HOMES } from '../places/homes';
import {
  CHOPEE_HQ,
  CITY_OFFICE,
  CLEMENTI_HAWKER,
  LAU_PA_SAT,
  LUCKY,
  PROMENADE,
  MOSQUE,
  CT_MARKET,
  TEKKA,
  KATONG_ROW,
  LAGOON,
  UNIWORSAL,
  ZOO,
  CHECKPOINT,
  EMBASSY,
  HOME_SITES,
  unitOf,
} from '../places/sites';
import { EWL } from '../city/mrtdata';

interface Dest {
  name: string;
  x: number;
  z: number;
}
function destinations(): Dest[] {
  const d: Dest[] = [];
  if (home.id) {
    const s = HOME_SITES.find(h => h.id === home.id)!;
    const u = unitOf(s);
    d.push({ name: `Home (${HOMES[home.id].name})`, x: (u.x0 + u.x1) / 2, z: u.z1 + 4 });
  }
  const c = (r: { x0: number; x1: number; z1: number }) => (r.x0 + r.x1) / 2;
  const t3 = EWL.stations[0];
  d.push(
    { name: 'Chopee HQ, Science Park', x: c(CHOPEE_HQ), z: CHOPEE_HQ.z1 + 6 },
    { name: 'Won Raffles Place (city office)', x: c(CITY_OFFICE), z: CITY_OFFICE.z1 + 6 },
    { name: 'Changi Airport', x: t3.x - 20, z: t3.z - 80 },
    { name: '448 Clementi', x: CLEMENTI_HAWKER.x, z: CLEMENTI_HAWKER.z + 16 },
    { name: 'Lau Pa Sat', x: LAU_PA_SAT.x, z: LAU_PA_SAT.z + 16 },
    { name: 'Lucky Place, Orchard', x: c(LUCKY), z: LUCKY.z1 + 8 },
    { name: 'Marina Bay (the promenade)', x: PROMENADE.x, z: PROMENADE.z },
    { name: 'Masjid Sultan', x: MOSQUE.x, z: MOSQUE.z + MOSQUE.d / 2 + 8 },
    { name: 'Chinatown', x: c(CT_MARKET), z: CT_MARKET.z1 + 6 },
    { name: 'Tekka Centre, Little India', x: TEKKA.x, z: TEKKA.z + 16 },
    { name: 'Katong', x: c(KATONG_ROW), z: KATONG_ROW.z0 - 6 },
    { name: 'East Coast Park', x: LAGOON.x, z: LAGOON.z + 16 },
    { name: 'Sentosa (Uniworsal)', x: UNIWORSAL.x, z: UNIWORSAL.z - 10 },
    { name: 'Mandai Zoo', x: ZOO.x, z: ZOO.z + ZOO.d / 2 + 8 },
    { name: 'Woodlands Checkpoint', x: CHECKPOINT.x, z: CHECKPOINT.z + CHECKPOINT.d / 2 + 8 },
    { name: 'Indonesian embassy', x: EMBASSY.x, z: EMBASSY.z + EMBASSY.d / 2 + 6 },
  );
  return d;
}

/** Taxi stands: where, and what they're called. */
const STANDS: Dest[] = [];
function stands() {
  const t3 = EWL.stations[0];
  STANDS.push(
    { name: 'Changi Airport T3', x: t3.x - 45, z: t3.z - 84 },
    { name: 'Raffles Place', x: CITY_OFFICE.x0 - 4, z: CITY_OFFICE.z1 + 5 },
    { name: 'Orchard (Lucky Place)', x: LUCKY.x0 - 4, z: LUCKY.z1 + 6 },
    { name: 'Clementi', x: CLEMENTI_HAWKER.x - 18, z: CLEMENTI_HAWKER.z + 13 },
    { name: 'Science Park (Chopee)', x: CHOPEE_HQ.x0 - 4, z: CHOPEE_HQ.z1 + 5 },
    { name: 'Marina Bay', x: PROMENADE.x - 12, z: PROMENADE.z + 8 },
  );
}

/* ---------- fares ---------- */

const rush = () => (S.time >= 8 * 60 && S.time < 9.5 * 60) || (S.time >= 18 * 60 && S.time < 20 * 60);
function fare(kind: 'taxi' | 'nab', metres: number) {
  const base = kind === 'taxi' ? 4.1 + metres * 0.0055 : (3.5 + metres * 0.006) * (rush() ? 1.5 : 1);
  return Math.round(base * 20) / 20;
}

/* ---------- the car ---------- */

type Phase = 'none' | 'coming' | 'waiting' | 'riding';
const trip = {
  phase: 'none' as Phase,
  kind: 'taxi' as 'taxi' | 'nab',
  dest: null as Dest | null,
  path: [] as [number, number][],
  seg: 0,
  t: 0,
  x: 0,
  z: 0,
  ry: 0,
  hx: 1,
  hz: 0,
  fare: 0,
  plate: '',
  lastRy: 0,
};
let car: THREE.Group;
let bodyMat: THREE.MeshLambertMaterial;
const SPEED = 18;

export function buildTaxis() {
  stands();
  bodyMat = new THREE.MeshLambertMaterial({ color: 0x2f6fb3 });
  car = new THREE.Group();
  car.add(new THREE.Mesh(carBody(), bodyMat), new THREE.Mesh(carCabin(), new THREE.MeshLambertMaterial({ color: 0x1d2b36 })));
  car.visible = false;
  scene.add(car);
  const p = new PropSet('taxi-stands');
  for (const s of STANDS) {
    p.post(s.x, s.z, 0, 2.6, 0.07, '#8e969c');
    sign({ text: 'TAXI', sub: s.name, w: 1.6, h: 0.6, bg: '#f2c14e', fg: '#1d2b36', subfg: '#1d2b36', border: '#1d2b36', font: 'ui' }, s.x, 2.5, s.z, 0, { both: true });
    register({
      x: s.x,
      y: 1.6,
      z: s.z,
      reach: 3,
      size: 0.8,
      label: () => (trip.phase === 'none' && !player.ride ? `Taxi stand: ${s.name}` : null),
      run: () => chooseDest('taxi'),
    });
  }
  p.build();
  p.show(true);
  // Getting in: at the car's rear door, while it waits.
  register({
    get x() {
      return trip.x + trip.hz * 1.2;
    },
    get z() {
      return trip.z - trip.hx * 1.2;
    },
    y: 1.2,
    reach: 3.5,
    size: 1.5,
    label: () => (trip.phase === 'waiting' && !player.ride ? `Get in (${trip.kind === 'nab' ? `Nab · ${trip.plate}` : 'taxi'})` : null),
    run: getIn,
  });
}

/** The phone's Nab app. */
export function nabApp() {
  if (trip.phase !== 'none') {
    openPanel({
      title: 'Nab',
      sub: trip.phase === 'riding' ? 'On the way' : `Your driver · ${trip.plate}`,
      body: trip.phase === 'riding' ? `To ${trip.dest!.name}.` : 'Your car is coming. Look for the marker.',
      rows: [
        ...(trip.phase !== 'riding' ? [{ label: 'Cancel the ride', run: () => (cancel(), closePanel()) }] : []),
        { label: 'OK', run: () => closePanel() },
      ],
    });
    return;
  }
  chooseDest('nab');
}

function chooseDest(kind: 'taxi' | 'nab') {
  const here = nearestNode(player.x, player.z, 120);
  if (!here) return toast(kind === 'nab' ? 'Nab' : 'Taxi', 'No road near here. Walk to a road first.');
  const rows: Row[] = destinations()
    .filter(d => Math.hypot(d.x - player.x, d.z - player.z) > 80)
    .map(d => {
      const p = route(here.x, here.z, d.x, d.z);
      const m = p ? pathLength(p) : 0;
      return {
        label: d.name,
        note: p ? `~${sgd(fare(kind, m))} · ${Math.max(1, Math.round((m / SPEED) * 0.8 * 0.3))} min` : 'no road',
        disabled: p ? undefined : 'No road there',
        run: () => {
          closePanel();
          call(kind, d);
        },
      };
    });
  openPanel({
    title: kind === 'nab' ? 'Nab' : 'Taxi',
    sub: kind === 'nab' ? `Where to?${rush() ? ' (busy: fares ×1.5)' : ''}` : 'Where to, boss?',
    rows: [...rows, { label: 'Never mind', run: () => closePanel() }],
  });
}

/** A car comes to Aldi: from a road 120–200 m away along the graph to the nearest node. */
function call(kind: 'taxi' | 'nab', dest: Dest) {
  if (!wallet.card) return toast('No card', 'Fares go on the EZ-Lah card.');
  const here = nearestNode(player.x, player.z, 120)!;
  let from = null;
  for (let k = 0; k < 12 && !from; k++) {
    const a = (k / 12) * Math.PI * 2;
    const n = nearestNode(here.x + Math.cos(a) * 160, here.z + Math.sin(a) * 160, 80);
    if (n && n.id !== here.id) from = n;
  }
  const path = from ? route(from.x, from.z, here.x, here.z) : null;
  trip.kind = kind;
  trip.dest = dest;
  trip.plate = `SGX ${1000 + Math.floor(Math.random() * 9000)}${'ABCDEHJKLMPRSTXYZ'[Math.floor(Math.random() * 17)]}`;
  bodyMat.color.set(kind === 'nab' ? '#2f8a4e' : TAXI_COLS[Math.floor(Math.random() * 3)]);
  car.visible = true;
  if (path && path.length > 1) startPath(path, 'coming');
  else {
    trip.x = here.x;
    trip.z = here.z;
    trip.phase = 'waiting';
  }
  toast(kind === 'nab' ? `Nab: ${trip.plate} is coming` : 'A taxi is coming', kind === 'nab' ? 'A green car. It will stop at the road nearest you.' : 'It will pull up at the stand.', 'msg');
}
function startPath(path: [number, number][], phase: Phase) {
  trip.path = path;
  trip.seg = 0;
  trip.t = 0;
  trip.phase = phase;
  place();
}
function cancel() {
  trip.phase = 'none';
  car.visible = false;
}

function getIn() {
  const d = trip.dest!;
  const p = route(trip.x, trip.z, d.x, d.z);
  if (!p || p.length < 2) return toast('Cannot go there', 'No road there from here.');
  trip.fare = fare(trip.kind, pathLength(p));
  startPath(p, 'riding');
  trip.lastRy = trip.ry;
  player.ride = seat();
  player.yaw = trip.ry - Math.PI / 2 + 0.3;
  sfx('tap');
  toast(trip.kind === 'nab' ? `Nab to ${d.name}` : `Taxi to ${d.name}`, `About ${sgd(trip.fare)}. E to stop early.`, null);
}
function seat(): Ride {
  return {
    step() {
      // In the back, behind the driver (on the right).
      const lx = -0.7,
        lz = 0.45;
      player.x = trip.x + trip.hx * lx - trip.hz * lz;
      player.z = trip.z + trip.hz * lx + trip.hx * lz;
      player.y = 0.1;
      player.vx = player.vz = 0;
      let d = trip.ry - trip.lastRy;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      player.yaw += d;
      trip.lastRy = trip.ry;
    },
    label: () => `${trip.kind === 'nab' ? 'Nab' : 'Taxi'} to ${trip.dest!.name} · ${sgd(trip.fare)}`,
  };
}
/** E aboard: stop here. */
export function taxiMenu(): boolean {
  if (trip.phase !== 'riding' || !player.ride) return false;
  openPanel({
    title: trip.kind === 'nab' ? 'Nab' : 'Taxi',
    sub: `To ${trip.dest!.name}`,
    rows: [
      { label: 'Stop here, please', run: () => (closePanel(), arrive(true)) },
      { label: 'Keep going', run: () => closePanel() },
    ],
  });
  return true;
}

function arrive(early = false) {
  // Pay for the way driven.
  const done = trip.path.slice(0, trip.seg + 1);
  const driven = pathLength(done) + trip.t;
  const f = early ? Math.min(trip.fare, fare(trip.kind, driven)) : trip.fare;
  spend(f) || toast('Card declined', 'Not enough on the card: the driver lets it go this once.');
  player.ride = null;
  // Out on the kerb, on the left.
  player.x = trip.x + trip.hz * 2.8;
  player.z = trip.z - trip.hx * 2.8;
  player.y = 0;
  toast(early ? 'Dropped off here' : trip.dest!.name, `${sgd(f)} on the card. "Thank you, boss!"`, null);
  trip.phase = 'none';
  setTimeout(() => (car.visible = trip.phase !== 'none'), 1500);
}

function place() {
  const p = trip.path;
  const i = Math.min(trip.seg, p.length - 2);
  const [ax, az] = p[i],
    [bx, bz] = p[i + 1];
  const len = Math.hypot(bx - ax, bz - az) || 1;
  const dx = (bx - ax) / len,
    dz = (bz - az) / len;
  const k = 0.25;
  trip.hx += (dx - trip.hx) * k;
  trip.hz += (dz - trip.hz) * k;
  const l = Math.hypot(trip.hx, trip.hz) || 1;
  trip.hx /= l;
  trip.hz /= l;
  const f = Math.min(1, trip.t / len);
  trip.x = ax + (bx - ax) * f + dz * 1.8;
  trip.z = az + (bz - az) * f - dx * 1.8;
  trip.ry = Math.atan2(-trip.hz, trip.hx);
  car.position.set(trip.x, 0, trip.z);
  car.rotation.y = trip.ry;
}

export function updateTaxis(dt: number) {
  if (trip.phase === 'coming' || trip.phase === 'riding') {
    let t = dt * SPEED * Math.min(timeWarp(), 6);
    const p = trip.path;
    while (t > 0 && trip.seg < p.length - 1) {
      const [ax, az] = p[trip.seg],
        [bx, bz] = p[trip.seg + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const step = Math.min(t, len - trip.t);
      trip.t += step;
      t -= step;
      if (trip.t >= len - 1e-6) {
        trip.seg++;
        trip.t = 0;
      }
    }
    if (trip.seg >= p.length - 1) {
      trip.seg = p.length - 2;
      trip.t = Math.hypot(p[p.length - 1][0] - p[p.length - 2][0], p[p.length - 1][1] - p[p.length - 2][1]);
      place();
      if (trip.phase === 'coming') {
        trip.phase = 'waiting';
        toast(trip.kind === 'nab' ? `${trip.plate} is here` : 'Your taxi is here', 'Get in at the back (E).', 'msg');
      } else arrive();
    } else place();
  }
  if (trip.phase === 'riding') S.clockScale = 0.3;
  if (trip.phase === 'coming' || trip.phase === 'waiting') markTo(trip.kind === 'nab' ? `Nab · ${trip.plate}` : 'Taxi', [trip.x, 1.2, trip.z]);
}
export const taxiDebug = { trip };
