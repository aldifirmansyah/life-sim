/* Instanced batches: fixed sets of geometry (prop sets, interiors) are added to one
   of these and built into a single InstancedMesh with per-instance colour. The
   streamed city uses pooled instancing instead (city/pool.ts). */
import * as THREE from 'three';
import { scene } from './context';

const _m = new THREE.Matrix4(),
  _q = new THREE.Quaternion(),
  _p = new THREE.Vector3(),
  _s = new THREE.Vector3(),
  _e = new THREE.Euler();
/** Compose a transform into a shared scratch matrix (Batch.add clones it). */
export function mat(x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return _m.compose(_p, _q, _s);
}

interface BatchOpts {
  cast?: boolean;
  receive?: boolean;
  parent?: THREE.Object3D;
}
export class Batch {
  m: THREE.Matrix4[] = [];
  c: THREE.Color[] = [];
  mesh?: THREE.InstancedMesh;
  cast: boolean;
  receive: boolean;
  parent: THREE.Object3D;
  constructor(
    public geo: THREE.BufferGeometry,
    public mat: THREE.Material,
    { cast = true, receive = true, parent = scene }: BatchOpts = {},
  ) {
    this.cast = cast;
    this.receive = receive;
    this.parent = parent;
  }
  add(m: THREE.Matrix4, c: THREE.ColorRepresentation = '#ffffff') {
    this.m.push(m.clone());
    this.c.push(new THREE.Color(c));
  }
  build() {
    const n = this.m.length;
    if (!n) return null;
    const im = new THREE.InstancedMesh(this.geo, this.mat, n);
    for (let i = 0; i < n; i++) {
      im.setMatrixAt(i, this.m[i]);
      im.setColorAt(i, this.c[i]);
    }
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor!.needsUpdate = true;
    im.castShadow = this.cast;
    im.receiveShadow = this.receive;
    im.computeBoundingSphere();
    this.parent.add(im);
    this.mesh = im;
    return im;
  }
}

/** Unit gable prism: base on y=0 spanning x,z ∈ [-.5,.5], ridge along x at y=1. */
export function prismGeo() {
  type V = [number, number, number];
  const A = (x: number): V => [x, 0, -0.5],
    B = (x: number): V => [x, 0, 0.5],
    C = (x: number): V => [x, 1, 0];
  const t: number[] = [];
  const tri = (a: V, b: V, c: V) => t.push(...a, ...b, ...c);
  tri(B(-0.5), B(0.5), C(0.5));
  tri(B(-0.5), C(0.5), C(-0.5));
  tri(A(0.5), A(-0.5), C(-0.5));
  tri(A(0.5), C(-0.5), C(0.5));
  tri(A(0.5), C(0.5), B(0.5));
  tri(B(-0.5), C(-0.5), A(-0.5));
  tri(A(-0.5), A(0.5), B(0.5));
  tri(A(-0.5), B(0.5), B(-0.5));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(t, 3));
  g.computeVertexNormals();
  return g;
}

export const BOX = new THREE.BoxGeometry(1, 1, 1);
/** Windows and storefronts that glow at night: unlit, colour driven by time of day (render/lighting). */
export const litMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
/** Street-light bulbs: brighter at night. */
export const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
