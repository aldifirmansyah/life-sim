/* Kampung layout data. Units are metres; +z is south (toward the gapura),
   -z is north (toward the kali and sawah). */
import * as THREE from 'three';
import type { Rect4 } from '../core/collision';

/** East–west gangs (z) and north–south gangs (x); GH is the gang half-width. */
export const GZ = [-32, -8, 16, 38],
  GX = [-30, 30],
  GH = 1.2;
export const GZN = ['Gang Melati', 'Gang Kenanga', 'Gang Mawar', 'Gang Anggrek'],
  GXN = ['Gang Dahlia', 'Gang Cempaka'];
/** Block extents in x and z. */
export const XB: [number, number][] = [
  [-58.5, -31.2],
  [-28.8, -3],
  [3, 28.8],
  [31.2, 58.5],
];
export const ZB: [number, number][] = [
  [-52, -33.2],
  [-30.8, -9.2],
  [-6.8, 14.8],
  [17.2, 36.8],
  [39.2, 58.5],
];
/** Which block sides face a north–south road, per x-band. */
export const FRONT = [['E'], ['W', 'E'], ['W', 'E'], ['W']];
/** Landmark footprints [x0, x1, z0, z1]; house generation keeps out of these. */
export const RESERVED: Record<
  'warung' | 'warkop' | 'musholla' | 'balai' | 'ronda' | 'lapangan' | 'raka' | 'ojek' | 'kebun' | 'gateW',
  Rect4
> = {
  warung: [3, 11.8, -6.8, -0.2],
  warkop: [-11.8, -3, 17.2, 24.6],
  musholla: [3, 14.2, -23.2, -11.2],
  balai: [-21.2, -5.4, -30.8, -21.2],
  ronda: [-8.6, -3, 39.2, 45.2],
  lapangan: [-58.5, -31.2, -6.8, 14.8],
  raka: [12.6, 20.6, 17.2, 26.2],
  ojek: [3, 10.4, 50.6, 58.5],
  kebun: [38.8, 58.5, -52, -43.2],
  gateW: [-5.2, -3, 55.6, 58.5],
};
export const RES = Object.values(RESERVED);

export const WALLS = [
  '#ecdcb0',
  '#a9d6c8',
  '#f2bba6',
  '#c9d9ea',
  '#ebe5d8',
  '#bfd992',
  '#f1c872',
  '#d8c0e1',
  '#8acbc2',
  '#f4e5c6',
  '#eaa9a4',
  '#b6c9a6',
  '#f6d7a8',
];
export const ROOFS = ['#b5553a', '#a8472f', '#c46a45', '#9c4a34', '#b8603f', '#aa5a3c'];
export const DOORS = ['#6b4a2f', '#3d6b5a', '#2f5d8a', '#8a3b2e', '#5a4633', '#e8e4da', '#7b8b3a'];
export const TRIMS = ['#f5f0e6', '#e8e0cc', '#6b4a2f', '#2f6a55', '#2f5d8a'];
export const TERAS = ['#cabba4', '#a86c57', '#d9d3c7', '#909b8c', '#bba07e'];
export const BIKES = ['#c9302c', '#1f5fae', '#222326', '#e8e6e0', '#3a8f4e', '#e07a1f'];
export const CLOTH = ['#e24a3b', '#f2c14e', '#3b7dd8', '#f4f1ea', '#58b368', '#b35ec2', '#ff8d5c', '#2c3e50'];
export const dark = (c: THREE.ColorRepresentation, k = 0.72) =>
  '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

/** Built house footprints (for the map) and front-door anchor points [x, z, height] (for cables). */
export const houseRects: { r: Rect4; c: string }[] = [];
export const houseTops: number[][] = [];

/** Local → world transform for a frame centred at (cx, cz) rotated by th about y. */
export type Frame = (lx: number, lz: number) => [number, number];
export function frame(cx: number, cz: number, th: number): Frame {
  const c = Math.cos(th),
    s = Math.sin(th);
  return (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
}

/** Named areas [name, x0, x1, z0, z1]; the first match wins. Drives the HUD location label. */
export const ZONES: [string, number, number, number, number][] = [
  ['Warung Bu Sri', 1.5, 12, -9.4, 0.3],
  ['Warkop Berkah', -12.2, -2.6, 14.6, 25],
  ['Musholla Al-Ikhlas', 2.6, 14.6, -23.6, -10.8],
  ['Balai Warga', -21.6, -5, -33.4, -21],
  ['Pos Ronda', -9, -2.6, 38.6, 45.6],
  ['Lapangan', -58.5, -31.2, -6.8, 14.8],
  ['Rumah Raka', 12.4, 20.8, 14.8, 26.4],
  ['Pangkalan Ojek', 3, 10.6, 50.4, 58.6],
  ['Gapura', -4.4, 4.4, 56.4, 60.6],
  ['Kebun Warga', 38.6, 58.6, -55.5, -43],
  ['Jembatan', -3.4, 3.4, -60.4, -55.4],
  ['Tepi Kali', -60, 60, -55.5, -52],
  ['Pinggir Sawah', -60, 60, -67, -60.3],
  ['Jalan Sukamaju', -3, 3, -60, 60],
  ...GZ.map((g, i): [string, number, number, number, number] => [GZN[i], -60, 60, g - GH - 0.4, g + GH + 0.4]),
  ...GX.map((g, i): [string, number, number, number, number] => [GXN[i], g - GH - 0.4, g + GH + 0.4, -55, 60]),
];
export function zoneAt(x: number, z: number) {
  for (const zn of ZONES) if (x >= zn[1] && x <= zn[2] && z >= zn[3] && z <= zn[4]) return zn[0];
  return 'Kampung Sukamaju';
}

/** Landmarks labelled on the map. */
export const LANDMARKS: [string, Rect4][] = [
  ['Warung Bu Sri', RESERVED.warung],
  ['Warkop Berkah', RESERVED.warkop],
  ['Musholla', RESERVED.musholla],
  ['Balai Warga', RESERVED.balai],
  ['Pos Ronda', RESERVED.ronda],
  ['Lapangan', RESERVED.lapangan],
  ['Rumah Raka', RESERVED.raka],
  ['Ojek', RESERVED.ojek],
  ['Kebun Warga', RESERVED.kebun],
];
