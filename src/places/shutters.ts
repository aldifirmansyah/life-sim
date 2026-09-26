/* Roller shutters on the shops and hawker stalls, by the hour: down at night,
   rolling up in the morning and down at closing time. All of them are one
   instanced mesh (the slats, scaled by how far down they are); the drum over each
   entrance is part of the place's own prop set. Only those near Aldi animate; the
   rest snap to their state. The entrance runs along x at a given z. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { S } from '../core/state';
import { player } from '../core/player';
import { sfx } from '../audio/audio';

interface Shutter {
  x0: number;
  x1: number;
  z: number;
  /** Which way is out (the shutter sits just outside the opening). */
  out: 1 | -1;
  h: number;
  open: number;
  hours: [number, number];
}
const list: Shutter[] = [];
const MAX = 96;
let mesh: THREE.InstancedMesh | null = null;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m = new THREE.Matrix4(),
  _p = new THREE.Vector3(),
  _q = new THREE.Quaternion(),
  _s = new THREE.Vector3();

/** Open during [open, close) game hours. */
export const isOpenAt = (hours: [number, number], h = (S.time / 60) % 24) => h >= hours[0] && h < hours[1];

export function addShutter(x0: number, x1: number, z: number, out: 1 | -1, h: number, hours: [number, number]) {
  if (list.length >= MAX) return;
  list.push({ x0, x1, z, out, h, open: 1, hours });
}

function put(i: number, s: Shutter) {
  const down = s.h * (1 - s.open);
  if (down < 0.02) return mesh!.setMatrixAt(i, ZERO);
  _p.set((s.x0 + s.x1) / 2, s.h - down / 2, s.z + s.out * 0.05);
  _s.set(s.x1 - s.x0, down, 0.04);
  mesh!.setMatrixAt(i, _m.compose(_p, _q, _s));
}

let snapped = false;
export function updateShutters(dt: number) {
  if (!mesh) {
    mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: '#a9aeb1' }),
      MAX,
    );
    mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = true;
    for (let i = 0; i < MAX; i++) mesh.setMatrixAt(i, ZERO);
    scene.add(mesh);
  }
  let changed = false;
  list.forEach((s, i) => {
    const want = isOpenAt(s.hours) ? 1 : 0;
    if (s.open === want && snapped) return;
    const d = Math.hypot((s.x0 + s.x1) / 2 - player.x, s.z - player.z);
    if (d > 150 || !snapped) s.open = want;
    else {
      if ((s.open === 0 || s.open === 1) && d < 25) sfx(want ? 'doorOpen' : 'doorClose');
      s.open += Math.sign(want - s.open) * Math.min(Math.abs(want - s.open), dt * 0.5);
    }
    put(i, s);
    changed = true;
  });
  snapped = true;
  if (changed) mesh.instanceMatrix.needsUpdate = true;
}
/** For loading a save or a new game: snap every shutter to the hour again. */
export function resnapShutters() {
  snapped = false;
}
