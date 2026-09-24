/* Graphics quality: pixel ratio, shadow map size and fog distance. */
import { SETTINGS } from '../core/settings';
import { renderer, fog, camera } from './context';
import { sun } from './lighting';

export function applyQuality() {
  const q = SETTINGS.quality;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [1, 1.25, 1.5][q]));
  const size = [512, 1024, 2048][q];
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.mapSize.set(size, size);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
  }
  fog.far = [95, 140, 170][q];
  fog.near = [30, 45, 60][q];
  document
    .querySelectorAll<HTMLElement>('#qseg button')
    .forEach(b => b.setAttribute('aria-checked', String(+b.dataset.q! === q)));
  resize();
}
export function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
