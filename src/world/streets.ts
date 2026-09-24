/* Street furniture: lamps (with their night light pools), overhead cables and bunting,
   gang drains and gang-sign poles. */
import * as THREE from 'three';
import { R, rand } from '../core/util';
import { scene } from '../render/context';
import { mat, bulbs, flags, B, C } from '../render/batch';
import { GZ, GX, GH, houseTops } from './layout';

type P3 = [number, number, number];
/** Cable line-segment vertices, and one light-pool transform per lamp. */
export const cableSegs: number[] = [];
export const poolBatch: { m: THREE.Matrix4[] } = { m: [] };
/** Street lamp at (x, z) with its arm pointing along (ax, az). Returns the cable anchor. */
function lamp(x: number, z: number, ax: number, az: number): P3 {
  C(x, z, 0, 5.4, 0.07, '#6d7378', { col: true });
  const bx = x + ax * 0.95,
    bz = z + az * 0.95;
  B(
    Math.min(x, bx) - 0.03,
    Math.max(x, bx) + 0.03,
    5.2,
    5.26,
    Math.min(z, bz) - 0.03,
    Math.max(z, bz) + 0.03,
    '#6d7378',
  );
  bulbs.add(mat(bx, 5.1, bz, 0.16, 0.12, 0.16), '#fff2cc');
  poolBatch.m.push(mat(bx, 0.055, bz, 11, 1, 11).clone());
  return [x, 5.35, z];
}
function sagLine(a: P3, b: P3, sag: number, n = 6) {
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p: P3 = [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag,
      a[2] + (b[2] - a[2]) * t,
    ];
    cableSegs.push(...prev, ...p);
    prev = p;
  }
}
function bunting(a: P3, b: P3, sag: number, ry: number) {
  sagLine(a, b, sag, 8);
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = Math.floor(L / 0.38);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    flags.add(
      mat(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag,
        a[2] + (b[2] - a[2]) * t,
        1,
        1,
        1,
        ry + rand(-0.2, 0.2),
      ),
      i % 2 ? '#f4f1ea' : '#d62d20',
    );
  }
}

export function streets() {
  const jal: P3[] = [];
  for (let z = -50, i = 0; z <= 52; z += 10, i++) {
    const s = i % 2 ? 1 : -1;
    jal.push(lamp(s * 2.8, z, -s, 0));
  }
  for (let i = 0; i < jal.length - 1; i++) sagLine(jal[i], jal[i + 1], 0.55);
  for (const p of jal) {
    const near = houseTops.filter(h => Math.hypot(h[0] - p[0], h[1] - p[2]) < 11);
    for (let k = 0; k < 2 && near.length; k++) {
      const h = near.splice(Math.floor(R() * near.length), 1)[0];
      sagLine(p, [h[0], h[2] - 0.3, h[1]], 0.35, 4);
    }
  }
  for (const g of GZ) {
    const row: P3[] = [];
    for (const x of [-52, -42, -20, -10, 10, 20, 42, 52]) row.push(lamp(x, g + 0.95, 0, -1));
    for (let i = 0; i < row.length - 1; i++)
      if (Math.sign(row[i][0]) === Math.sign(row[i + 1][0])) sagLine(row[i], row[i + 1], 0.5);
  }
  for (const g of GX) {
    const row: P3[] = [];
    for (const z of [-45, -20, 4, 27, 48]) row.push(lamp(g + 0.95, z, -1, 0));
    for (let i = 0; i < row.length - 1; i++) sagLine(row[i], row[i + 1], 0.5);
  }
  for (const x of [-45, -25, -12, 12, 25, 45]) lamp(x, -53.1, 0, -1);
  for (let z = -46; z <= 52; z += 8) bunting([-3.1, 4.5, z], [3.1, 4.5, z], 0.35, 0);
  for (const g of GZ)
    for (let x = -54; x <= 54; x += 12) {
      if (Math.abs(x) < 6 || Math.abs(Math.abs(x) - 30) < 3) continue;
      bunting([x, 3.7, g - 1.25], [x, 3.7, g + 1.25], 0.18, Math.PI / 2);
    }
  for (const g of GX) for (let z = -46; z <= 54; z += 12) bunting([g - 1.25, 3.7, z], [g + 1.25, 3.7, z], 0.18, 0);
  // drains along gangs
  for (const g of GZ) {
    for (const e of [-1, 1]) {
      B(-58.5, -3, 0.0, 0.035, g + e * GH - (e > 0 ? 0.32 : 0), g + e * GH + (e < 0 ? 0.32 : 0), '#4b4a44');
      B(3, 58.5, 0, 0.035, g + e * GH - (e > 0 ? 0.32 : 0), g + e * GH + (e < 0 ? 0.32 : 0), '#4b4a44');
    }
  }
  // gang name signs as poles (signs added later)
  for (const g of GZ) {
    C(-3.35, g - 1.5, 0, 2.9, 0.04, '#5a5f63', { col: true });
    C(3.35, g + 1.5, 0, 2.9, 0.04, '#5a5f63', { col: true });
  }
  for (const g of GX) {
    C(g - 1.55, -51.7, 0, 2.9, 0.04, '#5a5f63', { col: true });
  }
}

export function buildCables() {
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(cableSegs, 3));
  scene.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x2a2a2c })));
}
