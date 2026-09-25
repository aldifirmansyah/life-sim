/* Where things stand inside Warkop Berkah (world coordinates), shared by the
   builder and NPC places. Pure data. */
type P2 = [number, number];
export const WK = {
  /** Inside faces of the walls, floor top, plafon. */
  x0: -11.18,
  x1: -6.32,
  z0: 19.92,
  z1: 24.18,
  fl: 0.05,
  ce: 2.7,
  door: { x0: -8.35, x1: -7.25 },
  /** Just inside the doorway: where trips inside begin and end. */
  hub: [-7.8, 20.4] as P2,
  /** The kopi counter across the back, and where Pak Slamet stands behind it. */
  counter: { x0: -10.7, x1: -8.0, z0: 22.85, z1: 23.35, h: 1.0 },
  owner: [-9.3, 23.75] as P2,
  /** The long table, its benches (north and south) and the three places on each. */
  table: { x0: -10.6, x1: -8.2, z0: 21.2, z1: 21.75, h: 0.75 },
  benchN: 20.93,
  benchS: 22.02,
  seatsN: [-10.2, -9.4, -8.6],
  /** Where Pak Slamet stands to put a cup down at the inside table. */
  serveIn: [-7.9, 21.47] as P2,
  /** The TV on a bracket on the west wall, facing the table. */
  tv: { x: -11.1, y: 2.0, z: 21.5 },
  lamp: [-8.9, 2.45, 21.8] as [number, number, number],
};
