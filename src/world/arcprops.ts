/* What finished story arcs change in the kampung you can see (spec §8.4:
   "completing arcs has visible effects on the world"). One prop set per flag. */
import { PropSet } from '../render/props';
import { rakaHouse } from './landmarks';
import { homes } from '../npc/places';
import { flags, onFlag } from '../social/arcs';

const sets = new Map<string, PropSet>();
const set = (flag: string) => {
  const s = new PropSet(`arc-${flag}`);
  sets.set(flag, s);
  return s;
};

export function buildArcProps() {
  // Bu Sri's warung: a fresh menu board out front.
  const board = set('warung_board');
  board.box(11.1, 11.16, 0, 1.3, -6.75, -6.55, '#6b4a2f');
  board.box(11.9, 11.96, 0, 1.3, -6.75, -6.55, '#6b4a2f');
  board.box(11.0, 12.06, 0.55, 1.45, -6.8, -6.74, '#1f3b2e');
  for (let i = 0; i < 4; i++)
    board.box(11.12, 11.7 + (i % 2) * 0.2, 1.28 - i * 0.18, 1.33 - i * 0.18, -6.83, -6.81, '#f4f1ea');
  board.box(11.0, 12.06, 1.45, 1.6, -6.8, -6.74, '#d8392a');

  // Pak Darto built Raka a bench for his teras.
  const h = rakaHouse;
  const side = (h.bench ?? 1.2) > 0 ? -1 : 1;
  const bench = set('darto_bench');
  const lx = side * (h.w / 2 - 1.0);
  const [bx, bz] = h.F(lx, h.fz + 0.55);
  bench.put(bx, 0.42, bz, 1.3, 0.06, 0.4, '#a0703f', h.th);
  bench.put(bx, 0.21, bz, 1.2, 0.42, 0.3, '#7a5236', h.th);
  const [kx, kz] = h.F(lx, h.fz + 0.36);
  bench.put(kx, 0.72, kz, 1.3, 0.5, 0.05, '#a0703f', h.th);

  // Lestari Catering: a banner over her teras.
  const lestari = set('lestari_banner');
  const lh = homes.get('yusuf')!.slots.find(s => s.tag === 'teras')!;
  const back = 0.55;
  lestari.put(
    lh.x - Math.sin(lh.ry) * back,
    2.35,
    lh.z - Math.cos(lh.ry) * back,
    2.2,
    0.5,
    0.03,
    '#f2b53c',
    lh.ry,
    lestari.cloth,
  );
  lestari.put(
    lh.x - Math.sin(lh.ry) * (back - 0.02),
    2.35,
    lh.z - Math.cos(lh.ry) * (back - 0.02),
    1.7,
    0.16,
    0.03,
    '#b8262a',
    lh.ry,
    lestari.cloth,
  );

  // Bima's kites over the lapangan.
  const kites = set('kites');
  (
    [
      [-48, 14, 2, '#d8392a'],
      [-42, 16, -1, '#2f6fb3'],
      [-45, 12.5, 6, '#f2b53c'],
    ] as [number, number, number, string][]
  ).forEach(([x, y, z, c]) => {
    kites.put(x, y, z, 0.9, 0.9, 0.02, c, Math.PI / 4, kites.cloth);
    kites.put(x, y - 0.9, z, 0.08, 0.9, 0.02, '#f4f1ea', 0, kites.cloth);
  });

  // Nadia's mural inside the balai.
  const mural = set('mural');
  const cols = ['#e86a3a', '#f2b53c', '#3a9a73', '#2f6fb3', '#b8262a', '#e8a4a0', '#5e9c42'];
  for (let i = 0; i < 12; i++) {
    const x0 = -19.2 + i * 1.08;
    mural.box(x0, x0 + 1.08, 0.5 + (i % 3) * 0.3, 2.6 - (i % 2) * 0.4, -23.06, -23.03, cols[i % cols.length]);
    mural.box(x0 + 0.2, x0 + 0.7, 1.2, 1.8, -23.08, -23.06, cols[(i + 3) % cols.length]);
  }

  // Fajar's filming corner: a tripod and ring light on his teras.
  const rl = set('ringlight');
  const fh = homes.get('yati')!.slots.find(s => s.tag === 'teras')!;
  const [rx, rz] = [fh.x + Math.cos(fh.ry) * 1.0, fh.z - Math.sin(fh.ry) * 1.0];
  rl.post(rx, rz, 0, 1.5, 0.02, '#222');
  rl.light(rx, 1.6, rz, 0.16, '#fff6dc');

  for (const s of sets.values()) s.build();
  onFlag(f => sets.get(f)?.show(true));
  for (const f of flags) sets.get(f)?.show(true);
}
