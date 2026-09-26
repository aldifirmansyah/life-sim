/* The minimap: a close-up of the streets around Aldi in the corner, north up.
   The buildings (from the generator's chunks), every road with its width, the
   MRT and its stations, the bus routes and their stops, the planned route and
   the target (or an arrow at the edge pointing to it). N shows or hides it;
   − and = zoom out and in. Redrawn eight times a second. */
import { $ } from '../core/util';
import { S, inWorld } from '../core/state';
import { player } from '../core/player';
import { ISLANDS, WATERS, ZONE_POLYS } from '../city/geo';
import { segsNear } from '../city/roads';
import { LINES } from '../city/mrtdata';
import { getChunk, CHUNK } from '../city/gen';
import { ROUTES, poles } from '../city/buses';
import { drawRoute, drawPin, target } from './directions';

const RADII = [70, 130, 240];
let zoom = 1;
let shown = true;
try {
  const v = JSON.parse(localStorage.getItem('sg-minimap') ?? 'null');
  if (v) ({ zoom, shown } = { zoom: v.zoom ?? 1, shown: v.shown ?? true });
} catch {
  /* ignore */
}
function store() {
  try {
    localStorage.setItem('sg-minimap', JSON.stringify({ zoom, shown }));
  } catch {
    /* ignore */
  }
}
export function initMinimap() {
  addEventListener('keydown', e => {
    if (!inWorld() || e.repeat) return;
    if (e.code === 'KeyN') shown = !shown;
    else if (e.code === 'Minus') zoom = Math.min(RADII.length - 1, zoom + 1);
    else if (e.code === 'Equal') zoom = Math.max(0, zoom - 1);
    else return;
    acc = 1;
    store();
  });
}

