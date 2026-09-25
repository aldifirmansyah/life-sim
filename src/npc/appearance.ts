/* Character generator: rolls AppearanceParams from age and gender, with
   per-character overrides. Uses its own RNG so the world layout is untouched. */
import type { AppearanceParams } from './types';

const SKIN = ['#7a4b30', '#8d5a3b', '#9c6644', '#a8704a', '#b67d55', '#c58b62'];
const HAIR = ['#1b1614', '#221a16', '#2e241e', '#3a2a20'];
const GREY = ['#bdb6ab', '#a39c92', '#d6d0c6'];
const TOPS = [
  '#d8392a',
  '#2f6fb3',
  '#3a9a73',
  '#f2c14e',
  '#e8e4da',
  '#8e44ad',
  '#e07a1f',
  '#2c3e50',
  '#c9493a',
  '#6fa8dc',
  '#f4f1ea',
  '#7b8b3a',
];
const BOTTOMS = ['#2c3e50', '#3b3a36', '#4a5a6a', '#6b5a45', '#1f2a36', '#5d6b4a'];
const SKIRTS = ['#6b3f5a', '#2f5d8a', '#7a4a2a', '#3a6b5a', '#8a3b2e', '#4a3f6b'];
const HIJAB = ['#e8c9bd', '#c9d6cf', '#2f5d8a', '#8a3b2e', '#f0d9b5', '#6b3f5a', '#3a9a73', '#d6d9dc', '#1f2a36'];

export interface AppearanceSeed {
  age: number;
  gender: 'm' | 'f';
  /** Anything given here wins over the rolled value. */
  set?: Partial<AppearanceParams>;
  /** Chance a woman wears a hijab (default 0.7). */
  hijab?: number;
  /** Skin tones to pick from (default: the Indonesian range). */
  skins?: readonly string[];
}
/** Singapore's mix: lighter tones through darker ones. */
export const SG_SKINS = ['#e8c4a0', '#dcb08a', '#d4a57c', '#c58b62', '#b67d55', '#9c6644', '#7a4b30', '#6a4028'];

export function generateAppearance(
  { age, gender, set = {}, hijab: hijabChance = 0.7, skins = SKIN }: AppearanceSeed,
  rnd: () => number,
): AppearanceParams {
  const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const range = (a: number, b: number) => a + (b - a) * rnd();
  const child = age < 13;
  const height = child
    ? 0.75 + age * 0.06 + range(-0.04, 0.04)
    : age < 17
      ? (gender === 'm' ? 1.55 : 1.5) + range(-0.04, 0.06)
      : (gender === 'm' ? 1.66 : 1.53) + range(-0.06, 0.07) - (age > 65 ? 0.04 : 0);
  const build = child ? 1 : range(0.9, 1.12) + (age > 40 ? 0.06 : 0);
  let hair: AppearanceParams['hair'];
  if (gender === 'f')
    hair = child ? pick(['long', 'bun'] as const) : age >= 16 && rnd() < hijabChance ? 'hijab' : pick(['long', 'bun'] as const);
  else
    hair = child
      ? 'short'
      : age > 60 && rnd() < 0.5
        ? 'peci'
        : rnd() < 0.15
          ? 'cap'
          : age > 50 && rnd() < 0.25
            ? 'bald'
            : 'short';
  const hijab = hair === 'hijab';
  const out: AppearanceParams = {
    height,
    build,
    skin: pick(skins),
    hair,
    hairColor: age > 58 ? pick(GREY) : pick(HAIR),
    top: pick(TOPS),
    longSleeves: hijab || (age > 55 && rnd() < 0.5),
    bottom: pick(BOTTOMS),
    skirt: gender === 'f' && !child && (hijab || rnd() < 0.4),
    headwear:
      hair === 'peci' ? '#1d1d1f' : hair === 'cap' ? pick(['#d8392a', '#2f6fb3', '#222326', '#e8e4da']) : pick(HIJAB),
    child,
    ...set,
  };
  // Keep overrides consistent: a hijab comes with long sleeves and a long skirt unless stated otherwise.
  if (out.hair === 'hijab') {
    if (set.longSleeves === undefined) out.longSleeves = true;
    if (set.skirt === undefined) out.skirt = true;
  }
  if (out.hair === 'peci' && set.headwear === undefined) out.headwear = '#1d1d1f';
  if (out.skirt && set.bottom === undefined) out.bottom = pick(SKIRTS);
  return out;
}
