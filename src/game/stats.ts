/* Aldi's wallet and cards, in SGD, and the two everyday stats: energy (spent by
   the hours awake and by work, restored by sleep, rest, meals and kopi) and mood
   (meals, work done well, a good stand-up; missing things lowers it). Skills come
   back with the steps that use them (ported from kampung-v1's game/stats.ts). */
import { $ } from '../core/util';
import { player } from '../core/player';
import { sfx } from '../audio/audio';

export const wallet = {
  money: 500,
  /** A local SIM card (SingaTel): the phone works. */
  sim: false,
  /** An EZ-Lah transit card: the fare gates open. */
  card: false,
};
export const vitals = { energy: 80, mood: 70 };
/** Gifts and takeaways Aldi carries, by item id. */
export const bag: Record<string, number> = {};
/** What the items are called. */
export const ITEM_NAMES: Record<string, string> = {
  kueh: 'Kueh lapis',
  tarts: 'Pineapple tarts',
  puff: 'Curry puffs',
  kopi: 'Kopi (takeaway)',
  bbt: 'Bubble tea',
  indomie: 'Indomie, a box',
  keripik: 'Keripik tempe',
  flowers: 'Flowers',
  tea: 'Oolong tea, a tin',
  bakkwa: 'Bak kwa',
  garland: 'A jasmine garland',
  batik: 'A batik scarf',
  croissant: 'Kaya croissants',
  mooncake: 'Mooncakes',
};
export function addItem(id: string, n = 1) {
  bag[id] = (bag[id] ?? 0) + n;
}
export function takeItem(id: string) {
  if (!bag[id]) return false;
  if (--bag[id] <= 0) delete bag[id];
  return true;
}

export const sgd = (n: number) => `S$${n.toFixed(2)}`;

/** Pay n dollars if there's enough; false (and nothing paid) otherwise. */
export function spend(n: number): boolean {
  if (wallet.money + 1e-9 < n) return false;
  wallet.money = Math.round((wallet.money - n) * 100) / 100;
  sfx('coin');
  showMoney();
  return true;
}
export function earn(n: number) {
  wallet.money = Math.round((wallet.money + n) * 100) / 100;
  sfx('coin');
  showMoney();
}
export function showMoney() {
  $('money').textContent = sgd(wallet.money);
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, v));
export function addEnergy(n: number) {
  vitals.energy = clamp100(vitals.energy + n);
  showVitals();
}
export function addMood(n: number) {
  vitals.mood = clamp100(vitals.mood + n);
  showVitals();
}
/** Tired: work goes slower and Aldi can't run. */
export const tired = () => vitals.energy < 20;

export function showVitals() {
  for (const [id, v] of [
    ['energybar', vitals.energy],
    ['moodbar', vitals.mood],
  ] as const) {
    const el = $(id);
    el.style.width = v + '%';
    el.classList.toggle('low', v < 20);
  }
  player.canRun = !tired();
}

/** Awake, Aldi tires slowly: `minutes` of game time passed (called once a game minute or after a skip). */
export function drain(minutes: number) {
  vitals.energy = clamp100(vitals.energy - minutes * (3.5 / 60));
  vitals.mood = clamp100(vitals.mood + (vitals.energy < 20 ? -2 : 0) * (minutes / 60));
  showVitals();
}

export const saveStats = () => ({ ...wallet, ...vitals, bag: { ...bag } });
export function loadStats(
  d: (Partial<typeof wallet> & Partial<typeof vitals> & { bag?: Record<string, number> }) | undefined,
) {
  for (const k of Object.keys(bag)) delete bag[k];
  if (d) {
    Object.assign(bag, d.bag ?? {});
    wallet.money = d.money ?? wallet.money;
    wallet.sim = d.sim ?? wallet.sim;
    wallet.card = d.card ?? wallet.card;
    vitals.energy = d.energy ?? vitals.energy;
    vitals.mood = d.mood ?? vitals.mood;
  }
  showMoney();
  showVitals();
}
/** A new game: S$500, no cards, rested. */
export function resetStats() {
  Object.assign(wallet, { money: 500, sim: false, card: false });
  Object.assign(vitals, { energy: 80, mood: 70 });
  for (const k of Object.keys(bag)) delete bag[k];
  showMoney();
  showVitals();
}
