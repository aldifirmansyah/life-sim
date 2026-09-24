/* Instanced batches. Almost all world geometry is added to one of these and
   built into a single InstancedMesh with per-instance colour. */
import * as THREE from 'three';
import { scene } from './context';
import { addCol } from '../core/collision';
import { R } from '../core/util';

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
function prismGeo() {
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

const BOX = new THREE.BoxGeometry(1, 1, 1);
const lamW = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
export const solid = new Batch(BOX, lamW());
export const roofs = new Batch(prismGeo(), lamW());
export const cyl = new Batch(new THREE.CylinderGeometry(1, 1, 1, 10), lamW());
export const crowns = new Batch(
  new THREE.IcosahedronGeometry(1, 1),
  new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
);
export const blobs = new Batch(
  new THREE.IcosahedronGeometry(1, 0),
  new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
);
export const cones = new Batch(
  new THREE.ConeGeometry(1, 1, 8),
  new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
);
/** Windows and storefronts: unlit, colour driven by time of day. */
export const litMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
export const lit = new Batch(BOX, litMat, { cast: false });
export const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
export const bulbs = new Batch(new THREE.SphereGeometry(1, 8, 6), bulbMat, { cast: false, receive: false });
const triGeo = new THREE.BufferGeometry();
triGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.14, 0, 0, 0.14, 0, 0, 0, -0.26, 0], 3));
triGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
export const flags = new Batch(triGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), {
  cast: false,
});
/** Pasar pagi stalls: their own group so they can be hidden outside market hours. */
export const pasar = new THREE.Group();
scene.add(pasar);
export const pSolid = new Batch(BOX, lamW(), { parent: pasar });
export const pCone = new Batch(
  new THREE.ConeGeometry(1, 1, 8),
  new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
  { parent: pasar },
);
export const pBlob = new Batch(
  new THREE.IcosahedronGeometry(1, 0),
  new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
  { parent: pasar },
);
export const pCyl = new Batch(new THREE.CylinderGeometry(1, 1, 1, 8), lamW(), { parent: pasar });

/** Every batch, in the order the prototype built them. */
export const ALL_BATCHES = [solid, roofs, cyl, crowns, blobs, cones, lit, bulbs, flags, pSolid, pCone, pBlob, pCyl];

/* helpers in world space */
interface PutOpts {
  b?: Batch;
  ry?: number;
  rx?: number;
  col?: boolean;
  tag?: string;
}
/** Box from world-space extents. */
export function B(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  c: THREE.ColorRepresentation,
  o: PutOpts = {},
) {
  (o.b || solid).add(
    mat((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, o.ry || 0, o.rx || 0),
    c,
  );
  if (o.col) addCol(x0, x1, z0, z1, o.tag);
}
/** Upright cylinder. */
export function C(
  x: number,
  z: number,
  y0: number,
  y1: number,
  r: number,
  c: THREE.ColorRepresentation,
  o: PutOpts = {},
) {
  (o.b || cyl).add(mat(x, (y0 + y1) / 2, z, r, y1 - y0, r), c);
  if (o.col) addCol(x - r, x + r, z - r, z + r, o.tag);
}
export function blob(x: number, y: number, z: number, r: number, c: THREE.ColorRepresentation, sy = 1, b = blobs) {
  b.add(mat(x, y, z, r, r * sy, r, R() * 6), c);
}
