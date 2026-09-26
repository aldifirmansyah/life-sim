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
import { addVendor } from '../npc/vendors';
import { addShutter, isOpenAt } from './shutters';
import { addMakan, tasted } from './explore';
import { spend, sgd, addEnergy, addMood, addItem, owned } from '../game/stats';

export interface Ware {
  name: string;
  price: number;
  /** A gift for the bag (item id). */
  gift?: string;
  /** Owned for good (and not sold again). */
  own?: string;
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
  /** Opening hours [from, to) in game hours (default 10–22). */
  hours?: [number, number];
}
const hoursOf = (s: Shop): [number, number] => s.hours ?? [10, 22];
const hh = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;

export function shopPanel(s: Shop) {
  openPanel({
    title: s.name,
    sub: s.sub,
    body: s.hello,
    keepPage: true,
    rows: [
      ...s.wares.map(w => ({
        label: w.name,
        note: w.own && owned.includes(w.own) ? 'got it' : sgd(w.price),
        disabled: w.own && owned.includes(w.own) ? 'Already yours' : undefined,
        run: () => buy(s, w),
      })),
      { label: 'Just looking', run: () => closePanel() },
    ],
  });
}
function buy(s: Shop, w: Ware) {
  if (!spend(w.price)) return toast('Not enough money', `${w.name} is ${sgd(w.price)}.`);
  if (w.own) owned.push(w.own);
  if (w.gift) {
    addItem(w.gift);
    toast(`${w.name}`, 'In the bag. A good gift for someone.', null);
    return;
  }
  closePanel();
  const done = () => {
    addEnergy(w.energy ?? 0);
    addMood(w.mood ?? 0);
    if (w.minutes) tasted(w.name, s.name);
    toast(w.name, w.note ?? `From ${s.name}.`, null);
  };
  if (w.minutes) passTime(w.minutes, `${s.name}…`, done);
  else done();
}

const GOODS = ['#d7263d', '#f2c14e', '#2f6fb3', '#3f7d3a', '#e8a0b8', '#f4f1ea', '#8a4b2a', '#e07a1f'];

/** Put the things eaten at a shop on the makan list (game/explore). */
export function listMenu(s: Shop) {
  for (const w of s.wares) if (w.minutes && !w.gift && !w.own) addMakan(w.name, s.name);
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
    listMenu(s);
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
    // Shelves of goods on the shopfront, behind the shopkeeper.
    for (const sy of [1.25, 1.95]) {
      p.box(
        x0 + 0.6,
        x1 - 0.6,
        sy - 0.04,
        sy,
        Math.min(front, front + face * 0.18),
        Math.max(front, front + face * 0.18),
        '#8a6a4a',
      );
      for (let k = 0, gx = x0 + 0.8; gx < x1 - 0.7; gx += 0.34, k++) {
        const gh = 0.16 + ((k * 7) % 3) * 0.05;
        p.box(
          gx - 0.12,
          gx + 0.12,
          sy,
          sy + gh,
          Math.min(front + face * 0.03, front + face * 0.16),
          Math.max(front + face * 0.03, front + face * 0.16),
          GOODS[(k + i * 3) % GOODS.length],
        );
      }
    }
    const cz = front + face * 1.05;
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
    // A few things on the counter, and the shopkeeper behind it.
    for (let k = 0; k < 3; k++) {
      const gx = cx - 0.9 + k * 0.9;
      p.box(gx - 0.15, gx + 0.15, 1, 1.12 + (k % 2) * 0.08, cz - 0.12, cz + 0.12, GOODS[(k * 2 + i) % GOODS.length]);
    }
    addVendor(cx + 0.6, front + face * 0.5, face > 0 ? 0 : Math.PI, { open: hoursOf(s)[0], close: hoursOf(s)[1] });
    // The roller shutter over the shopfront at night (its drum under the awning).
    addShutter(x0 + 0.4, x1 - 0.4, front + face * 0.28, face, 2.6, hoursOf(s));
    p.box(
      x0 + 0.35,
      x1 - 0.35,
      2.6,
      2.75,
      Math.min(front, front + face * 0.4),
      Math.max(front, front + face * 0.4),
      '#8b9296',
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
      z: front + face * 1.5,
      reach: 2.8,
      size: 1,
      label: () => (isOpenAt(hoursOf(s)) ? s.name : `${s.name} (closed, opens ${hh(hoursOf(s)[0])})`),
      run: () =>
        isOpenAt(hoursOf(s))
          ? shopPanel(s)
          : toast(`${s.name} is closed`, `Open ${hh(hoursOf(s)[0])} to ${hh(hoursOf(s)[1])}.`),
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
