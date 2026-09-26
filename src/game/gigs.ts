/* Side gigs and hobbies (v2 step 18): repeatable things with some variety.
   - Nab Food rider: go online in the Nab app; an order comes in from a food centre
     near Aldi (pick it up there), to a door 250–700 m away (the marker counts down).
     Pay S$4 + S$0.60 per 100 m, a S$2 tip when on time. Best on a Pedal-Lah bike.
   - The community centre in Clementi: badminton nights on Thursdays 19:30–22:00
     (the regulars on court; a timing game), and the Karaoke Kaki room any evening
     (S$15, a song as a timing game).
   - The East Coast running club: Saturdays 06:45–08:30 at the Lagoon (keep up in a
     race game along the beach; 50 minutes).
   - Fishing off the jetty at MacRitchie Reservoir (catch and release; a reflex game).
   Favours for people Aldi knows are in npc/people.ts. */
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { S } from '../core/state';
import { player } from '../core/player';
import { addFloor } from '../core/levels';
import { register } from './interact';
import { markTo } from './marker';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/hud';
import { startGame } from '../ui/minigame';
import { sfx } from '../audio/audio';
import { spend, earn, sgd, addEnergy, addMood } from './stats';
import { weekday } from './calendar';
import { segsNear } from '../city/roads';
import { landAt, townAt, WATERS, placeName } from '../city/geo';
import { ccSpot, freeAt } from '../city/gen';
import { addVendor } from '../npc/vendors';
import { near } from '../places/shops';
import { interiors } from '../interiors/interior';
import { CLEMENTI_HAWKER, LAU_PA_SAT, TEKKA, TB_MARKET, LAGOON, TRAIL } from '../places/sites';

const hour = () => (S.time / 60) % 24;
/** Minutes pass after a game (the panel covered the screen). */
const pass = (m: number) => (S.time = Math.min(S.time + m, 26 * 60 - 1));

/* ---------- Nab Food ---------- */

