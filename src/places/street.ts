/* Things to use on every street (v2 step 15). The generator places them along the
   town roads (`gen.furniture`: vending machines, ATMs, benches, newsstands,
   Pedal-Lah bike racks, fitness corners, stone chess tables) and on the busier
   roads the overhead bridges; here they get their uses. There are hundreds, so they
   share one interactable: every few frames the nearest one in front of Aldi within
   reach becomes its target.
   - Vending machine: a cold drink (energy or mood).
   - ATM (PosBee): the balance, the next salary and rent.
   - Newsstand: today's paper, a headline.
   - Bench: sit and watch the street (a little mood while sitting); E or a step to get up.
   - Pedal-Lah: unlock a bike (S$1, then S$1 each half hour), ride at bike speed with the handlebars in
     view, and park it anywhere with E.
   - Fitness corner: a quick workout in place (pull-ups), 15 minutes.
   - Chess table: a game of xiangqi with the uncles, 30 minutes, won now and then. */
import * as THREE from 'three';
import { camera } from '../render/context';
import { S } from '../core/state';
import { player, keys } from '../core/player';
import { register } from '../game/interact';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/hud';
import { sfx } from '../audio/audio';
import { wallet, spend, sgd, addEnergy, addMood } from '../game/stats';
import { dateOf } from '../game/calendar';
import { furniture, type Furn } from '../city/gen';
import { home, HOMES } from './homes';
import { addDiner } from '../npc/vendors';

const CELL = 32;
const grid = new Map<string, Furn[]>();
let target: Furn | null = null;

/** An activity done in place (no fade): the clock runs `minutes` over `secs` real seconds while Aldi stays put. */
const act = {
  on: false,
  t: 0,
  secs: 1,
  minutes: 0,
  frame: null as ((f: number) => void) | null,
  done: null as (() => void) | null,
};
function inPlace(secs: number, minutes: number, frame: (f: number) => void, done: () => void) {
  Object.assign(act, { on: true, t: 0, secs, minutes, frame, done });
  S.seated = true;
}

/* ---------- the bike ---------- */

const bike = { on: false, since: 0, paid: 0 };
const bars = new THREE.Group();
{
  const m = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.028, 0.028), m(0x3a4046));
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), m(0xf2c14e));
  stem.position.set(0, -0.1, 0.02);
  const grips = [-0.26, 0.26].map(x => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.04), m(0x1d1f22));
    g.position.x = x;
    return g;
  });
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.2), m(0x1d1f22));
  basket.position.set(0, -0.16, -0.16);
  bars.add(bar, stem, ...grips, basket);
  bars.position.set(0, -0.3, -0.6);
  bars.rotation.x = -0.25;
  bars.visible = false;
  camera.add(bars);
}
function ride(on: boolean) {
  bike.on = on;
  bars.visible = on;
  player.walkSpeed = on ? 6 : 3.5;
  player.runSpeed = on ? 8.5 : 6;
}
function nowMin() {
  return S.day * 1440 + S.time;
}
function unlock() {
  if (!spend(1)) return toast('Not enough money', 'Pedal-Lah needs S$1 to unlock.');
  bike.since = nowMin();
  bike.paid = 1;
  ride(true);
  sfx('tap');
  toast('Pedal-Lah unlocked', 'S$1 for the first half hour, S$1 each half hour after. E to park it anywhere.', null);
}
function park() {
  const halves = Math.max(1, Math.ceil((nowMin() - bike.since) / 30));
  const due = halves - bike.paid;
  if (due > 0) spend(due);
  ride(false);
  sfx('tap');
  toast('Bike parked', `${Math.round(nowMin() - bike.since)} minutes, ${sgd(halves)} in all. Shiok.`, null);
}

/* ---------- the bench ---------- */

const sit = { on: false, t: 0, gained: 0 };
function sitDown(f: Furn) {
  Object.assign(player, { x: f.x + f.fx * 0.15, z: f.z + f.fz * 0.15, vx: 0, vz: 0, eye: 1.2 });
  player.yaw = Math.atan2(-f.fx, -f.fz);
  player.pitch = 0;
  S.seated = true;
  Object.assign(sit, { on: true, t: 0, gained: 0 });
}
function standUp() {
  sit.on = false;
  S.seated = false;
  player.eye = 1.7;
}

/* ---------- the rest ---------- */

