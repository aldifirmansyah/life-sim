/* Changi Airport, walk-in: Terminal 3's arrival hall (immigration, the baggage
   belts, seats, the Welcome sign, 8-Twelve where Aldi buys a SIM card and an
   EZ-Lah card) and Jool, the glass dome with the Rain Vortex falling through its
   oculus into a pool, among terraced gardens. Both are fixed prop sets (always
   the same, drawn near), registered as interiors for the indoor light and room
   names. The MRT station stands on the forecourt south of the hall. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { addRotCol } from '../core/collision';
import { interiors } from '../interiors/interior';
import { register } from '../game/interact';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/hud';
import { wallet, spend, sgd } from '../game/stats';
import { markDone } from '../game/arrival';
import { envHooks } from '../render/lighting';
import { EWL } from '../city/mrtdata';

const st = EWL.stations[0];
/** Terminal 3's hall: x0..x1, z0..z1 (the south wall faces the MRT station). */
export const T3 = { x0: st.x - 65, x1: st.x + 25, z0: st.z - 128, z1: st.z - 92, h: 16 };
/** Jool's centre and radius. */
export const JOOL = { x: st.x - 110, z: st.z + 100, r: 36 };
/** Where a new game starts: just past immigration, facing the hall. */
export const ARRIVAL = { x: st.x - 20, z: T3.z0 + 13, yaw: Math.PI };
/** The 8-Twelve counter, and the pool's edge at Jool (marker targets). */
export const SHOP = { x: T3.x1 - 8, z: T3.z1 - 7 };
export const VORTEX = { x: JOOL.x + 9, z: JOOL.z };

