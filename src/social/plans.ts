/* Invitations both ways (spec §8.3 "Invite", §8.4 "NPCs initiate"). An accepted
   invitation is an appointment: a one-off block laid over the resident's
   schedule, so they really walk there and wait. Meeting them there is worth a
   lot of friendship; standing them up costs some. Friends also invite Raka, by
   text. */
import { S } from '../core/state';
import { player } from '../core/player';
import { residents, setPlan, todayBlocks, atRest, type Resident } from '../npc/npcs';
import { blockIndexAt } from '../npc/schedule';
import type { Activity, ScheduleBlock } from '../npc/types';
import { social, befriend, remember, properName, stageRank } from './social';
import { addMood, perks } from '../game/stats';
import { repute, goodwill } from './reputation';
import { emit } from '../game/bus';

export interface Outing {
  id: string;
  /** "Ngopi at Warkop Berkah" */
  name: string;
  /** Short form for lists: "ngopi". */
  short: string;
  /** A location, or one that depends on who (dinner at their own house). */
  location: string | ((r: Resident) => string);
  activity: Activity;
  /** Start times offered, game-minutes. */
  times: number[];
  minutes: number;
  /** Where to find it, for texts and the plans list. */
  place: string;
  /** Children stay home from this one. */
  grownUp?: boolean;
  /** Not offered in the Invite menu or by texts (dinners, story-arc meetings). */
  hidden?: boolean;
}

const h = (hh: number, mm = 0) => hh * 60 + mm;
export const OUTINGS: Outing[] = [
  {
    id: 'kopi',
    name: 'Ngopi at Warkop Berkah',
    short: 'ngopi',
    location: 'warkop.seat',
    activity: 'chat',
    times: [h(7), h(19, 30)],
    minutes: 60,
    place: 'Warkop Berkah',
    grownUp: true,
  },
  {
    id: 'bakso',
    name: 'Bakso at Mas Joko’s cart',
    short: 'bakso',
    location: 'bakso.customer',
    activity: 'eat',
    times: [h(19)],
    minutes: 45,
    place: 'the bakso cart',
  },
  {
    id: 'walk',
    name: 'A morning walk by the kali',
    short: 'a walk',
    location: 'bridge.rail',
    activity: 'walk',
    times: [h(6, 30)],
    minutes: 45,
    place: 'the bridge',
  },
  {
    id: 'sore',
    name: 'Sore at the lapangan',
    short: 'sore at the lapangan',
    location: 'lapangan.bench',
    activity: 'relax',
    times: [h(16, 30)],
    minutes: 60,
    place: 'the lapangan',
  },
  {
    id: 'teh',
    name: 'Teh on Raka’s teras',
    short: 'teh at yours',
    location: 'raka.teras',
    activity: 'chat',
    times: [h(16), h(20)],
    minutes: 60,
    place: 'your teras',
  },
];
// Close friends invite Raka to dinner at their house (a relationship milestone).
OUTINGS.push({
  id: 'makan',
  name: 'Dinner at their house',
  short: 'dinner',
  location: r => (r.def.household === 'sri' ? 'warung.bench' : `@${r.def.household}.teras`),
  activity: 'eat',
  times: [h(19)],
  minutes: 90,
  place: 'their house',
  hidden: true,
});
export const outing = (id: string) => OUTINGS.find(o => o.id === id)!;

export interface Appointment {
  id: number;
  npc: string;
  outing: string;
  day: number;
  start: number;
  end: number;
  /** Who asked. */
  by: 'raka' | 'npc';
  state: 'offered' | 'planned' | 'met' | 'missed' | 'declined' | 'expired';
  block: ScheduleBlock | null;
}
export const appointments: Appointment[] = [];
let nextId = 1;

const resident = (id: string) => residents.find(r => r.npc.id === id)!;

/** "tonight 19:30", "tomorrow 07:00", "today 16:30". */
export function when(day: number, t: number) {
  const hh = String(Math.floor(t / 60) % 24).padStart(2, '0'),
    mm = String(t % 60).padStart(2, '0');
  const d = day === S.day ? (t >= h(18) ? 'tonight' : 'today') : day === S.day + 1 ? 'tomorrow' : `day ${day}`;
  return `${d} ${hh}:${mm}`;
}