let acc = 1;
export function updateMinimap(dt: number) {
  const c = $<HTMLCanvasElement>('mini');
  const box = $('minimap');
  const on = S.started && shown && !S.map;
  box.hidden = !on;
  if (!on) return;
  acc += dt;
  if (acc < 0.125) return;
  acc = 0;
  const css = c.clientWidth || 190;
  const dpr = Math.min(1.5, devicePixelRatio || 1);
  if (c.width !== Math.round(css * dpr)) c.width = c.height = Math.round(css * dpr);
  const g = c.getContext('2d')!;
  const W = c.width;
  const R = RADII[zoom];
  const k = W / 2 / R;
  const px = dpr;
  const cx = W / 2,
    px0 = player.x,
    pz0 = player.z;
  const P = (x: number, z: number): [number, number] => [cx + (x - px0) * k, cx + (z - pz0) * k];
  g.save();
  g.beginPath();
  g.arc(cx, cx, W / 2, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#9cc7d6';
  g.fillRect(0, 0, W, W);
  const poly = (pts: [number, number][], col: string) => {
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(...P(x, z)) : g.moveTo(...P(x, z))));
    g.closePath();
    g.fillStyle = col;
    g.fill();
  };
  for (const pts of Object.values(ISLANDS)) poly(pts, '#ece6d6');
  poly(ZONE_POLYS.catchment, '#bcd9a4');
  poly(ZONE_POLYS.airport, '#e2e0d8');
  for (const pts of Object.values(WATERS)) poly(pts, '#9cc7d6');
  // Buildings from the chunks around.
  const x0 = Math.floor((px0 - R) / CHUNK),
    x1 = Math.floor((px0 + R) / CHUNK),
    z0 = Math.floor((pz0 - R) / CHUNK),
    z1 = Math.floor((pz0 + R) / CHUNK);
  g.fillStyle = '#cfc6b3';
  for (let ix = x0; ix <= x1; ix++)
    for (let iz = z0; iz <= z1; iz++) {
      const ch = getChunk(ix, iz);
      if (!ch) continue;
      for (const it of ch.items) {
        if ((it.p !== 'bldg' && it.p !== 'solid') || it.sy < 2.5 || it.sx * it.sz < 14 || it.y - it.sy / 2 > 3)
          continue;
        if (Math.abs(it.x - px0) > R + 30 || Math.abs(it.z - pz0) > R + 30) continue;
        const [sx, sz] = P(it.x, it.z);
        g.save();
        g.translate(sx, sz);
        g.rotate(-it.ry);
        g.fillRect((-it.sx / 2) * k, (-it.sz / 2) * k, it.sx * k, it.sz * k);
        g.restore();
      }
    }
  // Roads: a casing, then the surface.
  const segs = new Set(segsNear(px0, pz0, R + 20));
  g.lineCap = 'round';
  for (const pass of [0, 1])
    for (const s of segs) {
      g.strokeStyle = pass ? (s.road.kind === 'expressway' ? '#f6cf85' : '#ffffff') : '#b9b2a2';
      g.lineWidth = Math.max(2 * px, s.w * k) + (pass ? 0 : 2 * px);
      g.beginPath();
      g.moveTo(...P(s.ax, s.az));
      g.lineTo(...P(s.bx, s.bz));
      g.stroke();
    }
  // Bus routes and their stops.
  g.strokeStyle = 'rgba(19, 138, 138, 0.8)';
  g.lineWidth = 2 * px;
  g.setLineDash([6 * px, 4 * px]);
  for (const [r] of ROUTES) {
    g.beginPath();
    r.pts.forEach(([x, z], i) => (i ? g.lineTo(...P(x, z)) : g.moveTo(...P(x, z))));
    g.stroke();
  }
  g.setLineDash([]);
  g.font = `700 ${9 * px}px Figtree, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const p of poles) {
    if (Math.abs(p.x - px0) > R + 10 || Math.abs(p.z - pz0) > R + 10) continue;
    const [x, z] = P(p.x, p.z);
    g.fillStyle = '#138a8a';
    g.fillRect(x - 9 * px, z - 6 * px, 18 * px, 12 * px);
    g.fillStyle = '#ffffff';
    g.fillText(p.r.no, x, z + 0.5 * px);
  }
  // The MRT.
  for (const l of LINES) {
    g.strokeStyle = l.colour;
    g.lineWidth = 4 * px;
    g.beginPath();
    l.pts.forEach(([x, z], i) => (i ? g.lineTo(...P(x, z)) : g.moveTo(...P(x, z))));
    g.stroke();
    for (const st of l.stations) {
      if (Math.abs(st.x - px0) > R + 60 || Math.abs(st.z - pz0) > R + 60) continue;
      const [x, z] = P(st.x, st.z);
      g.fillStyle = '#ffffff';
      g.strokeStyle = l.colour;
      g.lineWidth = 2 * px;
      g.beginPath();
      g.arc(x, z, 5 * px, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#2a2622';
      g.font = `700 ${10 * px}px Figtree, sans-serif`;
      g.fillText(st.name, x, z - 11 * px);
    }
  }
  drawRoute(g, P, px);
  g.restore();
  // The target beyond the edge: an arrow on the rim pointing its way.
  if (target) {
    const dx = target.x - px0,
      dz = target.z - pz0;
    const d = Math.hypot(dx, dz);
    if (d > R * 0.92) {
      const a = Math.atan2(dz, dx);
      const rr = W / 2 - 10 * px;
      const x = cx + Math.cos(a) * rr,
        z = cx + Math.sin(a) * rr;
      g.save();
      g.translate(x, z);
      g.rotate(a);
      g.beginPath();
      g.moveTo(8 * px, 0);
      g.lineTo(-5 * px, -6 * px);
      g.lineTo(-5 * px, 6 * px);
      g.closePath();
      g.fillStyle = '#f2b53c';
      g.strokeStyle = '#2a1f16';
      g.lineWidth = 1.5 * px;
      g.fill();
      g.stroke();
      g.restore();
    } else drawPin(g, ...P(target.x, target.z), px);
  }
  // Aldi.
  g.save();
  g.translate(cx, cx);
  g.rotate(-player.yaw);
  g.beginPath();
  g.moveTo(0, -9 * px);
  g.lineTo(6 * px, 6 * px);
  g.lineTo(0, 3 * px);
  g.lineTo(-6 * px, 6 * px);
  g.closePath();
  g.fillStyle = '#d6452f';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2 * px;
  g.fill();
  g.stroke();
  g.restore();
  $('minizoom').textContent = `${R * 2} m`;
}
