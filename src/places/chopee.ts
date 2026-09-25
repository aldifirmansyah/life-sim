/* Chopee's headquarters on Science Park Drive, the lower two floors walk-in (the
   tower above is streamed like any building):
   - Level 1: the glass front on the drive, the lobby with reception, the gantry
     (the staff pass opens it), the canteen's three stalls and tables, the lifts.
   - Level 2, the team floor: rows of desks (Aldi's by the window), the pantry
     with free kopi, the Merlion meeting room (stand-ups, sprint reviews), a nap
     pod and a table-tennis table.
   The lifts are a short fade between the floors. Everything is one prop set,
   drawn from far off so the tower never floats. */
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { addCol, type Collider } from '../core/collision';
import { addFloor } from '../core/levels';
import { interiors } from '../interiors/interior';
import { register } from '../game/interact';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/hud';
import { startGame } from '../ui/minigame';
import { S } from '../core/state';
import { player } from '../core/player';
import { blink, passTime } from '../core/time';
import { spend, sgd, addEnergy, addMood } from '../game/stats';
import { job, reception, openLaptop, meeting, meetingLabel } from '../game/work';
import { CHOPEE_HQ } from './sites';

const { x0, x1, z0, z1, h, l2 } = CHOPEE_HQ;
const GANTRY_Z = z0 + 12;
/** The two gate lanes (x ranges) in the gantry. */
const LANES: [number, number][] = [
  [-627.2, -625.2],
  [-624.8, -622.8],
];
const LIFT = { x: x1 - 6, z: z0 + 1.6 };
const DESK = { x: x1 - 5, z: z1 - 3.5 };
let gates: Collider[] = [];
let kopis = 0,
  kopiDay = 0;

