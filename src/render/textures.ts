import * as THREE from 'three';
import { renderer } from './context';

/** Canvas-drawn texture. */
export function tex(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  rep = true,
) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (rep) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
export function noise(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  cols: string[],
  n: number,
  s0: number,
  s1: number,
) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[i % cols.length];
    const s = s0 + Math.random() * (s1 - s0);
    g.globalAlpha = 0.25 + Math.random() * 0.5;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  g.globalAlpha = 1;
}
