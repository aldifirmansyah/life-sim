/* News about Aldi that travels (v3 step 22): what Aldi did (a good deed in town, a
   sprint review, a missed stand-up) starts with whoever saw or heard it first and
   spreads along the named people's ties when they chat (social/life.ts). People
   who have heard it bring it up when Aldi next greets them, once each. Kept apart
   from the people so any module can report news without importing them. */
import { S } from '../core/state';

export interface News {
  id: number;
  /** A verb phrase about Aldi: "helped an auntie with her trolley". */
  text: string;
  good: boolean;
  day: number;
  /** Who has heard it, and from whom ('' for first-hand). */
  heard: Record<string, string>;
  /** Where it happened, for finding a witness (resolved by life.ts). */
  at?: [number, number];
  /** Who has already mentioned it to Aldi. */
  told: string[];
}
export const news: News[] = [];
let next = 1;

/** Something about Aldi worth talking about. `heard`: who knows first-hand; `at`: a witness near there. */
export function addNews(text: string, good: boolean, heard: string[] = [], at?: [number, number]) {
  const n: News = { id: next++, text, good, day: S.day, heard: {}, at, told: [] };
  for (const id of heard) n.heard[id] = '';
  news.push(n);
  if (news.length > 30) news.shift();
  return n;
}
/** News worth passing on: recent (a week). */
export const fresh = () => news.filter(n => S.day - n.day <= 7);

/** The latest news this person heard and hasn't mentioned to Aldi yet (within five days), marked as told. */
export function newsFor(id: string): { n: News; from: string } | null {
  for (let i = news.length - 1; i >= 0; i--) {
    const n = news[i];
    if (S.day - n.day > 5 || !(id in n.heard) || n.told.includes(id)) continue;
    n.told.push(id);
    return { n, from: n.heard[id] };
  }
  return null;
}

export const saveNews = () => ({ news: JSON.parse(JSON.stringify(news)) as News[], next });
export function loadNews(d: ReturnType<typeof saveNews> | undefined) {
  news.length = 0;
  news.push(...(d?.news ?? []));
  next = d?.next ?? news.reduce((m, n) => Math.max(m, n.id + 1), 1);
}
