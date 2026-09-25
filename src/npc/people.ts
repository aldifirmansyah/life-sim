/* The named people (step 6): Aldi's colleagues at Chopee, the hawkers at
   Clementi and Lau Pa Sat, the neighbours at Blk 420, a few faces round town.
   Each has a place for each part of the day (a spot: where they stand or sit,
   and which way they face), a character drawn by the shared crowd renderer, and
   the NPC data the friendship rules use (social/social.ts): likes, dislikes,
   traits, ties to the others, a birthday, two stories, the gifts they love.
   Talking (E): a greeting, then chat about a topic, ask about them, compliment,
   joke, give a gift from the bag, ask what they think of someone, and bye. Game
   logic decides the outcome and the friendship change; the dialogue provider
   (dialogue/template.ts) words it. The phone's Contacts shows who Aldi knows.
   People are only moved between spots (no walking between places yet), and only
   drawn within 70 m. */
import { hash, rng } from '../core/util';
import { S } from '../core/state';
import { player } from '../core/player';
import { circles } from '../core/collision';
import { toast } from '../ui/hud';
import { openPanel, closePanel, type Row } from '../ui/panel';
import { register } from '../game/interact';
import { weekday, dateOf } from '../game/calendar';
import { bag, ITEM_NAMES, takeItem } from '../game/stats';
import { Crowd, type PoseState } from './characters';
import { generateAppearance, SG_SKINS } from './appearance';
import type { AppearanceParams, NPC, Topic, Trait } from './types';
import {
  social,
  meet,
  befriend,
  greetingKind,
  chat,
  ask,
  compliment,
  joke,
  gossip,
  gift,
  byeKind,
  properName,
  dailyDecay,
  saveSocial,
  loadSocial,
  TOPICS,
  stageRank,
} from '../social/social';
import { provider, PERSONAL } from '../dialogue/template';
import type { LineKind } from '../dialogue/types';
import {
  CHOPEE_HQ,
  CITY_OFFICE,
  CLEMENTI_HAWKER,
  LAU_PA_SAT,
  BOAT_QUAY,
  HOME_SITES,
  MOSQUE,
  LUCKY,
  TEKKA,
  CT_MARKET,
  HAJI_LANE,
  TB_MARKET,
} from '../places/sites';

/** Slots in the shared crowd: named people first, then the passers-by (npc/crowds.ts). */
export const NAMED_SLOTS = 40;
export const crowd = new Crowd(NAMED_SLOTS + 40);

interface Spot {
  x: number;
  y: number;
  z: number;
  ry: number;
  sit?: number;
  where: string;
}
type Plan = [string, string][];
interface Person {
  npc: NPC;
  role: string;
  /** The plan for a day: [from "HH:MM", spot key or 'away']. */
  plan: (day: number) => Plan;
  stories: string[];
  loves: string[];
  likes: string[];
  dislikes?: string[];
  slot: number;
  /** Where they are now (null: away). */
  at: Spot | null;
  shown: boolean;
  circle: { x: number; z: number; r: number };
  pose: PoseState;
}
export const people: Person[] = [];
const spots: Record<string, Spot> = {};

/* ---------- places ---------- */