/** The next time an outing can happen: today if there's an hour to get ready, else tomorrow. */
export function nextSlot(o: Outing, lead = 60): { day: number; start: number } {
  for (const t of o.times) if (t >= S.time + lead) return { day: S.day, start: t };
  return { day: S.day + 1, start: o.times[0] };
}

/** What the resident has on at that time (with plans already made that day). */
function blockAt(r: Resident, day: number, t: number) {
  if (day === S.day) {
    const blocks = todayBlocks(r);
    return blocks[blockIndexAt(blocks, t)];
  }
  const blocks = r.npc.schedule[day % 7];
  const plan = r.plans.find(p => p.day === day && p.block.start <= t && p.block.end > t);
  return plan?.block ?? blocks[blockIndexAt(blocks, t)];
}

const BUSY: Activity[] = ['work', 'study', 'pray', 'ronda', 'away'];
/** Why they can't make it, or null when they're free. */
function busyReason(r: Resident, o: Outing, day: number, start: number): string | null {
  const npc = r.npc;
  if (o.grownUp && npc.age < 16) return 'young';
  if (npc.age < 13 && start >= h(19)) return 'young';
  const booked = appointments.some(
    a =>
      a.npc === npc.id &&
      (a.state === 'planned' || a.state === 'offered') &&
      a.day === day &&
      a.start < start + o.minutes &&
      a.end > start,
  );
  if (booked) return 'busy';
  for (let t = start - 30; t < start + o.minutes; t += 15) {
    const b = blockAt(r, day, t);
    if (!b) continue;
    if (BUSY.includes(b.activity) || b.location === 'away') return 'busy';
    if (b.activity === 'sleep' && t >= start) return 'busy';
  }
  // Someone who runs the place is there anyway.
  if (o.id === 'kopi' && npc.id === 'slamet') return 'busy';
  if (o.id === 'bakso' && npc.id === 'joko') return 'busy';
  return null;
}

/** Does Raka already have something on then? */
export function rakaBusy(day: number, start: number, minutes: number) {
  return appointments.some(
    a =>
      (a.state === 'planned' || a.state === 'offered') && a.day === day && a.start < start + minutes && a.end > start,
  );
}

/** Raka asks a resident along. Decides in code; returns the outcome for the dialogue line. */
export function invite(r: Resident, o: Outing) {
  const s = social(r.npc);
  const npc = r.npc;
  const { day, start } = nextSlot(o);
  if (s.invitedDay === S.day) return { outcome: 'again', delta: 0, day, start };
  s.invitedDay = S.day;
  const rank = stageRank(npc.playerRelationship.stage);
  const busy = busyReason(r, o, day, start);
  if (busy) return { outcome: busy, delta: 0, day, start };
  let chance = 0.25 + npc.playerRelationship.friendship / 70 + (npc.mood - 50) / 200;
  if (npc.traits.includes('shy') && rank < 2) chance -= 0.2;
  if (npc.traits.includes('cheerful') || npc.traits.includes('curious')) chance += 0.1;
  if (o.id === 'walk' && npc.traits.includes('sporty')) chance += 0.2;
  if (o.id === 'kopi' && npc.likes.includes('gossip')) chance += 0.1;
  if (o.id === 'teh' && rank < 2) chance -= 0.15;
  // A restored teras is more inviting; a good name helps everywhere.
  if (o.id === 'teh' && perks.teras) chance += 0.15;
  chance += goodwill();
  if (Math.random() > chance) return { outcome: 'no', delta: 0, day, start };
  plan(r, o, day, start, 'raka');
  return { outcome: 'yes', delta: 1, day, start };
}

export function plan(
  r: Resident,
  o: Outing,
  day: number,
  start: number,
  by: 'raka' | 'npc',
  state: Appointment['state'] = 'planned',
) {
  const a: Appointment = {
    id: nextId++,
    npc: r.npc.id,
    outing: o.id,
    day,
    start,
    end: start + o.minutes,
    by,
    state,
    block: null,
  };
  appointments.push(a);
  if (state === 'planned') confirm(a);
  return a;
}

