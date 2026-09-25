/* Aldi's own car (step 11): a big goal, earned step by step.
   - Saving up: the goals box counts the car fund once Aldi has a licence in mind
     (the cheapest car's down payment).
   - The licence: at the BB Drive Centre, a theory test (a quiz on Singapore's
     road rules) and a practical test on the centre's circuit (through four gates
     in order inside the time, without knocking over the cones).
   - Buying: Leng Kee Autos has three used cars; pay in full or put 40% down and
     take a five-year loan (monthly instalments on the 1st).
   - Driving: E at the car. W/S to go and brake (and reverse), A/D to steer, Space
     for the handbrake; the view is from the driver's seat (on the right). The car
     stops against walls. E when stopped gets out; the car stays where it's left.
   - Running it: petrol (a tank that runs down with the kilometres; fill up at a
     station), ERP gantries into the city (S$1–3 in the day on weekdays), street
     parking in the CBD and Orchard (by the half hour, capped), and on the 1st the
     loan, insurance and road tax, and season parking at home. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { S } from '../core/state';
import { player, keys, type Ride } from '../core/player';
import { collide } from '../core/collision';
import { register } from './interact';
import { openPanel, closePanel, type Row } from '../ui/panel';
import { toast } from '../ui/hud';
import { sfx } from '../audio/audio';
import { wallet, spend, sgd, addMood } from './stats';
import { dateOf, weekday } from './calendar';
import { markTo } from './marker';
import { goalLines } from './work';
import { townAt } from '../city/geo';
import { carBody, carCabin } from '../city/traffic';
import { home } from '../places/homes';
import { DRIVE_CENTRE, DEALER, PETROL, ERP } from '../places/sites';

interface Model {
  id: string;
  name: string;
  year: number;
  price: number;
  color: string;
  top: number;
}
const MODELS: Model[] = [
  { id: 'corolla', name: 'Toyoda Corolla', year: 2016, price: 48000, color: '#e8e4da', top: 24 },
  { id: 'jazz', name: 'Hondo Jazz', year: 2019, price: 62000, color: '#b8342a', top: 25 },
  { id: 'mazda', name: 'Mazdo 3', year: 2022, price: 98000, color: '#2f6fb3', top: 28 },
];
const DOWN = 0.4,
  RATE = 0.028,
  YEARS = 5;

export const car = {
  theory: false,
  licence: false,
  model: null as string | null,
  x: 0,
  z: 0,
  ry: 0,
  fuel: 100,
  loan: 0,
  monthly: 0,
  paid: [] as number[],
  /** When it was parked on the street (game minutes since day 0), or -1. */
  parkedAt: -1,
  parkedPaid: false,
};
const model = () => MODELS.find(m => m.id === car.model) ?? null;

/* ---------- the car in the world ---------- */

let mesh: THREE.Group;
let bodyMat: THREE.MeshLambertMaterial;
const drive = { v: 0, active: false, test: false, lastRy: 0 };

export function buildCar() {
  bodyMat = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  mesh = new THREE.Group();
  mesh.add(
    new THREE.Mesh(carBody(), bodyMat),
    new THREE.Mesh(carCabin(), new THREE.MeshLambertMaterial({ color: 0x1d2b36 })),
  );
  mesh.visible = false;
  mesh.traverse(o => (o.castShadow = true));
  scene.add(mesh);
  buildCentre();
  buildDealer();
  buildPetrol();
  buildErp();
  // Getting in at the driver's door (on the right).
  register({
    get x() {
      return car.x + Math.sin(car.ry) * 1.3;
    },
    get z() {
      return car.z + Math.cos(car.ry) * 1.3;
    },
    y: 1.1,
    reach: 3,
    size: 1.4,
    label: () => (mesh.visible && !player.ride && !drive.test ? `Drive the ${model()?.name ?? 'car'}` : null),
    run: () => getIn(false),
  });
  goalLines.push(() => {
    if (car.model) return null;
    const cheapest = MODELS[0].price * DOWN;
    if (!car.licence && wallet.money < 5000) return null;
    return car.licence
      ? `Car fund: ${sgd(wallet.money)} of ${sgd(cheapest)} (down payment, Leng Kee Autos)`
      : 'A car of your own: first the licence at BB Drive Centre';
  });
}

function show() {
  const m = model();
  mesh.visible = !!m || drive.test;
  if (m && !drive.test) bodyMat.color.set(m.color);
  mesh.position.set(car.x, 0, car.z);
  mesh.rotation.y = car.ry;
}

