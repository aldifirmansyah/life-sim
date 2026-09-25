/* Where things stand in the musholla and the balai warga (world coordinates),
   shared by the builders and the NPC places. Pure data. */
type P2 = [number, number];

/** Musholla Al-Ikhlas: the prayer hall faces the qibla (west, −x); the mihrab is in the west wall and the way
    in is the door in the south wall, by the wudhu taps. */
export const MU = {
  x0: 5.15,
  x1: 13.45,
  z0: -20.85,
  z1: -13.15,
  fl: 0.06,
  ce: 3.1,
  /** South-wall door (hinged, opens inward), and the point just inside it. */
  door: { x: 10.3, z: -13.0 },
  hub: [10.3, -13.7] as P2,
  /** Just outside the door, on the way from the jalan. */
  yard: [10.3, -12.4] as P2,
  mihrab: { z0: -17.5, z1: -16.5 },
  /** The imam's place, the rows (shaf) behind him, and the women's rows behind the partition. */
  imam: [5.9, -17] as P2,
  rows: [6.9, 7.8],
  rowZ: [-19.4, -18.6, -17.8, -17.0, -16.2, -15.4, -14.6],
  partition: 11.9,
  womenRow: 12.7,
  /** The pengajian circle: Ustadz Hasan at the west side facing east, everyone round him. */
  circle: { x: 8.9, z: -17, r: 1.5 },
  /** The wudhu taps, outside on the south face of the wudhu block, and where Raka stands to use them. */
  taps: [12.1, -11.62] as P2,
  wudhuAt: [12.1, -11.15] as P2,
  lamp: [9.3, 2.8, -17] as [number, number, number],
};

/** Balai warga: an open pavilion (floor at 0.15). Pak RT's desk in the middle, chairs facing it. */
export const BA = {
  x0: -19.45,
  x1: -6.55,
  z0: -30.4,
  z1: -23.0,
  fl: 0.15,
  desk: { x0: -15, x1: -11, z0: -26.8, z1: -25.8 },
  rtSeat: [-13, -25.25] as P2,
  chairsZ: [-27.6, -28.6],
  chairsX: [-16.4, -15.4, -14.4, -11.6, -10.6, -9.6],
  whiteboard: [-8.0, -24.3] as P2,
  lamp: [-13, 3.0, -26.5] as [number, number, number],
};
