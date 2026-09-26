/* Small events (v2 step 16): as Aldi walks the town streets by day, every 150–250 m
   or so something happens a little way ahead, on the pavement. Each is short and
   optional, and goes away if Aldi walks on:
   - a lost tourist asks the way to a landmark (pick the direction: the map helps);
   - someone drops a wallet and walks on (pick it up, then return it, or keep it);
   - an auntie's trolley is stuck at the kerb (help lift it);
   - a busker plays (tip S$2);
   - someone hands out flyers (take one: a tip for somewhere to go);
   - a community cat sits on the kerb (pet it).
   And in the HDB towns, on some days, a tent at the void deck: a Malay wedding or
   a Chinese wake, with guests at the tables; congratulate the couple (an ang bao,
   S$20) or pay respects.
   Good deeds are remembered (`deeds`): the named people mention the latest when Aldi
   next talks to them. The people in the events use the crowd's event slots. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { hash, rng } from '../core/util';
import { S, inWorld } from '../core/state';
import { player } from '../core/player';
import { register } from './interact';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/hud';
import { bubble, clearBubble } from '../ui/bubbles';
import { sfx } from '../audio/audio';
import { spend, earn, addMood } from './stats';
import { isWeekend } from './calendar';
import { segsNear } from '../city/roads';
import { landAt, townAt, TOWNS, type Town } from '../city/geo';
import { freeAt, tentSpots } from '../city/gen';
import { crowd, EVENT_BASE, EVENT_SLOTS } from '../npc/people';
import { generateAppearance, SG_SKINS } from '../npc/appearance';
import { addDiner } from '../npc/vendors';
import type { PoseState, Gear } from '../npc/characters';
import { PROMENADE, LUCKY, MOSQUE, CT_MARKET, LAU_PA_SAT, CLEMENTI_HAWKER, TEKKA, KATONG_ROW } from '../places/sites';

type Kind = 'tourist' | 'wallet' | 'trolley' | 'busker' | 'flyer' | 'cat';

/** Someone in an event: a crowd slot, where, and their pose. */
interface Actor {
  slot: number;
  pose: PoseState;
  /** Walking away along (vx, vz) at this speed (m/s), or standing. */
  vx: number;
  vz: number;
  speed: number;
}
interface Incident {
  kind: Kind;
  x: number;
  z: number;
  /** Seconds since it began (real time). */
  t: number;
  step: number;
  actors: Actor[];
  /** The tourist's landmark, the wallet's spot. */
  data: { name?: string; tx?: number; tz?: number; wx?: number; wz?: number; music?: number };
}
let cur: Incident | null = null;

/** Deeds Aldi has done, newest last (saved); the named people mention the latest. */
export const deeds: { day: number; text: string }[] = [];
function deed(text: string) {
  deeds.push({ day: S.day, text });
  if (deeds.length > 20) deeds.shift();
}
/** A line for a person Aldi talks to: the latest good deed of the last two days, once per person. */
const told = new Set<string>();
export function deedLine(who: string): string | null {
  const d = deeds[deeds.length - 1];
  if (!d || S.day - d.day > 2) return null;
  const k = who + '|' + d.day + '|' + d.text;
  if (told.has(k)) return null;
  told.add(k);
  return `Eh, I heard you ${d.text}. Very nice of you, you know.`;
}

/* ---------- the pieces: the cat, the wallet ---------- */

const cat = new THREE.Group();
{
  const fur = new THREE.MeshLambertMaterial({ color: '#d98a4a' });
  const white = new THREE.MeshLambertMaterial({ color: '#f4f1ea' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.42), fur);
  body.position.y = 0.2;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.16), fur);
  head.position.set(0, 0.36, 0.24);
  const ears = [-0.06, 0.06].map(x => {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), fur);
    e.position.set(x, 0.47, 0.24);
    return e;
  });
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.05), white);
  chest.position.set(0, 0.22, 0.21);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), fur);
  tail.position.set(0, 0.28, -0.32);
  tail.rotation.x = 0.7;
  const legs = [-0.07, 0.07].flatMap(x =>
    [-0.14, 0.14].map(z => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), fur);
      l.position.set(x, 0.06, z);
      return l;
    }),
  );
  cat.add(body, head, ...ears, chest, tail, ...legs);
  cat.visible = false;
  scene.add(cat);
}
const wallet = new THREE.Mesh(
  new THREE.BoxGeometry(0.16, 0.03, 0.1),
  new THREE.MeshLambertMaterial({ color: '#5a3b24' }),
);
wallet.visible = false;
scene.add(wallet);