const face = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
function buildSpots() {
  const add = (k: string, s: Spot) => (spots[k] = s);
  // Chopee HQ: desks on Level 2 (chairs 1.2 m either side of each desk), the Merlion room, the canteen.
  const H = CHOPEE_HQ,
    Y2 = H.l2;
  const desk = (k: string, row: number, col: number, e: number, s: number) =>
    add(k, {
      x: H.x0 + 14 + col * 5.5 + e,
      y: Y2,
      z: H.z0 + 9 + row * 4 + s * 1.2,
      ry: s > 0 ? Math.PI : 0,
      sit: Y2 + 0.48,
      where: 'Chopee · Level 2',
    });
  desk('hq.weijie', 2, 2, -1.1, 1);
  desk('hq.hafiz', 0, 0, -1.1, -1);
  desk('hq.meiling', 1, 1, 1.1, 1);
  desk('hq.arun', 1, 0, -1.1, 1);
  desk('hq.siti', 2, 0, 1.1, -1);
  desk('hq.kenji', 0, 2, 1.1, -1);
  const mx = H.x0 + 4.5,
    mz = H.z0 + 4;
  [
    [-2.4, -1.6],
    [2.4, -1.6],
    [-2.4, 1.6],
    [2.4, 1.6],
    [0, 1.9],
    [0, -1.9],
  ].forEach(([dx, dz], i) =>
    add(`hq.standup.${i}`, {
      x: mx + dx,
      y: Y2,
      z: mz + dz,
      ry: face(mx + dx, mz + dz, mx, mz),
      where: 'Merlion room',
    }),
  );
  [
    [4, 6.5],
    [10, 6.5],
    [4, 9.5],
    [10, 9.5],
  ].forEach(([dx, dz], t) =>
    [-1, 1].forEach((s, k) =>
      add(`hq.lunch.${t * 2 + k}`, {
        x: H.x0 + dx + (k ? 0.6 : -0.6),
        y: 0,
        z: H.z0 + dz + s,
        ry: s > 0 ? Math.PI : 0,
        sit: 0.45,
        where: 'Chopee Canteen',
      }),
    ),
  );
  add('hq.reception', { x: H.x0 + 8, y: 0, z: H.z1 - 6.7, ry: 0, where: 'Chopee · Reception' });
  // The city office, Level 30.
  const C = CITY_OFFICE;
  add('city.rachel', {
    x: C.x0 + 18.5,
    y: C.floor,
    z: C.z0 + 12.8,
    ry: 0,
    sit: C.floor + 0.48,
    where: 'Chopee · Level 30',
  });
  add('city.daniel', {
    x: C.x0 + 23.5,
    y: C.floor,
    z: C.z0 + 21.2,
    ry: Math.PI,
    sit: C.floor + 0.48,
    where: 'Chopee · Level 30',
  });
  // 448 Clementi: behind the counters, by the tray return.
  const K = CLEMENTI_HAWKER,
    kx0 = K.x - K.w / 2,
    kz0 = K.z - K.d / 2,
    ksw = K.w / 7;
  const stall = (k: string, i: number) =>
    add(k, { x: kx0 + ksw * (i + 0.5), y: 0, z: kz0 + 1.6, ry: 0, where: '448 Clementi' });
  stall('k.ahseng', 0);
  stall('k.harun', 1);
  stall('k.lily', 6);
  add('k.tray', { x: K.x + K.w / 2 - 3.4, y: 0, z: K.z + K.d / 2 - 4, ry: -Math.PI / 2, where: '448 Clementi' });
  add('k.table', { x: kx0 + 10.5 + 1.05, y: 0, z: K.z + 4, ry: -Math.PI / 2, sit: 0.44, where: '448 Clementi' });
  // Blk 420: the void deck's stone table and letterboxes, the flat, the corridor, the interchange.
  const B = HOME_SITES.find(h => h.id === 'clementi')!;
  const tx = B.x - 6,
    tz = B.z;
  add('b.chess', { x: tx + 1.2, y: 0, z: tz, ry: -Math.PI / 2, sit: 0.44, where: 'Blk 420 void deck' });
  add('b.table', { x: tx, y: 0, z: tz + 1.2, ry: Math.PI, sit: 0.44, where: 'Blk 420 void deck' });
  add('b.letterbox', { x: B.x - B.w / 2 + 5, y: 0, z: B.z - B.d / 2 + 2.3, ry: Math.PI, where: 'Blk 420 void deck' });
  const ux0 = B.x - 5,
    uz1 = B.z + B.d / 2,
    fy = B.floor!;
  add('b.sofa', { x: ux0 + 2.5, y: fy, z: uz1 - 1.75, ry: Math.PI, sit: fy + 0.45, where: 'Blk 420, #07-12' });
  add('b.living', { x: ux0 + 1.6, y: fy, z: uz1 - 5.5, ry: Math.PI / 2, where: 'Blk 420, #07-12' });
  add('b.corridor', { x: B.x + 8, y: fy, z: uz1 + 1, ry: 0, where: 'Blk 420, level 7' });
  add('b.busstop', { x: -942.5, y: 0, z: 210, ry: 0, where: 'Clementi Int' });
  // Lau Pa Sat, Boat Quay, one-north.
  const P = LAU_PA_SAT;
  add('lps.satay', { x: P.x - P.w / 2 + 2.5, y: 0, z: P.z - P.d / 2 + 1.6, ry: 0, where: 'Lau Pa Sat' });
  add('lps.table', {
    x: P.x - P.w / 2 + 4.5 + 1.05,
    y: 0,
    z: P.z - 2,
    ry: -Math.PI / 2,
    sit: 0.44,
    where: 'Lau Pa Sat',
  });
  const Q = BOAT_QUAY;
  add('bq.marcus', { x: Q.x0 + 45, y: 0, z: Q.z0 - 1.2, ry: Math.PI, where: 'Boat Quay' });
  add('bq.table', { x: Q.x0 + 48, y: 0, z: Q.z0 - 4.7, ry: 0, where: 'Boat Quay' });
  add('on.desk', { x: -522, y: 0, z: 160, ry: -Math.PI / 2, where: 'one-north Residences' });
  // Step 7: the mosque, Lucky Place, the markets.
  const M = MOSQUE;
  add('m.imam', { x: M.x - M.w / 2 + 2.2, y: 0, z: M.z + 1.5, ry: Math.PI / 2, where: 'Masjid Sultan' });
  add('m.jumaat', { x: M.x + 2, y: 0, z: M.z + 4, ry: -Math.PI / 2, sit: 0.35, where: 'Masjid Sultan' });
  const U = LUCKY,
    ux = (U.x0 + U.x1) / 2;
  add('l.toko', { x: U.x0 + 5, y: 0, z: U.z0 + 3.2, ry: 0, where: 'Lucky Place' });
  add('l.bench1', { x: ux - 6.6, y: 0, z: U.z1 - 5.7, ry: Math.PI, sit: 0.45, where: 'Lucky Place' });
  add('l.bench2', { x: ux - 5.4, y: 0, z: U.z1 - 5.7, ry: Math.PI, sit: 0.45, where: 'Lucky Place' });
  const tk = TEKKA;
  add('t.garland', {
    x: tk.x - tk.w / 2 + (tk.w / 5) * 3.5,
    y: 0,
    z: tk.z - tk.d / 2 + 1.6,
    ry: 0,
    where: 'Tekka Centre',
  });
  add('c.tea', { x: CT_MARKET.x0 + 8.2, y: 0, z: CT_MARKET.z0 - 1.3, ry: -Math.PI / 2, where: 'Chinatown' });
  add('h.batik', { x: HAJI_LANE.x0 + 6.8, y: 0, z: HAJI_LANE.z1 + 1.3, ry: -Math.PI / 2, where: 'Haji Lane' });
  const tb = TB_MARKET;
  add('tb.bakery', {
    x: tb.x - tb.w / 2 + (tb.w / 4) * 2.5,
    y: 0,
    z: tb.z - tb.d / 2 + 1.6,
    ry: 0,
    where: 'Tiong Bahru Market',
  });
}

/* ---------- the roster ---------- */

const T = (h: string) => h;
const weekdays = (d: number) => weekday(d) >= 1 && weekday(d) <= 5;
/** An office worker's day at HQ: desk, the stand-up, lunch at the canteen, home at `off`. */
function office(desk: string, standup: number, lunch: number, off = '19:00'): (d: number) => Plan {
  return d =>
    weekdays(d)
      ? [
          [T('06:00'), 'away'],
          ['09:20', desk],
          ['09:55', `hq.standup.${standup}`],
          ['10:15', desk],
          ['12:30', `hq.lunch.${lunch}`],
          ['13:15', desk],
          [off, 'away'],
        ]
      : [['06:00', 'away']];
}
const daily =
  (...p: Plan) =>
  (): Plan =>
    p;

