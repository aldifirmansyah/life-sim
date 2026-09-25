/* Relationship rules (spec §8.3). All friendship changes and reactions are
   decided here, in code; the dialogue provider only words the result. */
import type { Memory, NPC, Stage, Topic } from '../npc/types';
import { repute, firstImpression } from './reputation';

export const TOPICS: Topic[] = [
  'food',
  'football',
  'work',
  'family',
  'weather',
  'old days',
  'religion',
  'music',
  'property',
  'travel',
  'tech',
  'shopping',
  'gossip',
];

/** Most friendship an NPC can gain in one day, so breadth beats grinding one person. */
export const DAILY_CAP = 10;
/** Days without talking before friendship starts to fade. */
export const DECAY_AFTER = 7;

export const stageFor = (f: number): Stage =>
  f >= 80 ? 'best friend' : f >= 60 ? 'close friend' : f >= 35 ? 'friend' : f >= 10 ? 'acquaintance' : 'stranger';
const STAGES: Stage[] = ['stranger', 'acquaintance', 'friend', 'close friend', 'best friend'];
export const stageRank = (s: Stage) => STAGES.indexOf(s);

/** What Aldi knows and has done with one resident. */
export interface Social {
  met: boolean;
  metDay: number;
  known: {
    likes: Topic[];
    dislikes: Topic[];
    birthday: boolean;
    stories: number;
    ties: string[];
    /** Gift reactions Aldi has seen, by item id. */
    gifts: Record<string, string>;
  };
  /** Day each topic was last talked about. */
  topicDay: Partial<Record<Topic, number>>;
  /** Positive friendship gained today (for the daily cap). */
  gainDay: number;
  gained: number;
  /** Day of the last proper greeting. */
  greetedDay: number;
  /** Day Aldi last invited them out, and last passed on a word about someone. */
  invitedDay: number;
  wordDay: number;
  /** Per-day counters for actions that get stale when repeated. */
  today: { day: number; asked: number; compliment: number; joke: number; tease: number; gossip: number; gift: number };
}

const socials = new Map<string, Social>();
export function social(npc: NPC): Social {
  let s = socials.get(npc.id);
  if (!s) {
    s = {
      met: false,
      metDay: -1,
      known: { likes: [], dislikes: [], birthday: false, stories: 0, ties: [], gifts: {} },
      topicDay: {},
      gainDay: -1,
      gained: 0,
      greetedDay: -1,
      invitedDay: -1,
      wordDay: -1,
      today: { day: -1, asked: 0, compliment: 0, joke: 0, tease: 0, gossip: 0, gift: 0 },
    };
    socials.set(npc.id, s);
  }
  return s;
}
function counters(s: Social, day: number) {
  if (s.today.day !== day) s.today = { day, asked: 0, compliment: 0, joke: 0, tease: 0, gossip: 0, gift: 0 };
  return s.today;
}

export interface Change {
  /** What was actually applied after the daily cap. */
  delta: number;
  before: Stage;
  after: Stage;
}

/** Apply a friendship change. Gains are capped per day; losses are not. Mood follows along. */
/** Apply a friendship change. Gains are capped per day (except gifts, which are limited to one a day instead); losses are not. */
export function befriend(npc: NPC, delta: number, day: number, uncapped = false): Change {
  const s = social(npc);
  const rel = npc.playerRelationship;
  if (s.gainDay !== day) {
    s.gainDay = day;
    s.gained = 0;
  }
  let d = delta;
  if (d > 0 && !uncapped) {
    d = Math.min(d, DAILY_CAP - s.gained);
    s.gained += Math.max(0, d);
  }
  const before = rel.stage;
  rel.friendship = Math.max(-100, Math.min(100, rel.friendship + d));
  rel.stage = stageFor(rel.friendship);
  rel.lastTalkedDay = day;
  npc.mood = Math.max(0, Math.min(100, npc.mood + delta * 1.5));
  return { delta: d, before, after: rel.stage };
}