/* ---------- starting one ---------- */

const LANDMARKS: [string, number, number][] = [
  ['Marina Bay Stands', PROMENADE.x + 120, PROMENADE.z + 40],
  ['Orchard Road', (LUCKY.x0 + LUCKY.x1) / 2, LUCKY.z1],
  ['Masjid Sultan', MOSQUE.x, MOSQUE.z],
  ['Chinatown', (CT_MARKET.x0 + CT_MARKET.x1) / 2, CT_MARKET.z0],
  ['Lau Pa Sat', LAU_PA_SAT.x, LAU_PA_SAT.z],
  ['the Clementi food centre', CLEMENTI_HAWKER.x, CLEMENTI_HAWKER.z],
  ['Tekka Centre', TEKKA.x, TEKKA.z],
  ['Katong', (KATONG_ROW.x0 + KATONG_ROW.x1) / 2, KATONG_ROW.z0],
];
const FLYERS = [
  'Karaoke Kaki, Clementi: 50% off rooms before 7pm. "Sing until shiok!"',
  'New bubble tea at Lau Pa Sat: buy one get one this week.',
  'Community centre badminton, Thursday nights: all welcome, bring your own racket.',
  'East Coast Park running club: Saturday 7am at the Lagoon. Free!',
  'Nab Food is hiring riders: flexible hours, own bike or Pedal-Lah. Apply in the app.',
  'MacRitchie guided walk this Sunday: see the monkeys (do not feed).',
];
const PICK: [Kind, number][] = [
  ['tourist', 20],
  ['wallet', 14],
  ['trolley', 16],
  ['busker', 18],
  ['flyer', 16],
  ['cat', 16],
];

