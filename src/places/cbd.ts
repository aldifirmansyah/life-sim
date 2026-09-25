/* The CBD and Marina Bay (step 4):
   - Chopee's city office in Won Raffles Place, a tower by the MRT: the lobby
     (concierge, the lifts, which need the Chopee pass) and Level 30, with hot
     desks, the Marina room (seller meetings and the monthly all-hands), a pantry,
     and the bay through the glass.
   - Lau Pa Sat, the hawker market (places/hawker.ts), with satay at night.
   - Boat Quay: café tables on the promenade in front of the shophouses.
   - The light show over Marina Bay at 20:00 and 21:00: beams from the top of
     Marina Bay Stands and a glowing water screen, watched from the promenade by
     the Merlion. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { addCol, type Collider } from '../core/collision';
import { addFloor } from '../core/levels';
import { interiors } from '../interiors/interior';
import { register } from '../game/interact';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/hud';
import { S } from '../core/state';
import { player } from '../core/player';
import { blink, passTime } from '../core/time';
import { spend, sgd, addEnergy, addMood } from '../game/stats';
import { job, openLaptop, cityLabel, cityMeeting } from '../game/work';
import { buildHawker } from './hawker';
import { CITY_OFFICE, LAU_PA_SAT, BOAT_QUAY, PROMENADE } from './sites';

const { x0, x1, z0, z1, lobby, floor: F } = CITY_OFFICE;
const LIFT = { x: x0 + 6, z: z0 + 1.6 };

export function buildCbd() {
  buildOffice();
  buildHawker({
    name: 'Lau Pa Sat',
    board: ['Lau Pa Sat', 'Festival market · Satay street'],
    ...LAU_PA_SAT,
    roof: '#8a6a4a',
    stalls: [
      {
        name: 'Satay Street',
        sub: 'Chicken · Mutton · Beef',
        color: '#b8342a',
        dishes: [
          {
            name: 'Satay, ten sticks',
            price: 8,
            energy: 24,
            mood: 8,
            note: 'Smoky, sweet, with peanut sauce and ketupat. Like at home, but different.',
          },
        ],
      },
      {
        name: 'Hokkien Mee',
        sub: 'Wok hei guaranteed',
        color: '#3f7fd0',
        dishes: [{ name: 'Hokkien mee', price: 6, energy: 25, mood: 6, note: 'Prawns, squid, lime and sambal.' }],
      },
      {
        name: 'Char Kway Teow',
        sub: 'Since 1972',
        color: '#2f6b4f',
        dishes: [{ name: 'Char kway teow', price: 5.5, energy: 26, mood: 5, note: 'Dark, sweet and smoky.' }],
      },
      {
        name: 'Ayam Penyet',
        sub: 'Indonesian',
        color: '#e0a02a',
        dishes: [
          {
            name: 'Ayam penyet',
            price: 7,
            energy: 27,
            mood: 9,
            note: 'Smashed fried chicken with sambal terasi. Aldi texts a photo home.',
          },
        ],
      },
      {
        name: 'Bubble Tea',
        sub: 'Brown sugar · Taro',
        color: '#8e44ad',
        dishes: [
          { name: 'Brown sugar bubble tea', price: 4.5, energy: 5, mood: 4, note: 'Sweet, chewy, cold.', drink: true },
          { name: 'Bubble tea to take away', price: 4.5, energy: 0, mood: 0, note: '', gift: 'bbt' },
          { name: 'Pineapple tarts, a tin', price: 12, energy: 0, mood: 0, note: '', gift: 'tarts' },
        ],
      },
      {
        name: 'Drinks',
        sub: 'Sugarcane · Lime · Teh',
        color: '#6b4a2f',
        dishes: [
          { name: 'Lime juice', price: 2.5, energy: 5, mood: 3, note: 'Sour and cold.', drink: true },
          { name: 'Teh tarik', price: 1.8, energy: 8, mood: 3, note: 'Pulled tea, frothy on top.', drink: true },
        ],
      },
    ],
  });
  buildQuay();
  buildShow();
}

/* ---------- the city office ---------- */