export function remember(npc: NPC, m: Memory) {
  const list = npc.playerRelationship.memories;
  list.push(m);
  if (list.length > 10) list.splice(0, list.length - 10);
}

export function meet(npc: NPC, day: number) {
  const s = social(npc);
  if (s.met) return;
  s.met = true;
  s.metDay = day;
  remember(npc, { day, kind: 'first', text: 'Met Aldi for the first time', weight: 3 });
  // What they've heard about Aldi colours the first impression.
  const bonus = firstImpression();
  if (bonus) {
    npc.playerRelationship.friendship = Math.min(100, npc.playerRelationship.friendship + bonus);
    npc.playerRelationship.stage = stageFor(npc.playerRelationship.friendship);
  }
}

/** Once a day, residents Aldi hasn't talked to for a week cool off a little. */
export function dailyDecay(npcs: NPC[], day: number) {
  for (const npc of npcs) {
    const s = social(npc);
    const rel = npc.playerRelationship;
    if (!s.met || rel.friendship <= 0) continue;
    const since = day - Math.max(rel.lastTalkedDay, s.metDay);
    if (since > DECAY_AFTER) {
      rel.friendship = Math.max(0, rel.friendship - 1);
      rel.stage = stageFor(rel.friendship);
    }
  }
}

/* ================= greetings ================= */

const isElder = (npc: NPC) => npc.age >= 45 || npc.address === 'Ustaz';
const isYoung = (npc: NPC) => npc.age < 25;

/** How Aldi should address them, e.g. "Uncle Ah Seng", "Aunty Mei", or just "Hafiz". */
export function properName(npc: NPC) {
  if (!npc.address) return npc.name;
  return npc.name.startsWith(npc.address) ? npc.name : `${npc.address} ${npc.name}`;
}

/** The NPC's opening line kind, before any choice. */
export function greetingKind(npc: NPC, day: number, walking: boolean) {
  const s = social(npc);
  const rel = npc.playerRelationship;
  if (!s.met) return { kind: 'intro' as const };
  if (rel.lastTalkedDay === day) return { kind: 'greet.again' as const };
  if (walking) return { kind: 'greet.busy' as const };
  if (rel.friendship < -10) return { kind: 'greet' as const, outcome: 'cold' };
  const mem = [...rel.memories].reverse().find(m => m.day < day && day - m.day <= 5);
  if (
    mem &&
    ['topic_like', 'tease_bad', 'joke_good', 'compliment', 'first', 'gift_loved', 'heard_good', 'heard_bad'].includes(
      mem.kind,
    ) &&
    Math.random() < 0.6
  )
    return {
      kind: 'greet.memory' as const,
      outcome: mem.kind,
      topic: mem.kind === 'topic_like' ? (mem.about as Topic) : undefined,
      item: mem.kind === 'gift_loved' ? mem.about : undefined,
      about: mem.kind.startsWith('heard') ? mem.about : undefined,
    };
  const r = stageRank(rel.stage);
  return { kind: 'greet' as const, outcome: r >= 2 ? 'friend' : r === 1 ? 'acquaintance' : 'stranger' };
}

/** Greeting with the right title earns goodwill; a bare first name offends elders. */
export function greet(npc: NPC, proper: boolean, day: number) {
  social(npc).greetedDay = day;
  if (proper) {
    const outcome = isElder(npc) ? 'proper.elder' : isYoung(npc) && npc.age < 18 ? 'proper.young' : 'proper.peer';
    return { outcome, delta: isElder(npc) ? 3 : 1 };
  }
  if (isYoung(npc)) return { outcome: 'casual.ok', delta: 1 };
  if (isElder(npc)) {
    repute(-1, 'Word gets round when you’re rude to elders.', day, true);
    return { outcome: 'casual.rude', delta: -3 };
  }
  return { outcome: 'casual.meh', delta: 0 };
}

/* ================= actions ================= */

