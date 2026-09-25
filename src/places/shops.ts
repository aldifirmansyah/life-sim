/* Shops that aren't walked into: a row of shopfronts (Haji Lane) or market
   stalls (Chinatown) with a counter under an awning and a sign. E at the counter
   opens the shop: things to eat or drink there (energy, mood, time), gifts for
   the bag, and treats that only lift the mood. Also used for the counters inside
   Lucky Place. */
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { register } from '../game/interact';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/hud';
import { passTime } from '../core/time';
import { spend, sgd, addEnergy, addMood, addItem } from '../game/stats';

export interface Ware {
  name: string;
  price: number;
  /** A gift for the bag (item id). */
  gift?: string;
  /** Eaten or enjoyed there: minutes it takes, energy and mood. */
  minutes?: number;
  energy?: number;
  mood?: number;
  note?: string;
}
export interface Shop {
  name: string;
  sub: string;
  color: string;
  wares: Ware[];
  /** Said on opening the panel. */
  hello?: string;
}

export function shopPanel(s: Shop) {
  openPanel({
    title: s.name,
    sub: s.sub,
    body: s.hello,
    keepPage: true,
    rows: [
      ...s.wares.map(w => ({ label: w.name, note: sgd(w.price), run: () => buy(s, w) })),
      { label: 'Just looking', run: () => closePanel() },
    ],
  });
}
function buy(s: Shop, w: Ware) {
  if (!spend(w.price)) return toast('Not enough money', `${w.name} is ${sgd(w.price)}.`);
  if (w.gift) {
    addItem(w.gift);
    toast(`${w.name}`, 'In the bag. A good gift for someone.', null);
    return;
  }
  closePanel();
  const done = () => {
    addEnergy(w.energy ?? 0);
    addMood(w.mood ?? 0);
    toast(w.name, w.note ?? `From ${s.name}.`, null);
  };
  if (w.minutes) passTime(w.minutes, `${s.name}…`, done);
  else done();
}

/** A row of shopfronts or stalls along x, facing south (+z) or north (−z). */
export function buildShopRow(
  id: string,
  r: { x0: number; x1: number; z0: number; z1: number },
  face: 1 | -1,
  shops: Shop[],
  o: { height?: number; roof?: string; wall?: string } = {},
) {
  const p = new PropSet('shops-' + id);
  const h = o.height ?? 7;
  const w = (r.x1 - r.x0) / shops.length;
  const front = face > 0 ? r.z1 : r.z0;
  shops.forEach((s, i) => {
    const x0 = r.x0 + i * w,
      x1 = x0 + w,
      cx = (x0 + x1) / 2;
    p.box(x0 + 0.05, x1 - 0.05, 0, h, r.z0, r.z1, o.wall ?? s.color, { col: true });
    // The shopfront: a dark opening, the counter before it, an awning over it.
    p.box(
      x0 + 0.5,
      x1 - 0.5,
      0.1,
      2.6,
      front - (face > 0 ? 0.05 : -0.05),
      front + (face > 0 ? 0.02 : -0.02),
      '#2b2622',
    );
    const cz = front + face * 0.6;
    p.box(
      x0 + 0.6,
      x1 - 0.6,
      0,
      1,
      Math.min(cz - 0.3 * face, cz + 0.3 * face),
      Math.max(cz - 0.3 * face, cz + 0.3 * face),
      '#d8d2c4',
      { col: true },
    );
    p.box(
      x0 + 0.2,
      x1 - 0.2,
      2.7,
      2.85,
      Math.min(front, front + face * 1.8),
      Math.max(front, front + face * 1.8),
      s.color,
      { b: p.cloth },
    );
    sign(
      {
        text: s.name,
        sub: s.sub,
        w: w - 0.8,
        h: 0.7,
        bg: '#1d2b36',
        fg: '#ffffff',
        subfg: '#f2c14e',
        border: s.color,
        font: 'ui',
      },
      cx,
      3.4,
      front + face * 0.06,
      face > 0 ? 0 : Math.PI,
    );
    register({
      x: cx,
      y: 1.2,
      z: front + face * 0.9,
      reach: 2.8,
      size: 1,
      label: () => s.name,
      run: () => shopPanel(s),
    });
  });
  p.box(r.x0 - 0.3, r.x1 + 0.3, h, h + 0.4, r.z0 - 0.3, r.z1 + 0.3, o.roof ?? '#b5553a');
  p.build();
  near.push({ p, x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, r: 260 });
}

/** Prop sets that are only drawn near Aldi. */
export const near: { p: PropSet; x: number; z: number; r: number }[] = [];
export function updateNear(px: number, pz: number) {
  for (const n of near) n.p.show(Math.hypot(n.x - px, n.z - pz) < n.r);
}
