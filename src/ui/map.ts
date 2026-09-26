/* The map (M): the whole island, its towns, the roads, the MRT and where Aldi is.
   Drawn to a canvas from the same data the world is built from. */
import { $ } from '../core/util';
import { player } from '../core/player';
import { ISLANDS, WATERS, TOWNS, BOUNDS, ZONE_POLYS } from '../city/geo';
import { allSegs } from '../city/roads';
import { LINES } from '../city/mrtdata';
import { ROUTES, poles } from '../city/buses';
import { drawRoute, drawPin, target, pin, setPin, clearPin } from './directions';

/** The last projection used, for turning a click back into the world. */
let view = { k: 1, ox: 0, oz: 0 };
/** Click on the map: drop a pin there (or clear it when clicking the pin). */
export function bindMapClicks() {
  const c = $<HTMLCanvasElement>('mapc');
  c.addEventListener('click', e => {
    const r = c.getBoundingClientRect();
    // The canvas keeps its aspect inside its box (object-fit: contain).
    const f = Math.min(r.width / c.width, r.height / c.height);
    const cx = (e.clientX - r.left - (r.width - c.width * f) / 2) / f,
      cz = (e.clientY - r.top - (r.height - c.height * f) / 2) / f;
    const x = BOUNDS.x0 + (cx - view.ox) / view.k,
      z = BOUNDS.z0 + (cz - view.oz) / view.k;
    if (pin && Math.hypot(pin.x - x, pin.z - z) * view.k < 14) clearPin();
    else setPin(x, z);
    drawMap();
  });
}

/** Extra layers other modules draw on the map (e.g. the Explore app's finds), before Aldi's arrow. */
export const mapLayers: ((g: CanvasRenderingContext2D, P: (x: number, z: number) => [number, number]) => void)[] = [];

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
  view = { k, ox, oz };
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
  fillPoly(ZONE_POLYS.catchment, '#bcd9a4');
  fillPoly(ZONE_POLYS.airport, '#e4e2da');
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
  // The bus routes, their stops and numbers.
  g.strokeStyle = BUS;
  g.lineWidth = 2;
  g.setLineDash([5, 3]);
  for (const [r] of ROUTES) {
    g.beginPath();
    r.pts.forEach(([x, z], i) => (i ? g.lineTo(...P(x, z)) : g.moveTo(...P(x, z))));
    g.stroke();
  }
  g.setLineDash([]);
  for (const p of poles) {
    const [x, z] = P(p.x, p.z);
    g.fillStyle = BUS;
    g.fillRect(x - 2.5, z - 2.5, 5, 5);
  }
  g.font = '800 10px Figtree, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [r] of ROUTES) {
    const [mx, mz] = r.pts[Math.floor(r.pts.length / 2)];
    const [x, z] = P(mx, mz);
    const w = g.measureText(r.no).width + 8;
    g.fillStyle = BUS;
    g.beginPath();
    g.roundRect(x - w / 2, z - 7, w, 14, 4);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillText(r.no, x, z + 0.5);
  }
  g.textBaseline = 'alphabetic';
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
  for (const layer of mapLayers) layer(g, P);
  // The way there and the target.
  drawRoute(g, P);
  if (target) drawPin(g, ...P(target.x, target.z));
  legend(g, W, H);
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

const BUS = '#138a8a';
/** The key, in the bottom-left corner. */
function legend(g: CanvasRenderingContext2D, W: number, H: number) {
  const rows: [string, (x: number, y: number) => void][] = [];
  const line = (col: string, w: number, dash?: number[]) => (x: number, y: number) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.setLineDash(dash ?? []);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 20, y);
    g.stroke();
    g.setLineDash([]);
  };
  const dot =
    (col: string, ring = '#ffffff', r = 3.5) =>
    (x: number, y: number) => {
      g.beginPath();
      g.arc(x + 10, y, r, 0, Math.PI * 2);
      g.fillStyle = col;
      g.fill();
      g.strokeStyle = ring;
      g.lineWidth = 1.5;
      g.stroke();
    };
  rows.push(['Expressway', line('#e8a54a', 3)]);
  rows.push(['Main road', line('#ffffff', 2)]);
  for (const l of LINES) rows.push([l.name, line(l.colour, 3)]);
  rows.push(['MRT station', dot('#ffffff', '#555048')]);
  rows.push([
    'Bus route and stop',
    (x, y) => (line(BUS, 2, [5, 3])(x, y), (g.fillStyle = BUS), g.fillRect(x + 7.5, y - 2.5, 5, 5)),
  ]);
  rows.push(['Park and forest', (x, y) => ((g.fillStyle = '#bcd9a4'), g.fillRect(x + 2, y - 5, 16, 10))]);
  rows.push(['Your way there', (x, y) => (line('#ffffff', 6)(x, y), line('#c2185b', 3.5)(x, y))]);
  rows.push(['Walk', line('#c2185b', 2.4, [4, 4])]);
  rows.push(['Destination', (x, y) => drawPin(g, x + 10, y + 6, 0.8)]);
  rows.push([
    'You',
    (x, y) => {
      g.save();
      g.translate(x + 10, y);
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(4, 4);
      g.lineTo(0, 2);
      g.lineTo(-4, 4);
      g.closePath();
      g.fillStyle = '#d6452f';
      g.fill();
      g.restore();
    },
  ]);
  rows.push([
    'Cat · mural · viewpoint · plaque',
    (x, y) => {
      ['#e07a1f', '#8e44ad', '#2f6fb3', '#6b4a2a'].forEach((c, i) => {
        g.beginPath();
        g.arc(x + 2 + i * 5.5, y, 2.6, 0, Math.PI * 2);
        g.fillStyle = c;
        g.fill();
      });
    },
  ]);
  const lh = 16,
    w = 206,
    h = rows.length * lh + 30;
  const x0 = W - w - 12,
    y0 = H - h - 12;
  g.fillStyle = 'rgba(33, 27, 21, 0.82)';
  g.beginPath();
  g.roundRect(x0, y0, w, h, 8);
  g.fill();
  g.fillStyle = '#f2b53c';
  g.font = '800 10px Figtree, sans-serif';
  g.textAlign = 'left';
  g.fillText('LEGEND', x0 + 10, y0 + 17);
  g.font = '600 11px Figtree, sans-serif';
  rows.forEach(([label, icon], i) => {
    const y = y0 + 32 + i * lh;
    icon(x0 + 10, y);
    g.fillStyle = '#f3ead8';
    g.textAlign = 'left';
    g.fillText(label, x0 + 38, y + 4);
  });
}
