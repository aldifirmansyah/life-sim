/* A real door: a leaf on a hinge that swings inward when Raka opens it (E), with
   a collider while it's shut. It closes itself a few seconds after he's gone
   through. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { addCol, type Collider } from '../core/collision';
import { player } from '../core/player';
import type { Frame } from '../core/util';
import { sfx } from '../audio/audio';
import { circles } from '../core/collision';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const doorMat = new THREE.MeshLambertMaterial({ vertexColors: true });

export class Door {
  pivot = new THREE.Group();
  /** 0 shut … 1 open. */
  open = 0;
  target = 0;
  col: Collider;
  /** Centre of the doorway, world. */
  x: number;
  z: number;
  private idle = 0;
  private baseRy = 0;
  constructor(
    F: Frame,
    th: number,
    dx: number,
    fz: number,
    color: string,
    public locked = () => false,
  ) {
    // Hinged on the left edge (seen from outside), swinging in.
    const [hx, hz] = F(dx - 0.475, fz - 0.06);
    this.pivot.position.set(hx, 0, hz);
    this.pivot.rotation.y = th;
    this.baseRy = th;
    // Leaf, a carved panel on each face and a knob each side, merged into one mesh with vertex colours
    // (one draw call a door).
    const base = new THREE.Color(color);
    const part = (g: THREE.BufferGeometry, x: number, y: number, z: number, c: THREE.Color) => {
      g.translate(x, y, z);
      const n = g.attributes.position.count,
        col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.toArray(col, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    };
    const gold = new THREE.Color('#c9a44a'),
      dark = base.clone().multiplyScalar(0.8);
    const parts = [
      part(new THREE.BoxGeometry(0.95, 2.14, 0.05), 0.475, 1.07, 0, base),
      part(new THREE.BoxGeometry(0.62, 1.5, 0.02), 0.475, 1.12, 0.03, dark),
      part(new THREE.BoxGeometry(0.62, 1.5, 0.02), 0.475, 1.12, -0.03, dark),
      part(new THREE.SphereGeometry(0.035, 8, 6), 0.85, 1.0, 0.05, gold),
      part(new THREE.SphereGeometry(0.035, 8, 6), 0.85, 1.0, -0.05, gold),
    ];
    const leaf = new THREE.Mesh(mergeGeometries(parts), doorMat);
    parts.forEach(g => g.dispose());
    leaf.castShadow = leaf.receiveShadow = true;
    this.pivot.add(leaf);
    scene.add(this.pivot);
    [this.x, this.z] = F(dx, fz - 0.06);
    const a = F(dx - 0.5, fz - 0.12),
      b = F(dx + 0.5, fz);
    this.col = addCol(a[0], b[0], a[1], b[1]);
  }
  toggle() {
    // Not shut on Raka while he's standing in the doorway.
    if (this.target > 0.5 && Math.hypot(player.x - this.x, player.z - this.z) < 0.55) return;
    this.target = this.target > 0.5 ? 0 : 1;
    sfx(this.target ? 'doorOpen' : 'doorClose');
  }
  update(dt: number) {
    const k = Math.min(1, dt * 3.2);
    this.open += (this.target - this.open) * k;
    if (Math.abs(this.target - this.open) < 0.002) this.open = this.target;
    // Swings inward (toward local −z), about 95°.
    this.pivot.rotation.y = this.baseRy + this.open * 1.66;
    this.col.on = this.open < 0.25;
    // Neighbours coming or going open it for themselves (guests for teh).
    const d = Math.hypot(player.x - this.x, player.z - this.z);
    let visitor = false;
    for (const r of circles) if (Math.abs(r.x - this.x) + Math.abs(r.z - this.z) < 1.8) visitor = true;
    if (visitor && this.target === 0 && !this.locked()) {
      this.target = 1;
      if (d < 25) sfx('doorOpen');
    }
    // Shuts itself once Raka (and anyone else) has gone a few metres from it.
    if (this.target === 1 && d > 2.6 && !visitor) {
      this.idle += dt;
      if (this.idle > 4) {
        this.target = 0;
        this.idle = 0;
        if (d < 25) sfx('doorClose');
      }
    } else this.idle = 0;
  }
}
