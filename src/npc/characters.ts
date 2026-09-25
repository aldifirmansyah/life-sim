/* Procedural low-poly characters (spec §9): a handful of shared unit geometries,
   one InstancedMesh each, recoloured per instance. Every NPC owns fixed instance
   slots; parts it doesn't use stay at a zero matrix. Animation is procedural. */
import * as THREE from 'three';
import { scene } from '../render/context';
import type { AppearanceParams } from './types';

const BOX_PER = 10; // thighs, shins, arms, eyes, hair back, cap visor
const ICO_PER = 3; // head, bun, hijab
const FRU_PER = 2; // skirt, hijab cape
enum Bx {
  ThighL,
  ThighR,
  ShinL,
  ShinR,
  ArmL,
  ArmR,
  EyeL,
  EyeR,
  HairBack,
  Visor,
}

/** Body proportions derived from appearance, in metres. */
interface Dims {
  hipY: number;
  thigh: number;
  shin: number;
  legW: number;
  shinW: number;
  legD: number;
  hipX: number;
  torsoH: number;
  torsoW: number;
  torsoD: number;
  shoulderY: number;
  shoulderX: number;
  armLen: number;
  armW: number;
  headR: number;
  headY: number;
}

function dims(a: AppearanceParams): Dims {
  const H = a.height,
    s = H / 1.65,
    bw = a.build;
  const legLen = (a.child ? 0.45 : 0.5) * H;
  const torsoH = (a.child ? 0.31 : 0.32) * H;
  const headR = (a.child ? 0.085 : 0.07) * H;
  const torsoW = 0.36 * s * bw,
    armW = 0.085 * s * bw;
  return {
    hipY: legLen,
    thigh: legLen * 0.5,
    shin: legLen * 0.5,
    legW: 0.125 * s * bw,
    shinW: 0.105 * s * bw,
    legD: 0.13 * s * bw,
    hipX: torsoW * 0.24,
    torsoH,
    torsoW,
    torsoD: 0.22 * s * bw,
    shoulderY: legLen + torsoH * 0.9,
    shoulderX: torsoW / 2 + armW * 0.45,
    armLen: 0.34 * H,
    armW,
    headR,
    headY: legLen + torsoH + 0.02 * H + headR,
  };
}

/** Where an NPC is and how it's moving, for one render update. */
export interface PoseState {
  x: number;
  z: number;
  ry: number;
  /** Seat height for sitting. */
  seatY: number;
  /** kneel: sitting on the heels on the floor (prayer, the pengajian circle); seatY is the hip height. */
  pose: 'stand' | 'sit' | 'squat' | 'kneel';
  /** 0 standing still … 1 full stride. */
  walk: number;
  /** Walk-cycle phase in radians. */
  phase: number;
  /** Head turn relative to the body. */
  headYaw: number;
  /** 0..1: talking gesture with the right arm. */
  gesture: number;
  /** 0..1: arms held forward (fishing, working at a counter). */
  reach: number;
  /** 0..1: right arm raised in a wave. */
  wave?: number;
  /** Seconds, for idle motion. */
  t: number;
  /** The floor they stand on (upper floors). */
  baseY?: number;
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _e = new THREE.Euler(),
  _q = new THREE.Quaternion(),
  _p = new THREE.Vector3(),
  _s = new THREE.Vector3();
const root = new THREE.Matrix4(),
  head = new THREE.Matrix4(),
  hip = new THREE.Matrix4(),
  knee = new THREE.Matrix4(),
  loc = new THREE.Matrix4(),
  out = new THREE.Matrix4();
/** Local transform: translate, rotate (YXZ), scale. */
function trs(
  m: THREE.Matrix4,
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
  sx = 1,
  sy = 1,
  sz = 1,
) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return m.compose(_p, _q, _s);
}

export class Crowd {
  readonly boxes: THREE.InstancedMesh;
  readonly torsos: THREE.InstancedMesh;
  readonly icos: THREE.InstancedMesh;
  readonly caps: THREE.InstancedMesh;
  readonly frusta: THREE.InstancedMesh;
  readonly cyls: THREE.InstancedMesh;
  private looks: AppearanceParams[] = [];
  private dim: Dims[] = [];
  private shown: boolean[] = [];