function buildOffice() {
  const p = new PropSet('chopee-city');
  const glass = '#9fc3d1',
    frame = '#3a4046',
    orange = '#ee4d2d';
  const col = (ax: number, bx: number, az: number, bz: number, y0: number, y1: number): Collider => {
    const c = addCol(ax, bx, az, bz, undefined, y0, y1);
    c.on = false;
    p.cols.push(c);
    return c;
  };
  const W = 0.3;
  const door = (x0 + x1) / 2;
  // The lobby: stone floor, glass on three sides, the doorway on the south (towards the station).
  p.box(x0, x1, 0, 0.1, z0, z1, '#d8d4cc');
  p.box(x0 - W, x1 + W, lobby, lobby + 0.35, z0 - W, z1 + W, '#b9b4aa');
  p.box(x0 - W, x1 + W, 0, lobby, z0 - W, z0, '#e4e0d8', { col: true });
  p.box(x0 - W, x0, 0, lobby, z0, z1, glass, { col: true, b: p.glass });
  p.box(x1, x1 + W, 0, lobby, z0, z1, glass, { col: true, b: p.glass });
  p.box(x0, door - 2, 0, lobby, z1, z1 + W, glass, { col: true, b: p.glass });
  p.box(door + 2, x1, 0, lobby, z1, z1 + W, glass, { col: true, b: p.glass });
  p.box(door - 2, door + 2, 3, lobby, z1, z1 + W, glass, { b: p.glass });
  for (let x = x0; x <= x1 + 0.01; x += 4) p.box(x - 0.08, x + 0.08, 0, lobby, z1, z1 + W + 0.05, frame);
  // The concierge desk and the building's name.
  p.box(x1 - 10, x1 - 4, 0, 1.1, z0 + 9, z0 + 10, '#2b3035');
  col(x1 - 10, x1 - 4, z0 + 9, z0 + 10, -1, 1.2);
  sign(
    {
      text: 'Won Raffles Place',
      sub: 'Chopee · Levels 28–31',
      w: 6,
      h: 1.1,
      bg: '#1d2b36',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#f2c14e',
      font: 'ui',
    },
    door,
    4.6,
    z1 + W + 0.1,
    0,
    { both: true },
  );
  // Lifts on the back wall, down here and up on 30.
  for (const y of [0, F]) {
    for (const dx of [-1.6, 1.6]) {
      p.box(LIFT.x + dx - 0.8, LIFT.x + dx + 0.8, y, y + 2.3, z0, z0 + 0.12, '#b9c0c6');
      p.box(LIFT.x + dx - 0.02, LIFT.x + dx + 0.02, y, y + 2.3, z0 + 0.1, z0 + 0.14, '#6d757c');
    }
    register({
      x: LIFT.x,
      y: y + 1.2,
      z: z0 + 0.3,
      reach: 3,
      size: 1.4,
      label: () =>
        y === 0 ? (job.pass ? 'Lift to Level 30 (Chopee)' : 'Lifts (Chopee staff only)') : 'Lift to the lobby',
      run: () => {
        if (y === 0 && !job.pass) return toast('Staff only', 'The lifts need a Chopee pass.');
        blink(y === 0 ? 'Level 30' : 'Lobby', () => {
          player.x = LIFT.x;
          player.z = z0 + 2.2;
          player.y = y === 0 ? F : 0;
          player.yaw = Math.PI;
        });
      },
    });
  }
  // Level 30: the floor, glass all round, the ceiling.
  p.box(x0, x1, F - 0.3, F, z0, z1, '#8e9aa3');
  addFloor((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0, F);
  p.box(x0, x1, F + 4, F + 4.2, z0, z1, '#e8e4dc');
  for (const [ax, bx, az, bz] of [
    [x0 - W, x1 + W, z0 - W, z0],
    [x0 - W, x1 + W, z1, z1 + W],
    [x0 - W, x0, z0, z1],
    [x1, x1 + W, z0, z1],
  ]) {
    p.box(ax, bx, F, F + 4, az, bz, glass, { b: p.glass });
    col(ax, bx, az, bz, F - 1, F + 4);
  }
  for (let x = x0 + 5; x < x1 - 2; x += 8) p.box(x - 1.5, x + 1.5, F + 3.9, F + 3.95, z0 + 3, z1 - 3, '#fbf8ee');
  // Hot desks: two long benches.
  for (const dz of [z0 + 14, z0 + 20]) {
    p.box(x0 + 12, x1 - 3, F + 0.72, F + 0.76, dz - 0.8, dz + 0.8, '#f4f1ea');
    col(x0 + 12, x1 - 3, dz - 0.8, dz + 0.8, F - 1, F + 0.8);
    for (let x = x0 + 13.5; x < x1 - 3; x += 2.5)
      for (const s of [-1, 1]) {
        p.box(x - 0.3, x + 0.3, F + 0.76, F + 1.12, dz + s * 0.25 - 0.03, dz + s * 0.25 + 0.03, '#1d2b36');
        p.box(x - 0.25, x + 0.25, F, F + 0.48, dz + s * 1.2 - 0.25, dz + s * 1.2 + 0.25, '#2f3a44');
      }
    register({
      x: x0 + 20,
      y: F + 0.9,
      z: dz,
      reach: 3,
      size: 3,
      label: () => (job.pass ? 'Work at a hot desk' : null),
      run: () => openLaptop(true),
    });
  }
  // The Marina room: a long table for meetings and the all-hands screen (south-west, facing the bay).
  const MR = { x0, x1: x0 + 11, z0: z1 - 12, z1 };
  p.box(MR.x1 - 0.06, MR.x1 + 0.06, F, F + 4, MR.z0 + 1.2, MR.z1, glass, { b: p.glass });
  col(MR.x1 - 0.1, MR.x1 + 0.1, MR.z0 + 1.2, MR.z1, F - 1, F + 4);
  p.box(MR.x0, MR.x1, F, F + 4, MR.z0 - 0.06, MR.z0 + 0.06, glass, { b: p.glass });
  col(MR.x0, MR.x1 - 1.4, MR.z0 - 0.1, MR.z0 + 0.1, F - 1, F + 4);
  const tx = (MR.x0 + MR.x1) / 2,
    tz = (MR.z0 + MR.z1) / 2;
  p.box(tx - 3, tx + 3, F + 0.72, F + 0.78, tz - 1.1, tz + 1.1, '#6b5139');
  col(tx - 3, tx + 3, tz - 1.1, tz + 1.1, F - 1, F + 0.8);
  p.box(MR.x0 + 0.1, MR.x0 + 0.2, F + 1, F + 2.4, tz - 1.6, tz + 1.6, '#1d2b36');
  sign(
    { text: 'Marina', w: 1.6, h: 0.4, bg: orange, fg: '#ffffff', border: orange, font: 'ui' },
    MR.x1 + 0.1,
    F + 2.4,
    MR.z0 + 3,
    Math.PI / 2,
  );
  register({ x: tx, y: F + 0.9, z: tz, reach: 5, size: 2, label: cityLabel, run: cityMeeting });
  // A pantry by the lifts.
  p.box(x1 - 6, x1 - 0.5, F, F + 0.95, z0 + 0.3, z0 + 1, '#e4e0d8');
  col(x1 - 6, x1 - 0.5, z0, z0 + 1, F - 1, F + 1);
  p.box(x1 - 4, x1 - 3.4, F + 0.95, F + 1.5, z0 + 0.35, z0 + 0.9, '#2b3035');
  register({
    x: x1 - 3.7,
    y: F + 1.2,
    z: z0 + 0.8,
    reach: 2.4,
    size: 0.8,
    label: () => (job.pass ? 'Make a kopi (free)' : null),
    run: () => {
      addEnergy(8);
      addMood(2);
      toast('Kopi on Level 30', 'The view is the real perk. The whole bay, down there.', null);
    },
  });
  sign(
    {
      text: 'Chopee',
      sub: 'City office · Level 30',
      w: 3,
      h: 0.8,
      bg: orange,
      fg: '#ffffff',
      subfg: '#ffe7c2',
      border: '#ffffff',
      font: 'ui',
    },
    LIFT.x + 5,
    F + 2.3,
    z0 + 0.25,
    0,
  );
  p.build();
  interiors.push({
    name: 'Won Raffles Place',
    rooms: [
      { name: 'Chopee · Marina room', ...MR, y0: F - 1 },
      { name: 'Chopee · Level 30', x0, x1, z0, z1, y0: F - 1 },
      { name: 'Lobby', x0, x1, z0, z1, y1: F - 1 },
    ],
    props: p,
    door: { update() {} },
    lamp: [(x0 + x1) / 2, lobby - 0.5, (z0 + z1) / 2],
    lampOn: () => true,
    amount: 0.7,
    showWithin: 600,
  });
}

/* ---------- Boat Quay ---------- */

function buildQuay() {
  const p = new PropSet('boat-quay');
  const { x0: qx0, x1: qx1, z0: qz0 } = BOAT_QUAY;
  // The promenade along the river, and café tables under umbrellas in front of three units.
  p.box(qx0, qx1, 0, 0.08, qz0 - 8, qz0, '#c9bba2');
  const cafes = [qx0 + 21, qx0 + 45, qx0 + 75];
  const names = ['Quayside Kopi', 'The Tongkang', 'Riverboat Café'];
  cafes.forEach((cx, i) => {
    for (const dx of [-3, 0, 3]) {
      const tz = qz0 - 3.5;
      p.post(cx + dx, tz, 0, 0.72, 0.06, '#3a4046');
      p.put(cx + dx, 0.74, tz, 1, 0.04, 1, '#f4f1ea', 0, p.cyl);
      p.post(cx + dx, tz, 0.74, 2.4, 0.03, '#3a4046');
      p.put(cx + dx, 2.5, tz, 2.4, 0.5, 2.4, ['#b8342a', '#2f6b4f', '#3f7fd0'][i], 0, p.cone);
    }
    sign(
      {
        text: names[i],
        sub: 'Boat Quay',
        w: 3.4,
        h: 0.6,
        bg: '#1d2b36',
        fg: '#ffffff',
        subfg: '#f2c14e',
        border: '#f2c14e',
        font: 'ui',
      },
      cx,
      3.6,
      qz0 - 0.05,
      Math.PI,
    );
    register({
      x: cx,
      y: 0.9,
      z: qz0 - 3.5,
      reach: 3.5,
      size: 2,
      label: () => `${names[i]}: sit by the river`,
      run: () => cafe(names[i]),
    });
  });
  p.build();
  p.show(true);
}

function cafe(name: string) {
  const night = S.time >= 19 * 60;
  openPanel({
    title: name,
    sub: 'Boat Quay · by the Singapore River',
    body: night
      ? 'The towers are lit, the bumboats go past. A good place to end the day.'
      : 'Office people on a long lunch, tourists with maps.',
    rows: [
      { label: 'Iced lemon tea', note: sgd(6), run: () => sit(6, 'Iced lemon tea by the river.', night ? 9 : 5) },
      {
        label: 'Mocktail and fries',
        note: sgd(16),
        run: () => sit(16, 'A mocktail and a basket of fries.', night ? 12 : 7, 12),
      },
      { label: 'Maybe later', run: () => closePanel() },
    ],
  });
}
function sit(price: number, what: string, mood: number, energy = 3) {
  if (!spend(price)) return toast('Not enough money', `That's ${sgd(price)}.`);
  closePanel();
  passTime(40, 'By the river…', () => {
    addMood(mood);
    addEnergy(energy);
    toast(what, 'Aldi watches the river for a while. Not bad, this life.', null);
  });
}

/* ---------- the light show ---------- */

const SHOWS = [20 * 60, 21 * 60];
const SHOW_LEN = 12;
const beams: THREE.Mesh[] = [];
let screen: THREE.Mesh;
let watchedDay = 0;
export const showOn = () => SHOWS.some(t => S.time >= t && S.time < t + SHOW_LEN);

function buildShow() {
  const g = new THREE.CylinderGeometry(1.1, 1.1, 1, 6, 1, true);
  g.translate(0, 0.5, 0);
  const colors = [0x4fd1ff, 0xff4fd8, 0x7dff6a, 0xffd24f, 0x9f7bff, 0xff7a4f];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    m.position.set(562, 176, 520 + (i - 5.5) * 12);
    m.scale.set(1, 420, 1);
    m.visible = false;
    scene.add(m);
    beams.push(m);
  }
  screen = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 22),
    new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  screen.position.set(478, 11, 520);
  screen.rotation.y = Math.PI / 2;
  screen.visible = false;
  scene.add(screen);
  register({
    x: PROMENADE.x,
    y: 1.2,
    z: PROMENADE.z,
    reach: 8,
    size: 6,
    label: () => (showOn() && watchedDay !== S.day ? 'Watch the light show over the bay' : null),
    run: () => {
      watchedDay = S.day;
      passTime(12, 'Lights over the bay…', () => {
        addMood(10);
        toast('The light show', 'Lasers, water and music over Marina Bay. Free, and very shiok.', 'good');
      });
    },
  });
}

/** Every frame: the beams sweep while the show is on. */
export function updateCbd() {
  const on = showOn();
  const t = performance.now() / 1000;
  for (let i = 0; i < beams.length; i++) {
    const b = beams[i];
    b.visible = on;
    if (!on) continue;
    // Half sweep west over the bay towards the promenade, half fan up into the sky.
    b.rotation.set(0, 0, 0);
    if (i % 2 === 0) {
      b.rotation.z = Math.PI / 2 + 0.42 + Math.sin(t * 0.7 + i) * 0.14;
      b.rotation.y = Math.sin(t * 0.45 + i * 0.6) * 0.5;
    } else {
      b.rotation.z = Math.sin(t * 0.6 + i) * 0.7;
      b.rotation.x = Math.cos(t * 0.5 + i * 0.8) * 0.4;
    }
    (b.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.25 * Math.sin(t * 2 + i);
  }
  screen.visible = on;
  if (on) (screen.material as THREE.MeshBasicMaterial).color.setHSL((t * 0.08) % 1, 0.8, 0.6);
}
