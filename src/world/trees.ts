import { hit, overlaps, type Rect4 } from '../core/collision';
import { R, rand, pick } from '../core/util';
import { mat, solid, crowns, C, blob } from '../render/batch';
import { XB, ZB, RES } from './layout';

export function mango(x: number, z: number, s = 1) {
  C(x, z, 0, 2.6 * s, 0.24 * s, '#6b4d33', { col: true });
  crowns.add(mat(x, 3.9 * s, z, 2.5 * s, 2.0 * s, 2.5 * s, R() * 6), pick(['#3f6e33', '#4a7a36', '#36622e']));
  crowns.add(
    mat(x + rand(-1, 1) * s, 4.8 * s, z + rand(-1, 1) * s, 1.6 * s, 1.4 * s, 1.6 * s, R() * 6),
    pick(['#4f8a3a', '#467f37']),
  );
}
export function banana(x: number, z: number) {
  C(x, z, 0, 2.1, 0.17, '#7f8f45', { col: true });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + R();
    const lx = Math.sin(a) * 0.8,
      lz = Math.cos(a) * 0.8;
    solid.add(
      mat(x + lx, 2.35, z + lz, 0.55, 0.03, 1.9, a, -0.55 + rand(-0.15, 0.15)),
      pick(['#86b64c', '#7aa843', '#95c057']),
    );
  }
}
export function coconut(x: number, z: number, h = 7) {
  const lean = rand(-0.12, 0.12);
  for (let i = 0; i < 5; i++) {
    const y0 = (i * h) / 5,
      y1 = ((i + 1) * h) / 5;
    C(x + lean * y0, z, y0, y1 + 0.05, 0.2 - 0.02 * i, '#8a7358');
  }
  const tx = x + lean * h;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + R() * 0.3;
    solid.add(
      mat(tx + Math.sin(a) * 1.3, h - 0.25, z + Math.cos(a) * 1.3, 0.45, 0.04, 2.9, a, 0.42),
      pick(['#5e8f3a', '#6fa044', '#557f36']),
    );
  }
  blob(tx, h - 0.1, z, 0.5, '#6f5a2e');
}
export function kamboja(x: number, z: number) {
  C(x, z, 0, 1.8, 0.14, '#8a7a66', { col: true });
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    crowns.add(mat(x + Math.sin(a) * 0.9, 2.3 + R() * 0.5, z + Math.cos(a) * 0.9, 0.8, 0.55, 0.8, R() * 6), '#5b8c45');
    for (let k = 0; k < 3; k++)
      blob(
        x + Math.sin(a) * 0.9 + rand(-0.5, 0.5),
        2.6 + R() * 0.4,
        z + Math.cos(a) * 0.9 + rand(-0.5, 0.5),
        0.13,
        '#fff6e8',
      );
  }
}

/** Fill the open space inside each block with a few trees. */
export function blockTrees() {
  for (const [x0, x1] of XB)
    for (const [z0, z1] of ZB) {
      for (let i = 0; i < 7; i++) {
        const x = rand(x0 + 1, x1 - 1),
          z = rand(z0 + 1, z1 - 1);
        const fp: Rect4 = [x - 1, x + 1, z - 1, z + 1];
        if (x - x0 < 3 || x1 - x < 3 || z - z0 < 3 || z1 - z < 3 || hit(x, z, 1.3) || RES.some(r => overlaps(fp, r)))
          continue;
        const t = R();
        if (t < 0.55) mango(x, z, rand(0.8, 1.15));
        else if (t < 0.85) banana(x, z);
        else coconut(x, z, rand(6, 8.5));
      }
    }
}
