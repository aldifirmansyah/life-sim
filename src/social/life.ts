/* People and each other (v3 step 22), on a 1 Hz tick. Ported from the kampung
   version (kampung-v1's social/life.ts) and rewritten for Singapore:
   - ties: everyone who knows someone has a tie with a kind (colleague, family,
     neighbour, friend, rival) and a strength (npc.relationships); groups fill in
     the ties the roster doesn't give (`seedTies`)
   - chats: two people who like each other and are at the same place (a desk
     row, the canteen, a haunt, a hawker table) now and then stop and chat for a
     few game minutes; near Aldi they turn to each other with "…" bubbles, and up
     close Aldi overhears a line (about Aldi, about someone else, or small talk)
   - what a chat changes: the tie grows, what the speaker thinks of Aldi rubs off
     on the listener, and news about Aldi (social/news.ts) passes along
   - call-outs: a friend at a table or a haunt calls Aldi over when Aldi passes
   The same rules run out of sight, so gossip travels whether or not Aldi is there.
   Rules live here; the words come from the dialogue provider. */
import { S, inWorld } from '../core/state';
import { player } from '../core/player';
import { people, talkingNow, type Person } from '../npc/people';
import { provider } from '../dialogue/template';
import type { LineKind } from '../dialogue/types';
import { bubble, clearBubble } from '../ui/bubbles';
import { social, remember, stageFor, stageRank } from './social';
import { news, fresh } from './news';
import type { Topic } from '../npc/types';

/* ---------- ties ---------- */

export type TieKind = 'colleague' | 'family' | 'neighbour' | 'friend' | 'rival';
/** Groups that know each other, the kind of tie, and the strength it starts at. */
const GROUPS: [TieKind, number, string[]][] = [
  ['colleague', 30, ['weijie', 'hafiz', 'meiling', 'arun', 'siti', 'kenji', 'nurul', 'rachel', 'daniel']],
  ['colleague', 35, ['ahseng', 'harun', 'lily', 'mdmtan']],
  ['family', 70, ['auntymei', 'kokwah', 'jasmine']],
  ['neighbour', 35, ['auntymei', 'kokwah', 'jasmine', 'ravi', 'rosnah']],
  ['friend', 45, ['harun', 'dewi', 'bayu', 'ana']],
  ['friend', 40, ['hamid', 'rahman', 'ibrahim', 'firdaus']],
  ['friend', 40, ['junhao', 'farah', 'marcus']],
  ['neighbour', 25, ['lim', 'lakshmi', 'ibrahim', 'ana']],
  ['friend', 35, ['ivy', 'rachel', 'firdaus']],
];
/** Friendly rivalries: they talk, but not kindly. */
const RIVALS: [string, string][] = [
  ['ahseng', 'lim'],
  ['arun', 'kenji'],
  ['kokwah', 'ravi'],
];
const kinds = new Map<string, TieKind>();
const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const tieKind = (a: string, b: string): TieKind | null => kinds.get(pair(a, b)) ?? null;
/** Fill in the ties the roster doesn't set (idempotent: never overwrites what's there). */
export function seedTies() {
  const byId = new Map(people.map(p => [p.npc.id, p]));
  const set = (a: string, b: string, k: TieKind, v: number) => {
    const pa = byId.get(a),
      pb = byId.get(b);
    if (!pa || !pb || a === b) return;
    if (!kinds.has(pair(a, b)) || k === 'family') kinds.set(pair(a, b), k);
    if (pa.npc.relationships[b] === undefined) pa.npc.relationships[b] = v;
    if (pb.npc.relationships[a] === undefined) pb.npc.relationships[a] = v;
  };
  for (const [k, v, ids] of GROUPS) for (const a of ids) for (const b of ids) if (a < b) set(a, b, k, v);
  for (const [a, b] of RIVALS) {
    kinds.set(pair(a, b), 'rival');
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const p = byId.get(x);
      if (p && (p.npc.relationships[y] === undefined || p.npc.relationships[y] > -15)) p.npc.relationships[y] = -20;
    }
  }
  // Ties from the roster that no group names are friendships.
  for (const p of people)
    for (const id of Object.keys(p.npc.relationships))
      if (!kinds.has(pair(p.npc.id, id))) kinds.set(pair(p.npc.id, id), 'friend');
}

/* ---------- chats ---------- */

const abs = () => S.day * 1440 + S.time;
const rel = (a: Person, b: Person) => a.npc.relationships[b.npc.id] ?? 0;
/** Game-minute each pair last chatted (or had the chance to). */
const pairLast = new Map<string, number>();
/** The day each person last heard about Aldi from someone. */
const heardDay = new Map<string, number>();
const free = (p: Person) => !p.trip && !!p.at && !p.at.hidden && !p.chat && talkingNow() !== p;
const headOf = (p: Person): [number, number, number] => [
  p.at!.x,
  (p.at!.sit ? p.at!.sit + 0.85 : p.at!.y + 1.75) + 0.25,
  p.at!.z,
];
const near = (p: Person, r: number) =>
  !!p.at && Math.hypot(p.at.x - player.x, p.at.z - player.z) < r && Math.abs(p.at.y - player.y) < 4;

