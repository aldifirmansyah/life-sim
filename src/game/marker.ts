/* The marker: a small label with the distance, floating over the next place to
   go (pinned to the screen's edge when it's off-screen or behind). One at a time;
   whoever sets it each frame owns it (the arrival goals, then work). */
import * as THREE from 'three';
import { $ } from '../core/util';
import { S } from '../core/state';
import { player } from '../core/player';
import { camera } from '../render/context';
import { guide } from '../ui/directions';

let want: { label: string; at: [number, number, number] } | null = null;
/** Ask for the marker this frame. */
export function markTo(label: string, at: [number, number, number]) {
  want = { label, at };
}

const _v = new THREE.Vector3();
/** Every frame, after everyone has had their say. */
export function updateMarker(dt: number) {
  const m = $('marker');
  let w = want;
  want = null;
  // The directions turn a far target into the next step of the way (a bus stop, a station, where to get off).
  if (S.started) w = guide(w, dt);
  if (!w || !S.started || S.map || S.paused) {
    m.hidden = true;
    return;
  }
  const t = w.at;
  const p = _v.set(t[0], t[1] + 2, t[2]).project(camera);
  const behind = p.z > 1;
  let sx = (p.x * 0.5 + 0.5) * innerWidth,
    sy = (-p.y * 0.5 + 0.5) * innerHeight;
  if (behind) {
    sx = innerWidth - sx;
    sy = innerHeight - 40;
  }
  sx = Math.max(40, Math.min(innerWidth - 40, sx));
  sy = Math.max(60, Math.min(innerHeight - 40, sy));
  const dist = Math.hypot(t[0] - player.x, t[2] - player.z);
  m.hidden = false;
  m.querySelector('span')!.textContent = `${w.label} · ${Math.round(dist)} m`;
  m.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
}
