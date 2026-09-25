/* Phone messages (spec §8.4): the "Warga RT 04" group chat with announcements
   and chatter, and private messages from residents: invitations, "where were
   you?", food left at Raka's door. Also runs the living-world timers that end
   in a message: friends inviting Raka out, plans met or missed, food sharing.
   Rules live here and in plans.ts; the words come from the dialogue provider. */
import { S, DAYS } from '../core/state';
import { residents, headPos, todayBlocks, type Resident } from '../npc/npcs';
import { lineFor } from '../dialogue/provider';
import { social, remember, properName, stageRank } from './social';
import { repute } from './reputation';
import {
  checkPlans,
  npcOffer,
  answerOffer,
  appointments,
  outing,
  when,
  plan,
  nextSlot,
  type Appointment,
} from './plans';
import { bubble } from '../ui/bubbles';
import { toast } from '../ui/hud';
import { item } from '../game/items';

export interface Msg {
  /** A resident id, 'raka', or 'system'. */
  from: string;
  text: string;
  day: number;
  time: number;
  /** An invitation Raka can answer from the thread. */
  offer?: number;
}
export interface Thread {
  id: string;
  title: string;
  msgs: Msg[];
  unread: number;
}
export const GROUP = 'rt04';
export const threads = new Map<string, Thread>();
threads.set(GROUP, { id: GROUP, title: 'Warga RT 04', msgs: [], unread: 0 });

/** The thread the phone is showing, so it doesn't count as unread. */
export let viewing: string | null = null;
export const setViewing = (id: string | null) => {
  viewing = id;
  if (id) threads.get(id)!.unread = 0;
  // Only the badges need updating; the view is already showing it.
  changed(false);
};
/** Listeners get `content` = true when a thread or plan changed (re-render), false when only the counts did. */
const listeners: ((content: boolean) => void)[] = [];
export const onPhoneChange = (fn: (content: boolean) => void) => listeners.push(fn);
const changed = (content = true) => listeners.forEach(fn => fn(content));
export const unreadTotal = () => [...threads.values()].reduce((a, t) => a + t.unread, 0);

const byId = (id: string) => residents.find(r => r.npc.id === id);

function thread(id: string) {
  let t = threads.get(id);
  if (!t) {
    const r = byId(id)!;
    t = { id, title: properName(r.npc), msgs: [], unread: 0 };
    threads.set(id, t);
  }
  return t;
}

/** Add a message to a thread and let Raka know. */
export function post(threadId: string, from: string, text: string, offer?: number) {
  const t = thread(threadId);
  t.msgs.push({ from, text, day: S.day, time: Math.floor(S.time), offer });
  if (t.msgs.length > 80) t.msgs.splice(0, t.msgs.length - 80);
  if (from !== 'raka' && !(S.phone && viewing === threadId)) {
    t.unread++;
    const who = from === 'system' ? '' : `${byId(from)?.npc.name ?? ''}: `;
    toast(`💬 ${t.title}`, who + (text.length > 90 ? text.slice(0, 88) + '…' : text));
  }
  changed();
}

/** A resident texts: the line comes from the provider. */
async function text(r: Resident, threadId: string, part: Parameters<typeof lineFor>[1], offer?: number) {
  post(threadId, r.npc.id, await lineFor(r, part), offer);
}

/* ================= timers ================= */

interface Timed {
  at: number;
  run: () => void;
}
let queue: Timed[] = [];
const later = (at: number, run: () => void) => queue.push({ at, run });

const h = (hh: number, mm = 0) => hh * 60 + mm;
let plannedDay = -1;
let acc = 0;
let lastHour = -1;
let firstDay = -1;

