/* The HUD: clock, date, where Aldi is, and toasts. */
import { $ } from '../core/util';
import { S } from '../core/state';
import { player } from '../core/player';
import { dateLabel } from '../game/calendar';
import { sfx, type Sfx } from '../audio/audio';
import { placeName, regionAt, townAt } from '../city/geo';
import { rideLabel, stationAt } from '../city/trains';

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
let lastEyebrow = '';
/** Where Aldi is, in words: aboard a train, on a platform, in a room, or a place on the island. */
export function whereLabel() {
  const r = rideLabel();
  if (r) return r;
  const st = stationAt(player.x, player.z, player.y);
  if (st) return `${st.st.name} MRT`;
  return S.room || placeName(player.x, player.z);
}
export function updateHUD() {
  const m = Math.floor(S.time);
  if (m !== lastMin) {
    lastMin = m;
    const h = (m / 60) % 24;
    $('time').textContent = `${pad(h)}:${pad(m % 60)}`;
    $('day').textContent = dateLabel(S.day);
    $('daymark').style.left = (h / 24) * 100 + '%';
  }
  const z = whereLabel();
  if (z !== S.lastZone) {
    S.lastZone = z;
    const el = $('locname');
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = z;
      el.style.opacity = '1';
    }, 180);
  }
  const t = townAt(player.x, player.z);
  const eb = `Singapore · ${t ? t.region : regionAt(player.x, player.z)}`;
  if (eb !== lastEyebrow) {
    lastEyebrow = eb;
    $('eyebrow').textContent = eb;
  }
}
