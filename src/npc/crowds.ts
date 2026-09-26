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
import type { PoseState, Gear } from './characters';
import { rainNow } from '../game/weather';

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
  /** Unit vector from the road out to this pavement (for walking side by side). */
  ox: number;
  oz: number;
  role: Role;
}
type Role = 'stroller' | 'office' | 'aunty' | 'student' | 'jogger';
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
      ox: 0,
      oz: 0,
      role: 'stroller',
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

/** Who is out walking here and now: office workers in the CBD at lunch and the rushes, aunties with trolleys
    in the HDB towns in the morning, students before and after school, joggers in the parks. */
function roleFor(x: number, z: number, r: () => number): Role {
  const h = (S.time / 60) % 24;
  const land = landAt(x, z);
  if ((land === 'park' || land === 'beach') && r() < 0.55) return 'jogger';
  const t = townAt(x, z);
  const kind = t?.kind as string | undefined;
  if (kind === 'cbd' && ((h >= 8 && h < 9.5) || (h >= 11.5 && h < 14) || (h >= 17.5 && h < 19.5)) && r() < 0.75)
    return 'office';
  if ((kind === 'hdb' || kind === 'mixed') && h >= 7 && h < 12 && r() < 0.35) return 'aunty';
  if (((h >= 6.8 && h < 8) || (h >= 14.5 && h < 17.5)) && r() < 0.3) return 'student';
  return 'stroller';
}
let spawned = 0;
/** Dress a walker for its role, with something to carry. */
function dress(i: number, w: Walker, role: Role) {
  const r = rng(hash('walker', i, spawned++));
  const gender = role === 'aunty' ? 'f' : r.chance(0.5) ? 'm' : 'f';
  const age =
    role === 'aunty'
      ? r.int(52, 76)
      : role === 'student'
        ? r.int(13, 18)
        : role === 'office'
          ? r.int(23, 55)
          : r.int(16, 75);
  const set =
    role === 'office'
      ? {
          top: r.pick(['#f4f1ea', '#dfe8f0', '#6fa8dc', '#e8e4da']),
          bottom: r.pick(['#2c3e50', '#3a4046', '#1d1f22']),
          longSleeves: true,
        }
      : role === 'student'
        ? { top: '#f4f6f8', bottom: r.pick(['#2f6fb3', '#3a4046']) }
        : role === 'jogger'
          ? { top: r.pick(['#d7263d', '#f2c14e', '#3fa7d6', '#3f7d3a']), bottom: '#1d1f22' }
          : {};
  const a = generateAppearance({ age, gender, hijab: 0.18, skins: SG_SKINS, set }, r.next);
  if (a.hair === 'peci' && r.chance(0.6)) a.hair = 'short';
  crowd.setAppearance(NAMED_SLOTS + i, a);
  const rain = rainNow() > 0.2;
  const gear: Gear =
    rain && role !== 'jogger' && r.chance(0.75)
      ? 'umbrella'
      : role === 'office'
        ? r.chance(0.6)
          ? 'lanyard'
          : 'phone'
        : role === 'aunty'
          ? r.chance(0.5)
            ? 'trolley'
            : 'shopping'
          : role === 'student'
            ? 'backpack'
            : role === 'jogger'
              ? 'none'
              : r.pick<Gear>(['none', 'none', 'handbag', 'shopping', 'phone', 'backpack']);
  crowd.setGear(
    NAMED_SLOTS + i,
    gear,
    r.pick(['#2b2622', '#b8342a', '#2f6fb3', '#f2c14e', '#3f7d3a', '#e8a0b8', '#f4f1ea']),
  );
  w.role = role;
  w.speed = role === 'jogger' ? r.range(2.6, 3.2) : role === 'aunty' ? r.range(0.8, 1.05) : r.range(1.1, 1.5);
}

/** Start a walker on a pavement 30–140 m from Aldi. */
function spawn(i: number, w: Walker, segs: ReturnType<typeof segsNear>) {
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
    Object.assign(w, {
      on: true,
      ax: ax + nx,
      az: az + nz,
      bx: bx + nx,
      bz: bz + nz,
      len,
      t: t * len,
      ox: nx / off,
      oz: nz / off,
    });
    dress(i, w, roleFor(x, z, Math.random));
    return;
  }
  w.on = false;
}
/** A friend walking beside a leader (further from the kerb), a step behind. */
function companion(i: number, w: Walker, lead: Walker, k: number) {
  const o = 0.75 * k;
  Object.assign(w, {
    on: true,
    ax: lead.ax + lead.ox * o,
    az: lead.az + lead.oz * o,
    bx: lead.bx + lead.ox * o,
    bz: lead.bz + lead.oz * o,
    len: lead.len,
    t: Math.max(0, lead.t - 0.4 * k),
    ox: lead.ox,
    oz: lead.oz,
  });
  dress(i, w, lead.role === 'office' || lead.role === 'student' || lead.role === 'jogger' ? lead.role : 'stroller');
  w.speed = lead.speed;
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
      spawn(i, w, segs);
      if (w.on) {
        active++;
        // Some walk in twos and threes: the next free walkers join (not joggers, mostly).
        const n = Math.random() < 0.3 ? (Math.random() < 0.3 ? 2 : 1) : 0;
        for (let k = 1, j = i + 1; k <= n && j < N; j++) {
          if (walkers[j].on) continue;
          companion(j, walkers[j], w, k++);
          active++;
        }
      }
    }
  }
}
export const crowdDebug = { walkers };