interface Def {
  id: string;
  name: string;
  address: string;
  age: number;
  gender: 'm' | 'f';
  role: string;
  birthday: string;
  traits: Trait[];
  likes: Topic[];
  dislikes: Topic[];
  plan: (day: number) => Plan;
  stories: string[];
  loves: string[];
  gifts: string[];
  hates?: string[];
  look: Partial<AppearanceParams>;
  ties?: Record<string, number>;
  intro?: string[];
}
const DEFS: Def[] = [
  {
    id: 'weijie',
    name: 'Wei Jie',
    address: '',
    age: 38,
    gender: 'm',
    role: 'Engineering manager, Checkout',
    birthday: '14 March',
    traits: ['ambitious', 'caring'],
    likes: ['work', 'football', 'food'],
    dislikes: ['gossip'],
    plan: office('hq.weijie', 0, 0, '19:30'),
    stories: [
      'Last time I also junior like you. First week I brought down the payment page. On a Friday. Everyone survive, you also will.',
      'My daughter just start Primary One. Every night homework, homework. Coding is easier, I tell you.',
    ],
    loves: ['bbt'],
    gifts: ['kopi', 'tarts'],
    look: { skin: '#dcb08a', hair: 'short', top: '#ee4d2d', longSleeves: false, bottom: '#2c3e50' },
    ties: { hafiz: 40, meiling: 30, kenji: 35, rachel: 20 },
    intro: ["Aldi! Finally meet you properly. I'm Wei Jie, your manager. Anything, just ask me, don't paiseh."],
  },
  {
    id: 'hafiz',
    name: 'Hafiz',
    address: '',
    age: 29,
    gender: 'm',
    role: 'Engineer, Payments',
    birthday: '2 June',
    traits: ['cheerful', 'sporty'],
    likes: ['football', 'music', 'food'],
    dislikes: ['property'],
    plan: office('hq.hafiz', 1, 1),
    stories: [
      'Every Saturday I play futsal at Kallang. You should come! We need a keeper, nobody wants to be keeper.',
      "My parents stay in Tampines, same flat since I was born. My mother still packs me lunch sometimes. Don't tell anyone.",
    ],
    loves: ['puff'],
    gifts: ['kopi', 'bbt'],
    look: { skin: '#b67d55', hair: 'short', top: '#2f6fb3', bottom: '#1f2a36' },
    ties: { weijie: 40, siti: 50, daniel: 45, meiling: 10 },
  },
  {
    id: 'meiling',
    name: 'Mei Ling',
    address: '',
    age: 27,
    gender: 'f',
    role: 'Frontend engineer',
    birthday: '30 September',
    traits: ['curious', 'artsy'],
    likes: ['shopping', 'music', 'travel'],
    dislikes: ['football'],
    plan: office('hq.meiling', 2, 2),
    stories: [
      'I went Bali last year, then Jakarta for work. Your city damn big! Traffic also damn big.',
      'I draw comics on weekends. One day I quit and do full time. One day…',
    ],
    loves: ['bbt'],
    gifts: ['tarts'],
    hates: ['kopi'],
    look: { skin: '#e8c4a0', hair: 'long', top: '#f4f1ea', bottom: '#6b3f5a', skirt: true },
    ties: { arun: 20, kenji: 30, nurul: 25, hafiz: 10 },
  },
  {
    id: 'arun',
    name: 'Arun',
    address: '',
    age: 33,
    gender: 'm',
    role: 'Backend engineer',
    birthday: '18 November',
    traits: ['bookish', 'grumpy'],
    likes: ['tech', 'travel', 'family'],
    dislikes: ['weather'],
    plan: office('hq.arun', 3, 3),
    stories: [
      "I wrote half of the order service. The other half, don't ask who wrote. I still have nightmares.",
      'My wife and I just got our BTO keys in Tengah. Five years we waited. Five years!',
    ],
    loves: ['kopi'],
    gifts: ['puff'],
    look: { skin: '#6a4028', hair: 'short', top: '#3a9a73', bottom: '#3b3a36' },
    ties: { meiling: 20, kenji: 25, weijie: 15 },
  },
  {
    id: 'siti',
    name: 'Siti',
    address: '',
    age: 31,
    gender: 'f',
    role: 'Product designer',
    birthday: '5 April',
    traits: ['artsy', 'caring'],
    likes: ['religion', 'food', 'family'],
    dislikes: ['tech'],
    plan: office('hq.siti', 4, 4),
    stories: [
      'My grandmother came from Java, you know. She still says some words in Javanese. Maybe you can talk to her!',
      'Before Chopee I designed bus stop signs. Now every time I take the bus, I check the fonts. Occupational hazard.',
    ],
    loves: ['kueh'],
    gifts: ['tarts'],
    look: { skin: '#b67d55', hair: 'hijab', headwear: '#3a9a73', top: '#e8e4da', bottom: '#2f5d8a' },
    ties: { hafiz: 50, nurul: 40, weijie: 30 },
  },
  {
    id: 'kenji',
    name: 'Kenji',
    address: '',
    age: 35,
    gender: 'm',
    role: 'Product manager (from Osaka)',
    birthday: '21 January',
    traits: ['shy', 'curious'],
    likes: ['travel', 'food', 'tech'],
    dislikes: ['property'],
    plan: office('hq.kenji', 5, 5),
    stories: [
      'I came three years ago. First month, I also didn\'t know what "can lah" means. Now I say it more than Singaporeans.',
      'Rent here… in Osaka I could have a whole house. Here, one room. But the food, worth it.',
    ],
    loves: ['tarts'],
    gifts: ['kueh'],
    look: { skin: '#e8c4a0', hair: 'short', top: '#2c3e50', bottom: '#4a5a6a' },
    ties: { weijie: 35, meiling: 30, arun: 25 },
  },
  {
    id: 'nurul',
    name: 'Nurul',
    address: '',
    age: 24,
    gender: 'f',
    role: 'Receptionist, Chopee HQ',
    birthday: '12 December',
    traits: ['gossip', 'cheerful'],
    likes: ['shopping', 'gossip', 'music'],
    dislikes: ['work'],
    plan: d =>
      weekdays(d)
        ? [
            ['06:00', 'away'],
            ['08:30', 'hq.reception'],
            ['12:00', 'hq.lunch.6'],
            ['12:45', 'hq.reception'],
            ['18:00', 'away'],
          ]
        : [['06:00', 'away']],
    stories: [
      'You know who is dating who in this building? I know. Everything. But I say nothing. Hehe.',
      "On weekends I sell baju kurung online. Hari Raya season, I don't sleep.",
    ],
    loves: ['bbt', 'flowers'],
    gifts: ['tarts'],
    look: { skin: '#c58b62', hair: 'hijab', headwear: '#e8c9bd', top: '#ee4d2d', bottom: '#2c3e50' },
    ties: { siti: 40, daniel: 30, meiling: 25 },
  },
  {
    id: 'rachel',
    name: 'Rachel',
    address: '',
    age: 41,
    gender: 'f',
    role: 'Head of seller partnerships',
    birthday: '8 July',
    traits: ['ambitious'],
    likes: ['property', 'work', 'travel'],
    dislikes: ['football'],
    plan: d =>
      weekdays(d)
        ? [
            ['06:00', 'away'],
            ['09:00', 'city.rachel'],
            ['19:30', 'away'],
          ]
        : [['06:00', 'away']],
    stories: [
      'I started at Chopee when we were thirty people in a shophouse in Tanjong Pagar. The aircon broke every week.',
      'Tip from me: in a meeting, the person who writes on the whiteboard wins. Remember that.',
    ],
    loves: ['flowers'],
    gifts: ['tarts'],
    hates: ['puff'],
    look: { skin: '#e8c4a0', hair: 'bun', top: '#1d2b36', bottom: '#1d2b36', longSleeves: true },
    ties: { daniel: 20, weijie: 20 },
  },
  {
    id: 'daniel',
    name: 'Daniel',
    address: '',
    age: 30,
    gender: 'm',
    role: 'Partnerships, the city office',
    birthday: '25 October',
    traits: ['cheerful', 'gossip'],
    likes: ['football', 'music', 'gossip'],
    dislikes: ['religion'],
    plan: d =>
      weekdays(d)
        ? [
            ['06:00', 'away'],
            ['09:30', 'city.daniel'],
            ['19:00', 'away'],
          ]
        : [['06:00', 'away']],
    stories: [
      'My family is Eurasian: Portuguese, Chinese, a bit of everything. Our Christmas devil curry, you must try.',
      'Friday nights I play bass in a band at Clarke Quay. We are terrible. Come!',
    ],
    loves: ['kopi'],
    gifts: ['bbt'],
    look: { skin: '#d4a57c', hair: 'short', top: '#6fa8dc', bottom: '#2c3e50' },
    ties: { hafiz: 45, nurul: 30, rachel: 20 },
  },
  {
    id: 'ahseng',
    name: 'Ah Seng',
    address: 'Uncle',
    age: 67,
    gender: 'm',
    role: 'Chicken rice stall, 448 Clementi',
    birthday: '3 May',
    traits: ['grumpy'],
    likes: ['old days', 'football', 'food'],
    dislikes: ['tech'],
    plan: daily(['06:00', 'away'], ['07:00', 'k.ahseng'], ['15:00', 'away']),
    stories: [
      'Since 1983 I sell chicken rice here. Last time this whole area was kampung and plantation. Now all flats.',
      'My son wants me to put the stall on the app. Chopee Food, he says. I say, people want, come here and queue lah.',
    ],
    loves: ['kopi'],
    gifts: ['puff'],
    hates: ['bbt'],
    look: { skin: '#d4a57c', hair: 'bald', hairColor: '#bdb6ab', top: '#f4f1ea', bottom: '#3b3a36' },
    ties: { lily: -20, harun: 20, mdmtan: 30, kokwah: 40 },
    intro: ["You want chicken rice? No? Then what you want? …Oh, just say hello. OK lah. Hello. I'm Ah Seng."],
  },
  {
    id: 'harun',
    name: 'Harun',
    address: 'Pak',
    age: 55,
    gender: 'm',
    role: 'Nasi padang stall, 448 Clementi',
    birthday: '17 August',
    traits: ['caring', 'cheerful'],
    likes: ['religion', 'family', 'food'],
    dislikes: ['gossip'],
    plan: d =>
      weekday(d) === 5
        ? [
            ['06:00', 'away'],
            ['10:00', 'k.harun'],
            ['12:30', 'away'],
            ['14:00', 'k.harun'],
            ['21:00', 'away'],
          ]
        : [
            ['06:00', 'away'],
            ['10:00', 'k.harun'],
            ['21:00', 'away'],
          ],
    stories: [
      "Saya dari Bukittinggi, datang sini tahun 1995. Thirty years, but the rendang recipe is still my mother's.",
      'My birthday same day as Indonesia! Seventeen August. Every year at the embassy I sing the anthem loudest.',
    ],
    loves: ['keripik', 'indomie'],
    gifts: ['kueh'],
    look: { skin: '#9c6644', hair: 'peci', top: '#e8e4da', bottom: '#3b3a36' },
    ties: { ahseng: 20, lily: 30, rosnah: 40 },
    intro: ['Eh, orang Indonesia ya? Dari mana? Saya Pak Harun, dari Padang. Makan di sini, rasa kampung sendiri!'],
  },
  {
    id: 'lily',
    name: 'Lily',
    address: 'Aunty',
    age: 60,
    gender: 'f',
    role: 'Kopi stall, 448 Clementi',
    birthday: '9 February',
    traits: ['gossip', 'cheerful'],
    likes: ['gossip', 'family', 'old days'],
    dislikes: ['tech'],
    plan: daily(['06:00', 'away'], ['06:30', 'k.lily'], ['20:00', 'away']),
    stories: [
      'You want to learn kopi? Kopi O is black with sugar, kopi C with evaporated milk, kopi kosong no sugar. Siew dai less sweet. Test tomorrow.',
      'Ah Seng and me, forty years neighbours. Forty years he complains my kopi too sweet. Forty years he drinks it.',
    ],
    loves: ['tarts'],
    gifts: ['kueh'],
    look: { skin: '#dcb08a', hair: 'short', hairColor: '#a39c92', top: '#c9493a', bottom: '#2c3e50' },
    ties: { ahseng: -20, auntymei: 50, mdmtan: 30, harun: 30 },
  },
  {
    id: 'mdmtan',
    name: 'Tan',
    address: 'Mdm',
    age: 70,
    gender: 'f',
    role: 'Cleaner, 448 Clementi',
    birthday: '28 August',
    traits: ['shy', 'caring'],
    likes: ['old days', 'family'],
    dislikes: ['shopping'],
    plan: daily(['06:00', 'away'], ['07:00', 'k.tray'], ['15:00', 'away']),
    stories: [
      'My grandson study at NUS. Computer science, like you. He says one day he will work at Chopee.',
      'Every tray you return, I have one less to carry. Thank you ah.',
    ],
    loves: ['kueh'],
    gifts: ['puff'],
    look: { skin: '#dcb08a', hair: 'short', hairColor: '#d6d0c6', top: '#3a9a73', bottom: '#3b3a36' },
    ties: { ahseng: 30, lily: 30 },
  },
  {
    id: 'auntymei',
    name: 'Mei',
    address: 'Aunty',
    age: 58,
    gender: 'f',
    role: 'Landlord at Blk 420 (the flat owner)',
    birthday: '11 November',
    traits: ['caring', 'gossip'],
    likes: ['family', 'food', 'property'],
    dislikes: ['music'],
    plan: daily(['06:00', 'away'], ['08:00', 'b.letterbox'], ['09:30', 'away'], ['17:00', 'b.sofa'], ['23:00', 'away']),
    stories: [
      'My son is in Melbourne, studying then working. So quiet the flat now. Good you are here.',
      'Every Chinese New Year I make pineapple tarts. Two hundred! You will help me this year.',
    ],
    loves: ['tarts', 'flowers'],
    gifts: ['kueh'],
    look: { skin: '#dcb08a', hair: 'short', hairColor: '#2e241e', top: '#8e44ad', bottom: '#2c3e50' },
    ties: { kokwah: 60, jasmine: 40, rosnah: 50, lily: 50, ravi: 20 },
    intro: ["Aiyo, Aldi! Call me Aunty Mei. Anything in the flat broken, tell me. Just don't cook durian."],
  },
  {
    id: 'kokwah',
    name: 'Kok Wah',
    address: 'Uncle',
    age: 62,
    gender: 'm',
    role: "Aunty Mei's husband, retired",
    birthday: '6 June',
    traits: ['cheerful'],
    likes: ['old days', 'football'],
    dislikes: ['work'],
    plan: daily(['06:00', 'away'], ['07:00', 'b.chess'], ['11:00', 'away'], ['16:00', 'b.chess'], ['20:00', 'away']),
    stories: [
      'I drove taxi thirty years. Every road in Singapore I know. Ask me, where you want to go, I tell you the shortcut.',
      'Chinese chess, you play or not? No? Sit down, I teach. Very easy. Very hard.',
    ],
    loves: ['kopi'],
    gifts: ['puff'],
    look: { skin: '#d4a57c', hair: 'short', hairColor: '#bdb6ab', top: '#f4f1ea', bottom: '#6b5a45' },
    ties: { auntymei: 60, ahseng: 40, rosnah: 20, ravi: 30 },
  },
  {
    id: 'jasmine',
    name: 'Jasmine',
    address: '',
    age: 20,
    gender: 'f',
    role: "Aunty Mei's daughter, at NUS",
    birthday: '22 April',
    traits: ['curious', 'artsy'],
    likes: ['music', 'shopping', 'tech'],
    dislikes: ['property'],
    plan: d =>
      weekdays(d)
        ? [
            ['06:00', 'away'],
            ['07:45', 'b.busstop'],
            ['08:30', 'away'],
            ['19:00', 'b.living'],
            ['23:00', 'away'],
          ]
        : [
            ['06:00', 'away'],
            ['11:00', 'b.living'],
            ['23:00', 'away'],
          ],
    stories: [
      'I study computing at NUS. Can you get me an internship at Chopee? Just asking. Just asking ah.',
      'My brother left for Australia, so now my mum fusses over you instead. Welcome to the family, sorry.',
    ],
    loves: ['bbt'],
    gifts: ['puff'],
    hates: ['kopi'],
    look: { skin: '#e8c4a0', hair: 'long', top: '#f2c14e', bottom: '#2f5d8a' },
    ties: { auntymei: 40, kokwah: 50 },
  },
  {
    id: 'ravi',
    name: 'Ravi',
    address: 'Mr',
    age: 45,
    gender: 'm',
    role: 'Neighbour, #07-14',
    birthday: '10 January',
    traits: ['sporty', 'cheerful'],
    likes: ['football', 'family', 'work'],
    dislikes: ['gossip'],
    plan: d =>
      weekdays(d)
        ? [
            ['06:00', 'away'],
            ['19:00', 'b.corridor'],
            ['21:30', 'away'],
          ]
        : [
            ['06:00', 'away'],
            ['09:00', 'b.corridor'],
            ['11:00', 'away'],
          ],
    stories: [
      'Deepavali this year, you come to my flat. My wife cooks for fifty people even when ten come.',
      "I coach my son's cricket team on Sundays. Singapore got cricket, you know! Small, but got.",
    ],
    loves: ['puff'],
    gifts: ['kopi'],
    look: { skin: '#6a4028', hair: 'short', top: '#e07a1f', bottom: '#3b3a36' },
    ties: { kokwah: 30, auntymei: 20 },
  },
  {
    id: 'rosnah',
    name: 'Rosnah',
    address: 'Mak Cik',
    age: 64,
    gender: 'f',
    role: 'Neighbour, the void deck regular',
    birthday: '19 May',
    traits: ['caring'],
    likes: ['religion', 'food', 'family'],
    dislikes: ['music'],
    plan: daily(['06:00', 'away'], ['08:00', 'b.table'], ['11:30', 'away'], ['17:00', 'b.table'], ['19:00', 'away']),
    stories: [
      'The mosque near here, Masjid Darussalam, you go for Friday prayers? I tell my son to bring you.',
      'Forty years in this block. I know everyone. Everyone knows me. Nobody can hide anything here!',
    ],
    loves: ['kueh'],
    gifts: ['tarts'],
    look: { skin: '#b67d55', hair: 'hijab', headwear: '#6b3f5a', top: '#6b3f5a', bottom: '#4a3f6b' },
    ties: { auntymei: 50, harun: 40, kokwah: 20 },
  },
  {
    id: 'rahman',
    name: 'Rahman',
    address: 'Encik',
    age: 50,
    gender: 'm',
    role: 'Satay man, Lau Pa Sat',
    birthday: '1 September',
    traits: ['cheerful'],
    likes: ['football', 'food', 'music'],
    dislikes: ['property'],
    plan: daily(['06:00', 'away'], ['16:30', 'lps.satay'], ['23:30', 'away']),
    stories: [
      'Satay Street, every night they close the road for us. Smoke, fire, everybody happy. Best job in the world.',
      'My father was a satay man at the old Satay Club at Esplanade. The recipe came with me.',
    ],
    loves: ['keripik'],
    gifts: ['kopi'],
    look: { skin: '#9c6644', hair: 'cap', headwear: '#b8342a', top: '#f4f1ea', bottom: '#2c3e50' },
    ties: { junhao: 30, harun: 30 },
  },
  {
    id: 'marcus',
    name: 'Marcus',
    address: '',
    age: 34,
    gender: 'm',
    role: 'Runs The Tongkang café, Boat Quay',
    birthday: '13 August',
    traits: ['cheerful', 'gossip'],
    likes: ['music', 'travel', 'gossip'],
    dislikes: ['work'],
    plan: daily(['06:00', 'away'], ['11:00', 'bq.marcus'], ['23:30', 'away']),
    stories: [
      'Before the café I was in a bank, forty floors up. Now I see the river every day. Pay is less, life is more.',
      "The bumboats used to carry cargo up this river. Now they carry tourists. The river doesn't mind.",
    ],
    loves: ['tarts'],
    gifts: ['bbt'],
    look: { skin: '#dcb08a', hair: 'short', top: '#1d2b36', bottom: '#6b5a45' },
    ties: { junhao: 45, daniel: 30 },
  },
  {
    id: 'junhao',
    name: 'Jun Hao',
    address: '',
    age: 28,
    gender: 'm',
    role: 'A Singaporean friend who knows every good stall',
    birthday: '30 May',
    traits: ['cheerful', 'curious'],
    likes: ['food', 'football', 'tech', 'travel'],
    dislikes: ['religion'],
    plan: d => {
      const w = weekday(d);
      if (w === 5 || w === 6)
        return [
          ['06:00', 'away'],
          ['20:00', 'bq.table'],
          ['23:30', 'away'],
        ];
      if (w === 0)
        return [
          ['06:00', 'away'],
          ['11:00', 'lps.table'],
          ['14:00', 'away'],
        ];
      return [
        ['06:00', 'away'],
        ['19:00', 'lps.table'],
        ['21:30', 'away'],
      ];
    },
    stories: [
      "You haven't tried Tiong Bahru chwee kueh? Cannot like that. This weekend I bring you.",
      'I did NS as a cook. Two years cooking for three hundred soldiers. Now I can only cook for three hundred.',
    ],
    loves: ['bbt', 'indomie'],
    gifts: ['puff'],
    look: { skin: '#e8c4a0', hair: 'cap', headwear: '#222326', top: '#3a9a73', bottom: '#1f2a36' },
    ties: { marcus: 45, rahman: 30 },
    intro: ["Eh bro, you look lost. First time Singapore? Come, I'm Jun Hao, I show you what to eat. Priorities."],
  },
  {
    id: 'farah',
    name: 'Farah',
    address: '',
    age: 26,
    gender: 'f',
    role: 'Front desk, one-north Residences',
    birthday: '3 March',
    traits: ['cheerful'],
    likes: ['travel', 'shopping'],
    dislikes: ['football'],
    plan: daily(['06:00', 'away'], ['08:00', 'on.desk'], ['18:00', 'away']),
    stories: [
      'Every week new people check in: engineers, bankers, students. You are one of the nice ones, I can tell.',
      'I want to go Bandung one day. The cafés, the hills. You been?',
    ],
    loves: ['flowers'],
    gifts: ['bbt'],
    look: { skin: '#c58b62', hair: 'long', top: '#1d2b36', bottom: '#1d2b36' },
    ties: {},
  },
  {
    id: 'hamid',
    name: 'Hamid',
    address: 'Ustaz',
    age: 58,
    gender: 'm',
    role: 'Imam, Masjid Sultan',
    birthday: '15 Rabiulawal',
    traits: ['caring', 'bookish'],
    likes: ['religion', 'old days', 'family'],
    dislikes: ['gossip'],
    plan: daily(
      ['06:00', 'away'],
      ['12:45', 'm.imam'],
      ['14:30', 'away'],
      ['16:15', 'm.imam'],
      ['17:00', 'away'],
      ['19:00', 'm.imam'],
      ['21:00', 'away'],
    ),
    stories: [
      'This mosque was built by the Sultan in 1824, rebuilt a hundred years later. The glass bottles under the dome, poor people donated them, one each.',
      'Many workers from Indonesia and Bangladesh pray here on Fridays. Far from home, but here, brothers.',
    ],
    loves: ['kueh'],
    gifts: ['garland', 'tea'],
    look: { skin: '#9c6644', hair: 'peci', headwear: '#f4f1ea', top: '#f4f1ea', longSleeves: true, bottom: '#f4f1ea' },
    ties: { bayu: 30, harun: 40 },
    intro: ['Assalamualaikum. Welcome, welcome. You are new? From Indonesia? Masha Allah. I am Ustaz Hamid.'],
  },
  {
    id: 'dewi',
    name: 'Dewi',
    address: 'Mbak',
    age: 34,
    gender: 'f',
    role: 'On her Sunday off, at Lucky Place',
    birthday: '21 April',
    traits: ['cheerful', 'caring'],
    likes: ['family', 'food', 'music'],
    dislikes: ['property'],
    plan: d =>
      weekday(d) === 0
        ? [
            ['06:00', 'away'],
            ['11:00', 'l.bench1'],
            ['18:00', 'away'],
          ]
        : [['06:00', 'away']],
    stories: [
      'Aku dari Ponorogo, kerja di sini jaga anak dan nenek. Twelve years already. My own daughter is in SMA now; I see her on video call.',
      'Sunday is our day. Lucky Place, bakso, then the whole gang sits on Orchard and gossips until night. Come join!',
    ],
    loves: ['keripik', 'indomie'],
    gifts: ['kueh', 'batik'],
    look: { skin: '#b67d55', hair: 'hijab', headwear: '#e8c9bd', top: '#e8c9bd', bottom: '#2f5d8a' },
    ties: { bayu: 50, ana: 60 },
    intro: ['Eh, orang Indonesia ya? Dari mana? Bekasi! Aku Dewi, dari Ponorogo. Minggu depan ke sini lagi ya!'],
  },
  {
    id: 'bayu',
    name: 'Bayu',
    address: 'Mas',
    age: 30,
    gender: 'm',
    role: 'Engineer at a bank, from Surabaya',
    birthday: '10 November',
    traits: ['sporty', 'curious'],
    likes: ['football', 'tech', 'food'],
    dislikes: ['weather'],
    plan: d => {
      const w = weekday(d);
      if (w === 0)
        return [
          ['06:00', 'away'],
          ['12:00', 'l.bench2'],
          ['17:00', 'away'],
        ];
      if (w === 5)
        return [
          ['06:00', 'away'],
          ['12:45', 'm.jumaat'],
          ['13:55', 'away'],
        ];
      return [['06:00', 'away']];
    },
    stories: [
      'Five years in Singapore. First year I only ate at Lucky Place. Now I can order kopi siew dai like a local.',
      'We have a futsal team, the Indonesian engineers. Persija fans and Persebaya fans in one team, can you imagine.',
    ],
    loves: ['indomie'],
    gifts: ['kopi', 'puff'],
    look: { skin: '#b67d55', hair: 'short', top: '#d7263d', bottom: '#1f2a36' },
    ties: { dewi: 50, hamid: 30, junhao: 20 },
    intro: ['Wah, anak baru! Aku Bayu, dari Surabaya, kerja di bank. Kalau butuh apa-apa, WA aja ya.'],
  },
  {
    id: 'ana',
    name: 'Ana',
    address: 'Kak',
    age: 45,
    gender: 'f',
    role: 'Runs Toko Indonesia, Lucky Place',
    birthday: '2 March',
    traits: ['gossip', 'cheerful'],
    likes: ['gossip', 'food', 'family'],
    dislikes: ['tech'],
    plan: daily(['06:00', 'away'], ['10:00', 'l.toko'], ['21:00', 'away']),
    stories: [
      "Twenty years this shop. Indomie, kerupuk, kecap, everything the kids miss from home. I am everybody's kakak here.",
      'Before Lebaran, the queue goes out the door. Everyone sending parcels home.',
    ],
    loves: ['kueh'],
    gifts: ['flowers'],
    look: { skin: '#b67d55', hair: 'hijab', headwear: '#b8342a', top: '#f2c14e', bottom: '#6b3f5a' },
    ties: { dewi: 60, harun: 20 },
  },
  {
    id: 'lakshmi',
    name: 'Lakshmi',
    address: 'Mdm',
    age: 52,
    gender: 'f',
    role: 'Garland stall, Tekka Centre',
    birthday: '14 January',
    traits: ['caring'],
    likes: ['religion', 'family', 'music'],
    dislikes: ['property'],
    plan: daily(['06:00', 'away'], ['07:00', 't.garland'], ['19:00', 'away']),
    stories: [
      'Jasmine for the temple, marigold for weddings. Every morning at four I start threading. My mother did the same.',
      'Deepavali, the whole Serangoon Road lights up. You come, I give you a garland free.',
    ],
    loves: ['tea'],
    gifts: ['kueh'],
    look: { skin: '#6a4028', hair: 'bun', top: '#e07a1f', longSleeves: true, bottom: '#8a3b2e', skirt: true },
    ties: { ravi: 30 },
  },
  {
    id: 'lim',
    name: 'Lim',
    address: 'Uncle',
    age: 71,
    gender: 'm',
    role: 'Tea shop, Chinatown',
    birthday: '8 August',
    traits: ['bookish', 'grumpy'],
    likes: ['old days', 'music', 'food'],
    dislikes: ['shopping'],
    plan: daily(['06:00', 'away'], ['09:00', 'c.tea'], ['19:00', 'away']),
    stories: [
      'This street was full of trishaws when I was a boy. Now full of tourists. Tourists pay better, at least.',
      'Good tea you must wait. Young people now, everything also cannot wait.',
    ],
    loves: ['mooncake'],
    gifts: ['tarts'],
    hates: ['bbt'],
    look: { skin: '#dcb08a', hair: 'bald', hairColor: '#d6d0c6', top: '#e8e4da', bottom: '#3b3a36' },
    ties: { ahseng: 30 },
  },
  {
    id: 'ibrahim',
    name: 'Ibrahim',
    address: 'Encik',
    age: 40,
    gender: 'm',
    role: 'Batik shop, Haji Lane',
    birthday: '27 June',
    traits: ['cheerful', 'ambitious'],
    likes: ['shopping', 'travel', 'music'],
    dislikes: ['weather'],
    plan: daily(['06:00', 'away'], ['11:00', 'h.batik'], ['21:00', 'away']),
    stories: [
      'My grandfather sold textiles on Arab Street. I sell batik on Haji Lane. My son wants to sell on Chopee. Progress!',
      'Every month I go Pekalongan and Solo to buy. Your country makes the best batik, I tell everyone.',
    ],
    loves: ['tea'],
    gifts: ['keripik'],
    look: { skin: '#b67d55', hair: 'short', top: '#8e44ad', bottom: '#2c3e50' },
    ties: { hamid: 20 },
  },
  {
    id: 'sarah',
    name: 'Sarah',
    address: '',
    age: 25,
    gender: 'f',
    role: 'Barista, Tiong Bahru Bakehouse',
    birthday: '19 December',
    traits: ['artsy', 'shy'],
    likes: ['music', 'travel', 'food'],
    dislikes: ['work'],
    plan: daily(['06:00', 'away'], ['07:30', 'tb.bakery'], ['16:00', 'away']),
    stories: [
      'I studied art. Now I draw on lattes. Same thing, smaller canvas.',
      'The old people here have lived in these art deco flats since the fifties. The young people pay five dollars for a croissant downstairs. Both are Tiong Bahru.',
    ],
    loves: ['croissant'],
    gifts: ['bbt'],
    look: { skin: '#e8c4a0', hair: 'bun', top: '#2c3e50', bottom: '#6b5a45' },
    ties: { junhao: 20 },
  },
];

