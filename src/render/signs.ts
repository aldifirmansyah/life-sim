/* Canvas-textured signboards. Drawn after the web fonts load. */
import * as THREE from 'three';
import { scene } from './context';
import { tex } from './textures';
import { glowMats } from './lighting';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface SignSpec {
  text: string;
  sub?: string;
  w: number;
  h: number;
  bg: string;
  fg: string;
  subfg?: string;
  border: string;
  font?: 'display' | 'ui';
}

/** Draws one sign into a cw × ch area of the atlas at (0, 0) of `g`. */
function drawSign(g: CanvasRenderingContext2D, cw: number, ch: number, o: SignSpec) {
  const { text, sub, bg, fg, subfg, border, font = 'display' } = o;
  g.fillStyle = bg;
  g.fillRect(0, 0, cw, ch);
  g.strokeStyle = border;
  g.lineWidth = Math.max(8, ch * 0.06);
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = fg;
  let fs = sub ? ch * 0.5 : ch * 0.6;
  const setF = () =>
    (g.font = font === 'display' ? `${fs}px Shrikhand, Georgia, serif` : `800 ${fs}px Figtree, sans-serif`);
  setF();
  while (g.measureText(text).width > cw * 0.88 && fs > 12) {
    fs -= 2;
    setF();
  }
  g.fillText(text, cw / 2, sub ? ch * 0.41 : ch * 0.53);
  if (sub) {
    let s = ch * 0.19;
    g.font = `700 ${s}px Figtree, sans-serif`;
    while (g.measureText(sub).width > cw * 0.86 && s > 8) {
      s -= 1;
      g.font = `700 ${s}px Figtree, sans-serif`;
    }
    g.fillStyle = subfg || fg;
    g.fillText(sub, cw / 2, ch * 0.8);
  }
  g.globalAlpha = 0.07;
  for (let i = 0; i < 90; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
    g.fillRect(Math.random() * cw, Math.random() * ch, Math.random() * 30, Math.random() * 6);
  }
  g.globalAlpha = 1;
}

/* Every sign goes into one atlas texture and two merged meshes (plain, and the ones that glow at
   night), so the whole kampung's signboards cost two draw calls. */
interface Placed {
  o: SignSpec;
  at: [number, number, number, number];
  glow: boolean;
  both: boolean;
}
let queue: Placed[] = [];
export function sign(o: SignSpec, x: number, y: number, z: number, ry: number, { glow = false, both = false } = {}) {
  queue.push({ o, at: [x, y, z, ry], glow, both });
}

const AW = 2048,
  PAD = 8,
  MAXH = 4096;
function buildAtlas() {
  // Shelf packing in columns: two columns (1016 px signs) when they fit in 4096 px of height, otherwise
  // four or eight narrower ones. A sign is as tall as its aspect needs.
  let cols = 2,
    CW = 0,
    AH = 0;
  let cells: { q: Placed; h: number; x: number; y: number }[] = [];
  for (; cols <= 8; cols *= 2) {
    CW = AW / cols - PAD * 2;
    cells = queue.map(q => ({ q, h: Math.max(Math.round(CW * 0.12), Math.round((CW * q.o.h) / q.o.w)), x: 0, y: 0 }));
    const colY = new Array(cols).fill(0);
    for (const c of cells) {
      let k = 0;
      for (let i = 1; i < cols; i++) if (colY[i] < colY[k]) k = i;
      c.x = k * (CW + PAD * 2) + PAD;
      c.y = colY[k] + PAD;
      colY[k] += c.h + PAD * 2;
    }
    AH = Math.max(...colY);
    if (AH <= MAXH) break;
  }
  const t = tex(
    AW,
    Math.min(AH, MAXH),
    g => {
      for (const c of cells) {
        // The border colour runs into the padding, so mipmaps don't bleed a neighbour in.
        g.fillStyle = c.q.o.border;
        g.fillRect(c.x - PAD, c.y - PAD, CW + PAD * 2, c.h + PAD * 2);
        g.save();
        g.translate(c.x, c.y);
        drawSign(g, CW, c.h, c.q.o);
        g.restore();
      }
    },
    false,
  );
  const geos: Record<'plain' | 'glow', THREE.BufferGeometry[]> = { plain: [], glow: [] };
  const m4 = new THREE.Matrix4(),
    q4 = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0),
    one = new THREE.Vector3(1, 1, 1);
  for (const c of cells) {
    const { o, at, glow, both } = c.q;
    const u0 = c.x / AW,
      u1 = (c.x + CW) / AW,
      v1 = 1 - c.y / Math.min(AH, MAXH),
      v0 = 1 - (c.y + c.h) / Math.min(AH, MAXH);
    for (const r of both ? [at[3], at[3] + Math.PI] : [at[3]]) {
      const geo = new THREE.PlaneGeometry(o.w, o.h);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
      geo.applyMatrix4(m4.compose(new THREE.Vector3(at[0], at[1], at[2]), q4.setFromAxisAngle(up, r), one));
      geos[glow ? 'glow' : 'plain'].push(geo);
    }
  }
  for (const k of ['plain', 'glow'] as const) {
    if (!geos[k].length) continue;
    const m = new THREE.MeshLambertMaterial({ map: t });
    if (k === 'glow') {
      m.emissive = new THREE.Color(0xffffff);
      m.emissiveMap = t;
      m.emissiveIntensity = 0;
      glowMats.push(m);
    }
    const mesh = new THREE.Mesh(mergeGeometries(geos[k]), m);
    mesh.name = 'signs-' + k;
    scene.add(mesh);
    geos[k].forEach(g => g.dispose());
  }
  queue = [];
}

/** Build every queued sign into the atlas and the two merged meshes. Call once, after the fonts load and
    after everything that places signs (station names, shopfronts). */
export function buildSigns() {
  if (queue.length) buildAtlas();
}
