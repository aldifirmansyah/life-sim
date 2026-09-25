/* Customers who come into Warung Bu Sri while Raka helps out (the warung
   shift): they walk in from the gang, stand at the counter until they've been
   served, and walk out again. Like the pasar stall-keepers they aren't
   residents; they use two spare slots in the residents' Crowd renderer and get
   a new face each time. */
import { player } from '../core/player';
import { circles } from '../core/collision';
import { generateAppearance } from './appearance';
import type { Crowd, PoseState } from './characters';

type P2 = [number, number];
/** From the gang, in through the entrance. */
const WAY_IN: P2[] = [
  [7.2, -7.6],
  [6.55, -5.3],
  [6.55, -4.3],
];
const SPEED = 1.25;

interface Shopper {
  i: number;
  state: 'off' | 'in' | 'wait' | 'out';
  path: P2[];
  x: number;
  z: number;
  ry: number;
  phase: number;
  reach: number;
  onArrive?: () => void;
}
export const shoppers: Shopper[] = [];
export const SHOPPER_SLOTS = 2;
let crowd: Crowd | null = null;
const rnd = Math.random;

export function initShoppers(c: Crowd, base: number) {
  crowd = c;
  for (let k = 0; k < SHOPPER_SLOTS; k++) {
    shoppers.push({ i: base + k, state: 'off', path: [], x: 0, z: 0, ry: 0, phase: 0, reach: 0 });
    c.hide(base + k);
  }
}

/** Someone new walks in to stand at `spot`; `onArrive` when they get there. */
export function sendShopper(k: number, spot: P2, face: number, onArrive: () => void) {
  const s = shoppers[k];
  const woman = rnd() < 0.6;
  crowd!.setAppearance(s.i, generateAppearance({ age: 14 + Math.floor(rnd() * 55), gender: woman ? 'f' : 'm' }, rnd));
  s.state = 'in';
  s.path = [...WAY_IN.slice(1), spot];
  [s.x, s.z] = WAY_IN[0];
  s.ry = face;
  s.onArrive = () => {
    s.ry = face;
    onArrive();
  };
}
/** Served (or tired of waiting): back out to the gang. */
export function sendAway(k: number) {
  const s = shoppers[k];
  if (s.state === 'off') return;
  s.state = 'out';
  s.path = [...WAY_IN].reverse();
}
export function clearShoppers() {
  for (const s of shoppers) {
    s.state = 'off';
    crowd?.hide(s.i);
  }
}
export const shopperHead = (k: number): [number, number, number] => [shoppers[k].x, 1.75, shoppers[k].z];
/** Hand something over: arms forward for a moment. */
export const shopperTake = (k: number) => (shoppers[k].reach = 1);

const pst: PoseState = {
  x: 0,
  z: 0,
  ry: 0,
  seatY: 0,
  pose: 'stand',
  walk: 0,
  phase: 0,
  headYaw: 0,
  gesture: 0,
  reach: 0,
  t: 0,
};

/** Every frame (real time: the shift runs on the wall clock). */
export function updateShoppers(dt: number) {
  if (!crowd) return;
  for (const s of shoppers) {
    if (s.state === 'off') continue;
    let walking = false;
    if (s.state !== 'wait' && s.path.length) {
      const [tx, tz] = s.path[0];
      const dx = tx - s.x,
        dz = tz - s.z,
        d = Math.hypot(dx, dz);
      const step = SPEED * dt;
      walking = true;
      s.ry = Math.atan2(dx, dz);
      if (d <= step) {
        s.x = tx;
        s.z = tz;
        s.path.shift();
        if (!s.path.length) {
          if (s.state === 'in') {
            s.state = 'wait';
            s.onArrive?.();
          } else {
            s.state = 'off';
            crowd.hide(s.i);
            continue;
          }
        }
      } else {
        s.x += (dx / d) * step;
        s.z += (dz / d) * step;
      }
    }
    s.phase += walking ? dt * 7 : 0;
    s.reach = Math.max(0, s.reach - dt * 0.8);
    if (Math.hypot(player.x - s.x, player.z - s.z) < 1.6) circles.push({ x: s.x, z: s.z, r: 0.28 });
    pst.x = s.x;
    pst.z = s.z;
    pst.ry = s.ry;
    pst.walk = walking ? 1 : 0;
    pst.phase = s.phase;
    pst.reach = s.reach;
    pst.t = performance.now() / 1000;
    // Waiting at the counter, they watch Raka.
    let head = 0;
    if (s.state === 'wait') {
      const a = Math.atan2(player.x - s.x, player.z - s.z) - s.ry;
      head = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a), Math.cos(a))));
    }
    pst.headYaw = head;
    crowd.pose(s.i, pst);
  }
}