/* ---------- build and update ---------- */

export function buildPeople() {
  buildSpots();
  DEFS.forEach((d, i) => {
    const r = rng(hash('npc', d.id));
    const appearance = generateAppearance(
      { age: d.age, gender: d.gender, set: d.look, hijab: 0, skins: SG_SKINS },
      r.next,
    );
    const npc: NPC = {
      id: d.id,
      name: d.name,
      address: d.address,
      age: d.age,
      gender: d.gender,
      occupation: d.role,
      birthday: d.birthday,
      household: d.id,
      home: 'away',
      traits: d.traits,
      likes: d.likes,
      dislikes: d.dislikes,
      schedule: [],
      relationships: { ...(d.ties ?? {}) },
      playerRelationship: { friendship: 0, stage: 'stranger', lastTalkedDay: -1, memories: [] },
      mood: 60,
      appearance,
    };
    if (d.intro) PERSONAL[d.id] = { intro: d.intro };
    const p: Person = {
      npc,
      role: d.role,
      plan: d.plan,
      stories: d.stories,
      loves: d.loves,
      likes: d.gifts,
      dislikes: d.hates,
      slot: i,
      at: null,
      shown: false,
      circle: { x: 1e6, z: 1e6, r: 0.3 },
      pose: { x: 0, z: 0, ry: 0, seatY: 0, pose: 'stand', walk: 0, phase: 0, headYaw: 0, gesture: 0, reach: 0, t: 0 },
    };
    crowd.setAppearance(i, appearance);
    crowd.hide(i);
    circles.push(p.circle);
    people.push(p);
    register({
      get x() {
        return p.at?.x ?? 1e6;
      },
      get y() {
        return (p.at?.sit ?? p.at?.y ?? 0) + (p.at?.sit ? 0.9 : 1.5);
      },
      get z() {
        return p.at?.z ?? 1e6;
      },
      reach: 3,
      size: 0.5,
      label: () => (p.at && p.shown ? `Talk to ${social(npc).met ? properName(npc) : `the ${shortRole(p)}`}` : null),
      run: () => talk(p),
    });
  });
}
const shortRole = (p: Person) => p.role.split(',')[0].split('(')[0].trim().toLowerCase();

