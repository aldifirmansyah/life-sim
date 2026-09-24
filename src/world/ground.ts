/* Ground surfaces: grass, the concrete jalan, paved gangs, asphalt, sawah, canal
   water, the lapangan, and the additive light pools under street lamps. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { tex, noise } from '../render/textures';
import type { Rect4 } from '../core/collision';
import { GZ, GX, GH, ZB } from './layout';
import { poolBatch } from './streets';

/** Flat horizontal quads [x0, x1, z0, z1] at height y, with world-space UVs tiled every tu × tv metres. */
function quads(rects: Rect4[], y: number, tu: number, tv: number, material: THREE.Material, { recv = true } = {}) {
  const pos: number[] = [],
    nor: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  let i = 0;
  for (const [x0, x1, z0, z1] of rects) {
    pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    uv.push(x0 / tu, -z0 / tv, x1 / tu, -z0 / tv, x1 / tu, -z1 / tv, x0 / tu, -z1 / tv);
    idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
    i += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = recv;
  scene.add(m);
  return m;
}

export let waterTex: THREE.CanvasTexture;
export let poolMat: THREE.MeshBasicMaterial;
export function ground() {
  const grass = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#8a8f55';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, ['#76803f', '#9a9a60', '#a39168', '#6d7a3a', '#8e8458'], 2200, 1, 5);
  });
  const concrete = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#a6a095';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, ['#948e83', '#b5afa4', '#8d877c', '#9c9488'], 2600, 1, 3);
    g.fillStyle = '#6e695f';
    g.fillRect(0, 0, w, 3);
    g.fillRect(0, 0, 2, h);
    g.globalAlpha = 0.25;
    g.fillStyle = '#7c766b';
    for (let i = 0; i < 6; i++) g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 60, 1);
    g.globalAlpha = 1;
  });
  const paving = tex(128, 128, (g, w, h) => {
    g.fillStyle = '#8f887c';
    g.fillRect(0, 0, w, h);
    const bw = 32,
      bh = 16;
    for (let r = 0; r < h / bh; r++)
      for (let c = -1; c < w / bw + 1; c++) {
        const x = c * bw + ((r % 2) * bw) / 2;
        const t = (165 + Math.random() * 25) | 0;
        g.fillStyle = `rgb(${t},${t - 6},${t - 16})`;
        g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
      }
  });
  const asphalt = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#4d4e50';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, ['#3f4042', '#5d5e60', '#47484a'], 3000, 1, 3);
  });
  const sawah = tex(256, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = (y / 8) % 2 ? '#6e9d3c' : '#7dab45';
      g.fillRect(0, y, w, 8);
    }
    noise(g, w, h, ['#5f8a36', '#8dbb52', '#9fb6a0'], 900, 1, 3);
    g.fillStyle = '#9a8a5e';
    g.fillRect(0, 0, w, 5);
    g.fillRect(0, 0, 5, h);
  });
  waterTex = tex(128, 128, (g, w, h) => {
    g.fillStyle = '#4e7f76';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, ['#5d9086', '#436f67', '#6ea198'], 700, 2, 8);
  });
  const field = tex(
    512,
    420,
    (g, w, h) => {
      g.fillStyle = '#9b9a62';
      g.fillRect(0, 0, w, h);
      noise(g, w, h, ['#8a8a55', '#a89c6c', '#b3a275', '#7f8a4a'], 4000, 2, 8);
      g.strokeStyle = 'rgba(245,242,230,.85)';
      g.lineWidth = 4;
      g.strokeRect(20, 20, w - 40, h - 40);
      g.beginPath();
      g.moveTo(w / 2, 20);
      g.lineTo(w / 2, h - 20);
      g.stroke();
      g.beginPath();
      g.arc(w / 2, h / 2, 48, 0, Math.PI * 2);
      g.stroke();
      g.strokeRect(20, h / 2 - 80, 70, 160);
      g.strokeRect(w - 90, h / 2 - 80, 70, 160);
    },
    false,
  );
  const L = (t: THREE.Texture, o: THREE.MeshLambertMaterialParameters = {}) =>
    new THREE.MeshLambertMaterial({ map: t, ...o });
  quads(
    [
      [-140, 140, -55.5, 170],
      [-140, 140, -66.3, -60.3],
    ],
    0,
    6,
    6,
    L(grass),
  );
  quads([[-3, 3, -60.3, 60.6]], 0.02, 3, 5, L(concrete));
  const g: Rect4[] = [];
  for (const z of GZ) g.push([-58.5, -3, z - GH, z + GH], [3, 58.5, z - GH, z + GH]);
  for (const x of GX) for (let i = 0; i < ZB.length; i++) g.push([x - GH, x + GH, ZB[i][0], ZB[i][1]]);
  for (const x of GX) for (const z of GZ) g.push([x - GH, x + GH, z - GH, z + GH]);
  g.push([-58.5, -3, -55.5, -52], [3, 58.5, -55.5, -52]);
  g.push([-1.5, 1.5, -66, -60.3]);
  quads(g, 0.025, 1.2, 1.2, L(paving));
  quads([[-140, 140, 60.5, 74]], 0.02, 6, 6, L(asphalt));
  quads([[-400, 400, -450, -66.3]], -0.06, 8, 8, L(sawah));
  quads([[-140, 140, -60, -55.8]], -0.55, 4, 4, L(waterTex, { color: 0xdfeee8 }), { recv: false });
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(25.3, 19.6), L(field));
  fm.rotation.x = -Math.PI / 2;
  fm.position.set(-44.85, 0.03, 4);
  fm.receiveShadow = true;
  scene.add(fm);
  // light pools
  const pt = tex(
    128,
    128,
    (g, w, h) => {
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.45, 'rgba(255,255,255,.4)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, w, h);
    },
    false,
  );
  const pg = new THREE.PlaneGeometry(1, 1);
  pg.rotateX(-Math.PI / 2);
  poolMat = new THREE.MeshBasicMaterial({
    map: pt,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0x000000,
  });
  const pm = new THREE.InstancedMesh(pg, poolMat, poolBatch.m.length);
  poolBatch.m.forEach((m, i) => pm.setMatrixAt(i, m));
  pm.renderOrder = 2;
  scene.add(pm);
}