const HEADLINES = [
  'COE prices hit a new high. Uncles everywhere: "Wah lau."',
  'Hawker culture turns five on the UNESCO list. Queues unchanged.',
  'New MRT line on schedule, the minister says. Commuters: "Can believe or not?"',
  'Otters seen at Marina Bay again. Tourists thrilled, fish less so.',
  'Durian season arrives early. Hotels remind guests: no durians in the rooms.',
  "Changi named the world's best airport. Again.",
  'Heavy afternoon rain expected all week. Bring umbrella lah.',
  'Chope culture debate: tissue packets, fair or not? Readers write in.',
  'Record crowds at the East Coast Park weekend cycling trail.',
  'Tech firms hiring again, Chopee among them.',
  "Kaya toast voted the nation's favourite breakfast, beating nasi lemak by a whisker.",
  'Bus drivers thanked in a new campaign. "Thank you, uncle!" trends online.',
];
const DRINKS = [
  { name: 'Kopi in a can', price: 1.4, energy: 6, mood: 1, note: 'Sweet, strong, cold. It does the job.' },
  { name: 'Isotonic drink', price: 1.6, energy: 4, mood: 1, note: 'Aldi drinks it in one go. The heat, wah.' },
  { name: 'Chrysanthemum tea', price: 1.3, energy: 2, mood: 3, note: 'Cooling, the aunties say. It is nice.' },
  { name: 'Soya bean milk', price: 1.5, energy: 5, mood: 2, note: 'Smooth. Like the one at home.' },
];

function use(f: Furn) {
  switch (f.kind) {
    case 'vending':
      openPanel({
        title: 'Vending machine',
        sub: 'Cold drinks · EZ-Lah card or coins',
        rows: [
          ...DRINKS.map(d => ({
            label: d.name,
            note: sgd(d.price),
            run: () => {
              if (!spend(d.price)) return toast('Not enough money', `${d.name} is ${sgd(d.price)}.`);
              closePanel();
              sfx('coin');
              addEnergy(d.energy);
              addMood(d.mood);
              toast(d.name, d.note, null);
            },
          })),
          { label: 'Not thirsty', run: () => closePanel() },
        ],
      });
      return;
    case 'atm': {
      const { d } = dateOf(S.day);
      const rent = home.id ? HOMES[home.id].rent : 0;
      openPanel({
        title: 'PosBee ATM',
        sub: 'Balance enquiry',
        body: `Balance: ${sgd(wallet.money)}. Salary on the 25th (${d < 25 ? `in ${25 - d} days` : d === 25 ? 'today' : 'next month'}).${rent ? ` Rent ${sgd(rent)} on the 1st.` : ''}`,
        rows: [{ label: 'Take the card', run: () => closePanel() }],
      });
      sfx('tap');
      return;
    }
    case 'news': {
      if (!spend(1.5)) return toast('Not enough money', 'The paper is S$1.50.');
      const h = HEADLINES[(S.day * 7 + 3) % HEADLINES.length];
      addMood(1);
      toast('The Strait Times', h, null);
      return;
    }
    case 'bench':
      sitDown(f);
      toast('A seat on the bench', 'The street goes by. E (or a step) to get up.', null);
      return;
    case 'bikes':
      return bike.on ? park() : unlock();
    case 'fitness': {
      const pitch0 = player.pitch;
      inPlace(
        7,
        15,
        k => {
          // Pull-ups: the view rises and falls.
          player.eye = 1.7 + 0.35 * Math.max(0, Math.sin(k * Math.PI * 8));
          player.pitch = pitch0 + 0.15;
        },
        () => {
          player.eye = 1.7;
          addEnergy(-3);
          addMood(4);
          toast('Workout done', 'Eight pull-ups, a few sit-ups. An uncle nods from the bench.', 'good');
        },
      );
      return;
    }
    case 'chess': {
      const win = (S.day * 31 + Math.floor(S.time)) % 100 < 35;
      Object.assign(player, { vx: 0, vz: 0 });
      player.pitch = -0.6;
      inPlace(
        9,
        30,
        k => {
          player.yaw += Math.sin(k * 20) * 0.002;
        },
        () => {
          player.pitch = -0.1;
          addMood(win ? 5 : 2);
          toast(
            win ? 'Checkmate!' : 'Uncle wins again',
            win
              ? 'The uncles laugh: "Wah, not bad leh! This one can play one."'
              : '"Next time lah." They set up the pieces again.',
            win ? 'good' : null,
          );
        },
      );
      return;
    }
  }
}
function labelFor(f: Furn) {
  switch (f.kind) {
    case 'vending':
      return 'Vending machine: a cold drink';
    case 'atm':
      return 'PosBee ATM';
    case 'news':
      return 'Newsstand: The Strait Times (S$1.50)';
    case 'bench':
      return 'Sit on the bench';
    case 'bikes':
      return bike.on ? 'Return the Pedal-Lah bike here' : 'Pedal-Lah bike share (S$1 a half hour)';
    case 'fitness':
      return 'Fitness corner: a quick workout';
    case 'chess':
      return 'Stone chess table: a game with the uncles';
  }
}