const PICKUPS: { name: string; x: number; z: number }[] = [
  { name: '448 Clementi', x: CLEMENTI_HAWKER.x, z: CLEMENTI_HAWKER.z + CLEMENTI_HAWKER.d / 2 + 2 },
  { name: 'Lau Pa Sat', x: LAU_PA_SAT.x, z: LAU_PA_SAT.z + LAU_PA_SAT.d / 2 + 2 },
  { name: 'Tekka Centre', x: TEKKA.x, z: TEKKA.z + TEKKA.d / 2 + 2 },
  { name: 'Tiong Bahru Market', x: TB_MARKET.x, z: TB_MARKET.z + TB_MARKET.d / 2 + 2 },
  { name: 'East Coast Lagoon', x: LAGOON.x, z: LAGOON.z + LAGOON.d / 2 + 2 },
];
const rider = {
  online: false,
  job: null as null | {
    phase: 'pickup' | 'drop';
    from: { name: string; x: number; z: number };
    to: { name: string; x: number; z: number };
    pay: number;
    /** Real seconds left for the tip. */
    left: number;
  },
  wait: 0,
  done: 0,
  earned: 0,
};
/** A door on a pavement 250–700 m from (x, z), in a town. */
function doorNear(x: number, z: number): { name: string; x: number; z: number } | null {
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2,
      d = 250 + Math.random() * 450;
    const px = x + Math.cos(a) * d,
      pz = z + Math.sin(a) * d;
    const t = townAt(px, pz);
    if (!t || ['park', 'airport', 'resort', 'industrial'].includes(t.kind as string)) continue;
    const s = segsNear(px, pz, 40).find(o => o.road.kind !== 'expressway');
    if (!s) continue;
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az) || 1;
    const ux = (s.bx - s.ax) / len,
      uz = (s.bz - s.az) / len;
    const tt = Math.max(5, Math.min(len - 5, (px - s.ax) * ux + (pz - s.az) * uz));
    const side = Math.random() < 0.5 ? 1 : -1;
    const off = s.w / 2 + 2.6;
    const dx = s.ax + ux * tt - uz * off * side,
      dz = s.az + uz * tt + ux * off * side;
    const land = landAt(dx, dz);
    if (land !== 'urban' || !freeAt(dx, dz, 0.5)) continue;
    const blk = 100 + Math.floor(Math.random() * 800);
    return { name: `Blk ${blk}, ${townAt(dx, dz)?.name ?? placeName(dx, dz)}`, x: dx, z: dz };
  }
  return null;
}
function newJob() {
  const h = hour();
  if (h < 7 || h >= 22) return toast('Nab Food', 'No orders now: the food centres are closed. Try from 7am.');
  const from = PICKUPS.slice().sort(
    (a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z),
  )[0];
  if (Math.hypot(from.x - player.x, from.z - player.z) > 1200)
    return toast('Nab Food', 'No orders near here. Head to a food centre area.');
  const to = doorNear(from.x, from.z);
  if (!to) return;
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  const pay = Math.round((4 + (dist / 100) * 0.6) * 100) / 100;
  // Time for the tip: the pickup leg and the ride at a steady bike pace, with some slack.
  const left = ((Math.hypot(from.x - player.x, from.z - player.z) + dist) / 5) * 1.6 + 40;
  rider.job = { phase: 'pickup', from, to, pay, left };
  sfx('msg');
  toast(
    'Nab Food: new order',
    `Pick up at ${from.name}, deliver to ${to.name}. ${sgd(pay)} (+S$2 tip if on time).`,
    'msg',
  );
}
function nabFoodApp() {
  openPanel({
    title: 'Nab Food',
    sub: rider.online ? `Online · ${rider.done} deliveries today, ${sgd(rider.earned)}` : 'Rider mode',
    body: rider.job
      ? rider.job.phase === 'pickup'
        ? `Collect the order at ${rider.job.from.name}.`
        : `Deliver to ${rider.job.to.name}. ${Math.max(0, Math.round(rider.job.left))} s for the tip.`
      : rider.online
        ? 'Waiting for an order…'
        : 'Go online to take delivery orders. A Pedal-Lah bike helps.',
    rows: [
      rider.online
        ? {
            label: 'Go offline',
            run: () => (
              (rider.online = false),
              (rider.job = null),
              closePanel(),
              toast('Nab Food', 'Offline. Shiok, rest.', null)
            ),
          }
        : {
            label: 'Go online',
            run: () => (
              (rider.online = true),
              (rider.wait = 3),
              closePanel(),
              toast('Nab Food', 'Online: orders will come in.', null)
            ),
          },
      { label: 'Back', run: () => closePanel() },
    ],
  });
}
function updateRider(dt: number) {
  if (!rider.online) return;
  const j = rider.job;
  if (!j) {
    rider.wait -= dt;
    if (rider.wait <= 0) {
      rider.wait = 25;
      newJob();
    }
    return;
  }
  if (j.phase === 'drop') j.left -= dt;
  const at = j.phase === 'pickup' ? j.from : j.to;
  markTo(j.phase === 'pickup' ? `Pick up · ${j.from.name}` : `Deliver · ${Math.max(0, Math.ceil(j.left))} s`, [
    at.x,
    1.5,
    at.z,
  ]);
}
function riderLabel() {
  const j = rider.job;
  if (!j) return null;
  return j.phase === 'pickup' ? `Collect the Nab Food order (${j.from.name})` : `Deliver the order to ${j.to.name}`;
}
function riderRun() {
  const j = rider.job!;
  if (j.phase === 'pickup') {
    j.phase = 'drop';
    sfx('tap');
    toast('Order collected', `Two packets in the bag. To ${j.to.name}, quick!`, null);
    return;
  }
  const tip = j.left > 0 ? 2 : 0;
  earn(j.pay + tip);
  rider.done++;
  rider.earned += j.pay + tip;
  addMood(tip ? 2 : 0);
  sfx('coin');
  toast(
    tip ? 'Delivered, on time!' : 'Delivered (late)',
    tip
      ? `${sgd(j.pay)} and a S$2 tip. "Thank you, rider!"`
      : `${sgd(j.pay)}. No tip; the auntie's food is a bit cold.`,
    tip ? 'good' : null,
  );
  rider.job = null;
  rider.wait = 12;
}