/** Once a second while the game runs. */
export function updatePhone(dt: number) {
  acc += dt;
  if (acc < 1) return;
  acc = 0;
  if (plannedDay !== S.day) planDay();
  const due = queue.filter(q => S.time >= q.at);
  queue = queue.filter(q => S.time < q.at);
  // Things more than two hours overdue (after a sleep or a time skip) are dropped.
  for (const q of due) if (S.time - q.at < 120) q.run();
  for (const e of checkPlans()) void planEvent(e);
  const hour = Math.floor(S.time / 60);
  if (hour !== lastHour) {
    lastHour = hour;
    hourly();
  }
  friendships();
}

/** Today's group-chat posts, food sharing and so on, at jittered times. */
function planDay() {
  plannedDay = S.day;
  if (firstDay < 0) firstDay = S.day;
  queue = [];
  for (const fn of dayHooks) fn();
  const R = (a: number, b: number) => a + Math.floor(Math.random() * (b - a));
  const rt = byId('bambang')!;
  const dow = S.day % 7;
  // Pak RT's morning announcement.
  if (S.day === firstDay) later(Math.max(S.time + 2, h(6, 40)), () => void groupPost(rt, 'welcome'));
  later(R(h(6, 5), h(6, 50)), () => {
    const ronda = residents.filter(r => todayBlocks(r).some(b => b.activity === 'ronda'));
    if (ronda.length)
      void groupPost(
        rt,
        'ronda',
        ronda
          .map(r => properName(r.npc))
          .join(', ')
          .replace(/, ([^,]*)$/, ' and $1'),
      );
  });
  if (dow === 5) later(R(h(10), h(11)), () => void groupPost(rt, 'jumat'));
  if (dow === 0) later(R(h(7), h(8)), () => void groupPost(rt, 'minggu'));
  // Bu Sri's warung is open.
  if (Math.random() < 0.7) later(R(h(6, 20), h(7, 30)), () => void groupPost(byId('sri')!, 'warung'));
  // Chatter from the talkative ones.
  const talkers = residents.filter(
    r => r.npc.age >= 15 && r.npc.traits.some(t => ['gossip', 'cheerful', 'curious'].includes(t)),
  );
  for (let n = R(2, 4); n > 0; n--) {
    const r = talkers[Math.floor(Math.random() * talkers.length)];
    later(R(h(9), h(21, 30)), () => void groupPost(r, 'chatter'));
  }
  // An old feud flares up.
  if (Math.random() < 0.35) {
    const [a, b, kind] = Math.random() < 0.5 ? ['hartono', 'udin', 'feud_motor'] : ['wati', 'endang', 'feud_loan'];
    const ra = byId(a)!,
      rb = byId(b)!;
    if ((ra.npc.relationships[b] ?? 0) < 0) later(R(h(8), h(21)), () => void groupPost(ra, kind, undefined, rb));
  }
  // Someone brings Raka food: more likely from caring neighbours who like him.
  later(R(h(10), h(18, 30)), maybeShareFood);
  if (plate?.state === 'taken' && S.day - plate.day >= 2 && !plate.reminded) {
    plate.reminded = true;
    const r = byId(plate.npc)!;
    later(R(h(9), h(12)), () => void text(r, r.npc.id, { kind: 'text', outcome: 'plate_remind' }));
  }
}

async function groupPost(r: Resident, outcome: string, detail?: string, other?: Resident) {
  await text(r, GROUP, { kind: 'text', outcome: `group.${outcome}`, detail, other: other?.npc });
  // A reply or two.
  const n = outcome === 'chatter' ? Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2);
  const others = residents.filter(o => o !== r && o !== other && o.npc.age >= 12);
  for (let k = 0; k < n; k++) {
    const o = others.splice(Math.floor(Math.random() * others.length), 1)[0];
    const reply = outcome.startsWith('feud')
      ? 'group.calm'
      : outcome === 'welcome'
        ? 'group.welcome_reply'
        : 'group.reply';
    later(
      S.time + 1 + k * 2 + Math.random() * 3,
      () => void text(o, GROUP, { kind: 'text', outcome: reply, other: r.npc }),
    );
  }
}

