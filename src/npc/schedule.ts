/* Schedule authoring helpers. A day is written as a list of steps
   [start time, location, activity]; each block lasts until the next step. */
import type { Activity, LocationId, ScheduleBlock, WeekSchedule } from './types';

export const DAY_START = 6 * 60;
export const DAY_END = 26 * 60;

/** 'HH:MM' → game-minutes since midnight (hours may exceed 23). */
export const hm = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

export type Step = [time: string, location: LocationId, activity: Activity];

/** Turn steps into contiguous blocks covering 06:00–26:00. Before the first step the NPC is asleep at home. */
export function day(steps: Step[]): ScheduleBlock[] {
  const out: ScheduleBlock[] = [];
  const first = hm(steps[0][0]);
  if (first > DAY_START) out.push({ start: DAY_START, end: first, location: 'home.inside', activity: 'sleep' });
  steps.forEach(([t, location, activity], i) => {
    const end = i + 1 < steps.length ? hm(steps[i + 1][0]) : DAY_END;
    out.push({ start: Math.max(DAY_START, hm(t)), end, location, activity });
  });
  return out.filter(b => b.end > b.start);
}

/** Replace whatever happens between start and end with one block. */
export function overlay(blocks: ScheduleBlock[], from: string, to: string, location: LocationId, activity: Activity) {
  const s = hm(from),
    e = hm(to);
  const out: ScheduleBlock[] = [];
  for (const b of blocks) {
    if (b.end <= s || b.start >= e) out.push(b);
    else {
      if (b.start < s) out.push({ ...b, end: s });
      if (b.end > e) out.push({ ...b, start: e });
    }
  }
  out.push({ start: s, end: e, location, activity });
  return out.sort((a, b) => a.start - b.start);
}

export interface WeekSpec {
  weekday: Step[];
  fri?: Step[];
  sat?: Step[];
  /** Falls back to `sat`, then `weekday`. */
  sun?: Step[];
  /** Goes to the musholla for Jumatan on Fridays. */
  jumatan?: boolean;
  /** Days of week (0 = Minggu) on which they take the pos ronda night watch. */
  ronda?: number[];
}

/** Build the 7-day schedule, index 0 = Minggu. */
export function week(w: WeekSpec): WeekSchedule {
  const out: WeekSchedule = [];
  for (let dow = 0; dow < 7; dow++) {
    const steps =
      dow === 0
        ? (w.sun ?? w.sat ?? w.weekday)
        : dow === 6
          ? (w.sat ?? w.weekday)
          : dow === 5
            ? (w.fri ?? w.weekday)
            : w.weekday;
    let blocks = day(steps);
    if (dow === 5 && w.jumatan) blocks = overlay(blocks, '11:40', '12:40', 'musholla.inside', 'pray');
    if (w.ronda?.includes(dow)) blocks = overlay(blocks, '22:00', '26:00', 'ronda.seat', 'ronda');
    out.push(blocks);
  }
  return out;
}

/** Index of the block containing game-minute t (clamped to the day). */
export function blockIndexAt(blocks: ScheduleBlock[], t: number) {
  for (let i = blocks.length - 1; i >= 0; i--) if (t >= blocks[i].start) return i;
  return 0;
}