/* ---------- the community centre ---------- */

function buildCC() {
  if (!ccSpot.ok) return;
  const { x, z } = ccSpot;
  const p = new PropSet('cc');
  const W = 24,
    D = 14;
  p.box(x - W / 2, x + W / 2, 0, 0.1, z - D / 2, z + D / 2, '#3f7d6a');
  for (const dx of [-W / 2, 0, W / 2])
    for (const dz of [-D / 2, D / 2]) p.post(x + dx, z + dz, 0, 6, 0.2, '#e8e4da', true);
  p.box(x - W / 2 - 0.5, x + W / 2 + 0.5, 6, 6.3, z - D / 2 - 0.5, z + D / 2 + 0.5, '#b5553a');
  // Lamps under the roof, lit in the evening.
  for (const dx of [-8, -3, 3, 8]) for (const dz of [-3.5, 3.5]) p.light(x + dx, 5.85, z + dz, 0.35, '#fff4d6');
  // Two badminton courts: white lines and the nets.
  for (const cx of [x - 5.5, x + 5.5]) {
    for (const [a, b, c, d] of [
      [cx - 3, cx + 3, z - 6.7, z - 6.65],
      [cx - 3, cx + 3, z + 6.65, z + 6.7],
      [cx - 3.05, cx - 3, z - 6.7, z + 6.7],
      [cx + 3, cx + 3.05, z - 6.7, z + 6.7],
      [cx - 3, cx + 3, z - 2, z - 1.95],
      [cx - 3, cx + 3, z + 1.95, z + 2],
    ])
      p.box(a, b, 0.1, 0.12, c, d, '#f4f6f8');
    p.box(cx - 3.1, cx + 3.1, 0.8, 1.55, z - 0.02, z + 0.02, '#1d1f22', { b: p.cloth });
    for (const e of [-3.1, 3.1]) p.post(cx + e, z, 0, 1.55, 0.03, '#8e969c');
  }
  sign(
    {
      text: 'Clementi CC',
      sub: 'Community Club · Badminton · Karaoke',
      w: 5,
      h: 1,
      bg: '#b5553a',
      fg: '#ffffff',
      subfg: '#f2e2b8',
      border: '#f2e2b8',
      font: 'ui',
    },
    x,
    5.2,
    z + D / 2 + 0.3,
    0,
    { both: true },
  );
  // The karaoke room: a little building at the east end.
  const kx = x + W / 2 + 4;
  p.box(kx - 3, kx + 3, 0, 3.4, z - 3, z + 3, '#8e44ad', { col: true });
  p.box(kx - 0.7, kx + 0.7, 0, 2.2, z + 3, z + 3.05, '#2b2622');
  sign(
    {
      text: 'Karaoke Kaki',
      sub: 'Rooms · S$15 an hour',
      w: 3.4,
      h: 0.8,
      bg: '#8e44ad',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#f2c14e',
      font: 'ui',
    },
    kx,
    2.8,
    z + 3.06,
    0,
  );
  p.build();
  near.push({ p, x, z, r: 300 });
  interiors.push({
    name: 'Clementi CC',
    rooms: [{ name: 'Badminton hall', x0: x - W / 2, x1: x + W / 2, z0: z - D / 2, z1: z + D / 2 }],
    props: p,
    door: { update() {} },
    lamp: [x, 5.5, z],
    lampOn: () => hour() >= 18.5 || hour() < 7,
    amount: 0.45,
    showWithin: 300,
  });
  // The Thursday regulars on court.
  const thu = (h: number) => (weekday(S.day) === 4 && h >= 19.5 && h < 22 ? 1 : 0);
  for (const cx of [x - 5.5, x + 5.5])
    for (const [dz, ry] of [
      [-4, 0],
      [4, Math.PI],
    ] as const)
      addVendor(cx, z + dz, ry, { open: 0, close: 24, busy: thu });
  register({
    x,
    y: 1.2,
    z: z + D / 2 - 1,
    reach: 6,
    size: 3,
    label: () => (thu(hour()) ? 'Join the badminton (the Thursday regulars)' : 'Badminton court (Thursdays, 7.30pm)'),
    run: () => {
      if (!thu(hour())) return toast('Nobody playing', 'Badminton nights are Thursdays from 7.30pm. Bring energy.');
      startGame({
        kind: 'timing',
        title: 'Badminton',
        sub: 'Doubles with the regulars',
        help: 'Smash when the shuttle is in the zone!',
        seconds: 25,
        goal: 6,
        tries: 10,
        zone: 0.18,
        speed: 1.3,
        done: r => {
          pass(45);
          addEnergy(-8);
          addMood(r.won ? 8 : 4);
          toast(
            r.won ? 'Game, set!' : 'Good game',
            r.won
              ? '"Wah, your smash quite power!" Next Thursday same time.'
              : 'The uncles are fitter than they look. "Come again next week!"',
            r.won ? 'good' : null,
          );
        },
      });
    },
  });
  register({
    x: kx,
    y: 1.2,
    z: z + 3.2,
    reach: 3,
    size: 1.2,
    label: () => (hour() >= 12 && hour() < 25 ? 'Karaoke Kaki: book a room (S$15)' : 'Karaoke Kaki (opens at noon)'),
    run: () => {
      if (hour() < 12) return toast('Closed', 'Karaoke Kaki opens at noon.');
      if (!spend(15)) return toast('Not enough money', 'A room is S$15 an hour.');
      startGame({
        kind: 'timing',
        title: 'Karaoke',
        sub: 'Dewa 19, "Kangen", at full volume',
        help: 'Hit the notes: press when the marker is in the zone.',
        seconds: 30,
        goal: 8,
        tries: 12,
        zone: 0.2,
        speed: 1.1,
        done: r => {
          pass(60);
          addMood(r.won ? 12 : 7);
          toast(
            r.won ? 'Score: 96!' : 'Score: 71',
            r.won ? 'The machine plays a fanfare. Pure shiok.' : 'Off-key in the chorus, but who cares. Shiok.',
            'good',
          );
        },
      });
    },
  });
}

