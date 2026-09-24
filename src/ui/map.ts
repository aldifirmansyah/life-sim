/* Top-down map of the kampung (M). */
import { $ } from '../core/util';
import { player } from '../core/player';
import { GZ, GX, GH, GZN, GXN, XB, ZB, RESERVED, LANDMARKS, houseRects } from '../world/layout';

export function drawMap() {
  const cv = $<HTMLCanvasElement>('mapc');
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round(r.height * dpr);
  const g = cv.getContext('2d')!;
  const X0 = -62,
    X1 = 62,
    Z0 = -70,
    Z1 = 62;
  const s = Math.min(cv.width / (X1 - X0), cv.height / (Z1 - Z0));
  const ox = (cv.width - (X1 - X0) * s) / 2,
    oy = (cv.height - (Z1 - Z0) * s) / 2;
  const P = (x: number, z: number): [number, number] => [ox + (x - X0) * s, oy + (z - Z0) * s];
  const rect = (x0: number, x1: number, z0: number, z1: number, c: string) => {
    const a = P(x0, z0),
      b = P(x1, z1);
    g.fillStyle = c;
    g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  };
  g.fillStyle = '#e7dec8';
  g.fillRect(0, 0, cv.width, cv.height);
  rect(X0, X1, Z0, -66, '#9cc070');
  rect(X0, X1, -66, -60.3, '#b5c48c');
  rect(-60, 60, -60.3, -55.5, '#6fa9b6');
  for (const [x0, x1] of XB) for (const [z0, z1] of ZB) rect(x0, x1, z0, z1, '#d8ceb6');
  rect(...RESERVED.lapangan, '#b9c07a');
  for (const z of GZ) {
    rect(-58.5, 58.5, z - GH, z + GH, '#bdb3a1');
  }
  for (const x of GX) {
    rect(x - GH, x + GH, -52, 58.5, '#bdb3a1');
  }
  rect(-58.5, 58.5, -55.5, -52, '#bdb3a1');
  rect(-3, 3, -60.3, 60, '#9f998e');
  for (const h of houseRects) {
    rect(h.r[0], h.r[1], h.r[2], h.r[3], h.c);
  }
  for (const [n, rc] of LANDMARKS) {
    if (n === 'Lapangan') continue;
    const a = P(rc[0], rc[2]),
      b = P(rc[1], rc[3]);
    g.fillStyle = 'rgba(47,179,161,.9)';
    g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  }
  g.fillStyle = '#8a847a';
  g.fillRect(...P(-59.8, -66.3), 0.6 * s, 126.8 * s);
  g.fillRect(...P(59.2, -66.3), 0.6 * s, 126.8 * s);
  const label = (t: string, x: number, z: number, sz = 11, rot = 0, col = '#221a12') => {
    const [a, b] = P(x, z);
    g.save();
    g.translate(a, b);
    g.rotate(rot);
    g.font = `700 ${sz * dpr}px Figtree, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3.5 * dpr;
    g.strokeStyle = 'rgba(245,238,222,.92)';
    g.strokeText(t, 0, 0);
    g.fillStyle = col;
    g.fillText(t, 0, 0);
    g.restore();
  };
  GZ.forEach((z, i) => {
    label(GZN[i], -44, z, 10, 0, '#5a5044');
    label(GZN[i], 44, z, 10, 0, '#5a5044');
  });
  GX.forEach((x, i) => label(GXN[i], x, 24, 10, -Math.PI / 2, '#5a5044'));
  label('Jalan Sukamaju', 0, -24, 10, -Math.PI / 2, '#3a3228');
  label('Kali', -30, -57.9, 11, 0, '#1f4a55');
  label('Sawah', 0, -68, 11, 0, '#2f5a1f');
  for (const [n, rc] of LANDMARKS) label(n, (rc[0] + rc[1]) / 2, (rc[2] + rc[3]) / 2, 12);
  const [px, pz] = P(player.x, player.z);
  g.save();
  g.translate(px, pz);
  g.rotate(-player.yaw);
  g.fillStyle = '#d8392a';
  g.strokeStyle = '#fff';
  g.lineWidth = 2 * dpr;
  g.beginPath();
  g.moveTo(0, -11 * dpr);
  g.lineTo(7 * dpr, 8 * dpr);
  g.lineTo(0, 4 * dpr);
  g.lineTo(-7 * dpr, 8 * dpr);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}