function buildT3() {
  const p = new PropSet('changi-t3');
  const { x0, x1, z0, z1, h } = T3;
  const W = 0.4;
  // Floor, roof and the lit ceiling.
  p.box(x0, x1, 0, 0.1, z0, z1, '#e8e6e0');
  p.box(x0 - 1, x1 + 1, h, h + 0.8, z0 - 1, z1 + 1, '#c9ced2');
  for (let x = x0 + 8; x < x1; x += 12) p.box(x - 3, x + 3, h - 0.3, h - 0.1, z0 + 4, z1 - 4, '#fbf8ee');
  // North (airside), east and west walls.
  p.box(x0 - W, x1 + W, 0, h, z0 - W, z0, '#dfe3e6', { col: true });
  p.box(x0 - W, x0, 0, h, z0, z1, '#dfe3e6', { col: true });
  p.box(x1, x1 + W, 0, h, z0, z1, '#dfe3e6', { col: true });
  // The south front: glass between pillars, three wide doorways to the forecourt.
  const doors = [x0 + 20, x0 + 45, x0 + 70];
  let a = x0;
  for (const d of [...doors, x1 + 3]) {
    const b = d - 3;
    if (b > a) {
      p.box(a, b, 0, h, z1, z1 + W, '#a9cbd8', { col: true, b: p.cloth });
      p.box(a, b, 3.4, h, z1 - 0.05, z1 + W + 0.05, '#9fc3d1');
    }
    a = d + 3;
  }
  for (const d of doors) p.box(d - 3, d + 3, 3.4, h, z1, z1 + W, '#9fc3d1');
  for (let x = x0; x <= x1; x += 10) p.post(x, z1 + 0.2, 0, h, 0.35, '#8a969c');
  // Immigration: a row of booths across the hall; passengers come through the gaps.
  for (let x = x0 + 6; x < x1 - 4; x += 8) {
    p.box(x - 1.5, x + 1.5, 0, 2.4, z0 + 7, z0 + 9, '#5b6368', { col: true });
    p.box(x - 1.5, x + 1.5, 2.4, 2.6, z0 + 7, z0 + 9, '#e8e6e0');
  }
  // Baggage belts.
  for (const bx of [x0 + 18, x0 + 42]) {
    p.box(bx - 8, bx + 8, 0, 0.7, z0 + 12, z0 + 15, '#3f454a', { col: true });
    p.box(bx - 7.5, bx + 7.5, 0.7, 0.75, z0 + 12.4, z0 + 14.6, '#6b7378');
  }
  // Seats, plants, and the 8-Twelve kiosk in the south-east corner.
  for (let x = x0 + 10; x < x1 - 20; x += 14)
    for (const dz of [0, 1.4]) p.box(x - 4, x + 4, 0.1, 0.5, z1 - 10 + dz, z1 - 9.4 + dz, '#4f8fc0');
  for (const [x, z] of [
    [x0 + 3, z1 - 3],
    [x0 + 58, z1 - 12],
    [x1 - 3, z0 + 20],
  ]) {
    p.post(x, z, 0, 0.8, 0.5, '#8a6a4a');
    p.put(x, 1.6, z, 1.4, 1.6, 1.4, '#3f7d3a', 0.5, p.cone);
  }
  const { x: sx, z: sz } = SHOP;
  p.box(sx - 5, sx + 5, 0, 3.2, sz - 5, sz - 4.6, '#ffffff'); // back wall with shelves
  for (let k = 0; k < 3; k++) p.box(sx - 4.5, sx + 4.5, 0.6 + k * 0.8, 0.7 + k * 0.8, sz - 4.6, sz - 4, '#e07a1f');
  p.box(sx - 3, sx + 3, 0, 1.1, sz - 1, sz, '#2f8a4e', { col: true }); // the counter
  p.box(sx - 5, sx + 5, 3.2, 3.9, sz - 5, sz + 0.5, '#2f8a4e');
  sign(
    {
      text: '8-Twelve',
      sub: 'SIM cards · EZ-Lah cards · Drinks',
      w: 5,
      h: 1.1,
      bg: '#2f8a4e',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#e07a1f',
      font: 'ui',
    },
    sx,
    3.55,
    sz + 0.55,
    0,
  );
  // The welcome sign over the hall, and one for the way out.
  sign(
    {
      text: 'Welcome to Singapore',
      sub: 'Selamat datang · 欢迎 · வரவேற்கிறோம்',
      w: 14,
      h: 2.2,
      bg: '#1d2b36',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#f2c14e',
    },
    (x0 + x1) / 2,
    9,
    z0 + 10.2,
    Math.PI,
  );
  sign(
    {
      text: 'Arrival Hall',
      sub: 'Changi Airport · Terminal 3',
      w: 8,
      h: 1.4,
      bg: '#f2c14e',
      fg: '#1d2b36',
      border: '#1d2b36',
      font: 'ui',
    },
    (x0 + x1) / 2,
    6,
    z1 - 0.6,
    Math.PI,
    { both: true },
  );
  sign(
    {
      text: 'Train to City ➜',
      sub: 'MRT · East-West Line',
      w: 6,
      h: 1.1,
      bg: '#009645',
      fg: '#ffffff',
      border: '#ffffff',
      font: 'ui',
    },
    doors[1],
    4.2,
    z1 - 0.5,
    Math.PI,
    { both: true },
  );
  p.build();
  interiors.push({
    name: 'Changi Airport T3',
    rooms: [{ name: 'Arrival Hall', x0, x1, z0, z1 }],
    props: p,
    door: { update() {} },
    lamp: [(x0 + x1) / 2, h - 1, (z0 + z1) / 2],
    lampOn: () => true,
    amount: 0.5,
    showWithin: 150,
  });
  // The counter: buy what a new arrival needs.
  register({
    x: sx,
    y: 1.2,
    z: sz - 0.5,
    reach: 3,
    size: 2,
    label: () => '8-Twelve: buy a SIM card and an EZ-Lah card',
    run: shopMenu,
  });
}

function shopMenu() {
  const row = (label: string, price: number, has: boolean, get: () => void, note: string) => ({
    label,
    note: has ? 'bought' : `${sgd(price)} · ${note}`,
    disabled: has ? 'You have one already' : undefined,
    run: () => {
      if (!spend(price)) return toast('Not enough money', `That's ${sgd(price)}.`);
      get();
      checkCards();
      shopMenu();
    },
  });
  openPanel({
    title: '8-Twelve',
    sub: 'Changi Airport · Terminal 3',
    body: '"Welcome to Singapore! First time here? SIM card and EZ-Lah card, right? Can, can."',
    keepPage: true,
    rows: [
      row('SingaTel prepaid SIM (100 GB, 30 days)', 15, wallet.sim, () => (wallet.sim = true), 'your phone works'),
      row('EZ-Lah card', 12, wallet.card, () => (wallet.card = true), 'tap it at the MRT gates'),
      { label: 'Done, thanks!', run: () => closePanel() },
    ],
  });
}
function checkCards() {
  if (wallet.sim && wallet.card) markDone('cards');
}

