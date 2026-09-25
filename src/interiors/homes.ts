/* Neighbours' homes (interiors plan step 6). Every resident's row house has its
   front room (ruang tamu) built inside, from the house's own size and door: the
   family's sofa against the partition, a coffee table, two guest chairs, a
   cabinet of good plates, family photos, a clock, a calendar, curtains, a plant.
   The family's rooms behind the partition stay private (a curtained doorway).
   You can't just walk in:
   - Knock or call out at the door (E: "Kulonuwun… Assalamualaikum!"). If the family
     is home, awake, it's not too late, and they know you (friendship 10+), the one
     who likes you best says "Masuk, masuk!", comes and sits on the sofa, and the
     door is open for you. Otherwise you get an answer through the door, or none.
   - Bertamu: sit in a guest chair (E); E again for the visit menu: chat, accept the
     teh they bring, or pamit (take your leave). A visit of a while is good for the
     friendship (once a day); staying past an hour and a half isn't; walking out
     without pamit is rude.
   - Walking in uninvited (through a door someone just opened) turns you back. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { mat, type Batch } from '../render/batch';
import { addCol } from '../core/collision';
import { S } from '../core/state';
import { player } from '../core/player';
import { residents, setPlan, activityOf, serve as serveResident, type Resident } from '../npc/npcs';
import { homes, homeHouses } from '../npc/places';
import { carveHouse, type House } from '../world/houses';
import { interactables } from '../game/interact';
import { sitDown, standUp, receive, seatedOn } from '../game/actions';
import { social, befriend, remember, properName } from '../social/social';
import { openPanel, closePanel, type Row } from '../ui/panel';
import { openDialogue } from '../ui/dialogue';
import { finishEating } from '../ui/activities';
import { toast } from '../ui/hud';
import { bubble } from '../ui/bubbles';
import { sfx } from '../audio/audio';
import { Door } from './door';
import { interiors, type Interior } from './interior';
import { homeLayout, T, FL, CE } from './homelayout';

type Layout = ReturnType<typeof homeLayout>;
interface Home {
  household: string;
  house: House;
  poi: string;
  name: string;
  L: Layout;
  door: Door;
  it: Interior;
}
export const visitHomes: Home[] = [];

const PAINTS = ['#f1e8d0', '#e3eee2', '#e8e4f0', '#f3e0d8', '#dfe9ef', '#efe9c9'];
const FLOORS = [
  ['#d6c9ae', '#cbbd9f'],
  ['#e2e1da', '#d5d3ca'],
  ['#c9b8a0', '#bba88e'],
  ['#d8d0c4', '#ccc2b4'],
];
const SOFAS = ['#6b7f5a', '#8a3b3b', '#3f5f8a', '#7a5a3a', '#5a6f7f'];
const hashStr = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 7) >>> 0;
const abs = () => S.day * 1440 + S.time;

/** Before the batches are built: hollow out every resident's home. */
export function carveHomes() {
  for (const h of homeHouses.values()) carveHouse(h);
}

/* ================= the front room ================= */

