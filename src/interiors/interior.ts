/* Walk-in interiors, built in place inside hollow buildings (docs/interiors-plan.md).
   An Interior is a set of named rooms (world rectangles), a prop set for the
   furniture and partitions, a real door and a ceiling lamp. Every frame this
   works out whether Raka is inside and in which room, and eases the indoor
   look in: less sky light, a warm lamp, muffled ambience with a little room
   reverb, a slower walk, and the room name in the HUD. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { S } from '../core/state';
import { player } from '../core/player';
import { setIndoorLight } from '../render/lighting';
import { setIndoor, sfx } from '../audio/audio';
import type { Frame } from '../core/util';

export interface Room {
  name: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
export interface Interior {
  /** Shown in the HUD: "Rumah Raka · Dapur". */
  name: string;
  rooms: Room[];
  props: PropSet;
  /** A second set that changes with the story (Raka's rooms as they're restored). */
  extra?: () => PropSet | null;
  /** The way in: a hinged door, or a shop's rolling shutter. */
  door: { update(dt: number): void };
  /** Ceiling lamp, world. */
  lamp: [number, number, number];
  /** Whether the lamp is on (at night it always is while Raka is near). */
  lampOn: () => boolean;
  /** 0..1: an old dim bulb, or a good one. */
  lampPower?: () => number;
  /** Raka comes in (after the sandals) and goes out. */
  onEnter?: () => void;
  onExit?: () => void;
  /** Draw the furniture only within this distance of the lamp (default 32 m); small homes seen only through
      their door use less. */
  showWithin?: number;
  /** 0..1: how much of the indoor look applies (an open pavilion is only partly indoors). */
  amount?: number;
  /** A pair of sandals left on the teras while Raka is inside. */
  sandals?: THREE.Object3D;
}
export const interiors: Interior[] = [];

/** Rooms from local rectangles of a house frame (rotations are multiples of 90°). */
export function roomL(F: Frame, name: string, lx0: number, lx1: number, lz0: number, lz1: number): Room {
  const a = F(lx0, lz0),
    b = F(lx1, lz1);
  return {
    name,
    x0: Math.min(a[0], b[0]),
    x1: Math.max(a[0], b[0]),
    z0: Math.min(a[1], b[1]),
    z1: Math.max(a[1], b[1]),
  };
}

const roomAt = (it: Interior, x: number, z: number) =>
  it.rooms.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);

/** One warm lamp, moved to whichever interior Raka is near. It stays in the scene (intensity 0 when
    unused) so materials never recompile. */
const lamp = new THREE.PointLight(0xffd29a, 0, 9, 1.6);
scene.add(lamp);
const bulbMat = new THREE.MeshBasicMaterial({ color: 0x77736a });
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), bulbMat);
scene.add(bulb);

let current: Interior | null = null;
let blend = 0;

/** Every frame. */
export function updateInteriors(dt: number) {
  let inside: Interior | null = null;
  let room: Room | undefined;
  let near: Interior | null = null;
  let nearD = Infinity;
  for (const it of interiors) {
    it.door.update(dt);
    const d = Math.hypot(player.x - it.lamp[0], player.z - it.lamp[2]);
    // The furniture is only drawn near the house (through the windows and door) and inside.
    const show = d < (it.showWithin ?? 32);
    it.props.show(show);
    it.extra?.()?.show(show);
    if (d < nearD) {
      nearD = d;
      near = it;
    }
    const r = roomAt(it, player.x, player.z);
    if (r) {
      inside = it;
      room = r;
    }
  }
  if (inside !== current) {
    const was = current;
    current = inside;
    // Sandals off at the threshold of a house (not a shop), back on going out.
    if (inside?.sandals || was?.sandals) sfx('sandal');
    if (was) {
      if (was.sandals) was.sandals.visible = false;
      was.onExit?.();
    }
    if (inside) {
      if (inside.sandals) inside.sandals.visible = true;
      inside.onEnter?.();
    }
  }
  S.inside = inside?.name ?? '';
  S.room = inside && room ? `${inside.name} · ${room.name}` : '';
  player.indoor = !!inside && (inside.amount ?? 1) > 0.5;
  blend += ((inside ? (inside.amount ?? 1) : 0) - blend) * Math.min(1, dt * 3);
  setIndoorLight(blend);
  setIndoor(blend);

  // The lamp: warm and bright at night, a soft fill by day while Raka is inside.
  const h = S.time / 60;
  const night = h < 6.4 || h >= 17.8;
  const it = inside ?? (nearD < 16 ? near : null);
  const on = !!it && it.lampOn() && (night || !!inside);
  if (it) {
    lamp.position.set(it.lamp[0], it.lamp[1] - 0.15, it.lamp[2]);
    bulb.position.set(it.lamp[0], it.lamp[1], it.lamp[2]);
  }
  bulb.visible = !!it;
  lamp.intensity = on ? (night ? 4.5 : 2.2) * (it?.lampPower?.() ?? 1) : 0;
  bulbMat.color.set(on ? 0xfff0c8 : 0x77736a);
}

/** Where Raka is: indoors or not, and the interior. */
export const indoors = () => current;
