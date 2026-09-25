/* E targets: things in the world Aldi can use (a shop counter, a bed, a door, the
   waterfall). Each frame the one nearest the centre of view within its reach gets
   the prompt; E runs it. Aimed in 3D: the angle to the thing, allowing for its
   size, has to be within a small cone. */
import { $ } from '../core/util';
import { S, inWorld } from '../core/state';
import { player } from '../core/player';

export interface Interactable {
  x: number;
  y: number;
  z: number;
  /** How far away it can be used from. */
  reach: number;
  /** How big it is (widens the aiming cone up close). */
  size?: number;
  /** The prompt, or null when it can't be used right now. */
  label: () => string | null;
  run: () => void;
}
export const things: Interactable[] = [];
export const register = (i: Interactable) => (things.push(i), i);

let current: Interactable | null = null;
let shown = '';
export function updateInteraction() {
  current = null;
  let best = Infinity;
  if (inWorld() && !player.ride && !S.seated) {
    const ex = player.x,
      ey = player.y + player.eye,
      ez = player.z;
    // Where the camera looks.
    const cp = Math.cos(player.pitch);
    const fx = -Math.sin(player.yaw) * cp,
      fy = Math.sin(player.pitch),
      fz = -Math.cos(player.yaw) * cp;
    for (const t of things) {
      const dx = t.x - ex,
        dy = t.y - ey,
        dz = t.z - ez;
      const d = Math.hypot(dx, dy, dz);
      if (d > t.reach || d < 0.01) continue;
      const cos = (dx * fx + dy * fy + dz * fz) / d;
      const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
      const cone = 0.2 + Math.atan((t.size ?? 0.6) / d);
      if (ang > cone || ang >= best) continue;
      if (!t.label()) continue;
      best = ang;
      current = t;
    }
  }
  const text = current?.label() ?? '';
  if (text !== shown) {
    shown = text;
    const p = $('prompt');
    p.hidden = !text;
    p.querySelector('span')!.textContent = text;
  }
}
/** E: use what's in front. Returns true when something was used. */
export function interact() {
  if (!current) return false;
  current.run();
  return true;
}