  constructor(readonly count: number) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0); // pivot at the top
    const torso = new THREE.CylinderGeometry(0.5, 0.43, 1, 6).translate(0, 0.5, 0); // pivot at the bottom
    const ico = new THREE.IcosahedronGeometry(1, 1);
    const cap = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const fru = new THREE.CylinderGeometry(0.55, 1, 1, 8).translate(0, -0.5, 0); // pivot at the top
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
    const mk = (g: THREE.BufferGeometry, per: number) => {
      const m = new THREE.InstancedMesh(g, mat, count * per);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      for (let i = 0; i < count * per; i++) {
        m.setMatrixAt(i, ZERO);
        m.setColorAt(i, new THREE.Color(0xffffff));
      }
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
      return m;
    };
    this.boxes = mk(box, BOX_PER);
    this.torsos = mk(torso, 1);
    this.icos = mk(ico, ICO_PER);
    this.caps = mk(cap, 1);
    this.frusta = mk(fru, FRU_PER);
    this.cyls = mk(cyl, 1);
  }

  get meshes() {
    return [this.boxes, this.torsos, this.icos, this.caps, this.frusta, this.cyls];
  }

  setAppearance(i: number, a: AppearanceParams) {
    this.looks[i] = a;
    this.dim[i] = dims(a);
    const c = (m: THREE.InstancedMesh, k: number, col: string) => m.setColorAt(k, new THREE.Color(col));
    const legs = a.bottom,
      shins = a.skirt ? a.skin : a.bottom,
      arms = a.longSleeves ? a.top : a.skin;
    const b = i * BOX_PER;
    c(this.boxes, b + Bx.ThighL, legs);
    c(this.boxes, b + Bx.ThighR, legs);
    c(this.boxes, b + Bx.ShinL, shins);
    c(this.boxes, b + Bx.ShinR, shins);
    c(this.boxes, b + Bx.ArmL, arms);
    c(this.boxes, b + Bx.ArmR, arms);
    c(this.boxes, b + Bx.EyeL, '#1b1614');
    c(this.boxes, b + Bx.EyeR, '#1b1614');
    c(this.boxes, b + Bx.HairBack, a.hairColor);
    c(this.boxes, b + Bx.Visor, a.headwear);
    c(this.torsos, i, a.top);
    c(this.icos, i * ICO_PER, a.skin);
    c(this.icos, i * ICO_PER + 1, a.hairColor);
    c(this.icos, i * ICO_PER + 2, a.headwear);
    c(this.caps, i, a.hair === 'cap' ? a.headwear : a.hairColor);
    c(this.frusta, i * FRU_PER, a.bottom);
    c(this.frusta, i * FRU_PER + 1, a.headwear);
    c(this.cyls, i, a.headwear);
    for (const m of this.meshes) m.instanceColor!.needsUpdate = true;
  }

  hide(i: number) {
    if (this.shown[i] === false) return;
    this.shown[i] = false;
    for (let k = 0; k < BOX_PER; k++) this.boxes.setMatrixAt(i * BOX_PER + k, ZERO);
    for (let k = 0; k < ICO_PER; k++) this.icos.setMatrixAt(i * ICO_PER + k, ZERO);
    for (let k = 0; k < FRU_PER; k++) this.frusta.setMatrixAt(i * FRU_PER + k, ZERO);
    this.torsos.setMatrixAt(i, ZERO);
    this.caps.setMatrixAt(i, ZERO);
    this.cyls.setMatrixAt(i, ZERO);
    this.dirty();
  }

  /** Head centre in world space (for name tags), from the last pose. */
  headY(i: number, st: PoseState) {
    const d = this.dim[i];
    return (
      (st.pose === 'sit' || st.pose === 'kneel' ? st.seatY + 0.04 - d.hipY : st.pose === 'squat' ? -d.hipY * 0.5 : 0) +
      d.headY
    );
  }

  pose(i: number, st: PoseState) {
    const a = this.looks[i],
      d = this.dim[i];
    this.shown[i] = true;
    const set = (m: THREE.InstancedMesh, k: number, local: THREE.Matrix4, parent = root) =>
      m.setMatrixAt(k, out.multiplyMatrices(parent, local));
    const w = st.walk,
      ph = st.phase;
    let y = 0,
      thL = 0,
      thR = 0,
      knL = 0,
      knR = 0,
      arL = 0,
      arR = 0;
    if (st.pose === 'sit') {
      y = st.seatY + 0.04 - d.hipY;
      thL = thR = -Math.PI / 2 + 0.05;
      knL = knR = Math.PI / 2 - 0.05;
      arL = arR = -0.55;
    } else if (st.pose === 'kneel') {
      // Thighs forward, shins folded back under them, hands on the knees.
      y = st.seatY + 0.04 - d.hipY;
      thL = thR = -Math.PI / 2 + 0.12;
      knL = knR = Math.PI - 0.12;
      arL = arR = -0.45;
    } else if (st.pose === 'squat') {
      y = -d.hipY * 0.5;
      thL = thR = -1.35;
      knL = knR = 2.3;
      arL = arR = -0.95;
    } else {
      y = Math.abs(Math.sin(ph)) * 0.025 * w;
      thL = 0.5 * Math.sin(ph) * w;
      thR = -thL;
      knL = w * (0.12 + 0.6 * Math.max(0, Math.sin(ph + 1.9)));
      knR = w * (0.12 + 0.6 * Math.max(0, Math.sin(ph + 1.9 + Math.PI)));
      arL = -0.45 * Math.sin(ph) * w;
      arR = -arL;
      // Idle: a slow sway so standing NPCs aren't frozen.
      const idle = (1 - w) * 0.04 * Math.sin(st.t * 1.3 + i);
      arL += idle;
      arR -= idle;
    }
    if (st.reach > 0) {
      arL = arL * (1 - st.reach) - 0.95 * st.reach;
      arR = arR * (1 - st.reach) - 0.95 * st.reach;
    }
    if (st.gesture > 0) arR = arR * (1 - st.gesture) + (-1.05 - 0.35 * Math.sin(st.t * 5 + i)) * st.gesture;
    let rollR = 0.07;
    if (st.wave) {
      arR = arR * (1 - st.wave) + (-2.75 + 0.12 * Math.sin(st.t * 9)) * st.wave;
      rollR += st.wave * (0.2 + 0.28 * Math.sin(st.t * 9));
    }

    trs(root, st.x, y + (st.baseY ?? 0), st.z, 0, st.ry, 0);
    const b = i * BOX_PER;
    // Legs: thigh from the hip, shin from the knee.
    for (const [side, th, kn, T, S] of [
      [-1, thL, knL, Bx.ThighL, Bx.ShinL],
      [1, thR, knR, Bx.ThighR, Bx.ShinR],
    ] as const) {
      trs(hip, side * d.hipX, d.hipY, 0, th, 0, 0);
      hip.premultiply(root);
      set(this.boxes, b + T, trs(loc, 0, 0, 0, 0, 0, 0, d.legW, d.thigh + 0.02, d.legD), hip);
      knee.multiplyMatrices(hip, trs(loc, 0, -d.thigh, 0, kn, 0, 0));
      set(this.boxes, b + S, trs(loc, 0, 0, 0, 0, 0, 0, d.shinW, d.shin, d.legD * 0.95), knee);
    }
    // Arms from the shoulders, splayed out slightly.
    set(this.boxes, b + Bx.ArmL, trs(loc, -d.shoulderX, d.shoulderY, 0, arL, 0, -0.07, d.armW, d.armLen, d.armW * 1.1));
    set(this.boxes, b + Bx.ArmR, trs(loc, d.shoulderX, d.shoulderY, 0, arR, 0, rollR, d.armW, d.armLen, d.armW * 1.1));
    set(this.torsos, i, trs(loc, 0, d.hipY - 0.02, 0, 0, 0, 0, d.torsoW, d.torsoH + 0.02, d.torsoD));

    // Skirt: hangs from the hips, or lies along the thighs when sitting.
    if (a.skirt) {
      if (st.pose === 'stand')
        set(
          this.frusta,
          i * FRU_PER,
          trs(loc, 0, d.hipY + 0.03, 0, 0, 0, 0, d.torsoW * 0.5, d.hipY * 0.9, d.torsoD * 0.62),
        );
      else
        set(
          this.frusta,
          i * FRU_PER,
          trs(loc, 0, d.hipY, 0.02, -Math.PI / 2 + 0.1, 0, 0, d.torsoW * 0.5, d.thigh * 1.25, d.torsoD * 0.75),
        );
    } else this.frusta.setMatrixAt(i * FRU_PER, ZERO);

    // Head and everything on it turn together.
    const r = d.headR;
    head.multiplyMatrices(root, trs(loc, 0, d.headY, 0, 0, st.headYaw, 0));
    set(this.icos, i * ICO_PER, trs(loc, 0, 0, 0, 0, 0, 0, r, r * 1.08, r * 0.98), head);
    set(this.boxes, b + Bx.EyeL, trs(loc, -r * 0.36, r * 0.2, r * 0.9, 0, 0, 0, r * 0.15, r * 0.22, r * 0.1), head);
    set(this.boxes, b + Bx.EyeR, trs(loc, r * 0.36, r * 0.2, r * 0.9, 0, 0, 0, r * 0.15, r * 0.22, r * 0.1), head);
    const hs = a.hair;
    const capOn = hs === 'short' || hs === 'long' || hs === 'bun' || hs === 'peci' || hs === 'cap';
    if (capOn) {
      if (hs === 'cap') set(this.caps, i, trs(loc, 0, r * 0.12, 0, 0, 0, 0, r * 1.1, r * 1.0, r * 1.1), head);
      else set(this.caps, i, trs(loc, 0, r * 0.08, -r * 0.05, 0, 0, 0, r * 1.07, r * 1.02, r * 1.08), head);
    } else this.caps.setMatrixAt(i, ZERO);
    if (hs === 'long')
      set(this.boxes, b + Bx.HairBack, trs(loc, 0, r * 0.4, -r * 0.62, 0, 0, 0, r * 1.9, r * 2.6, r * 0.5), head);
    else this.boxes.setMatrixAt(b + Bx.HairBack, ZERO);
    if (hs === 'cap')
      set(this.boxes, b + Bx.Visor, trs(loc, 0, r * 0.36, r * 0.95, -0.12, 0, 0, r * 1.2, r * 0.08, r * 0.9), head);
    else this.boxes.setMatrixAt(b + Bx.Visor, ZERO);
    if (hs === 'bun')
      set(this.icos, i * ICO_PER + 1, trs(loc, 0, r * 0.55, -r * 0.85, 0, 0, 0, r * 0.42, r * 0.42, r * 0.42), head);
    else this.icos.setMatrixAt(i * ICO_PER + 1, ZERO);
    if (hs === 'hijab') {
      set(this.icos, i * ICO_PER + 2, trs(loc, 0, r * 0.1, -r * 0.3, 0, 0, 0, r * 1.18, r * 1.24, r * 1.16), head);
      // The cape sits on the shoulders, so it follows the body, not the head.
      set(
        this.frusta,
        i * FRU_PER + 1,
        trs(loc, 0, d.headY - r * 0.5, -0.01, 0, 0, 0, d.torsoW * 0.55, d.torsoH * 0.5, d.torsoD * 0.66),
      );
    } else {
      this.icos.setMatrixAt(i * ICO_PER + 2, ZERO);
      this.frusta.setMatrixAt(i * FRU_PER + 1, ZERO);
    }
    if (hs === 'peci') set(this.cyls, i, trs(loc, 0, r * 0.72, -r * 0.04, 0, 0, 0, r * 0.93, r * 0.55, r * 0.93), head);
    else this.cyls.setMatrixAt(i, ZERO);
    this.dirty();
  }

  private dirty() {
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}
