/* Extras at fixed spots: stallholders, and diners at the hawker centres' tables.
   Stallholders: someone behind every counter (hawker stalls, shop rows, the
   8-Twelve kiosk) that has no named person working it. Places register their
   counters with `addVendor()`; the nearest ones to Aldi (up to VENDOR_SLOTS, within
   45 m) get a slot in the shared crowd after the passers-by. Each counter keeps its
   own look (seeded by its index), stands facing the customers with the hands
   working at the counter, and turns to Aldi when close.
   Diners: every stool at a hawker table can have someone eating, with a plate in
   front; how full the tables are follows the meal times (packed at lunch and
   dinner, a few in between), the same seats for the same half hour. */
import * as THREE from 'three';
import { scene } from '../render/context';
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
  /** A diner: sitting (the seat height), with a plate at (px, pz) on the table; `skip` while Aldi uses it. */
  sit?: number;
  px?: number;
  pz?: number;
  skip?: () => boolean;
  /** Open hours (game hours); outside them nobody is there. */
  open: number;
  close: number;
  /** The crowd slot now showing this counter's vendor, or −1. */
  slot: number;
  id: number;
}
const vendors: Vendor[] = [];
const BASE = NAMED_SLOTS + 40;
const slotOwner: (Vendor | null)[] = Array(VENDOR_SLOTS).fill(null);
const poses: PoseState[] = [];

/** A counter's stallholder: where they stand and which way they face (ry as for people: 0 faces +z). */
export function addVendor(x: number, z: number, ry: number, o: { y?: number; open?: number; close?: number } = {}) {
  vendors.push({ x, z, ry, y: o.y ?? 0, open: o.open ?? 7, close: o.close ?? 23, slot: -1, id: vendors.length });
}
/** A stool at a hawker table: someone may eat here at meal times (a plate at (px, pz) on the table). */
export function addDiner(x: number, z: number, ry: number, sit: number, px: number, pz: number, skip: () => boolean) {
  vendors.push({ x, z, ry, y: 0, open: 7, close: 22, slot: -1, sit, px, pz, skip, id: vendors.length });
}
/** How full the tables are at hour h (0..1). */
function fill(h: number) {
  if (h >= 11.75 && h < 13.75) return 0.7;
  if (h >= 18.25 && h < 20.25) return 0.6;
  if ((h >= 7 && h < 9.5) || (h >= 11.25 && h < 14.5) || (h >= 17.75 && h < 21)) return 0.3;
  return 0.1;
}
/** Plates in front of the diners (one instanced mesh; a plate and the food on it). */
const plates = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.13, 0.11, 0.05, 10),
  new THREE.MeshLambertMaterial({ color: 0xffffff }),
  VENDOR_SLOTS,
);
plates.frustumCulled = false;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4();
for (let i = 0; i < VENDOR_SLOTS; i++) {
  plates.setMatrixAt(i, ZERO);
  plates.setColorAt(i, new THREE.Color(['#e0873a', '#f3eee0', '#d9b25a', '#8a4b2a'][i % 4]));
}
scene.add(plates);

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
          (v.sit === undefined ||
            (!v.skip?.() && rng(hash('diner', v.id, S.day, Math.floor(h * 2))).next() < fill(h))) &&
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
        plates.setMatrixAt(s, ZERO);
        plates.instanceMatrix.needsUpdate = true;
      }
    }
    for (const v of want) {
      if (v.slot >= 0) continue;
      const s = slotOwner.indexOf(null);
      if (s < 0) break;
      slotOwner[s] = v;
      v.slot = s;
      crowd.setAppearance(BASE + s, lookFor(v.id));
      if (v.sit !== undefined) {
        plates.setMatrixAt(s, _m.makeTranslation(v.px!, 0.8, v.pz!));
        plates.instanceMatrix.needsUpdate = true;
      }
      poses[s] = {
        x: v.x,
        z: v.z,
        ry: v.ry,
        seatY: v.sit ?? 0,
        pose: v.sit !== undefined ? 'sit' : 'stand',
        walk: 0,
        phase: 0,
        headYaw: 0,
        gesture: 0,
        reach: 0.6,
        t: v.id * 1.7,
        baseY: v.y,
      };
    }
  }
  for (let s = 0; s < VENDOR_SLOTS; s++) {
    const v = slotOwner[s];
    if (!v) continue;
    const p = poses[s];
    p.t += dt;
    // Hands at the counter, working (or eating, a spoonful now and then); a look at Aldi when close.
    p.reach = v.sit !== undefined ? 0.35 + 0.35 * Math.max(0, Math.sin(p.t * 0.9)) : 0.45 + 0.2 * Math.sin(p.t * 1.3);
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
