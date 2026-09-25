/* Graphics quality: pixel ratio and shadow map size (the fog and load radius are the city's: city/stream). */
import { SETTINGS } from '../core/settings';
import { renderer, camera } from './context';
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
