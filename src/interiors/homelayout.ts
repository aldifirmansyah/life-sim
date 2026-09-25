/* The front room of a resident's home (interiors/homes.ts), laid out from the
   house's own size and door, in its local frame (x across, +z out of the front
   door). Shared with the NPC places so the host's seat and the furniture agree.
   Pure: no imports but the type. */
import type { House } from '../world/houses';

export const T = 0.12,
  FL = 0.12,
  CE = 2.9;

export function homeLayout(h: House) {
  const ix = h.w / 2 - T,
    iz0 = -h.d / 2 + T,
    iz1 = h.fz - T;
  // The ruang tamu takes the front of the house; the family's rooms are behind a partition.
  const depth = h.d >= 5 ? Math.min(3.4, Math.max(2.8, h.d * 0.55)) : Math.max(2.6, h.d - 1.6);
  const pz = iz1 - depth;
  // The kursi tamu go on the side away from the door.
  const side = h.dx > 0.01 ? -1 : 1;
  const k = Math.min(0.95, ix - 1.05);
  const tx = side * (ix - 0.3 - k);
  return {
    ix,
    iz0,
    iz1,
    pz,
    side,
    /** The coffee table, the family's sofa against the partition (two seats), two guest chairs facing it. */
    table: { x: tx, z: pz + 1.3, w: 0.8, d: 0.45 },
    sofa: { x: tx, z: pz + 0.42, w: 1.3, d: 0.62, seats: [tx - 0.32, tx + 0.32] },
    chairs: [
      [tx - 0.38, pz + 2.15],
      [tx + 0.38, pz + 2.15],
    ] as [number, number][],
    /** Standing up from a guest chair, and just inside the door. */
    chairOut: [tx - side * 0.95, pz + 2.15] as [number, number],
    hub: [h.dx, iz1 - 0.6] as [number, number],
    /** A cabinet on the door side against the partition. */
    cabinet: { x: -side * (ix - 0.65), z: pz + 0.25, w: 1.0, d: 0.4 },
  };
}
