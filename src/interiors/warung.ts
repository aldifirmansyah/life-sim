/* Inside Warung Bu Sri (interiors plan step 3). The front of the building is the
   shop, 5.6 × 2.7 m inside; Bu Sri's home is behind the back wall (a curtain
   doorway, not enterable). World coordinates, since the building is square to
   the axes: the front wall faces the gang at z = −4.8.
   - Customers' side (west): the rak jajan and rak dapur along the west wall, the
     rice sacks and galons by the back wall, the seed and tool board, a drinks
     chiller by the window.
   - The counter across the room at x 8.4–8.9, with an etalase of gorengan and
     jars on top; a gap by the back wall is how Bu Sri gets behind it.
   - Behind the counter (east): the stock shelves along the east wall, six bays
     that the warung shift fetches from.
   - A rolling shutter over the entrance: up while the warung is open (or Raka
     is inside), down at night.
   What the things do is in interiors/warungshop.ts. */
import { PropSet } from '../render/props';
import { Shutter } from './shutter';
import { mat, type Batch } from '../render/batch';
import { addCol } from '../core/collision';
import { player } from '../core/player';
import { residents, todayBlocks } from '../npc/npcs';
import { interiors, type Interior } from './interior';

export const WARUNG = 'Warung Bu Sri';
/** Inside faces of the walls, the floor top and the plafon. */
export const W = { x0: 5.62, x1: 11.18, z0: -4.68, z1: -2.0, fl: 0.05, ce: 2.95 };
export const ENTRANCE = { x0: 5.95, x1: 7.15 };
export const COUNTER = { x0: 8.4, x1: 8.9, z0: -4.68, z1: -2.75, h: 0.95 };
/** Where a customer stands to be served, and where Raka works during a shift. */
export const CUSTOMER_SPOTS: [number, number][] = [
  [8.0, -3.3],
  [8.0, -3.85],
];
export const SHIFT_SPOT: [number, number] = [9.3, -3.1];

/** Self-service shelves on the customers' side (id, where it's aimed at, the items on it). */
export const SHELVES: { id: string; name: string; at: [number, number, number]; items: string[] }[] = [
  {
    id: 'jajan',
    name: 'Rak jajan',
    at: [5.8, 1.2, -3.62],
    items: ['kerupuk', 'permen', 'keripik_pisang', 'koran', 'buku_tts'],
  },
  {
    id: 'dapur',
    name: 'Rak dapur',
    at: [5.8, 1.0, -2.5],
    items: ['telur', 'bawang', 'kecap', 'cabai', 'tempe', 'tahu'],
  },
  { id: 'beras', name: 'Karung beras', at: [7.1, 0.6, -2.3], items: ['beras'] },
  {
    id: 'alat',
    name: 'Bibit & alat',
    at: [7.95, 1.35, -2.03],
    items: ['bibit_cabai', 'bibit_tomat', 'bibit_kemangi', 'bola', 'pancing'],
  },
  { id: 'kulkas', name: 'Kulkas minuman', at: [7.8, 0.9, -4.4], items: ['es_jeruk'] },
];
/** What Bu Sri makes or hands over from behind the counter. */
export const COUNTER_ITEMS = ['teh_manis', 'kopi_sachet', 'gorengan', 'nasi_uduk', 'nasi_bungkus'];
/** The stock behind the counter that the warung shift fetches from (six bays along the east wall). */
export const STOCK_BAYS = ['Beras', 'Telur', 'Kopi sachet', 'Indomie', 'Gula', 'Minyak goreng'];
export const bayAt = (k: number): [number, number, number] => [11.0, 1.1, -4.35 + k * 0.4 + 0.2];

const PAINT = '#eef0e2',
  WOOD = '#7a5230',
  WOOD_D = '#5e3d22';
const GOODS = ['#e2412e', '#f2c14e', '#3b7dd8', '#58b368', '#ff8d5c', '#f4f1ea', '#b35ec2', '#1f9a8a'];

/** Is the warung open: Bu Sri or Dimas is at the counter or on the way there. */
export function warungOpen() {
  return residents.some(r => {
    if (r.npc.id !== 'sri' && r.npc.id !== 'dimas') return false;
    const loc = todayBlocks(r)[r.block]?.location ?? '';
    return loc === 'warung.owner' || loc === 'warung.helper';
  });
}