/** A pavement spot 14–24 m ahead of Aldi in a built-up town, on land and clear. */
function spotAhead(): [number, number, number, number] | null {
  const fx = -Math.sin(player.yaw),
    fz = -Math.cos(player.yaw);
  for (let k = 0; k < 6; k++) {
    const d = 14 + k * 2;
    const px = player.x + fx * d,
      pz = player.z + fz * d;
    for (const s of segsNear(px, pz, 25)) {
      if (s.road.kind === 'expressway') continue;
      const len = Math.hypot(s.bx - s.ax, s.bz - s.az) || 1;
      const ux = (s.bx - s.ax) / len,
        uz = (s.bz - s.az) / len;
      const t = Math.max(0, Math.min(len, (px - s.ax) * ux + (pz - s.az) * uz));
      const side = (px - s.ax) * -uz + (pz - s.az) * ux > 0 ? 1 : -1;
      const off = s.w / 2 + 1.8;
      const x = s.ax + ux * t - uz * off * side,
        z = s.az + uz * t + ux * off * side;
      if (Math.hypot(x - player.x, z - player.z) < 10) continue;
      const land = landAt(x, z);
      if (land !== 'urban' && land !== 'park') continue;
      if (!freeAt(x, z, 0.6)) continue;
      return [x, z, ux, uz];
    }
  }
  return null;
}
function actor(
  i: number,
  x: number,
  z: number,
  ry: number,
  o: { age?: [number, number]; gender?: 'm' | 'f'; gear?: Gear; set?: object; seed: number },
) {
  const r = rng(hash('incident', o.seed, i));
  const a = generateAppearance(
    {
      age: r.int(o.age?.[0] ?? 18, o.age?.[1] ?? 70),
      gender: o.gender ?? (r.chance(0.5) ? 'm' : 'f'),
      hijab: 0.2,
      skins: SG_SKINS,
      set: o.set ?? {},
    },
    r.next,
  );
  if (a.hair === 'peci') a.hair = 'short';
  const slot = EVENT_BASE + i;
  crowd.setAppearance(slot, a);
  crowd.setGear(slot, o.gear ?? 'none', r.pick(['#b8342a', '#2f6fb3', '#2b2622', '#f2c14e']));
  return {
    slot,
    pose: { x, z, ry, seatY: 0, pose: 'stand', walk: 0, phase: 0, headYaw: 0, gesture: 0, reach: 0, t: 0 },
    vx: 0,
    vz: 0,
    speed: 0,
  } as Actor;
}
function start(force?: Kind) {
  const at = spotAhead();
  if (!at) return;
  const [x, z, ux, uz] = at;
  const seed = S.day * 1000 + Math.floor(S.time);
  const r = rng(hash('incident', seed));
  let w = r.next() * PICK.reduce((a, [, n]) => a + n, 0);
  let kind: Kind = 'cat';
  for (const [k, n] of PICK)
    if ((w -= n) < 0) {
      kind = k;
      break;
    }
  if (force) kind = force;
  const face = Math.atan2(player.x - x, player.z - z);
  const inc: Incident = { kind, x, z, t: 0, step: 0, actors: [], data: {} };
  if (kind === 'tourist') {
    const far = LANDMARKS.filter(([, lx, lz]) => Math.hypot(lx - x, lz - z) > 300);
    const [name, tx, tz] = far[Math.floor(r.next() * far.length)] ?? LANDMARKS[0];
    inc.data = { name, tx, tz };
    inc.actors.push(
      actor(0, x, z, face, {
        age: [22, 60],
        gear: r.chance(0.5) ? 'backpack' : 'phone',
        seed,
        set: { top: '#f2c14e' },
      }),
    );
  } else if (kind === 'wallet') {
    // The owner walks off along the pavement, away from Aldi; the wallet lies where they were.
    const dir = (player.x - x) * ux + (player.z - z) * uz > 0 ? -1 : 1;
    const a = actor(0, x + ux * dir * 3, z + uz * dir * 3, Math.atan2(ux * dir, uz * dir), {
      age: [25, 65],
      gear: 'handbag',
      seed,
    });
    Object.assign(a, { vx: ux * dir, vz: uz * dir, speed: 1.0 });
    a.pose.walk = 1;
    inc.actors.push(a);
    inc.data = { wx: x, wz: z };
    wallet.position.set(x, 0.02, z);
    wallet.visible = true;
  } else if (kind === 'trolley') {
    inc.actors.push(actor(0, x, z, face + 0.6, { age: [62, 80], gender: 'f', gear: 'trolley', seed }));
  } else if (kind === 'busker') {
    inc.actors.push(actor(0, x, z, face, { age: [20, 45], gear: 'none', seed, set: { top: '#2c3e50' } }));
    inc.actors[0].pose.reach = 0.5;
    inc.data.music = 0;
  } else if (kind === 'flyer') {
    inc.actors.push(actor(0, x, z, face, { age: [18, 30], gear: 'none', seed, set: { top: '#d7263d' } }));
    inc.actors[0].pose.reach = 0.3;
  } else {
    cat.position.set(x, 0, z);
    cat.rotation.y = face;
    cat.visible = true;
  }
  cur = inc;
  const say: Record<Kind, string> = {
    tourist: 'Excuse me!',
    wallet: '',
    trolley: 'Aiyo, so heavy…',
    busker: '♪ ♫',
    flyer: 'Promotion! Take one!',
    cat: 'Meow.',
  };
  const a0 = inc.actors[0];
  if (say[kind]) bubble(inc, () => (a0 ? [a0.pose.x, 2.0, a0.pose.z] : [inc.x, 0.7, inc.z]), say[kind], 5);
}
function end() {
  if (!cur) return;
  for (let i = 0; i < EVENT_SLOTS; i++) crowd.hide(EVENT_BASE + i);
  clearBubble(cur);
  cat.visible = false;
  wallet.visible = false;
  cur = null;
}

/* ---------- using one ---------- */