function getIn(test: boolean) {
  if (!test && !car.licence) return toast('No licence', 'Aldi needs a Singapore licence first: BB Drive Centre.');
  if (!test && car.fuel <= 0)
    return toast(
      'Out of petrol',
      'The tank is empty. A station attendant can bring a can (call from the phone, My car).',
    );
  drive.active = true;
  drive.test = test;
  drive.v = 0;
  drive.lastRy = car.ry;
  player.ride = driverSeat();
  player.yaw = car.ry - Math.PI / 2;
  player.pitch = -0.05;
  // Street parking: pay for the time it stood there.
  if (!test && car.parkedAt >= 0) {
    const mins = S.day * 1440 + S.time - car.parkedAt;
    const cost = Math.min(12, Math.ceil(mins / 30) * 1.2);
    if (cost > 0 && spend(cost)) toast('Street parking', `${sgd(cost)} for ${Math.round(mins)} minutes.`, null);
    car.parkedAt = -1;
  }
  sfx('tap');
}
function getOut() {
  if (Math.abs(drive.v) > 1) return toast('Stop first', 'Brake (S) until the car stands still.');
  drive.active = false;
  player.ride = null;
  // Out on the right, by the driver's door.
  player.x = car.x + Math.sin(car.ry) * 1.8;
  player.z = car.z + Math.cos(car.ry) * 1.8;
  player.y = 0;
  const t = townAt(car.x, car.z);
  const paid = t && ['cbd', 'mall', 'landmark'].includes(t.kind);
  car.parkedAt = paid && !drive.test ? S.day * 1440 + S.time : -1;
  if (paid && !drive.test) toast('Parked', 'Street parking here: S$1.20 per half hour, paid when you drive off.', null);
}
/** E while driving. */
export function carMenu(): boolean {
  if (!drive.active) return false;
  const rows: Row[] = [];
  if (drive.test) rows.push({ label: 'Give up the test', run: () => (closePanel(), endTest(false, 'You gave up.')) });
  else rows.push({ label: 'Get out (park here)', run: () => (closePanel(), getOut()) });
  rows.push({ label: 'Keep driving', run: () => closePanel() });
  openPanel({
    title: drive.test ? 'Practical test' : (model()?.name ?? 'Car'),
    sub: `${Math.round(Math.abs(drive.v) * 3.6)} km/h · petrol ${Math.round(car.fuel)}%`,
    rows,
  });
  return true;
}

function driverSeat(): Ride {
  return {
    step(dt) {
      const top = drive.test ? 14 : (model()?.top ?? 24);
      const w = keys.has('KeyW') || keys.has('ArrowUp'),
        s = keys.has('KeyS') || keys.has('ArrowDown'),
        a = keys.has('KeyA') || keys.has('ArrowLeft'),
        d = keys.has('KeyD') || keys.has('ArrowRight'),
        hb = keys.has('Space');
      const fuelOk = drive.test || car.fuel > 0;
      if (w && fuelOk) drive.v += (drive.v < 0 ? 9 : 3.4) * dt;
      else if (s) drive.v -= (drive.v > 0 ? 9 : 2.2) * dt;
      else drive.v -= Math.sign(drive.v) * Math.min(Math.abs(drive.v), 1.2 * dt);
      if (hb) drive.v -= Math.sign(drive.v) * Math.min(Math.abs(drive.v), 14 * dt);
      drive.v = Math.max(-5, Math.min(top, drive.v));
      // Steering: sharper when slow, gentle at speed.
      const steer = (a ? 1 : 0) - (d ? 1 : 0);
      const turn =
        steer *
        Math.min(1, Math.abs(drive.v) / 4) *
        (1.1 - Math.min(0.6, Math.abs(drive.v) / 40)) *
        Math.sign(drive.v || 1);
      car.ry += turn * dt;
      const fx = Math.cos(car.ry),
        fz = -Math.sin(car.ry);
      const p = { x: car.x + fx * drive.v * dt, z: car.z + fz * drive.v * dt };
      const before = { x: p.x, z: p.z };
      collide(p, 1.1, 0);
      if (Math.hypot(p.x - before.x, p.z - before.z) > 0.01) {
        if (Math.abs(drive.v) > 6) toast('Bump!', 'Careful lah.', 'bad');
        drive.v *= 0.2;
      }
      const moved = Math.hypot(p.x - car.x, p.z - car.z);
      if (!drive.test) car.fuel = Math.max(0, car.fuel - moved * 0.0012);
      checkErp(car.x, car.z, p.x, p.z);
      car.x = p.x;
      car.z = p.z;
      show();
      // The driver's seat: front right.
      player.x = car.x + fx * 0.1 + Math.sin(car.ry) * 0.42;
      player.z = car.z + fz * 0.1 + Math.cos(car.ry) * 0.42;
      player.y = -0.55;
      player.vx = player.vz = 0;
      let dr = car.ry - drive.lastRy;
      if (dr > Math.PI) dr -= Math.PI * 2;
      if (dr < -Math.PI) dr += Math.PI * 2;
      player.yaw += dr;
      drive.lastRy = car.ry;
      if (drive.test) testStep(dt);
    },
    label: () =>
      drive.test ? 'Practical test' : `${model()?.name ?? 'Car'} · ${Math.round(Math.abs(drive.v) * 3.6)} km/h`,
  };
}

