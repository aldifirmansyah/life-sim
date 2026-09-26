/* Stallholders: someone behind every counter (hawker stalls, shop rows, the
   8-Twelve kiosk) that has no named person working it. Places register their
   counters with `addVendor()`; the nearest ones to Aldi (up to VENDOR_SLOTS, within
   45 m) get a slot in the shared crowd after the passers-by. Each counter keeps its
   own look (seeded by its index), stands facing the customers with the hands
   working at the counter, and turns to Aldi when close. */
import { hash, rng } from '../core/util';
import { S } from '../core/state';
import { player } from '../core/player';
import { crowd, NAMED_SLOTS, VENDOR_SLOTS, people } from './people';
import { generateAppearance, SG_SKINS } from './appearance';
import type { PoseState } from './characters';

interface Vendor {
  x: number;
  z: number;
  ry: number;
  y: number;
  /** Open hours (game hours); outside them nobody is there. */
  open: number;
  close: number;
  /** The crowd slot now showing this counter's vendor, or −1. */
  slot: number;
}
const vendors: Vendor[] = [];
const BASE = NAMED_SLOTS + 40;
const slotOwner: (Vendor | null)[] = Array(VENDOR_SLOTS).fill(null);
const poses: PoseState[] = [];

/** A counter's stallholder: where they stand and which way they face (ry as for people: 0 faces +z). */
export function addVendor(x: number, z: number, ry: number, o: { y?: number; open?: number; close?: number } = {}) {
  vendors.push({ x, z, ry, y: o.y ?? 0, open: o.open ?? 7, close: o.close ?? 23, slot: -1 });
}

function lookFor(i: number) {
  const r = rng(hash('vendor', i));
  const a = generateAppearance(
    {
      age: r.int(24, 68),
      gender: r.chance(0.5) ? 'm' : 'f',
      hijab: 0.2,
      skins: SG_SKINS,
      set: { top: r.pick(['#f4f1ea', '#e8e4da', '#d7263d', '#2f6fb3', '#3f7d3a']) },
    },
    r.next,
  );
  if (a.hair === 'peci' && r.chance(0.7)) a.hair = 'short';
  return a;
}

let acc = 1;
export function updateVendors(dt: number) {
  if (!S.started) return;
  acc += dt;
  if (acc > 0.5) {
    acc = 0;
    // Who should be showing: open counters near Aldi without a named person at them.
    const h = (S.time / 60) % 24;
    const want = new Set<Vendor>();
    const near = vendors
      .map(v => ({ v, d: Math.hypot(v.x - player.x, v.z - player.z) }))
      .filter(
        ({ v, d }) =>
          d < 45 &&
          Math.abs(v.y - player.y) < 6 &&
          h >= v.open &&
          h < v.close &&
          !people.some(p => p.at && Math.hypot(p.at.x - v.x, p.at.z - v.z) < 1.6),
      )
      .sort((a, b) => a.d - b.d)
      .slice(0, VENDOR_SLOTS);
    for (const { v } of near) want.add(v);
    // Free the slots of those no longer wanted, then give free slots to the new ones.
    for (let s = 0; s < VENDOR_SLOTS; s++) {
      const v = slotOwner[s];
      if (v && !want.has(v)) {
        v.slot = -1;
        slotOwner[s] = null;
        crowd.hide(BASE + s);
      }
    }
    for (const v of want) {
      if (v.slot >= 0) continue;
      const s = slotOwner.indexOf(null);
      if (s < 0) break;
      slotOwner[s] = v;
      v.slot = s;
      crowd.setAppearance(BASE + s, lookFor(vendors.indexOf(v)));
      poses[s] = {
        x: v.x,
        z: v.z,
        ry: v.ry,
        seatY: 0,
        pose: 'stand',
        walk: 0,
        phase: 0,
        headYaw: 0,
        gesture: 0,
        reach: 0.6,
        t: vendors.indexOf(v) * 1.7,
        baseY: v.y,
      };
    }
  }
  for (let s = 0; s < VENDOR_SLOTS; s++) {
    const v = slotOwner[s];
    if (!v) continue;
    const p = poses[s];
    p.t += dt;
    // Hands at the counter, working; a look at Aldi when close.
    p.reach = 0.45 + 0.2 * Math.sin(p.t * 1.3);
    const dx = player.x - v.x,
      dz = player.z - v.z;
    let hy = 0;
    if (Math.hypot(dx, dz) < 5) {
      hy = Math.atan2(dx, dz) - v.ry;
      while (hy > Math.PI) hy -= Math.PI * 2;
      while (hy < -Math.PI) hy += Math.PI * 2;
      hy = Math.max(-1, Math.min(1, hy));
    }
    p.headYaw += (hy - p.headYaw) * Math.min(1, dt * 4);
    crowd.pose(BASE + s, p);
  }
}
export const vendorDebug = { vendors, slotOwner };
