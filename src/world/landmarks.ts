/* Hand-placed landmarks: warung, warkop, musholla, balai, pos ronda, lapangan,
   Raka's house, pangkalan ojek, gapura and kebun warga. */
import { R, rand, pick } from '../core/util';
import { addCol } from '../core/collision';
import { mat, solid, roofs, cyl, crowns, cones, lit, B, C, blob } from '../render/batch';
import { buildHouse, bike, type House } from './houses';
import { mango, kamboja } from './trees';

const GOODS = ['#e2412e', '#f2c14e', '#3b7dd8', '#58b368', '#ff8d5c', '#f4f1ea', '#b35ec2', '#1f9a8a'];
/** Raka's house, for its door (home activities) and the planters out front. */
export let rakaHouse: House;

export function landmarks() {
  /* Warung Bu Sri: a walk-in shop at the front of the building (interiors/warung.ts), Bu Sri's home behind.
     The goods in the window and the renteng hanging under the awning keep their R() calls, so the layout of
     the rest of the kampung doesn't move. */
  const wc = '#3fb0a0',
    band = '#2a7f74';
  // Bu Sri's home: the back of the building, solid.
  B(5.5, 11.3, 0, 3.3, -2.0, -0.5, wc, { col: true });
  B(5.46, 11.34, 0, 0.45, -2.0, -0.46, band);
  // The shop: side walls, and a front wall with the entrance (a rolling shutter) and a display window.
  for (const [x0, x1] of [
    [5.5, 5.62],
    [11.18, 11.3],
  ]) {
    B(x0, x1, 0, 3.3, -4.8, -2.0, wc, { col: true });
    B(x0 === 5.5 ? 5.46 : 11.3, x0 === 5.5 ? 5.5 : 11.34, 0, 0.45, -4.84, -2.0, band);
  }
  const fz0 = -4.8,
    fz1 = -4.68;
  B(5.62, 5.95, 0, 3.3, fz0, fz1, wc, { col: true });
  B(5.95, 7.15, 2.3, 3.3, fz0, fz1, wc);
  B(7.15, 9.0, 0, 3.3, fz0, fz1, wc, { col: true });
  B(9.0, 10.9, 0, 1.0, fz0, fz1, wc, { col: true });
  B(9.0, 10.9, 2.2, 3.3, fz0, fz1, wc);
  B(10.9, 11.18, 0, 3.3, fz0, fz1, wc, { col: true });
  for (const [x0, x1] of [
    [5.46, 5.95],
    [7.15, 11.34],
  ])
    B(x0, x1, 0, 0.45, -4.84, -4.8, band);
  // Window frame and teralis.
  B(8.95, 10.95, 0.95, 1.02, -4.86, -4.66, '#e8e2d2');
  B(8.95, 10.95, 2.18, 2.25, -4.86, -4.66, '#e8e2d2');
  for (let x = 9.2; x < 10.9; x += 0.24) C(x, -4.74, 1.0, 2.2, 0.012, '#2a2a2c');
  // A lit sign over the entrance.
  B(5.95, 7.15, 2.36, 2.62, -4.9, -4.84, '#ffd9a0', { b: lit });
  for (let y = 1.05; y < 2.2; y += 0.42)
    for (let x = 6.15; x < 10.6; x += 0.34) {
      if (R() < 0.75) {
        const c = pick(GOODS);
        // Goods on the window sill; none in the doorway or in front of the plain wall.
        if (x > 9.0 && x < 10.6 && y < 1.2) B(x, x + 0.26, 1.02, 1.32, -4.93, -4.88, c);
      }
    }
  for (let x = 6.1; x < 10.8; x += 0.21) {
    const h = rand(0.35, 0.7);
    B(x, x + 0.13, 2.35 - h, 2.35, -5.02, -4.99, pick(GOODS));
  }
  solid.add(mat(8.1, 2.4, -6.1, 7.2, 0.07, 2.6, 0, -0.12), '#2d7fc1');
  C(4.7, -7.25, 0, 2.25, 0.06, '#6f6a62', { col: true });
  C(11.5, -7.25, 0, 2.25, 0.06, '#6f6a62', { col: true });
  // The bench out front, under the window (the entrance is kept clear).
  B(7.9, 10.4, 0, 0.45, -6.7, -5.95, '#c9a86a', { col: true });
  for (const [x, z] of [
    [4.1, -5.8],
    [4.5, -5.5],
    [4.0, -5.3],
  ])
    C(x, z, 0, 0.46, 0.16, '#58a84a');
  B(3.6, 5.0, 0, 0.95, -4.5, -3.6, '#f2f2f0', { col: true });
  B(3.6, 5.0, 0.95, 1.02, -4.5, -3.6, '#d8392a');
  roofs.add(mat(8.4, 3.3, -2.65, 6.4, 1.1, 4.9), '#a64a31');
  solid.add(mat(4.25, 2.62, -2.7, 2.6, 0.06, 4.3, 0, 0, 0.08), '#8b9296');
  C(3.2, -4.6, 0, 2.6, 0.05, '#6f6a62', { col: true });
  C(3.2, -0.8, 0, 2.6, 0.05, '#6f6a62', { col: true });
  B(3.6, 4.9, 0, 0.74, -3.3, -2.1, '#7a5236', { col: true });
  for (const [x, z, c] of [
    [3.5, -1.6, '#d8392a'],
    [4.9, -1.7, '#2f6fb3'],
  ] as [number, number, string][])
    C(x, z, 0, 0.45, 0.17, c);

  /* Warkop Berkah: the room behind the terrace can be walked into (interiors/warkop.ts). No R() calls here. */
  const kc = '#e2b04a',
    kb = '#9a7430';
  // Side and back walls, and the plinth band outside.
  B(-11.3, -11.18, 0, 3.0, 19.8, 24.3, kc, { col: true });
  B(-6.32, -6.2, 0, 3.0, 19.8, 24.3, kc, { col: true });
  B(-11.18, -6.32, 0, 3.0, 24.18, 24.3, kc, { col: true });
  B(-11.34, -11.3, 0, 0.45, 19.76, 24.34, kb);
  B(-6.2, -6.16, 0, 0.45, 19.76, 24.34, kb);
  B(-11.3, -6.2, 0, 0.45, 24.3, 24.34, kb);
  // The front: a window onto the terrace, and the doorway (a folding shutter) at the east end.
  const kz0 = 19.8,
    kz1 = 19.92;
  B(-11.18, -10.8, 0, 3.0, kz0, kz1, kc, { col: true });
  B(-10.8, -8.8, 0, 0.9, kz0, kz1, kc, { col: true });
  B(-10.8, -8.8, 2.0, 3.0, kz0, kz1, kc);
  B(-8.8, -8.35, 0, 3.0, kz0, kz1, kc, { col: true });
  B(-8.35, -7.25, 2.2, 3.0, kz0, kz1, kc);
  B(-7.25, -6.32, 0, 3.0, kz0, kz1, kc, { col: true });
  for (const [x0, x1] of [
    [-11.34, -8.35],
    [-7.25, -6.16],
  ])
    B(x0, x1, 0, 0.45, 19.76, kz0, kb);
  B(-10.85, -8.75, 0.86, 0.93, 19.72, 19.95, '#e8e2d2');
  B(-10.85, -8.75, 1.98, 2.05, 19.72, 19.95, '#e8e2d2');
  for (let x = -10.6; x < -8.8; x += 0.25) C(x, 19.86, 0.9, 2.0, 0.012, '#2a2a2c');
  // The name over the door, lit at night.
  B(-8.45, -7.15, 2.26, 2.5, 19.74, 19.78, '#ffcf8a', { b: lit });
  B(-11.4, -3.2, 2.7, 2.76, 17.3, 19.8, '#9aa0a4');
  for (const [x, z] of [
    [-11.2, 17.45],
    [-7.3, 17.45],
    [-3.4, 17.45],
    [-3.4, 19.6],
  ])
    C(x, z, 0, 2.7, 0.07, '#6f6a62', { col: true });
  B(-10.2, -6.8, 0, 0.78, 18.3, 18.9, '#7a5236', { col: true });
  B(-10.2, -6.8, 0, 0.44, 17.62, 17.98, '#5d3f2a', { col: true });
  // The south bench stops short of the doorway.
  B(-10.2, -8.7, 0, 0.44, 19.2, 19.55, '#5d3f2a');
  B(-9.9, -9.1, 0.78, 1.12, 18.42, 18.8, '#e9dcb8');
  for (let x = -9.5; x < -7.2; x += 0.45) C(x, 18.6, 0.78, 0.9, 0.05, '#f4f1ea');
  B(-5.9, -4.2, 0, 0.72, 18.0, 18.9, '#8a6443', { col: true });
  for (const [x, z, c] of [
    [-6.3, 17.8, '#d8392a'],
    [-3.9, 18.2, '#2f6fb3'],
    [-5.1, 17.6, '#3a9a73'],
    [-6.3, 19.1, '#e0a52a'],
  ] as [number, number, string][])
    C(x, z, 0, 0.44, 0.17, c);
  B(-5.3, -4.4, 2.02, 2.55, 19.52, 19.6, '#7fb1ff', { b: lit });
  B(-5.35, -4.35, 1.98, 2.6, 19.6, 19.66, '#1e1e20');
  roofs.add(mat(-8.75, 3.0, 22.05, 5.6, 1.0, 4.9), '#8e4a33');

  /* Musholla Al-Ikhlas */
  // A prayer hall you can walk into (interiors/musholla.ts): walls 0.15 thick with the frosted windows open
  // through them, the mihrab in the west wall (toward the qibla) and the door in the south wall by the taps.
  // No R() calls here.
  const mw = '#eef0e6',
    mb = '#a9bfae';
  const mx0 = 5,
    mx1 = 13.6,
    mz0 = -21,
    mz1 = -13,
    mt = 0.15;
  B(mx0, mx0 + mt, 0, 3.6, mz0, -17.5, mw, { col: true });
  B(mx0, mx0 + mt, 0, 3.6, -16.5, mz1, mw, { col: true });
  B(mx0, mx0 + mt, 2.5, 3.6, -17.5, -16.5, mw);
  B(mx1 - mt, mx1, 0, 3.6, mz0, mz1, mw, { col: true });
  // North and south walls, with the three window openings (and the door on the south side).
  for (const [z0, z1, door] of [
    [mz0, mz0 + mt, false],
    [mz1 - mt, mz1, true],
  ] as [number, number, boolean][]) {
    const holes: [number, number, number][] = [
      [6.1, 7.1, 1.2],
      [8.7, 9.7, 1.2],
      [11.3, 12.3, 1.2],
    ];
    if (door) holes.push([9.8, 10.8, 0]);
    holes.sort((a, b) => a[0] - b[0]);
    let x = mx0 + mt;
    for (const [h0, h1, y0] of holes) {
      if (h0 > x) B(x, h0, 0, 3.6, z0, z1, mw, { col: true });
      if (y0 > 0) B(h0, h1, 0, y0, z0, z1, mw, { col: true });
      B(h0, h1, y0 > 0 ? 2.55 : 2.3, 3.6, z0, z1, mw);
      x = h1;
    }
    B(x, mx1 - mt, 0, 3.6, z0, z1, mw, { col: true });
  }
  B(4.96, 13.64, 3.22, 3.6, -21.04, -12.96, '#2e8b57');
  // The plinth band outside (not across the doorway), and the mihrab's niche standing out on the jalan side.
  B(4.96, mx1 + 0.04, 0, 0.42, mz0 - 0.04, mz0, mb);
  B(4.96, 9.8, 0, 0.42, mz1, mz1 + 0.04, mb);
  B(10.8, mx1 + 0.04, 0, 0.42, mz1, mz1 + 0.04, mb);
  B(4.96, mx0, 0, 0.42, mz0, mz1, mb);
  B(4.6, 4.75, 0, 2.9, -17.6, -16.4, mw, { col: true });
  B(4.75, 5.0, 0, 2.9, -17.6, -17.5, mw, { col: true });
  B(4.75, 5.0, 0, 2.9, -16.5, -16.4, mw, { col: true });
  B(4.75, 5.0, 2.5, 2.9, -17.5, -16.5, mw);
  B(4.56, 5.0, 2.9, 3.05, -17.7, -16.3, '#2e8b57');
  B(4.9, 13.7, 3.6, 3.76, -21.1, -12.9, '#dfe3d8');
  B(3, 5, 0, 0.18, -21, -13, '#e6e1d4');
  B(3, 5.2, 2.78, 2.88, -21.2, -12.8, '#2e8b57');
  for (const z of [-20.8, -18.7, -15.3, -13.2]) B(3.1, 3.3, 0, 2.8, z - 0.1, z + 0.1, '#eef0e6', { col: true });
  for (const x of [6.6, 9.2, 11.8]) {
    B(x - 0.5, x + 0.5, 1.2, 2.55, -21.06, -21.0, '#ffe3a8', { b: lit });
    B(x - 0.5, x + 0.5, 1.2, 2.55, -13.0, -12.94, '#ffe3a8', { b: lit });
  }
  C(9.3, -17, 3.76, 4.25, 2.5, '#eef0e6');
  crowns.add(mat(9.3, 4.25, -17, 2.5, 2.2, 2.5), '#2f8f5b');
  C(9.3, -17, 6.3, 7.1, 0.05, '#d9b24a');
  blob(9.3, 7.15, -17, 0.16, '#d9b24a');
  B(12.6, 13.6, 0, 8.4, -22.9, -21.9, '#eef0e6', { col: true });
  cones.add(mat(13.1, 8.9, -22.4, 0.8, 1.0, 0.8), '#2e8b57');
  C(13.1, -23.05, 7.3, 7.75, 0.2, '#c7ccd0');
  C(13.75, -22.4, 7.3, 7.75, 0.2, '#c7ccd0');
  B(10.8, 13.6, 0, 1.05, -12.6, -11.7, '#9fc6cc', { col: true });
  for (let x = 11.1; x < 13.5; x += 0.5) C(x, -11.62, 0.8, 0.95, 0.03, '#c0c4c8');
  B(3.25, 3.75, 0, 0.7, -20.5, -19.2, '#6b4a2f');

  /* Balai Warga */
  B(-19.8, -6.2, 0, 0.15, -30.4, -22.6, '#cfc3ab');
  B(-19.8, -6.2, 0, 3.4, -23.0, -22.6, '#eadcc2', { col: true });
  B(-19.8, -19.45, 0, 1.0, -30.4, -23, '#eadcc2', { col: true });
  B(-6.55, -6.2, 0, 1.0, -30.4, -23, '#eadcc2', { col: true });
  for (const x of [-19.62, -15.2, -10.8, -6.38]) B(x - 0.17, x + 0.17, 0, 3.1, -30.4, -30.06, '#7a5236', { col: true });
  B(-19.9, -6.1, 3.0, 3.42, -30.46, -30.04, '#7a5236');
  roofs.add(mat(-13, 3.4, -26.5, 15, 1.8, 9), '#9c4a34');
  for (let i = 0; i < 4; i++) {
    B(-18.9 + i * 0.7, -18.4 + i * 0.7, 0.15, 1.35, -24.1, -23.5, pick(['#d8392a', '#2f6fb3', '#3a9a73']));
  }
  B(-15, -11, 0.15, 0.9, -26.8, -25.8, '#8a6a4a', { col: true });
  B(-8.4, -8.3, 0, 2.0, -30.9, -30.8, '#6b4a2f');
  B(-5.9, -5.8, 0, 2.0, -30.9, -30.8, '#6b4a2f');
  B(-8.3, -5.9, 0.95, 1.95, -30.95, -30.85, '#8a6443');
  for (let i = 0; i < 5; i++) {
    const x = -8.15 + i * 0.47;
    B(
      x,
      x + 0.36,
      1.2 + (i % 2) * 0.25,
      1.62 + (i % 2) * 0.2,
      -30.99,
      -30.96,
      pick(['#fbf7ee', '#f7e8a6', '#fbf7ee', '#dff0f7']),
    );
  }
  B(-21, -20.2, 0, 0.3, -30.7, -29.9, '#cfc8b8');
  C(-20.6, -30.3, 0, 7.6, 0.05, '#f2f2ee');
  B(-20.55, -19.25, 6.95, 7.5, -30.32, -30.28, '#d8261f');
  B(-20.55, -19.25, 6.4, 6.95, -30.32, -30.28, '#f5f3ee');

  /* Pos Ronda + bakso cart */
  B(-7.2, -3.8, 0, 0.55, 39.8, 42.4, '#c9a86a', { col: true });
  for (let z = 39.95; z < 42.4; z += 0.28) B(-7.2, -3.8, 0.55, 0.58, z, z + 0.2, '#d8bb82');
  for (const [x, z] of [
    [-7.1, 39.9],
    [-3.9, 39.9],
    [-7.1, 42.3],
    [-3.9, 42.3],
  ])
    B(x - 0.07, x + 0.07, 0, 2.5, z - 0.07, z + 0.07, '#7a5a3a');
  roofs.add(mat(-5.5, 2.5, 41.1, 3.4, 1.0, 4.2, Math.PI / 2), '#8e4a33');
  C(-3.72, 42.52, 1.25, 2.05, 0.11, '#7a4a2a');
  B(-6, -5.4, 0.58, 0.62, 40.6, 41.2, '#efe6cf');
  C(-4.5, 41.8, 0.58, 0.95, 0.08, '#d8392a');
  B(-6.9, -5.3, 0.5, 1.35, 43.4, 44.3, '#2f6fb3', { col: true });
  B(-6.8, -5.4, 1.35, 1.78, 43.5, 44.2, '#e1edf1');
  cyl.add(mat(-6.5, 0.32, 43.34, 0.32, 0.08, 0.32, 0, Math.PI / 2), '#2b2b2b');
  cyl.add(mat(-6.5, 0.32, 44.36, 0.32, 0.08, 0.32, 0, Math.PI / 2), '#2b2b2b');
  C(-5.7, 43.85, 1.35, 1.75, 0.26, '#b9bec2');
  B(-7.0, -5.2, 2.08, 2.12, 43.25, 44.45, '#e8e0cc');
  for (const x of [-6.95, -5.25]) C(x, 43.85, 1.35, 2.08, 0.025, '#888');

  /* Lapangan */
  for (const gx of [-56.4, -33.3]) {
    const s = gx < -45 ? 1 : -1;
    B(gx - 0.06, gx + 0.06, 0, 2.0, 2.4, 2.52, '#f4f4f0', { col: true });
    B(gx - 0.06, gx + 0.06, 0, 2.0, 5.48, 5.6, '#f4f4f0', { col: true });
    B(gx - 0.06, gx + 0.06, 1.94, 2.06, 2.4, 5.6, '#f4f4f0');
    B(gx - s * 1.0 - 0.04, gx - s * 1.0 + 0.04, 0, 1.2, 2.4, 5.6, '#c9c9c4');
  }
  B(-50, -46, 0, 0.45, -6.62, -6.2, '#7a5236', { col: true });
  B(-42, -38, 0, 0.45, -6.62, -6.2, '#7a5236', { col: true });
  for (let z = -6; z <= 14.5; z += 2.5) B(-58.4, -58.25, 0, 3.2, z - 0.07, z + 0.07, '#6f6a62');
  B(-58.4, -58.25, 3.1, 3.2, -6, 14.5, '#6f6a62');
  mango(-55.5, -4.6, 1.35);
  mango(-34, 13.2, 1.1);

  /* Rumah Raka */
  const rk = buildHouse({
    cx: 16.5,
    cz: 22.1,
    th: Math.PI,
    w: 7,
    d: 6.2,
    sb: 1.8,
    sp: {
      two: false,
      wall: '#b8d2c1',
      roof: '#8a4430',
      door: '#6b4a2f',
      shutters: true,
      pagar: true,
      pagarC: '#d9d2c2',
      awning: true,
      bench: '#8a5a33',
      plants: 5,
      noBike: true,
      teras: '#a86c57',
      hollow: true,
    },
  });
  rakaHouse = rk;
  // Clear of the house now that it can be walked into (same R() calls, only moved).
  kamboja(20.5, 17.7);
  const np = rk.F(-1.4, 3.12);
  B(np[0] - 0.18, np[0] + 0.18, 2.0, 2.25, np[1] - 0.02, np[1], '#1f5f8a');

  /* Pangkalan ojek */
  B(3.3, 7.6, 2.6, 2.68, 52, 56.2, '#2f6fb3');
  for (const [x, z] of [
    [3.4, 52.1],
    [3.4, 56.1],
    [7.5, 52.1],
    [7.5, 56.1],
  ])
    C(x, z, 0, 2.6, 0.06, '#6f6a62', { col: true });
  B(5.8, 7.2, 0, 0.46, 52.4, 55.8, '#6b4a2f', { col: true });
  for (const [z, c] of [
    [52.9, '#3a9a73'],
    [53.6, '#d8392a'],
    [55.2, '#3a9a73'],
  ] as [number, string][])
    blob(6.5, 0.66, z, 0.19, c, 0.8);
  bike(4.2, 53.0, Math.PI, '#3a9a73');
  bike(4.2, 54.3, Math.PI, '#222326');
  bike(4.2, 55.6, Math.PI, '#c9302c');

  /* Gapura (entrance gate) */
  for (const x of [-3.7, 3.7]) {
    for (let y = 0; y < 4.6; y += 0.5)
      B(x - 0.4, x + 0.4, y, Math.min(4.6, y + 0.5), 57.1, 57.9, Math.round(y / 0.5) % 2 ? '#f4f1ea' : '#d8392a');
    addCol(x - 0.4, x + 0.4, 57.1, 57.9);
  }
  B(-4.3, 4.3, 4.0, 4.65, 57.2, 57.8, '#f4f1ea');
  cones.add(mat(-3.7, 4.95, 57.5, 0.35, 0.6, 0.35), '#d9b24a');
  cones.add(mat(3.7, 4.95, 57.5, 0.35, 0.6, 0.35), '#d9b24a');

  /* Kebun warga */
  for (let i = 0; i < 4; i++) {
    const z = -50.6 + i * 1.85;
    B(40.5, 57, 0, 0.32, z, z + 1.05, '#6e4a2f', { col: true });
    for (let x = 41; x < 56.6; x += 0.72) {
      blob(x, 0.55, z + 0.52, rand(0.22, 0.32), pick(['#4f8a3a', '#5e9c42', '#6aa84f']), 1.2);
      if (R() < 0.35) blob(x + 0.1, 0.66, z + 0.4, 0.07, '#d8261f');
    }
  }
  C(39.8, -44.4, 0, 0.9, 0.36, '#2f6fb3', { col: true });
  C(40.6, -44.2, 0, 0.6, 0.26, '#e2712b');
  for (let x = 39.2; x <= 58.4; x += 1.6) {
    if (x > 40.8 && x < 42.5) continue;
    B(x - 0.05, x + 0.05, 0, 1.1, -51.95, -51.85, '#b89a62');
  }
  B(42.5, 58.4, 0.75, 0.82, -51.95, -51.87, '#b89a62');
  B(39.2, 40.8, 0.75, 0.82, -51.95, -51.87, '#b89a62');
  B(21, 24, -0.1, 0.1, -55.45, -55.2, '#8a6a4a');
}
