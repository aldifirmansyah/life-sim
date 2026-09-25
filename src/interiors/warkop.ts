/* Warkop Berkah (interiors plan step 4). The room behind the terrace is the
   warkop proper: Pak Slamet's kopi counter across the back (the big kettle on
   its kompor, jars of kerupuk and rempeyek, glasses, a menu board), a long table
   with benches, a TV on a bracket, a calendar, a fan. A folding shutter closes
   the doorway when he goes home.
   - Sit at the inside table or the terrace table (E), then E again to order:
     Pak Slamet walks the kopi over to you. Standing orders still work at the
     counter.
   - Nobar: on Wednesday and Saturday nights there's a match on (19:45–22:00).
     The football fans come over, the TV shows the game, and every goal brings a
     cheer. Watching with them counts as spending time together. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { mat, type Batch } from '../render/batch';
import { addCol } from '../core/collision';
import { S } from '../core/state';
import { player } from '../core/player';
import { residents, setPlan, serve as serveResident, headPos } from '../npc/npcs';
import { poiById } from '../npc/places';
import { interactables } from '../game/interact';
import { sitDown, standUp, seatedOn, receive, type Seat } from '../game/actions';
import { item, rupiah, STOCK, EAT_HERE } from '../game/items';
import * as st from '../game/stats';
import { emit } from '../game/bus';
import { befriendAll, gainsText } from '../game/gains';
import { isMatchNight } from '../game/calendar';
import { openPanel, closePanel, type Row } from '../ui/panel';
import { openShop, present, finishEating } from '../ui/activities';
import { toast } from '../ui/hud';
import { bubble } from '../ui/bubbles';
import { sfx } from '../audio/audio';
import { social } from '../social/social';
import { interiors, type Interior } from './interior';
import { Shutter } from './shutter';
import { WK } from './warkoplayout';

export const WARKOP = 'Warkop Berkah';
const WOOD = '#7a5230',
  WOOD_D = '#5e3d22',
  PAINT = '#f1e6c8';

const slamet = () => residents.find(r => r.npc.id === 'slamet')!;
const slametHere = () => present('slamet', 'warkopIn', 'owner');
/** Pak Slamet is on duty (at the counter, or on his way there or back). */
function warkopOpen() {
  const r = slamet();
  return r.slot.poi.id.startsWith('warkop') && !r.hidden;
}
const insideRoom = () => player.x > WK.x0 && player.x < WK.x1 && player.z > WK.z0 - 0.1 && player.z < WK.z1;

/* ================= the room ================= */

