/* A shop's rolling shutter (the warung, the warkop): slats that roll up into a
   drum over the entrance while the place is open or Raka is inside, and a
   collider while it's down. Its own small mesh, so it's there from any distance
   at night. The entrance runs along x at a given z. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { addCol, type Collider } from '../core/collision';
import { player } from '../core/player';
import { sfx } from '../audio/audio';

export class Shutter {
  open = 1;
  col: Collider;
  mesh: THREE.Mesh;
  constructor(
    private x0: number,
    private x1: number,
    /** The outside face of the wall, and which way is out (−1: toward −z). */
    private z: number,
    private out: 1 | -1,
    private h: number,
    private isOpen: () => boolean,
    private inside: () => boolean,
    color = '#a9aeb1',
  ) {
    const t = 0.12;
    this.col = addCol(x0, x1, Math.min(z, z - out * t), Math.max(z, z - out * t));
    this.col.on = false;
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color }));
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    const drum = new THREE.Mesh(
      new THREE.BoxGeometry(x1 - x0 + 0.1, 0.24, 0.2),
      new THREE.MeshLambertMaterial({ color: '#8b9296' }),
    );
    drum.position.set((x0 + x1) / 2, h + 0.14, z + out * 0.06);
    scene.add(this.mesh, drum);
  }
  update(dt: number) {
    const want = this.isOpen() || this.inside() ? 1 : 0;
    const cx = (this.x0 + this.x1) / 2;
    if (this.open === 1 - want && Math.hypot(player.x - cx, player.z - this.z) < 25)
      sfx(want ? 'doorOpen' : 'doorClose');
    this.open += Math.sign(want - this.open) * Math.min(Math.abs(want - this.open), dt * 0.8);
    this.col.on = this.open < 0.6;
    // The slats roll up into the drum over the entrance.
    const h = this.h * (1 - this.open) + 0.02;
    this.mesh.position.set(cx, this.h + 0.02 - h / 2, this.z + this.out * 0.04);
    this.mesh.scale.set(this.x1 - this.x0, h, 0.03);
  }
}