export function buildWarungInterior(): Interior {
  const set = new PropSet('warung-dalam');
  const P = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    c: string,
    b: Batch = set.solid,
    ry = 0,
    rx = 0,
    rz = 0,
  ) => b.add(mat(x, y, z, sx, sy, sz, ry, rx, rz), c);
  const Wc = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, c: string, col = true) =>
    set.box(x0, x1, y0, y1, z0, z1, c, { col });
  const colOnly = (x0: number, x1: number, z0: number, z1: number) => {
    const c = addCol(x0, x1, z0, z1);
    c.on = false;
    set.cols.push(c);
  };
  const { x0, x1, z0, z1, fl, ce } = W;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pickC = () => GOODS[Math.floor(rnd() * GOODS.length)];

  /* Floor: white ceramic tiles; plafon; paint on the walls; a skirting. */
  for (let x = x0; x < x1 - 1e-3; x += 0.4)
    for (let z = z0; z < z1 - 1e-3; z += 0.4) {
      const xa = Math.min(x1, x + 0.4),
        za = Math.min(z1, z + 0.4);
      P(
        (x + xa) / 2,
        fl / 2,
        (z + za) / 2,
        xa - x - 0.006,
        fl,
        za - z - 0.006,
        (Math.round(x / 0.4) + Math.round(z / 0.4)) % 2 ? '#ecebe6' : '#e2e1da',
      );
    }
  P((x0 + x1) / 2, fl / 2 - 0.003, (z0 + z1) / 2, x1 - x0, fl - 0.006, z1 - z0, '#9a9890');
  P((x0 + x1) / 2, ce + 0.015, (z0 + z1) / 2, x1 - x0, 0.03, z1 - z0, '#f3f1ea');
  P((x0 + x1) / 2, (fl + ce) / 2, z1 - 0.006, x1 - x0, ce - fl, 0.01, PAINT);
  for (const [x, s] of [
    [x0 + 0.006, 1],
    [x1 - 0.006, -1],
  ])
    (P(x, (fl + ce) / 2, (z0 + z1) / 2, 0.01, ce - fl, z1 - z0, PAINT), void s);
  P((x0 + x1) / 2, fl + 0.05, z1 - 0.012, x1 - x0, 0.1, 0.02, '#6f7d72');
  // The fluorescent tube.
  P(8.4, ce - 0.05, -3.35, 1.2, 0.05, 0.1, '#e8e8e8');
  set.light(8.4, ce - 0.09, -3.35, 0.03, '#f4fbff');
  P(8.4, ce - 0.09, -3.35, 1.1, 0.04, 0.04, '#f4fbff', set.glow);

  /* ---- Customers' side ---- */
  // Rak jajan: five shelves of packets, renteng sachets hanging from the top.
  const shelf = (za: number, zb: number, h: number, levels: number[], fill: (y: number, z: number) => void) => {
    const xa = x0,
      xb = x0 + 0.36;
    Wc(xa, xb, za, zb, fl, fl + 0.04, WOOD, false);
    for (const z of [za + 0.02, zb - 0.02]) P((xa + xb) / 2, fl + h / 2, z, 0.36, h, 0.04, WOOD_D);
    P(xa + 0.01, fl + h / 2, (za + zb) / 2, 0.02, h, zb - za, WOOD_D);
    for (const y of levels) {
      P((xa + xb) / 2, fl + y, (za + zb) / 2, 0.36, 0.025, zb - za, WOOD);
      for (let z = za + 0.08; z < zb - 0.06; z += 0.13) fill(fl + y + 0.012, z);
    }
    colOnly(xa, xb, za, zb);
  };
  shelf(-4.2, -3.05, 1.9, [0.1, 0.5, 0.9, 1.3, 1.7], (y, z) => {
    const h = 0.12 + rnd() * 0.14;
    P(x0 + 0.2, y + h / 2, z, 0.2, h, 0.1, pickC());
  });
  for (let z = -4.12; z < -3.1; z += 0.11) P(x0 + 0.4, 1.7, z, 0.012, 0.5 + rnd() * 0.25, 0.08, pickC(), set.cloth);
  P(x0 + 0.4, 1.96, -3.62, 0.015, 0.015, 1.1, '#9a9a9a');
  // Rak dapur: egg trays, kecap bottles, bawang in nets, tempe in leaves, tahu.
  shelf(-2.95, -2.05, 1.5, [0.1, 0.5, 0.9, 1.3], (y, z) => {
    const k = Math.floor(rnd() * 5);
    if (k === 0) P(x0 + 0.2, y + 0.04, z, 0.22, 0.08, 0.1, '#e8d2b0');
    else if (k === 1) P(x0 + 0.2, y + 0.1, z, 0.03, 0.2, 0.03, '#2a1a10', set.cyl);
    else if (k === 2) P(x0 + 0.2, y + 0.06, z, 0.08, 0.1, 0.08, '#a8476a', set.cone);
    else if (k === 3) P(x0 + 0.2, y + 0.03, z, 0.18, 0.06, 0.1, '#4f8a3a');
    else P(x0 + 0.2, y + 0.03, z, 0.14, 0.06, 0.1, '#f4efe0');
  });
  // Galons of drinking water, and the rice sacks with a scoop.
  for (const [x, y] of [
    [6.2, 0],
    [6.5, 0],
    [6.35, 0.44],
  ])
    P(x, fl + y + 0.22, -2.28, 0.13, 0.44, 0.13, '#8fc8e8', set.cyl);
  colOnly(6.05, 6.66, -2.45, z1);
  for (const [x, h, c] of [
    [6.95, 0.62, '#e8e2d2'],
    [7.32, 0.55, '#dcd6c4'],
  ] as const) {
    P(x, fl + h / 2, -2.3, 0.34, h, 0.42, c);
    P(x, fl + h + 0.02, -2.3, 0.3, 0.04, 0.36, '#f4f1ea');
  }
  P(7.1, fl + 0.7, -2.45, 0.1, 0.03, 0.18, '#d8392a');
  colOnly(6.76, 7.5, -2.55, z1);
  // The seed and tool board on the back wall: seed packets, a net of footballs, fishing rods.
  P(7.95, 1.35, z1 - 0.02, 0.8, 0.9, 0.03, '#c9a86a');
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 5; c++)
      P(7.65 + c * 0.15, 1.65 - r * 0.22, z1 - 0.04, 0.1, 0.16, 0.01, ['#58b368', '#e8502a', '#4f8a3a'][r]);
  P(8.28, 0.6, z1 - 0.12, 0.13, 0.13, 0.13, '#f4f1ea', set.solid, 0.4);
  for (const o of [0, 0.07]) P(7.55 + o, 1.2, z1 - 0.08, 0.012, 2.2, 0.012, '#6b4a2f', set.cyl, 0, 0, 0.12);
  // The drinks chiller under the plain part of the front wall.
  Wc(7.3, 8.3, z0, -4.1, fl, fl + 0.85, '#f2f2f0');
  P(7.8, fl + 0.86, -4.39, 0.96, 0.02, 0.54, '#b9d9e4');
  P(7.8, fl + 0.5, -4.098, 0.7, 0.25, 0.005, '#d8392a');
  for (let k = 0; k < 6; k++) P(7.45 + k * 0.14, fl + 0.8, -4.38, 0.03, 0.1, 0.03, pickC(), set.cyl);

  /* ---- The counter ---- */
  const ct = COUNTER;
  Wc(ct.x0, ct.x1, ct.z0, ct.z1, fl, fl + ct.h - 0.04, '#f2efe6');
  P((ct.x0 + ct.x1) / 2, fl + ct.h - 0.02, (ct.z0 + ct.z1) / 2, ct.x1 - ct.x0 + 0.06, 0.04, ct.z1 - ct.z0 + 0.04, WOOD);
  for (let z = ct.z0 + 0.2; z < ct.z1 - 0.1; z += 0.42) P(ct.x0 - 0.005, fl + 0.5, z + 0.1, 0.005, 0.5, 0.3, pickC());
  const top = fl + ct.h;
  // Etalase of gorengan: a glass box (frame only) with a tray of bakwan, tempe and pisang goreng.
  const ex = (ct.x0 + ct.x1) / 2;
  for (const [a, b] of [
    [-4.3, -4.3],
    [-3.75, -3.75],
  ])
    for (const dx of [-0.2, 0.2]) (P(ex + dx, top + 0.18, a, 0.02, 0.36, 0.02, '#c9d3d6'), void b);
  for (const y of [0.01, 0.36]) P(ex, top + y, -4.03, 0.44, 0.02, 0.57, '#c9d3d6');
  for (let k = 0; k < 9; k++)
    P(
      ex - 0.12 + (k % 3) * 0.12,
      top + 0.05,
      -4.23 + Math.floor(k / 3) * 0.18,
      0.1,
      0.05,
      0.08,
      ['#c9a86a', '#d99a3a', '#b8862a'][k % 3],
    );
  // Jars of kerupuk and permen, the cash box, a scale.
  for (let k = 0; k < 3; k++) {
    P(ex, top + 0.13, -3.55 + k * 0.2, 0.07, 0.26, 0.07, '#d8e8e8', set.cyl);
    P(ex, top + 0.27, -3.55 + k * 0.2, 0.075, 0.03, 0.075, ['#d8392a', '#3b7dd8', '#f2c14e'][k], set.cyl);
  }
  P(ex + 0.05, top + 0.05, -2.95, 0.3, 0.1, 0.22, '#2f6fb3');
  // Renteng sachets hanging over the counter.
  P(ct.x1 + 0.05, 2.25, -3.7, 0.015, 0.015, 1.8, '#9a9a9a');
  for (let z = -4.55; z < -2.85; z += 0.1)
    P(ct.x1 + 0.05, 1.95, z, 0.012, 0.45 + rnd() * 0.2, 0.08, pickC(), set.cloth);

  /* ---- Behind the counter ---- */
  // The stock shelves along the east wall: six bays, each with its own goods.
  const sx0 = x1 - 0.38;
  Wc(sx0, x1, -4.4, -2.0 - 0.1, fl, fl + 0.04, WOOD, false);
  colOnly(sx0, x1, -4.4, -2.1);
  const bayLook: ((y: number, z: number) => void)[] = [
    (y, z) => P(x1 - 0.19, y + 0.12, z, 0.3, 0.24, 0.3, '#e8e2d2'),
    (y, z) => P(x1 - 0.19, y + 0.04, z, 0.28, 0.08, 0.3, '#e8d2b0'),
    (y, z) => P(x1 - 0.19, y + 0.08, z, 0.26, 0.16, 0.3, '#6b4a2f'),
    (y, z) => P(x1 - 0.19, y + 0.07, z, 0.26, 0.14, 0.3, '#e2412e'),
    (y, z) => P(x1 - 0.19, y + 0.09, z, 0.26, 0.18, 0.3, '#f4f1ea'),
    (y, z) => P(x1 - 0.19, y + 0.12, z, 0.1, 0.24, 0.1, '#f2c14e', set.cyl),
  ];
  for (let k = 0; k < 6; k++) {
    const zc = -4.35 + k * 0.4 + 0.2;
    for (const y of [0.4, 0.85, 1.3, 1.75]) {
      P(x1 - 0.19, fl + y, zc, 0.36, 0.025, 0.38, WOOD);
      bayLook[k](fl + y + 0.013, zc);
    }
    P(x1 - 0.19, fl + 1.0, zc - 0.2, 0.36, 2.0, 0.025, WOOD_D);
  }
  // A curtain doorway through to Bu Sri's home, a stool, a clock.
  P(10.2, 1.05, z1 - 0.02, 0.8, 2.0, 0.02, '#8a3b3b', set.cloth);
  P(10.2, 2.08, z1 - 0.03, 0.9, 0.06, 0.04, WOOD_D);
  colOnly(9.8, 10.6, z1 - 0.05, z1);
  P(9.9, fl + 0.22, -2.6, 0.15, 0.44, 0.15, '#2f6fb3', set.cyl);
  P(9.3, 2.3, z1 - 0.015, 0.14, 0.02, 0.14, '#f4efe2', set.cyl, 0, Math.PI / 2);

  set.build();
  const shutter = new Shutter(
    ENTRANCE.x0,
    ENTRANCE.x1,
    -4.8,
    -1,
    2.3,
    warungOpen,
    () => player.x > W.x0 && player.x < W.x1 && player.z > -4.9 && player.z < W.z1,
  );

  const it: Interior = {
    name: WARUNG,
    rooms: [
      { name: 'Balik meja', x0: COUNTER.x1, x1, z0, z1 },
      { name: 'Toko', x0, x1: COUNTER.x1, z0, z1 },
    ],
    props: set,
    door: shutter,
    lamp: [8.4, ce - 0.3, -3.35],
    lampOn: () => true,
  };
  interiors.push(it);
  return it;
}
