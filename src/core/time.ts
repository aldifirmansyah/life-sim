/* Game clock. Base rate 0.8 game-minutes per real second (24 h ≈ 30 min);
   holding T runs at 60×. While Aldi rides the MRT the clock runs faster
   (`S.clockScale`), so a ride takes about as long in game time as the real
   journey would. At 26:00 Aldi falls asleep and wakes at 06:00. */
import { $ } from './util';
import { S } from './state';
import { player, keys } from './player';
import { toast } from '../ui/hud';
import { dateLabel } from '../game/calendar';

/** Game-minutes per real second. */
export const RATE = 0.8;
/** Holding T: time runs this much faster (game-minutes per real second)… */
export const FAST = 60;
/** …except aboard a train, where the ride (and the city streaming past) can only go so fast. */
export const RIDE_FAST = 6;
/** How much faster than normal the world runs this frame (the rail clock follows it). */
export function timeWarp() {
  if (!keys.has('KeyT')) return 1;
  return player.ride ? RIDE_FAST : FAST / RATE;
}

/** [minute of day, toast title, toast body] */
export const EVENTS: [number, string, string][] = [
  [23 * 60, 'The last trains are running', 'The MRT stops for the night soon after midnight.'],
  [25 * 60 + 30, 'Aldi is getting sleepy', 'At 02:00 Aldi will doze off wherever that is.'],
];

export function advanceTime(dt: number) {
  const scale = RATE * S.clockScale * timeWarp();
  const prev = S.time;
  S.time += dt * scale;
  for (const [m, t, s] of EVENTS) if (prev < m && S.time >= m) toast(t, s);
  if (S.time >= 26 * 60 && !S.sleeping) sleep();
}

/** Where Aldi wakes up (set by the home, once there is one). */
const wake = {
  place: () => {},
  after: () => {},
  text: 'A new day in Singapore.',
};
export function resetWake() {
  Object.assign(wake, { place: () => {}, after: () => {}, text: 'A new day in Singapore.' });
}
export function setWake(place: () => void, after: () => void, text: string) {
  Object.assign(wake, { place, after, text });
}

/** Spend `minutes` doing something (a nap, a long task): the screen fades while the clock moves on. */
export function passTime(minutes: number, text: string, done?: () => void) {
  if (S.sleeping) return;
  S.sleeping = true;
  const f = $('fade');
  f.textContent = text;
  f.classList.add('on');
  setTimeout(() => {
    S.time = Math.min(S.time + minutes, 26 * 60 - 1);
    setTimeout(() => {
      f.classList.remove('on');
      S.sleeping = false;
      done?.();
    }, 400);
  }, 1100);
}

/** A quick fade to black and back (a lift ride): `mid` runs while the screen is dark. */
export function blink(text: string, mid: () => void) {
  if (S.sleeping) return;
  S.sleeping = true;
  const f = $('fade');
  f.textContent = text;
  f.classList.add('on');
  setTimeout(() => {
    mid();
    S.time = Math.min(S.time + 1, 26 * 60 - 1);
    setTimeout(() => {
      f.classList.remove('on');
      S.sleeping = false;
    }, 250);
  }, 700);
}

/** Sleep until 06:00: automatically at 02:00, or from home. */
export function sleep() {
  if (S.sleeping) return;
  S.sleeping = true;
  const f = $('fade');
  f.textContent = 'Zzz…';
  f.classList.add('on');
  setTimeout(() => {
    S.day++;
    S.time = 6 * 60;
    player.vx = player.vz = 0;
    S.seated = false;
    player.eye = 1.7;
    wake.place();
    setTimeout(() => {
      f.classList.remove('on');
      S.sleeping = false;
      toast(`Good morning. ${dateLabel(S.day)}`, wake.text);
      wake.after();
    }, 400);
  }, 1400);
}