export function chat(npc: NPC, topic: Topic, day: number) {
  const s = social(npc);
  const last = s.topicDay[topic];
  // Each topic cools down for two days; bringing it up again doesn't restart the cooldown.
  if (last !== undefined && day - last < 2)
    return { kind: 'topic.repeat' as const, delta: npc.traits.includes('grumpy') ? -2 : -1 };
  s.topicDay[topic] = day;
  if (npc.likes.includes(topic)) {
    remember(npc, { day, kind: 'topic_like', text: `Enjoyed talking about ${topic}`, weight: 2, about: topic });
    return { kind: 'topic.like' as const, delta: npc.mood >= 65 ? 5 : 4 };
  }
  if (npc.dislikes.includes(topic)) {
    remember(npc, { day, kind: 'topic_dislike', text: `Had to hear about ${topic}`, weight: 2, about: topic });
    return { kind: 'topic.dislike' as const, delta: -3 };
  }
  return { kind: 'topic.neutral' as const, delta: 1 };
}

/** Reveal one new thing: likes and birthday first, stories as they warm up. */
export function ask(npc: NPC, day: number, stories: string[]) {
  const s = social(npc);
  const c = counters(s, day);
  c.asked++;
  const k = s.known;
  const rank = stageRank(npc.playerRelationship.stage);
  if (c.asked > 1) return { kind: 'ask.done' as const, delta: 0 };
  const nextLike = npc.likes.find(t => !k.likes.includes(t));
  const nextDislike = npc.dislikes.find(t => !k.dislikes.includes(t));
  const steps: (() => {
    kind: 'ask.like' | 'ask.dislike' | 'ask.birthday' | 'ask.story';
    topic?: Topic;
    detail?: string;
  } | null)[] = [
    () => (k.likes.length === 0 && nextLike ? (k.likes.push(nextLike), { kind: 'ask.like', topic: nextLike }) : null),
    () => (!k.birthday ? ((k.birthday = true), { kind: 'ask.birthday', detail: npc.birthday }) : null),
    () =>
      k.dislikes.length === 0 && nextDislike
        ? (k.dislikes.push(nextDislike), { kind: 'ask.dislike', topic: nextDislike })
        : null,
    () =>
      k.stories === 0 && rank >= 1 && stories[0] ? (k.stories++, { kind: 'ask.story', detail: stories[0] }) : null,
    () => (nextLike ? (k.likes.push(nextLike), { kind: 'ask.like', topic: nextLike }) : null),
    () =>
      k.stories === 1 && rank >= 2 && stories[1] ? (k.stories++, { kind: 'ask.story', detail: stories[1] }) : null,
    () => (nextDislike ? (k.dislikes.push(nextDislike), { kind: 'ask.dislike', topic: nextDislike }) : null),
  ];
  for (const step of steps) {
    const r = step();
    if (r) return { ...r, delta: 1 };
  }
  return { kind: 'ask.done' as const, delta: 0 };
}

export function compliment(npc: NPC, day: number) {
  const c = counters(social(npc), day);
  c.compliment++;
  if (c.compliment > 1) return { outcome: 'repeat', delta: -1 };
  const rank = stageRank(npc.playerRelationship.stage);
  if (npc.traits.includes('shy')) return { outcome: 'shy', delta: 3 };
  if (npc.traits.includes('grumpy') && rank === 0) return { outcome: 'flat', delta: 0 };
  remember(npc, { day, kind: 'compliment', text: 'Aldi said something kind', weight: 1 });
  return { outcome: 'good', delta: npc.traits.includes('cheerful') || npc.traits.includes('caring') ? 3 : 2 };
}

