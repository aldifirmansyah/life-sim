/* Lives you can see (v3 step 21). Every named person has a home and a routine
   around the plan in their roster entry: the gaps ('away') become time at home,
   evening and weekend outings to the places they like (their haunts), and
   Friday prayers for the Muslim men. Between any two places they make a trip:
   out of their building (the lift, the door), along the pavements, on a bus or
   the MRT for the far ones (the same planner as the directions), and in again.
   Near Aldi a trip is walked at a stroll and drawn; far away it runs quickly on
   paper, so nobody teleports where Aldi could notice. */
import { hash, rng } from '../core/util';
import { player } from '../core/player';
import { timeWarp } from '../core/time';
import { TOWNS } from '../city/geo';
import { nearestNode, findPath, nodes } from '../city/roadgraph';
import { freeAt } from '../city/gen';
import { routeAt } from '../city/buses';
import { along } from '../city/mrtdata';
import { journey } from '../ui/directions';
import { weekday } from '../game/calendar';
import {
  CHOPEE_HQ,
  CITY_OFFICE,
  HOME_SITES,
  MOSQUE,
  LUCKY,
  TEKKA,
  TB_MARKET,
  KATONG_ROW,
  BEACH,
  PROMENADE,
  HAJI_LANE,
  CT_MARKET,
} from '../places/sites';

export interface Spot {
  x: number;
  y: number;
  z: number;
  ry: number;
  sit?: number;
  where: string;
  /** Indoors out of sight (at home): not drawn. */
  hidden?: boolean;
}
type Pt = [number, number];
export type Plan = [string, string][];

/* ---------- homes ---------- */

/** Where each person lives: a town, or 'blk420' (Aldi's block in Clementi) and which unit. */
const HOMES: Record<string, string> = {
  weijie: 'toa_payoh',
  hafiz: 'tampines',
  meiling: 'queenstown',
  arun: 'jurong_east',
  siti: 'bedok',
  kenji: 'clarke_quay',
  nurul: 'woodlands',
  rachel: 'katong',
  daniel: 'bugis',
  ahseng: 'clementi',
  harun: 'geylang',
  lily: 'clementi',
  mdmtan: 'dover',
  auntymei: 'blk420:0',
  kokwah: 'blk420:0',
  jasmine: 'blk420:0',
  ravi: 'blk420:1',
  rosnah: 'blk420:2',
  rahman: 'kampong_glam',
  marcus: 'clarke_quay',
  junhao: 'dover',
  farah: 'one_north',
  hamid: 'kampong_glam',
  dewi: 'toa_payoh',
  bayu: 'punggol',
  ana: 'geylang',
  lakshmi: 'little_india',
  lim: 'chinatown',
  ibrahim: 'kampong_glam',
  sarah: 'holland',
  ivy: 'katong',
  firdaus: 'bedok',
  joanne: 'ang_mo_kio',
};
const homes: Record<string, Spot> = {};
/** A point on a pavement near (x, z): beside the nearest road node, on the side with room. */
function pavementNear(x: number, z: number, seed: number): Pt {
  const n = nearestNode(x, z, 200);
  if (!n) return [x, z];
  const e = n.out[seed % Math.max(1, n.out.length)];
  const m = e ? nodes[e.to] : null;
  const dx = m ? m.x - n.x : 1,
    dz = m ? m.z - n.z : 0,
    l = Math.hypot(dx, dz) || 1;
  const off = (e?.w ?? 7) / 2 + 3;
  // Part of the way along the road, on whichever side is clear.
  const u = 6 + (seed % 11);
  for (const side of [1, -1]) {
    const px = n.x + (dx / l) * u + (dz / l) * off * side,
      pz = n.z + (dz / l) * u - (dx / l) * off * side;
    if (freeAt(px, pz, 1.5)) return [px, pz];
  }
  return [n.x + (dz / l) * off, n.z - (dx / l) * off];
}
export function homeSpot(id: string): Spot {
  if (homes[id]) return homes[id];
  const h = HOMES[id] ?? 'clementi';
  let s: Spot;
  if (h.startsWith('blk420')) {
    // Upstairs at Blk 420, level 7: the family's flat, or a neighbour's along the corridor.
    const B = HOME_SITES.find(b => b.id === 'clementi')!;
    const unit = +h.split(':')[1];
    const x = [B.x, B.x + 11, B.x - 13][unit],
      bz1 = B.z + B.d / 2;
    s = { x, y: B.floor!, z: bz1 - 4, ry: 0, where: 'At home, Blk 420 Clementi', hidden: true };
  } else {
    const t = TOWNS.find(t => t.id === h) ?? TOWNS[0];
    const r = rng(hash('home', id));
    const a = r.next() * Math.PI * 2,
      d = t.r * (0.2 + 0.4 * r.next());
    const [x, z] = pavementNear(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, r.int(0, 99));
    s = { x, y: 0, z, ry: 0, where: `At home in ${t.name}`, hidden: true };
  }
  return (homes[id] = s);
}
export const homeTown = (id: string) => {
  const h = HOMES[id] ?? '';
  return h.startsWith('blk420') ? 'Blk 420 Clementi' : (TOWNS.find(t => t.id === h)?.name ?? '');
};