function spotNow(p: Person): Spot | null {
  const plan = p.plan(S.day);
  const t = S.time;
  let key = 'away';
  for (const [from, k] of plan) {
    const [h, m] = from.split(':').map(Number);
    if (t >= h * 60 + m) key = k;
  }
  return key === 'away' ? null : (spots[key] ?? null);
}

let talking: Person | null = null;
let lastDay = -1;
/** Every frame: who is where; pose the ones near Aldi. */
export function updatePeople(dt: number) {
  if (S.day !== lastDay) {
    if (lastDay >= 0)
      dailyDecay(
        people.map(p => p.npc),
        S.day,
      );
    lastDay = S.day;
  }
  let dirty = false;
  for (const p of people) {
    p.at = spotNow(p);
    const s = p.at;
    const near = !!s && Math.hypot(s.x - player.x, s.z - player.z) < 70 && Math.abs(s.y - player.y) < 30;
    if (!near) {
      if (p.shown) {
        crowd.hide(p.slot);
        p.shown = false;
        p.circle.x = p.circle.z = 1e6;
        dirty = true;
      }
      continue;
    }
    p.shown = true;
    const st = p.pose;
    st.t += dt;
    st.x = s!.x;
    st.z = s!.z;
    st.pose = s!.sit ? 'sit' : 'stand';
    st.seatY = s!.sit ? s!.sit - s!.y : 0;
    st.ry = s!.ry;
    // Look at Aldi when close; gesture while talking.
    const dx = player.x - s!.x,
      dz = player.z - s!.z,
      d = Math.hypot(dx, dz);
    let hy = 0;
    if (d < 5 && Math.abs(player.y - s!.y) < 2) {
      hy = Math.atan2(dx, dz) - s!.ry;
      while (hy > Math.PI) hy -= Math.PI * 2;
      while (hy < -Math.PI) hy += Math.PI * 2;
      hy = Math.max(-1.1, Math.min(1.1, hy));
    }
    st.headYaw += (hy - st.headYaw) * Math.min(1, dt * 4);
    st.gesture = talking === p ? 0.5 + 0.5 * Math.sin(st.t * 3) : 0;
    st.baseY = s!.y;
    crowd.pose(p.slot, st);
    p.circle.x = s!.sit ? 1e6 : s!.x;
    p.circle.z = s!.sit ? 1e6 : s!.z;
    dirty = true;
  }
  void dirty;
}
/* ---------- talking ---------- */

