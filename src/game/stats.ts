/* Raka's stats (spec §6): energy, mood, money, skills and the bag. No hunger:
   eating is a boost, not a need. */
import { S } from '../core/state';
import { player } from '../core/player';
import { toast } from '../ui/hud';
import { item, ITEMS } from './items';

export const stats = {
  energy: 85,
  mood: 60,
  money: 150000,
};

export type Skill = 'cooking' | 'fitness' | 'gardening' | 'charisma' | 'music';
export const SKILL_NAMES: Record<Skill, string> = {
  cooking: 'Cooking',
  fitness: 'Fitness',
  gardening: 'Gardening',
  charisma: 'Charisma',
  music: 'Music',
};
export const skillXp: Record<Skill, number> = { cooking: 0, fitness: 0, gardening: 0, charisma: 0, music: 0 };
/** XP needed for levels 2..10. */
const LEVELS = [30, 80, 150, 250, 380, 540, 730, 950, 1200];

export function level(s: Skill) {
  let l = 1;
  for (const need of LEVELS) if (skillXp[s] >= need) l++;
  return l;
}
/** Progress 0..1 toward the next level. */
export function levelProgress(s: Skill) {
  const l = level(s);
  if (l >= 10) return 1;
  const lo = l === 1 ? 0 : LEVELS[l - 2],
    hi = LEVELS[l - 1];
  return (skillXp[s] - lo) / (hi - lo);
}
export function practise(s: Skill, xp: number) {
  const before = level(s);
  skillXp[s] += xp;
  const after = level(s);
  if (after > before) toast(`${SKILL_NAMES[s]} is now level ${after}`, 'Practice pays off.');
}

export const clamp100 = (v: number) => Math.max(0, Math.min(100, v));
export function addEnergy(d: number) {
  stats.energy = clamp100(stats.energy + d);
}
export function addMood(d: number) {
  stats.mood = clamp100(stats.mood + d);
}
export function earn(n: number) {
  stats.money += n;
}
export function canAfford(n: number) {
  return stats.money >= n;
}
export function spend(n: number) {
  if (stats.money < n) return false;
  stats.money -= n;
  return true;
}

/* ================= bag ================= */

/** Item id → count, and for home cooking the best quality made (1–5 stars). */
export const bag = new Map<string, { qty: number; q: number }>();
export function add(id: string, n = 1, q = 0) {
  const e = bag.get(id) ?? { qty: 0, q: 0 };
  e.qty += n;
  e.q = Math.max(e.q, q);
  bag.set(id, e);
}
export function count(id: string) {
  return bag.get(id)?.qty ?? 0;
}
export function take(id: string, n = 1) {
  const e = bag.get(id);
  if (!e || e.qty < n) return false;
  e.qty -= n;
  if (e.qty === 0) bag.delete(id);
  return true;
}
/** Bag contents in catalogue order. */
export function contents() {
  return ITEMS.filter(i => bag.has(i.id)).map(i => ({ item: i, ...bag.get(i.id)! }));
}

/** Eat or drink something (from the bag, or bought on the spot). Home cooking is better the better it's made. */
export function consume(id: string, q = 0) {
  const it = item(id);
  if (!it.eat) return false;
  const bonus = it.cat === 'dish' ? Math.max(0, q - 2) * 2 : 0;
  addEnergy(it.eat.energy + bonus);
  addMood(it.eat.mood + bonus);
  return true;
}

/* ================= per-frame upkeep ================= */

let lastT = -1;
let jog = { dist: 0, idle: 0, start: 0 };
let tiredWarned = false;
let lx = 0,
  lz = 0;

/** Energy and mood drift, running costs, jogging and movement limits. Call every frame while in the world. */
export function updateStats(dt: number) {
  const t = S.time;
  const dm = lastT < 0 || t < lastT || t - lastT > 30 ? 0 : t - lastT;
  lastT = t;
  // Being awake tires you a little; mood drifts back toward neutral.
  addEnergy(-dm * (1.2 / 60));
  addMood(((50 - stats.mood) / 50) * dm * (1 / 60));

  const moved = Math.hypot(player.x - lx, player.z - lz);
  lx = player.x;
  lz = player.z;
  const fit = level('fitness');
  if (moved < 3) {
    if (player.running) {
      addEnergy(-(moved / 100) * 0.9 * (1 - (fit - 1) * 0.06));
      jog.dist += moved;
      jog.idle = 0;
      if (jog.start === 0) jog.start = t;
    } else if (jog.dist > 0) {
      jog.idle += dt;
      if (jog.idle > 4) endJog();
    }
  }
  // Fitness makes running faster and cheaper; exhaustion stops it altogether.
  player.runSpeed = 6 + (fit - 1) * 0.08;
  player.canRun = stats.energy > 12;
  player.walkSpeed = stats.energy <= 0 ? 2.6 : 3.5;
  if (stats.energy <= 12 && !tiredWarned) {
    tiredWarned = true;
    toast('Raka is exhausted', 'No more running today. Eat something, drink a kopi, or head home to rest.');
  }
  if (stats.energy > 25) tiredWarned = false;
}

function endJog() {
  const km = jog.dist / 1000;
  if (jog.dist >= 200) {
    const h = (jog.start / 60) % 24;
    const morning = h >= 5.5 && h < 9.5;
    practise('fitness', Math.round(jog.dist / 40));
    addMood(morning ? 5 : 2);
    toast(
      `${morning ? 'Morning jog' : 'Jog'}: ${km.toFixed(1)} km`,
      morning ? 'The kampung is waking up with you. Fitness up, mood up.' : 'Fitness up.',
    );
  }
  jog = { dist: 0, idle: 0, start: 0 };
}

/** Sleep from now until 06:00: energy comes back with the hours slept. */
export function sleepRestore(fromTime: number) {
  const hours = Math.max(0, (30 * 60 - fromTime) / 60);
  addEnergy(Math.min(100, hours * 14));
  addMood(hours >= 7 ? 6 : hours < 4 ? -6 : 0);
}