function meetings() {
  const now = abs();
  for (let x = 0; x < people.length; x++) {
    const a = people[x];
    if (!free(a)) continue;
    for (let y = x + 1; y < people.length; y++) {
      const b = people[y];
      if (!free(b) || Math.abs(a.at!.y - b.at!.y) > 1) continue;
      if (Math.hypot(a.at!.x - b.at!.x, a.at!.z - b.at!.z) > 3.2) continue;
      const key = pair(a.npc.id, b.npc.id);
      if (now - (pairLast.get(key) ?? -1e9) < 60) continue;
      const like = Math.min(rel(a, b), rel(b, a));
      const rival = tieKind(a.npc.id, b.npc.id) === 'rival';
      if (like < 10 && !rival) continue;
      pairLast.set(key, now);
      if (Math.random() > (rival ? 0.25 : 0.3 + like / 250)) continue;
      const until = Math.min(S.time + 6 + Math.random() * 10, 26 * 60 - 5);
      a.chat = { with: b, until, speaking: true, next: 0 };
      b.chat = { with: a, until, speaking: false, next: 0 };
      chatted(a, b);
      break;
    }
  }
}
function endChat(p: Person) {
  const q = p.chat?.with;
  p.chat = null;
  clearBubble(p);
  if (q && q.chat?.with === p) {
    q.chat = null;
    clearBubble(q);
  }
}

/** What a chat changes: the tie, and what each thinks of Aldi and has heard, passed on. */
function chatted(a: Person, b: Person) {
  const rival = tieKind(a.npc.id, b.npc.id) === 'rival';
  for (const [p, q] of [
    [a, b],
    [b, a],
  ] as const) {
    p.npc.relationships[q.npc.id] = Math.max(-100, Math.min(100, rel(p, q) + (rival ? -1 : 1)));
    p.npc.mood = Math.max(0, Math.min(100, p.npc.mood + (rival ? -1 : 1)));
  }
  for (const [p, q] of [
    [a, b],
    [b, a],
  ] as const) {
    if (!rival) spread(p, q);
    pass(p, q, rival);
  }
}
/** q hears what p thinks of Aldi (once a day at most): warm words warm them; complaints cool them. */
function spread(p: Person, q: Person) {
  if (!social(p.npc).met) return;
  const f = p.npc.playerRelationship.friendship;
  const sign = f >= 35 ? 1 : f <= -10 ? -1 : 0;
  if (!sign || heardDay.get(q.npc.id) === S.day) return;
  const talky = p.npc.traits.includes('gossip') ? 1 : rel(q, p) >= 50 ? 0.6 : 0.35;
  if (Math.random() > talky) return;
  heardDay.set(q.npc.id, S.day);
  const qr = q.npc.playerRelationship;
  qr.friendship = Math.max(-100, Math.min(100, qr.friendship + sign));
  qr.stage = stageFor(qr.friendship);
  remember(q.npc, {
    day: S.day,
    kind: sign > 0 ? 'heard_good' : 'heard_bad',
    text: sign > 0 ? `Heard good things about Aldi from ${p.npc.name}` : `Heard ${p.npc.name} complain about Aldi`,
    weight: 1,
    about: p.npc.id,
  });
}
/** News about Aldi passes from p to q (rivals pass on only the bad). */
function pass(p: Person, q: Person, rival: boolean) {
  const talky = p.npc.traits.includes('gossip') ? 0.95 : 0.6;
  for (const n of fresh()) {
    if (!(p.npc.id in n.heard) || q.npc.id in n.heard || (rival && n.good)) continue;
    if (Math.random() > talky) continue;
    n.heard[q.npc.id] = p.npc.id;
    // Heard news moves them a little, if they know Aldi.
    if (social(q.npc).met) {
      const r = q.npc.playerRelationship;
      r.friendship = Math.max(-100, Math.min(100, r.friendship + (n.good ? 1 : -1)));
      r.stage = stageFor(r.friendship);
    }
  }
}