async function line(
  p: Person,
  kind: LineKind,
  extra: { outcome?: string; topic?: Topic; item?: string; detail?: string; other?: NPC } = {},
) {
  const r = await provider.getLine({
    kind,
    npc: p.npc,
    stage: p.npc.playerRelationship.stage,
    time: S.time,
    day: S.day,
    location: p.at?.where ?? '',
    ...extra,
  });
  return r.text;
}

function applied(p: Person, delta: number, uncapped = false) {
  const c = befriend(p.npc, delta, S.day, uncapped);
  if (c.after !== c.before && stageRank(c.after) > stageRank(c.before))
    toast(`${properName(p.npc)}: ${c.after}`, "You're getting closer.", 'good');
  S.time = Math.min(S.time + 2, 26 * 60 - 1);
  return c.delta;
}
const hint = (d: number) => (d > 0 ? ` (+${d})` : d < 0 ? ` (${d})` : '');

async function talk(p: Person) {
  const npc = p.npc;
  talking = p;
  let text: string;
  if (!social(npc).met) {
    meet(npc, S.day);
    applied(p, 2);
    text = await line(p, 'intro');
  } else {
    const g = greetingKind(npc, S.day, false);
    const outcome =
      g.kind === 'greet.again'
        ? undefined
        : 'outcome' in g &&
            (g.outcome === 'cold' || g.outcome === 'friend' || g.outcome === 'acquaintance' || g.outcome === 'stranger')
          ? g.outcome
          : stageRank(npc.playerRelationship.stage) >= 2
            ? 'friend'
            : stageRank(npc.playerRelationship.stage) === 1
              ? 'acquaintance'
              : 'stranger';
    text = await line(p, g.kind === 'greet.again' ? 'greet.again' : 'greet', { outcome });
  }
  menu(p, text);
}