function compass(dx: number, dz: number) {
  const a = Math.atan2(dx, -dz); // 0 = north (−z), clockwise
  const k = Math.round(a / (Math.PI / 2));
  return ['north', 'east', 'south', 'west', 'north'][(k + 4) % 4];
}
function run() {
  const c = cur!;
  const a = c.actors[0];
  switch (c.kind) {
    case 'tourist': {
      const right = compass(c.data.tx! - c.x, c.data.tz! - c.z);
      openPanel({
        title: 'A lost tourist',
        sub: 'Map in hand, a little desperate',
        body: `"Sorry ah, which way to ${c.data.name}?" (M shows the map: north is up.)`,
        rows: [
          ...['north', 'east', 'south', 'west'].map(d => ({
            label: `That way: ${d}`,
            run: () => {
              closePanel();
              if (d === right) {
                addMood(3);
                deed('helped a lost tourist find the way');
                toast('"Thank you so much!"', `The tourist heads off ${d} towards ${c.data.name}.`, 'good');
              } else
                toast('Off they go…', `The tourist heads ${d}. Hmm. ${c.data.name} was ${right}, actually.`, 'bad');
              c.step = 9;
            },
          })),
          { label: 'Sorry, not sure', run: () => (closePanel(), (c.step = 9)) },
        ],
      });
      return;
    }
    case 'wallet':
      if (c.step === 0) {
        c.step = 1;
        wallet.visible = false;
        toast('A wallet', 'Someone dropped it. The person walking away ahead, maybe?', null);
        return;
      }
      openPanel({
        title: 'The wallet',
        sub: 'Cards, an IC, S$60 in notes',
        rows: [
          {
            label: 'Return it',
            run: () => {
              closePanel();
              addMood(5);
              deed('returned a lost wallet');
              bubble(c, () => [a.pose.x, 2.0, a.pose.z], 'Wah, thank you!', 4);
              toast(
                '"Wah, thank you ah!"',
                'They check it, laugh with relief, and insist on shaking your hand.',
                'good',
              );
              a.speed = 0;
              c.step = 9;
            },
          },
          {
            label: 'Keep the cash',
            run: () => {
              closePanel();
              earn(60);
              addMood(-6);
              toast('S$60', 'It sits heavy in the pocket. Not a good feeling.', 'bad');
              c.step = 9;
            },
          },
        ],
      });
      return;
    case 'trolley':
      c.step = 9;
      a.pose.reach = 0.8;
      toast('Up the kerb', 'Aldi lifts the trolley up onto the pavement. Heavy, all tins and rice.', null);
      addMood(3);
      deed('helped an auntie with her trolley');
      bubble(c, () => [a.pose.x, 2.0, a.pose.z], 'Aiyo, thank you ah! Young people so kind.', 4);
      return;
    case 'busker':
      if (!spend(2)) return toast('No coins', 'Nothing to tip.');
      sfx('coin');
      addMood(3);
      c.step = 9;
      bubble(c, () => [a.pose.x, 2.0, a.pose.z], 'Thank you! This one for you.', 4);
      return;
    case 'flyer': {
      c.step = 9;
      toast('A flyer', FLYERS[(S.day + Math.floor(S.time)) % FLYERS.length], null);
      return;
    }
    case 'cat':
      c.step = 9;
      addMood(2);
      toast(
        'Community cat',
        'It leans into the hand and purrs. The ear is tipped: the neighbourhood looks after this one.',
        'good',
      );
      return;
  }
}
function label(): string | null {
  const c = cur;
  if (!c || c.step >= 9) return null;
  switch (c.kind) {
    case 'tourist':
      return 'Help the tourist';
    case 'wallet':
      return c.step === 0 ? 'Pick up the wallet' : 'Return the wallet';
    case 'trolley':
      return "Help lift the auntie's trolley";
    case 'busker':
      return 'Tip the busker (S$2)';
    case 'flyer':
      return 'Take a flyer';
    case 'cat':
      return 'Pet the cat';
  }
}
function where(): [number, number, number] {
  const c = cur;
  if (!c) return [1e6, 0, 1e6];
  if (c.kind === 'cat') return [c.x, 0.4, c.z];
  if (c.kind === 'wallet' && c.step === 0) return [c.data.wx!, 0.1, c.data.wz!];
  const a = c.actors[0];
  return [a.pose.x, 1.2, a.pose.z];
}

/* ---------- void-deck weddings and wakes ---------- */

