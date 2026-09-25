/* First-person player: WASD / joystick movement with smoothing, circle-vs-box
   collision, standing on floors (platforms, stairs) or the ground, riding a
   vehicle, and the camera (eye height 1.7 m above the feet, optional head bob). */
import { SETTINGS } from './settings';
import { collide, collideCircles } from './collision';
import { groundAt } from './levels';
import { camera } from '../render/context';
import { S } from './state';

/** Something carrying the player (a train car): it moves the player itself from the wanted velocity. */
export interface Ride {
  step(dt: number, vx: number, vz: number): void;
  /** Name for the HUD ("EW Line to Tuas Link"). */
  label(): string;
}
export const player = {
  x: 0,
  z: 0,
  /** Feet height: 0 on the ground, higher on platforms and floors. */
  y: 0,
  vy: 0,
  vx: 0,
  vz: 0,
  /** The vehicle the player is aboard, or null. */
  ride: null as Ride | null,
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
  // Sitting: no walking, only looking around.
  if (S.seated) {
    player.vx = player.vz = player.speed = 0;
    player.running = false;
    return;
  }
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
  if (player.ride) {
    player.ride.step(dt, player.vx, player.vz);
  } else {
    const steps = 2;
    for (let i = 0; i < steps; i++) {
      player.x += (player.vx * dt) / steps;
      player.z += (player.vz * dt) / steps;
      collideCircles(player);
      collide(player, 0.32, player.y);
    }
    // Stand on the floor under the feet: step up stairs smoothly, fall off edges.
    const g = groundAt(player.x, player.z, player.y);
    if (g >= player.y - 0.02) {
      player.y += (g - player.y) * Math.min(1, dt * 16);
      player.vy = 0;
    } else {
      player.vy -= 18 * dt;
      player.y = Math.max(g, player.y + player.vy * dt);
      if (player.y === g) player.vy = 0;
    }
  }
  player.speed = Math.hypot(player.vx, player.vz);
  player.bob += dt * player.speed * 2.1;
}

export function applyCamera() {
  const b = SETTINGS.bob ? Math.sin(player.bob * 2) * 0.035 * Math.min(1, player.speed / 3.5) : 0;
  camera.position.set(player.x, player.y + player.eye + b, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}
