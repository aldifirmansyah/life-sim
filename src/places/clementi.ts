/* 448 Clementi Market & Food Centre, south of Clementi MRT: an open-sided hall
   under a big roof, six stalls along the back, round tables with stools, and the
   tray return. Eating here follows the local way:
   1. chope a table (leave a tissue packet on it),
   2. queue and buy at a stall (the food comes on a tray),
   3. eat at your table,
   4. return the tray (it's the law; leaving it gets a scolding).
   Walking off with the food makes it a takeaway (tapau). Drinks are just drunk. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { interiors } from '../interiors/interior';
import { register } from '../game/interact';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/hud';
import { player } from '../core/player';
import { passTime } from '../core/time';
import { spend, sgd, addEnergy, addMood } from '../game/stats';
import { CLEMENTI_HAWKER } from './sites';

const { x: cx, z: cz, w, d } = CLEMENTI_HAWKER;
const x0 = cx - w / 2,
  x1 = cx + w / 2,
  z0 = cz - d / 2,
  z1 = cz + d / 2;
const ROOF = 5;

interface Dish {
  name: string;
  price: number;
  energy: number;
  mood: number;
  note: string;
  drink?: boolean;
}
const STALLS: { name: string; sub: string; color: string; dishes: Dish[] }[] = [
  {
    name: 'Ah Seng Chicken Rice',
    sub: 'Since 1983',
    color: '#d9582b',
    dishes: [
      { name: 'Chicken rice', price: 4.5, energy: 25, mood: 5, note: 'Fragrant rice, chilli with ginger. Shiok.' },
    ],
  },
  {
    name: 'Nasi Padang Minang',
    sub: 'Masakan Padang',
    color: '#2f8a4e',
    dishes: [
      {
        name: 'Nasi padang with rendang',
        price: 6,
        energy: 28,
        mood: 10,
        note: 'Rendang like at home in Indonesia. Aldi goes quiet for a moment.',
      },
    ],
  },
  {
    name: 'Clementi Laksa',
    sub: 'Lemak and spicy',
    color: '#e0a02a',
    dishes: [{ name: 'Laksa', price: 5, energy: 25, mood: 6, note: 'Rich coconut broth, cockles, a big spoon.' }],
  },
  {
    name: 'Mee Pok Fishball',
    sub: 'Dry or soup',
    color: '#3f7fd0',
    dishes: [
      { name: 'Mee pok, dry', price: 4, energy: 22, mood: 4, note: 'Springy noodles, vinegar, chilli, fishballs.' },
    ],
  },
  {
    name: 'Prata House',
    sub: 'Kosong · Egg · Plaster',
    color: '#8a4a2f',
    dishes: [
      { name: 'Roti prata, two pieces', price: 3, energy: 18, mood: 4, note: 'Crispy, with fish curry to dip.' },
    ],
  },
  {
    name: 'Kopi & Drinks',
    sub: 'Kopi · Teh · Sugarcane',
    color: '#6b4a2f',
    dishes: [
      { name: 'Kopi', price: 1.4, energy: 10, mood: 2, note: 'Thick and sweet with condensed milk.', drink: true },
      { name: 'Teh tarik', price: 1.6, energy: 8, mood: 3, note: 'Pulled tea, frothy on top.', drink: true },
      {
        name: 'Sugarcane juice',
        price: 2,
        energy: 6,
        mood: 3,
        note: 'Cold and fresh. Good in this heat.',
        drink: true,
      },
    ],
  },
];

/** The meal in progress: which table is choped, the food on its tray, eaten and not yet returned. */
const meal = { chope: -1, food: null as Dish | null, tray: false, told: false };
const TABLES: [number, number][] = [];
for (const tz of [cz - 2, cz + 4]) for (let k = 0; k < 4; k++) TABLES.push([x0 + 4.5 + k * 6, tz]);
const TRAY = { x: x1 - 1.2, z: z1 - 3 };
const tissue = new THREE.Mesh(
  new THREE.BoxGeometry(0.14, 0.05, 0.08),
  new THREE.MeshLambertMaterial({ color: 0xf4f6f8 }),
);

