/* Ambient passers-by (spec §8.1): unnamed people from outside RT 04 who come in
   through the gapura for an errand (the pasar, a coffee, a bowl of bakso, the
   musholla, a walk by the kali) and leave again. They share the residents'
   runtime (paths, slots, LOD, posing) but have no relationships; talking to
   one gets a one-line greeting. Each day they get new faces and new errands. */
import { mulberry32 } from '../core/util';
import { SETTINGS } from '../core/settings';
import type { ResidentDef } from './roster';
import type { Activity, NPC, ScheduleBlock } from './types';
import { generateAppearance } from './appearance';
import { DAY_START, DAY_END } from './schedule';

/** Most passers-by in the kampung at once; how many come depends on the quality setting. */
export const AMBIENT_MAX = 20;
export const ambientCount = () => [6, 12, 20][SETTINGS.quality] ?? 12;

interface Errand {
  /** Earliest and latest arrival, game-minutes. */
  from: number;
  to: number;
  location: string;
  activity: Activity;
  /** How long they stay, minutes. */
  stay: [number, number];
  w: number;
}
const h = (hh: number, mm = 0) => hh * 60 + mm;
const ERRANDS: Errand[] = [
  { from: h(6, 20), to: h(8, 20), location: 'pasar.customer', activity: 'shop', stay: [15, 35], w: 5 },
  { from: h(7), to: h(20), location: 'warung.customer', activity: 'shop', stay: [8, 15], w: 3 },
  { from: h(9), to: h(15), location: 'meja.seat', activity: 'eat', stay: [20, 40], w: 1 },
  { from: h(7), to: h(10), location: 'warkop.seat', activity: 'chat', stay: [30, 50], w: 1 },
  { from: h(19), to: h(22), location: 'warkop.seat', activity: 'chat', stay: [40, 80], w: 2 },
  { from: h(18, 30), to: h(21, 30), location: 'bakso.customer', activity: 'eat', stay: [15, 25], w: 2 },
  { from: h(11, 50), to: h(11, 58), location: 'musholla.inside', activity: 'pray', stay: [20, 30], w: 1 },
  { from: h(17, 50), to: h(17, 58), location: 'musholla.inside', activity: 'pray', stay: [25, 40], w: 2 },
  { from: h(15, 30), to: h(17, 30), location: 'bridge.rail', activity: 'relax', stay: [20, 40], w: 2 },
  { from: h(7), to: h(17), location: 'kali.fish', activity: 'fish', stay: [40, 90], w: 1 },
  { from: h(16), to: h(17, 45), location: 'lapangan.bench', activity: 'relax', stay: [25, 45], w: 2 },
  { from: h(10), to: h(16), location: 'balai.board', activity: 'relax', stay: [5, 10], w: 1 },
];

const OCCUPATIONS = ['Warga RW sebelah', 'Ojek driver', 'Pedagang keliling', 'Mahasiswa', 'Karyawan pabrik', 'Guru SD'];

/** One passer-by's day: away except for one or two errands. Extras beyond today's count stay away all day. */
export function ambientDay(k: number, day: number): ScheduleBlock[] {
  const away = (start: number, end: number): ScheduleBlock => ({ start, end, location: 'away', activity: 'away' });
  if (k >= ambientCount()) return [away(DAY_START, DAY_END)];
  const rnd = mulberry32(day * 977 + k * 131 + 5);
  const pick = () => {
    let r = rnd() * ERRANDS.reduce((a, e) => a + e.w, 0);
    for (const e of ERRANDS) if ((r -= e.w) <= 0) return e;
    return ERRANDS[0];
  };
  const out: ScheduleBlock[] = [];
  let t = DAY_START;
  const trips = rnd() < 0.45 ? 2 : 1;
  const used: Errand[] = [];
  for (let n = 0; n < trips; n++) {
    // A few tries to find an errand that fits after the last one (walking in takes up to ~100 minutes).
    for (let tries = 0; tries < 6; tries++) {
      const e = pick();
      if (used.includes(e)) continue;
      const start = Math.round(e.from + rnd() * (e.to - e.from));
      if (start < t + (out.length ? 200 : 60)) continue;
      const end = start + Math.round(e.stay[0] + rnd() * (e.stay[1] - e.stay[0]));
      if (end > DAY_END - 30) continue;
      out.push(away(t, start), { start, end, location: e.location, activity: e.activity });
      used.push(e);
      t = end;
      break;
    }
  }
  out.push(away(t, DAY_END));
  return out.filter(b => b.end > b.start);
}

/** A passer-by's (placeholder) identity; `refreshAmbient` gives them a face each day. */
export function ambientPerson(k: number): { def: ResidentDef; npc: NPC } {
  const def: ResidentDef = {
    id: `ambient${k}`,
    name: 'Passer-by',
    address: 'Mas',
    age: 30,
    gender: 'm',
    occupation: OCCUPATIONS[k % OCCUPATIONS.length],
    birthday: '',
    household: `ambient${k}`,
    traits: [],
    likes: [],
    dislikes: [],
    schedule: [],
  };
  const npc: NPC = {
    id: def.id,
    name: def.name,
    address: def.address,
    age: def.age,
    gender: def.gender,
    occupation: def.occupation,
    birthday: '',
    household: def.household,
    home: 'away',
    traits: [],
    likes: [],
    dislikes: [],
    schedule: [],
    relationships: {},
    playerRelationship: { friendship: 0, stage: 'stranger', lastTalkedDay: -1, memories: [] },
    mood: 60,
    appearance: generateAppearance({ age: 30, gender: 'm' }, mulberry32(k)),
  };
  return { def, npc };
}

/** New faces and errands for the day. */
export function refreshAmbient(k: number, day: number, def: ResidentDef, npc: NPC) {
  const rnd = mulberry32(day * 7919 + k * 17 + 3);
  const roll = rnd();
  // Mostly adults; a few teenagers and older people.
  const age =
    roll < 0.15 ? 15 + Math.floor(rnd() * 5) : roll < 0.8 ? 20 + Math.floor(rnd() * 30) : 50 + Math.floor(rnd() * 22);
  const gender = rnd() < 0.5 ? 'f' : 'm';
  def.age = npc.age = age;
  def.gender = npc.gender = gender;
  def.address = npc.address =
    age >= 45 ? (gender === 'f' ? 'Bu' : 'Pak') : age < 20 ? 'Dek' : gender === 'f' ? 'Mbak' : 'Mas';
  npc.mood = 45 + Math.floor(rnd() * 40);
  npc.appearance = generateAppearance({ age, gender }, rnd);
  const blocks = ambientDay(k, day);
  npc.schedule = def.schedule = [blocks, blocks, blocks, blocks, blocks, blocks, blocks];
}