/** Once an hour in the day: maybe a friend invites Raka out. */
function hourly() {
  if (S.time < h(8) || S.time > h(20, 30)) return;
  if (appointments.some(a => a.state === 'offered')) return;
  if (Math.random() > 0.14) return;
  const friends = residents.filter(
    r =>
      social(r.npc).met &&
      stageRank(r.npc.playerRelationship.stage) >= 2 &&
      S.day - (invitedRaka.get(r.npc.id) ?? -9) >= 3 &&
      !appointments.some(a => a.npc === r.npc.id && (a.state === 'planned' || a.state === 'offered')),
  );
  if (!friends.length) return;
  const r = friends[Math.floor(Math.random() * friends.length)];
  const a = npcOffer(r);
  if (!a) return;
  invitedRaka.set(r.npc.id, S.day);
  const o = outing(a.outing);
  void text(r, r.npc.id, { kind: 'text', outcome: `invite.${o.id}`, detail: when(a.day, a.start) }, a.id);
}
const invitedRaka = new Map<string, number>();

/** Raka answers an invitation from the phone. */
export function answer(a: Appointment, yes: boolean) {
  if (a.state !== 'offered') return;
  answerOffer(a, yes);
  const r = byId(a.npc)!;
  post(
    a.npc,
    'raka',
    yes ? `Siap, see you ${when(a.day, a.start)}!` : 'Sorry, I can’t make it that time. Next time ya!',
  );
  later(S.time + 1, () => void text(r, r.npc.id, { kind: 'text', outcome: yes ? 'accepted' : 'declined' }));
}

async function planEvent(e: { kind: 'met' | 'missed' | 'expired'; a: Appointment; r: Resident; delta: number }) {
  const o = outing(e.a.outing);
  if (e.kind === 'met') {
    toast(
      `${o.name.replace('Raka’s', 'your')} with ${properName(e.r.npc)}`,
      `They were glad you came. ${e.delta > 0 ? `+${e.delta} ♥` : ''}`,
    );
    const line = await lineFor(e.r, { kind: 'plan', outcome: `met.${o.id}` });
    bubble(e.r, () => headPos(e.r), line, 4.5);
  } else if (e.kind === 'missed') {
    await text(e.r, e.r.npc.id, { kind: 'text', outcome: 'missed', detail: o.place });
  } else if (e.kind === 'expired') {
    await text(e.r, e.r.npc.id, { kind: 'text', outcome: 'expired' });
  }
}

/** When someone becomes a friend, they send their number. */
const texted = new Set<string>();
function friendships() {
  for (const r of residents) {
    if (texted.has(r.npc.id) || stageRank(r.npc.playerRelationship.stage) < 2 || !social(r.npc).met) continue;
    texted.add(r.npc.id);
    if (S.dialog) {
      // Wait until the conversation is over.
      texted.delete(r.npc.id);
      continue;
    }
    void text(r, r.npc.id, { kind: 'text', outcome: 'hello' });
  }
}

/* ================= food sharing ================= */

/** Food left at Raka's door, and the plate he owes back. */
export let plate: { npc: string; item: string; day: number; state: 'waiting' | 'taken'; reminded?: boolean } | null =
  null;
const SHARED: Record<string, string[]> = {
  default: ['sayur_lodeh', 'nasi_kuning', 'kolak'],
  lestari: ['nasi_kuning', 'sayur_lodeh'],
  ratna: ['kue_lapis', 'klepon', 'kolak'],
  sri: ['sayur_lodeh', 'nasi_uduk'],
  sumi: ['kolak', 'sayur_lodeh'],
  wati: ['kolak'],
};