function build(set: PropSet) {
  const P = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    c: string,
    b: Batch = set.solid,
    ry = 0,
    rx = 0,
    rz = 0,
  ) => b.add(mat(x, y, z, sx, sy, sz, ry, rx, rz), c);
  const Wc = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, c: string, col = true) =>
    set.box(x0, x1, y0, y1, z0, z1, c, { col });
  const colOnly = (x0: number, x1: number, z0: number, z1: number) => {
    const c = addCol(x0, x1, z0, z1);
    c.on = false;
    set.cols.push(c);
  };
  const legs = (x0: number, x1: number, z0: number, z1: number, h: number, t = 0.05) => {
    for (const x of [x0 + t, x1 - t]) for (const z of [z0 + t, z1 - t]) P(x, WK.fl + h / 2, z, t, h, t, WOOD_D);
  };
  const { x0, x1, z0, z1, fl, ce } = WK;
  const cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2;

  /* Floor (a cement floor with a worn patch), plafon, painted walls, skirting. */
  P(cx, fl / 2, cz, x1 - x0, fl, z1 - z0, '#b9b2a2');
  P(-9.2, fl + 0.002, 21.5, 2.4, 0.004, 1.6, '#a9a292');
  P(cx, ce + 0.015, cz, x1 - x0, 0.03, z1 - z0, '#e9dcc0');
  for (let x = x0 + 1.2; x < x1; x += 1.2) P(x, ce - 0.01, cz, 0.05, 0.02, z1 - z0, '#cdbd9a');
  P(cx, (fl + ce) / 2, z1 - 0.006, x1 - x0, ce - fl, 0.01, PAINT);
  P(x0 + 0.006, (fl + ce) / 2, cz, 0.01, ce - fl, z1 - z0, PAINT);
  P(x1 - 0.006, (fl + ce) / 2, cz, 0.01, ce - fl, z1 - z0, PAINT);
  // A green dado band, the way warkop walls are painted.
  P(cx, fl + 0.5, z1 - 0.012, x1 - x0, 1.0, 0.012, '#6f9a7a');
  P(x0 + 0.012, fl + 0.5, cz, 0.012, 1.0, z1 - z0, '#6f9a7a');
  P(x1 - 0.012, fl + 0.5, cz, 0.012, 1.0, z1 - z0, '#6f9a7a');

  /* The counter across the back, Pak Slamet behind it. */
  const c = WK.counter;
  Wc(c.x0, c.x1, c.z0, c.z1, fl, fl + c.h - 0.04, '#8a6443');
  P((c.x0 + c.x1) / 2, fl + c.h - 0.02, (c.z0 + c.z1) / 2, c.x1 - c.x0 + 0.06, 0.04, c.z1 - c.z0 + 0.06, WOOD);
  for (let x = c.x0 + 0.3; x < c.x1 - 0.2; x += 0.6) P(x, fl + 0.5, c.z0 - 0.005, 0.5, 0.6, 0.01, '#c9b88a');
  const top = fl + c.h;
  // Kompor and the big kettle at the west end, a thermos, glasses on a tray, jars of kerupuk and rempeyek.
  P(-10.45, top + 0.05, 23.1, 0.36, 0.1, 0.3, '#3a3a3c');
  P(-10.45, top + 0.2, 23.1, 0.13, 0.2, 0.13, '#c9c4b8', set.cyl);
  P(-10.3, top + 0.24, 23.1, 0.12, 0.02, 0.02, '#c9c4b8', set.solid, 0, 0, -0.5);
  P(-10.45, top + 0.33, 23.1, 0.03, 0.06, 0.03, '#2a2a2a', set.cyl);
  P(-9.9, top + 0.15, 23.2, 0.07, 0.3, 0.07, '#d8392a', set.cyl);
  P(-9.4, top + 0.01, 23.1, 0.4, 0.02, 0.28, '#b8bcc0');
  for (let k = 0; k < 6; k++)
    P(-9.55 + (k % 3) * 0.13, top + 0.07, 23.02 + Math.floor(k / 3) * 0.14, 0.035, 0.12, 0.035, '#e8f0f0', set.cyl);
  for (let k = 0; k < 3; k++) {
    P(-8.8 + k * 0.25, top + 0.15, 23.0, 0.09, 0.3, 0.09, '#d8e8e8', set.cyl);
    P(-8.8 + k * 0.25, top + 0.31, 23.0, 0.095, 0.03, 0.095, ['#d8392a', '#3b7dd8', '#f2c14e'][k], set.cyl);
  }
  // Behind: a shelf of coffee tins and sugar jars, the menu board, a calendar.
  P(-9.4, 1.5, z1 - 0.12, 2.2, 0.03, 0.2, WOOD);
  for (let k = 0; k < 9; k++)
    P(-10.35 + k * 0.23, 1.6, z1 - 0.12, 0.07, 0.16, 0.07, ['#6b4a2f', '#e8e2d2', '#c23a2e'][k % 3], set.cyl);
  P(-9.4, 2.05, z1 - 0.02, 1.1, 0.6, 0.02, '#23302a');
  for (let k = 0; k < 5; k++) P(-9.45, 2.25 - k * 0.1, z1 - 0.034, 0.8 - (k % 2) * 0.2, 0.025, 0.004, '#e8e2d2');
  P(-7.2, 1.6, z1 - 0.02, 0.35, 0.5, 0.01, '#f4f1ea');
  P(-7.2, 1.8, z1 - 0.028, 0.35, 0.1, 0.01, '#c23a2e');

  /* The long table and its benches. */
  const t = WK.table;
  P((t.x0 + t.x1) / 2, fl + t.h - 0.02, (t.z0 + t.z1) / 2, t.x1 - t.x0, 0.04, t.z1 - t.z0, WOOD);
  legs(t.x0, t.x1, t.z0, t.z1, t.h - 0.04);
  colOnly(t.x0, t.x1, t.z0, t.z1);
  for (const bz of [WK.benchN, WK.benchS]) {
    P((t.x0 + t.x1) / 2, fl + 0.42, bz, t.x1 - t.x0, 0.04, 0.34, WOOD_D);
    legs(t.x0, t.x1, bz - 0.17, bz + 0.17, 0.4, 0.04);
    colOnly(t.x0, t.x1, bz - 0.17, bz + 0.17);
  }
  // On the table: a jar of kerupuk, an ashtray, a toothpick holder.
  P(-9.4, fl + t.h + 0.14, 21.47, 0.09, 0.28, 0.09, '#d8e8e8', set.cyl);
  P(-9.4, fl + t.h + 0.29, 21.47, 0.095, 0.03, 0.095, '#d8392a', set.cyl);
  P(-8.7, fl + t.h + 0.02, 21.5, 0.06, 0.03, 0.06, '#7a7a7a', set.cyl);
  P(-10.1, fl + t.h + 0.04, 21.45, 0.025, 0.08, 0.025, '#f4f1ea', set.cyl);

  /* The TV on its bracket, a wall fan, a clock, a poster of the local team. */
  const tv = WK.tv;
  P(x0 + 0.1, tv.y - 0.2, tv.z, 0.16, 0.05, 0.1, '#3a3a3a');
  P(tv.x + 0.13, tv.y, tv.z, 0.05, 0.45, 0.78, '#1a1b1e');
  P(x1 - 0.1, 2.25, 22.8, 0.12, 0.12, 0.12, '#e8e8e8', set.cyl, 0, 0, Math.PI / 2);
  P(x1 - 0.2, 2.25, 22.8, 0.2, 0.02, 0.2, '#9fd0e8', set.cyl, 0, 0, Math.PI / 2);
  P(-8.9, 2.3, z0 + 0.03, 0.14, 0.02, 0.14, '#f4efe2', set.cyl, 0, Math.PI / 2);
  P(x1 - 0.015, 1.6, 20.8, 0.01, 0.6, 0.45, '#2f6fb3');
  P(x1 - 0.02, 1.7, 20.8, 0.01, 0.2, 0.35, '#f2c14e');
  // The bulb.
  P(WK.lamp[0], ce - 0.12, WK.lamp[2], 0.01, 0.24, 0.01, '#2a2a2a', set.cyl);
  set.light(WK.lamp[0], WK.lamp[1], WK.lamp[2], 0.05, '#fff0c8');
}