/* ---------- the running club ---------- */

function buildRunClub() {
  const x = LAGOON.x - LAGOON.w / 2 - 6,
    z = LAGOON.z + LAGOON.d / 2 + 6;
  const sat = (h: number) => (weekday(S.day) === 6 && h >= 6.75 && h < 8.5 ? 1 : 0);
  const p = new PropSet('runclub');
  for (const dx of [-2, 2]) p.post(x + dx, z, 0, 2.6, 0.05, '#8e969c');
  p.build();
  near.push({ p, x, z, r: 250 });
  sign(
    {
      text: 'East Coast Runners',
      sub: 'Saturdays 7am · all paces',
      w: 3.6,
      h: 0.8,
      bg: '#3fa7d6',
      fg: '#ffffff',
      subfg: '#1d2b36',
      border: '#ffffff',
      font: 'ui',
    },
    x,
    2.3,
    z,
    0,
    { both: true },
  );
  for (let i = 0; i < 5; i++) addVendor(x - 3 + i * 1.5, z + 2.5, Math.PI, { open: 0, close: 24, busy: sat });
  register({
    x,
    y: 1.4,
    z,
    reach: 5,
    size: 2,
    label: () => (sat(hour()) ? 'Run with the East Coast Runners (5 km)' : 'East Coast Runners (Saturdays, 7am)'),
    run: () => {
      if (!sat(hour())) return toast('No run now', 'The club meets here on Saturdays at 7am.');
      startGame({
        kind: 'race',
        title: 'Beach run, 5 km',
        sub: 'East Coast Park, into the sunrise',
        help: 'Alternate ← and → (or A and D) to keep pace.',
        input: 'alternate',
        seconds: 25,
        step: 0.028,
        rivals: [
          { name: 'Coach Faizal', speed: 0.04 },
          { name: 'Mei', speed: 0.036 },
          { name: 'Uncle Tan (72)', speed: 0.032 },
        ],
        you: 'Aldi',
        done: r => {
          pass(50);
          addEnergy(-10);
          addMood(r.place === 1 ? 10 : 7);
          toast(
            r.place === 1 ? 'First back!' : `Home in place ${r.place}`,
            'Kopi and kaya toast with the club after. "Same time next week ah!"',
            'good',
          );
        },
      });
    },
  });
}

