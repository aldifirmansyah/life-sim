/* The East, Sentosa and the North (step 9).
   - Katong: Peranakan shophouses on the way to the sea (laksa, kueh, beadwork).
   - East Coast Park: the Lagoon Food Village (a hawker centre), the beach: rent a
     bike along the coast, swim in the sea.
   - Sentosa: the cable car from HarbourFront (ride a cabin across the water; the
     stations are towers with a lift), Uniworsal Studios (a day ticket, then the
     rides), Siloso Beach (a coconut at the bar, the sea).
   - The North: Mandai Zoo (a ticket, then the orangutans, the elephants, the
     white tigers), the MacRitchie trail through the forest, and Woodlands
     Checkpoint for a day trip across the Causeway to Johor Bahru. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { addFloor } from '../core/levels';
import { register } from '../game/interact';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/hud';
import { startGame } from '../ui/minigame';
import { S } from '../core/state';
import { player, type Ride } from '../core/player';
import { blink, passTime, timeWarp } from '../core/time';
import { spend, sgd, addEnergy, addMood, owned } from '../game/stats';
import { buildHawker } from './hawker';
import { buildShopRow, near } from './shops';
import { KATONG_ROW, LAGOON, BEACH, CABLE, UNIWORSAL, SILOSO, ZOO, TRAIL, CHECKPOINT } from './sites';

export function buildRegions() {
  buildEast();
  buildCable();
  buildSentosa();
  buildNorth();
}

/** Something that takes a while and costs something: pay, pass the time, then the effects. */
function outing(
  price: number,
  minutes: number,
  text: string,
  energy: number,
  mood: number,
  title: string,
  note: string,
) {
  if (price && !spend(price)) return toast('Not enough money', `That's ${sgd(price)}.`);
  passTime(minutes, text, () => {
    addEnergy(energy);
    addMood(mood);
    toast(title, note, 'good');
  });
}

/* ---------- the East ---------- */