function build(home: Home, set: PropSet) {
  const h = home.house,
    L = home.L;
  const seed = hashStr(home.household);
  const paint = PAINTS[seed % PAINTS.length],
    floor = FLOORS[(seed >> 3) % FLOORS.length],
    sofaC = SOFAS[(seed >> 5) % SOFAS.length];
  const P = (
    lx: number,
    y: number,
    lz: number,
    sx: number,
    sy: number,
    sz: number,
    c: string,
    b: Batch = set.solid,
    ry = 0,
    rx = 0,
    rz = 0,
  ) => {
    const [x, z] = h.F(lx, lz);
    b.add(mat(x, y, z, sx, sy, sz, h.th + ry, rx, rz), c);
  };
  const colL = (lx0: number, lx1: number, lz0: number, lz1: number) => {
    const a = h.F(lx0, lz0),
      b = h.F(lx1, lz1);
    const c = addCol(a[0], b[0], a[1], b[1]);
    c.on = false;
    set.cols.push(c);
  };
  const legs = (x: number, z: number, w: number, d: number, top: number, c = '#5e3d22') => {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) P(x + sx * (w / 2 - 0.04), FL + top / 2, z + sz * (d / 2 - 0.04), 0.04, top, 0.04, c);
  };
  const { ix, iz1, pz } = L;
  const cz = (pz + iz1) / 2,
    depth = iz1 - pz;

  /* Floor tiles, plafon, paint on the walls (the front one round the doorway), skirting. */
  const S = 0.5;
  for (let x = -ix; x < ix - 1e-3; x += S)
    for (let z = pz; z < iz1 - 1e-3; z += S) {
      const x1 = Math.min(ix, x + S),
        z1 = Math.min(iz1, z + S);
      const odd = (Math.round((x + ix) / S) + Math.round((z - pz) / S)) % 2;
      P((x + x1) / 2, FL / 2, (z + z1) / 2, x1 - x - 0.008, FL, z1 - z - 0.008, floor[odd]);
    }
  P(0, CE + 0.015, cz, ix * 2, 0.03, depth + 0.02, '#f3efe6');
  for (const sx of [-1, 1]) P(sx * (ix - 0.006), (FL + CE) / 2, cz, 0.01, CE - FL, depth, paint);
  for (const [a, b] of [
    [-ix, h.dx - 0.5],
    [h.dx + 0.5, ix],
  ])
    if (b > a) P((a + b) / 2, (FL + CE) / 2, iz1 - 0.006, b - a, CE - FL, 0.01, paint);
  P(h.dx, (2.2 + CE) / 2, iz1 - 0.006, 1.0, CE - 2.2, 0.01, paint);
  P(h.dx, FL / 2, h.fz - T / 2, 1.0, FL, T, '#8a7f6c');

  /* The partition to the family's rooms: a curtained doorway on the door side, closed off. */
  const cd = -L.side * 0.4;
  for (const [a, b] of [
    [-ix, cd - 0.45],
    [cd + 0.45, ix],
  ])
    if (b > a) P((a + b) / 2, (FL + CE) / 2, pz - 0.05, b - a, CE - FL, 0.1, paint);
  P(cd, (2.05 + CE) / 2, pz - 0.05, 0.9, CE - 2.05, 0.1, paint);
  P(cd, 1.08, pz - 0.02, 0.88, 1.95, 0.02, ['#8a3b3b', '#3a7a5a', '#6b4a8a', '#b8862a'][seed % 4], set.cloth);
  colL(-ix, ix, pz - 0.1, pz);

  /* Curtains drawn over the front windows (they're only glass on the outside). */
  h.slots.forEach((x, i) => {
    if (i === h.di) return;
    P(x, 2.12, iz1 - 0.05, 1.3, 0.025, 0.025, '#5a3e28');
    P(x, 1.55, iz1 - 0.04, 1.2, 1.1, 0.02, ['#e8c9a0', '#d8e2c8', '#e0cfe0'][seed % 3], set.cloth);
  });

  /* The kursi tamu: sofa, coffee table, two guest chairs. */
  const sf = L.sofa;
  P(sf.x, FL + 0.2, sf.z, sf.w, 0.2, sf.d, sofaC);
  for (const sx of sf.seats) P(sx, FL + 0.37, sf.z + 0.05, 0.6, 0.14, sf.d - 0.16, sofaC);
  P(sf.x, FL + 0.66, sf.z - sf.d / 2 + 0.09, sf.w, 0.46, 0.18, sofaC);
  for (const e of [-1, 1]) P(sf.x + e * (sf.w / 2 - 0.07), FL + 0.42, sf.z, 0.14, 0.32, sf.d, sofaC);
  colL(sf.x - sf.w / 2, sf.x + sf.w / 2, sf.z - sf.d / 2, sf.z + sf.d / 2);
  const t = L.table;
  P(t.x, FL + 0.42, t.z, t.w, 0.04, t.d, '#7a5230');
  legs(t.x, t.z, t.w, t.d, 0.4);
  P(t.x, FL + 0.445, t.z, t.w - 0.1, 0.004, t.d + 0.06, '#f4efe4', set.cloth);
  P(t.x + 0.2, FL + 0.5, t.z, 0.06, 0.12, 0.06, '#d8e8e8', set.cyl);
  colL(t.x - t.w / 2, t.x + t.w / 2, t.z - t.d / 2, t.z + t.d / 2);
  for (const [x, z] of L.chairs) {
    P(x, FL + 0.42, z, 0.44, 0.04, 0.42, '#7a5230');
    P(x, FL + 0.7, z + 0.2, 0.44, 0.5, 0.04, '#7a5230');
    legs(x, z, 0.44, 0.42, 0.4);
    P(x, FL + 0.46, z, 0.38, 0.05, 0.36, sofaC);
    colL(x - 0.22, x + 0.22, z - 0.21, z + 0.21);
  }
  P(t.x, FL + 0.003, t.z + 0.1, 2.0, 0.004, 1.9, ['#8a4a3a', '#3f5f5a', '#6a4a6a'][seed % 3]);

  /* A cabinet of the good plates, photos over the sofa, a clock, a calendar, a plant. */
  const cb = L.cabinet;
  P(cb.x, FL + 0.8, cb.z, cb.w, 1.6, cb.d, '#6b4a2f');
  P(cb.x, FL + 1.15, cb.z + cb.d / 2 + 0.005, cb.w - 0.1, 0.7, 0.01, '#b9d4dc');
  for (let k = 0; k < 4; k++)
    P(cb.x - 0.3 + k * 0.2, FL + 1.2, cb.z + 0.05, 0.16, 0.16, 0.02, '#f4f2ec', set.cyl, 0, Math.PI / 2);
  colL(cb.x - cb.w / 2, cb.x + cb.w / 2, cb.z - cb.d / 2, cb.z + cb.d / 2);
  for (let k = 0; k < 3; k++) {
    const x = sf.x - 0.45 + k * 0.45,
      y = 1.75 + (k % 2) * 0.15;
    P(x, y, pz + 0.02, 0.32, 0.4, 0.02, '#3a2616');
    P(x, y, pz + 0.035, 0.26, 0.34, 0.005, ['#c9bda2', '#b8a88a', '#d8c8a8'][k]);
  }
  P(-L.side * 0.2, 2.35, pz + 0.02, 0.15, 0.02, 0.15, '#f4efe2', set.cyl, 0, Math.PI / 2);
  P(-L.side * (ix - 0.02), 1.6, cz, 0.01, 0.45, 0.33, '#f4f1ea', set.solid, Math.PI / 2);
  P(L.side * (ix - 0.3), FL + 0.2, iz1 - 0.3, 0.16, 0.4, 0.16, '#b5562f', set.cyl);
  P(L.side * (ix - 0.3), FL + 0.6, iz1 - 0.3, 0.3, 0.5, 0.3, '#4f8a3a', set.cone);
  // The lamp.
  P(0, CE - 0.15, cz, 0.01, 0.3, 0.01, '#2a2a2a', set.cyl);
  P(0, CE - 0.34, cz, 0.18, 0.09, 0.18, '#e6e2d6', set.cone);
}

