/* NPC debug view, shown with the F3 overlay: name tags over nearby residents
   and, with G, the waypoint graph plus every walking NPC's remaining path. */
import * as THREE from 'three';
import { $ } from '../core/util';
import { SETTINGS } from '../core/settings';
import { scene, camera } from '../render/context';
import { graphLines } from './navgraph';
import { residents, describe, headPos, remainingPath } from './npcs';

const tags: HTMLDivElement[] = [];
let graph: THREE.LineSegments | null = null;
let paths: THREE.LineSegments | null = null;
let showGraph = false;
let pathT = 0;
const v = new THREE.Vector3();

export function toggleGraph() {
  showGraph = !showGraph;
  if (showGraph && !graph) {
    graph = graphLines();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6 * 4000), 3));
    paths = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xff4fa3, depthTest: false }));
    paths.renderOrder = 6;
    paths.frustumCulled = false;
  }
  for (const o of [graph!, paths!]) {
    if (showGraph) scene.add(o);
    else scene.remove(o);
  }
  pathT = 0;
}

export function updateNpcDebug(dt: number) {
  const on = SETTINGS.debug;
  const box = $('npctags');
  box.hidden = !on;
  if (showGraph && !on) toggleGraph();
  if (!on) return;
  let n = 0;
  for (const r of residents) {
    if (r.hidden || r.tier !== 'near') continue;
    const [x, y, z] = headPos(r);
    v.set(x, y + 0.35, z).project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
    let el = tags[n];
    if (!el) {
      el = tags[n] = document.createElement('div');
      el.className = 'npctag';
      el.innerHTML = '<b></b><span></span>';
      box.appendChild(el);
    }
    el.hidden = false;
    el.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
    el.firstChild!.textContent = r.npc.name;
    el.lastChild!.textContent = describe(r);
    n++;
  }
  for (let k = n; k < tags.length; k++) tags[k].hidden = true;

  if (showGraph && paths && (pathT -= dt) <= 0) {
    pathT = 0.25;
    const pos = paths.geometry.getAttribute('position') as THREE.BufferAttribute;
    let k = 0;
    for (const r of residents) {
      const pts = remainingPath(r);
      for (let i = 0; i + 1 < pts.length && k < pos.count - 2; i++) {
        pos.setXYZ(k++, pts[i][0], 0.14, pts[i][1]);
        pos.setXYZ(k++, pts[i + 1][0], 0.14, pts[i + 1][1]);
      }
    }
    paths.geometry.setDrawRange(0, k);
    pos.needsUpdate = true;
  }
}
