/* Activities (spec §7): shopping, freelance work and cooking at home, rest and
   sleep, the garden, and helping at the warung. Each takes game time, costs or
   gives energy and mood, and trains a skill. */
import { $ } from '../core/util';
import { S } from '../core/state';
import { residents, serve as serveResident, type Resident } from '../npc/npcs';
import { vendorAt, serveAt, vendorSpot } from '../npc/vendors';
import { buyToBag, buyAndConsume, findSeat } from '../game/actions';
import { groups } from '../npc/places';
import * as social from '../social/social';
import { interactables } from '../game/interact';
import { item, rupiah, STOCK, EAT_HERE, RECIPES, type Item } from '../game/items';
import * as st from '../game/stats';
import { pots, CROPS, isReady, refreshGarden, type Pot } from '../game/garden';
import { openPanel, closePanel, setPanelFooter, type Row } from './panel';
import { toast } from './hud';
import { emit } from '../game/bus';
import { ROOMS, restored, job as houseJob, canBook, book } from '../game/house';
import { plate, takePlate } from '../social/phone';
import { platePos, showPlate } from '../game/plate';

const hour = () => (S.time / 60) % 24;

/** A resident standing at a given slot right now (shopkeepers must be there to sell). */
export function present(id: string, poi: string, tag: string): Resident | null {
  const r = residents.find(r => r.npc.id === id);
  return r && r.state === 'at' && !r.hidden && r.slot.poi.id === poi && r.slot.tag === tag ? r : null;
}

/** Let time pass with a fade: "two hours later". Ends the day if it runs past 02:00. */
export function passTime(minutes: number, text: string, done?: () => void) {
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
      return hand(present('slamet', 'warkopIn', 'owner'));
    case 'bakso':
      return hand(present('joko', 'bakso', 'vendor'));
    case 'pasar':
      return vendorAt(stall)
        ? { serve: () => serveAt(stall), keeper: null, name: 'The stall-keeper', at: vendorSpot(stall) }
        : null;
  }
}

export function openShop(v: Vendor, note?: string, back?: () => void, keepPage = false, stall = -1) {
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
  emit('buy', `${v}:${it.id}`);
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

/** How a home activity passes the time: by default a fade; at home, sitting at the desk or standing at the stove. */
export type Pass = (minutes: number, text: string, done: () => void) => void;
const fade: Pass = (m, t, d) => passTime(m, t, d);

/** Restoring Mbah Minah's house with Pak Karyo, one room at a time. */
export function restoreMenu(note?: string) {
  const blocked = canBook();
  openPanel({
    title: 'Restore the house',
    sub: `${restored.size} of ${ROOMS.length} rooms done · Pak Karyo works 09:00–13:00`,
    body:
      note ??
      (houseJob
        ? `Pak Karyo is booked for the ${ROOMS.find(r => r.id === houseJob!.room)!.name.toLowerCase()} ${houseJob.day === S.day ? 'today' : 'tomorrow'}. Be around to lend a hand.`
        : 'Pay for the materials and Pak Karyo comes the next morning. Every room turns up something of Mbah Minah’s.'),
    rows: ROOMS.map(r => ({
      label: r.name,
      note: restored.has(r.id) ? 'done' : `${rupiah(r.cost)} · ${r.unlock}`,
      disabled: restored.has(r.id)
        ? 'done'
        : houseJob?.room === r.id
          ? 'booked'
          : (blocked ?? (st.canAfford(r.cost) ? undefined : `${rupiah(r.cost)}, not enough money`)),
      run: () => {
        if (book(r))
          restoreMenu(
            `Paid ${rupiah(r.cost)}. Pak Karyo will come ${S.time < 8 * 60 ? 'this' : 'tomorrow'} morning at 09:00.`,
          );
      },
    })),
  });
}

/** Design work on the laptop. `pass` sits Raka at his desk while the hours go by. */
export function freelanceMenu(pass: Pass = fade) {
  const late = hour() >= 23 || hour() < 6;
  const opt = (hours: number, base: number): Row => {
    // A proper desk (house restoration) pays better.
    const pay = Math.round((base * st.perks.freelance) / 1000) * 1000;
    const cost = hours * 8;
    return {
      label: `Work ${hours} hour${hours > 1 ? 's' : ''}`,
      note: `${rupiah(pay)} · −${cost} energy`,
      disabled: late ? 'too late for clients' : st.stats.energy < cost + 5 ? 'too tired' : undefined,
      run: () => {
        const job = JOBS[Math.floor(Math.random() * JOBS.length)];
        pass(hours * 60, `Working on ${job}…`, () => {
          st.earn(pay);
          emit('freelance');
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
  });
}

/** Cooking at the stove. `pass` keeps Raka at the stove while it cooks. */
export function cookMenu(pass: Pass = fade, note?: string) {
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
      run: () => cook(r.id, pass),
    };
  });
  openPanel({
    title: 'Cook something',
    sub: `Cooking level ${lvl} · ingredients from the warung and pasar pagi`,
    body:
      note ?? 'Home cooking makes a good meal, and an even better gift. Neighbours love it when you share (berbagi).',
    rows,
  });
}

function cook(id: string, pass: Pass) {
  const r = RECIPES.find(r => r.id === id)!;
  for (const [ing, n] of Object.entries(r.needs)) st.take(ing, n);
  const lvl = st.level('cooking');
  const bonus = st.perks.kitchen ? 1 : 0;
  const q = Math.max(1, Math.min(5, Math.round(1 + bonus + (lvl - 1) * 0.45 + Math.random() * 1.6)));
  const portions = r.portions + bonus;
  pass(r.minutes, `Cooking ${item(id).name.toLowerCase()}…`, () => {
    st.add(id, portions, q);
    emit('cook', `${id}:${q}`);
    st.practise('cooking', 8 + q * 3);
    st.addEnergy(-4);
    st.addMood(2);
    toast(
      `${item(id).name} ×${portions}  ${'★'.repeat(q)}${'☆'.repeat(5 - q)}`,
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
    emit('harvest', c.crop);
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

/* ================= world hooks ================= */

export function registerActivities() {
  setPanelFooter(
    () => `${rupiah(st.stats.money)} · energy ${Math.round(st.stats.energy)} · mood ${Math.round(st.stats.mood)}`,
  );
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
  interactables.push({
    x: -5.4,
    z: 43.85,
    reach: 2.4,
    label: () => (present('joko', 'bakso', 'vendor') ? 'Buy bakso' : null),
    run: () => openShop('bakso'),
  });
  // Food a neighbour left by the door.
  interactables.push({
    x: platePos[0],
    z: platePos[1],
    reach: 2.0,
    label: () => {
      const p = plate;
      if (p?.state !== 'waiting') return null;
      const r = residents.find(r => r.npc.id === p.npc)!;
      return `Take the ${item(p.item).name.toLowerCase()} from ${social.properName(r.npc)}`;
    },
    run: () => {
      const p = takePlate();
      if (!p) return;
      st.add(p.item, 2);
      showPlate(false);
      const r = residents.find(r => r.npc.id === p.npc)!;
      toast(
        `${item(p.item).name} ×2 from ${social.properName(r.npc)}`,
        'In your bag. Take the plate back when you see them, with something on it if you can.',
      );
    },
  });
  for (const p of pots)
    interactables.push({ x: p.x, z: p.z, reach: 1.9, label: () => potLabel(p), run: () => usePot(p) });
}
