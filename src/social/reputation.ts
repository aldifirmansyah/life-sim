/* Reputation: how people round Aldi's places see Aldi, 0–100. It rises with
   helping out and turning up, and falls with bad manners. It colours strangers'
   first impressions. Starts low: Aldi is the new face in town. */
import { toast } from '../ui/hud';

export const rep = { value: 10, log: [] as { day: number; delta: number; why: string }[] };

const TIERS: [number, string, string][] = [
  [0, 'New face', 'Just arrived. Nobody knows Aldi yet.'],
  [20, 'Getting known', 'People know your name.'],
  [40, 'Steady one', 'A good neighbour and colleague. People ask after you.'],
  [60, 'Very shiok person', 'The one everyone points to.'],
  [80, 'Local already', 'Singapore feels like home, and it shows.'],
];
export const tier = (v = rep.value) => {
  let t = TIERS[0];
  for (const x of TIERS) if (v >= x[0]) t = x;
  return { name: t[1], blurb: t[2], floor: t[0], next: TIERS.find(x => x[0] > v)?.[0] ?? 100 };
};

/** Change reputation, with a quiet toast for anything notable. */
export function repute(delta: number, why: string, day: number, quiet = false) {
  if (!delta) return;
  const before = tier().name;
  rep.value = Math.max(0, Math.min(100, rep.value + delta));
  rep.log.push({ day, delta, why });
  if (rep.log.length > 30) rep.log.shift();
  const after = tier().name;
  if (after !== before) toast(`Reputation: ${after}`, tier().blurb);
  else if (!quiet) toast(`Reputation ${delta > 0 ? '+' : ''}${delta}`, why);
}

/** Friendship a stranger starts with on meeting Aldi, from what they've heard. */
export const firstImpression = () => Math.floor(rep.value / 20);
/** Added to the chance people accept invitations and call out. */
export const goodwill = () => rep.value / 400;

/* ================= save ================= */

export const saveRep = () => ({ value: rep.value, log: rep.log });
export function loadRep(d: ReturnType<typeof saveRep>) {
  rep.value = d.value;
  rep.log = d.log;
}
