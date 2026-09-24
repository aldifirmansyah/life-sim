/* Speech bubbles over NPCs' heads (spec §8.4, §9): pooled HTML elements, only
   for near NPCs in view. Icon bubbles show that two neighbours are chatting;
   text bubbles carry call-outs, greetings and overheard lines. */
import * as THREE from 'three';
import { $ } from '../core/util';
import { camera } from '../render/context';

export interface Bubble {
  /** Head position in world space, updated by the owner every frame. */
  at: () => [number, number, number] | null;
  text: string;
  icon: boolean;
  until: number;
}

const active = new Map<object, Bubble>();
const pool: HTMLDivElement[] = [];
const v = new THREE.Vector3();
const now = () => performance.now() / 1000;

/** Show a bubble for `key` (usually a Resident) for some seconds, replacing any it had. */
export function bubble(key: object, at: Bubble['at'], text: string, seconds: number, icon = false) {
  active.set(key, { at, text, icon, until: now() + seconds });
}
export function clearBubble(key: object) {
  active.delete(key);
}
export function hasBubble(key: object) {
  const b = active.get(key);
  return !!b && b.until > now();
}

export function updateBubbles() {
  const t = now();
  const box = $('bubbles');
  let n = 0;
  for (const [key, b] of active) {
    if (t > b.until) {
      active.delete(key);
      continue;
    }
    const p = b.at();
    if (!p) continue;
    v.set(p[0], p[1] + 0.42, p[2]);
    const dist = v.distanceTo(camera.position);
    if (dist > 22) continue;
    v.project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
    let el = pool[n];
    if (!el) {
      el = pool[n] = document.createElement('div');
      el.className = 'bubble';
      box.appendChild(el);
    }
    el.hidden = false;
    el.classList.toggle('icon', b.icon);
    if (el.textContent !== b.text) el.textContent = b.text;
    // Fade in, and out over the last half second; shrink a little with distance.
    const life = Math.min(1, (b.until - t) / 0.5);
    el.style.opacity = String(Math.max(0, life));
    const s = Math.max(0.7, Math.min(1, 6 / dist));
    el.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -100%) scale(${s})`;
    n++;
  }
  for (let k = n; k < pool.length; k++) pool[k].hidden = true;
}