function buildEast() {
  buildShopRow('katong', KATONG_ROW, -1, [
    {
      name: '329 Katong Laksa',
      sub: 'Cut noodles · spoon only',
      color: '#e0a02a',
      hello: '"Laksa? Only spoon, no chopsticks. The noodles already cut for you."',
      wares: [
        {
          name: 'Katong laksa',
          price: 6.5,
          minutes: 20,
          energy: 26,
          mood: 8,
          note: 'Thick, spicy, cockles, all with a spoon. Worth the trip east.',
        },
      ],
    },
    {
      name: 'Kim Chew Kueh',
      sub: 'Nyonya kueh · Bak chang',
      color: '#2f8a4e',
      hello: 'Aunty Ivy: "Nyonya kueh, all handmade. The blue one is butterfly pea flower, not food colouring hor!"',
      wares: [
        { name: 'Nyonya kueh, a box (a gift)', price: 8, gift: 'kueh' },
        {
          name: 'Kueh salat and kopi',
          price: 5,
          minutes: 15,
          energy: 12,
          mood: 6,
          note: 'Pandan custard on blue glutinous rice. Aldi takes a photo before eating.',
        },
      ],
    },
    {
      name: 'Rumah Baba',
      sub: 'Peranakan beadwork · Tiles',
      color: '#c9493a',
      wares: [
        {
          name: 'A Peranakan tile for the room',
          price: 22,
          mood: 5,
          note: 'Pink and green and gold. It goes on the shelf.',
        },
      ],
    },
    {
      name: 'Katong Antiques',
      sub: 'Old things · Old stories',
      color: '#6b4a2f',
      wares: [
        {
          name: 'An old Singapore postcard',
          price: 6,
          mood: 3,
          note: 'Katong in 1965: the sea came right up to this road.',
        },
      ],
    },
  ]);
  buildHawker({
    name: 'East Coast Lagoon',
    board: ['East Coast Lagoon', 'Food Village · by the sea'],
    ...LAGOON,
    stalls: [
      {
        name: 'BBQ Stingray',
        sub: 'Sambal · Lime',
        color: '#b8342a',
        dishes: [
          {
            name: 'BBQ stingray',
            price: 15,
            energy: 28,
            mood: 9,
            note: 'Smoky sambal stingray in banana leaf. The sea breeze does the rest.',
          },
        ],
      },
      {
        name: 'Satay Bee Hoon',
        sub: 'Peanut gravy',
        color: '#8a4a2f',
        dishes: [
          {
            name: 'Satay bee hoon',
            price: 5,
            energy: 24,
            mood: 5,
            note: 'Rice noodles drowned in satay sauce. Messy and good.',
          },
        ],
      },
      {
        name: 'Carrot Cake',
        sub: 'White · Black',
        color: '#2c3e50',
        dishes: [
          {
            name: 'Black carrot cake',
            price: 4,
            energy: 22,
            mood: 5,
            note: 'No carrots, it turns out. Radish cake, fried with sweet soy.',
          },
        ],
      },
      {
        name: 'Coconut',
        sub: 'Chilled',
        color: '#3f7d3a',
        dishes: [
          {
            name: 'A fresh coconut',
            price: 4.5,
            energy: 8,
            mood: 5,
            note: 'Straight from the shell, cold.',
            drink: true,
          },
        ],
      },
    ],
  });
  // The beach: the bike kiosk and the sea.
  const p = new PropSet('beach-east');
  p.box(BEACH.x - 2, BEACH.x + 2, 0, 2.4, BEACH.z - 1.5, BEACH.z + 1.5, '#2f6fb3', { col: true });
  p.box(BEACH.x - 2.4, BEACH.x + 2.4, 2.4, 2.6, BEACH.z - 1.9, BEACH.z + 1.9, '#f2c14e');
  for (let k = 0; k < 5; k++)
    p.box(BEACH.x + 3 + k * 0.7, BEACH.x + 3.1 + k * 0.7, 0.3, 1, BEACH.z - 1, BEACH.z + 1, '#3a4046');
  sign(
    {
      text: 'Bike Rental',
      sub: 'East Coast Park',
      w: 3,
      h: 0.7,
      bg: '#2f6fb3',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#ffffff',
      font: 'ui',
    },
    BEACH.x,
    3,
    BEACH.z + 1.95,
    0,
    { both: true },
  );
  p.build();
  near.push({ p, x: BEACH.x, z: BEACH.z, r: 260 });
  register({
    x: BEACH.x,
    y: 1.2,
    z: BEACH.z + 1.7,
    reach: 3,
    size: 1.5,
    label: () => (S.time >= 7 * 60 && S.time < 21 * 60 ? 'Rent a bike for an hour (S$10)' : null),
    run: () =>
      outing(
        10,
        60,
        'Cycling along the coast…',
        -10,
        10,
        'East Coast Park',
        'Ships at anchor all along the horizon, the wind, the smell of BBQ pits. Aldi rides all the way to the jetty and back.',
      ),
  });
  register({
    x: BEACH.x + 10,
    y: 0.3,
    z: BEACH.z + 12,
    reach: 10,
    size: 6,
    label: () => (S.time >= 7 * 60 && S.time < 19 * 60 ? 'Swim in the sea' : null),
    run: () =>
      outing(
        0,
        40,
        'In the water…',
        -6,
        8,
        'A swim',
        'Warm water, ships on the horizon. Not Bali, but on a Saturday it will do.',
      ),
  });
}

/* ---------- the cable car ---------- */

const CAB_SPEED = 5,
  CAB_DWELL = 10;
