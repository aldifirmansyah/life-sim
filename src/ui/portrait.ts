/* Contacts portraits (spec §10), drawn from the same AppearanceParams as the
   3D characters: a flat, low-poly-ish bust on a warm background. */
import type { AppearanceParams } from '../npc/types';

const BG = ['#f2c14e', '#2fb3a1', '#e8a4a0', '#9fc6cc', '#c9b6e4', '#b8d59a', '#f4b183'];

/** Draw a portrait into a square canvas. `unknown` draws a silhouette. */
export function drawPortrait(cv: HTMLCanvasElement, a: AppearanceParams, seed: number, unknown = false) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const S = cv.clientWidth || 88;
  cv.width = cv.height = Math.round(S * dpr);
  const g = cv.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const u = S / 100;
  const shade = (c: string, k: number) => {
    const n = parseInt(c.slice(1), 16);
    const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };
  g.fillStyle = unknown ? '#3a3129' : BG[seed % BG.length];
  g.fillRect(0, 0, S, S);
  const col = (c: string) => (unknown ? '#231d17' : c);
  const cx = 50 * u;
  // Children have bigger heads and narrower shoulders.
  const hr = (a.child ? 19 : 16) * u;
  const hy = (a.child ? 46 : 42) * u;
  const sw = (a.child ? 30 : 38) * u * (unknown ? 1 : Math.min(1.2, a.build));

  // Shoulders and torso.
  g.fillStyle = col(a.top);
  g.beginPath();
  g.moveTo(cx - sw, 100 * u);
  g.lineTo(cx - sw * 0.92, 78 * u);
  g.quadraticCurveTo(cx - sw * 0.6, 66 * u, cx - 10 * u, 64 * u);
  g.lineTo(cx + 10 * u, 64 * u);
  g.quadraticCurveTo(cx + sw * 0.6, 66 * u, cx + sw * 0.92, 78 * u);
  g.lineTo(cx + sw, 100 * u);
  g.closePath();
  g.fill();
  if (!unknown) {
    g.fillStyle = shade(a.top, 0.82);
    g.fillRect(cx - 2 * u, 70 * u, 4 * u, 30 * u);
  }
  // Neck.
  g.fillStyle = col(shade(a.skin, 0.88));
  g.fillRect(cx - 6 * u, hy + hr * 0.6, 12 * u, 64 * u - hy - hr * 0.3);

  // Hijab: a hood around the face and a drape over the shoulders.
  if (a.hair === 'hijab') {
    g.fillStyle = col(a.headwear);
    g.beginPath();
    g.moveTo(cx - sw * 0.75, 100 * u);
    g.quadraticCurveTo(cx - hr * 1.6, hy + hr * 1.2, cx - hr * 1.3, hy);
    g.arc(cx, hy - 1 * u, hr * 1.32, Math.PI, 0);
    g.quadraticCurveTo(cx + hr * 1.6, hy + hr * 1.2, cx + sw * 0.75, 100 * u);
    g.closePath();
    g.fill();
  }
  // Long hair falls behind the head.
  if (a.hair === 'long') {
    g.fillStyle = col(a.hairColor);
    g.beginPath();
    g.roundRect(cx - hr * 1.15, hy - hr * 0.6, hr * 2.3, hr * 2.6, 6 * u);
    g.fill();
  }
  // Head.
  g.fillStyle = col(a.skin);
  g.beginPath();
  g.ellipse(cx, hy, hr, hr * 1.1, 0, 0, Math.PI * 2);
  g.fill();
  // Hair and headwear on top.
  g.fillStyle = col(a.hair === 'cap' || a.hair === 'peci' ? a.headwear : a.hairColor);
  if (a.hair === 'short' || a.hair === 'long' || a.hair === 'bun') {
    g.beginPath();
    g.ellipse(cx, hy - hr * 0.35, hr * 1.06, hr * 0.8, 0, Math.PI, 0);
    g.fill();
    g.fillRect(cx - hr * 1.06, hy - hr * 0.4, hr * 0.28, hr * 0.7);
    g.fillRect(cx + hr * 0.78, hy - hr * 0.4, hr * 0.28, hr * 0.7);
    if (a.hair === 'bun') {
      g.beginPath();
      g.arc(cx, hy - hr * 1.2, hr * 0.42, 0, Math.PI * 2);
      g.fill();
    }
  } else if (a.hair === 'peci') {
    g.fillStyle = col(a.hairColor);
    g.fillRect(cx - hr * 1.02, hy - hr * 0.35, hr * 0.22, hr * 0.5);
    g.fillRect(cx + hr * 0.8, hy - hr * 0.35, hr * 0.22, hr * 0.5);
    g.fillStyle = col(a.headwear);
    g.fillRect(cx - hr * 0.92, hy - hr * 1.25, hr * 1.84, hr * 0.78);
  } else if (a.hair === 'cap') {
    g.beginPath();
    g.ellipse(cx, hy - hr * 0.4, hr * 1.08, hr * 0.85, 0, Math.PI, 0);
    g.fill();
    g.fillRect(cx - hr * 0.2, hy - hr * 0.5, hr * 1.5, hr * 0.22);
  } else if (a.hair === 'bald' && !unknown) {
    g.fillStyle = shade(a.hairColor, 1);
    g.fillRect(cx - hr * 1.02, hy - hr * 0.1, hr * 0.2, hr * 0.45);
    g.fillRect(cx + hr * 0.82, hy - hr * 0.1, hr * 0.2, hr * 0.45);
  }
  if (unknown) {
    g.fillStyle = '#9d917c';
    g.font = `800 ${28 * u}px Figtree, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', cx, hy + 2 * u);
    return;
  }
  // Face: eyes and a small smile.
  g.fillStyle = '#1b1614';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + s * hr * 0.38, hy + hr * 0.08, hr * 0.09, hr * 0.13, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = shade(a.skin, 0.55);
  g.lineWidth = 1.6 * u;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(cx, hy + hr * 0.38, hr * 0.26, 0.25 * Math.PI, 0.75 * Math.PI);
  g.stroke();
}