export function buildClementi() {
  const p = new PropSet('clementi-hawker');
  // Floor, columns and the hipped roof.
  p.box(x0, x1, 0, 0.12, z0, z1, '#cfc8b8');
  for (let x = x0; x <= x1 + 0.01; x += 6)
    for (const z of [z0, z1]) {
      p.box(x - 0.25, x + 0.25, 0, ROOF, z - 0.25, z + 0.25, '#e8e0cc', { col: true });
    }
  p.box(x0 - 1, x1 + 1, ROOF, ROOF + 0.4, z0 - 1, z1 + 1, '#b5553a');
  p.put(cx, ROOF + 1.6, cz, w + 2, 2.4, d + 2, '#9c4a34', 0, p.roof);
  for (let x = x0 + 4; x < x1; x += 7) p.box(x - 0.2, x + 0.2, ROOF - 0.5, ROOF - 0.1, z0 + 3, z1 - 3, '#6d757c'); // fans
  // Stalls along the north side, each a counter under its signboard.
  const sw = w / STALLS.length;
  STALLS.forEach((st, i) => {
    const sx = x0 + sw * (i + 0.5);
    p.box(sx - sw / 2 + 0.1, sx + sw / 2 - 0.1, 0, 3, z0, z0 + 0.2, '#e4e0d8', { col: true });
    p.box(sx - sw / 2 + 0.1, sx - sw / 2 + 0.2, 0, 3, z0, z0 + 3, '#e4e0d8', { col: true });
    p.box(sx - sw / 2 + 0.3, sx + sw / 2 - 0.3, 0, 1, z0 + 2.4, z0 + 3, '#d8d2c4', { col: true });
    p.box(sx - sw / 2 + 0.3, sx + sw / 2 - 0.3, 1, 1.05, z0 + 2.3, z0 + 3.1, '#a9a49a');
    p.box(sx - 1.2, sx - 0.2, 1.05, 1.5, z0 + 0.6, z0 + 1.4, '#9aa3a9'); // pots
    p.box(sx - sw / 2 + 0.1, sx + sw / 2 - 0.1, 3, 3.6, z0 + 2.9, z0 + 3.1, st.color);
    sign(
      { text: st.name, sub: st.sub, w: sw - 0.6, h: 0.55, bg: st.color, fg: '#ffffff', border: '#ffffff', font: 'ui' },
      sx,
      3.3,
      z0 + 3.15,
      0,
    );
    register({
      x: sx,
      y: 1.2,
      z: z0 + 3,
      reach: 2.6,
      size: 1,
      label: () => (meal.food ? null : meal.tray ? 'Return your tray first' : `${st.name}`),
      run: () => (meal.tray ? trayNag() : stall(st)),
    });
  });
  // Round tables with four stools each.
  TABLES.forEach(([tx, tz], i) => {
    p.post(tx, tz, 0, 0.72, 0.08, '#8e969c');
    p.put(tx, 0.74, tz, 1.5, 0.05, 1.5, '#f4f1ea', 0, p.cyl);
    for (const [dx, dz] of [
      [1.05, 0],
      [-1.05, 0],
      [0, 1.05],
      [0, -1.05],
    ])
      p.put(tx + dx, 0.22, tz + dz, 0.36, 0.44, 0.36, '#e07a1f', 0, p.cyl);
    register({
      x: tx,
      y: 0.9,
      z: tz,
      reach: 2.4,
      size: 0.8,
      label: () => tableLabel(i),
      run: () => table(i),
    });
  });
  // The tissue packet that chopes a table.
  tissue.visible = false;
  scene.add(tissue);
  // The tray return station.
  p.box(TRAY.x - 1, TRAY.x + 1, 0, 1.1, TRAY.z - 1.5, TRAY.z + 1.5, '#3f7d3a', { col: true });
  p.box(TRAY.x - 0.9, TRAY.x + 0.9, 1.1, 1.8, TRAY.z - 1.4, TRAY.z - 1.3, '#3f7d3a');
  sign(
    {
      text: 'Tray Return',
      sub: 'Please return your tray',
      w: 1.8,
      h: 0.5,
      bg: '#3f7d3a',
      fg: '#ffffff',
      border: '#ffffff',
      font: 'ui',
    },
    TRAY.x - 1.05,
    1.6,
    TRAY.z,
    -Math.PI / 2,
  );
  register({
    x: TRAY.x,
    y: 1.1,
    z: TRAY.z,
    reach: 2.6,
    size: 1,
    label: () => (meal.tray ? 'Return the tray' : null),
    run: () => {
      meal.tray = false;
      addMood(2);
      toast('Tray returned', 'The cleaning auntie gives Aldi a nod. Good.', 'good');
    },
  });
  // The name, on both long sides.
  for (const [z, ry] of [
    [z1 + 1.05, 0],
    [z0 - 1.05, Math.PI],
  ] as const)
    sign(
      {
        text: '448 Clementi',
        sub: 'Market & Food Centre',
        w: 6,
        h: 1.2,
        bg: '#b5553a',
        fg: '#ffffff',
        subfg: '#f2e2b8',
        border: '#f2e2b8',
        font: 'ui',
      },
      cx,
      ROOF + 0.2,
      z,
      ry,
    );
  p.build();
  interiors.push({
    name: '448 Clementi Food Centre',
    rooms: [{ name: 'Tables', x0, x1, z0, z1 }],
    props: p,
    door: { update: updateMeal },
    lamp: [cx, ROOF - 0.3, cz],
    lampOn: () => true,
    amount: 0.3,
    showWithin: 260,
  });
}