function maybeShareFood() {
  if (plate || Math.random() > 0.4) return;
  shareFood();
}
/** A neighbour leaves food at Raka's door (a random one who'd do that, or the given one). */
export function shareFood(who?: Resident) {
  const cooks = residents.filter(
    r =>
      social(r.npc).met &&
      r.npc.playerRelationship.friendship >= 20 &&
      r.npc.age >= 25 &&
      (r.npc.traits.includes('caring') || r.npc.id in SHARED),
  );
  const r = who ?? cooks[Math.floor(Math.random() * cooks.length)];
  if (!r) return;
  const list = SHARED[r.npc.id] ?? SHARED.default;
  const id = list[Math.floor(Math.random() * list.length)];
  plate = { npc: r.npc.id, item: id, day: S.day, state: 'waiting' };
  void text(r, r.npc.id, { kind: 'text', outcome: 'plate', item: item(id).name });
}

/** Raka picks up the plate from his teras. */
export function takePlate() {
  if (!plate || plate.state !== 'waiting') return null;
  plate.state = 'taken';
  plate.day = S.day;
  changed();
  return plate;
}

/** Returning the plate (with something on it, ideally). Returns the friendship bonus, or null if nothing is owed. */
export function returnPlate(r: Resident, withFood: boolean) {
  if (!plate || plate.state !== 'taken' || plate.npc !== r.npc.id) return null;
  plate = null;
  repute(1, 'You returned the plate, the proper way.', S.day, true);
  remember(r.npc, {
    day: S.day,
    kind: withFood ? 'plate_full' : 'plate_back',
    text: withFood ? 'Raka returned the plate with food on it' : 'Raka returned the plate',
    weight: withFood ? 3 : 1,
  });
  changed();
  return withFood ? 4 : 3;
}
export const owesPlate = (r: Resident) => plate?.state === 'taken' && plate.npc === r.npc.id;

/** Two neighbours made peace with Raka's help: the kampung hears about it. */
export function announcePeace(a: Resident, b: Resident) {
  toast(
    `${a.npc.name} and ${b.npc.name} have made peace`,
    'Kind words, passed back and forth. The whole gang will notice.',
  );
  const [p, q] = Math.random() < 0.5 ? [a, b] : [b, a];
  later(S.time + 20, () => void groupPost(p, 'peace', undefined, q));
}

/** Other systems (events, arcs) add their own messages for the day here; called once each new day. */
const dayHooks: (() => void)[] = [];
export const onPhoneDay = (fn: () => void) => dayHooks.push(fn);

/** A group-chat post by a resident at a game time today (with the usual replies). */
export function schedulePost(at: number, npcId: string, outcome: string, detail?: string) {
  const r = byId(npcId);
  if (r) later(at, () => void groupPost(r, outcome, detail));
}
/** A private text from a resident, now or at a game time today. */
export function sendText(npcId: string, outcome: string, part: { detail?: string; item?: string } = {}, at?: number) {
  const r = byId(npcId);
  if (!r) return;
  const go = () => void text(r, r.npc.id, { kind: 'text', outcome, ...part });
  if (at === undefined || at <= S.time) go();
  else later(at, go);
}

/** A close friend asks Raka to dinner at their house (relationship milestone). */
export function inviteToDinner(r: Resident) {
  const o = outing('makan');
  const { day, start } = nextSlot(o, 120);
  const a = plan(r, o, day, start, 'npc', 'offered');
  void text(r, r.npc.id, { kind: 'text', outcome: 'invite.makan', detail: when(a.day, a.start) }, a.id);
}

/** For the plans list. */
export const dayName = (day: number) => DAYS[day % 7];

/* ================= save ================= */

export const savePhone = () => ({
  threads: [...threads.values()],
  plate,
  invitedRaka: [...invitedRaka.entries()],
  texted: [...texted],
  firstDay,
  plannedDay,
});
export function loadPhone(d: ReturnType<typeof savePhone>) {
  threads.clear();
  for (const t of d.threads) threads.set(t.id, t);
  plate = d.plate;
  invitedRaka.clear();
  for (const [k, v] of d.invitedRaka) invitedRaka.set(k, v);
  texted.clear();
  for (const k of d.texted) texted.add(k);
  firstDay = d.firstDay;
  // Today's messages were already planned (and some sent) before the save.
  plannedDay = d.plannedDay;
  queue = [];
  changed();
}