/** `charisma` is Aldi's Charisma level; each level makes jokes and teasing land a little more often. */
export function joke(npc: NPC, day: number, charisma = 1) {
  const c = counters(social(npc), day);
  c.joke++;
  const t = npc.traits;
  let chance =
    0.55 + (t.includes('cheerful') ? 0.2 : 0) - (t.includes('grumpy') ? 0.25 : 0) - (t.includes('bookish') ? 0.05 : 0);
  chance += stageRank(npc.playerRelationship.stage) >= 2 ? 0.15 : 0;
  chance += npc.mood >= 65 ? 0.1 : npc.mood < 35 ? -0.2 : 0;
  if (c.joke > 1) chance -= 0.3;
  chance += (charisma - 1) * 0.02;
  const roll = Math.random();
  if (roll < chance) {
    remember(npc, { day, kind: 'joke_good', text: 'Laughed at one of Aldi’s jokes', weight: 1 });
    return { outcome: 'good', delta: 3 };
  }
  if (roll < chance + 0.3) return { outcome: 'flat', delta: 0 };
  return { outcome: 'bad', delta: -2 };
}

/** Teasing only works between friends, or with easy-going acquaintances. */
export function tease(npc: NPC, day: number, charisma = 1) {
  const c = counters(social(npc), day);
  c.tease++;
  const rank = stageRank(npc.playerRelationship.stage);
  const easy = npc.traits.includes('cheerful') || npc.traits.includes('sporty');
  const ok =
    (rank >= 2 || (rank === 1 && easy)) &&
    c.tease === 1 &&
    Math.random() < (npc.traits.includes('grumpy') ? 0.5 : 0.8) + (charisma - 1) * 0.015;
  if (ok) return { outcome: 'good', delta: 3 };
  remember(npc, { day, kind: 'tease_bad', text: 'Aldi said something hurtful', weight: 3 });
  return { outcome: 'bad', delta: rank === 0 ? -5 : npc.age >= 55 ? -5 : -4 };
}

/** Hear what they think of another resident. Returns the other resident's id when there's something to tell. */
export function gossip(npc: NPC, day: number, alive: (id: string) => boolean) {
  const s = social(npc);
  const c = counters(s, day);
  c.gossip++;
  const loves = npc.traits.includes('gossip');
  if (npc.dislikes.includes('gossip')) return { outcome: 'refuse', delta: -2, other: null };
  if (!loves && stageRank(npc.playerRelationship.stage) === 0) return { outcome: 'shy', delta: 0, other: null };
  if (c.gossip > (loves ? 2 : 1)) return { outcome: 'shy', delta: 0, other: null };
  // Strong feelings first, and things Aldi hasn't heard yet.
  const opinions = Object.entries(npc.relationships)
    .filter(([id]) => alive(id))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const fresh = opinions.filter(([id]) => !s.known.ties.includes(id));
  const pick = (fresh.length ? fresh : opinions).slice(0, 3);
  if (!pick.length) return { outcome: 'shy', delta: 0, other: null };
  const [other, v] = pick[Math.floor(Math.random() * pick.length)];
  if (!s.known.ties.includes(other)) s.known.ties.push(other);
  remember(npc, { day, kind: 'gossip', text: 'Shared an opinion with Aldi', weight: 1, about: other });
  return { outcome: v >= 30 ? 'good' : v <= -20 ? 'bad' : 'neutral', delta: loves ? 2 : 1, other };
}

export const byeKind = (npc: NPC) =>
  npc.playerRelationship.friendship < -10 ? 'cold' : stageRank(npc.playerRelationship.stage) >= 1 ? 'warm' : 'neutral';

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** A gift, once a day per person. Home cooking (berbagi) counts for more; disliked gifts still sting. */
export function gift(
  npc: NPC,
  day: number,
  name: string,
  reaction: 'loved' | 'liked' | 'neutral' | 'disliked',
  homeCooked: boolean,
  quality: number,
) {
  const c = counters(social(npc), day);
  c.gift++;
  if (c.gift > 1) return { outcome: 'again', delta: 0 };
  let delta = { loved: 8, liked: 4, neutral: 1, disliked: -3 }[reaction];
  if (homeCooked && reaction !== 'disliked') delta += 3 + (quality >= 4 ? 1 : 0);
  if (reaction === 'loved' || (homeCooked && reaction !== 'disliked'))
    remember(npc, {
      day,
      kind: 'gift_loved',
      text: `Loved the ${lowerFirst(name)} Aldi brought`,
      weight: 3,
      about: name,
    });
  else if (reaction === 'disliked')
    remember(npc, {
      day,
      kind: 'gift_bad',
      text: `Didn\u2019t care for the ${lowerFirst(name)} Aldi brought`,
      weight: 2,
      about: name,
    });
  const outcome = homeCooked && reaction !== 'disliked' ? (reaction === 'loved' ? 'loved' : 'dish') : reaction;
  return { outcome, delta };
}

