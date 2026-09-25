/* Odd jobs from the notice board at the balai (spec §7 "Odd jobs / favours"):
   a couple each day, new every morning.
   - titip: someone needs something from the warung or pasar; give it to them
   - antar: a parcel left at the board for someone; hand it over (Ask… menu)
   Paid in rupiah, and worth friendship and a little reputation. */
import { S } from '../core/state';
import { mulberry32 } from '../core/util';
import { residents, type Resident } from '../npc/npcs';
import * as st from './stats';
import { item, rupiah } from './items';
import { befriend, properName } from '../social/social';
import { repute } from '../social/reputation';
import { toast } from '../ui/hud';

export interface Job {
  id: number;
  kind: 'titip' | 'antar';
  /** Who it's for. */
  to: string;
  /** Who sent the parcel (antar). */
  from?: string;
  /** What they need (titip). */
  item?: string;
  pay: number;
  day: number;
  taken: boolean;
  done: boolean;
}
export let board: Job[] = [];
let boardDay = -1;
let nextId = 1;

const NEEDS = [
  'telur',
  'beras',
  'bawang',
  'kecap',
  'gorengan',
  'kopi_sachet',
  'teh_manis',
  'koran',
  'sayur',
  'tomat',
  'pisang',
  'kerupuk',
];
const byId = (id: string) => residents.find(r => r.npc.id === id)!;
export const name = (id: string) => properName(byId(id).npc);

/** Today's jobs (made fresh each morning). */
export function todaysJobs() {
  if (boardDay !== S.day) {
    boardDay = S.day;
    // Unfinished jobs from yesterday are gone.
    for (const j of board) if (j.taken && !j.done && j.kind === 'antar') st.take('paket');
    board = [];
    const rnd = mulberry32(S.day * 4099 + 11);
    const adults = residents.filter(r => r.npc.age >= 16);
    const pick = () => adults[Math.floor(rnd() * adults.length)].npc.id;
    const to = pick();
    board.push({
      id: nextId++,
      kind: 'titip',
      to,
      item: NEEDS[Math.floor(rnd() * NEEDS.length)],
      pay: 10000,
      day: S.day,
      taken: false,
      done: false,
    });
    let from = pick(),
      to2 = pick();
    while (to2 === from) to2 = pick();
    board.push({ id: nextId++, kind: 'antar', from, to: to2, pay: 15000, day: S.day, taken: false, done: false });
  }
  return board;
}

export function describeJob(j: Job) {
  return j.kind === 'titip'
    ? `${name(j.to)} needs ${item(j.item!).name.toLowerCase()}. Bring it round.`
    : `A parcel from ${name(j.from!)} for ${name(j.to)}. Deliver it.`;
}

export function take(j: Job) {
  j.taken = true;
  if (j.kind === 'antar') st.add('paket');
  toast('Job taken', `${describeJob(j)} ${rupiah(j.pay)} when it’s done.`);
}

function complete(j: Job, r: Resident) {
  j.done = true;
  st.earn(j.pay);
  befriend(r.npc, 3, S.day);
  if (j.from) befriend(byId(j.from).npc, 2, S.day);
  repute(1, 'Odd jobs for the neighbours.', S.day, true);
  toast(`Job done: +${rupiah(j.pay)}`, `${r.npc.name} is grateful.`);
}

/** Giving someone the thing they asked for on the board. Returns true if it finished a job. */
export function gave(r: Resident, itemId: string) {
  const j = board.find(j => j.taken && !j.done && j.kind === 'titip' && j.to === r.npc.id && j.item === itemId);
  if (!j) return false;
  complete(j, r);
  return true;
}

/** A parcel for this resident, if Raka is carrying one. */
export const parcelFor = (r: Resident) =>
  board.find(j => j.taken && !j.done && j.kind === 'antar' && j.to === r.npc.id);
export function deliver(r: Resident) {
  const j = parcelFor(r);
  if (!j) return false;
  st.take('paket');
  complete(j, r);
  return true;
}

/** For the Journal. */
export const activeJobs = () => board.filter(j => j.taken && !j.done && j.day === S.day);

/* ================= save ================= */

export const saveJobs = () => ({ board, boardDay, nextId });
export function loadJobs(d: ReturnType<typeof saveJobs>) {
  board = d.board;
  boardDay = d.boardDay;
  nextId = d.nextId;
}
