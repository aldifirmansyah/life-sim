/* Pasar pagi stall-keepers: one per stall, sitting on a low stool at the end
   of the stall and facing the jalan. They aren't residents (no schedule, no
   conversation); they exist so the market has someone to buy from, and they
   come and go with the stalls. Drawn with the residents' Crowd renderer. */
import { mulberry32 } from '../core/util';
import { player } from '../core/player';
import { circles } from '../core/collision';
import { pCyl, mat, pasar } from '../render/batch';
import { fog } from '../render/context';
import { pasarCols } from '../world/pasar';
import { generateAppearance } from './appearance';
import type { Crowd, PoseState } from './characters';

interface Vendor {
  /** Crowd slot. */
  i: number;
  x: number;
  z: number;
  ry: number;
  /** Index into pasarCols. */
  stall: number;
  lastPose: number;
}
export const vendors: Vendor[] = [];
let crowd: Crowd | null = null;
const spots: { x: number; z: number; ry: number; stall: number }[] = [];

/** Pick a spot at one end of each stall, clear of the neighbouring stall, and put a stool there. Before the batches are built. */
export function placeVendorStools() {
  pasarCols.forEach((c, k) => {
    const s = c.x0 < 0 ? -1 : 1;
    const xc = (c.x0 + c.x1) / 2;
    const clear = (z: number) =>
      !pasarCols.some((o, j) => j !== k && Math.sign(o.x0) === s && z > o.z0 - 0.45 && z < o.z1 + 0.45);
    const z = clear(c.z0 - 0.45) ? c.z0 - 0.45 : c.z1 + 0.45;
    // Facing across the jalan, toward the customers.
    spots.push({ x: xc, z, ry: s > 0 ? -Math.PI / 2 : Math.PI / 2, stall: k });
    pCyl.add(mat(xc, 0.16, z, 0.17, 0.32, 0.17), '#2f6fb3');
  });
}
export const vendorCount = () => spots.length;

/** Create the stall-keepers in the crowd slots after the residents'. */
export function initVendors(c: Crowd, base: number) {
  crowd = c;
  const rnd = mulberry32(4040);
  spots.forEach((sp, k) => {
    const i = base + k;
    const woman = rnd() < 0.7;
    c.setAppearance(i, generateAppearance({ age: 35 + Math.floor(rnd() * 28), gender: woman ? 'f' : 'm' }, rnd));
    vendors.push({ i, ...sp, lastPose: -1 });
    c.hide(i);
  });
}

/** Where a stall's keeper sits. */
export const vendorSpot = (stall: number): [number, number] | undefined => {
  const v = vendors.find(v => v.stall === stall);
  return v && [v.x, v.z];
};

/** Is someone minding this stall right now? */
export const vendorAt = (stall: number) => pasar.visible && vendors.some(v => v.stall === stall);

const pst: PoseState = {
  x: 0,
  z: 0,
  ry: 0,
  seatY: 0.32,
  pose: 'sit',
  walk: 0,
  phase: 0,
  headYaw: 0,
  gesture: 0,
  reach: 0,
  t: 0,
};
const serving = new Map<number, number>();

/** A stall-keeper hands something over. */
export function serveAt(stall: number, seconds = 1.6) {
  serving.set(stall, performance.now() / 1000 + seconds);
}

/** Every frame: show them while the market is up; animate the near ones, update the rest at 2 Hz. */
export function updateVendors() {
  if (!crowd) return;
  const clock = performance.now() / 1000;
  const renderDist = Math.min(120, fog.far);
  for (const v of vendors) {
    const d = Math.hypot(v.x - player.x, v.z - player.z);
    if (!pasar.visible || d > renderDist) {
      crowd.hide(v.i);
      v.lastPose = -1;
      continue;
    }
    if (d < 1.6) circles.push({ x: v.x, z: v.z, r: 0.3 });
    const near = d < 40;
    if (!near && v.lastPose >= 0 && clock - v.lastPose < 0.5) continue;
    v.lastPose = clock;
    const busy = (serving.get(v.stall) ?? 0) > clock;
    pst.x = v.x;
    pst.z = v.z;
    pst.ry = v.ry;
    pst.t = clock;
    pst.reach = busy ? 0.9 : near ? 0.15 + 0.1 * Math.sin(clock * 0.7 + v.i) : 0.15;
    // Look at Raka when he's at the stall.
    let head = 0;
    if (d < 4) {
      const a = Math.atan2(player.x - v.x, player.z - v.z) - v.ry;
      head = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a), Math.cos(a))));
    }
    pst.headYaw = head;
    crowd.pose(v.i, pst);
  }
}