/* ================= passing words between neighbours ================= */

/** Neighbours who fell out, and whether Aldi has helped them make peace. */
const mended = new Set<string>();

/** Put in a good word for another resident. Softens grudges over time; strangers don't take advice from Aldi. */
export function goodWord(npc: NPC, other: NPC, day: number) {
  const s = social(npc);
  if (s.wordDay === day) return { outcome: 'again', delta: 0, peace: false };
  s.wordDay = day;
  const rank = stageRank(npc.playerRelationship.stage);
  if (rank === 0) return { outcome: 'stranger', delta: -1, peace: false };
  const v = npc.relationships[other.id] ?? 0;
  const lift = rank >= 2 ? 8 : 5;
  npc.relationships[other.id] = Math.min(100, v + lift);
  remember(npc, { day, kind: 'good_word', text: `Aldi spoke up for ${other.name}`, weight: 1, about: other.id });
  // A feud is over once both sides have come round.
  const key = [npc.id, other.id].sort().join('|');
  const peace =
    v < 0 && npc.relationships[other.id] >= 0 && (other.relationships[npc.id] ?? 0) >= 0 && !mended.has(key);
  if (peace) mended.add(key);
  if (v <= -20) return { outcome: 'grudge', delta: 0, peace };
  return { outcome: v >= 30 ? 'agree' : 'warm', delta: 1, peace };
}

/** Pass on something unkind about another resident. Gossips love it; most people think less of Aldi for it. */
export function badWord(npc: NPC, other: NPC, day: number) {
  const s = social(npc);
  if (s.wordDay === day) return { outcome: 'again', delta: 0 };
  s.wordDay = day;
  const v = npc.relationships[other.id] ?? 0;
  npc.relationships[other.id] = Math.max(-100, v - 6);
  remember(npc, {
    day,
    kind: 'bad_word',
    text: `Aldi talked about ${other.name} behind their back`,
    weight: 2,
    about: other.id,
  });
  if (npc.traits.includes('gossip')) return { outcome: 'juicy', delta: 2 };
  repute(-1, 'Talking behind people’s backs.', day, true);
  if (npc.address === 'Ustaz' || npc.traits.includes('caring') || v >= 50) return { outcome: 'disapprove', delta: -3 };
  return { outcome: 'uneasy', delta: -1 };
}

/* ================= save ================= */

/** What Aldi knows of everyone, and how everyone feels (about Aldi and each other). */
export function saveSocial(npcs: NPC[]) {
  return {
    socials: [...socials.entries()],
    mended: [...mended],
    npcs: npcs.map(n => ({ id: n.id, rel: n.relationships, pr: n.playerRelationship, mood: n.mood })),
  };
}
export function loadSocial(d: ReturnType<typeof saveSocial>, npcs: NPC[]) {
  socials.clear();
  for (const [id, s] of d.socials) socials.set(id, s);
  mended.clear();
  for (const k of d.mended) mended.add(k);
  for (const x of d.npcs) {
    const n = npcs.find(n => n.id === x.id);
    if (!n) continue;
    n.relationships = x.rel;
    n.playerRelationship = x.pr;
    n.mood = x.mood;
  }
}