interface Tent {
  town: Town;
  x: number;
  z: number;
  props: PropSet | null;
  day: number;
  kind: 'wedding' | 'wake' | null;
  visited: number;
}
const tents: Tent[] = [];
function tentKind(t: Tent, day: number): 'wedding' | 'wake' | null {
  const r = rng(hash('tent', t.x | 0, t.z | 0, day)).next();
  if (r < (isWeekend(day) ? 0.35 : 0.12)) return 'wedding';
  if (r > 0.9) return 'wake';
  return null;
}
function buildTents() {
  for (const sp of tentSpots) {
    const town = TOWNS.find(t => t.name === sp.town)!;
    const { x, z } = sp;
    const tent: Tent = { town, x, z, props: null, day: -1, kind: null, visited: -1 };
    tents.push(tent);
    // Guests at the tables when it's on.
    for (let i = 0; i < 3; i++)
      for (const [dx, dz] of [
        [0.9, 0],
        [-0.9, 0],
        [0, 0.9],
      ])
        addDiner(
          x - 3.5 + i * 3.5 + dx,
          z + 1 + dz,
          Math.atan2(-dx, -dz),
          0.44,
          NaN,
          NaN,
          () => tent.kind === null || tent.day !== S.day,
          h => (h >= 10 && h < 22 ? 0.6 : 0),
        );
  }
}
function tentProps(t: Tent) {
  const p = new PropSet('tent');
  const wed = t.kind === 'wedding';
  const top = wed ? '#d7263d' : '#2f6fb3',
    stripe = wed ? '#f2c14e' : '#f4f6f8';
  for (const dx of [-6, 6]) for (const dz of [-4, 4]) p.post(t.x + dx, t.z + dz, 0, 3, 0.08, '#e8e4da');
  for (let k = 0; k < 6; k++)
    p.box(t.x - 6 + k * 2, t.x - 4 + k * 2, 3, 3.1, t.z - 4.2, t.z + 4.2, k % 2 ? stripe : top);
  for (let i = 0; i < 3; i++) {
    const tx = t.x - 3.5 + i * 3.5,
      tz = t.z + 1;
    p.post(tx, tz, 0, 0.72, 0.06, '#8e969c');
    p.put(tx, 0.74, tz, 1.3, 0.05, 1.3, wed ? '#f4f1ea' : '#e8e4da', 0, p.cyl);
    for (const [dx, dz] of [
      [0.9, 0],
      [-0.9, 0],
      [0, 0.9],
    ])
      p.box(tx + dx - 0.2, tx + dx + 0.2, 0, 0.45, tz + dz - 0.2, tz + dz + 0.2, wed ? '#f2c14e' : '#3a4046');
  }
  if (wed) {
    // The pelamin: the couple's dais, gold and red.
    p.box(t.x - 2, t.x + 2, 0, 0.4, t.z - 3.8, t.z - 2.2, '#b8342a');
    p.box(t.x - 1.8, t.x + 1.8, 0.4, 2.6, t.z - 3.9, t.z - 3.7, '#f2c14e');
    p.box(t.x - 0.9, t.x - 0.3, 0.4, 1.1, t.z - 3.4, t.z - 2.9, '#f4f1ea');
    p.box(t.x + 0.3, t.x + 0.9, 0.4, 1.1, t.z - 3.4, t.z - 2.9, '#f4f1ea');
  } else {
    // The altar: a portrait, candles, joss sticks.
    p.box(t.x - 1.2, t.x + 1.2, 0, 0.9, t.z - 3.8, t.z - 3.1, '#f4f6f8');
    p.box(t.x - 0.3, t.x + 0.3, 0.9, 1.5, t.z - 3.75, t.z - 3.7, '#3a4046');
    for (const dx of [-0.8, 0.8]) p.post(t.x + dx, t.z - 3.45, 0.9, 1.2, 0.03, '#f4f1ea');
  }
  p.build();
  p.show(true);
  return p;
}
function updateTents() {
  for (const t of tents) {
    const near = Math.hypot(t.x - player.x, t.z - player.z) < 260;
    const kind = tentKind(t, S.day);
    if (t.day !== S.day || t.kind !== kind) {
      t.props?.dispose();
      t.props = null;
      t.day = S.day;
      t.kind = kind;
    }
    if (near && t.kind && !t.props) t.props = tentProps(t);
    else if (!near && t.props) {
      t.props.dispose();
      t.props = null;
    }
  }
}