/* ---------- haunts ---------- */

/** Places people go in their free time: a key, a name and where (a spot for four, facing each other). */
const HAUNTS: [string, string, number, number][] = [
  ['clementi', 'Clementi Mall', -950, 120],
  ['orchard', 'Orchard Road', -30, 40],
  ['vivacity', 'VivaCity', -60, 640],
  ['chinatown', 'Chinatown', (CT_MARKET.x0 + CT_MARKET.x1) / 2, CT_MARKET.z1 + 6],
  ['marina', 'Marina Bay', PROMENADE.x, PROMENADE.z],
  ['ecp', 'East Coast Park', BEACH.x, BEACH.z - 20],
  ['katong', 'Katong', (KATONG_ROW.x0 + KATONG_ROW.x1) / 2, KATONG_ROW.z1 + 6],
  ['tekka', 'Tekka Centre', TEKKA.x, TEKKA.z + TEKKA.d / 2 + 5],
  ['hajilane', 'Haji Lane', (HAJI_LANE.x0 + HAJI_LANE.x1) / 2, HAJI_LANE.z1 + 5],
  ['bugis', 'Bugis', 300, 120],
  ['holland', 'Holland Village', -430, -60],
  ['tiongbahru', 'Tiong Bahru', TB_MARKET.x, TB_MARKET.z - TB_MARKET.d / 2 - 5],
  ['lucky', 'Lucky Place', (LUCKY.x0 + LUCKY.x1) / 2, LUCKY.z1 + 5],
  ['boatquay', 'Boat Quay', 215, 487],
  ['botanic', 'Botanic Gardens', -270, -70],
  ['toapayoh', 'Toa Payoh Central', 90, -330],
  ['bedok', 'Bedok Interchange', 1030, 170],
  ['jurong', 'Jurong East', -1290, 10],
];
/** Who goes where in their free time. */
const LIKES: Record<string, string[]> = {
  weijie: ['toapayoh', 'orchard', 'botanic'],
  hafiz: ['bedok', 'ecp', 'bugis', 'hajilane'],
  meiling: ['hajilane', 'tiongbahru', 'orchard'],
  arun: ['jurong', 'tekka', 'clementi'],
  siti: ['bedok', 'hajilane', 'katong'],
  kenji: ['boatquay', 'marina', 'orchard'],
  nurul: ['orchard', 'bugis', 'vivacity'],
  rachel: ['katong', 'marina', 'ecp'],
  daniel: ['bugis', 'boatquay', 'marina'],
  ahseng: ['clementi', 'toapayoh'],
  harun: ['lucky', 'hajilane'],
  lily: ['clementi', 'chinatown'],
  mdmtan: ['clementi', 'chinatown'],
  auntymei: ['clementi', 'chinatown'],
  kokwah: ['clementi', 'toapayoh'],
  jasmine: ['clementi', 'orchard', 'vivacity', 'jurong'],
  ravi: ['tekka', 'clementi'],
  rosnah: ['clementi', 'hajilane', 'katong'],
  rahman: ['hajilane', 'bugis'],
  marcus: ['boatquay', 'marina', 'orchard'],
  junhao: ['holland', 'clementi', 'marina', 'jurong'],
  farah: ['holland', 'tiongbahru', 'hajilane', 'vivacity'],
  hamid: ['hajilane', 'bugis'],
  dewi: ['lucky', 'orchard'],
  bayu: ['lucky', 'jurong', 'vivacity'],
  ana: ['lucky', 'hajilane'],
  lakshmi: ['tekka'],
  lim: ['chinatown', 'tiongbahru'],
  ibrahim: ['hajilane', 'bugis'],
  sarah: ['holland', 'botanic', 'orchard'],
  ivy: ['katong', 'ecp'],
  firdaus: ['ecp', 'bedok'],
  joanne: ['toapayoh', 'botanic'],
};
/** How likely a weekday evening out is. */
const EVENINGS: Record<string, number> = { junhao: 0.6, marcus: 0.2, hafiz: 0.5, daniel: 0.5, kenji: 0.5, nurul: 0.5 };
/** Friday prayers (Jumaat) at Masjid Sultan. */
const JUMAAT = ['hafiz', 'harun', 'rahman', 'bayu', 'ibrahim', 'firdaus', 'arun'].filter(id => id !== 'arun');