/* ---------- the driving centre ---------- */

const QUIZ: [string, string[], number][] = [
  ['Which side of the road do you drive on in Singapore?', ['Left', 'Right', 'Either'], 0],
  ['The speed limit on most town roads, unless signs say otherwise?', ['50 km/h', '70 km/h', '90 km/h'], 0],
  ['The speed limit on the expressways, unless signs say otherwise?', ['70 km/h', '90 km/h', '110 km/h'], 1],
  [
    'A yellow box junction means…',
    ['Stop inside it and wait', "Don't enter unless your exit is clear", 'Buses only'],
    1,
  ],
  ['An ERP gantry charges you when…', ['You park under it', 'You pass under it during its hours', 'You honk at it'], 1],
  [
    'At a pedestrian crossing with someone waiting, you…',
    ['Honk so they wait', 'Speed up to pass first', 'Slow down and give way'],
    2,
  ],
  [
    'A double yellow line along the kerb means…',
    ['No parking at any time', 'Parking after 7pm', 'Motorcycles only'],
    0,
  ],
  ['Using a phone while driving is…', ['Fine at red lights', 'Not allowed unless hands-free', 'Fine under 30 km/h'], 1],
];

function buildCentre() {
  const { x, z, w, d } = DRIVE_CENTRE;
  const p = new PropSet('drive-centre');
  const x0 = x - w / 2,
    z0 = z - d / 2,
    z1 = z + d / 2;
  p.box(x0, x + w / 2, 0, 0.05, z0, z1, '#55585c');
  p.box(x0 - 12, x0, 0, 7, z0, z0 + 16, '#e6e0d4', { col: true });
  sign(
    {
      text: 'BB Drive Centre',
      sub: 'Theory · Practical · Licences',
      w: 5,
      h: 1,
      bg: '#2f6fb3',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#f2c14e',
      font: 'ui',
    },
    x0 - 6,
    5,
    z0 + 16.1,
    0,
    { both: true },
  );
  // Cones along the circuit.
  for (const [cx, cz] of cones) p.put(cx, 0.35, cz, 0.3, 0.7, 0.3, '#e07a1f', 0, p.cone);
  for (const [gx, gz] of gates) {
    p.post(gx - 3, gz, 0, 2.2, 0.12, '#f4f1ea');
    p.post(gx + 3, gz, 0, 2.2, 0.12, '#f4f1ea');
    p.box(gx - 3, gx + 3, 2.1, 2.3, gz - 0.1, gz + 0.1, '#2f8a4e');
  }
  p.build();
  p.show(true);
  register({
    x: x0 - 6,
    y: 1.2,
    z: z0 + 17,
    reach: 4,
    size: 2,
    label: () => (car.licence ? null : car.theory ? 'Book the practical test (S$75)' : 'Take the theory test (S$6.50)'),
    run: () => (car.theory ? practical() : theory()),
  });
}
const cones: [number, number][] = [];
const gates: [number, number][] = [];
{
  const { x, z } = DRIVE_CENTRE;
  for (const [gx, gz] of [
    [x - 15, z - 10],
    [x + 15, z - 10],
    [x + 15, z + 10],
    [x - 15, z + 10],
  ] as const) {
    gates.push([gx, gz]);
    cones.push([gx - 3.5, gz], [gx + 3.5, gz]);
  }
  for (let k = -2; k <= 2; k++) cones.push([x + k * 5, z]);
}

