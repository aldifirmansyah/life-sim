/* Restoring Mbah Minah's house (spec §3.1, §7), room by room. Each room costs
   money and a morning of Pak Karyo's work; he comes round the next morning and
   works on the teras. Finished rooms unlock something (a better kitchen, a
   proper bed, a desk) and some show from outside. Every room turns up a piece
   of Mbah Minah's life. */
import { S } from '../core/state';
import { residents, setPlan, type Resident } from '../npc/npcs';
import { PropSet } from '../render/props';
import { rakaHouse } from '../world/landmarks';
import * as st from './stats';
import { emit } from './bus';
import { social, befriend } from '../social/social';
import { repute } from '../social/reputation';
import { addMinah } from '../social/minah';
import { sendText } from '../social/phone';
import { toast } from '../ui/hud';

export interface Room {
  id: string;
  name: string;
  cost: number;
  /** What it gives, for the menu. */
  unlock: string;
  /** What Raka finds while it's being fixed. */
  find: { title: string; text: string };
}
export const ROOMS: Room[] = [
  {
    id: 'teras',
    name: 'Teras and pagar',
    cost: 200000,
    unlock: 'Fresh paint, pots of flowers and a lamp. Neighbours stop by more.',
    find: {
      title: 'The guest book',
      text: 'Under the loose teras tile: a school exercise book where she wrote down every visitor for twenty years. Nearly every name in RT 04 is in it, some of them hundreds of times.',
    },
  },
  {
    id: 'dapur',
    name: 'Dapur (kitchen)',
    cost: 350000,
    unlock: 'A new stove: one more portion and better quality when you cook.',
    find: {
      title: 'Her recipe tin',
      text: 'A biscuit tin of recipe cards in her handwriting. Next to most of them, a name: "for Pak Darto’s cough", "for Sri’s wedding", "for the kerja bakti". She cooked for everyone.',
    },
  },
  {
    id: 'kamar',
    name: 'Kamar tidur',
    cost: 300000,
    unlock: 'A proper mattress: sleep restores a quarter more energy.',
    find: {
      title: 'Letters from the city',
      text: 'A bundle of letters from your mother, tied with raffia. In the margins Mbah wrote notes to herself: "Raka is ten now. Does he still remember the kali?"',
    },
  },
  {
    id: 'meja',
    name: 'Meja kerja (a desk)',
    cost: 250000,
    unlock: 'A real desk by the window: freelance work pays 25% more.',
    find: {
      title: 'The RT ledger',
      text: 'In the old desk drawer: the RT’s kas ledger from the eighties. Mbah Minah was the treasurer for eleven years. Every rupiah accounted for, in pencil.',
    },
  },
  {
    id: 'ruangtamu',
    name: 'Ruang tamu (front room)',
    cost: 450000,
    unlock: 'Curtains and chairs for guests: teh at yours is worth more to them.',
    find: {
      title: 'The 17 Agustus photo',
      text: 'Behind the cabinet, a framed photo: 17 Agustus 1985, the whole gang in front of a panjat pinang pole. A young woman laughing in the middle, holding the flag. Mbah Minah.',
    },
  },
  {
    id: 'atap',
    name: 'Atap (the roof)',
    cost: 500000,
    unlock: 'New tiles, no more leaks. The house looks alive again from the gang.',
    find: {
      title: 'A tin of coins',
      text: 'Up in the roof space, a rusty tin labelled "untuk anak-anak kampung": coins saved for the children’s lomba prizes. There is still Rp 87.500 in it.',
    },
  },
];

export const restored = new Set<string>();
export const hasRoom = (id: string) => restored.has(id);
/** The job booked with Pak Karyo, if any. */
export let job: { room: string; day: number; seen: boolean; helped: boolean } | null = null;

const START = 9 * 60,
  END = 13 * 60;
const karyo = () => residents.find(r => r.npc.id === 'karyo')!;
export const canBook = () => {
  const k = karyo();
  if (!social(k.npc).met || k.npc.playerRelationship.friendship < 10) return 'get to know Pak Karyo, the tukang, first';
  if (job) return 'Pak Karyo is already booked';
  return null;
};

/** Pay for a room and book Pak Karyo for the next morning he can come. */
export function book(room: Room) {
  if (canBook() || !st.canAfford(room.cost)) return false;
  st.spend(room.cost);
  const day = S.time < 8 * 60 ? S.day : S.day + 1;
  job = { room: room.id, day, seen: false, helped: false };
  setPlan(karyo(), day, { start: START, end: END, location: 'raka.work', activity: 'work' });
  sendText('karyo', 'restore_booked', {
    item: room.name.toLowerCase(),
    detail: day === S.day ? 'this morning' : 'tomorrow morning',
  });
  return true;
}

/* ================= what you can see ================= */