/** The spots for outings and prayers, added to the roster's spots. */
export function lifeSpots(add: (k: string, s: Spot) => void) {
  HAUNTS.forEach(([k, name, x, z], i) => {
    const [cx, cz] = pavementNear(x, z, i * 7);
    for (let n = 0; n < 4; n++) {
      const a = (n / 4) * Math.PI * 2 + i;
      const px = cx + Math.cos(a) * 0.85,
        pz = cz + Math.sin(a) * 0.85;
      add(`out.${k}.${n}`, { x: px, y: 0, z: pz, ry: Math.atan2(cx - px, cz - pz), where: name });
    }
  });
  const M = MOSQUE;
  for (let n = 0; n < 8; n++)
    add(`m.jumaat.${n}`, {
      x: M.x + 2 + (n >= 4 ? 1.3 : 0),
      y: 0,
      z: M.z + 4 + ((n % 4) - 1.5) * 1.2,
      ry: -Math.PI / 2,
      sit: 0.35,
      where: 'Masjid Sultan',
    });
}

/* ---------- the day ---------- */

const mins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const hm = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
/** A person's whole day: the roster's plan with its gaps filled (home, outings, prayers). */
export function lifePlan(id: string, day: number, plan: Plan): Plan {
  const r = rng(hash('life', id, day));
  const wd = weekday(day);
  const likes = LIKES[id] ?? [];
  const slot = hash('seat', id) % 4;
  const out: Plan = [];
  const seq = plan.map(([t, k]) => [mins(t), k] as [number, string]);
  seq.forEach(([a, k], i) => {
    if (k !== 'away') return void out.push([hm(a), k]);
    const b = i + 1 < seq.length ? seq[i + 1][0] : 26 * 60;
    out.push([hm(a), 'home']);
    const outing = (from: number, len: number, latest: number) => {
      if (!likes.length) return;
      const s0 = Math.max(from, a + 30),
        s1 = Math.min(s0 + len, b - 30, latest);
      if (s1 - s0 < 60) return;
      const place = likes[r.int(0, likes.length - 1)];
      out.push([hm(s0), `out.${place}.${slot}`], [hm(s1), 'home']);
    };
    if (wd >= 1 && wd <= 5) {
      if (r.next() < (EVENINGS[id] ?? 0.3)) outing(18 * 60 + 30 + r.int(0, 3) * 15, r.int(90, 150), 23 * 60);
    } else {
      if (r.next() < 0.6) outing(10 * 60 + r.int(0, 4) * 15, r.int(120, 180), 14 * 60);
      if (r.next() < 0.6) outing(15 * 60 + r.int(0, 8) * 15, r.int(120, 200), 22 * 60 + 30);
    }
  });
  out.sort((x, y) => mins(x[0]) - mins(y[0]));
  // Friday prayers: to the mosque for Jumaat, then back to whatever the day had.
  if (wd === 5 && JUMAAT.includes(id)) {
    const at = (t: number) => {
      let k = 'home';
      for (const [s, key] of out) if (mins(s) <= t) k = key;
      return k;
    };
    const after = at(13 * 60 + 50);
    const kept = out.filter(([s]) => mins(s) < 12 * 60 + 15 || mins(s) >= 13 * 60 + 50);
    kept.push(['12:15', `m.jumaat.${hash('jumaat', id) % 8}`], ['13:50', after]);
    kept.sort((x, y) => mins(x[0]) - mins(y[0]));
    return kept;
  }
  return out;
}

/* ---------- getting there ---------- */