function menu(p: Person, said: string) {
  const npc = p.npc;
  const items = Object.keys(bag);
  const rows: Row[] = [
    { label: 'Chat about…', run: () => topics(p, said) },
    {
      label: 'Ask about them',
      run: async () => {
        const r = ask(npc, S.day, p.stories);
        const d = applied(p, r.delta);
        menu(
          p,
          (await line(p, r.kind, {
            topic: 'topic' in r ? r.topic : undefined,
            detail: 'detail' in r ? r.detail : undefined,
          })) + hint(d),
        );
      },
    },
    {
      label: 'Compliment them',
      run: async () => {
        const r = compliment(npc, S.day);
        const d = applied(p, r.delta);
        menu(p, (await line(p, 'compliment', { outcome: r.outcome })) + hint(d));
      },
    },
    {
      label: 'Crack a joke',
      run: async () => {
        const r = joke(npc, S.day, 1);
        const d = applied(p, r.delta);
        menu(p, (await line(p, 'joke', { outcome: r.outcome })) + hint(d));
      },
    },
  ];
  if (items.length) rows.push({ label: 'Give a gift…', note: `${items.length} in the bag`, run: () => gifts(p, said) });
  const known = people.filter(o => o !== p && social(o.npc).met && npc.relationships[o.npc.id] !== undefined);
  if (known.length)
    rows.push({
      label: 'Ask what they think of someone',
      run: async () => {
        const r = gossip(npc, S.day, id => people.some(o => o.npc.id === id));
        const other = people.find(o => o.npc.id === r.other)?.npc;
        const d = applied(p, r.delta);
        menu(p, (await line(p, 'gossip', { outcome: r.outcome, other })) + hint(d));
      },
    });
  rows.push({
    label: 'Bye',
    run: async () => {
      const t = await line(p, 'bye', { outcome: byeKind(npc) });
      closePanel();
      talking = null;
      toast(properName(npc), t, null);
    },
  });
  openPanel({
    title: social(npc).met ? properName(npc) : `The ${shortRole(p)}`,
    sub: `${p.role} · ${npc.playerRelationship.stage}`,
    body: `"${said}"`,
    rows,
    onClose: () => (talking = null),
  });
}