interface Cabin {
  mesh: THREE.Group;
  /** 0 at HarbourFront … 1 at Sentosa; which way it's going; seconds left standing. */
  u: number;
  dir: 1 | -1;
  wait: number;
  side: number;
}
const cabins: Cabin[] = [];
const cableLen = Math.hypot(CABLE.bx - CABLE.ax, CABLE.bz - CABLE.az);
let cab: Cabin | null = null;
function cablePos(u: number, side: number): [number, number, number] {
  const dx = (CABLE.bx - CABLE.ax) / cableLen,
    dz = (CABLE.bz - CABLE.az) / cableLen;
  return [
    CABLE.ax + (CABLE.bx - CABLE.ax) * u - dz * side,
    CABLE.h + 1 - 8 * 4 * u * (1 - u),
    CABLE.az + (CABLE.bz - CABLE.az) * u + dx * side,
  ];
}

function buildCable() {
  const p = new PropSet('cable');
  const ry = Math.atan2(-(CABLE.bz - CABLE.az), CABLE.bx - CABLE.ax);
  for (const [x, z, name] of [
    [CABLE.ax, CABLE.az, 'HarbourFront'],
    [CABLE.bx, CABLE.bz, 'Sentosa'],
  ] as const) {
    // A tower with a lift, the platform on top.
    p.box(x - 3, x + 3, 0, CABLE.h, z - 3, z + 3, '#d8d4cc', { col: true });
    p.box(x - 6, x + 6, CABLE.h, CABLE.h + 0.3, z - 6, z + 6, '#8e969c');
    p.box(x - 6, x + 6, CABLE.h + 4, CABLE.h + 4.3, z - 6, z + 6, '#c9493a');
    for (const [a, b] of [
      [-6, -5.8],
      [5.8, 6],
    ])
      p.box(x + a, x + b, CABLE.h, CABLE.h + 1.1, z - 6, z + 6, '#3a4046');
    addFloor(x, z, 6, 6, 0, CABLE.h + 0.3);
    sign(
      {
        text: `Cable Car · ${name}`,
        sub: 'To ' + (name === 'Sentosa' ? 'HarbourFront' : 'Sentosa'),
        w: 4,
        h: 0.8,
        bg: '#c9493a',
        fg: '#ffffff',
        subfg: '#ffe7c2',
        border: '#ffffff',
        font: 'ui',
      },
      x,
      3,
      z + 3.05,
      0,
      { both: true },
    );
    register({
      x,
      y: 1.2,
      z: z + 3.4,
      reach: 3,
      size: 1.5,
      label: () => 'Lift up to the cable car',
      run: () => blink('Up…', () => Object.assign(player, { x, z: z + 4.5, y: CABLE.h + 0.3, yaw: 0, pitch: 0 })),
    });
    // Boarding: the cabin standing at this end, from anywhere on the platform.
    const end = name === 'Sentosa' ? 1 : 0;
    register({
      x,
      y: CABLE.h + 1.5,
      z,
      reach: 9,
      size: 5,
      label: () => {
        const c = cabins.find(q => q.u === end && q.wait > 1);
        if (player.ride || Math.abs(player.y - CABLE.h - 0.3) > 1) return null;
        return c ? `Ride the cable car to ${end ? 'HarbourFront' : 'Sentosa'} (S$18)` : 'Wait for the cable car';
      },
      run: () => {
        const c = cabins.find(q => q.u === end && q.wait > 1);
        if (!c) return toast('Cable car', 'The next cabin comes in a minute.');
        if (!spend(18)) return toast('Not enough money', 'The cable car is S$18.');
        cab = c;
        player.ride = cabinRide();
        toast('Cable car', 'Up over the harbour. Hold on to your phone.', null);
      },
    });
    p.box(x + 4.2, x + 5.8, CABLE.h + 0.3, CABLE.h + 2.5, z + 5.6, z + 5.8, '#b9c0c6');
    register({
      x: x + 5,
      y: CABLE.h + 1.3,
      z: z + 5.6,
      reach: 3,
      size: 1.2,
      label: () => 'Lift down',
      run: () => blink('Down…', () => Object.assign(player, { x, z: z + 4.6, y: 0, yaw: 0 })),
    });
  }
  // The cables.
  for (const side of [-1.6, 1.6]) {
    const [x0, , z0] = cablePos(0, side);
    const [x1, , z1] = cablePos(1, side);
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, cableLen, 4).rotateZ(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x2b3035 }),
    );
    m.position.set((x0 + x1) / 2, CABLE.h + 3.2, (z0 + z1) / 2);
    m.rotation.y = ry;
    scene.add(m);
  }
  p.build();
  near.push({ p, x: (CABLE.ax + CABLE.bx) / 2, z: (CABLE.az + CABLE.bz) / 2, r: 500 });
  // Two cabins, one on each cable, crossing in the middle.
  const g = new THREE.BoxGeometry(2.2, 2.2, 2.2);
  const glassMat = new THREE.MeshLambertMaterial({
    color: 0x9fc3d1,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const [u, dir, side] of [
    [0, 1, 1.6],
    [1, -1, -1.6],
  ] as const) {
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(g, glassMat);
    body.position.y = 1.1;
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.15, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xc9493a }),
    );
    const roof = floor.clone();
    roof.position.y = 2.2;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.3, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x3a4046 }),
    );
    arm.position.y = 2.9;
    mesh.add(body, floor, roof, arm);
    mesh.rotation.y = ry;
    scene.add(mesh);
    const c: Cabin = { mesh, u, dir, wait: CAB_DWELL, side };
    cabins.push(c);
  }
}
function cabinRide(): Ride {
  return {
    step() {
      if (!cab) return;
      const q = cab.mesh.position;
      player.x = q.x;
      player.z = q.z;
      player.y = q.y - 0.9;
      player.vx = player.vz = 0;
    },
    label: () => `Cable car to ${cab!.dir === 1 ? 'Sentosa' : 'HarbourFront'}`,
  };
}
function updateCable(dt: number) {
  const t = dt * timeWarp();
  for (const c of cabins) {
    if (c.wait > 0) c.wait = Math.max(0, c.wait - t);
    else {
      c.u += (c.dir * CAB_SPEED * t) / cableLen;
      if (c.u >= 1 || c.u <= 0) {
        c.u = c.u >= 1 ? 1 : 0;
        c.dir = c.dir === 1 ? -1 : 1;
        c.wait = CAB_DWELL;
        // Docked: step out onto the platform.
        if (cab === c) {
          const [x, z] = c.u === 1 ? [CABLE.bx, CABLE.bz] : [CABLE.ax, CABLE.az];
          Object.assign(player, { x, z: z - 2, y: CABLE.h + 0.3 });
          player.ride = null;
          cab = null;
          toast(c.u === 1 ? 'Sentosa' : 'HarbourFront', 'Take the lift down.', null);
        }
      }
    }
    const [x, y, z] = cablePos(c.u, c.side);
    c.mesh.position.set(x, y, z);
  }
  // Aboard, the clock slows like on the buses.
  if (cab) S.clockScale = 0.2;
}

