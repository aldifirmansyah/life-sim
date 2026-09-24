/* Activities (spec §7): shopping, freelance work and cooking at home, rest and
   sleep, the garden, and helping at the warung. Each takes game time, costs or
   gives energy and mood, and trains a skill. */
import { $ } from '../core/util';
import { S } from '../core/state';
import { sleep } from '../core/time';
import { residents, serve as serveResident, type Resident } from '../npc/npcs';
import { vendorAt, serveAt, vendorSpot } from '../npc/vendors';
import { buyToBag, buyAndConsume, findSeat } from '../game/actions';
import { poiById, groups } from '../npc/places';
import * as social from '../social/social';
import { rakaHouse } from '../world/landmarks';
import { interactables } from '../game/interact';
import { item, rupiah, STOCK, EAT_HERE, RECIPES, type Item } from '../game/items';
import * as st from '../game/stats';
import { pots, CROPS, isReady, refreshGarden, type Pot } from '../game/garden';
import { openPanel, closePanel, setPanelFooter, type Row } from './panel';
import { toast } from './hud';

const hour = () => (S.time / 60) % 24;
const clockText = (t: number) =>
  `${String(Math.floor((t / 60) % 24)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** A resident standing at a given slot right now (shopkeepers must be there to sell). */
function present(id: string, poi: string, tag: string): Resident | null {
  const r = residents.find(r => r.npc.id === id);
  return r && r.state === 'at' && !r.hidden && r.slot.poi.id === poi && r.slot.tag === tag ? r : null;
}

/** Let time pass with a fade: "two hours later". Ends the day if it runs past 02:00. */
function passTime(minutes: number, text: string, done?: () => void) {
  closePanel();
  S.sleeping = true;
  const f = $('fade');
  f.textContent = text;
  f.classList.add('on');
  setTimeout(() => {
    S.time = Math.min(S.time + minutes, 26 * 60 - 0.5);
    setTimeout(() => {
      f.classList.remove('on');
      S.sleeping = false;
      done?.();
    }, 300);
  }, 1100);
}

/* ================= shops ================= */

type Vendor = 'warung' | 'pasar' | 'warkop' | 'bakso';
const VENDOR_NAME: Record<Vendor, string> = {
  warung: 'Warung Bu Sri',
  pasar: 'Pasar pagi',
  warkop: 'Warkop Berkah',
  bakso: 'Bakso Mas Joko',
};

/** Who is minding a shop right now, and how they hand things over. Nobody there, no sale. */
function seller(
  v: Vendor,
  stall: number,
): { serve: () => void; keeper: Resident | null; name: string; at?: [number, number] } | null {
  const hand = (r: Resident | null) =>
    r ? { serve: () => serveResident(r), keeper: r, name: r.npc.name, at: [r.x, r.z] as [number, number] } : null;
  switch (v) {
    case 'warung':
      return hand(present('sri', 'warung', 'owner') ?? present('dimas', 'warung', 'helper'));
    case 'warkop':
      return hand(present('slamet', 'warkop', 'owner'));
    case 'bakso':
      return hand(present('joko', 'bakso', 'vendor'));
    case 'pasar':
      return vendorAt(stall)
        ? { serve: () => serveAt(stall), keeper: null, name: 'The stall-keeper', at: vendorSpot(stall) }
        : null;
  }
}

function openShop(v: Vendor, note?: string, back?: () => void, keepPage = false, stall = -1) {
  const who = seller(v, stall);
  if (!who) {
    closePanel();
    toast(`${VENDOR_NAME[v]} is unattended`, 'Nobody is minding it right now. Come back when they are.');
    return;
  }
  const here = EAT_HERE[v] ?? [];
  const rows: Row[] = STOCK[v].map(id => {
    const it = item(id);
    const eatHere = here.includes(id);
    // Nasi uduk is a breakfast thing; martabak only comes out in the evening.
    const closed =
      (id === 'nasi_uduk' && hour() >= 10.5) || (id === 'martabak_manis' && hour() < 17) ? 'not now' : undefined;
    const have = st.count(id);
    return {
      label: it.name,
      note: `${rupiah(it.price)}${eatHere ? ' \u00b7 have it here' : have ? ` \u00b7 ${have} in bag` : ''}`,
      disabled: closed ?? (st.canAfford(it.price) ? undefined : `${rupiah(it.price)} \u00b7 not enough money`),
      run: () => buy(v, it, eatHere, back, stall),
    };
  });
  openPanel({
    title: VENDOR_NAME[v],
    sub: `${who.name} is serving`,
    body: note,
    rows,
    back,
    keepPage,
    onClose: () => {
      if (who.keeper) who.keeper.talking = false;
    },
  });
  // The shopkeeper stays at the counter while Raka is choosing.
  if (who.keeper) who.keeper.talking = true;
}

function buy(v: Vendor, it: Item, eatHere: boolean, back: (() => void) | undefined, stall: number) {
  const who = seller(v, stall);
  if (!who || !st.spend(it.price)) return;
  S.time += 1;
  // Hide the menu while Raka pays and takes it; the keeper stays put until he's done.
  closePanel(false);
  const release = () => {
    if (who.keeper) who.keeper.talking = false;
  };
  if (eatHere) {
    const seat = findSeat(4.5);
    buyAndConsume(it.id, who.serve, who.at, seat, () => {
      release();
      finishEating(it.id, 0, seat !== null);
    });
  } else {
    buyToBag(it.id, who.serve, who.at, () => {
      st.add(it.id);
      openShop(v, `${it.name} goes in your bag. ${it.blurb}`, back, true, stall);
    });
  }
}

/** After eating or drinking: apply it, let the time pass, and say how Raka feels. */
export function finishEating(id: string, q: number, seated: boolean) {
  const it = item(id);
  const e0 = st.stats.energy;
  st.consume(id, q);
  S.time = Math.min(S.time + (it.cat === 'meal' || it.cat === 'dish' ? 15 : 5), 26 * 60 - 1);
  const gained = Math.round(st.stats.energy - e0);
  const lc = it.name.charAt(0).toLowerCase() + it.name.slice(1);
  toast(
    `${it.cat === 'drink' ? 'Drank' : 'Ate'} the ${lc}`,
    `${gained > 0 ? `Energy +${gained}. ` : ''}${seated ? 'Nice to sit for a bit.' : it.cat === 'drink' ? 'Refreshing.' : 'That hit the spot.'}`,
  );
}

function warungMenu(note?: string) {
  const sri = present('sri', 'warung', 'owner');
  const h = hour();
  const shiftReason =
    shiftDay === S.day
      ? 'already helped today'
      : h < 7 || h >= 20
        ? 'open 07:00–20:00'
        : st.stats.energy < 15
          ? 'too tired'
          : undefined;
  openPanel({
    title: 'Warung Bu Sri',
    sub: sri ? 'Bu Sri is behind the counter' : 'Dimas is minding the counter',
    body: note,
    rows: [
      { label: 'Buy something', run: () => openShop('warung', undefined, () => warungMenu()) },
      {
        label: 'Help Bu Sri serve customers',
        note: '1 hour · Rp 25.000 + tips',
        disabled: sri ? shiftReason : 'Bu Sri isn’t here',
        run: startShift,
      },
    ],
  });
}

/* ================= home ================= */

const JOBS = [
  'a logo for a kopi roastery in Bandung',
  'a wedding invitation with too many flowers',
  'Instagram posts for a laundry in Depok',
  'a menu board for a padang restaurant',
  'a banner for a futsal tournament',
  'packaging for home-made sambal',
  'slides for a start-up that sells rice online',
  'a poster for a mosque’s Ramadan bazaar',
];

function homeMenu(note?: string) {
  const h = hour();
  const lateNight = S.time >= 20 * 60;
  openPanel({
    title: 'Rumah Raka',
    sub: `Mbah Minah’s house · ${clockText(S.time)}`,
    body: note,
    rows: [
      { label: 'Freelance work on the laptop…', run: freelanceMenu },
      { label: 'Cook something…', run: cookMenu },
      {
        label: 'Rest for an hour',
        note: '+15 energy',
        run: () =>
          passTime(60, 'An hour later…', () => {
            st.addEnergy(15);
            st.addMood(2);
          }),
      },
      lateNight
        ? { label: 'Sleep', note: 'until 06:00', run: () => (closePanel(), sleep()) }
        : {
            label: 'Take a nap',
            note: '2 hours · +25 energy',
            disabled: h < 11 ? 'too early for a nap' : undefined,
            run: () =>
              passTime(120, 'Zzz…', () => {
                st.addEnergy(25);
                st.addMood(3);
              }),
          },
    ],
  });
}

function freelanceMenu() {
  const late = hour() >= 23 || hour() < 6;
  const opt = (hours: number, pay: number): Row => {
    const cost = hours * 8;
    return {
      label: `Work ${hours} hour${hours > 1 ? 's' : ''}`,
      note: `${rupiah(pay)} · −${cost} energy`,
      disabled: late ? 'too late for clients' : st.stats.energy < cost + 5 ? 'too tired' : undefined,
      run: () => {
        const job = JOBS[Math.floor(Math.random() * JOBS.length)];
        passTime(hours * 60, `Working on ${job}…`, () => {
          st.earn(pay);
          st.addEnergy(-cost);
          st.addMood(hours >= 4 ? -4 : -1);
          toast(`Freelance: +${rupiah(pay)}`, `You finished ${job}.`);
        });
      },
    };
  };
  openPanel({
    title: 'Freelance work',
    sub: 'Design jobs from clients in the city',
    body: 'Longer sessions pay a little better, but they wear you out.',
    rows: [opt(1, 35000), opt(2, 75000), opt(4, 160000)],
    back: () => homeMenu(),
  });
}

function cookMenu(note?: string) {
  const lvl = st.level('cooking');
  const rows: Row[] = RECIPES.map(r => {
    const dish = item(r.id);
    const missing = Object.entries(r.needs)
      .filter(([id, n]) => st.count(id) < n)
      .map(([id]) => item(id).name.toLowerCase());
    const needs = Object.keys(r.needs)
      .map(id => item(id).name.toLowerCase())
      .join(', ');
    return {
      label: `${dish.name} (×${r.portions})`,
      note: `${needs} · ${r.minutes} min`,
      disabled: lvl < r.level ? `Cooking level ${r.level}` : missing.length ? `need ${missing.join(', ')}` : undefined,
      run: () => cook(r.id),
    };
  });
  openPanel({
    title: 'Cook something',
    sub: `Cooking level ${lvl} · ingredients from the warung and pasar pagi`,
    body:
      note ?? 'Home cooking makes a good meal, and an even better gift. Neighbours love it when you share (berbagi).',
    rows,
    back: () => homeMenu(),
  });
}

function cook(id: string) {
  const r = RECIPES.find(r => r.id === id)!;
  for (const [ing, n] of Object.entries(r.needs)) st.take(ing, n);
  const lvl = st.level('cooking');
  const q = Math.max(1, Math.min(5, Math.round(1 + (lvl - 1) * 0.45 + Math.random() * 1.6)));
  passTime(r.minutes, `Cooking ${item(id).name.toLowerCase()}…`, () => {
    st.add(id, r.portions, q);
    st.practise('cooking', 8 + q * 3);
    st.addEnergy(-4);
    st.addMood(2);
    toast(
      `${item(id).name} ×${r.portions}  ${'★'.repeat(q)}${'☆'.repeat(5 - q)}`,
      'Eat it from your bag, or share it with a neighbour.',
    );
  });
}

/* ================= garden ================= */

function potLabel(p: Pot) {
  if (!p.seed) return st.contents().some(e => e.item.cat === 'seed') ? 'Plant something' : null;
  const c = CROPS[p.seed];
  if (isReady(p)) return `Harvest the ${c.label}`;
  return p.wateredDay === S.day ? null : `Water the ${c.label}`;
}

function usePot(p: Pot) {
  if (!p.seed) {
    const seeds = st.contents().filter(e => e.item.cat === 'seed');
    openPanel({
      title: 'Plant something',
      sub: 'Water it every day and it grows a day at a time',
      rows: seeds.map(e => ({
        label: e.item.name,
        note: `${CROPS[e.item.id].days} watered days · ${e.qty} in bag`,
        run: () => {
          st.take(e.item.id);
          p.seed = e.item.id;
          p.growth = 0;
          p.wateredDay = S.day;
          S.time += 5;
          st.practise('gardening', 8);
          refreshGarden();
          closePanel();
          toast(`Planted ${CROPS[e.item.id].label}`, 'Watered it too. Come back tomorrow.');
        },
      })),
    });
    return;
  }
  const c = CROPS[p.seed];
  if (isReady(p)) {
    const n = 2 + Math.floor((st.level('gardening') - 1) / 3);
    st.add(c.crop, n);
    st.practise('gardening', 12);
    st.addMood(3);
    toast(`Harvested ${n} ${c.label}`, 'Fresh from your own garden. Cook with them, or give some away.');
    p.seed = null;
    p.growth = 0;
  } else {
    p.wateredDay = S.day;
    st.practise('gardening', 3);
    st.addEnergy(-1);
    const left = c.days - p.growth;
    toast(`Watered the ${c.label}`, `${left} more watered day${left > 1 ? 's' : ''} to go.`);
  }
  S.time += 3;
  refreshGarden();
}

/* ================= helping at the warung ================= */

let shiftDay = -1;
const SHELF = ['Beras', 'Telur', 'Kopi sachet', 'Indomie', 'Gula', 'Minyak goreng'];
const SHIFT_SECONDS = 45;
interface Shift {
  ends: number;
  customer: string;
  order: string[];
  served: number;
  tips: number;
  mistakes: number;
  msg: string;
}
let shift: Shift | null = null;

function newOrder(s: Shift) {
  const pool = residents.filter(r => r.npc.id !== 'sri' && r.npc.id !== 'dimas');
  s.customer = pool[Math.floor(Math.random() * pool.length)].npc.name;
  const n = 1 + Math.floor(Math.random() * Math.min(3, 1 + s.served / 3));
  s.order = Array.from({ length: n }, () => SHELF[Math.floor(Math.random() * SHELF.length)]);
}

function startShift() {
  shiftDay = S.day;
  shift = {
    ends: performance.now() + SHIFT_SECONDS * 1000,
    customer: '',
    order: [],
    served: 0,
    tips: 0,
    mistakes: 0,
    msg: 'Bu Sri hands you an apron. “Quick now, Mas!”',
  };
  newOrder(shift);
  renderShift();
}

function renderShift() {
  const s = shift!;
  const left = Math.max(0, Math.ceil((s.ends - performance.now()) / 1000));
  openPanel({
    title: 'Helping at Warung Bu Sri',
    sub: `${left}s left · ${s.served} served · tips ${rupiah(s.tips)}`,
    body: `${s.msg}\n${s.customer} wants: ${s.order.join(', ')}`,
    rows: SHELF.map(g => ({ label: g, note: s.order.includes(g) ? '←' : '', run: () => serve(g) })),
    back: () => endShift(true),
    keepPage: true,
  });
}

function serve(g: string) {
  const s = shift;
  if (!s) return;
  const i = s.order.indexOf(g);
  if (i < 0) {
    s.mistakes++;
    s.ends -= 2000;
    s.msg = `“Bukan itu, Mas! Not that one.”`;
  } else {
    s.order.splice(i, 1);
    s.msg = 'Good.';
    if (!s.order.length) {
      s.served++;
      s.tips += 2000;
      s.msg = `${s.customer} pays and says terima kasih.`;
      newOrder(s);
    }
  }
  renderShift();
}

function endShift(early = false) {
  const s = shift;
  if (!s) return;
  shift = null;
  const pay = early && s.served < 3 ? 10000 : 25000;
  const sri = residents.find(r => r.npc.id === 'sri')!.npc;
  passTime(60, 'Serving customers at the warung…', () => {
    st.earn(pay + s.tips);
    st.addEnergy(-10);
    st.addMood(3);
    st.practise('charisma', 6 + s.served * 2);
    const ch = social.befriend(sri, 2 + Math.floor(s.served / 2), S.day);
    toast(
      `Warung shift: +${rupiah(pay + s.tips)}`,
      `${s.served} customers served${s.mistakes ? `, ${s.mistakes} mix-ups` : ''}. ${ch.delta > 0 ? 'Bu Sri likes you more.' : 'Bu Sri is grateful.'}`,
    );
  });
}

/** Every frame: the warung shift's clock. */
export function updateActivities() {
  if (!shift) return;
  if (performance.now() >= shift.ends) endShift();
  else if (S.panel) {
    const left = Math.max(0, Math.ceil((shift.ends - performance.now()) / 1000));
    const sub = `${left}s left · ${shift.served} served · tips ${rupiah(shift.tips)}`;
    if ($('panel-sub').textContent !== sub) $('panel-sub').textContent = sub;
  }
}

/* ================= world hooks ================= */

export function registerActivities() {
  setPanelFooter(
    () => `${rupiah(st.stats.money)} · energy ${Math.round(st.stats.energy)} · mood ${Math.round(st.stats.mood)}`,
  );
  // The warung counter: open while Bu Sri or Dimas is there.
  interactables.push({
    x: 7.6,
    z: -5.5,
    reach: 2.4,
    label: () => (present('sri', 'warung', 'owner') || present('dimas', 'warung', 'helper') ? 'Warung Bu Sri' : null),
    run: () => warungMenu(),
  });
  // Every pasar pagi stall, while the market is up.
  for (const p of groups.get('pasar') ?? []) {
    const s = p.slots[0];
    const stall = +p.id.slice('pasar'.length);
    interactables.push({
      x: s.x > 0 ? 2.25 : -2.25,
      z: s.z,
      reach: 2.2,
      label: () => (vendorAt(stall) ? 'Pasar pagi stall' : null),
      run: () => openShop('pasar', undefined, undefined, false, stall),
    });
  }
  const wk = poiById.get('warkop')!.slots.find(s => s.tag === 'owner')!;
  interactables.push({
    x: wk.x - 0.5,
    z: wk.z - 0.6,
    reach: 2.8,
    label: () => (present('slamet', 'warkop', 'owner') ? 'Order at Warkop Berkah' : null),
    run: () => openShop('warkop'),
  });
  interactables.push({
    x: -5.4,
    z: 43.85,
    reach: 2.4,
    label: () => (present('joko', 'bakso', 'vendor') ? 'Buy bakso' : null),
    run: () => openShop('bakso'),
  });
  // Raka's front door.
  const h = rakaHouse;
  const [dx, dz] = h.F(h.dx, h.fz + 0.2);
  interactables.push({ x: dx, z: dz, reach: 2.2, label: () => 'Rumah Raka', run: () => homeMenu() });
  for (const p of pots)
    interactables.push({ x: p.x, z: p.z, reach: 1.9, label: () => potLabel(p), run: () => usePot(p) });
}