/* ================= the TV ================= */

let screen: THREE.Mesh;
function tvScreen() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), new THREE.MeshBasicMaterial({ color: 0x15181b }));
  m.position.set(WK.tv.x + 0.16, WK.tv.y, WK.tv.z);
  m.rotation.y = Math.PI / 2;
  scene.add(m);
  return m;
}
let flick = 0;
function updateTv(dt: number) {
  const mat = screen.material as THREE.MeshBasicMaterial;
  screen.visible = Math.hypot(player.x - WK.tv.x, player.z - WK.tv.z) < 30;
  if (!warkopOpen()) {
    mat.color.setHex(0x15181b);
    return;
  }
  // A match: the green of the pitch; otherwise whatever is on (sinetron, the news).
  flick -= dt;
  if (flick > 0) return;
  flick = 0.12;
  if (match.on) mat.color.setRGB(0.22 + Math.random() * 0.04, 0.55 + Math.random() * 0.08, 0.25);
  else if (Math.random() < 0.1)
    mat.color.setHex([0x6a9ad0, 0xd8a86a, 0xc86a6a, 0x9a8ad8][Math.floor(Math.random() * 4)]);
}

/* ================= ordering from your seat ================= */

let order: {
  id: string;
  eat: boolean;
  block: { start: number; end: number; location: string; activity: 'work' };
  t0: number;
} | null = null;

