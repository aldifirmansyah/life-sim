/* Canvas-textured signboards. Drawn after the web fonts load. */
import * as THREE from 'three';
import { scene } from './context';
import { tex } from './textures';
import { glowMats } from './lighting';
import { GZ, GX, GZN, GXN } from '../world/layout';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface SignSpec {
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
function sign(o: SignSpec, x: number, y: number, z: number, ry: number, { glow = false, both = false } = {}) {
  queue.push({ o, at: [x, y, z, ry], glow, both });
}

const AW = 2048,
  CW = 1016,
  PAD = 8;
function buildAtlas() {
  // Shelf packing in two columns; a sign is 1016 px wide, as tall as its aspect needs.
  const cells = queue.map(q => ({ q, h: Math.max(120, Math.round((CW * q.o.h) / q.o.w)), x: 0, y: 0 }));
  const colY = [0, 0];
  for (const c of cells) {
    const k = colY[0] <= colY[1] ? 0 : 1;
    c.x = k * (CW + PAD * 2) + PAD;
    c.y = colY[k] + PAD;
    colY[k] += c.h + PAD * 2;
  }
  const AH = Math.max(colY[0], colY[1]);
  const t = tex(
    AW,
    AH,
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
      v1 = 1 - c.y / AH,
      v0 = 1 - (c.y + c.h) / AH;
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

export function signs() {
  sign(
    {
      text: 'Warung Bu Sri',
      sub: 'SEMBAKO · JAJANAN · GAS · PULSA',
      w: 5,
      h: 0.8,
      bg: '#fbe7a1',
      fg: '#c7301f',
      subfg: '#1f5f8a',
      border: '#1f5f8a',
    },
    8.4,
    3.0,
    -4.86,
    Math.PI,
    { glow: true },
  );
  sign(
    { text: 'Warung Bu Sri', w: 3.2, h: 0.6, bg: '#fbe7a1', fg: '#c7301f', border: '#1f5f8a' },
    5.47,
    3.0,
    -2.65,
    -Math.PI / 2,
    { glow: true },
  );
  sign(
    {
      text: 'Warkop Berkah',
      sub: 'KOPI · MIE REBUS · GORENGAN',
      w: 4.2,
      h: 0.72,
      bg: '#241b14',
      fg: '#f2b53c',
      subfg: '#f4ecdc',
      border: '#f2b53c',
    },
    -7.3,
    2.4,
    17.28,
    Math.PI,
    { glow: true },
  );
  sign(
    {
      text: 'Musholla Al-Ikhlas',
      sub: 'RT 04 / RW 07',
      w: 5.2,
      h: 0.8,
      bg: '#2e8b57',
      fg: '#fdfbf3',
      subfg: '#e9d58a',
      border: '#e9d58a',
    },
    4.93,
    3.3,
    -17,
    -Math.PI / 2,
    { glow: true },
  );
  sign(
    {
      text: 'Balai Warga',
      sub: 'RW 07 · KAMPUNG SUKAMAJU',
      w: 5.6,
      h: 0.8,
      bg: '#f4ecd8',
      fg: '#8e2b1f',
      subfg: '#3b3226',
      border: '#8e2b1f',
    },
    -13,
    3.21,
    -30.48,
    Math.PI,
  );
  sign(
    {
      text: 'Pos Ronda',
      sub: 'RT 04 · SIAGA 24 JAM',
      w: 2.4,
      h: 0.62,
      bg: '#d8392a',
      fg: '#fff7e8',
      border: '#fff7e8',
    },
    -3.78,
    2.2,
    41.1,
    Math.PI / 2,
  );
  sign(
    { text: 'Bakso Mas Joko', w: 1.5, h: 0.38, bg: '#f4f1ea', fg: '#c7301f', border: '#2f6fb3' },
    -5.28,
    1.56,
    43.85,
    Math.PI / 2,
  );
  sign(
    {
      text: 'Pangkalan Ojek',
      sub: 'ANTAR JEMPUT · RT 04',
      w: 3.6,
      h: 0.62,
      bg: '#f2b53c',
      fg: '#2a1c05',
      border: '#2a1c05',
    },
    3.25,
    2.98,
    54.1,
    -Math.PI / 2,
  );
  sign(
    {
      text: 'Selamat Datang',
      sub: 'KAMPUNG SUKAMAJU · RT 04 / RW 07',
      w: 7.8,
      h: 0.62,
      bg: '#f4f1ea',
      fg: '#c7301f',
      subfg: '#2a2a2a',
      border: '#c7301f',
    },
    0,
    4.33,
    57.82,
    0,
  );
  sign(
    {
      text: 'Hati-hati di Jalan',
      sub: 'TERIMA KASIH ATAS KUNJUNGAN ANDA',
      w: 7.8,
      h: 0.62,
      bg: '#f4f1ea',
      fg: '#c7301f',
      subfg: '#2a2a2a',
      border: '#c7301f',
    },
    0,
    4.33,
    57.18,
    Math.PI,
  );
  sign(
    {
      text: 'Kebun Warga',
      sub: 'TANAM · RAWAT · PETIK',
      w: 2.6,
      h: 0.55,
      bg: '#3a7a3a',
      fg: '#fdfbf3',
      border: '#e9d58a',
    },
    41.6,
    1.35,
    -51.98,
    Math.PI,
    { both: true },
  );
  GZ.forEach((g, i) => {
    const t = {
      text: 'GG. ' + GZN[i].slice(5).toUpperCase(),
      w: 1.4,
      h: 0.34,
      bg: '#1d6e46',
      fg: '#ffffff',
      border: '#ffffff',
      font: 'ui',
    } as const;
    sign(t, -3.35, 2.7, g - 1.5, 0, { both: true });
    sign(t, 3.35, 2.7, g + 1.5, 0, { both: true });
  });
  GX.forEach((g, i) =>
    sign(
      {
        text: 'GG. ' + GXN[i].slice(5).toUpperCase(),
        w: 1.4,
        h: 0.34,
        bg: '#1d6e46',
        fg: '#ffffff',
        border: '#ffffff',
        font: 'ui',
      },
      g - 1.55,
      2.7,
      -51.7,
      Math.PI / 2,
      { both: true },
    ),
  );
  buildAtlas();
}