export function buildStreet() {
  for (const f of furniture) {
    // Uncles at the chess tables in the day (two of the four stools, facing the board).
    if (f.kind === 'chess')
      for (const a of [0, Math.PI]) {
        const sx = f.x + Math.cos(a) * 1.0,
          sz = f.z + Math.sin(a) * 1.0;
        addDiner(
          sx,
          sz,
          Math.atan2(f.x - sx, f.z - sz),
          0.44,
          NaN,
          NaN,
          () => act.on,
          h => (h >= 8 && h < 21 ? 0.55 : 0),
        );
      }
    const k = Math.floor(f.x / CELL) + ',' + Math.floor(f.z / CELL);
    let c = grid.get(k);
    if (!c) grid.set(k, (c = []));
    c.push(f);
  }
  register({
    get x() {
      return target?.x ?? 1e6;
    },
    get y() {
      return target?.kind === 'bench' || target?.kind === 'chess' ? 0.7 : 1.2;
    },
    get z() {
      return target?.z ?? 1e6;
    },
    reach: 3.2,
    size: 1,
    label: () => (target && !player.ride ? labelFor(target) : null),
    run: () => target && use(target),
  });
}

/** E with nothing in front: get up from the bench, or park the bike. */
export function streetMenu(): boolean {
  if (sit.on) {
    standUp();
    return true;
  }
  if (bike.on) {
    openPanel({
      title: 'Pedal-Lah',
      sub: `Riding ${Math.round(nowMin() - bike.since)} minutes`,
      rows: [
        { label: 'Park the bike here', run: () => (closePanel(), park()) },
        { label: 'Keep riding', run: () => closePanel() },
      ],
    });
    return true;
  }
  return false;
}

let acc = 0;
export function updateStreet(dt: number) {
  // The target: the nearest thing in front of Aldi within reach (5 times a second).
  acc += dt;
  if (acc > 0.2) {
    acc = 0;
    target = null;
    let bd = 3.4;
    const cx = Math.floor(player.x / CELL),
      cz = Math.floor(player.z / CELL);
    for (let i = cx - 1; i <= cx + 1; i++)
      for (let j = cz - 1; j <= cz + 1; j++)
        for (const f of grid.get(i + ',' + j) ?? []) {
          const dx = player.x - f.x,
            dz = player.z - f.z;
          const d = Math.hypot(dx, dz);
          if (d < bd && player.y < 1.5) {
            bd = d;
            target = f;
          }
        }
  }
  if (act.on) {
    act.t += dt;
    const k = Math.min(1, act.t / act.secs);
    S.time = Math.min(S.time + (dt * act.minutes) / act.secs, 26 * 60 - 1);
    act.frame?.(k);
    if (k >= 1) {
      act.on = false;
      S.seated = false;
      act.done?.();
    }
  }
  if (sit.on) {
    // A step (or any movement key) gets Aldi up.
    if (keys.has('KeyW') || keys.has('KeyS') || keys.has('ArrowUp') || keys.has('ArrowDown')) standUp();
    else {
      sit.t += dt * 0.8; // game minutes
      if (sit.t > 5 && sit.gained < 3) {
        sit.t = 0;
        sit.gained++;
        addMood(1);
      }
    }
  }
  // Half-hourly bike charges while riding.
  if (bike.on) {
    const halves = Math.ceil((nowMin() - bike.since) / 30);
    if (halves > bike.paid) {
      bike.paid = halves;
      spend(1);
    }
    if (player.ride) park();
  }
}
export const streetDebug = {
  bike,
  sit,
  act,
  get target() {
    return target;
  },
};
