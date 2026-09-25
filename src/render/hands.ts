/* Raka's hands (spec §3.1: he's only ever seen as hands and arms). Attached to
   the camera and drawn over the world so they never clip into walls. Used for
   paying, taking things and eating; hidden the rest of the time. */
import * as THREE from 'three';
import { scene, camera } from './context';

const SKIN = '#a8704a';
const SLEEVE = '#4a6f8f';
const mats = new Map<string, THREE.MeshLambertMaterial>();
/** Unlit-looking enough to read at night, depth-free so the hands always sit in front. */
function m(color: string) {
  let x = mats.get(color);
  if (!x) {
    x = new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
      depthTest: false,
      depthWrite: false,
      emissive: color,
      emissiveIntensity: 0.25,
    });
    mats.set(color, x);
  }
  return x;
}
function part(geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, order = 0) {
  const mesh = new THREE.Mesh(geo, m(color));
  mesh.position.set(x, y, z);
  mesh.renderOrder = 20 + order;
  mesh.frustumCulled = false;
  return mesh;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const ico = (r: number, det = 0) => new THREE.IcosahedronGeometry(r, det);

/** An arm: forearm reaching back and down toward the camera from the hand at the origin. */
function arm(side: 1 | -1) {
  const g = new THREE.Group();
  const fore = part(box(0.085, 0.085, 0.42), SLEEVE, side * 0.03, -0.07, 0.2, 0);
  fore.rotation.x = 0.32;
  g.add(fore);
  g.add(part(box(0.075, 0.1, 0.05), SKIN, 0, -0.01, 0.02, 1)); // wrist
  g.add(part(box(0.09, 0.045, 0.11), SKIN, 0, 0, -0.04, 2)); // palm and fingers
  g.add(part(box(0.03, 0.03, 0.06), SKIN, -side * 0.055, 0.015, -0.03, 2)); // thumb
  return g;
}

type Shape =
  'cup' | 'bag' | 'box' | 'wrap' | 'bowl' | 'plate' | 'fruit' | 'bottle' | 'ball' | 'bunch' | 'paper' | 'packet';
interface Look {
  shape: Shape;
  c1: string;
  c2?: string;
  /** Stretch for long things (bananas, chillies). */
  long?: boolean;
}
const LOOKS: Record<string, Look> = {
  teh_manis: { shape: 'bag', c1: '#c9853a', c2: '#e24a3b' },
  es_jeruk: { shape: 'bag', c1: '#f2a33a', c2: '#3b7dd8' },
  kopi_sachet: { shape: 'cup', c1: '#f4f1ea', c2: '#6b4a2f' },
  kopi_tubruk: { shape: 'cup', c1: '#e8e4da', c2: '#2a1a10' },
  gorengan: { shape: 'wrap', c1: '#c9a86a', c2: '#d99a3a' },
  kerupuk: { shape: 'plate', c1: '#f4f1ea', c2: '#f2e2b6' },
  permen: { shape: 'bunch', c1: '#e24a3b', c2: '#f2c14e' },
  keripik_pisang: { shape: 'packet', c1: '#f2c14e', c2: '#d8392a' },
  kue_lapis: { shape: 'box', c1: '#e8a4a0', c2: '#58b368' },
  klepon: { shape: 'bunch', c1: '#58b368', c2: '#f4f1ea' },
  onde_onde: { shape: 'bunch', c1: '#d99a3a', c2: '#f4f1ea' },
  martabak_manis: { shape: 'box', c1: '#c9a86a', c2: '#6b4a2f' },
  roti_bakar: { shape: 'plate', c1: '#f4f1ea', c2: '#c98a4a' },
  nasi_uduk: { shape: 'wrap', c1: '#b89a62', c2: '#58b368' },
  nasi_bungkus: { shape: 'wrap', c1: '#b89a62', c2: '#d8392a' },
  mie_rebus: { shape: 'bowl', c1: '#f4f1ea', c2: '#e2b04a' },
  bakso: { shape: 'bowl', c1: '#f4f1ea', c2: '#9a7430' },
  sayur_lodeh: { shape: 'bowl', c1: '#f4f1ea', c2: '#e8d28a' },
  nasi_kuning: { shape: 'plate', c1: '#f4f1ea', c2: '#f2c14e' },
  kolak: { shape: 'bowl', c1: '#f4f1ea', c2: '#c98a3a' },
  beras: { shape: 'packet', c1: '#f4f1ea', c2: '#58b368' },
  telur: { shape: 'bunch', c1: '#e8d2b0', c2: '#e8d2b0' },
  bawang: { shape: 'bunch', c1: '#a8476a', c2: '#e8e4da' },
  tempe: { shape: 'box', c1: '#e2cf9a', c2: '#b8a26a' },
  tahu: { shape: 'box', c1: '#f4efe0', c2: '#e8e0cc' },
  kecap: { shape: 'bottle', c1: '#2a1a10', c2: '#d8392a' },
  sayur: { shape: 'bunch', c1: '#58b368', c2: '#f2c14e' },
  cabai: { shape: 'bunch', c1: '#d8261f', c2: '#3f7a3a', long: true },
  tomat: { shape: 'fruit', c1: '#e8502a' },
  kemangi: { shape: 'bunch', c1: '#4f8a3a', c2: '#5e9c42' },
  pisang: { shape: 'fruit', c1: '#f2d24e', long: true },
  mangga: { shape: 'fruit', c1: '#e2b04a' },
  rambutan: { shape: 'bunch', c1: '#c9302c', c2: '#3f7a3a' },
  jeruk: { shape: 'fruit', c1: '#9fb84a' },
  bunga: { shape: 'bunch', c1: '#fff6e8', c2: '#e24a3b' },
  kopi_bubuk: { shape: 'packet', c1: '#6b4a2f', c2: '#f2c14e' },
  koran: { shape: 'paper', c1: '#e8e4da', c2: '#3a3a3a' },
  buku_tts: { shape: 'paper', c1: '#2f6fb3', c2: '#f4f1ea' },
  bola: { shape: 'ball', c1: '#f4f1ea', c2: '#222326' },
  sapu: { shape: 'bunch', c1: '#c9a86a', c2: '#8a6a3a', long: true },
  pancing: { shape: 'bunch', c1: '#6b4a2f', c2: '#6b4a2f', long: true },
  gitar: { shape: 'box', c1: '#8a5a33', c2: '#2a1a10' },
  paket: { shape: 'box', c1: '#b89a62', c2: '#c9a86a' },
  ikan: { shape: 'fruit', c1: '#9fb0b8', long: true },
};
const lookFor = (id: string, cat: string): Look =>
  LOOKS[id] ??
  (cat === 'dish'
    ? { shape: 'plate', c1: '#f4f1ea', c2: id === 'sambal' ? '#c9302c' : id === 'sayur_asem' ? '#9fb84a' : '#c98a3a' }
    : cat === 'seed'
      ? { shape: 'bunch', c1: '#4f8a3a', c2: '#6b4a2f' }
      : { shape: 'box', c1: '#d9d3c7' });

function buildItem(id: string, cat: string) {
  const L = lookFor(id, cat);
  const g = new THREE.Group();
  const c2 = L.c2 ?? L.c1;
  switch (L.shape) {
    case 'cup':
      g.add(part(cyl(0.034, 0.028, 0.085), L.c1, 0, 0.045, 0, 3));
      g.add(part(cyl(0.031, 0.031, 0.004), c2, 0, 0.086, 0, 4));
      break;
    case 'bag': {
      const b = part(ico(0.05, 1), L.c1, 0, 0.05, 0, 3);
      b.scale.set(0.9, 1.25, 0.9);
      g.add(b);
      const straw = part(cyl(0.004, 0.004, 0.09, 5), c2, 0.012, 0.13, 0, 4);
      straw.rotation.z = -0.2;
      g.add(straw);
      break;
    }
    case 'box':
      g.add(part(box(0.1, 0.04, 0.07), L.c1, 0, 0.022, 0, 3));
      g.add(part(box(0.102, 0.012, 0.072), c2, 0, 0.022, 0, 4));
      break;
    case 'packet':
      g.add(part(box(0.075, 0.1, 0.025), L.c1, 0, 0.05, 0, 3));
      g.add(part(box(0.077, 0.03, 0.027), c2, 0, 0.06, 0, 4));
      break;
    case 'wrap':
      g.add(part(box(0.1, 0.05, 0.08), L.c1, 0, 0.025, 0, 3));
      g.add(part(box(0.03, 0.052, 0.082), c2, 0.02, 0.026, 0, 4));
      break;
    case 'bowl':
      g.add(part(cyl(0.075, 0.045, 0.05, 12), L.c1, 0, 0.025, 0, 3));
      g.add(part(cyl(0.068, 0.068, 0.004, 12), c2, 0, 0.049, 0, 4));
      for (const [x, z] of [
        [-0.02, 0.01],
        [0.025, -0.01],
        [0.0, -0.03],
      ])
        g.add(part(ico(0.016), '#8a6a4a', x, 0.055, z, 5));
      break;
    case 'plate':
      g.add(part(cyl(0.085, 0.07, 0.012, 14), L.c1, 0, 0.006, 0, 3));
      {
        const food = part(ico(0.045), c2, 0, 0.03, 0, 4);
        food.scale.set(1.2, 0.6, 1.1);
        g.add(food);
      }
      break;
    case 'fruit': {
      const f = part(ico(0.04, 1), L.c1, 0, 0.04, 0, 3);
      if (L.long) f.scale.set(0.6, 0.6, 2.2);
      g.add(f);
      break;
    }
    case 'bottle':
      g.add(part(cyl(0.024, 0.026, 0.12), L.c1, 0, 0.06, 0, 3));
      g.add(part(cyl(0.012, 0.012, 0.03), c2, 0, 0.135, 0, 4));
      break;
    case 'ball':
      g.add(part(ico(0.09, 1), L.c1, 0, 0.09, 0, 3));
      g.add(part(ico(0.035), c2, 0, 0.09, -0.07, 4));
      break;
    case 'paper':
      g.add(part(box(0.13, 0.012, 0.095), L.c1, 0, 0.006, 0, 3));
      g.add(part(box(0.1, 0.013, 0.02), c2, 0, 0.007, -0.02, 4));
      break;
    case 'bunch':
      for (let k = 0; k < 5; k++) {
        const b = part(
          ico(0.022),
          k % 2 ? c2 : L.c1,
          Math.cos(k * 1.3) * 0.028,
          0.03 + (k % 3) * 0.012,
          Math.sin(k * 1.3) * 0.028,
          3 + (k % 2),
        );
        if (L.long) b.scale.set(0.6, 0.6, 2);
        g.add(b);
      }
      break;
  }
  return g;
}

/** A pose for one hand in camera space: position and a small tilt. */
export interface HandPose {
  x: number;
  y: number;
  z: number;
  /** Tilt toward the face (drinking), radians. */
  tilt: number;
}
export const POSES = {
  hiddenR: { x: 0.38, y: -0.75, z: -0.3, tilt: 0 },
  hiddenL: { x: -0.38, y: -0.75, z: -0.3, tilt: 0 },
  holdR: { x: 0.19, y: -0.25, z: -0.5, tilt: 0 },
  reachR: { x: 0.09, y: -0.13, z: -0.78, tilt: 0 },
  mouthR: { x: 0.04, y: -0.13, z: -0.3, tilt: 0.25 },
  sipR: { x: 0.04, y: -0.1, z: -0.27, tilt: 1.0 },
  payL: { x: -0.1, y: -0.15, z: -0.72, tilt: 0 },
  // Sweeping with a sapu lidi, casting a line, strumming.
  sweepA: { x: 0.24, y: -0.42, z: -0.55, tilt: 0.7 },
  sweepB: { x: -0.06, y: -0.48, z: -0.62, tilt: 1.0 },
  castA: { x: 0.2, y: -0.05, z: -0.35, tilt: -0.4 },
  castB: { x: 0.16, y: -0.2, z: -0.7, tilt: 0.3 },
  holdL: { x: -0.2, y: -0.28, z: -0.5, tilt: 0 },
};

export class Hands {
  readonly right = arm(1);
  readonly left = arm(-1);
  private held = new THREE.Group();
  private note = new THREE.Group();
  private cache = new Map<string, THREE.Group>();

  constructor() {
    scene.add(camera);
    for (const a of [this.right, this.left]) {
      a.visible = false;
      camera.add(a);
    }
    this.held.position.set(0, 0.025, -0.08);
    this.right.add(this.held);
    // A Rp 50.000 note, folded once.
    this.note.add(part(box(0.075, 0.003, 0.038), '#3b7dd8', 0, 0.026, -0.06, 3));
    this.note.add(part(box(0.02, 0.0035, 0.038), '#9fc6cc', 0.02, 0.026, -0.06, 4));
    this.left.add(this.note);
  }

  /** Put an item in the right hand (or nothing). */
  hold(id: string | null, cat = '') {
    this.held.clear();
    this.held.scale.setScalar(1);
    if (!id) return;
    let g = this.cache.get(id);
    if (!g) {
      g = buildItem(id, cat);
      this.cache.set(id, g);
    }
    this.held.add(g);
  }
  /** Shrink what's held (a bite taken). */
  bite(scale: number) {
    this.held.scale.setScalar(scale);
  }
  showNote(on: boolean) {
    this.note.visible = on;
  }

  /** Place a hand between two poses (k from 0 to 1, eased). Hidden when fully at a hidden pose. */
  set(side: 'R' | 'L', a: HandPose, b: HandPose, k: number, wobble = 0) {
    const g = side === 'R' ? this.right : this.left;
    const e = k * k * (3 - 2 * k);
    g.position.set(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e + wobble, a.z + (b.z - a.z) * e);
    g.rotation.set(a.tilt + (b.tilt - a.tilt) * e, side === 'R' ? -0.15 : 0.15, 0);
    const hiddenPose = side === 'R' ? POSES.hiddenR : POSES.hiddenL;
    g.visible =
      !(a === hiddenPose && b === hiddenPose) && !(e >= 1 && b === hiddenPose) && !(e <= 0 && a === hiddenPose);
  }
  hide() {
    this.right.visible = this.left.visible = false;
    this.hold(null);
  }
}
