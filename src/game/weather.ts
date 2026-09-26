/* Weather: on about a third of days, an afternoon thunderstorm, 20–40 game
   minutes between 13:30 and 17:00 (none on the big event days). The sky greys
   and dims, rain streaks fall round the camera (not indoors), it hisses, and now
   and then lightning flashes. Ported from kampung-v1's game/weather.ts. */
import * as THREE from 'three';
import { mulberry32 } from '../core/util';
import { S } from '../core/state';
import { player } from '../core/player';
import { scene, camera } from '../render/context';
import { setOvercast, hemi } from '../render/lighting';
import { setRain } from '../audio/audio';
import { toast } from '../ui/hud';
import { Crowd } from '../npc/characters';

const QUIET = [15, 23, 62, 106];
/** Today's storm, if any: start and end in game minutes. */
export function stormOn(day: number): { start: number; end: number } | null {
  if (QUIET.includes(day)) return null;
  const rnd = mulberry32(day * 7121 + 99);
  if (rnd() > 0.35) return null;
  const start = Math.round(13.5 * 60 + rnd() * 210);
  return { start, end: start + Math.round(20 + rnd() * 20) };
}
/** 0..1 now: ramps in over 5 minutes and out over 8. */
export function rainNow() {
  const r = stormOn(S.day);
  if (!r) return 0;
  const t = S.time;
  if (t < r.start || t > r.end + 8) return 0;
  const up = Math.min(1, (t - r.start) / 5);
  const down = t > r.end ? 1 - (t - r.end) / 8 : 1;
  return Math.max(0, Math.min(up, down));
}

const N = 1600;
const BOX = 26;
let mesh: THREE.LineSegments;
const uniforms = { time: { value: 0 }, cam: { value: new THREE.Vector3() }, level: { value: 0 } };

export function buildWeather() {
  const pos = new Float32Array(N * 2 * 3);
  const rnd = mulberry32(5150);
  for (let i = 0; i < N; i++) {
    const x = rnd() * BOX,
      y = rnd() * BOX,
      z = rnd() * BOX;
    pos.set([x, y, z, x, y, z], i * 6);
  }
  const tail = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) tail[i * 2 + 1] = 1;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('tail', new THREE.BufferAttribute(tail, 1));
  const B = BOX.toFixed(1),
    H = (BOX / 2).toFixed(1);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float tail;
      uniform float time; uniform vec3 cam; uniform float level;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - time * 16.0, ${B});
        p.x = mod(p.x - cam.x + time * 1.4, ${B}) + cam.x - ${H};
        p.z = mod(p.z - cam.z, ${B}) + cam.z - ${H};
        p.y += cam.y - ${H} + 4.0;
        p.y += tail * 0.6;
        p.x -= tail * 0.06;
        vA = step(fract(position.x * 7.13 + position.z * 3.7), level) * 0.45;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying float vA;
      void main() { if (vA <= 0.0) discard; gl_FragColor = vec4(0.78, 0.82, 0.88, vA); }`,
  });
  mesh = new THREE.LineSegments(g, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
}

let announced = -1;
let flash = 0,
  nextFlash = 0;
export function updateWeather(dt: number) {
  const level = rainNow();
  Crowd.rain = level > 0.2;
  setOvercast(Math.min(1, level * 1.2));
  setRain(level);
  uniforms.level.value = level;
  uniforms.time.value += dt;
  uniforms.cam.value.copy(camera.position);
  mesh.visible = level > 0.02 && !player.indoor;
  // Lightning: a brief brightening of the sky light.
  if (level > 0.6) {
    nextFlash -= dt;
    if (nextFlash <= 0) {
      flash = 0.18;
      nextFlash = 4 + Math.random() * 9;
    }
  }
  if (flash > 0) {
    flash -= dt;
    hemi.intensity += 2.5;
  }
  const r = stormOn(S.day);
  if (r && S.time >= r.start && S.time < r.end && announced !== S.day) {
    announced = S.day;
    toast('Thunderstorm!', 'The afternoon downpour. Everyone runs for the void decks and the covered walkways.');
  }
}