function theory() {
  if (!spend(6.5)) return toast('Not enough money', 'The theory test is S$6.50.');
  const qs = [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 5);
  let right = 0;
  const ask = (i: number) => {
    if (i >= qs.length) {
      closePanel();
      if (right >= 4) {
        car.theory = true;
        addMood(5);
        toast(`Theory test: ${right}/5, passed!`, 'Now the practical, on the circuit.', 'good');
      } else toast(`Theory test: ${right}/5`, 'Four needed to pass. Study a bit and come back.', 'bad');
      return;
    }
    const [q, answers, ok] = qs[i];
    openPanel({
      title: `Theory test · ${i + 1}/5`,
      sub: 'Basic Theory Test',
      body: q,
      rows: answers.map((a, k) => ({ label: a, run: () => ((right += k === ok ? 1 : 0), ask(i + 1)) })),
    });
  };
  ask(0);
}

const test = { gate: 0, hits: 0, t: 0, hit: new Set<number>() };
function practical() {
  if (!spend(75)) return toast('Not enough money', 'The practical test is S$75.');
  // The school's car, at the start of the circuit.
  const { x, z } = DRIVE_CENTRE;
  car.x = x - 20;
  car.z = z - 10;
  car.ry = 0;
  Object.assign(test, { gate: 0, hits: 0, t: 0, hit: new Set() });
  bodyMat.color.set('#f2c14e');
  drive.test = true;
  show();
  getIn(true);
  toast(
    'Practical test',
    'Through the four green gates in order, inside two minutes, cones standing. W to go, A/D to steer, S to brake.',
    'msg',
  );
}
function testStep(dt: number) {
  test.t += dt;
  const [gx, gz] = gates[test.gate];
  if (Math.abs(car.x - gx) < 3 && Math.abs(car.z - gz) < 2.5) {
    test.gate++;
    sfx('good');
    if (test.gate >= gates.length)
      return endTest(true, `All four gates, ${test.hits} cone${test.hits === 1 ? '' : 's'} down.`);
  }
  cones.forEach(([cx, cz], i) => {
    if (!test.hit.has(i) && Math.hypot(car.x - cx, car.z - cz) < 1.3) {
      test.hit.add(i);
      test.hits++;
      toast('Cone!', `${test.hits} down.`, 'bad');
    }
  });
  if (test.hits > 3) endTest(false, 'Too many cones down.');
  else if (test.t > 120) endTest(false, 'Out of time.');
  else markTo(`Gate ${test.gate + 1}`, [gates[test.gate][0], 1.5, gates[test.gate][1]]);
}
function endTest(pass: boolean, why: string) {
  drive.active = false;
  drive.test = false;
  player.ride = null;
  const { x, z, w, d } = DRIVE_CENTRE;
  Object.assign(player, { x: x - w / 2 - 6, z: z - d / 2 + 19, y: 0 });
  if (pass) {
    car.licence = true;
    addMood(12);
    toast('Licence: passed!', `${why} Aldi can drive in Singapore now.`, 'good');
  } else toast('Practical test: failed', `${why} Book again when ready.`, 'bad');
  // Back to Aldi's own car, if any.
  if (model()) Object.assign(car, parked);
  show();
}
const parked = { x: 0, z: 0, ry: 0 };

/* ---------- the dealer ---------- */

