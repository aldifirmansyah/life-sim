/* Shared helpers. World generation never uses a global RNG: each region and
   chunk makes its own `mulberry32(seed)` from `hash()`, so the city is the same
   whatever order it is built in. `Math.random` is only for cosmetic noise. */

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A 32-bit hash of integers (and strings), for seeds. */
export function hash(...v: (number | string)[]): number {
  let h = 2166136261;
  for (const x of v) {
    const s = typeof x === 'number' ? String(Math.round(x * 1000)) : x;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    h = Math.imul(h ^ 0x2c, 16777619);
  }
  return h >>> 0;
}
/** A seeded RNG with helpers. */
export function rng(seed: number) {
  const f = mulberry32(seed);
  return {
    next: f,
    range: (a: number, b: number) => a + (b - a) * f(),
    int: (a: number, b: number) => a + Math.floor(f() * (b - a + 1)),
    pick: <T>(a: readonly T[]): T => a[Math.floor(f() * a.length)],
    chance: (p: number) => f() < p,
  };
}
export type Rng = ReturnType<typeof rng>;
/** Map a local point of a building's frame to world x, z. */
export type Frame = (lx: number, lz: number) => [number, number];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const TOUCH = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
