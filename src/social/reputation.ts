/* Reputation (spec §8.4): a kampung-wide score, 0–100. It rises with helping out
   and turning up to community events, and falls with broken promises and bad
   manners. It colours strangers' first impressions and how readily people say
   yes. Starts low: Raka is the new face on Gang Mawar. */
import { toast } from '../ui/hud';

export const rep = { value: 10, log: [] as { day: number; delta: number; why: string }[] };

const TIERS: [number, string, string][] = [
  [0, 'Orang baru', 'The new face on Gang Mawar.'],
  [20, 'Mulai dikenal', 'People know your name.'],
  [40, 'Warga baik', 'A good neighbour. People ask after you.'],
  [60, 'Tetangga teladan', 'The neighbour everyone points to.'],
  [80, 'Kebanggaan RT 04', 'The pride of the RT. Mbah Minah would be proud.'],
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

/** Friendship a stranger starts with on meeting Raka, from what they've heard. */
export const firstImpression = () => Math.floor(rep.value / 20);
/** Added to the chance people accept invitations and call out. */
export const goodwill = () => rep.value / 400;

/* ================= save ================= */

export const saveRep = () => ({ value: rep.value, log: rep.log });
export function loadRep(d: ReturnType<typeof saveRep>) {
  rep.value = d.value;
  rep.log = d.log;
}