const sets: Record<string, PropSet> = {};
export function buildHouseProps() {
  const h = rakaHouse;
  const put = (
    set: PropSet,
    lx: number,
    y: number,
    lz: number,
    sx: number,
    sy: number,
    sz: number,
    c: string,
    b = set.solid,
  ) => {
    const [x, z] = h.F(lx, lz);
    set.put(x, y, z, sx, sy, sz, c, h.th, b);
  };
  // Teras: flower pots along the front edge, a doormat, a lamp by the door.
  const teras = (sets.teras = new PropSet('rumah-teras'));
  [-h.w / 2 + 0.4, -h.w / 2 + 1.0, h.w / 2 - 0.4].forEach((lx, k) => {
    const [x, z] = h.F(lx, h.fz + h.sb - 0.25);
    teras.post(x, z, 0.12, 0.45, 0.16, '#b5562f');
    teras.put(x, 0.62, z, 0.26, 0.3, 0.26, ['#e8392a', '#f2b53c', '#e86aa0'][k], 0, teras.cone);
    teras.put(x, 0.5, z, 0.3, 0.14, 0.3, '#4f8a3a', 0, teras.cone);
  });
  put(teras, h.dx, 0.13, h.fz + 0.55, 0.9, 0.02, 0.55, '#8a5a3a');
  put(teras, h.dx + 0.75, 2.35, h.fz + 0.12, 0.12, 0.25, 0.12, '#2a2a2a');
  const [lx, lz] = h.F(h.dx + 0.75, h.fz + 0.14);
  teras.light(lx, 2.18, lz, 0.1, '#ffe2a0');
  // The front room's curtains hang inside now (interiors/raka.ts).
  // Roof: new terracotta tiles over the old.
  const atap = (sets.atap = new PropSet('rumah-atap'));
  put(atap, 0, 3.22, 0, h.w + 0.8, Math.min(1.7, h.d * 0.22) + 0.03, h.d + 1.0, '#c9582f', atap.roof);
  for (const s of Object.values(sets)) s.build();
}
const listeners: (() => void)[] = [];
/** Called whenever a room is restored (or a save is loaded): the inside of the house follows. */
export const onHouseChange = (fn: () => void) => listeners.push(fn);
function refresh() {
  for (const [id, s] of Object.entries(sets)) s.show(restored.has(id));
  for (const fn of listeners) fn();
}

/* ================= the job ================= */

let acc = 0;
/** Once a second: is Pak Karyo at work, is Raka helping, is it done? */
export function updateHouse(dt: number) {
  acc += dt;
  if (acc < 1) return;
  acc = 0;
  if (!job || S.day < job.day) return;
  const k = karyo();
  const working = k.state === 'at' && k.slot.poi.id === 'raka' && k.slot.tag === 'work';
  if (S.day === job.day && S.time >= START && S.time < END) {
    if (working) job.seen = true;
    if (working && k.dist < 10) job.helped = true;
    return;
  }
  if (S.day === job.day && S.time < START) return;
  // The morning is over (or he never came: try again tomorrow).
  if (!job.seen) {
    job.day = S.day + (S.time >= START ? 1 : 0);
    setPlan(k, job.day, { start: START, end: END, location: 'raka.work', activity: 'work' });
    return;
  }
  finish(k);
}

function finish(k: Resident) {
  const room = ROOMS.find(r => r.id === job!.room)!;
  const helped = job!.helped;
  job = null;
  restored.add(room.id);
  refresh();
  if (room.id === 'dapur') st.perks.kitchen = true;
  if (room.id === 'kamar') st.perks.sleep = 1.25;
  if (room.id === 'meja') st.perks.freelance = 1.25;
  if (room.id === 'teras') st.perks.teras = true;
  if (room.id === 'ruangtamu') st.perks.guests = true;
  befriend(k.npc, helped ? 4 : 2, S.day);
  if (helped) st.practise('fitness', 8);
  repute(room.id === 'atap' || room.id === 'teras' ? 3 : 2, 'Mbah Minah’s house is coming back to life.', S.day, true);
  st.addMood(8);
  toast(`${room.name}: done`, `${room.unlock}${helped ? ' You worked alongside Pak Karyo; he liked that.' : ''}`);
  addMinah(
    {
      id: `room-${room.id}`,
      title: room.find.title,
      text: room.find.text,
      from: `Found in the ${room.name.toLowerCase()}`,
    },
    S.day,
  );
  if (room.id === 'atap') st.earn(87500);
  emit('restore', room.id);
}

/** For the Journal. */
export const houseStatus = () =>
  ROOMS.map(r => ({
    ...r,
    state: restored.has(r.id) ? 'done' : job?.room === r.id ? 'booked' : 'todo',
    when: job?.room === r.id ? job.day : undefined,
  }));

/* ================= save ================= */

export const saveHouse = () => ({ restored: [...restored], job });
export function loadHouse(d: ReturnType<typeof saveHouse>) {
  restored.clear();
  for (const r of d.restored) restored.add(r);
  job = d.job;
  refresh();
  // Pak Karyo's booked morning goes back on his schedule.
  if (job && job.day >= S.day)
    setPlan(karyo(), job.day, { start: START, end: END, location: 'raka.work', activity: 'work' });
}