function confirm(a: Appointment) {
  const o = outing(a.outing);
  a.state = 'planned';
  const r = resident(a.npc);
  a.block = {
    start: a.start,
    end: a.end,
    location: typeof o.location === 'string' ? o.location : o.location(r),
    activity: o.activity,
  };
  setPlan(r, a.day, a.block);
}

/** A friend asks Raka along (by text). Returns the offer, or null if nobody is free. */
export function npcOffer(r: Resident): Appointment | null {
  const options = OUTINGS.filter(o => o.id !== 'teh' && !o.hidden);
  for (let tries = 0; tries < 4; tries++) {
    const o = options[Math.floor(Math.random() * options.length)];
    const { day, start } = nextSlot(o, 120);
    if (busyReason(r, o, day, start) || rakaBusy(day, start, o.minutes)) continue;
    return plan(r, o, day, start, 'npc', 'offered');
  }
  return null;
}
export function answerOffer(a: Appointment, yes: boolean) {
  if (a.state !== 'offered') return;
  if (yes) confirm(a);
  else a.state = 'declined';
}

/** Where Raka stands with each plan, once a second. Returns things that happened, for texts and toasts. */
export type PlanEvent = { kind: 'met' | 'missed' | 'expired'; a: Appointment; r: Resident; delta: number };
export function checkPlans(): PlanEvent[] {
  const out: PlanEvent[] = [];
  for (const a of appointments) {
    const late = a.day < S.day || (a.day === S.day && S.time > a.start + 40);
    if (a.state === 'offered' && (a.day < S.day || (a.day === S.day && S.time > a.start - 30))) {
      a.state = 'expired';
      out.push({ kind: 'expired', a, r: resident(a.npc), delta: 0 });
      continue;
    }
    if (a.state !== 'planned') continue;
    const r = resident(a.npc);
    if (a.day === S.day && S.time >= a.start - 15 && S.time <= a.end) {
      const there = atRest(r) && todayBlocksHas(r, a);
      if (there && Math.hypot(r.x - player.x, r.z - player.z) < 5) {
        a.state = 'met';
        const ch = befriend(r.npc, 8 + (a.outing === 'teh' && perks.guests ? 4 : 0), S.day, true);
        repute(1, 'You kept your word.', S.day, true);
        emit('plan_met', `${r.npc.id}:${a.outing}`);
        remember(r.npc, {
          day: S.day,
          kind: 'plan_met',
          text: `Enjoyed ${outing(a.outing).short} with Raka`,
          weight: 3,
          about: a.outing,
        });
        addMood(8);
        out.push({ kind: 'met', a, r, delta: ch.delta });
        continue;
      }
    }
    if (late) {
      a.state = 'missed';
      const ch = befriend(r.npc, -5, S.day);
      repute(-1, 'You didn’t turn up.', S.day, true);
      remember(r.npc, {
        day: S.day,
        kind: 'plan_missed',
        text: `Raka didn’t turn up for ${outing(a.outing).short}`,
        weight: 3,
        about: a.outing,
      });
      out.push({ kind: 'missed', a, r, delta: ch.delta });
    }
  }
  return out;
}

/** Is the resident at the planned place, in the planned block? */
function todayBlocksHas(r: Resident, a: Appointment) {
  const b = todayBlocks(r)[r.block];
  return !!a.block && b.start === a.block.start && b.location === a.block.location;
}

/** Plans still ahead, soonest first (for the phone). */
export const upcoming = () =>
  appointments
    .filter(a => a.state === 'planned' || a.state === 'offered')
    .sort((x, y) => x.day - y.day || x.start - y.start);

/** For lines: "Pak Slamet", "the warkop", etc. */
export const withWhom = (a: Appointment) => properName(resident(a.npc).npc);

/* ================= save ================= */

export const savePlans = () => ({ appointments, nextId });
/** Restore appointments, and lay the planned ones back over the residents' schedules. */
export function loadPlans(d: ReturnType<typeof savePlans>) {
  appointments.length = 0;
  appointments.push(...d.appointments);
  nextId = d.nextId;
  for (const a of appointments)
    if (a.state === 'planned' && a.block && a.day >= S.day && OUTINGS.some(o => o.id === a.outing))
      setPlan(resident(a.npc), a.day, a.block);
}
