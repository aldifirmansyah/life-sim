/* One line saying what an activity gave: "Mood +6 · Reputation +2 · Ustadz Hasan ♥ +3".
   Friendship gains are the amounts actually applied (after the daily cap). */
import type { NPC } from '../npc/types';
import { befriend } from '../social/social';

export interface Gains {
  mood?: number;
  energy?: number;
  rep?: number;
  money?: string;
  /** Friendship actually gained per person. */
  friends?: [string, number][];
  /** People who wanted to give more but hit today's cap. */
  capped?: string[];
}

/** Befriend several people and collect what they really gave. */
export function befriendAll(list: NPC[], amount: (n: NPC) => number, day: number, g: Gains) {
  g.friends ??= [];
  g.capped ??= [];
  for (const n of list) {
    const want = amount(n);
    const d = befriend(n, want, day).delta;
    if (d) g.friends.push([n.name, d]);
    else if (want > 0) g.capped.push(n.name);
  }
  return g;
}

const sign = (v: number) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);
export function gainsText(g: Gains) {
  const out: string[] = [];
  if (g.mood) out.push(`Mood ${sign(g.mood)}`);
  if (g.energy) out.push(`Energy ${sign(g.energy)}`);
  if (g.rep) out.push(`Reputation ${sign(g.rep)}`);
  if (g.money) out.push(g.money);
  if (g.friends?.length) out.push(g.friends.map(([n, d]) => `${n} ♥ ${sign(d)}`).join(', '));
  if (g.capped?.length) out.push(`${g.capped.join(', ')}: enough for today`);
  return out.join(' · ');
}
