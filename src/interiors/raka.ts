/* Inside Mbah Minah's house (Rumah Raka), real size: the 7 × 6.2 m shell from
   world/houses.ts split into a ruang tamu at the front, the kamar and the dapur
   behind it, and a kamar mandi in the dapur's back corner. Step 1 of the
   interiors plan: the rooms themselves, the door, the lamp, and the home menu on
   a small table until the furniture takes over in step 2. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { rakaHouse } from '../world/landmarks';
import { interactables } from '../game/interact';
import { Door } from './door';
import { interiors, roomL, type Interior } from './interior';
import { setWake } from '../core/time';
import { addCol } from '../core/collision';

export const NAME = 'Rumah Raka';
/** Inner face of the outer walls, local. */
const IX = 3.38,
  IZ = 2.98;
/** Floor top and ceiling. */
const FL = 0.13,
  CE = 2.95;
/** Partitions: the front room ends at z = PZ; the kamar and dapur split at x = PX. */
const PZ = 0.3,
  PX = -0.2;
/** The kamar mandi in the dapur's back corner. */
const MX = 2.0,
  MZ = -1.5;

export function buildRakaInterior(): Interior {
  const h = rakaHouse;
  const set = new PropSet('rumah-dalam');
  const inner = '#dfe8dc';
  // Box by local centre and size.
  const P = (lx: number, y: number, lz: number, sx: number, sy: number, sz: number, c: string, b = set.solid) => {
    const [x, z] = h.F(lx, lz);
    set.put(x, y, z, sx, sy, sz, c, h.th, b);
  };
  // Box by local extents, optionally solid to walk into.
  const W = (lx0: number, lx1: number, lz0: number, lz1: number, y0: number, y1: number, c: string, col = true) => {
    const a = h.F(lx0, lz0),
      b = h.F(lx1, lz1);
    set.box(Math.min(a[0], b[0]), Math.max(a[0], b[0]), y0, y1, Math.min(a[1], b[1]), Math.max(a[1], b[1]), c, {
      col,
    });
  };

  // A collider with nothing drawn (furniture made of several parts).
  const colOnly = (lx0: number, lx1: number, lz0: number, lz1: number) => {
    const a = h.F(lx0, lz0),
      b = h.F(lx1, lz1);
    const c = addCol(a[0], b[0], a[1], b[1]);
    c.on = false;
    set.cols.push(c);
  };

  /* Floor: old cream tegel in a soft check, small green tiles in the kamar mandi. */
  const S = 0.5;
  for (let x = -IX; x < IX - 1e-3; x += S)
    for (let z = -IZ; z < IZ - 1e-3; z += S) {
      const x1 = Math.min(IX, x + S),
        z1 = Math.min(IZ, z + S);
      const cx = (x + x1) / 2,
        cz = (z + z1) / 2;
      if (cx > MX && cz < MZ) continue;
      const odd = (Math.round((x + IX) / S) + Math.round((z + IZ) / S)) % 2;
      P(cx, FL / 2, cz, x1 - x - 0.008, FL, z1 - z - 0.008, odd ? '#d6c9ae' : '#cbbd9f');
    }
  P(0, FL / 2 - 0.004, 0, IX * 2, FL - 0.008, IZ * 2, '#8f846d');
  for (let x = MX; x < IX - 1e-3; x += 0.25)
    for (let z = -IZ; z < MZ - 1e-3; z += 0.25) {
      const x1 = Math.min(IX, x + 0.25),
        z1 = Math.min(MZ, z + 0.25);
      P((x + x1) / 2, FL / 2 - 0.02, (z + z1) / 2, x1 - x - 0.01, FL, z1 - z - 0.01, '#8fb3ad');
    }
  // The threshold stone under the door.
  P(h.dx, FL / 2, h.fz - 0.06, 1.0, FL, 0.13, '#8a7f6c');

  /* Ceiling: plafon boards with strips, and a band of paint on the walls under it. */
  P(0, CE + 0.015, 0, IX * 2, 0.03, IZ * 2, '#f1ece0');
  for (let x = -IX + 1.2; x < IX; x += 1.2) P(x, CE - 0.01, 0, 0.05, 0.02, IZ * 2, '#d8d0bf');
  for (let z = -IZ + 1.2; z < IZ; z += 1.2) P(0, CE - 0.01, z, IX * 2, 0.02, 0.05, '#d8d0bf');

  /* Partitions (plastered, painted lighter inside), full height, with doorways. */
  const T = 0.1;
  const along = (lz: number, a: number, b: number, holes: { c: number; w: number; top: number }[], c = inner) => {
    let x = a;
    for (const o of [...holes].sort((p, q) => p.c - q.c)) {
      const x0 = o.c - o.w / 2,
        x1 = o.c + o.w / 2;
      if (x0 > x) W(x, x0, lz - T / 2, lz + T / 2, FL, CE, c);
      W(x0, x1, lz - T / 2, lz + T / 2, o.top, CE, c, false);
      // Door frame.
      for (const e of [x0, x1]) P(e, (FL + o.top) / 2, lz, 0.06, o.top - FL, T + 0.04, '#7a5a3a');
      P(o.c, o.top + 0.03, lz, o.w + 0.12, 0.06, T + 0.04, '#7a5a3a');
      x = x1;
    }
    if (b > x) W(x, b, lz - T / 2, lz + T / 2, FL, CE, c);
  };
  const across = (lx: number, a: number, b: number, c = inner) => W(lx - T / 2, lx + T / 2, a, b, FL, CE, c);
  along(PZ, -IX, IX, [
    { c: -1.9, w: 0.8, top: 2.08 },
    { c: 1.1, w: 0.9, top: 2.12 },
  ]);
  across(PX, -IZ, PZ - T / 2);
  // Kamar mandi: tiled to shoulder height inside.
  across(MX, -IZ, MZ - T / 2);
  along(MZ, MX + T / 2, IX, [{ c: 2.72, w: 0.7, top: 2.0 }]);
  P(MX + 0.06, 0.8, (MZ - IZ) / 2 - 0.02, 0.02, 1.4, -MZ + IZ - 0.1, '#a9c8c2');

  /* Paint on the inside of the outer walls (lighter than the outside), around the door and windows. */
  const L = 0.006;
  P(0, (FL + CE) / 2, -IZ + L, IX * 2, CE - FL, 0.01, inner);
  for (const sx of [-1, 1]) P(sx * (IX - L), (FL + CE) / 2, 0, 0.01, CE - FL, IZ * 2, inner);
  const slots = h.w >= 5.8 ? [-h.w * 0.3, 0, h.w * 0.3] : [-h.w * 0.22, h.w * 0.22];
  const holes = slots.map(x =>
    Math.abs(x - h.dx) < 0.01
      ? { x0: x - 0.5, x1: x + 0.5, y0: FL, y1: 2.2 }
      : { x0: x - 0.55, x1: x + 0.55, y0: 1.06, y1: 2.04 },
  );
  let hx = -IX;
  for (const o of holes) {
    if (o.x0 > hx) P((hx + o.x0) / 2, (FL + CE) / 2, IZ - L, o.x0 - hx, CE - FL, 0.01, inner);
    if (o.y0 > FL) P((o.x0 + o.x1) / 2, (FL + o.y0) / 2, IZ - L, o.x1 - o.x0, o.y0 - FL, 0.01, inner);
    P((o.x0 + o.x1) / 2, (o.y1 + CE) / 2, IZ - L, o.x1 - o.x0, CE - o.y1, 0.01, inner);
    hx = o.x1;
  }
  if (IX > hx) P((hx + IX) / 2, (FL + CE) / 2, IZ - L, IX - hx, CE - FL, 0.01, inner);

  /* Skirting along the outer walls. */
  const sk = '#6f7d72';
  P(0, FL + 0.05, -IZ + 0.01, IX * 2, 0.1, 0.02, sk);
  for (const sx of [-1, 1]) P(sx * (IX - 0.01), FL + 0.05, 0, 0.02, 0.1, IZ * 2, sk);
  for (const [a, b] of [
    [-IX, h.dx - 0.5],
    [h.dx + 0.5, IX],
  ])
    if (b > a) P((a + b) / 2, FL + 0.05, IZ - 0.01, b - a, 0.1, 0.02, sk);

  /* A batik curtain drawn aside in the kamar doorway, on a rod. */
  P(-1.9, 2.06, PZ + 0.09, 0.95, 0.025, 0.025, '#5a3e28', set.cyl);
  P(-2.2, 1.12, PZ + 0.09, 0.26, 1.88, 0.03, '#8a3b3b', set.cloth);
  P(-2.2, 1.5, PZ + 0.1, 0.27, 0.12, 0.035, '#d9a441', set.cloth);

  /* The lamp: a cord and an enamel shade over the front room. */
  const lampL: [number, number] = [0, 1.55];
  P(lampL[0], CE - 0.2, lampL[1], 0.01, 0.4, 0.01, '#2a2a2a', set.cyl);
  P(lampL[0], CE - 0.42, lampL[1], 0.2, 0.1, 0.2, '#e6e2d6', set.cone);

  /* For now: a small meja by the right-hand wall with the laptop, where the home menu lives. */
  const tx = IX - 0.35,
    tz = 1.4;
  P(tx, FL + 0.72, tz, 0.6, 0.04, 1.0, '#7a5230');
  for (const [a, b] of [
    [-0.25, -0.45],
    [0.25, -0.45],
    [-0.25, 0.45],
    [0.25, 0.45],
  ])
    P(tx + a, FL + 0.35, tz + b, 0.04, 0.7, 0.04, '#6a4526');
  colOnly(tx - 0.3, tx + 0.3, tz - 0.5, tz + 0.5);
  P(tx, FL + 0.755, tz, 0.26, 0.012, 0.36, '#2b2d31');
  P(tx + 0.12, FL + 0.87, tz, 0.012, 0.22, 0.36, '#2b2d31');
  P(tx + 0.11, FL + 0.87, tz, 0.004, 0.19, 0.32, '#5a7fa8');
  set.build();

  /* The door, the lamp, the sandals on the teras mat. */
  const door = new Door(h.F, h.th, h.dx, h.fz, h.doorC);
  const [lx, lz] = h.F(lampL[0], lampL[1]);
  const sandals = new THREE.Group();
  const sm = new THREE.MeshLambertMaterial({ color: '#3b5f8a' });
  for (const o of [-0.09, 0.09]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.26), sm);
    s.position.set(o, 0.13, 0);
    s.rotation.y = o * 1.2;
    sandals.add(s);
  }
  const sp = h.F(h.dx + 0.62, h.fz + 0.42);
  sandals.position.set(sp[0], 0, sp[1]);
  sandals.rotation.y = h.th;
  sandals.visible = false;
  scene.add(sandals);

  const it: Interior = {
    name: NAME,
    rooms: [
      roomL(h.F, 'Kamar mandi', MX, IX, -IZ, MZ),
      roomL(h.F, 'Kamar', -IX, PX, -IZ, PZ),
      roomL(h.F, 'Dapur', PX, IX, -IZ, PZ),
      roomL(h.F, 'Ruang tamu', -IX, IX, PZ, IZ + 0.02),
    ],
    props: set,
    door,
    lamp: [lx, CE - 0.45, lz],
    lampOn: () => true,
    sandals,
  };
  interiors.push(it);

  const [dcx, dcz] = [door.x, door.z];
  interactables.push({
    x: dcx,
    z: dcz,
    y: 1.1,
    size: 0.7,
    reach: 2.0,
    inside: '*',
    label: () => (door.target > 0.5 ? 'Close the door' : 'Open the door'),
    run: () => door.toggle(),
  });

  // Mornings start in the kamar, facing the doorway.
  const [wx, wz] = h.F(-1.9, -1.2);
  const fwd = h.F(0, 1),
    o = h.F(0, 0);
  setWake(wx, wz, Math.atan2(-(fwd[0] - o[0]), -(fwd[1] - o[1])), 'Raka wakes up in his grandmother’s old room.');
  return it;
}

/** Where the home table is, for activities to hang the home menu on. */
export function homeTable(): [number, number] {
  return rakaHouse.F(IX - 0.35, 1.4);
}