/* ================= visiting ================= */

let visit: {
  home: Home;
  host: Resident;
  block: { start: number; end: number; location: string; activity: 'chat' };
  t0: number;
  served: boolean;
  hinted: boolean;
  left: boolean;
} | null = null;
const visitedDay = new Map<string, number>();

const members = (home: Home) => residents.filter(r => r.def.household === home.household);
const atHome = (r: Resident, home: Home, tag: string) =>
  r.state === 'at' && r.slot.poi.id === home.poi && r.slot.tag === tag;

/** A voice through the door. */
function voice(home: Home, text: string) {
  const d = home.door;
  bubble(home, () => [d.x, 2.3, d.z], text, 3.5);
}

function knock(home: Home) {
  sfx('knock');
  toast('“Kulonuwun… Assalamualaikum!”', 'You knock and call out at the door.');
  setTimeout(() => answer(home), 1600);
}

function answer(home: Home) {
  const fam = members(home);
  const onTeras = fam.find(r => atHome(r, home, 'teras'));
  const inside = fam.filter(r => atHome(r, home, 'inside') && activityOf(r) !== 'sleep');
  if (!inside.length) {
    if (onTeras) bubble(onTeras, () => [onTeras.x, 1.75, onTeras.z], 'Lho, saya di sini, Mas!', 3);
    else if (fam.some(r => atHome(r, home, 'inside'))) toast('No answer', 'The house is quiet. They must be asleep.');
    else toast('No answer', 'Nobody seems to be home.');
    return;
  }
  // Whoever inside likes Raka best comes to the door.
  const host = [...inside].sort((a, b) => b.npc.playerRelationship.friendship - a.npc.playerRelationship.friendship)[0];
  if (S.time >= 21 * 60) {
    voice(home, 'Maaf, sudah malam, Mas. Besok saja ya.');
    if (S.time >= 22 * 60) befriend(host.npc, -1, S.day);
    return;
  }
  const met = social(host.npc).met;
  if (!met || host.npc.playerRelationship.friendship < 10 || host.npc.age < 13) {
    voice(
      home,
      met
        ? 'Oh, Mas Raka. Maaf, lagi repot. Lain kali ya.'
        : 'Ya? Siapa ya? … Oh, tetangga baru. Maaf, lagi repot, lain kali ya.',
    );
    toast('Not invited in', 'They don’t know you well enough yet. Chat with them on their teras first.');
    return;
  }
  voice(home, 'Wa’alaikumsalam! Eh, Mas Raka. Masuk, masuk!');
  const k = home.poi;
  const block = { start: S.time, end: S.time + 120, location: `#${k}.host`, activity: 'chat' as const };
  setPlan(host, S.day, block);
  visit = { home, host, block, t0: abs(), served: false, hinted: false, left: false };
  home.door.target = 1;
  sfx('doorOpen');
}

