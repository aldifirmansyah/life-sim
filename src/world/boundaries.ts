/* Kali (canal) and bridge, perimeter walls, north fence, sawah huts, neighbouring
   rooftops outside the walls, and the main road with the ruko row outside the gate. */
import { R, rand, pick } from '../core/util';
import { addCol } from '../core/collision';
import { mat, solid, roofs, crowns, lit, B } from '../render/batch';
import { WALLS, ROOFS } from './layout';
import { coconut } from './trees';

export function boundaries() {
  // canal
  B(-140, 140, -1.3, 0.12, -55.8, -55.5, '#aaa597');
  B(-140, 140, -1.3, 0.12, -60.3, -60, '#aaa597');
  B(-3.3, 3.3, -0.4, 0, -60.3, -55.5, '#bdb6a8');
  B(-3.35, -3.0, 0, 0.95, -60.4, -55.4, '#dcd6c8');
  B(3.0, 3.35, 0, 0.95, -60.4, -55.4, '#dcd6c8');
  addCol(-60, -3, -60.3, -55.5);
  addCol(3, 60, -60.3, -55.5);
  for (const [a, b] of [
    [-58.5, -3.4],
    [3.4, 58.5],
  ]) {
    B(a, b, 0.82, 0.88, -55.66, -55.56, '#3f8a6a');
    for (let x = a; x <= b; x += 2.4) B(x - 0.04, x + 0.04, 0, 0.88, -55.66, -55.56, '#3f8a6a');
  }
  // walls
  for (const s of [-1, 1]) B(s > 0 ? 59.2 : -59.8, s > 0 ? 59.8 : -59.2, 0, 2.6, -66.3, 60.5, '#bab4a6', { col: true });
  B(-59.8, -4.1, 0, 2.4, 60, 60.5, '#bab4a6', { col: true });
  B(4.1, 59.8, 0, 2.4, 60, 60.5, '#bab4a6', { col: true });
  addCol(-4.1, 4.1, 59.6, 60.6);
  // north fence
  for (let x = -59; x <= 59; x += 1.8) B(x - 0.05, x + 0.05, 0, 1.2, -66.2, -66.1, '#b89a62');
  B(-59.2, 59.2, 0.5, 0.56, -66.2, -66.12, '#b89a62');
  B(-59.2, 59.2, 1.0, 1.06, -66.2, -66.12, '#b89a62');
  addCol(-60, 60, -66.4, -66);
  for (const x of [-48, -36, -18, 15, 33, 52]) coconut(x + rand(-2, 2), -63 + rand(-1.5, 1.5), rand(6.5, 8.5));
  for (let i = 0; i < 8; i++) coconut(rand(-150, 150), rand(-150, -75), rand(6, 9));
  for (const [x, z] of [
    [-40, -95],
    [35, -120],
    [90, -88],
  ]) {
    B(x - 1.3, x + 1.3, 0.8, 0.95, z - 1, z + 1, '#b89a62');
    for (const [a, b] of [
      [-1.1, -0.8],
      [1.1, -0.8],
      [-1.1, 0.8],
      [1.1, 0.8],
    ])
      B(x + a - 0.05, x + a + 0.05, 0, 0.9, z + b - 0.05, z + b + 0.05, '#7a5a3a');
    roofs.add(mat(x, 2.0, z, 3, 1.1, 2.4), '#9a8a5a');
    B(x - 0.05, x + 0.05, 0.9, 2.0, z - 0.05, z + 0.05, '#7a5a3a');
  }
  // neighbours outside the east/west walls
  for (const s of [-1, 1])
    for (let cx = 64; cx < 104; cx += 8.5)
      for (let z = -50; z < 58;) {
        const w = rand(5, 7.5),
          d = rand(6, 7.5),
          two = R() < 0.35,
          H = two ? 5.8 : 3.2;
        const x = s * (cx + rand(-0.6, 0.6));
        solid.add(mat(x, H / 2, z + w / 2, d, H, w), pick(WALLS));
        roofs.add(mat(x, H, z + w / 2, w + 0.6, 1.3, d + 0.8, Math.PI / 2), pick(ROOFS));
        if (R() < 0.18) crowns.add(mat(x + rand(-3, 3), 5, z, 2.6, 2.2, 2.6), '#436f34');
        z += w + rand(0, 1.2);
      }
  // main road outside + ruko row
  for (let x = -110; x < 110; x += 4) B(x, x + 2, 0.03, 0.045, 66.9, 67.1, '#f1efe6');
  B(-120, 120, 0, 0.2, 74, 75.6, '#c9c3b6');
  for (let x = -110; x < 110;) {
    const w = rand(5, 8),
      H = rand(7, 11.5);
    const c = pick(['#e9e2d4', '#d6d9dc', '#f0d9b5', '#c8d6cf', '#e8c9bd']);
    solid.add(mat(x + w / 2, H / 2, 81, w - 0.1, H, 10), c);
    B(x + 0.2, x + w - 0.3, 3.2, 4.2, 75.95, 76.05, pick(['#d8392a', '#2f6fb3', '#e0a52a', '#3a9a73', '#f4f1ea']));
    B(x + 0.2, x + w - 0.3, 0, 2.9, 75.95, 76.02, '#ffd9a0', { b: lit });
    for (let y = 5.2; y < H - 1; y += 2.8) B(x + 0.6, x + w - 0.7, y, y + 1.3, 75.95, 76.02, '#ffe0ae', { b: lit });
    x += w;
  }
}
