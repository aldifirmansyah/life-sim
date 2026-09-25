/* Pooled instancing for the streamed city. A Pool is one InstancedMesh with a
   fixed capacity; chunks take slots when they load and give them back when they
   unload (the slot's matrix goes to zero, so it draws nothing). Every kind of
   geometry is one draw call however many chunks are loaded. Only the changed
   range of the instance buffers is uploaded each frame. */
import * as THREE from 'three';
import { scene } from '../render/context';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class Pool {
  mesh: THREE.InstancedMesh;
  private free: number[] = [];
  private used = 0;
  private lo = Infinity;
  private hi = -1;
  /** Extra per-instance float attributes, by name. */
  extra: Record<string, THREE.InstancedBufferAttribute> = {};
  constructor(
    public name: string,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    public cap: number,
    { cast = true, receive = true, attrs = [] as string[] } = {},
  ) {
    const g = geo.clone();
    for (const a of attrs) {
      const at = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
      at.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(a, at);
      this.extra[a] = at;
    }
    this.mesh = new THREE.InstancedMesh(g, mat, cap);
    this.mesh.name = name;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = cast;
    this.mesh.receiveShadow = receive;
    scene.add(this.mesh);
  }
  /** Take a slot and fill it; returns the slot, or -1 when the pool is full. */
  add(m: THREE.Matrix4, c: THREE.Color, extra?: Record<string, number>): number {
    let i = this.free.pop();
    if (i === undefined) {
      if (this.used >= this.cap) return -1;
      i = this.used++;
      this.mesh.count = this.used;
    }
    this.mesh.setMatrixAt(i, m);
    this.mesh.setColorAt(i, c);
    if (extra) for (const k in extra) this.extra[k].setX(i, extra[k]);
    this.dirty(i);
    return i;
  }
  /** Move a slot (vehicles). */
  set(i: number, m: THREE.Matrix4) {
    this.mesh.setMatrixAt(i, m);
    this.dirty(i);
  }
  remove(i: number) {
    if (i < 0) return;
    this.mesh.setMatrixAt(i, ZERO);
    this.free.push(i);
    this.dirty(i);
  }
  private dirty(i: number) {
    if (i < this.lo) this.lo = i;
    if (i > this.hi) this.hi = i;
  }
  /** Upload what changed this frame. */
  flush() {
    if (this.hi < 0) return;
    const n = this.hi - this.lo + 1;
    const im = this.mesh.instanceMatrix,
      ic = this.mesh.instanceColor!;
    im.clearUpdateRanges();
    im.addUpdateRange(this.lo * 16, n * 16);
    im.needsUpdate = true;
    ic.clearUpdateRanges();
    ic.addUpdateRange(this.lo * 3, n * 3);
    ic.needsUpdate = true;
    for (const k in this.extra) {
      const a = this.extra[k];
      a.clearUpdateRanges();
      a.addUpdateRange(this.lo, n);
      a.needsUpdate = true;
    }
    this.lo = Infinity;
    this.hi = -1;
  }
  get live() {
    return this.used - this.free.length;
  }
}
