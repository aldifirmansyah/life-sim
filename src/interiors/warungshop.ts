/* Shopping at Warung Bu Sri, and helping out behind the counter (interiors
   plan step 3). The room is built in interiors/warung.ts.
   - Shelves on the customers' side are self-service: aim at one, take what you
     want (it goes in your hands, then your basket), and pay Bu Sri (or Dimas)
     at the counter. Walk out without paying and you put it all back.
   - At the counter: pay for what you picked, or ask for what she makes (teh
     manis, kopi, gorengan from the etalase, nasi uduk, nasi bungkus).
   - The warung shift: Bu Sri sends you round the back of the counter. For a
     minute, customers come in one after another and call out what they want;
     fetch it from the stock bays along the east wall (up to three things at a
     time) and hand it over at the counter. Wrong things cost time. */
import { $ } from '../core/util';
import { S, inWorld } from '../core/state';
import { player } from '../core/player';
import { residents, serve as serveResident, type Resident } from '../npc/npcs';
import * as social from '../social/social';
import { interactables } from '../game/interact';
import { buyToBag, takeFrom } from '../game/actions';
import { item, rupiah } from '../game/items';
import * as st from '../game/stats';
import { emit } from '../game/bus';
import { repute } from '../social/reputation';
import { openPanel, closePanel, type Row } from '../ui/panel';
import { passTime } from '../ui/activities';
import { toast } from '../ui/hud';
import { bubble, clearBubble } from '../ui/bubbles';
import { sfx } from '../audio/audio';
import { sendShopper, sendAway, clearShoppers, shopperHead, shopperTake, shoppers } from '../npc/shoppers';
import { WARUNG, SHELVES, COUNTER, COUNTER_ITEMS, CUSTOMER_SPOTS, STOCK_BAYS, bayAt, W } from './warung';
import type { Interior } from './interior';

const hour = () => (S.time / 60) % 24;

/** Bu Sri or Dimas, at the counter right now. */
function keeper(): Resident | null {
  for (const [id, tag] of [
    ['sri', 'owner'],
    ['dimas', 'helper'],
  ])
    for (const r of residents)
      if (r.npc.id === id && r.state === 'at' && !r.hidden && r.slot.poi.id === 'warung' && r.slot.tag === tag)
        return r;
  return null;
}
const sriHere = () => keeper()?.npc.id === 'sri';
const behindCounter = () => player.x > COUNTER.x1 && player.x < W.x1 && player.z > W.z0 && player.z < W.z1;

/* ================= the basket ================= */

/** What Raka has picked off the shelves and not paid for yet. */
const basket = new Map<string, number>();
const basketCount = () => [...basket.values()].reduce((a, b) => a + b, 0);
const basketTotal = () => [...basket].reduce((a, [id, n]) => a + item(id).price * n, 0);
const basketText = () =>
  [...basket].map(([id, n]) => `${item(id).name}${n > 1 ? ` ×${n}` : ''}`).join(', ') || 'nothing yet';

function shelfMenu(sh: (typeof SHELVES)[number], note?: string) {
  const rows: Row[] = sh.items.map(id => {
    const it = item(id);
    const n = basket.get(id) ?? 0;
    return {
      label: it.name,
      note: `${rupiah(it.price)}${n ? ` · ${n} in hand` : ''}`,
      run: () => {
        closePanel(false);
        takeFrom(id, sh.at, () => {
          basket.set(id, n + 1);
          shelfMenu(sh, `You take ${it.name.toLowerCase()}. ${it.blurb}`);
        });
      },
    };
  });
  openPanel({
    title: sh.name,
    sub: `Picked: ${basketText()}${basket.size ? ` · ${rupiah(basketTotal())}` : ''}`,
    body: note ?? 'Take what you need, then pay at the counter.',
    rows,
    keepPage: true,
  });
}

/** Walked out with unpaid things: they go back on the shelves. */
function putBack() {
  if (!basket.size) return;
  basket.clear();
  toast('You put them back', 'Pay at the counter before you leave.');
}

/* ================= the counter ================= */

function counterMenu(note?: string) {
  const who = keeper();
  if (!who) return;
  const h = hour();
  const shiftReason =
    shiftDay === S.day
      ? 'already helped today'
      : h < 7 || h >= 20
        ? 'open 07:00–20:00'
        : st.stats.energy < 15
          ? 'too tired'
          : !sriHere()
            ? 'Bu Sri isn’t here'
            : undefined;
  const total = basketTotal();
  const rows: Row[] = [];
  if (basket.size)
    rows.push({
      label: `Pay for what you picked (${basketCount()})`,
      note: rupiah(total),
      disabled: st.canAfford(total) ? undefined : 'not enough money',
      run: () => pay(who),
    });
  for (const id of COUNTER_ITEMS) {
    const it = item(id);
    const closed = id === 'nasi_uduk' && h >= 10.5 ? 'not now' : undefined;
    rows.push({
      label: it.name,
      note: `${rupiah(it.price)}${st.count(id) ? ` · ${st.count(id)} in bag` : ''}`,
      disabled: closed ?? (st.canAfford(it.price) ? undefined : 'not enough money'),
      run: () => buyOne(who, id),
    });
  }
  rows.push({
    label: 'Help Bu Sri serve customers',
    note: 'Rp 25.000 + tips',
    disabled: shiftReason,
    run: startShift,
  });
  openPanel({
    title: WARUNG,
    sub: `${who.npc.name} is behind the counter`,
    body: note ?? (basket.size ? `In your hands: ${basketText()}.` : undefined),
    rows,
    onClose: () => (who.talking = false),
  });
  who.talking = true;
}