/* ---------- Sentosa ---------- */

const uni = { day: -1 };
function buildSentosa() {
  register({
    x: UNIWORSAL.x,
    y: 1.5,
    z: UNIWORSAL.z,
    reach: 6,
    size: 4,
    label: () => (S.time >= 10 * 60 && S.time < 19 * 60 ? 'Uniworsal Studios' : 'Uniworsal Studios (opens at 10am)'),
    run: () => {
      if (S.time < 10 * 60 || S.time >= 19 * 60) return toast('Uniworsal Studios', 'Open 10am to 7pm.');
      if (uni.day !== S.day) {
        openPanel({
          title: 'Uniworsal Studios',
          sub: 'Sentosa · a day ticket',
          body: 'Seven zones, two coasters, one very expensive bottle of water.',
          rows: [
            {
              label: 'Buy a day ticket',
              note: sgd(82),
              run: () => {
                if (!spend(82)) return toast('Not enough money', 'A day ticket is S$82.');
                uni.day = S.day;
                parkMenu();
              },
            },
            { label: 'Not today', run: () => closePanel() },
          ],
        });
        return;
      }
      parkMenu();
    },
  });
  const p = new PropSet('siloso');
  p.box(SILOSO.x - 3, SILOSO.x + 3, 0, 3, SILOSO.z - 2, SILOSO.z + 2, '#c9a878', { col: true });
  p.put(SILOSO.x, 3.8, SILOSO.z, 8, 1.6, 6, '#8a6a4a', 0, p.roof);
  sign(
    {
      text: 'Siloso Beach Bar',
      sub: 'Coconuts · Sunsets',
      w: 4,
      h: 0.8,
      bg: '#2f6b4f',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#f2c14e',
      font: 'ui',
    },
    SILOSO.x,
    2.6,
    SILOSO.z - 2.05,
    Math.PI,
    { both: true },
  );
  p.build();
  near.push({ p, x: SILOSO.x, z: SILOSO.z, r: 260 });
  register({
    x: SILOSO.x,
    y: 1.2,
    z: SILOSO.z - 2.4,
    reach: 3,
    size: 1.5,
    label: () => 'Siloso Beach Bar: a coconut (S$8)',
    run: () =>
      outing(
        8,
        30,
        'Coconut in the shade…',
        8,
        S.time >= 18 * 60 ? 10 : 6,
        'Siloso Beach',
        S.time >= 18 * 60
          ? 'The sun going down behind the ships. One of the good days.'
          : 'Sand, a coconut, nobody asking about sprints.',
      ),
  });
  register({
    x: SILOSO.x + 6,
    y: 0.3,
    z: SILOSO.z + 9,
    reach: 10,
    size: 6,
    label: () => (S.time >= 7 * 60 && S.time < 19 * 60 ? 'Swim at Siloso' : null),
    run: () => outing(0, 40, 'In the sea…', -6, 9, 'A swim at Siloso', 'Clear water, a hammock after. Sentosa, lah.'),
  });
}
function parkMenu() {
  openPanel({
    title: 'Uniworsal Studios',
    sub: 'Your day ticket',
    rows: [
      {
        label: 'Battlestar Galactica: the coaster',
        note: '20 min',
        run: () => {
          closePanel();
          startGame({
            kind: 'timing',
            title: 'Hold on!',
            sub: 'Battlestar Galactica, the dueling coasters',
            help: 'Press Space when the marker is in the zone to keep your stomach where it is.',
            seconds: 10,
            goal: 3,
            tries: 6,
            zone: 0.25,
            speed: 1.2,
            done: r =>
              outing(
                0,
                20,
                'Screaming…',
                -8,
                r.won ? 12 : 7,
                r.won ? 'Survived the coaster!' : 'That was a lot',
                r.won
                  ? 'Aldi screams the whole way and immediately wants to go again.'
                  : "Aldi's legs are jelly. Worth it.",
              ),
          });
        },
      },
      {
        label: 'Revenge of the Mummy',
        note: '20 min',
        run: () => (
          closePanel(),
          outing(
            0,
            20,
            'In the dark…',
            -5,
            9,
            'The Mummy',
            'Fire, scarabs, a drop in the dark. Aldi pretends not to have screamed.',
          )
        ),
      },
      {
        label: 'The 4-D show',
        note: '25 min',
        run: () => (
          closePanel(),
          outing(
            0,
            25,
            'Wearing the glasses…',
            2,
            5,
            'The 4-D show',
            'Water sprayed in your face at exactly the wrong moment.',
          )
        ),
      },
      {
        label: 'A minion hat for the room',
        note: owned.includes('minion') ? 'got it' : sgd(25),
        disabled: owned.includes('minion') ? 'Already yours' : undefined,
        run: () => {
          if (!spend(25)) return toast('Not enough money', 'The hat is S$25.');
          owned.push('minion');
          addMood(4);
          toast('A minion hat', 'Ridiculous. Aldi wears it the whole day.', null);
          parkMenu();
        },
      },
      { label: 'Leave the park', run: () => closePanel() },
    ],
  });
}