/** How to get in and out of the building a spot is in: its door, and its lift (bottom and top). */
interface Access {
  id: string;
  door?: Pt;
  lift?: { bottom: Pt; top: Pt };
}
function accessOf(s: { x: number; z: number; y: number }): Access | null {
  const H = CHOPEE_HQ;
  if (s.x > H.x0 && s.x < H.x1 && s.z > H.z0 && s.z < H.z1 + 1)
    return {
      id: 'hq',
      door: [(H.x0 + H.x1) / 2, H.z1 + 2.5],
      lift: { bottom: [H.x1 - 6, H.z0 + 2.2], top: [H.x1 - 6, H.z0 + 2.2] },
    };
  const C = CITY_OFFICE;
  if (s.x > C.x0 && s.x < C.x1 && s.z > C.z0 && s.z < C.z1 + 1)
    return {
      id: 'city',
      door: [(C.x0 + C.x1) / 2, C.z1 + 2.5],
      lift: { bottom: [C.x0 + 6, C.z0 + 2.2], top: [C.x0 + 6, C.z0 + 2.2] },
    };
  const B = HOME_SITES.find(b => b.id === 'clementi')!;
  if (s.y > 1 && Math.abs(s.x - B.x) < B.w / 2 + 1 && Math.abs(s.z - B.z) < B.d / 2 + 3) {
    const lx = B.x + B.w / 2 - 4;
    return { id: 'blk420', lift: { bottom: [lx, B.z + 2.6], top: [lx, B.z + B.d / 2 + 1] } };
  }
  const M = MOSQUE;
  if (Math.abs(s.x - M.x) < M.w / 2 && Math.abs(s.z - M.z) < M.d / 2)
    return { id: 'mosque', door: [M.x, M.z + M.d / 2 + 2.5] };
  const L = LUCKY;
  if (s.x > L.x0 && s.x < L.x1 && s.z > L.z0 && s.z < L.z1)
    return { id: 'lucky', door: [(L.x0 + L.x1) / 2, L.z1 + 2.5] };
  return null;
}

type Leg =
  | { k: 'walk'; to: Pt; y: number; pts: Pt[] | null; j: number; far?: boolean }
  | { k: 'ride'; pts: Pt[]; j: number; label: string }
  | { k: 'lift'; to: Pt; y: number; t: number };
export interface Trip {
  legs: Leg[];
  i: number;
  /** Where they're headed, for Contacts and greetings. */
  to: Spot;
  check: number;
}

/** Pavement points from near (ax, az) to near (bx, bz): the road graph's path, kept to the left-hand
    pavement of each road (half its width plus a kerb), or null. */
export function pavementPath(ax: number, az: number, bx: number, bz: number): Pt[] | null {
  const a = nearestNode(ax, az, 150),
    b = nearestNode(bx, bz, 150);
  if (!a || !b) return null;
  const path = a === b ? [a] : findPath(a, b);
  if (!path) return null;
  const out: Pt[] = [];
  for (let k = 1; k < path.length; k++) {
    const n0 = path[k - 1],
      n1 = path[k];
    const len = Math.hypot(n1.x - n0.x, n1.z - n0.z) || 1;
    const w = n0.out.find(e => e.to === n1.id)?.w ?? 7;
    const off = w / 2 + 1.8;
    const nx = ((n1.z - n0.z) / len) * off,
      nz = (-(n1.x - n0.x) / len) * off;
    out.push([n0.x + nx, n0.z + nz], [n1.x + nx, n1.z + nz]);
  }
  if (!out.length) out.push([a.x, a.z]);
  return out;
}

/** A trip from where someone is (pos) to a spot: out of the building, across town, into the next. */
export function makeTrip(pos: { x: number; y: number; z: number }, to: Spot): Trip {
  const legs: Leg[] = [];
  const walk = (p: Pt, y: number) => legs.push({ k: 'walk', to: p, y, pts: null, j: 0 });
  let cur: Pt = [pos.x, pos.z];
  const A = accessOf(pos),
    B = accessOf(to);
  if (A && B && A.id === B.id) {
    // Within one building: to the lift and up or down if the floors differ.
    if (Math.abs(pos.y - to.y) > 1 && A.lift) {
      walk(A.lift.top, pos.y);
      legs.push({ k: 'lift', to: A.lift.bottom, y: to.y, t: 0 });
    }
    walk([to.x, to.z], to.y);
    return { legs, i: 0, to, check: 0 };
  }
  if (A) {
    if (pos.y > 1 && A.lift) {
      walk(A.lift.top, pos.y);
      legs.push({ k: 'lift', to: A.lift.bottom, y: 0, t: 0 });
      cur = A.lift.bottom;
    }
    if (A.door) walk((cur = A.door), 0);
  }
  const q: Pt = B?.door ?? B?.lift?.bottom ?? [to.x, to.z];
  if (Math.hypot(q[0] - cur[0], q[1] - cur[1]) > 450)
    for (const l of journey(cur[0], cur[1], q[0], q[1])) {
      if (l.k === 'bus') {
        walk(l.board, 0);
        const a = l.r.stops[l.from].s,
          b = l.r.stops[l.to].s;
        const pts: Pt[] = [];
        for (let k = 0; k <= 12; k++) {
          const [x, z] = routeAt(l.r, a + ((b - a) * k) / 12);
          pts.push([x, z]);
        }
        pts.push(l.off);
        legs.push({ k: 'ride', pts, j: 0, label: `On bus ${l.r.no}` });
      } else if (l.k === 'mrt') {
        if (!l.gin) continue;
        walk([l.gin.x, l.gin.z], 0);
        const sts = l.line.stations;
        const a = sts[l.from].s,
          b = sts[l.to].s;
        const pts: Pt[] = [];
        for (let k = 0; k <= 16; k++) {
          const [x, z] = along(l.line, a + ((b - a) * k) / 16);
          pts.push([x, z]);
        }
        pts.push([l.gout.x, l.gout.z]);
        legs.push({ k: 'ride', pts, j: 0, label: `On the ${l.line.name}` });
      }
    }
  walk(q, 0);
  if (B?.lift && to.y > 1) {
    walk(B.lift.bottom, 0);
    legs.push({ k: 'lift', to: B.lift.top, y: to.y, t: 0 });
  }
  walk([to.x, to.z], to.y);
  return { legs, i: 0, to, check: 0 };
}

