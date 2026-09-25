/* Where things stand inside Raka's house, in the house's local frame (metres;
   +z toward the front door, x across; see world/houses.ts). Shared by the
   builder (interiors/raka.ts), the things you use (interiors/rakahome.ts) and
   the NPC seats (npc/places.ts), so they always agree. Pure data: no imports. */

/** Inner face of the outer walls. */
export const IX = 3.38,
  IZ = 2.98;
/** Floor top and ceiling. */
export const FL = 0.13,
  CE = 2.95;
/** Partitions: the front room ends at z = PZ; the kamar and dapur split at x = PX. */
export const PZ = 0.3,
  PX = -0.2;
/** The kamar mandi in the dapur's back corner. */
export const MX = 2.0,
  MZ = -1.5;
/** Doorways in the partitions (centre x) and into the kamar mandi. */
export const KAMAR_DOOR = -1.9,
  DAPUR_DOOR = 1.1,
  MANDI_DOOR = 2.72;

type P2 = [number, number];

/* Ruang tamu: a compact kursi tamu set against the partition (left of centre), the desk under the right-hand
   window, a bufet with the radio against the right wall, a calendar by the door. The front of the room is left
   clear, so you can walk from the door to the desk. */
export const TABLE = { x: -0.4, z: 1.45, w: 0.8, d: 0.45, h: 0.42 };
/** The wooden bench (Raka's side), back to the partition, facing the front. */
export const BENCH = { x: -0.4, z: 0.65, w: 1.1, d: 0.5, seats: [-0.27, 0.27] as number[] };
/** Two armchairs for guests at the ends of the table, facing each other across it (face: +1 looks toward +x). */
export const CHAIRS: { x: number; z: number; face: 1 | -1; approach: P2 }[] = [
  { x: -1.25, z: 1.45, face: 1, approach: [-1.25, 2.0] },
  { x: 0.45, z: 1.45, face: -1, approach: [0.45, 2.0] },
];
export const SEAT_Y = 0.55;
export const DESK = { x: 2.4, z: 2.65, w: 1.2, d: 0.55, h: 0.76 };
export const DESK_CHAIR = { x: 2.4, z: 2.02, approach: [2.4, 1.45] as P2 };
export const BUFET = { x: 3.13, z: 1.2, w: 0.45, d: 1.1, h: 0.85 };
export const RADIO: [number, number, number] = [3.13, 1.02, 1.55];
export const CALENDAR: [number, number, number] = [-3.36, 1.55, 1.7];
export const GUITAR: P2 = [-3.1, 0.62];
export const LAMP: P2 = [0, 1.55];
/** The leak (until the roof is redone): a stain on the plafon and a bucket under it. */
export const LEAK: P2 = [1.7, 1.0];
export const LEAK_KAMAR: P2 = [-1.0, -2.35];

/* Kamar: a wooden dipan in the back-left corner, a bedside table, the lemari against the partition. */
export const BED = { x0: -IX, x1: -2.18, z0: -IZ, z1: -0.98, h: 0.45 };
/** Lying down: where the head is, and where Raka stands to get in and out. */
export const BED_LIE: P2 = [-2.78, -2.2];
export const BED_SIDE: P2 = [-1.75, -1.75];
export const NIGHTSTAND: P2 = [-1.9, -2.72];
export const LEMARI = { x0: -0.78, x1: -0.2 - 0.05, z0: -2.85, z1: -1.55, h: 1.9 };

/* Dapur: a counter along the back wall (stove, rice cooker, the gas bottle underneath), a small table. */
export const COUNTER = { x0: -0.12, x1: 1.95, z0: -IZ, z1: -2.43, h: 0.8 };
export const STOVE: P2 = [0.9, -2.7];
export const RICE_COOKER: P2 = [1.6, -2.72];
export const COOK_AT: P2 = [0.9, -2.0];
export const DINING = { x: 0.22, z: -0.95, w: 0.7, d: 0.6, h: 0.72 };
export const SHELF: P2 = [0.25, -2.9];

/* Kamar mandi: the bak (tiled water tank) in the corner, a squat toilet, a bucket. */
export const BAK = { x0: 2.62, x1: IX, z0: -IZ, z1: -2.3, h: 0.85 };
export const BATHE_AT: P2 = [2.95, -1.9];
export const KLOSET: P2 = [2.28, -2.55];