function seatAt(home: Home, k: number) {
  const h = home.house,
    L = home.L;
  const [lx, lz] = L.chairs[k];
  const [x, z] = h.F(lx, lz);
  const [ax, az] = h.F(L.chairOut[0], L.chairOut[1]);
  // Facing the sofa (local −z).
  const [fx, fz] = h.F(lx, lz - 1);
  return { x, z, y: FL + 0.44, ry: Math.atan2(fx - x, fz - z), approach: [ax, az] as [number, number] };
}

function visitMenu() {
  const v = visit;
  if (!v) return;
  const host = v.host;
  const name = properName(host.npc);
  const rows: Row[] = [
    {
      label: `Chat with ${name}`,
      run: () => {
        closePanel();
        void openDialogue(host);
      },
    },
  ];
  if (!v.served)
    rows.push({
      label: `Accept the teh ${name} brings`,
      run: () => {
        closePanel();
        v.served = true;
        receive(
          'teh_manis',
          [host.x, host.z],
          () => serveResident(host),
          true,
          () => finishEating('teh_manis', 0, true),
        );
      },
    });
  rows.push({ label: 'Pamit (take your leave)', run: () => (closePanel(), pamit()) });
  openPanel({
    title: `Bertamu · ${v.home.name}`,
    sub: `${name} is sitting with you`,
    body: v.served ? undefined : `“Diminum, Mas, tehnya.” ${name} has made you a glass of teh.`,
    rows,
  });
}

function pamit() {
  const v = visit;
  if (!v) return;
  if (seatedOn()) standUp();
  v.left = true;
  const mins = abs() - v.t0;
  const host = v.host;
  const once = visitedDay.get(host.npc.id) !== S.day;
  let text: string;
  if (mins > 90) {
    befriend(host.npc, -2, S.day);
    text = `You stayed a long while. ${properName(host.npc)} looks tired. ♥ −2`;
  } else if (mins >= 8 && once) {
    visitedDay.set(host.npc.id, S.day);
    const ch = befriend(host.npc, v.served ? 4 : 3, S.day, true);
    remember(host.npc, { day: S.day, kind: 'visit', text: 'Raka came round to visit', weight: 2 });
    text = `A proper visit. ${properName(host.npc)} ♥ +${ch.delta}`;
  } else text = mins < 8 ? 'A short visit.' : `${properName(host.npc)} is glad you came again.`;
  bubble(host, () => [host.x, 1.3, host.z], 'Hati-hati, Mas. Sering-sering main ke sini ya!', 3);
  toast('Pamit', text);
  endVisit(v);
}

function endVisit(v: NonNullable<typeof visit>) {
  setPlan(v.host, S.day, v.block, true);
  if (visit === v) visit = null;
}

/* ================= put together ================= */

