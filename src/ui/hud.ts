import { $ } from '../core/util';
import { S } from '../core/state';
import { player } from '../core/player';
import { zoneAt } from '../world/layout';
import { stats } from '../game/stats';
import { rupiah } from '../game/items';
import { dateLabel } from '../game/calendar';
import { sfx, type Sfx } from '../audio/audio';

/** Non-blocking notification; at most three are shown. */
export function toast(title: string, sub?: string, sound: Sfx | null = 'toast') {
  if (sound) sfx(sound);
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<b></b>${sub ? '<span></span>' : ''}`;
  el.querySelector('b')!.textContent = title;
  if (sub) el.querySelector('span')!.textContent = sub;
  $('toasts').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 520);
  }, 4800);
  while ($('toasts').children.length > 3) $('toasts').firstChild!.remove();
}

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
let lastMin = -1;
let vitals = '';
export function updateHUD() {
  const v = `${Math.round(stats.energy)}|${Math.round(stats.mood)}|${stats.money}`;
  if (v !== vitals) {
    vitals = v;
    $('energybar').style.width = `${stats.energy}%`;
    $('energybar').classList.toggle('low', stats.energy <= 15);
    $('moodbar').style.width = `${stats.mood}%`;
    $('money').textContent = rupiah(stats.money);
  }
  const m = Math.floor(S.time);
  if (m !== lastMin) {
    lastMin = m;
    const h = (m / 60) % 24;
    $('time').textContent = `${pad(h)}:${pad(m % 60)}`;
    $('day').textContent = dateLabel(S.day);
    $('daymark').style.left = (h / 24) * 100 + '%';
  }
  const z = S.room || zoneAt(player.x, player.z);
  if (z !== S.lastZone) {
    S.lastZone = z;
    const el = $('locname');
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = z;
      el.style.opacity = '1';
    }, 180);
  }
}
