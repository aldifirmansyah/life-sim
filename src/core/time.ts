/* Game clock. Base rate 1.2 game-minutes per real second (24 h ≈ 20 min);
   holding T runs at 60×. At 26:00 Raka falls asleep and wakes at 06:00. */
import { $ } from './util';
import { S, DAYS } from './state';
import { player, keys } from './player';
import { toast } from '../ui/hud';

/** [minute of day, toast title, toast body] */
export const EVENTS: [number, string, string][] = [
  [9.5 * 60, 'Pasar pagi is packing up', 'The vegetable stalls leave Jalan Sukamaju until tomorrow.'],
  [11 * 60 + 55, 'Adzan Dzuhur', 'Heard from the musholla and the masjid across the kali.'],
  [15 * 60 + 15, 'Adzan Ashar', 'The afternoon heat starts to ease.'],
  [17 * 60 + 55, 'Adzan Maghrib', 'Street lamps flicker on along the gangs.'],
  [19 * 60 + 5, 'Adzan Isya', 'Warkop Berkah fills up for the evening.'],
  [22 * 60, 'The kampung is going quiet', 'The night watch gathers at the pos ronda.'],
  [25 * 60 + 30, 'Raka is getting sleepy', 'He will doze off at 02:00 wherever he is.'],
];

export function advanceTime(dt: number) {
  const scale = keys.has('KeyT') ? 60 : 1.2;
  const prev = S.time;
  S.time += dt * scale;
  for (const [m, t, s] of EVENTS) if (prev < m && S.time >= m) toast(t, s);
  if (S.time >= 26 * 60 && !S.sleeping) sleep();
}

function sleep() {
  S.sleeping = true;
  const f = $('fade');
  f.textContent = 'Zzz…';
  f.classList.add('on');
  setTimeout(() => {
    S.day++;
    S.time = 6 * 60;
    player.x = 16.5;
    player.z = 18.1;
    player.yaw = 0;
    player.pitch = 0;
    player.vx = player.vz = 0;
    setTimeout(() => {
      f.classList.remove('on');
      S.sleeping = false;
      toast(`Selamat pagi. ${DAYS[S.day % 7]}, day ${S.day}`, "Raka wakes up on the teras of his grandmother's house.");
    }, 400);
  }, 1400);
}