export function buildHomeInteriors() {
  for (const [household, house] of homeHouses) {
    const poi = homes.get(household)!.id;
    const fam = residents.filter(r => r.def.household === household).sort((a, b) => b.npc.age - a.npc.age);
    const head = fam[0];
    if (!head) continue;
    const L = homeLayout(house);
    const set = new PropSet(`home-${household}`);
    const door = new Door(house.F, house.th, house.dx, house.fz, house.doorC);
    const home = { household, house, poi, name: `Rumah ${properName(head.npc)}`, L, door } as Home;
    build(home, set);
    set.build();
    const [lx, lz] = house.F(0, (L.pz + L.iz1) / 2);
    const [r0, r1] = [house.F(-L.ix, L.pz), house.F(L.ix, L.iz1 + 0.02)];
    const it: Interior = {
      name: home.name,
      rooms: [
        {
          name: 'Ruang tamu',
          x0: Math.min(r0[0], r1[0]),
          x1: Math.max(r0[0], r1[0]),
          z0: Math.min(r0[1], r1[1]),
          z1: Math.max(r0[1], r1[1]),
        },
      ],
      props: set,
      door,
      lamp: [lx, CE - 0.35, lz],
      // Only while Raka is in; walking past at night the houses stay as they are.
      lampOn: () => S.inside === home.name,
      showWithin: 9,
      sandals: sandalsAt(house),
      onEnter: () => entered(home),
      onExit: () => exited(home),
    };
    home.it = it;
    interiors.push(it);
    visitHomes.push(home);

    // The door: knock from outside; open and close it while you're visiting.
    interactables.push({
      x: door.x,
      z: door.z,
      y: 1.1,
      size: 0.8,
      reach: 2.8,
      inside: '*',
      label: () => {
        const mine = visit?.home === home;
        if (S.inside === home.name || (mine && !visit!.left))
          return door.target > 0.5 ? 'Close the door' : 'Open the door';
        if (S.inside) return null;
        return 'Knock (kulonuwun)';
      },
      run: () => {
        const mine = visit?.home === home;
        if (S.inside === home.name || (mine && !visit!.left)) door.toggle();
        else knock(home);
      },
    });
    // The guest chairs.
    L.chairs.forEach((_, k) => {
      const s = seatAt(home, k);
      interactables.push({
        x: s.x,
        z: s.z,
        y: FL + 0.5,
        size: 0.35,
        reach: 1.8,
        inside: home.name,
        label: () => (visit?.home === home && !visit.left ? 'Sit down (silakan duduk)' : null),
        run: () => sitDown(s, { label: () => 'Visit: chat, teh, or pamit', run: visitMenu }),
      });
    });
  }
}

function sandalsAt(house: House) {
  const g = new THREE.Group();
  const sm = new THREE.MeshLambertMaterial({ color: '#3b5f8a' });
  for (const o of [-0.09, 0.09]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.26), sm);
    s.position.set(o, 0.13, 0);
    s.rotation.y = o * 1.2;
    g.add(s);
  }
  const [x, z] = house.F(house.dx + 0.62, house.fz + 0.42);
  g.position.set(x, 0, z);
  g.rotation.y = house.th;
  g.visible = false;
  scene.add(g);
  return g;
}

function entered(home: Home) {
  // Not invited: back out you go.
  if (visit?.home !== home || visit.left) {
    const [x, z] = home.house.F(home.house.dx, home.house.fz + 0.9);
    player.x = x;
    player.z = z;
    player.vx = player.vz = 0;
    toast('You can’t just walk in', 'Knock and wait to be asked in (kulonuwun).');
    return;
  }
  toast('“Assalamualaikum, permisi.”', 'You slip off your sandals and step in.');
  const h = visit.host;
  setTimeout(() => visit && bubble(h, () => [h.x, 1.4, h.z], 'Silakan duduk, Mas.', 3), 900);
}

function exited(home: Home) {
  const v = visit;
  if (!v || v.home !== home) return;
  if (!v.left) {
    befriend(v.host.npc, -2, S.day);
    toast('You left without saying goodbye', `Walking out without pamit is rude. ${properName(v.host.npc)} ♥ −2`);
  }
  endVisit(v);
}

let acc = 0;
/** Once a second: the host hints when a visit runs long, and a visit ends if the host has to go. */
export function updateHomes(dt: number) {
  acc += dt;
  if (acc < 1) return;
  acc = 0;
  const v = visit;
  if (!v) return;
  const mins = abs() - v.t0;
  if (mins > 70 && !v.hinted && !v.left) {
    v.hinted = true;
    const late = S.time >= 17 * 60;
    bubble(v.host, () => [v.host.x, 1.3, v.host.z], late ? 'Wah, sudah malam ya, Mas…' : 'Wah, sudah siang ya…', 3.5);
  }
  // Invited but never came in: the invitation lapses.
  if (S.inside !== v.home.name && !v.left && mins > 20) {
    v.home.door.target = 0;
    endVisit(v);
  }
}