/* ---------- every frame ---------- */

let walked = 0,
  next = 180,
  lastX = 0,
  lastZ = 0,
  musicAcc = 0;
export function buildIncidents() {
  register({
    get x() {
      return where()[0];
    },
    get y() {
      return where()[1];
    },
    get z() {
      return where()[2];
    },
    reach: 3,
    size: 0.8,
    label,
    run,
  });
  buildTents();
  for (const t of tents)
    register({
      x: t.x,
      y: 1.2,
      z: t.z - 3,
      reach: 5,
      size: 3,
      label: () =>
        t.kind && t.day === S.day && t.visited !== S.day
          ? t.kind === 'wedding'
            ? 'Congratulate the couple (an ang bao, S$20)'
            : 'Pay your respects'
          : null,
      run: () => {
        if (t.kind === 'wedding') {
          if (!spend(20)) return toast('Not enough money', 'An ang bao for a wedding is at least S$20.');
          t.visited = S.day;
          addMood(5);
          deed('went to a void-deck wedding with an ang bao');
          toast(
            'Selamat pengantin baru!',
            'The couple beam from the dais. Someone presses a plate of nasi minyak into your hands.',
            'good',
          );
        } else {
          t.visited = S.day;
          addMood(1);
          deed('paid respects at a wake');
          toast(
            'Condolences',
            'The family nods. An uncle offers a packet of peanuts and a drink; it is the way.',
            null,
          );
        }
      },
    });
}
export function updateIncidents(dt: number) {
  if (!S.started) return;
  updateTents();
  // Distance walked outdoors in town by day (not riding, not seated).
  const d = Math.hypot(player.x - lastX, player.z - lastZ);
  lastX = player.x;
  lastZ = player.z;
  const h = (S.time / 60) % 24;
  const out = inWorld() && !player.ride && !S.seated && !player.indoor && player.y < 1 && h >= 8 && h < 21.5;
  if (!cur && out && d < 5 && townAt(player.x, player.z)) {
    walked += d;
    if (walked > next) {
      walked = 0;
      next = 150 + Math.random() * 100;
      start();
    }
  }
  const c = cur;
  if (!c) return;
  c.t += dt;
  // Over when done and left behind, or ignored.
  const far = Math.hypot(c.x - player.x, c.z - player.z);
  if (far > 60 || c.t > 180 || (c.step >= 9 && far > 12)) {
    if (c.kind === 'wallet' && c.step === 1)
      toast('The wallet', 'Its owner is long gone. Aldi hands it in at the police post later.', null);
    end();
    return;
  }
  for (const a of c.actors) {
    a.pose.t += dt;
    if (a.speed > 0) {
      a.pose.x += a.vx * a.speed * dt;
      a.pose.z += a.vz * a.speed * dt;
      a.pose.phase += dt * a.speed * 4.2;
      a.pose.walk = 1;
      if (c.kind === 'wallet' && Math.hypot(a.pose.x - c.x, a.pose.z - c.z) > 40) a.speed = 0;
    } else {
      a.pose.walk = 0;
      // Face Aldi when close.
      if (Math.hypot(player.x - a.pose.x, player.z - a.pose.z) < 6)
        a.pose.ry = Math.atan2(player.x - a.pose.x, player.z - a.pose.z);
    }
    if (c.kind === 'busker') a.pose.reach = 0.45 + 0.1 * Math.sin(a.pose.t * 6);
    crowd.pose(a.slot, a.pose);
  }
  if (c.kind === 'busker' && c.step < 9 && far < 30) {
    musicAcc += dt;
    if (musicAcc > 1.6) {
      musicAcc = 0;
      sfx('busk', Math.max(0.3, 1 - far / 30));
    }
  }
}

export const saveIncidents = () => ({ deeds: deeds.slice() });
export function loadIncidents(d: { deeds?: { day: number; text: string }[] } | undefined) {
  end();
  deeds.length = 0;
  deeds.push(...(d?.deeds ?? []));
  told.clear();
  walked = 0;
}
export const incidentDebug = {
  get cur() {
    return cur;
  },
  start,
  end,
  tents,
};
