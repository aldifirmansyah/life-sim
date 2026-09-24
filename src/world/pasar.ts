/* Pasar pagi: vegetable stalls along Jalan Sukamaju, shown only in the morning. */
import { R, rand, pick } from '../core/util';
import { addCol, type Collider } from '../core/collision';
import { mat, pSolid, pCone, pBlob, pCyl } from '../render/batch';

export const pasarCols: Collider[] = [];
export function pasarPagi() {
  const VEG = ['#d8261f', '#f28c28', '#58b368', '#6b3fa0', '#f2d24e', '#3f7a3a', '#e8e0cc', '#c0392b'];
  for (const z of [22.5, 26.5, 34, 37, 43.5, 47, 53.5])
    for (const s of [-1, 1]) {
      if (s > 0 && z > 50) continue;
      if (R() < 0.18) continue;
      const x0 = s < 0 ? -2.95 : 1.55,
        x1 = s < 0 ? -1.55 : 2.95;
      const xc = (x0 + x1) / 2;
      pSolid.add(mat(xc, 0.4, z, x1 - x0, 0.8, 1.9), '#8a6a4a');
      pSolid.add(mat(xc, 0.82, z, x1 - x0 + 0.05, 0.04, 1.95), pick(['#3b7dd8', '#e24a3b', '#f2c14e', '#3a9a73']));
      for (let k = 0; k < 6; k++) {
        const c = pick(VEG);
        for (let j = 0; j < 3; j++)
          pBlob.add(
            mat(
              xc + rand(-0.45, 0.45),
              0.95 + R() * 0.08,
              z - 0.75 + k * 0.3 + rand(-0.08, 0.08),
              0.11,
              0.1,
              0.11,
              R() * 6,
            ),
            c,
          );
      }
      pCyl.add(mat(xc + s * 0.35, 1.4, z + 0.8, 0.03, 1.2, 0.03), '#777');
      pCone.add(mat(xc, 2.25, z, 1.35, 0.55, 1.35, R()), pick(['#2d7fc1', '#e24a3b', '#f2a33a', '#3a9a73', '#8e44ad']));
      pCyl.add(mat(xc - s * 0.9, 0.2, z - 0.5, 0.26, 0.4, 0.26), '#a07a45');
      pasarCols.push(addCol(x0, x1, z - 0.95, z + 0.95, 'pasar'));
    }
}
