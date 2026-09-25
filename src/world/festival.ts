/* 17 Agustus (spec §7): red-and-white flags at every house and umbul-umbul along
   the jalan through the festival season, and on the day itself a stage, a
   panjat pinang pole and a kerupuk line on the lapangan. Prop sets, shown by date. */
import { PropSet } from '../render/props';
import { houses } from './houses';

export const agustus = new PropSet('agustus');
export const festival = new PropSet('festival');

/** Where the lomba happen (used by the event interactables). */
export const LOMBA = {
  kerupuk: [-51, 6.2] as [number, number],
  karung: [-38.5, -1.2] as [number, number],
  pinang: [-44.8, 1.2] as [number, number],
  stage: [-44.8, 9.2] as [number, number],
  upacara: [-44.8, -2.4] as [number, number],
};

const RED = '#d8261f',
  WHITE = '#f5f3ee';

export function buildFestival() {
  // A flag on a bamboo pole at the corner of every teras.
  for (const h of houses) {
    const [x, z] = h.F(h.w / 2 - 0.25, h.fz + h.sb - 0.2);
    agustus.post(x, z, 0, 3.3, 0.035, '#c9a86a');
    const [fx, fz] = h.F(h.w / 2 - 0.25 - 0.47, h.fz + h.sb - 0.2);
    agustus.put(fx, 3.08, fz, 0.9, 0.22, 0.02, RED, h.th, agustus.cloth);
    agustus.put(fx, 2.86, fz, 0.9, 0.22, 0.02, WHITE, h.th, agustus.cloth);
  }
  // Umbul-umbul: tall bamboo poles with long banners on both sides of the jalan.
  const colours = [RED, '#f2b53c', '#2f6fb3', '#3a9a73', WHITE];
  let k = 0;
  for (let z = -50; z <= 56; z += 7)
    for (const x of [-3.35, 3.35]) {
      // Keep the mouths of the gangs clear.
      if ([-32, -8, 16, 38].some(g => Math.abs(z - g) < 2)) continue;
      agustus.post(x, z, 0, 6.2, 0.045, '#c9a86a');
      const c = colours[k++ % colours.length];
      agustus.put(x, 4.6, z + 0.22, 0.02, 2.6, 0.4, c, 0, agustus.cloth);
      agustus.put(x, 3.15, z + 0.22, 0.02, 0.35, 0.4, colours[(k + 2) % colours.length], 0, agustus.cloth);
    }
  // Red and white across the front of the balai.
  agustus.put(-13, 2.75, -30.55, 13.2, 0.25, 0.03, RED, 0, agustus.cloth);
  agustus.put(-13, 2.5, -30.55, 13.2, 0.25, 0.03, WHITE, 0, agustus.cloth);

  /* The festival itself, on the lapangan. */
  const [sx, sz] = LOMBA.stage;
  // Stage: a raised deck facing north, with a backdrop, posts and lights.
  festival.box(sx - 3.4, sx + 3.4, 0, 0.9, sz + 1.1, sz + 4.2, '#7a5236', { col: true });
  festival.box(sx - 3.4, sx + 3.4, 0.9, 4.2, sz + 4.2, sz + 4.35, '#b8262a');
  festival.box(sx - 2.6, sx + 2.6, 2.6, 3.4, sz + 4.14, sz + 4.2, WHITE);
  for (const x of [sx - 3.3, sx + 3.3]) festival.post(x, sz + 1.2, 0, 4.4, 0.07, '#6b6b6b');
  festival.box(sx - 3.4, sx + 3.4, 4.3, 4.45, sz + 1.1, sz + 1.3, '#555');
  for (let i = 0; i < 7; i++) festival.light(sx - 3 + i, 4.2, sz + 1.2, 0.12, ['#ffd27a', '#ff8a6a', '#fff1c1'][i % 3]);
  festival.put(sx - 2.4, 1.3, sz + 1.6, 0.5, 0.8, 0.5, '#222');
  festival.put(sx + 2.4, 1.3, sz + 1.6, 0.5, 0.8, 0.5, '#222');
  // Panjat pinang: a greased pole with a prize ring at the top.
  const [px, pz] = LOMBA.pinang;
  festival.post(px, pz + 1.2, 0, 8.2, 0.11, '#6b4a2f', true);
  festival.put(px, 7.9, pz + 1.2, 1.6, 0.12, 1.6, '#c9a86a');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const c = ['#d8392a', '#2f6fb3', '#f2b53c', '#3a9a73'][i % 4];
    festival.put(px + Math.cos(a) * 0.75, 7.45, pz + 1.2 + Math.sin(a) * 0.75, 0.25, 0.7, 0.2, c, a, festival.cloth);
  }
  // Kerupuk line: a bamboo frame with kerupuk hanging on strings.
  const [kx, kz] = LOMBA.kerupuk;
  for (const x of [kx - 1.8, kx + 1.8]) festival.post(x, kz + 1.0, 0, 2.2, 0.04, '#c9a86a', true);
  festival.box(kx - 1.8, kx + 1.8, 2.15, 2.22, kz + 0.97, kz + 1.03, '#c9a86a');
  for (let i = 0; i < 5; i++) {
    const x = kx - 1.2 + i * 0.6;
    festival.post(x, kz + 1.0, 1.55, 2.15, 0.006, '#ddd');
    festival.put(x, 1.45, kz + 1.0, 0.24, 0.24, 0.03, '#f2e2b6', 0);
  }
  // Sack race: a start line and a pile of karung.
  const [rx, rz] = LOMBA.karung;
  festival.box(rx - 0.05, rx + 0.05, 0, 0.02, rz - 1.8, rz + 1.8, WHITE);
  for (let i = 0; i < 4; i++) festival.put(rx + 0.8, 0.18, rz - 1.2 + i * 0.8, 0.5, 0.36, 0.4, '#b89a62', 0.3 * i);
  // Flags round the field.
  for (let x = -54; x <= -35; x += 2.4) {
    festival.post(x, 13.4, 0, 2.6, 0.03, '#c9a86a');
    festival.put(x + 0.3, 2.45, 13.4, 0.55, 0.15, 0.02, RED, 0, festival.cloth);
    festival.put(x + 0.3, 2.3, 13.4, 0.55, 0.15, 0.02, WHITE, 0, festival.cloth);
  }
  agustus.build();
  festival.build();
}
