/* Passers-by (step 6): up to 40 people walking the pavements near Aldi, drawn in
   the named people's crowd (the slots after them). Each walks one road segment's
   pavement, a little off the kerb, then picks another near Aldi. How many are out
   follows the hour (the morning and evening rush, few late at night) and the
   district (more in the CBD, at malls and in HDB towns; none on expressways, in
   forests or the sea). Their look is Singapore's mix: office wear in the CBD. */
import { hash, rng } from '../core/util';
import { S } from '../core/state';
import { player } from '../core/player';
import { segsNear } from '../city/roads';
import { landAt, townAt } from '../city/geo';
import { crowd, NAMED_SLOTS } from './people';
import { generateAppearance, SG_SKINS } from './appearance';
import type { PoseState } from './characters';

const N = 40;
interface Walker {
  on: boolean;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  len: number;
  t: number;
  speed: number;
  pose: PoseState;
}
const walkers: Walker[] = [];
let seed = 1;

export function buildCrowds() {
  for (let i = 0; i < N; i++) {
    const r = rng(hash('walker', i));
    const age = r.int(16, 75);
    const gender = r.chance(0.5) ? 'm' : 'f';
    const a = generateAppearance(
      {
        age,
        gender,
        hijab: 0.18,
        skins: SG_SKINS,
        set: r.chance(0.3) ? { top: r.pick(['#f4f1ea', '#e8e4da', '#6fa8dc', '#2c3e50']), longSleeves: true } : {},
      },
      r.next,
    );
    if (a.hair === 'peci' && r.chance(0.6)) a.hair = 'short';
    crowd.setAppearance(NAMED_SLOTS + i, a);
    crowd.hide(NAMED_SLOTS + i);
    walkers.push({
      on: false,
      ax: 0,
      az: 0,
      bx: 0,
      bz: 0,
      len: 1,
      t: 0,
      speed: r.range(1.1, 1.5),
      pose: {
        x: 0,
        z: 0,
        ry: 0,
        seatY: 0,
        pose: 'stand',
        walk: 1,
        phase: r.range(0, 6),
        headYaw: 0,
        gesture: 0,
        reach: 0,
        t: 0,
      },
    });
  }
}

/** How busy the streets are now (0..1). */
function busy() {
  const h = (S.time / 60) % 24;
  if (h < 6 || h >= 24) return 0.05;
  if (h < 7) return 0.3;
  if (h < 9.5) return 1;
  if (h < 17) return 0.6;
  if (h < 20) return 1;
  if (h < 22) return 0.6;
  return 0.25;
}
function districtWeight(x: number, z: number) {
  const land = landAt(x, z);
  if (land !== 'urban' && land !== 'beach' && land !== 'park') return 0;
  const t = townAt(x, z);
  if (!t) return 0.3;
  return (
    { cbd: 1, mall: 1, hdb: 0.9, shophouse: 1, mixed: 0.8, landmark: 0.8, campus: 0.6, civic: 0.6 }[t.kind as string] ??
    0.4
  );
}

/** Start a walker on a pavement 30–140 m from Aldi. */
function spawn(w: Walker, segs: ReturnType<typeof segsNear>) {
  for (let tries = 0; tries < 6 && segs.length; tries++) {
    const s = segs[(seed = (seed * 16807) % 2147483647) % segs.length];
    const dx = s.bx - s.ax,
      dz = s.bz - s.az,
      len = Math.hypot(dx, dz);
    if (len < 8) continue;
    const side = seed % 2 ? 1 : -1;
    const off = s.w / 2 + 1.6;
    const nx = (-dz / len) * off * side,
      nz = (dx / len) * off * side;
    const fwd = seed % 3 ? 1 : -1;
    const [ax, az, bx, bz] = fwd > 0 ? [s.ax, s.az, s.bx, s.bz] : [s.bx, s.bz, s.ax, s.az];
    const t = (seed % 1000) / 1000;
    const x = ax + (bx - ax) * t + nx,
      z = az + (bz - az) * t + nz;
    const d = Math.hypot(x - player.x, z - player.z);
    if (d < 30 || d > 140 || Math.random() > districtWeight(x, z)) continue;
    Object.assign(w, { on: true, ax: ax + nx, az: az + nz, bx: bx + nx, bz: bz + nz, len, t: t * len });
    return;
  }
  w.on = false;
}

let acc = 0;
export function updateCrowds(dt: number) {
  const want = Math.round(N * busy());
  let active = 0;
  acc += dt;
  const respawnTick = acc > 0.25;
  if (respawnTick) acc = 0;
  // A few new walkers a tick at most, from one search of the roads near Aldi.
  let tries = 4;
  let segs: ReturnType<typeof segsNear> | null = null;
  for (let i = 0; i < N; i++) {
    const w = walkers[i];
    const slot = NAMED_SLOTS + i;
    if (w.on) {
      w.t += w.speed * dt;
      const x = w.ax + ((w.bx - w.ax) * w.t) / w.len,
        z = w.az + ((w.bz - w.az) * w.t) / w.len;
      const far = Math.hypot(x - player.x, z - player.z) > 160;
      if (w.t >= w.len || far || active >= want || player.y > 6) {
        w.on = false;
        crowd.hide(slot);
        continue;
      }
      active++;
      const p = w.pose;
      p.x = x;
      p.z = z;
      p.ry = Math.atan2(w.bx - w.ax, w.bz - w.az);
      p.phase += dt * w.speed * 4.2;
      p.t += dt;
      crowd.pose(slot, p);
    } else if (respawnTick && active < want && player.y < 6 && tries-- > 0) {
      segs ??= segsNear(player.x, player.z, 140).filter(s => s.road.kind !== 'expressway');
      spawn(w, segs);
      if (w.on) active++;
    }
  }
}