/* ---------- Jool ---------- */

const waterTex = (() => {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8eef6';
  g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`;
    g.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 2, 10 + Math.random() * 40);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 3);
  return t;
})();
const waterMat = new THREE.MeshBasicMaterial({ map: waterTex, transparent: true, opacity: 0.75, depthWrite: false });
const _hue = new THREE.Color();

function buildJool() {
  const p = new PropSet('jool');
  const { x, z, r } = JOOL;
  // Terraced gardens round the valley, and paths through them.
  for (let ring = 0; ring < 3; ring++) {
    const rr = r - 4 - ring * 5,
      hh = 1.2 + ring * 1.4;
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      // Leave the entrances (east, toward the station, and north) open.
      if (Math.abs(Math.sin(a)) < 0.18 && Math.cos(a) > 0) continue;
      if (Math.abs(Math.cos(a)) < 0.18 && Math.sin(a) < 0) continue;
      const px = x + Math.cos(a) * rr,
        pz = z + Math.sin(a) * rr;
      p.put(px, hh / 2, pz, 5.6, hh, 3.6, '#6f8f4e', -a);
      if (k % 2 === 0) p.put(px, hh + 1.4, pz, 2.2, 2.6, 2.2, ring % 2 ? '#2f6b34' : '#4f8f45', a, p.cone);
    }
  }
  // The pool under the oculus.
  p.post(x, z, 0, 0.6, 7.5, '#8a969c', true);
  p.post(x, z, 0.6, 0.65, 7, '#5fa8c8');
  // The glass wall's frame at the ground, with colliders all round except the two entrances.
  for (let k = 0; k < 28; k++) {
    const a = ((k + 0.5) / 28) * Math.PI * 2;
    const cx = x + Math.cos(a) * (r - 0.6),
      cz = z + Math.sin(a) * (r - 0.6);
    const east = Math.abs(Math.sin(a)) < 0.12 && Math.cos(a) > 0;
    const north = Math.abs(Math.cos(a)) < 0.12 && Math.sin(a) < 0;
    if (east || north) continue;
    p.put(cx, 1.5, cz, 0.3, 3, (2 * Math.PI * r) / 28, '#8a969c', -a);
    addRotCol(cx, cz, 0.3, (Math.PI * r) / 28, -a, -1e9, 30);
  }
  sign(
    {
      text: 'Jool',
      sub: 'Rain Vortex · Forest Valley',
      w: 6,
      h: 1.4,
      bg: '#1d2b36',
      fg: '#ffffff',
      subfg: '#a9d0de',
      border: '#a9d0de',
      font: 'ui',
    },
    x + r + 1,
    4.5,
    z,
    Math.PI / 2,
    { both: true },
  );
  p.build();
  // The Rain Vortex: water falling from the oculus into the pool.
  const fall = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.6, 27, 20, 1, true), waterMat);
  fall.position.set(x, 14.5, z);
  scene.add(fall);
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 5.5, 0.6, 24),
    new THREE.MeshLambertMaterial({ color: 0x8a969c }),
  );
  ring.position.set(x, 27.8, z);
  scene.add(ring);
  interiors.push({
    name: 'Jool',
    rooms: [{ name: 'Forest Valley', x0: x - r + 2, x1: x + r - 2, z0: z - r + 2, z1: z + r - 2 }],
    props: p,
    door: { update() {} },
    lamp: [x, 20, z],
    lampOn: () => true,
    amount: 0.35,
    showWithin: 140,
  });
  register({
    x: VORTEX.x,
    y: 3,
    z: VORTEX.z,
    reach: 14,
    size: 6,
    label: () => 'Watch the Rain Vortex',
    run: () => {
      toast('The Rain Vortex', "Forty metres of rain falling through the dome. Aldi's first 'wah'.");
      markDone('jool');
    },
  });
}

export function buildChangi() {
  buildT3();
  buildJool();
}

/** Every frame: the water falls; at night it takes on the light show's colours. */
let night = 0;
envHooks.push((_h, n) => (night = n));
export function updateChangi(dt: number) {
  waterTex.offset.y -= dt * 0.9;
  if (night > 0.2) {
    _hue.setHSL((performance.now() * 0.00005) % 1, 0.6, 0.72);
    waterMat.color.copy(_hue);
  } else waterMat.color.set(0xffffff);
}
