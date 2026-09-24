/* Shared helpers. `R` is the seeded RNG that lays out the kampung: every world
   builder must draw from it in the same order as the prototype, or the layout
   changes. `Math.random` is only used for cosmetic noise (textures, stars). */

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
export const R = mulberry32(20260924);
export const rand = (a: number, b: number) => a + (b - a) * R();
export const pick = <T>(a: readonly T[]): T => a[Math.floor(R() * a.length)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const TOUCH = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