function topics(p: Person, said: string) {
  const k = social(p.npc).known;
  openPanel({
    title: `Chat with ${properName(p.npc)}`,
    sub: 'What about?',
    body: `"${said}"`,
    back: () => menu(p, said),
    rows: TOPICS.map(t => ({
      label: t.charAt(0).toUpperCase() + t.slice(1),
      note: k.likes.includes(t) ? '♥ likes' : k.dislikes.includes(t) ? '✗ dislikes' : undefined,
      run: async () => {
        const r = chat(p.npc, t, S.day);
        const d = applied(p, r.delta);
        menu(p, (await line(p, r.kind, { topic: t })) + hint(d));
      },
    })),
  });
}

function gifts(p: Person, said: string) {
  openPanel({
    title: `A gift for ${properName(p.npc)}`,
    sub: 'From the bag',
    body: `"${said}"`,
    back: () => menu(p, said),
    rows: Object.keys(bag).map(id => ({
      label: ITEM_NAMES[id] ?? id,
      note: `×${bag[id]}`,
      run: async () => {
        const reaction = p.loves.includes(id)
          ? 'loved'
          : p.likes.includes(id)
            ? 'liked'
            : p.dislikes?.includes(id)
              ? 'disliked'
              : 'neutral';
        const r = gift(p.npc, S.day, ITEM_NAMES[id] ?? id, reaction, false, 0);
        if (r.outcome !== 'again') takeItem(id);
        if (reaction === 'loved' && r.outcome !== 'again') social(p.npc).known.gifts[id] = 'loved';
        const d = applied(p, r.delta, true);
        menu(p, (await line(p, 'gift', { outcome: r.outcome, item: (ITEM_NAMES[id] ?? id).toLowerCase() })) + hint(d));
      },
    })),
  });
}

/* ---------- Contacts (the phone) ---------- */

export function contacts() {
  const met = people.filter(p => social(p.npc).met);
  openPanel({
    title: 'Contacts',
    sub: `${met.length} people`,
    body: met.length ? undefined : 'Nobody yet. Say hello to people (E).',
    rows: met.map(p => ({
      label: properName(p.npc),
      note: p.npc.playerRelationship.stage,
      run: () => {
        const k = social(p.npc).known;
        const loved = Object.keys(k.gifts).map(g => ITEM_NAMES[g] ?? g);
        openPanel({
          title: properName(p.npc),
          sub: `${p.role} · ${p.npc.playerRelationship.stage}`,
          body: [
            `Friendship ${Math.max(0, Math.round(p.npc.playerRelationship.friendship))}/100.`,
            k.likes.length ? `Likes: ${k.likes.join(', ')}.` : '',
            k.dislikes.length ? `Doesn't like: ${k.dislikes.join(', ')}.` : '',
            k.birthday ? `Birthday: ${p.npc.birthday}.` : '',
            loved.length ? `Loved: ${loved.join(', ')}.` : '',
            p.at ? `Now: ${p.at.where}.` : '',
          ]
            .filter(Boolean)
            .join(' '),
          back: contacts,
          rows: [{ label: 'Back', run: contacts }],
        });
      },
    })),
  });
}

/** Birthdays today, for the morning toast. */
export function birthdaysToday() {
  const { d, month } = dateOf(S.day);
  return people.filter(p => p.npc.birthday === `${d} ${month}` && social(p.npc).met);
}

export const savePeople = () => saveSocial(people.map(p => p.npc));
export function loadPeople(d: ReturnType<typeof saveSocial> | undefined) {
  for (const p of people) {
    p.npc.playerRelationship = { friendship: 0, stage: 'stranger', lastTalkedDay: -1, memories: [] };
    p.npc.mood = 60;
  }
  loadSocial(
    d ?? { socials: [], mended: [], npcs: [] },
    people.map(p => p.npc),
  );
  lastDay = -1;
}
