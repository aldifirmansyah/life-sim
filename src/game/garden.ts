/* Raka's garden: three planters on the gang in front of his house, the way
   kampung houses line their frontage with pots. Plant seedlings, water them
   every day, harvest when grown. A day only counts if the plant was watered. */
import * as THREE from 'three';
import { B } from '../render/batch';
import { scene } from '../render/context';
import { rakaHouse } from '../world/landmarks';

export interface Pot {
  x: number;
  z: number;
  seed: string | null;
  /** Days of growth so far (watered days). */
  growth: number;
  wateredDay: number;
}
export const CROPS: Record<string, { crop: string; days: number; label: string; colour: string }> = {
  bibit_cabai: { crop: 'cabai', days: 4, label: 'chillies', colour: '#d8261f' },
  bibit_tomat: { crop: 'tomat', days: 5, label: 'tomatoes', colour: '#e8502a' },
  bibit_kemangi: { crop: 'kemangi', days: 3, label: 'lemon basil', colour: '#f4f1ea' },
};

export const pots: Pot[] = [];
let plants: THREE.InstancedMesh;
const PER = 5; // two leaf clumps, three fruit

/** Place the planters along the pagar, clear of the gate. Call before the batches are built. */
export function buildGarden() {
  const h = rakaHouse;
  const doorX = h.F(h.dx, h.fz)[0];
  const edge = h.F(0, h.fz + h.sb)[1]; // the teras edge, where the gang begins
  const z = edge - 0.25;
  for (let x = 13.7; pots.length < 3 && x < 19; x += 0.95) {
    if (Math.abs(x - doorX) < 1.0) continue;
    pots.push({ x, z, seed: null, growth: 0, wateredDay: -99 });
    B(x - 0.38, x + 0.38, 0, 0.34, z - 0.2, z + 0.2, '#b8603f', { col: true });
    B(x - 0.33, x + 0.33, 0.34, 0.37, z - 0.15, z + 0.15, '#4a3526');
  }
  plants = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    pots.length * PER,
  );
  plants.castShadow = true;
  plants.frustumCulled = false;
  scene.add(plants);
  refreshGarden();
}

export const isReady = (p: Pot) => !!p.seed && p.growth >= CROPS[p.seed].days;

/** Each new day, plants watered yesterday grow a day. */
export function gardenNewDay(day: number) {
  for (const p of pots) if (p.seed && p.wateredDay === day - 1 && !isReady(p)) p.growth++;
  refreshGarden();
}

const m = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  v = new THREE.Vector3(),
  sc = new THREE.Vector3();
const col = new THREE.Color();
export function refreshGarden() {
  pots.forEach((p, i) => {
    const set = (k: number, x: number, y: number, z: number, s: number, c: string) => {
      q.setFromAxisAngle(v.set(0, 1, 0), i * 1.7 + k);
      m.compose(v.set(x, y, z), q, sc.set(s, s * 0.9, s));
      plants.setMatrixAt(i * PER + k, m);
      plants.setColorAt(i * PER + k, col.set(c));
    };
    for (let k = 0; k < PER; k++) set(k, p.x, -5, p.z, 0, '#000');
    if (!p.seed) return;
    const crop = CROPS[p.seed];
    const t = Math.min(1, (p.growth + 1) / (crop.days + 1));
    const leaf = p.wateredDay >= 0 ? '#4f8a3a' : '#6a8a3a';
    set(0, p.x - 0.1, 0.4 + 0.12 * t, p.z, 0.08 + 0.16 * t, leaf);
    set(1, p.x + 0.12, 0.42 + 0.1 * t, p.z + 0.03, 0.06 + 0.13 * t, '#5e9c42');
    if (isReady(p))
      for (let k = 2; k < PER; k++)
        // Fruit hangs on the gang side of the leaves, where you can see it.
        set(k, p.x - 0.17 + (k - 2) * 0.17, 0.5 + 0.08 * (k % 2), p.z - 0.17, 0.065, crop.colour);
  });
  plants.instanceMatrix.needsUpdate = true;
  if (plants.instanceColor) plants.instanceColor.needsUpdate = true;
}