export function buildChopee() {
  const p = new PropSet('chopee-hq');
  const W = 0.3;
  const glass = '#9fc3d1',
    frame = '#3a4046',
    orange = '#ee4d2d';
  /** A collider between feet heights y0..y1, switched with the set. */
  const col = (ax: number, bx: number, az: number, bz: number, y0: number, y1: number) => {
    const c = addCol(ax, bx, az, bz, undefined, y0, y1);
    c.on = false;
    p.cols.push(c);
    return c;
  };
  // Floors, the slab between them, the roof.
  p.box(x0, x1, 0, 0.1, z0, z1, '#d9d6cf');
  p.box(x0, x1, l2 - 0.15, l2, z0, z1, '#bdb7ac');
  p.box(x0, x1, l2, l2 + 0.05, z0, z1, '#8e9aa3');
  p.box(x0 - W, x1 + W, h, h + 0.3, z0 - W, z1 + W, '#c9c4ba');
  addFloor((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0, l2);
  // Outer walls: solid at the back (north), glass on the other three, with mullions.
  p.box(x0 - W, x1 + W, 0, h, z0 - W, z0, '#e4e0d8', { col: true });
  p.box(x0 - W, x0, 0, h, z0, z1, glass, { col: true, b: p.cloth });
  p.box(x1, x1 + W, 0, h, z0, z1, glass, { col: true, b: p.cloth });
  const door = (x0 + x1) / 2;
  p.box(x0, door - 2, 0, h, z1, z1 + W, glass, { col: true, b: p.cloth });
  p.box(door + 2, x1, 0, h, z1, z1 + W, glass, { col: true, b: p.cloth });
  p.box(door - 2, door + 2, 3, h, z1, z1 + W, glass, { b: p.cloth });
  for (let x = x0; x <= x1 + 0.01; x += 4) p.box(x - 0.08, x + 0.08, 0, h, z1, z1 + W + 0.05, frame);
  for (let z = z0; z <= z1 + 0.01; z += 4) {
    p.box(x0 - W - 0.05, x0, 0, h, z - 0.08, z + 0.08, frame);
    p.box(x1, x1 + W + 0.05, 0, h, z - 0.08, z + 0.08, frame);
  }
  for (const y of [l2 - 0.2, h - 0.2]) {
    p.box(x0 - W, x1 + W, y, y + 0.25, z1, z1 + W + 0.06, frame);
    p.box(x0 - W - 0.06, x0, y, y + 0.25, z0, z1, frame);
    p.box(x1, x1 + W + 0.06, y, y + 0.25, z0, z1, frame);
  }
  // Ceiling light panels on both floors.
  for (const y of [l2 - 0.2, h - 0.05])
    for (let x = x0 + 5; x < x1 - 2; x += 8) p.box(x - 1.5, x + 1.5, y - 0.05, y, z0 + 3, z1 - 3, '#fbf8ee');

  /* ----- Level 1: the lobby ----- */
  // Reception (west of the door), the logo wall behind it.
  p.box(x0 + 5, x0 + 11, 0, 1.1, z1 - 6, z1 - 5, orange);
  col(x0 + 5, x0 + 11, z1 - 6, z1 - 5, -1, 1.1);
  p.box(x0 + 5, x0 + 11, 1.1, 1.15, z1 - 6.1, z1 - 4.9, '#f4f1ea');
  p.box(x0 + 3, x0 + 13, 0, l2 - 0.2, z1 - 8.6, z1 - 8.4, '#f4f1ea');
  col(x0 + 3, x0 + 13, z1 - 8.6, z1 - 8.4, -1, l2 - 0.2);
  // Sofas and a plant in the lobby.
  for (const x of [x1 - 12, x1 - 6]) {
    p.box(x - 2, x + 2, 0, 0.45, z1 - 5, z1 - 4, '#3f6d8a');
    p.box(x - 2, x + 2, 0.45, 0.9, z1 - 5, z1 - 4.7, '#335a73');
    col(x - 2, x + 2, z1 - 5, z1 - 4, -1, 0.9);
  }
  p.post(door + 4, z1 - 2, 0, 0.8, 0.45, '#8a6a4a');
  p.put(door + 4, 1.6, z1 - 2, 1.2, 1.6, 1.2, '#3f7d3a', 0.4, p.cone);
  // The gantry: glass barriers across the lobby with two gate lanes in the middle.
  const bar = (ax: number, bx: number) => {
    p.box(ax, bx, 0, 1.15, GANTRY_Z - 0.06, GANTRY_Z + 0.06, glass, { b: p.cloth });
    col(ax, bx, GANTRY_Z - 0.1, GANTRY_Z + 0.1, -1, 1.2);
  };
  bar(x0, LANES[0][0] - 0.3);
  bar(LANES[1][1] + 0.3, x1);
  for (const x of [LANES[0][0] - 0.15, (LANES[0][1] + LANES[1][0]) / 2, LANES[1][1] + 0.15]) {
    p.box(x - 0.15, x + 0.15, 0, 1.05, GANTRY_Z - 0.7, GANTRY_Z + 0.7, '#2b3035');
    col(x - 0.15, x + 0.15, GANTRY_Z - 0.7, GANTRY_Z + 0.7, -1, 1.1);
    p.box(x - 0.1, x + 0.1, 1.05, 1.08, GANTRY_Z + 0.2, GANTRY_Z + 0.5, '#4fd18b', { b: p.glow });
  }
  gates = LANES.map(([a, b]) => col(a, b, GANTRY_Z - 0.1, GANTRY_Z + 0.1, -1, 1.2));
  // The canteen (west, behind the gantry): three stalls on the back wall, tables.
  const STALLS: [string, string, string, number][] = [
    ['Chicken Rice', 'Steamed or roasted', 'Chicken rice', 4.5],
    ['Nasi Lemak', 'Sambal shiok one', 'Nasi lemak with fried chicken', 5],
    ['Mala', 'Choose your own', 'A bowl of mala xiang guo', 7.5],
  ];
  STALLS.forEach(([name, sub, dish, price], i) => {
    const sx = x0 + 3 + i * 4.5;
    p.box(sx - 2, sx + 2, 0, 1.05, z0 + 2.2, z0 + 2.8, '#d8d2c4');
    col(sx - 2, sx + 2, z0, z0 + 2.8, -1, 1.1);
    p.box(sx - 2, sx + 2, 1.05, 1.1, z0 + 2.1, z0 + 2.9, '#a9a49a');
    p.box(sx - 2, sx + 2, 2.6, 3.2, z0 + 2.7, z0 + 2.9, ['#b8342a', '#2f8a4e', '#d9582b'][i]);
    sign(
      { text: name, sub, w: 3.4, h: 0.55, bg: '#1d2b36', border: '#1d2b36', fg: '#ffffff', font: 'ui' },
      sx,
      2.9,
      z0 + 2.95,
      0,
    );
    register({
      x: sx,
      y: 1.2,
      z: z0 + 2.8,
      reach: 2.6,
      size: 1,
      label: () => `${name}: ${dish.toLowerCase()} (${sgd(price)})`,
      run: () => buyMeal(name, dish, price),
    });
  });
  for (const [tx, tz] of [
    [x0 + 4, z0 + 6.5],
    [x0 + 10, z0 + 6.5],
    [x0 + 4, z0 + 9.5],
    [x0 + 10, z0 + 9.5],
  ]) {
    p.box(tx - 1.2, tx + 1.2, 0.72, 0.78, tz - 0.6, tz + 0.6, '#f4f1ea');
    p.box(tx - 0.08, tx + 0.08, 0, 0.72, tz - 0.08, tz + 0.08, '#8e969c');
    col(tx - 1.2, tx + 1.2, tz - 0.6, tz + 0.6, -1, 0.8);
    for (const dz of [-1, 1]) p.box(tx - 1, tx + 1, 0, 0.45, tz + dz - 0.2, tz + dz + 0.2, '#e07a1f');
  }
  sign(
    { text: 'Chopee Canteen', w: 5, h: 0.7, bg: orange, border: orange, fg: '#ffffff', font: 'ui' },
    x0 + 8,
    3.6,
    z0 + 0.35,
    0,
  );
  // The lifts on the back wall, on both floors.
  for (const y of [0, l2]) {
    for (const dx of [-1.6, 1.6]) {
      p.box(LIFT.x + dx - 0.8, LIFT.x + dx + 0.8, y, y + 2.3, z0, z0 + 0.12, '#b9c0c6');
      p.box(LIFT.x + dx - 0.02, LIFT.x + dx + 0.02, y, y + 2.3, z0 + 0.1, z0 + 0.14, '#6d757c');
    }
    p.box(LIFT.x - 0.08, LIFT.x + 0.08, y + 1.1, y + 1.3, z0 + 0.1, z0 + 0.18, '#f2c14e', { b: p.glow });
    register({
      x: LIFT.x,
      y: y + 1.2,
      z: z0 + 0.3,
      reach: 3,
      size: 1.4,
      label: () => (y === 0 ? 'Lift to Level 2 (team floor)' : 'Lift to Level 1 (lobby)'),
      run: () =>
        blink(y === 0 ? 'Level 2' : 'Level 1', () => {
          player.x = LIFT.x;
          player.z = z0 + 2.2;
          player.y = y === 0 ? l2 : 0;
          player.yaw = Math.PI;
        }),
    });
  }
  sign(
    {
      text: 'Chopee',
      sub: 'Science Park HQ',
      w: 4,
      h: 1,
      bg: orange,
      fg: '#ffffff',
      subfg: '#ffe7c2',
      border: '#ffffff',
      font: 'ui',
    },
    door,
    3.6,
    z1 + W + 0.1,
    0,
    { both: true },
  );
  sign({ text: 'CHOPEE', w: 5, h: 1.1, bg: '#f4f1ea', border: '#f4f1ea', fg: orange }, x0 + 8, 2.6, z1 - 8.3, 0);

  /* ----- Level 2: the team floor ----- */
  const Y = l2;
  // Desks: three rows of paired desks with monitors and chairs; Aldi's by the east window.
  for (let row = 0; row < 3; row++)
    for (let k = 0; k < 3; k++) {
      const dx = x0 + 14 + k * 5.5,
        dz = z0 + 9 + row * 4;
      p.box(dx - 2.2, dx + 2.2, Y + 0.72, Y + 0.76, dz - 0.8, dz + 0.8, '#f4f1ea');
      p.box(dx - 0.05, dx + 0.05, Y + 0.76, Y + 0.95, dz - 0.9, dz + 0.9, '#c9c4ba');
      col(dx - 2.2, dx + 2.2, dz - 0.8, dz + 0.8, Y - 1, Y + 0.8);
      for (const s of [-1, 1])
        for (const e of [-1.1, 1.1]) {
          p.box(dx + e - 0.3, dx + e + 0.3, Y + 0.76, Y + 1.15, dz + s * 0.25 - 0.03, dz + s * 0.25 + 0.03, '#1d2b36');
          p.box(dx + e - 0.25, dx + e + 0.25, Y, Y + 0.48, dz + s * 1.2 - 0.25, dz + s * 1.2 + 0.25, '#2f3a44');
        }
    }
  // Aldi's desk by the window, with the laptop and a name card.
  p.box(DESK.x - 1.2, DESK.x + 1.2, Y + 0.72, Y + 0.76, DESK.z - 0.7, DESK.z + 0.7, '#f4f1ea');
  col(DESK.x - 1.2, DESK.x + 1.2, DESK.z - 0.7, DESK.z + 0.7, Y - 1, Y + 0.8);
  p.box(DESK.x - 0.3, DESK.x + 0.3, Y + 0.76, Y + 0.79, DESK.z - 0.2, DESK.z + 0.2, '#9aa3a9');
  p.box(DESK.x - 0.3, DESK.x + 0.3, Y + 0.79, Y + 1.15, DESK.z - 0.22, DESK.z - 0.18, '#2f3a44');
  p.box(DESK.x + 0.6, DESK.x + 0.9, Y + 0.76, Y + 0.86, DESK.z + 0.3, DESK.z + 0.36, orange);
  p.box(DESK.x - 0.25, DESK.x + 0.25, Y, Y + 0.48, DESK.z + 0.9, DESK.z + 1.4, '#2f3a44');
  register({
    x: DESK.x,
    y: Y + 0.9,
    z: DESK.z,
    reach: 2.4,
    size: 1,
    label: () => (job.pass ? 'Work at your desk' : null),
    run: () => openLaptop(true),
  });
  // The Merlion meeting room (north-west): glass walls, a table.
  const MR = { x0, x1: x0 + 10, z0, z1: z0 + 8 };
  p.box(MR.x1 - 0.06, MR.x1 + 0.06, Y, h, MR.z0, MR.z1 - 1.2, glass, { col: true, b: p.cloth });
  p.box(MR.x0, MR.x1 - 2.4, Y, h, MR.z1 - 0.06, MR.z1 + 0.06, glass, { col: true, b: p.cloth });
  p.box(MR.x1 - 1.2, MR.x1 + 0.06, Y, h, MR.z1 - 0.06, MR.z1 + 0.06, glass, { col: true, b: p.cloth });
  const tx = (MR.x0 + MR.x1) / 2 - 0.5,
    tz = (MR.z0 + MR.z1) / 2;
  p.box(tx - 2.5, tx + 2.5, Y + 0.72, Y + 0.78, tz - 1, tz + 1, '#6b5139');
  col(tx - 2.5, tx + 2.5, tz - 1, tz + 1, Y - 1, Y + 0.8);
  p.box(MR.x0 + 0.1, MR.x0 + 0.2, Y + 1, Y + 2.2, tz - 1.2, tz + 1.2, '#1d2b36'); // the screen
  sign(
    { text: 'Merlion', w: 1.6, h: 0.4, bg: '#1d2b36', border: '#1d2b36', fg: '#ffffff', font: 'ui' },
    MR.x1 - 3,
    Y + 2.3,
    MR.z1 + 0.1,
    0,
  );
  register({
    x: tx,
    y: Y + 0.9,
    z: tz,
    reach: 3.5,
    size: 1.6,
    label: meetingLabel,
    run: meeting,
  });
  // The pantry (south-west): counter, coffee machine, fridge.
  p.box(x0 + 0.3, x0 + 1, Y, Y + 0.95, z1 - 8, z1 - 1, '#e4e0d8');
  col(x0, x0 + 1, z1 - 8, z1 - 1, Y - 1, Y + 1);
  p.box(x0 + 0.35, x0 + 0.9, Y + 0.95, Y + 1.5, z1 - 5, z1 - 4.4, '#2b3035');
  p.box(x0 + 0.2, x0 + 1, Y, Y + 2, z1 - 9.5, z1 - 8.3, '#dfe3e6');
  sign(
    { text: 'Pantry', w: 1.6, h: 0.4, bg: orange, border: orange, fg: '#ffffff', font: 'ui' },
    x0 + 0.35,
    Y + 2.3,
    z1 - 4.7,
    Math.PI / 2,
  );
  register({
    x: x0 + 0.6,
    y: Y + 1.2,
    z: z1 - 4.7,
    reach: 2.4,
    size: 0.8,
    label: () => (job.pass ? 'Make a kopi (free)' : null),
    run: kopi,
  });
  // A nap pod on the east wall, and the table-tennis table.
  p.box(x1 - 2.2, x1 - 0.1, Y, Y + 1.3, z0 + 7, z0 + 9.2, '#f4f1ea');
  p.box(x1 - 2.1, x1 - 0.2, Y + 0.4, Y + 1.2, z0 + 7.1, z0 + 7.2, '#1d2b36');
  col(x1 - 2.2, x1, z0 + 7, z0 + 9.2, Y - 1, Y + 1.3);
  register({
    x: x1 - 1.2,
    y: Y + 0.8,
    z: z0 + 8,
    reach: 2.6,
    size: 1,
    label: () => (job.pass ? 'Nap for half an hour' : null),
    run: () => passTime(30, 'Zzz…', () => addEnergy(12)),
  });
  const tt = { x: x0 + 5, z: z1 - 4 };
  p.box(tt.x - 1.4, tt.x + 1.4, Y + 0.72, Y + 0.76, tt.z - 0.76, tt.z + 0.76, '#2f6b4f');
  p.box(tt.x - 0.02, tt.x + 0.02, Y + 0.76, Y + 0.92, tt.z - 0.8, tt.z + 0.8, '#f4f1ea');
  col(tt.x - 1.4, tt.x + 1.4, tt.z - 0.76, tt.z + 0.76, Y - 1, Y + 0.8);
  register({
    x: tt.x,
    y: Y + 0.8,
    z: tt.z,
    reach: 3,
    size: 1.2,
    label: () => (job.pass ? 'Table tennis with Hafiz' : null),
    run: pingPong,
  });
  // Reception.
  register({
    x: x0 + 8,
    y: 1.2,
    z: z1 - 5,
    reach: 2.8,
    size: 1.4,
    label: () => (job.pass ? 'Reception' : 'Reception: "Hi, I\'m new here"'),
    run: reception,
  });
  p.build();

  interiors.push({
    name: 'Chopee',
    rooms: [
      { name: 'Merlion room', x0: MR.x0, x1: MR.x1, z0: MR.z0, z1: MR.z1, y0: l2 - 0.5 },
      { name: 'Level 2 · Team floor', x0, x1, z0, z1, y0: l2 - 0.5 },
      { name: 'Canteen', x0, x1: x0 + 14, z0, z1: GANTRY_Z },
      { name: 'Lobby', x0, x1, z0, z1 },
    ],
    props: p,
    door: { update: updateGantry },
    lamp: [(x0 + x1) / 2, l2 - 0.4, (z0 + z1) / 2],
    lampOn: () => true,
    amount: 0.8,
    showWithin: 600,
  });
}

/** The gantry's gates open for Aldi with the staff pass. */
function updateGantry() {
  const near = Math.abs(player.z - GANTRY_Z) < 2.5 && player.x > LANES[0][0] - 1 && player.x < LANES[1][1] + 1;
  const open = job.pass && near && player.y < 1;
  for (const g of gates) g.on = !open;
  if (!job.pass && near && player.z > GANTRY_Z && nagT < performance.now() - 15000) {
    nagT = performance.now();
    toast('Staff only', 'The gantry needs a Chopee pass. New joiners, please see reception.', null);
  }
}
let nagT = -1e9;

function buyMeal(name: string, dish: string, price: number) {
  openPanel({
    title: name,
    sub: 'Chopee Canteen',
    body: `"${dish}, ${sgd(price)}. Eat here?"`,
    rows: [
      {
        label: `Buy and eat (${sgd(price)})`,
        run: () => {
          if (!spend(price)) return toast('Not enough money', `${dish} is ${sgd(price)}.`);
          closePanel();
          passTime(20, 'Makan…', () => {
            addEnergy(25);
            addMood(5);
            toast(`${dish}`, 'Not bad for a canteen. Wei Jie is right though, Clementi is better.', null);
          });
        },
      },
      { label: 'Maybe later', run: () => closePanel() },
    ],
  });
}

function kopi() {
  if (kopiDay !== S.day) {
    kopiDay = S.day;
    kopis = 0;
  }
  if (kopis >= 3) return toast('Enough kopi for today', 'Three already. Aldi will never sleep at this rate.');
  kopis++;
  addEnergy(10);
  addMood(2);
  toast('Kopi from the machine', 'Free, hot, a bit too sweet. Perfect.', null);
}

function pingPong() {
  startGame({
    kind: 'timing',
    title: 'Table tennis',
    sub: 'First to three, against Hafiz from Payments',
    help: 'Press Space when the ball is in the zone to return it.',
    seconds: 15,
    goal: 3,
    tries: 5,
    zone: 0.22,
    speed: 0.9,
    done: r => {
      addMood(r.won ? 8 : 4);
      addEnergy(-4);
      passTime(15, 'Table tennis…', () =>
        toast(
          r.won ? 'You beat Hafiz!' : 'Hafiz wins',
          r.won ? '"Again tomorrow. I let you win today ah."' : '"Next time lah."',
          null,
        ),
      );
    },
  });
}