/** Near Aldi: the pair turn to each other and take turns; "…" over the speaker, and up close a line. */
function talkNear() {
  for (const a of people) {
    const c = a.chat;
    if (!c) continue;
    const b = c.with;
    if (S.time >= c.until || !b.chat || a.trip || b.trip || talkingNow() === a || talkingNow() === b) {
      endChat(a);
      continue;
    }
    if (!c.speaking || !a.shown) continue;
    c.next -= 1;
    if (c.next > 0) continue;
    // Take turns every few seconds.
    c.speaking = false;
    b.chat.speaking = true;
    b.chat.next = 4 + Math.floor(Math.random() * 3);
    if (near(a, 7) && inWorld()) void overhear(a, b);
    else if (near(a, 24)) bubble(a, () => headOf(a), '…', 3, true);
  }
}
async function line(
  p: Person,
  kind: LineKind,
  outcome: string,
  extra: { other?: Person; detail?: string; topic?: Topic } = {},
) {
  const r = await provider.getLine({
    kind,
    outcome,
    npc: p.npc,
    stage: p.npc.playerRelationship.stage,
    time: S.time,
    day: S.day,
    location: p.at?.where ?? '',
    other: extra.other?.npc,
    detail: extra.detail,
    topic: extra.topic,
  });
  return r.text;
}
async function overhear(sp: Person, other: Person) {
  const f = sp.npc.playerRelationship.friendship;
  const met = social(sp.npc).met;
  const roll = Math.random();
  let outcome = 'small';
  let about: Person | undefined;
  let detail: string | undefined;
  const heard = fresh().filter(n => sp.npc.id in n.heard);
  if (tieKind(sp.npc.id, other.npc.id) === 'rival') outcome = 'rival';
  else if (heard.length && roll < 0.35) {
    const n = heard[heard.length - 1];
    outcome = n.good ? 'news_good' : 'news_bad';
    detail = n.text;
  } else if (met && f >= 35 && roll < 0.5) outcome = 'aldi_good';
  else if (met && f <= -10 && roll < 0.6) outcome = 'aldi_bad';
  else if (!met && roll < 0.45) outcome = 'aldi_new';
  else if (roll < 0.75) {
    const opinions = Object.entries(sp.npc.relationships).filter(
      ([id, v]) => id !== other.npc.id && Math.abs(v) >= 25 && people.some(p => p.npc.id === id),
    );
    const pick = opinions[Math.floor(Math.random() * opinions.length)];
    if (pick) {
      about = people.find(p => p.npc.id === pick[0]);
      outcome = pick[1] > 0 ? 'other_good' : 'other_bad';
      // Overhearing counts as learning how they feel.
      const known = social(sp.npc).known.ties;
      if (met && !known.includes(pick[0])) known.push(pick[0]);
    }
  }
  const text = await line(sp, 'overhear', outcome, {
    other: about ?? other,
    detail,
    topic: sp.npc.likes[Math.floor(Math.random() * sp.npc.likes.length)],
  });
  if (sp.chat) bubble(sp, () => headOf(sp), text, 4.5);
}

/* ---------- call-outs ---------- */

const calledAt = new Map<string, number>();
let lastCallout = -1e9;
/** A friend sitting or standing at a table or a haunt calls Aldi over as Aldi passes in front of them. */
function callouts() {
  const now = abs();
  if (now - lastCallout < 5 || S.seated || player.ride) return;
  for (const p of people) {
    if (!p.shown || !p.at || p.trip || p.chat || talkingNow() === p || !near(p, 7) || near(p, 1.5)) continue;
    if (!social(p.npc).met || stageRank(p.npc.playerRelationship.stage) < 2) continue;
    if (!(p.at.sit || p.goalKey?.startsWith('out.'))) continue;
    if (now - (calledAt.get(p.npc.id) ?? -1e9) < 240) continue;
    let a = Math.atan2(player.x - p.at.x, player.z - p.at.z) - p.at.ry;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > 1.7) continue;
    calledAt.set(p.npc.id, now);
    if (Math.random() > (p.npc.traits.includes('shy') ? 0.3 : 0.7)) continue;
    lastCallout = now;
    void line(p, 'callout', p.at.sit ? 'join' : 'friend').then(t => bubble(p, () => headOf(p), t, 4.5));
    return;
  }
}

/* ---------- witnesses ---------- */

/** News that happened somewhere: the named person nearest to it (within 300 m) saw or heard first. */
function witnesses() {
  for (const n of news) {
    if (!n.at) continue;
    const [x, z] = n.at;
    n.at = undefined;
    let best: Person | null = null,
      bd = 300;
    for (const p of people) {
      if (!p.at) continue;
      const d = Math.hypot(p.at.x - x, p.at.z - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best && !(best.npc.id in n.heard)) n.heard[best.npc.id] = '';
  }
}

let acc = 0;
let seededDay = -1;
/** Every frame; the rules run once a second. */
export function updateLife(dt: number) {
  if (!S.started) return;
  acc += dt;
  if (acc < 1) return;
  acc = 0;
  if (seededDay !== S.day) {
    seededDay = S.day;
    seedTies();
  }
  witnesses();
  meetings();
  talkNear();
  if (inWorld()) callouts();
}
export const lifeDebug = { pairLast, tieKind, seedTies };
