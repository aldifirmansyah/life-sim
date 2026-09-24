/* Food a neighbour leaves on Raka's teras (spec §8.4 food sharing): a plate
   under a woven tudung saji cover, by the door, until he picks it up. Two small
   meshes, only drawn while it's there. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { rakaHouse } from '../world/landmarks';

let group: THREE.Group | null = null;
export let platePos: [number, number] = [0, 0];

export function buildPlate() {
  const h = rakaHouse;
  const [x, z] = h.F(h.dx + 0.75, h.fz + 0.45);
  platePos = [x, z];
  group = new THREE.Group();
  const mat = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.03, 12), mat('#f4f1ea'));
  plate.position.y = 0.135;
  const cover = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c98a3a'));
  cover.position.y = 0.15;
  cover.scale.y = 0.8;
  group.add(plate, cover);
  group.position.set(x, 0, z);
  group.visible = false;
  scene.add(group);
}

export function showPlate(on: boolean) {
  if (group) group.visible = on;
}