/** Within this of Aldi a trip is walked at a real stroll (and drawn); further out it keeps the game clock's
    pace, so people aren't late for long just because Aldi is nearby. */
export const SEEN = 40;
const seenFrom = (x: number, z: number, y: number) =>
  Math.hypot(x - player.x, z - player.z) < SEEN && Math.abs(y - player.y) < 6;
/** Plan a walk leg's points: the pavements when Aldi is anywhere near, else straight (it's on paper). */
function route(l: Extract<Leg, { k: 'walk' }>, me: Spot) {
  const d = Math.hypot(l.to[0] - me.x, l.to[1] - me.z);
  const near =
    Math.hypot(me.x - player.x, me.z - player.z) < 350 || Math.hypot(l.to[0] - player.x, l.to[1] - player.z) < 350;
  l.far = !near;
  l.pts = d > 40 && near && l.y < 1 ? [...(pavementPath(me.x, me.z, l.to[0], l.to[1]) ?? []), l.to] : [l.to];
  l.j = 0;
}
/** Move along the trip; `me` is their position (a spot object the renderer reads). True when there. */
/** Off-screen pace, in metres per game minute: a walk, a ride. */
const WALK_GM = 80,
  RIDE_GM = 500;
export function stepTrip(t: Trip, me: Spot, dt: number, gm: number): boolean {
  // In view, at a stroll (sped up with the clock while T is held).
  dt *= timeWarp();
  while (t.i < t.legs.length) {
    const l = t.legs[t.i];
    const seen = seenFrom(me.x, me.z, me.y);
    if (l.k === 'lift') {
      me.hidden = true;
      me.where = 'In the lift';
      // A few real seconds in view; a game minute out of it.
      l.t += seen ? dt / 6 : gm;
      if (l.t < 1) return false;
      me.x = l.to[0];
      me.z = l.to[1];
      me.y = l.y;
      me.hidden = false;
      t.i++;
      continue;
    }
    if (l.k === 'ride') {
      me.hidden = true;
      me.where = l.label;
      if (!follow(l, me, gm * RIDE_GM)) return false;
      me.hidden = false;
      t.i++;
      continue;
    }
    me.hidden = false;
    me.y = l.y;
    me.where = `On the way to ${t.to.where}`;
    if (!l.pts) route(l, me);
    // Aldi came near a leg planned on paper: plan it along the pavements now.
    t.check += dt;
    if (l.far && t.check > 1) {
      t.check = 0;
      if (Math.hypot(me.x - player.x, me.z - player.z) < 300) route(l, me);
    }
    if (!follow(l, me, seen ? dt * 1.35 : gm * WALK_GM)) return false;
    t.i++;
  }
  return true;
}
/** Along a leg's points by up to `left` metres; true when at the end. */
function follow(l: { pts: Pt[] | null; j: number }, me: Spot, left: number) {
  const pts = l.pts!;
  while (left > 0 && l.j < pts.length) {
    const [tx, tz] = pts[l.j];
    const dx = tx - me.x,
      dz = tz - me.z,
      d = Math.hypot(dx, dz);
    if (d < 1e-3) {
      l.j++;
      continue;
    }
    const step = Math.min(d, left);
    me.x += (dx / d) * step;
    me.z += (dz / d) * step;
    me.ry = Math.atan2(dx, dz);
    left -= step;
    if (step >= d) l.j++;
  }
  return l.j >= pts.length;
}