function pay(who: Resident) {
  const total = basketTotal();
  if (!st.spend(total)) return;
  const items = [...basket];
  basket.clear();
  closePanel(false);
  buyToBag(
    items[0][0],
    () => serveResident(who),
    [who.x, who.z],
    () => {
      for (const [id, n] of items) {
        st.add(id, n);
        emit('buy', `warung:${id}`);
      }
      S.time += 1;
      counterMenu(`Paid ${rupiah(total)}. “Makasih, Mas!” It all goes in a kresek bag, then your bag.`);
    },
  );
}

function buyOne(who: Resident, id: string) {
  const it = item(id);
  if (!st.spend(it.price)) return;
  closePanel(false);
  emit('buy', `warung:${id}`);
  buyToBag(
    id,
    () => serveResident(who),
    [who.x, who.z],
    () => {
      st.add(id);
      S.time += 1;
      counterMenu(`${it.name} goes in your bag. ${it.blurb}`);
    },
  );
}

/* ================= the warung shift ================= */

let shiftDay = -1;
const SHIFT_SECONDS = 60;
interface Order {
  k: number;
  want: string[];
  arrived: boolean;
}
let shift: {
  state: 'go_round' | 'on';
  ends: number;
  served: number;
  tips: number;
  mistakes: number;
  hands: string[];
  orders: Order[];
  next: number;
} | null = null;

function startShift() {
  closePanel();
  shiftDay = S.day;
  shift = { state: 'go_round', ends: 0, served: 0, tips: 0, mistakes: 0, hands: [], orders: [], next: 0 };
  const sri = keeper();
  if (sri) bubble(sri, () => [sri.x, 1.75, sri.z], 'Pakai celemek, Mas! Come round the back of the counter.', 5);
  taskBox();
}

function newOrder(k: number) {
  const s = shift!;
  const n = 1 + Math.floor(Math.random() * Math.min(3, 1 + s.served / 2));
  const want = Array.from({ length: n }, () => STOCK_BAYS[Math.floor(Math.random() * STOCK_BAYS.length)]);
  const o: Order = { k, want, arrived: false };
  s.orders.push(o);
  const [x, z] = CUSTOMER_SPOTS[k];
  sendShopper(k, [x, z], Math.PI / 2, () => {
    o.arrived = true;
    say(o);
  });
}
const say = (o: Order) => bubble(shoppers[o.k], () => shopperHead(o.k), `${o.want.join(', ')}, Mas!`, 60);

function takeStock(g: string) {
  const s = shift;
  if (!s || s.state !== 'on') return;
  if (s.hands.length >= 3) {
    toast('Your hands are full', 'Hand things over at the counter first.');
    return;
  }
  const k = STOCK_BAYS.indexOf(g);
  takeFrom(STOCK_LOOK[k], bayAt(k), () => {
    s.hands.push(g);
    taskBox();
  });
}
/** What each stock bay looks like in the hand. */
const STOCK_LOOK = ['beras', 'telur', 'kopi_sachet', 'keripik_pisang', 'beras', 'kecap'];

function handOver() {
  const s = shift;
  if (!s || s.state !== 'on') return;
  const o = s.orders.find(o => o.arrived);
  if (!o || !s.hands.length) return;
  let wrong = 0;
  for (const g of s.hands) {
    const i = o.want.indexOf(g);
    if (i >= 0) o.want.splice(i, 1);
    else wrong++;
  }
  s.hands = [];
  shopperTake(o.k);
  if (wrong) {
    s.mistakes += wrong;
    s.ends -= 2000 * wrong;
    sfx('bad');
    bubble(shoppers[o.k], () => shopperHead(o.k), 'Bukan itu, Mas! Not that one.', 2.5);
    setTimeout(() => shift && o.want.length && say(o), 2500);
  }
  if (!o.want.length) {
    s.served++;
    s.tips += 2000;
    sfx('coin');
    bubble(shoppers[o.k], () => shopperHead(o.k), 'Makasih, Mas!', 2.5);
    sendAway(o.k);
    s.orders = s.orders.filter(x => x !== o);
    s.next = performance.now() + 1500;
  } else if (!wrong) say(o);
  taskBox();
}