function stall(st: (typeof STALLS)[number]) {
  openPanel({
    title: st.name,
    sub: '448 Clementi Market & Food Centre',
    body:
      meal.chope < 0 && !st.dishes[0].drink
        ? 'Tip: chope a table first. A tissue packet on it means taken.'
        : undefined,
    rows: [
      ...st.dishes.map(dish => ({
        label: dish.name,
        note: sgd(dish.price),
        run: () => buy(dish),
      })),
      { label: 'Maybe later', run: () => closePanel() },
    ],
  });
}
function buy(dish: Dish) {
  if (!spend(dish.price)) return toast('Not enough money', `${dish.name} is ${sgd(dish.price)}.`);
  closePanel();
  if (dish.drink) {
    addEnergy(dish.energy);
    addMood(dish.mood);
    toast(dish.name, dish.note, null);
    return;
  }
  meal.food = dish;
  toast(`${dish.name}, on a tray`, meal.chope >= 0 ? 'Take it to your table.' : 'Find a table to eat at.', null);
}

function tableLabel(i: number) {
  if (meal.food) return meal.chope < 0 || meal.chope === i ? `Eat your ${meal.food.name.toLowerCase()}` : null;
  if (meal.tray) return null;
  if (meal.chope === i) return 'Your table (choped)';
  return meal.chope < 0 ? 'Chope this table (leave a tissue packet)' : null;
}
function table(i: number) {
  if (meal.food) {
    const dish = meal.food;
    meal.food = null;
    meal.chope = -1;
    tissue.visible = false;
    passTime(20, 'Makan…', () => {
      addEnergy(dish.energy);
      addMood(dish.mood);
      meal.tray = true;
      toast(dish.name, `${dish.note} Now return the tray.`, null);
    });
    return;
  }
  if (meal.chope < 0) {
    meal.chope = i;
    tissue.position.set(TABLES[i][0] + 0.3, 0.79, TABLES[i][1] - 0.2);
    tissue.visible = true;
    toast('Choped!', 'A tissue packet on the table: everyone knows it is taken. Now go and buy.', null);
  }
}
function trayNag() {
  toast('Return your tray first', 'The tray return is at the east end.');
}

/** Leaving the food centre: food becomes a takeaway, a tray left behind gets a scolding. */
function updateMeal() {
  const out = player.x < x0 - 6 || player.x > x1 + 6 || player.z < z0 - 6 || player.z > z1 + 6;
  if (!out) return;
  if (meal.food) {
    const dish = meal.food;
    meal.food = null;
    addEnergy(dish.energy * 0.8);
    addMood(dish.mood * 0.6);
    toast('Tapau', `${dish.name}, eaten on the go. Aldi left the tray at the stall.`, null);
  }
  if (meal.tray) {
    meal.tray = false;
    addMood(-3);
    toast(
      'Aiyo, never return tray!',
      'An auntie calls after Aldi. In Singapore, you return your tray: it is the law.',
      'bad',
    );
  }
  meal.chope = -1;
  tissue.visible = false;
}
