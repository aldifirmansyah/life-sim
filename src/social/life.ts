/* The kampung's own social life (spec §8.4), on a 1 Hz tick:
   - neighbours who meet and like each other stop and chat; nearby, Raka sees
     "…" bubbles and can overhear a line
   - every chat nudges their relationship, and passes on what they think of Raka
   - neighbours on their teras (and friends at the warung or warkop) call out to
     Raka as he walks past; friends wave from a distance
   Rules live here; the words come from the dialogue provider. */
import { S, inWorld } from '../core/state';
import { player } from '../core/player';
import {
  people,
  residents,
  startChat,
  wave,
  atRest,
  chatSpeaker,
  activityOf,
  headPos,
  type Resident,
} from '../npc/npcs';
import { lineFor } from '../dialogue/provider';
import { bubble } from '../ui/bubbles';
import { social, remember, stageFor, stageRank } from './social';
import { goodwill } from './reputation';

const hash = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x2545f491, 0x9e3779b1) ^ Math.imul(b + 0x68e31da4, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/** Game-minute each pair last chatted, keyed "i-j". */
const pairLast = new Map<string, number>();
/** Per resident: when they last called out or waved to Raka (absolute game-minutes). */
const calledAt = new Map<number, number>();
const wavedAt = new Map<number, number>();
/** Per resident: the day they last heard about Raka from someone else. */
const heardDay = new Map<string, number>();
/** Chats Raka has overheard lines from (by the lower index of the pair), and when. */
const overheard = new Map<number, { n: number; at: number }>();
/** A call-out Raka can answer by going over to talk. */
let callout: { r: Resident; until: number } | null = null;
let lastCallout = -1e9;

const abs = () => S.day * 1440 + S.time;
const rel = (a: Resident, b: Resident) => a.npc.relationships[b.npc.id] ?? 0;
const canChat = (r: Resident) => !r.hidden && !r.talking && !r.chat && !r.guide;

let acc = 0;
/** Every frame; does its work at 1 Hz. */
export function updateLife(dtReal: number) {
  acc += dtReal;
  if (acc < 1) return;
  acc = 0;
  meetings();
  bubbles();
  if (inWorld()) {
    callouts();
    waves();
  }
}

/* ================= NPC–NPC chats ================= */

function meetings() {
  const now = abs();
  for (let x = 0; x < people.length; x++) {
    const a = people[x];
    if (!canChat(a)) continue;
    for (let y = x + 1; y < people.length; y++) {
      const b = people[y];
      if (!canChat(b) || a.ambient !== b.ambient) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      const walking = a.state === 'walk' || b.state === 'walk';
      // Walkers are caught a little early (they close the gap before stopping); sitters must be side by side.
      if (d > (walking ? 3.2 : 2.6)) continue;
      // Kids playing on the lapangan and people praying don't stop to chat.
      if (activityOf(a) === 'play' || activityOf(b) === 'play') continue;
      const key = `${a.i}-${b.i}`;
      const last = pairLast.get(key) ?? -1e9;
      if (now - last < (walking ? 180 : 90)) continue;
      const like = a.ambient ? 30 : Math.min(rel(a, b), rel(b, a));
      if (like < (walking ? 20 : 10)) continue;
      // Walkers who like each other usually stop; people sitting together get chatting sooner or later.
      const chance = a.ambient ? 0.2 : walking ? 0.3 + like / 250 : 0.25 + like / 400;
      // A missed chance comes round again soon for people sitting together; walkers have passed each other.
      if (Math.random() > chance) {
        pairLast.set(key, walking ? now : now - 90 + 15);
        continue;
      }
      pairLast.set(key, now);
      const mins = walking ? 4 + Math.random() * 5 : 12 + Math.random() * 18;
      startChat(a, b, Math.min(S.time + mins, 26 * 60 - 5));
      if (!a.ambient) chatted(a, b);
      break;
    }
  }
}

/** What a chat changes: they get on a little better, and pass on what they think of Raka. */
function chatted(a: Resident, b: Resident) {
  for (const [p, q] of [
    [a, b],
    [b, a],
  ] as const) {
    p.npc.relationships[q.npc.id] = Math.min(100, rel(p, q) + 1);
    p.npc.mood = Math.min(100, p.npc.mood + 1);
  }
  for (const [p, q] of [
    [a, b],
    [b, a],
  ] as const)
    spread(p, q);
}

/** q hears about Raka from p (once a day at most). Good words from friends warm them up; complaints cool them. */
function spread(p: Resident, q: Resident) {
  const ps = social(p.npc);
  if (!ps.met) return;
  const f = p.npc.playerRelationship.friendship;
  const sign = f >= 35 ? 1 : f <= -10 ? -1 : 0;
  if (!sign || heardDay.get(q.npc.id) === S.day) return;
  // Gossips pass things on readily; others only to people they're close to.
  const talky = p.npc.traits.includes('gossip') ? 1 : rel(q, p) >= 50 ? 0.6 : 0.35;
  if (Math.random() > talky) return;
  heardDay.set(q.npc.id, S.day);
  const qr = q.npc.playerRelationship;
  qr.friendship = Math.max(-100, Math.min(100, qr.friendship + sign));
  qr.stage = stageFor(qr.friendship);
  remember(q.npc, {
    day: S.day,
    kind: sign > 0 ? 'heard_good' : 'heard_bad',
    text: sign > 0 ? `Heard good things about Raka from ${p.npc.name}` : `Heard ${p.npc.name} complain about Raka`,
    weight: 1,
    about: p.npc.id,
  });
}

/** "…" over whoever is talking in each chat near Raka, and now and then a line he can overhear. */
function bubbles() {
  const now = abs();
  for (const a of people) {
    const b = a.chat?.with;
    if (!b || a.i > b.i || a.chat!.closing || b.chat?.closing) continue;
    const d = Math.min(a.dist, b.dist);
    if (d > 22) continue;
    const speaker = chatSpeaker(a) ? a : b;
    const listener = speaker === a ? b : a;
    const o = overheard.get(a.i);
    const fresh = !o || now - o.at > 60;
    if (d < 6.5 && inWorld() && (fresh || (o.n < 2 && now - o.at >= 4))) {
      overheard.set(a.i, { n: fresh ? 1 : o!.n + 1, at: now });
      void overhear(speaker, listener);
    } else if (!o || now - o.at > 5) bubble(speaker, () => headPos(speaker), '…', 1.15, true);
  }
}

async function overhear(sp: Resident, other: Resident) {
  let outcome: string;
  let about: Resident | undefined;
  if (sp.ambient) outcome = 'ambient';
  else {
    const f = sp.npc.playerRelationship.friendship;
    const met = social(sp.npc).met;
    const roll = Math.random();
    if (met && f >= 35 && roll < 0.35) outcome = 'raka_good';
    else if (met && f <= -10 && roll < 0.5) outcome = 'raka_bad';
    else if (!met && roll < 0.25) outcome = 'raka_new';
    else if (roll < 0.65) {
      // Talk about a third neighbour they feel strongly about.
      const opinions = Object.entries(sp.npc.relationships).filter(
        ([id, v]) => id !== other.npc.id && Math.abs(v) >= 25 && residents.some(r => r.npc.id === id),
      );
      const pick = opinions[Math.floor(Math.random() * opinions.length)];
      if (pick) {
        about = residents.find(r => r.npc.id === pick[0]);
        outcome = pick[1] > 0 ? 'other_good' : 'other_bad';
        // Overhearing counts as learning how they feel.
        const known = social(sp.npc).known.ties;
        if (social(sp.npc).met && !known.includes(pick[0])) known.push(pick[0]);
      } else outcome = 'small';
    } else outcome = 'small';
  }
  const text = await lineFor(sp, {
    kind: 'overhear',
    outcome,
    other: (about ?? other).npc,
    topic: sp.npc.likes[Math.floor(Math.random() * sp.npc.likes.length)],
  });
  if (sp.chat) bubble(sp, () => headPos(sp), text, 4.2);
}

/* ================= call-outs and waves ================= */

/** Neighbours on their teras call out as Raka walks past; friends sitting at the warung or warkop call him over. */
function callouts() {
  const now = abs();
  if (now - lastCallout < 3 || S.acting) return;
  for (const r of residents) {
    if (r.hidden || r.talking || r.chat || !atRest(r) || r.dist > 7 || r.dist < 1.2) continue;
    const onTeras = r.slot.tag === 'teras';
    const f = r.npc.playerRelationship.friendship;
    if (!onTeras && (f < 35 || r.slot.pose !== 'sit')) continue;
    if (now - (calledAt.get(r.i) ?? -1e9) < 150) continue;
    // Only when Raka is passing by, roughly in front of them.
    let a = Math.atan2(player.x - r.x, player.z - r.z) - r.ry;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > 1.7) continue;
    calledAt.set(r.i, now);
    const t = r.npc.traits;
    let chance = onTeras ? 0.7 : 0.45;
    if (t.includes('shy')) chance -= 0.35;
    if (t.includes('grumpy') && f < 35) chance -= 0.3;
    if (t.includes('cheerful') || t.includes('gossip') || t.includes('curious')) chance += 0.15;
    chance += goodwill();
    if (f < -10) chance = 0;
    if (Math.random() > chance) continue;
    lastCallout = now;
    const met = social(r.npc).met;
    const rank = stageRank(r.npc.playerRelationship.stage);
    const outcome = !met
      ? 'stranger'
      : !onTeras
        ? 'join'
        : rank >= 2
          ? 'friend'
          : rank === 1
            ? 'acquaintance'
            : 'known';
    callout = { r, until: S.time + 6 };
    if (rank >= 1) wave(r, 1.6);
    void lineFor(r, { kind: 'callout', outcome }).then(text => bubble(r, () => headPos(r), text, 4.8));
    return;
  }
}

/** Friends who spot Raka across the gang give him a wave. */
function waves() {
  const now = abs();
  for (const r of residents) {
    if (r.hidden || r.talking || r.chat || r.dist < 5 || r.dist > 16) continue;
    if (r.npc.playerRelationship.friendship < 35) continue;
    if (now - (wavedAt.get(r.i) ?? -1e9) < 90 || now - (calledAt.get(r.i) ?? -1e9) < 30) continue;
    // They need to be facing roughly toward Raka, and he toward them.
    let a = Math.atan2(player.x - r.x, player.z - r.z) - r.ry;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    const fx = -Math.sin(player.yaw),
      fz = -Math.cos(player.yaw);
    const seen = ((r.x - player.x) * fx + (r.z - player.z) * fz) / r.dist > 0.6;
    if (Math.abs(a) > 1.3 || !seen) continue;
    wavedAt.set(r.i, now);
    if (hash(r.i, Math.floor(now / 90)) < 0.6) wave(r, 2);
  }
}

/** Talking to someone who just called out: they're pleased Raka came over. */
export function answeredCallout(r: Resident) {
  const ok = callout?.r === r && S.time <= callout.until;
  if (ok) callout = null;
  return ok;
}
