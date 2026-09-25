/* Prop sets: groups of extra geometry that come and go (17 Agustus decorations,
   the festival stage, story-arc changes to the kampung, Raka's restored house).
   Each set has its own small instanced batches, built once at start-up and then
   only shown or hidden, so a set costs a few draw calls while visible and none
   while hidden. Colliders in a set are switched with it. */
import * as THREE from 'three';
import { scene } from './context';
import { Batch, mat, prismGeo } from './batch';
import { addCol, type Collider } from '../core/collision';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const CONE = new THREE.ConeGeometry(1, 1, 8);
const lam = (flat = false, double = false) =>
  new THREE.MeshLambertMaterial({
    color: 0xffffff,
    flatShading: flat,
    side: double ? THREE.DoubleSide : THREE.FrontSide,
  });
export const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

export class PropSet {
  group = new THREE.Group();
  solid = new Batch(BOX, lam(), { parent: this.group });
  cyl = new Batch(CYL, lam(), { parent: this.group });
  cone = new Batch(CONE, lam(true), { parent: this.group });
  /** Cloth, banners and flags: seen from both sides, no shadows. */
  cloth = new Batch(BOX, lam(false, true), { parent: this.group, cast: false });
  /** Gable roofs (the unit prism). */
  roof = new Batch(prismGeo(), lam(), { parent: this.group });
  /** Lights that glow at night (unlit colour). */
  glow = new Batch(new THREE.SphereGeometry(1, 8, 6), glowMat, { parent: this.group, cast: false, receive: false });
  cols: Collider[] = [];
  private built = false;
  constructor(public name: string) {
    this.group.name = name;
    this.group.visible = false;
    scene.add(this.group);
  }
  /** Box from world extents. */
  box(
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    c: string,
    o: { ry?: number; col?: boolean; b?: Batch } = {},
  ) {
    (o.b ?? this.solid).add(mat((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, o.ry ?? 0), c);
    if (o.col) {
      const c = addCol(x0, x1, z0, z1);
      c.on = false;
      this.cols.push(c);
    }
  }
  /** Box by centre and size, rotated about y. */
  put(x: number, y: number, z: number, sx: number, sy: number, sz: number, c: string, ry = 0, b?: Batch) {
    (b ?? this.solid).add(mat(x, y, z, sx, sy, sz, ry), c);
  }
  post(x: number, z: number, y0: number, y1: number, r: number, c: string, col = false) {
    this.cyl.add(mat(x, (y0 + y1) / 2, z, r, y1 - y0, r), c);
    if (col) {
      const k = addCol(x - r, x + r, z - r, z + r);
      k.on = false;
      this.cols.push(k);
    }
  }
  light(x: number, y: number, z: number, r: number, c: string) {
    this.glow.add(mat(x, y, z, r, r, r), c);
  }
  build() {
    if (this.built) return;
    this.built = true;
    for (const b of [this.solid, this.cyl, this.cone, this.cloth, this.roof, this.glow]) b.build();
  }
  get visible() {
    return this.group.visible;
  }
  show(on: boolean) {
    if (this.group.visible === on) return;
    this.group.visible = on;
    for (const c of this.cols) c.on = on;
  }
}