function orderMenu(note?: string) {
  const who = slametHere();
  const here = EAT_HERE.warkop ?? [];
  const rows: Row[] = who
    ? STOCK.warkop.map(id => {
        const it = item(id);
        const eat = here.includes(id);
        const closed = id === 'martabak_manis' && S.time / 60 < 17 ? 'not now' : undefined;
        return {
          label: it.name,
          note: `${rupiah(it.price)}${eat ? '' : ' · to take home'}`,
          disabled: order
            ? 'he’s bringing your order'
            : (closed ?? (st.canAfford(it.price) ? undefined : 'not enough money')),
          run: () => placeOrder(id, eat),
        };
      })
    : [];
  rows.push({ label: 'Stand up', run: () => (closePanel(), standUp()) });
  openPanel({
    title: WARKOP,
    sub: who ? 'Pak Slamet will bring it over' : 'Pak Slamet isn’t at the counter',
    body: note,
    rows,
  });
}

/** Where Pak Slamet goes to hand it over: the end of whichever table Raka is at. */
function serveSpot() {
  const inside = insideRoom();
  return inside ? '#warkopIn.serve' : '#warkop.serve';
}

function placeOrder(id: string, eat: boolean) {
  const r = slamet();
  const it = item(id);
  if (!st.spend(it.price)) return;
  closePanel();
  emit('buy', `warkop:${id}`);
  const block = { start: S.time, end: S.time + 30, location: serveSpot(), activity: 'work' as const };
  order = { id, eat, block, t0: performance.now() };
  setPlan(r, S.day, block);
  bubble(r, () => headPos(r), 'Siap, Mas! Coming right up.', 2.5);
}

function deliver() {
  const o = order!;
  const r = slamet();
  order = null;
  receive(
    o.id,
    [r.x, r.z],
    () => serveResident(r),
    o.eat,
    () => {
      setPlan(r, S.day, o.block, true);
      if (o.eat) finishEating(o.id, 0, true);
      else {
        st.add(o.id);
        toast(`${item(o.id).name}: in your bag`, item(o.id).blurb);
      }
    },
  );
}

function updateOrder() {
  if (!order) return;
  const r = slamet();
  // Raka got up before it came: it goes in the bag, or he gets his money back.
  if (!S.seated) {
    const o = order;
    order = null;
    setPlan(r, S.day, o.block, true);
    if (o.eat) st.earn(item(o.id).price);
    else st.add(o.id);
    return;
  }
  const there = r.state === 'at' && r.slot.tag === 'serve';
  // He's there; or it's taking too long (blocked somewhere): the order arrives anyway.
  if ((there && !S.acting) || performance.now() - order.t0 > 25000) deliver();
}

/* ================= nobar: football nights ================= */

const TEAMS = [
  ['Persija', 'Persib'],
  ['Arema', 'Persebaya'],
  ['PSM', 'Bali United'],
  ['Persik', 'PSIS'],
];
const match = { on: false, day: -1, home: '', away: '', a: 0, b: 0, cheered: new Set<string>() };