function buildDealer() {
  const { x, z } = DEALER;
  const p = new PropSet('dealer');
  p.box(x - 15, x + 15, 0, 0.05, z - 8, z + 8, '#8e969c');
  p.box(x - 15, x - 5, 0, 5, z - 8, z - 2, '#f4f1ea', { col: true });
  sign(
    {
      text: 'Leng Kee Autos',
      sub: 'Used cars · Loans arranged',
      w: 5,
      h: 1,
      bg: '#b8342a',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#f2c14e',
      font: 'ui',
    },
    x - 10,
    4,
    z - 1.9,
    0,
    { both: true },
  );
  MODELS.forEach((m, i) => {
    p.box(x - 2 + i * 5.5 - 0.9, x - 2 + i * 5.5 + 0.9, 0.05, 1.5, z + 1, z + 5.3, m.color);
  });
  p.build();
  p.show(true);
  register({
    x: x - 10,
    y: 1.2,
    z: z - 1.4,
    reach: 4,
    size: 2,
    label: () => (car.model ? 'Leng Kee Autos' : 'Leng Kee Autos: look at the cars'),
    run: dealer,
  });
}
function dealer() {
  if (car.model) return toast('Leng Kee Autos', '"How is the car? Anything, come back, I service for you."');
  const rows: Row[] = MODELS.map(m => ({
    label: `${m.name} (${m.year})`,
    note: sgd(m.price),
    run: () => buy(m),
  }));
  rows.push({ label: 'Just looking', run: () => closePanel() });
  openPanel({
    title: 'Leng Kee Autos',
    sub: 'Used cars, COE included',
    body: car.licence
      ? '"All good condition, one owner. Loan also can, 40% down, five years."'
      : '"You got licence or not? No licence, cannot drive home leh."',
    rows,
  });
}
function buy(m: Model) {
  const down = m.price * DOWN;
  const loan = m.price * (1 - DOWN) * (1 + RATE * YEARS);
  openPanel({
    title: `${m.name} (${m.year})`,
    sub: sgd(m.price),
    body: `Pay in full, or ${sgd(down)} down and ${sgd(loan / (YEARS * 12))} a month for five years. Insurance and road tax come to about S$150 a month.`,
    back: dealer,
    rows: [
      { label: 'Pay in full', note: sgd(m.price), run: () => own(m, m.price, 0) },
      { label: 'Take the loan', note: `${sgd(down)} down`, run: () => own(m, down, loan) },
      { label: 'Back', run: dealer },
    ],
  });
}
function own(m: Model, now: number, loan: number) {
  if (!car.licence)
    return toast('No licence yet', '"Get the licence first, then come back. The car will wait for you."');
  if (!spend(now)) return toast('Not enough money', `That's ${sgd(now)}.`);
  closePanel();
  Object.assign(car, {
    model: m.id,
    loan,
    monthly: loan / (YEARS * 12),
    fuel: 100,
    x: DEALER.x + 18,
    z: DEALER.z + 3,
    ry: 0,
    parkedAt: -1,
  });
  Object.assign(parked, { x: car.x, z: car.z, ry: 0 });
  show();
  addMood(20);
  toast(`The ${m.name} is Aldi's!`, "The keys, a full tank and a ribbon on the bonnet. It's parked out front.", 'good');
}

/* ---------- petrol, ERP ---------- */

function buildPetrol() {
  const p = new PropSet('petrol');
  for (const s of PETROL) {
    p.box(s.x - 6, s.x + 6, 4.5, 5, s.z - 4, s.z + 4, '#d7263d');
    for (const dx of [-5, 5]) p.post(s.x + dx, s.z, 0, 4.5, 0.2, '#e8e4da');
    p.box(s.x - 0.5, s.x + 0.5, 0, 1.6, s.z - 0.3, s.z + 0.3, '#e8e4da', { col: true });
    sign(
      {
        text: 'Shiok Petrol',
        sub: 'Open 24 hours',
        w: 3.2,
        h: 0.8,
        bg: '#d7263d',
        fg: '#ffffff',
        subfg: '#f2c14e',
        border: '#ffffff',
        font: 'ui',
      },
      s.x,
      5.4,
      s.z + 4.05,
      0,
      { both: true },
    );
    register({
      x: s.x,
      y: 1.2,
      z: s.z + 0.6,
      reach: 6,
      size: 3,
      label: () =>
        car.model && !drive.active && car.fuel < 99 && Math.hypot(car.x - s.x, car.z - s.z) < 12
          ? `Fill up (${sgd((100 - car.fuel) * 0.6)})`
          : null,
      run: () => {
        const cost = (100 - car.fuel) * 0.6;
        if (!spend(cost)) return toast('Not enough money', `A full tank is ${sgd(cost)}.`);
        car.fuel = 100;
        toast('Full tank', `${sgd(cost)}. Petrol in Singapore, wah.`, null);
      },
    });
  }
  p.build();
  p.show(true);
}
function buildErp() {
  const p = new PropSet('erp');
  for (const g of ERP) {
    const nx = -g.dz,
      nz = g.dx;
    for (const s of [-1, 1])
      p.post(g.x + nx * s * (g.w / 2 + 0.6), g.z + nz * s * (g.w / 2 + 0.6), 0, 5.8, 0.15, '#8e969c');
    p.put(g.x, 5.8, g.z, g.w + 1.5, 0.5, 0.6, '#1d2b36', Math.atan2(-nz, nx));
    sign(
      {
        text: 'ERP',
        sub: g.name,
        w: 1.6,
        h: 0.5,
        bg: '#1d2b36',
        fg: '#ffffff',
        subfg: '#f2c14e',
        border: '#1d2b36',
        font: 'ui',
      },
      g.x,
      6.4,
      g.z,
      Math.atan2(g.dx, g.dz),
      { both: true },
    );
  }
  p.build();
  p.show(true);
}
function erpRate() {
  const w = weekday(S.day);
  if (w === 0 || w === 6) return 0;
  const t = S.time;
  if ((t >= 7.5 * 60 && t < 9.5 * 60) || (t >= 17.5 * 60 && t < 20 * 60)) return 3;
  if (t >= 9.5 * 60 && t < 17.5 * 60) return 1;
  return 0;
}
function checkErp(ax: number, az: number, bx: number, bz: number) {
  if (drive.test) return;
  for (const g of ERP) {
    const sa = (ax - g.x) * g.dx + (az - g.z) * g.dz,
      sb = (bx - g.x) * g.dx + (bz - g.z) * g.dz;
    const lat = Math.abs((bx - g.x) * -g.dz + (bz - g.z) * g.dx);
    if (sa * sb < 0 && lat < g.w / 2 + 2) {
      const r = erpRate();
      sfx('tap');
      if (r && spend(r)) toast(`ERP: ${sgd(r)}`, g.name, null);
    }
  }
}

