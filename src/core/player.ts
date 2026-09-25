/* First-person player: WASD / joystick movement with smoothing, circle-vs-box
   collision, and the camera (eye height 1.7 m, optional head bob). */
import { SETTINGS } from './settings';
import { collide, collideCircles } from './collision';
import { camera } from '../render/context';

export const player = {
  x: 0,
  z: 55.5,
  vx: 0,
  vz: 0,
  yaw: 0,
  pitch: 0,
  bob: 0,
  speed: 0,
  /** Moving at a run this frame. */
  running: false,
  /** Inside a building (set by interiors). */
  indoor: false,
  /** Set by game/stats from energy and Fitness. */
  canRun: true,
  runSpeed: 6,
  walkSpeed: 3.5,
  /** Eye height: 1.7 standing, lower when seated. */
  eye: 1.7,
};
/** Held key codes. */
export const keys = new Set<string>();
/** Touch joystick (left side) and look finger (right side). */
export const joy: { id: number | null; ox: number; oy: number; x: number; y: number } = {
  id: null,
  ox: 0,
  oy: 0,
  x: 0,
  y: 0,
};
export const look: { id: number | null; x: number; y: number } = { id: null, x: 0, y: 0 };

export function updatePlayer(dt: number) {
  let fx = 0,
    fz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) fz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) fz -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) fx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) fx += 1;
  let run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (joy.id !== null) {
    fx += joy.x;
    fz -= joy.y;
    if (Math.hypot(joy.x, joy.y) > 0.92) run = true;
  }
  const len = Math.hypot(fx, fz);
  if (len > 1) {
    fx /= len;
    fz /= len;
  }
  // No running indoors, and a slower, careful pace.
  run = run && player.canRun && !player.indoor;
  player.running = run && len > 0.1;
  const sp = run ? player.runSpeed : player.indoor ? 2.1 : player.walkSpeed;
  const sy = Math.sin(player.yaw),
    cy = Math.cos(player.yaw);
  const tx = (fx * cy - fz * sy) * sp,
    tz = (-fx * sy - fz * cy) * sp;
  const k = 1 - Math.exp(-dt * 12);
  player.vx += (tx - player.vx) * k;
  player.vz += (tz - player.vz) * k;
  const steps = 2;
  for (let i = 0; i < steps; i++) {
    player.x += (player.vx * dt) / steps;
    player.z += (player.vz * dt) / steps;
    collideCircles(player);
    collide(player);
  }
  player.speed = Math.hypot(player.vx, player.vz);
  player.bob += dt * player.speed * 2.1;
}

export function applyCamera() {
  const b = SETTINGS.bob ? Math.sin(player.bob * 2) * 0.035 * Math.min(1, player.speed / 3.5) : 0;
  camera.position.set(player.x, player.eye + b, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}
