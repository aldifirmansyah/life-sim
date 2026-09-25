/* The map (M): the whole island, its towns, the roads, the MRT and where Aldi is.
   Drawn to a canvas from the same data the world is built from. */
import { $ } from '../core/util';
import { player } from '../core/player';
import { ISLANDS, WATERS, TOWNS, BOUNDS } from '../city/geo';
import { allSegs } from '../city/roads';
import { LINES } from '../city/mrtdata';

export function drawMap() {
  const c = $<HTMLCanvasElement>('mapc');
  const g = c.getContext('2d')!;
  const W = c.width,
    H = c.height;
  const sx = W / (BOUNDS.x1 - BOUNDS.x0),
    sz = H / (BOUNDS.z1 - BOUNDS.z0);
  const k = Math.min(sx, sz);
  const ox = (W - (BOUNDS.x1 - BOUNDS.x0) * k) / 2,
    oz = (H - (BOUNDS.z1 - BOUNDS.z0) * k) / 2;
  const P = (x: number, z: number): [number, number] => [ox + (x - BOUNDS.x0) * k, oz + (z - BOUNDS.z0) * k];
  g.fillStyle = '#9cc7d6';
  g.fillRect(0, 0, W, H);
  const fillPoly = (pts: [number, number][], col: string) => {
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(...P(x, z)) : g.moveTo(...P(x, z))));
    g.closePath();
    g.fillStyle = col;
    g.fill();
  };
  for (const pts of Object.values(ISLANDS)) fillPoly(pts, '#dfe8cf');
  for (const pts of Object.values(WATERS)) fillPoly(pts, '#9cc7d6');
  // Towns as soft discs.
  for (const t of TOWNS) {
    const [x, z] = P(t.x, t.z);
    g.beginPath();
    g.arc(x, z, t.r * k, 0, Math.PI * 2);
    g.fillStyle = t.kind === 'park' || t.kind === 'resort' || t.kind === 'kampung' ? '#bcd9a4' : '#eadfcb';
    g.fill();
  }
  // Roads.
  g.lineCap = 'round';
  for (const s of allSegs) {
    if (s.road.kind === 'street') continue;
    g.strokeStyle = s.road.kind === 'expressway' ? '#e8a54a' : '#ffffff';
    g.lineWidth = s.road.kind === 'expressway' ? 2.2 : 1.4;
    g.beginPath();
    g.moveTo(...P(s.ax, s.az));
    g.lineTo(...P(s.bx, s.bz));
    g.stroke();
  }
  // The MRT.
  for (const l of LINES) {
    g.strokeStyle = l.colour;
    g.lineWidth = 3;
    g.beginPath();
    l.pts.forEach(([x, z], i) => (i ? g.lineTo(...P(x, z)) : g.moveTo(...P(x, z))));
    g.stroke();
    for (const st of l.stations) {
      const [x, z] = P(st.x, st.z);
      g.beginPath();
      g.arc(x, z, 3, 0, Math.PI * 2);
      g.fillStyle = '#ffffff';
      g.fill();
      g.strokeStyle = l.colour;
      g.lineWidth = 1.5;
      g.stroke();
    }
  }
  // Town names.
  g.font = '600 11px Figtree, sans-serif';
  g.textAlign = 'center';
  for (const t of TOWNS) {
    const [x, z] = P(t.x, t.z);
    g.fillStyle = '#3b3a36';
    g.fillText(t.name, x, z - t.r * k - 3);
  }
  // Aldi.
  const [x, z] = P(player.x, player.z);
  g.save();
  g.translate(x, z);
  g.rotate(-player.yaw);
  g.beginPath();
  g.moveTo(0, -9);
  g.lineTo(6, 6);
  g.lineTo(0, 3);
  g.lineTo(-6, 6);
  g.closePath();
  g.fillStyle = '#d6452f';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  g.fill();
  g.stroke();
  g.restore();
}