/* ---------- every frame, every month ---------- */

let lastMin = -1;
export function updateCar() {
  if (drive.active) S.clockScale = 0.3;
  const m = Math.floor(S.time);
  if (m === lastMin || !car.model) return;
  lastMin = m;
  const { d, m: month } = dateOf(S.day);
  if (d === 1 && S.time >= 9 * 60 && !car.paid.includes(month)) {
    car.paid.push(month);
    const due = (car.loan > 0 ? car.monthly : 0) + 150 + (home.id ? 110 : 0);
    if (car.loan > 0) car.loan = Math.max(0, car.loan - car.monthly);
    if (spend(due))
      toast(
        `Car costs: ${sgd(due)}`,
        `${car.monthly ? `Loan ${sgd(car.monthly)}, ` : ''}insurance and road tax S$150${home.id ? ', season parking S$110' : ''}.`,
        null,
      );
    else toast('Car costs overdue', 'Not enough in the account. The bank will call.', 'bad');
  }
}
/** The phone's My car. */
export function carApp() {
  const m = model();
  if (!m) {
    openPanel({
      title: 'My car',
      sub: car.licence ? 'Licence: yes' : car.theory ? 'Theory test passed' : 'No licence yet',
      body: car.licence
        ? `No car yet. The cheapest at Leng Kee Autos needs ${sgd(MODELS[0].price * DOWN)} down.`
        : 'First the licence: BB Drive Centre, theory then practical.',
      rows: [{ label: 'OK', run: () => closePanel() }],
    });
    return;
  }
  openPanel({
    title: `My car · ${m.name}`,
    sub: `Petrol ${Math.round(car.fuel)}%${car.loan ? ` · loan left ${sgd(car.loan)}` : ''}`,
    body: `${Math.round(Math.hypot(car.x - player.x, car.z - player.z))} m away.`,
    rows: [
      {
        label: 'Show me where it is',
        run: () => {
          closePanel();
          findUntil = performance.now() + 60000;
        },
      },
      ...(car.fuel <= 0
        ? [
            {
              label: 'Call for a can of petrol (S$40)',
              run: () => {
                if (!spend(40)) return toast('Not enough money', 'S$40.');
                car.fuel = 20;
                closePanel();
                toast('Petrol delivered', 'A man on a motorbike, a jerrycan, and a lecture.', null);
              },
            },
          ]
        : []),
      { label: 'OK', run: () => closePanel() },
    ],
  });
}
let findUntil = 0;
export function carMarker() {
  if (performance.now() < findUntil && car.model && !drive.active) markTo('Your car', [car.x, 1.2, car.z]);
}

export const saveCar = () => ({ ...car, paid: [...car.paid] });
export function loadCar(d: Partial<typeof car> | undefined) {
  Object.assign(
    car,
    {
      theory: false,
      licence: false,
      model: null,
      x: 0,
      z: 0,
      ry: 0,
      fuel: 100,
      loan: 0,
      monthly: 0,
      paid: [],
      parkedAt: -1,
      parkedPaid: false,
    },
    d ?? {},
  );
  Object.assign(parked, { x: car.x, z: car.z, ry: car.ry });
  drive.active = false;
  drive.test = false;
  if (mesh) show();
}
export const carDebug = { car, drive, test, gates, cones };