function updateMatch() {
  const on = isMatchNight(S.day) && S.time >= 19.75 * 60 && S.time < 22 * 60 && warkopOpen();
  if (on && match.day !== S.day) {
    const [home, away] = TEAMS[S.day % TEAMS.length];
    Object.assign(match, { day: S.day, home, away, a: 0, b: 0, cheered: new Set() });
    if (Math.hypot(player.x - WK.tv.x, player.z - WK.tv.z) < 25)
      toast('Nobar at the warkop', `${home} vs ${away} is on.`);
  }
  if (match.on && !on && match.day === S.day && Math.hypot(player.x - WK.tv.x, player.z - WK.tv.z) < 25)
    toast('Full time', `${match.home} ${match.a}–${match.b} ${match.away}`);
  match.on = on;
  if (!on || Math.random() > 1 / 70) return;
  // A goal.
  const homeGoal = Math.random() < 0.55;
  if (homeGoal) match.a++;
  else match.b++;
  const watchers = residents.filter(
    r => r.state === 'at' && r.slot.poi.id.startsWith('warkop') && r.slot.tag === 'seat',
  );
  const near = Math.hypot(player.x - WK.tv.x, player.z - WK.tv.z) < 25;
  if (near) {
    sfx('cheer');
    for (const w of watchers.slice(0, 4))
      bubble(
        w,
        () => headPos(w),
        homeGoal ? 'GOOOL!' : ['Waduh!', 'Aduh…', 'Offside itu!'][Math.floor(Math.random() * 3)],
        2.5,
      );
  }
  // Watching it with them: a little closer to each fan you've cheered with (once each per match).
  const seat = seatedOn();
  if (seat?.slot?.poi.id.startsWith('warkop') && near) {
    const fans = watchers.filter(w => !match.cheered.has(w.npc.id) && social(w.npc).met);
    fans.forEach(w => match.cheered.add(w.npc.id));
    const g = befriendAll(
      fans.map(w => w.npc),
      () => 2,
      S.day,
      { mood: 2 },
    );
    st.addMood(2);
    toast(`${homeGoal ? 'GOOOL!' : 'Goal'} ${match.home} ${match.a}–${match.b} ${match.away}`, gainsText(g));
  }
}

/* ================= put together ================= */

export function buildWarkopInterior(): Interior {
  const set = new PropSet('warkop-dalam');
  build(set);
  set.build();
  screen = tvScreen();
  const shutter = new Shutter(WK.door.x0, WK.door.x1, 19.8, -1, 2.2, warkopOpen, insideRoom, '#8a6443');
  const it: Interior = {
    name: WARKOP,
    rooms: [{ name: 'Dalam', x0: WK.x0, x1: WK.x1, z0: WK.z0, z1: WK.z1 }],
    props: set,
    door: shutter,
    lamp: WK.lamp,
    lampOn: () => warkopOpen(),
  };
  interiors.push(it);
  return it;
}

export function registerWarkop() {
  // Sit at a table (inside, or out on the terrace); E again to order.
  const seatsOf = (poi: string) => poiById.get(poi)!.slots.filter(s => s.tag === 'seat');
  const sitAt = (poi: string, inside: string | undefined, x: number, z: number) =>
    interactables.push({
      x,
      z,
      y: 0.8,
      size: 1.0,
      reach: 2.4,
      inside,
      label: () => (seatsOf(poi).some(s => s.claimedBy === -1) ? 'Sit down at the warkop' : null),
      run: () => {
        const s = seatsOf(poi)
          .filter(s => s.claimedBy === -1)
          .sort(
            (a, b) =>
              Math.hypot(a.approach[0] - player.x, a.approach[1] - player.z) -
              Math.hypot(b.approach[0] - player.x, b.approach[1] - player.z),
          )[0];
        if (!s) return;
        const seat: Seat = { x: s.x, z: s.z, y: s.y, ry: s.ry, approach: s.approach, slot: s };
        sitDown(seat, {
          label: () => (order ? 'Waiting for your order… (E: menu)' : 'Order, or stand up'),
          run: () => orderMenu(),
        });
      },
    });
  sitAt('warkopIn', WARKOP, (WK.table.x0 + WK.table.x1) / 2, (WK.table.z0 + WK.table.z1) / 2);
  sitAt('warkop', undefined, -8.5, 18.6);
  // Or order standing at the counter, as before.
  interactables.push({
    x: -9.3,
    z: (WK.counter.z0 + WK.counter.z1) / 2,
    y: WK.counter.h,
    size: 0.8,
    reach: 2.0,
    inside: WARKOP,
    label: () => (slametHere() ? 'Order at the counter' : null),
    run: () => openShop('warkop'),
  });
}

/** Every frame. */
let acc = 0;
export function updateWarkop(dt: number) {
  updateTv(dt);
  updateOrder();
  acc += dt;
  if (acc < 1) return;
  acc = 0;
  updateMatch();
}
