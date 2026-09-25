/* Day/night: keyframed sky, sun/moon and hemisphere light, window glow,
   street-light pools and pasar pagi visibility. `h` is the hour of day (0–24). */
import * as THREE from 'three';
import { smooth } from '../core/util';
import { SETTINGS } from '../core/settings';
import { player } from '../core/player';
import { scene, fog, camera } from './context';
import { litMat, bulbMat, pasar } from './batch';
import { skyU, sky, starMat, stars, moon, hillMat } from './sky';
import { waterTex, poolMat } from '../world/ground';
import { pasarCols } from '../world/pasar';

export const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 240;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);

/** [hour, sky top, sky horizon, sun colour, sun intensity, hemi sky, hemi ground, hemi intensity] */
type Key = [number, string, string, string, number, string, string, number];
type Frame = [number, THREE.Color, THREE.Color, THREE.Color, number, THREE.Color, THREE.Color, number];
const KF = (
  [
    [0, '#060b1f', '#16223f', '#8ea3e0', 0.5, '#4a5c96', '#2a2630', 0.8],
    [4.9, '#070d24', '#1a2748', '#8ea3e0', 0.5, '#4a5c96', '#2a2630', 0.8],
    [5.7, '#2c3c70', '#e59a78', '#ffb385', 0.5, '#8e92bb', '#4a3f3a', 0.65],
    [6.6, '#5ea4db', '#f5d4ab', '#ffdcae', 2.3, '#bcd8ee', '#6d5c46', 1.1],
    [9, '#3d92de', '#c0e3f5', '#fff5e2', 3.1, '#d0e6f6', '#7c6b52', 1.35],
    [15, '#4798df', '#c9e6f2', '#fff1d8', 3.0, '#d0e4f2', '#7c6b52', 1.3],
    [16.9, '#5a8ecd', '#f5c98c', '#ffc684', 2.6, '#e3d3b9', '#7b5b41', 1.1],
    [17.8, '#47589a', '#f18a58', '#ff8c4c', 1.1, '#b8889a', '#4c3b38', 0.72],
    [18.5, '#1d2652', '#6c4b72', '#8583c0', 0.5, '#55558f', '#2a2430', 0.8],
    [19.4, '#070d24', '#1a2748', '#8ea3e0', 0.5, '#4a5c96', '#2a2630', 0.8],
    [24, '#060b1f', '#16223f', '#8ea3e0', 0.5, '#4a5c96', '#2a2630', 0.8],
  ] as Key[]
).map((k): Frame => [
  k[0],
  new THREE.Color(k[1]),
  new THREE.Color(k[2]),
  new THREE.Color(k[3]),
  k[4],
  new THREE.Color(k[5]),
  new THREE.Color(k[6]),
  k[7],
]);
const tmpC = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
/** Sign materials whose emissive glow follows the window lights. */
export const glowMats: THREE.MeshLambertMaterial[] = [];

function envAt(h: number) {
  let i = 0;
  while (i < KF.length - 2 && KF[i + 1][0] <= h) i++;
  const a = KF[i],
    b = KF[i + 1];
  const t = smooth(0, 1, (h - a[0]) / (b[0] - a[0]));
  return {
    top: tmpC[0].copy(a[1]).lerp(b[1], t),
    hor: tmpC[1].copy(a[2]).lerp(b[2], t),
    sunC: tmpC[2].copy(a[3]).lerp(b[3], t),
    sunI: a[4] + (b[4] - a[4]) * t,
    hs: tmpC[3].copy(a[5]).lerp(b[5], t),
    hg: tmpC[4].copy(a[6]).lerp(b[6], t),
    hi: a[7] + (b[7] - a[7]) * t,
  };
}
const _dir = new THREE.Vector3();
export function updateEnv(h: number) {
  const e = envAt(h);
  skyU.top.value.copy(e.top);
  skyU.hor.value.copy(e.hor);
  fog.color.copy(e.hor);
  hemi.color.copy(e.hs);
  hemi.groundColor.copy(e.hg);
  hemi.intensity = e.hi;
  const day = h >= 5.75 && h < 18.2;
  const a = day ? ((h - 5.75) / 12.45) * Math.PI : (((h - 18.2 + 24) % 24) / 11.55) * Math.PI;
  _dir.set(Math.cos(a), Math.sin(a), -0.38).normalize();
  skyU.sunDir.value.copy(_dir);
  skyU.sunCol.value.copy(e.sunC);
  skyU.sunVis.value = day ? smooth(-0.05, 0.12, Math.sin(a)) : 0;
  const ld = _dir.clone();
  ld.y = Math.max(ld.y, 0.28);
  ld.normalize();
  sun.color.copy(e.sunC);
  sun.intensity = e.sunI;
  sun.position.set(player.x + ld.x * 110, ld.y * 110, player.z + ld.z * 110);
  sun.target.position.set(player.x, 0, player.z);
  sun.castShadow = SETTINGS.quality > 0 && day && Math.sin(a) > 0.06;
  const night = h < 12 ? 1 - smooth(5.7, 6.3, h) : smooth(17.9, 18.5, h);
  const win = h < 12 ? 1 - smooth(5.4, 6.6, h) : smooth(17.2, 18.6, h);
  starMat.opacity = night * 0.9;
  moon.visible = !day;
  moon.material.opacity = night;
  moon.position.set(
    camera.position.x + _dir.x * 380,
    camera.position.y + _dir.y * 380,
    camera.position.z + _dir.z * 380,
  );
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  litMat.color.setRGB(0.17 + 0.83 * win, 0.2 + 0.8 * win, 0.24 + 0.76 * win);
  bulbMat.color.setRGB(0.55 + 0.45 * night, 0.55 + 0.43 * night, 0.5 + 0.3 * night);
  poolMat.color.setRGB(0.7 * night, 0.5 * night, 0.28 * night);
  for (const m of glowMats) m.emissiveIntensity = win * 0.55;
  hillMat.color.copy(e.hor).lerp(e.top, 0.35).multiplyScalar(0.82);
  waterTex.offset.x = (performance.now() * 0.00002) % 1;
  const ps = h >= 5.3 && h < 9.6;
  if (pasar.visible !== ps) {
    pasar.visible = ps;
    pasarCols.forEach(c => (c.on = ps));
  }
  // Rain clouds: a grey sky, soft light, no hard shadows.
  if (overcast > 0) {
    const k = overcast;
    _grey.setRGB(0.5, 0.53, 0.56).multiplyScalar(0.35 + 0.65 * (1 - night));
    skyU.top.value.lerp(_grey, 0.8 * k);
    skyU.hor.value.lerp(_grey, 0.7 * k);
    fog.color.lerp(_grey, 0.7 * k);
    skyU.sunVis.value *= 1 - k;
    sun.intensity *= 1 - 0.75 * k;
    hemi.intensity *= 1 - 0.25 * k;
    if (k > 0.5) sun.castShadow = false;
  }
}

/** 0..1: how overcast it is (set by the weather). */
export let overcast = 0;
export const setOvercast = (v: number) => (overcast = v);
const _grey = new THREE.Color();