/* ---------- the North ---------- */

const zoo = { day: -1, seen: [] as string[] };
function buildNorth() {
  const { x, z, w, d } = ZOO;
  const p = new PropSet('zoo');
  const x0 = x - w / 2,
    x1 = x + w / 2,
    z0 = z - d / 2,
    z1 = z + d / 2;
  p.box(x0, x1, 0, 0.05, z0, z1, '#6b8a4a');
  for (const [ax, bx, az, bz] of [
    [x0, x1, z0, z0 + 0.3],
    [x0, x0 + 0.3, z0, z1],
    [x1 - 0.3, x1, z0, z1],
    [x0, x - 3, z1 - 0.3, z1],
    [x + 3, x1, z1 - 0.3, z1],
  ])
    p.box(ax, bx, 0, 2.2, az, bz, '#5a4a32', { col: true });
  p.box(x - 3.5, x + 3.5, 3.4, 4.2, z1 - 0.6, z1 + 0.6, '#3f7d3a');
  for (const dx of [-3.5, 3.5]) p.post(x + dx, z1, 0, 3.4, 0.2, '#6b5139');
  sign(
    {
      text: 'Mandai Zoo',
      sub: 'Rainforest · Open daily',
      w: 5,
      h: 0.9,
      bg: '#2f6b4f',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#f2c14e',
      font: 'ui',
    },
    x,
    4.9,
    z1 + 0.65,
    0,
    { both: true },
  );
  // Enclosures: a low wall, trees, the animals as low-poly blocks.
  const pens: [string, number, number, string, string][] = [
    [
      'orangutans',
      x - 22,
      z - 8,
      '#a0522d',
      'The orangutans, from Borneo and Sumatra. One stares at Aldi like a long-lost cousin. "Orang hutan" means person of the forest, Aldi tells the kid next to him.',
    ],
    ['elephants', x, z - 8, '#8e969c', 'Asian elephants, bathing and splashing the front row. The front row loves it.'],
    ['tigers', x + 22, z - 8, '#f4f1ea', 'White tigers pacing by the moat. Beautiful and a bit scary.'],
  ];
  for (const [id, px, pz, col] of pens) {
    p.box(px - 8, px + 8, 0, 1.1, pz - 6, pz - 5.7, '#8a7a5a', { col: true });
    p.box(px - 8, px - 7.7, 0, 1.1, pz - 6, pz + 6, '#8a7a5a', { col: true });
    p.box(px + 7.7, px + 8, 0, 1.1, pz - 6, pz + 6, '#8a7a5a', { col: true });
    p.box(px - 8, px + 8, 0, 1.1, pz + 5.7, pz + 6, '#8a7a5a', { col: true });
    p.put(px - 4, 2.5, pz - 2, 3, 3, 3, '#3f7d3a', 0, p.cone);
    for (let k = 0; k < 2; k++) {
      const s = id === 'elephants' ? 2 : id === 'tigers' ? 1 : 1.1;
      p.box(px + k * 3 - s, px + k * 3 + s, 0, s * 1.1, pz + 1 - s * 0.6, pz + 1 + s * 0.6, col);
      p.box(px + k * 3 + s * 0.7, px + k * 3 + s * 1.4, s * 0.6, s * 1.3, pz + 1 - s * 0.3, pz + 1 + s * 0.3, col);
    }
    register({
      x: px,
      y: 1,
      z: pz + 6,
      reach: 4,
      size: 3,
      label: () => (zoo.day === S.day ? `Watch the ${id}` : null),
      run: () => {
        const first = !zoo.seen.includes(id);
        if (first) zoo.seen.push(id);
        outing(0, 15, `The ${id}…`, -2, first ? 6 : 2, `The ${id}`, pens.find(q => q[0] === id)![4]);
      },
    });
  }
  p.build();
  near.push({ p, x, z, r: 300 });
  register({
    x,
    y: 1.5,
    z: z1 + 1,
    reach: 4,
    size: 3,
    label: () =>
      zoo.day === S.day
        ? null
        : S.time >= 8.5 * 60 && S.time < 18 * 60
          ? 'Mandai Zoo: a ticket (S$48)'
          : 'Mandai Zoo (8.30am to 6pm)',
    run: () => {
      if (S.time < 8.5 * 60 || S.time >= 18 * 60) return toast('Mandai Zoo', 'Open 8.30am to 6pm.');
      if (!spend(48)) return toast('Not enough money', 'A ticket is S$48.');
      zoo.day = S.day;
      toast('Mandai Zoo', 'Ticket in hand. The orangutans are on the left.', null);
    },
  });
  // The MacRitchie trail.
  register({
    x: TRAIL.x,
    y: 1.2,
    z: TRAIL.z,
    reach: 6,
    size: 4,
    label: () => (S.time >= 7 * 60 && S.time < 18 * 60 ? 'Walk the MacRitchie trail (TreeTop Walk)' : null),
    run: () =>
      outing(
        0,
        90,
        'Through the forest…',
        -15,
        10,
        'MacRitchie',
        "Boardwalks over the swamp, the suspension bridge in the canopy, a monkey stealing someone's bread. The city is gone for an hour.",
      ),
  });
  const tp = new PropSet('trail');
  tp.post(TRAIL.x, TRAIL.z, 0, 2.2, 0.1, '#6b5139');
  sign(
    {
      text: 'MacRitchie Trail',
      sub: 'TreeTop Walk 4.5 km',
      w: 2.6,
      h: 0.7,
      bg: '#2f6b4f',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#f2c14e',
      font: 'ui',
    },
    TRAIL.x,
    2.4,
    TRAIL.z + 0.15,
    0,
    { both: true },
  );
  tp.build();
  near.push({ p: tp, x: TRAIL.x, z: TRAIL.z, r: 200 });
  // Woodlands Checkpoint and the Causeway.
  const C = CHECKPOINT;
  const cp = new PropSet('checkpoint');
  cp.box(C.x - C.w / 2, C.x + C.w / 2, 0, 8, C.z - C.d / 2, C.z + C.d / 2, '#dfe3e6', { col: true });
  cp.box(C.x - C.w / 2 - 2, C.x + C.w / 2 + 2, 8, 9, C.z - C.d / 2 - 2, C.z + C.d / 2 + 2, '#8e969c');
  sign(
    {
      text: 'Woodlands Checkpoint',
      sub: 'To Johor Bahru · the Causeway',
      w: 7,
      h: 1,
      bg: '#1d2b36',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#f2c14e',
      font: 'ui',
    },
    C.x,
    6,
    C.z + C.d / 2 + 0.1,
    0,
    { both: true },
  );
  cp.build();
  near.push({ p: cp, x: C.x, z: C.z, r: 300 });
  register({
    x: C.x,
    y: 1.5,
    z: C.z + C.d / 2 + 1,
    reach: 5,
    size: 4,
    label: () =>
      S.time >= 7 * 60 && S.time < 13 * 60
        ? 'Day trip across the Causeway to Johor Bahru'
        : 'The Causeway (day trips leave in the morning)',
    run: () => {
      if (S.time < 7 * 60 || S.time >= 13 * 60)
        return toast('Woodlands Checkpoint', 'Go early, or sit in the jam all afternoon.');
      outing(
        60,
        6 * 60,
        'Across the Causeway…',
        -20,
        12,
        'Johor Bahru',
        'The jam at the Causeway, then cheap groceries, a massage, satay and mee rebus. Aldi comes back with bags and a sunburn.',
      );
    },
  });
}

export function updateRegions(dt: number) {
  updateCable(dt);
}
export const saveRegions = () => ({ uni: uni.day, zoo: zoo.day, seen: [...zoo.seen] });
export function loadRegions(d: { uni: number; zoo: number; seen: string[] } | undefined) {
  uni.day = d?.uni ?? -1;
  zoo.day = d?.zoo ?? -1;
  zoo.seen = [...(d?.seen ?? [])];
  cab = null;
}