function endShift() {
  const s = shift;
  if (!s) return;
  shift = null;
  taskBox();
  for (const o of s.orders) {
    clearBubble(shoppers[o.k]);
    sendAway(o.k);
  }
  if (s.state !== 'on') return;
  const pay = s.served < 2 ? 10000 : 25000;
  const sri = residents.find(r => r.npc.id === 'sri')!.npc;
  passTime(60, 'Serving customers at the warung…', () => {
    clearShoppers();
    st.earn(pay + s.tips);
    st.addEnergy(-10);
    st.addMood(3);
    st.practise('charisma', 6 + s.served * 2);
    const ch = social.befriend(sri, 2 + Math.floor(s.served / 2), S.day);
    emit('shift');
    repute(1, 'You helped out at the warung.', S.day, true);
    toast(
      `Warung shift: +${rupiah(pay + s.tips)}`,
      `${s.served} customers served${s.mistakes ? `, ${s.mistakes} mix-ups` : ''}. ${ch.delta > 0 ? 'Bu Sri likes you more.' : 'Bu Sri is grateful.'}`,
    );
  });
}

/** The little box that says what's going on during the shift. */
function taskBox() {
  const el = $('task');
  const s = shift;
  el.hidden = !s;
  if (!s) return;
  if (s.state === 'go_round') {
    el.innerHTML = '<b>Warung shift</b><span>Go round the back of the counter (the gap by the back wall).</span>';
    return;
  }
  const left = Math.max(0, Math.ceil((s.ends - performance.now()) / 1000));
  const waiting = s.orders.filter(o => o.arrived).map(o => o.want.join(', '));
  el.innerHTML =
    `<b>Warung shift · ${left}s · ${s.served} served</b>` +
    `<span>Wanted: ${waiting.join(' / ') || '…someone’s coming'}</span>` +
    `<span>In your hands: ${s.hands.join(', ') || 'nothing'}</span>` +
    `<span>Take from the shelves behind you, hand over at the counter.</span>`;
}

let boxT = 0;
/** Every frame. */
export function updateWarungShop() {
  const s = shift;
  if (!s) return;
  if (s.state === 'go_round') {
    if (behindCounter()) {
      s.state = 'on';
      s.ends = performance.now() + SHIFT_SECONDS * 1000;
      s.next = performance.now() + 500;
      taskBox();
    } else if (S.inside !== WARUNG && inWorld()) {
      // Walked off instead.
      shift = null;
      shiftDay = -1;
      taskBox();
    }
    return;
  }
  const now = performance.now();
  if (now >= s.ends || (!behindCounter() && inWorld())) return endShift();
  // A new customer when a spot is free.
  if (now >= s.next && s.orders.length < 2) {
    const free = [0, 1].find(k => !s.orders.some(o => o.k === k) && shoppers[k].state === 'off');
    if (free !== undefined) {
      newOrder(free);
      s.next = now + 4000 + Math.random() * 3000;
    }
  }
  if (now - boxT > 400) {
    boxT = now;
    taskBox();
  }
}

/* ================= world hooks ================= */

export function registerWarungShop(it: Interior) {
  it.onExit = () => putBack();
  // The self-service shelves.
  for (const sh of SHELVES)
    interactables.push({
      x: sh.at[0],
      z: sh.at[2],
      y: sh.at[1],
      size: sh.id === 'jajan' ? 0.55 : 0.4,
      reach: 1.9,
      inside: WARUNG,
      label: () => (shift || behindCounter() ? null : keeper() ? `Look at the ${sh.name.toLowerCase()}` : null),
      run: () => shelfMenu(sh),
    });
  // The counter, from the customers' side (or handing over, during a shift).
  interactables.push({
    x: (COUNTER.x0 + COUNTER.x1) / 2,
    z: -3.55,
    y: COUNTER.h,
    size: 0.7,
    reach: 2.0,
    inside: WARUNG,
    label: () => {
      if (shift?.state === 'on') return shift.hands.length && shift.orders.some(o => o.arrived) ? 'Hand it over' : null;
      if (behindCounter() || !keeper()) return null;
      return basket.size ? `Pay ${keeper()!.npc.name} (${rupiah(basketTotal())})` : `${WARUNG}: order or pay`;
    },
    run: () => (shift?.state === 'on' ? handOver() : counterMenu()),
  });
  // The stock bays behind the counter (the shift).
  STOCK_BAYS.forEach((g, k) => {
    const [x, y, z] = bayAt(k);
    interactables.push({
      x,
      z,
      y,
      size: 0.22,
      reach: 1.8,
      inside: WARUNG,
      label: () => (shift?.state === 'on' ? `Take ${g.toLowerCase()}` : null),
      run: () => takeStock(g),
    });
  });
}

/* ================= save ================= */

export const saveWarung = () => ({ shiftDay });
export function loadWarung(d: { shiftDay?: number } | undefined) {
  shiftDay = d?.shiftDay ?? -1;
}