/* ---------- fishing at MacRitchie ---------- */

const jetty = { x: 0, z: 0, ux: 0, uz: 0 };

function buildJetty() {
  const poly = WATERS.macritchie;
  if (!poly) return;
  // The shore point nearest the trailhead, and a jetty out over the water.
  let best: [number, number] = poly[0],
    bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i],
      [bx, bz] = poly[(i + 1) % poly.length];
    for (let t = 0; t <= 1; t += 0.05) {
      const x = ax + (bx - ax) * t,
        z = az + (bz - az) * t;
      // About 45 m along the shore from the trailhead (clear of its own sign and prompt).
      const d = Math.abs(Math.hypot(x - TRAIL.x, z - TRAIL.z) - 45);
      if (d < bd) {
        bd = d;
        best = [x, z];
      }
    }
  }
  const [sx, sz] = best;
  // Out toward the water's middle.
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length,
    cz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  const l = Math.hypot(cx - sx, cz - sz) || 1;
  const ux = (cx - sx) / l,
    uz = (cz - sz) / l;
  const L = 12;
  const mx = sx + ux * (L / 2 - 2),
    mz = sz + uz * (L / 2 - 2);
  const ry = Math.atan2(-uz, ux);
  const p = new PropSet('jetty');
  p.put(mx, 0.45, mz, L, 0.15, 2, '#8a6a4a', ry);
  for (let k = -1; k <= 1; k++) p.post(mx + ux * k * (L / 3), mz + uz * k * (L / 3), -1, 0.4, 0.12, '#6b5139');
  p.build();
  near.push({ p, x: mx, z: mz, r: 250 });
  addFloor(mx, mz, L / 2, 1, ry, 0.52);
  const ex = sx + ux * (L - 2.5),
    ez = sz + uz * (L - 2.5);
  Object.assign(jetty, { x: ex, z: ez, ux, uz });
  let fished = -1;
  register({
    x: ex + ux * 1.5,
    y: 0.6,
    z: ez + uz * 1.5,
    reach: 3,
    size: 1.2,
    label: () => (fished === S.day ? null : 'Fish off the jetty (catch and release)'),
    run: () =>
      startGame({
        kind: 'reflex',
        title: 'Fishing, MacRitchie',
        sub: 'A borrowed rod from the uncle on the bench',
        help: 'Wait for the float to dip, then strike (Space)!',
        rounds: 5,
        window: 0.7,
        done: r => {
          fished = S.day;
          pass(40);
          addMood(3 + r.caught * 2);
          toast(
            r.caught ? `${r.caught} caught (and let go)` : 'Nothing today',
            r.caught
              ? 'A tilapia, a snakehead… back in the water they go. The monitor lizard watches, disappointed.'
              : 'Just the sound of the forest. Not bad also.',
            r.caught ? 'good' : null,
          );
        },
      }),
  });
}

/* ---------- wiring ---------- */

export function buildGigs(apps: { label: string; note?: string; run: () => void }[]) {
  buildCC();
  buildRunClub();
  buildJetty();
  apps.push({ label: 'Nab Food', note: 'rider mode', run: nabFoodApp });
  register({
    get x() {
      const j = rider.job;
      return j ? (j.phase === 'pickup' ? j.from.x : j.to.x) : 1e6;
    },
    y: 1.2,
    get z() {
      const j = rider.job;
      return j ? (j.phase === 'pickup' ? j.from.z : j.to.z) : 1e6;
    },
    reach: 4,
    size: 2,
    label: riderLabel,
    run: riderRun,
  });
}
export function updateGigs(dt: number) {
  if (!S.started) return;
  updateRider(dt);
}
export const gigDebug = { rider, newJob, jetty };
