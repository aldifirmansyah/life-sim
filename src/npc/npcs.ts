/* NPC runtime (spec §8.5, §9). Each resident follows today's schedule blocks:
   at a slot doing an activity, or walking a path to the next slot. Movement is
   driven by game time, so an NPC's position depends only on when it left and
   its path, and every LOD tier can advance it at its own rate:
   - near (< 40 m): simulated and posed every frame, with avoidance and head turns
   - mid (40–80 m): simulated and posed at 10 Hz, simpler animation
   - far (> 80 m): simulated and posed at 1 Hz, hidden past the fog
   Indoors and away NPCs aren't drawn at all. Schedule decisions run on a 1 Hz
   tick (or every game-minute while time is fast-forwarded). */
import { S, DAYS } from '../core/state';
import { player } from '../core/player';
import { hit, circles } from '../core/collision';
import { mulberry32 } from '../core/util';
import { fog } from '../render/context';
import type { NPC } from './types';
import { stageFor } from '../social/social';
import { RESIDENTS, TIES, type ResidentDef } from './roster';
import { generateAppearance } from './appearance';
import { buildPlaces, groups, homes, pois, type P2, type Slot } from './places';
import { buildGraph, buildPath, sample, nodes, edgeCount, type Path } from './navgraph';
import { blockIndexAt } from './schedule';
import { Crowd, type PoseState } from './characters';

export type Tier = 'near' | 'mid' | 'far';
const NEAR = 40,
  MID = 80;
/** Walking speed in metres per game-minute: 1.45 m/s at the base clock rate of 1.2 game-min/s. */
const WALK = 1.45 / 1.2;

export interface Resident {
  i: number;
  def: ResidentDef;
  npc: NPC;
  /** The slot it is at or walking to. */
  slot: Slot;
  /** Index into today's blocks of the block it is serving. */
  block: number;
  state: 'at' | 'walk';
  path: Path | null;
  /** Distance walked along the path, metres. */
  s: number;
  /** Game-minute its movement was last advanced to. */
  simT: number;
  speed: number;
  /** Next departure estimate: travel length to the next block's place. */
  plan: { block: number; len: number } | null;
  // Presentation
  x: number;
  z: number;
  ry: number;
  hidden: boolean;
  tier: Tier;
  dist: number;
  /** 0..1 progress sliding from the approach point onto the slot. */
  settle: number;
  walkAmt: number;
  phase: number;
  headYaw: number;
  avoidX: number;
  avoidZ: number;
  wait: number;
  laneOff: number;
  wander: { x: number; z: number; pause: number } | null;
  poseT: number;
  lastPoseAt: number;
  /** In conversation with Raka: holds still and faces him. */
  talking: boolean;
  /** Currently saying a line (drives the talking gesture). */
  speaking: boolean;
  /** Serving Raka until this clock time (seconds): faces him and reaches across. */
  serveUntil: number;
}

export const residents: Resident[] = [];
/** `Slot.claimedBy` value for a seat Raka is using. */
export const PLAYER = -2;
export let crowd: Crowd;
const rnd = mulberry32(7331);
const hash = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

/** Build places and the waypoint graph. Call after the world, before batches are built (homes may add stools). */
export function initWorldNav() {
  buildPlaces();
  buildGraph();
}

/** Create residents and their meshes. `extras` reserves crowd slots for non-resident figures (pasar stall-keepers). Call after the scene is built. */
export function initResidents(extras = 0) {
  crowd = new Crowd(RESIDENTS.length + extras);
  for (const def of RESIDENTS) {
    const i = residents.length;
    const appearance = generateAppearance({ age: def.age, gender: def.gender, set: def.look }, rnd);
    const relationships: Record<string, number> = {};
    for (const o of RESIDENTS) if (o !== def && o.household === def.household) relationships[o.id] = 70;
    for (const [a, b, v] of TIES) {
      if (a === def.id) relationships[b] = v;
      if (b === def.id) relationships[a] = v;
    }
    const friendship = def.friendship ?? 0;
    const npc: NPC = {
      id: def.id,
      name: def.name,
      address: def.address,
      age: def.age,
      gender: def.gender,
      occupation: def.occupation,
      birthday: def.birthday,
      household: def.household,
      home: homes.get(def.household)!.id,
      traits: def.traits,
      likes: def.likes,
      dislikes: def.dislikes,
      schedule: def.schedule,
      relationships,
      playerRelationship: { friendship, stage: stageFor(friendship), lastTalkedDay: -1, memories: [] },
      mood: 55 + Math.round(rnd() * 25),
      appearance,
    };
    crowd.setAppearance(i, appearance);
    residents.push({
      i,
      def,
      npc,
      slot: homes.get(def.household)!.slots[0],
      block: 0,
      state: 'at',
      path: null,
      s: 0,
      simT: S.time,
      speed: WALK * (def.pace ?? 1) * (0.94 + rnd() * 0.12),
      plan: null,
      x: 0,
      z: 0,
      ry: 0,
      hidden: true,
      tier: 'far',
      dist: 999,
      settle: 1,
      walkAmt: 0,
      phase: rnd() * 6,
      headYaw: 0,
      avoidX: 0,
      avoidZ: 0,
      wait: 0,
      laneOff: 0.3 + rnd() * 0.3,
      wander: null,
      poseT: 0,
      lastPoseAt: -1,
      talking: false,
      speaking: false,
      serveUntil: 0,
    });
  }
  resync();
}

/* ================= schedules and slots ================= */

const today = (r: Resident) => r.npc.schedule[S.day % 7];

function candidates(r: Resident, location: string) {
  const [group, tag = group] = location.split('.');
  const list = group === 'home' ? [homes.get(r.def.household)!] : (groups.get(group) ?? []);
  return { list, tag };
}

/** The slot this NPC would get at a location: free slots first, spread over interchangeable POIs
    (pasar stalls, both kali banks, both roads out). `first` is the fallback when all are taken. */
function findSlot(r: Resident, location: string) {
  const { list, tag } = candidates(r, location);
  const n = list.length;
  const start = n > 1 ? Math.floor(hash(r.i, S.day) * n) : 0;
  let first: Slot | null = null;
  for (let k = 0; k < n; k++)
    for (const s of list[(start + k) % n].slots) {
      if (s.tag !== tag) continue;
      first ??= s;
      if (s.shared || s.claimedBy === -1 || s.claimedBy === r.i) return { slot: s, first };
    }
  if (!first) throw new Error(`No slot for ${location}`);
  return { slot: null, first };
}

/** Claim a slot for a location. Falls back to standing nearby when every slot is taken. */
function claim(r: Resident, location: string): Slot {
  const { slot, first: any } = findSlot(r, location);
  if (slot) {
    if (!slot.shared) slot.claimedBy = r.i;
    return slot;
  }
  // Overflow: stand a little way back from a taken slot, facing it.
  const e = any.poi.entry[any.poi.entry.length - 1];
  const t = 0.35 + hash(r.i, 91) * 0.4;
  const x = any.approach[0] + (e[0] - any.approach[0]) * t + (hash(r.i, 92) - 0.5) * 0.8;
  const z = any.approach[1] + (e[1] - any.approach[1]) * t + (hash(r.i, 93) - 0.5) * 0.8;
  return {
    ...any,
    x,
    z,
    approach: [x, z],
    pose: 'stand',
    y: 0,
    ry: Math.atan2(any.x - x, any.z - z),
    claimedBy: r.i,
    shared: false,
  };
}

function release(r: Resident) {
  if (r.slot.claimedBy === r.i) r.slot.claimedBy = -1;
}

/** Put everyone where their schedule says they are now. Used at start, on a new day and after time jumps. */
export function resync() {
  // Free every slot, except a seat Raka is sitting on (claimed as PLAYER).
  for (const p of pois) for (const s of p.slots) if (s.claimedBy !== PLAYER) s.claimedBy = -1;
  for (const r of residents) {
    const blocks = today(r);
    r.block = blockIndexAt(blocks, S.time);
    r.slot = claim(r, blocks[r.block].location);
    r.state = 'at';
    r.path = null;
    r.plan = null;
    r.wander = null;
    r.simT = S.time;
    r.settle = 1;
    r.x = r.slot.x;
    r.z = r.slot.z;
    r.ry = r.slot.ry;
    r.walkAmt = 0;
    r.lastPoseAt = -1;
    advanceSchedule(r, S.time, true);
  }
}

/** Estimated minutes to walk to a location, cached per block. */
/** Path estimates allowed in this tick; the rest wait for the next one so a rush hour doesn't spike a frame. */
let planBudget = Infinity;
function travelMinutes(r: Resident, block: number, location: string) {
  if (r.plan?.block !== block) {
    if (planBudget <= 0) return null;
    planBudget--;
    const { slot, first } = findSlot(r, location);
    const to = slot ?? first;
    r.plan = { block, len: to === r.slot ? 0 : buildPath(r.slot, to).length };
  }
  return r.plan.len / r.speed;
}

/** 1 Hz schedule tick. */
let tickStart = 0;
function tick() {
  planBudget = 4;
  const n = residents.length;
  tickStart = (tickStart + 1) % n;
  for (let k = 0; k < n; k++) advanceSchedule(residents[(tickStart + k) % n], S.time, false);
  planBudget = Infinity;
}

/** Start walking to the next block's place once it's time to leave, early enough to arrive on
    time. With catchUp (after a resync), a trip that should already be underway starts partway
    along its path, and one that should be over puts the NPC straight at its destination. */
function advanceSchedule(r: Resident, t: number, catchUp: boolean) {
  if (r.talking) return;
  const blocks = today(r);
  for (let guard = 0; guard < blocks.length && r.state === 'at'; guard++) {
    const next = r.block + 1;
    if (next >= blocks.length) return;
    const cur = blocks[r.block],
      nb = blocks[next];
    if (nb.location === cur.location) {
      if (t < nb.start) return;
      r.block = next;
      continue;
    }
    // Nothing is ever more than a few hours' walk away.
    if (t < nb.start - 300) return;
    const travel = travelMinutes(r, next, nb.location);
    if (travel === null) return;
    const leaveAt = nb.start - travel - 1 - hash(r.i * 31 + next, S.day) * 6;
    if (t < leaveAt) return;
    depart(r, next, nb.location);
    if (!catchUp) return;
    r.s = (t - leaveAt) * r.speed;
    if (r.s < r.path!.length) return;
    arrive(r);
  }
}

function arrive(r: Resident) {
  r.state = 'at';
  r.path = null;
  r.settle = 1;
  r.x = r.slot.x;
  r.z = r.slot.z;
  r.ry = r.slot.ry;
}

function depart(r: Resident, block: number, location: string) {
  const from = r.slot;
  release(r);
  const to = claim(r, location);
  const path = buildPath(from, to);
  // Start from where it actually stands (it may have wandered off its slot).
  if (Math.hypot(path.x[0] - r.x, path.z[0] - r.z) > 0.1) {
    path.x.unshift(r.x);
    path.z.unshift(r.z);
    path.lane.unshift(false);
    const d = Math.hypot(path.x[1] - r.x, path.z[1] - r.z);
    path.cum = path.cum.map(c => c + d);
    path.cum.unshift(0);
    path.length += d;
  }
  r.slot = to;
  r.block = block;
  r.plan = null;
  r.path = path;
  r.s = 0;
  r.simT = S.time;
  r.state = 'walk';
  r.wander = null;
  r.settle = 0;
  r.wait = 0;
}

/* ================= movement ================= */

const _pt = { x: 0, z: 0, dx: 0, dz: 1 };

/** Advance movement to game time t. */
function simulate(r: Resident, t: number) {
  const dm = Math.max(0, t - r.simT);
  r.simT = t;
  if (r.talking || r.state !== 'walk' || !r.path) return 0;
  const ds = dm * r.speed;
  r.s += ds;
  if (r.s >= r.path.length) {
    r.s = r.path.length;
    r.state = 'at';
    r.path = null;
  }
  return ds;
}

/** Lateral keep-left offset while walking along a lane, easing to zero near turns. */
function laneOffset(r: Resident, seg: number) {
  const p = r.path!;
  if (!p.lane[seg]) return 0;
  const dirX = p.x[seg + 1] - p.x[seg],
    dirZ = p.z[seg + 1] - p.z[seg];
  const same = (k: number) => {
    const ax = p.x[k + 1] - p.x[k],
      az = p.z[k + 1] - p.z[k];
    return p.lane[k] && Math.abs(ax * dirZ - az * dirX) < 1e-3 && ax * dirX + az * dirZ > 0;
  };
  let a = seg,
    b = seg;
  while (a > 0 && same(a - 1)) a--;
  while (b < p.lane.length - 1 && same(b + 1)) b++;
  const ramp = Math.min(r.s - p.cum[a], p.cum[b + 1] - r.s) / 1.5;
  return r.laneOff * Math.max(0, Math.min(1, ramp));
}

/** Place the NPC for rendering from its sim state. */
function place(r: Resident, dtReal: number, full: boolean) {
  if (r.state === 'walk' && r.path) {
    const seg = sample(r.path, r.s, _pt);
    const off = laneOffset(r, seg);
    r.x = _pt.x - _pt.dz * off;
    r.z = _pt.z + _pt.dx * off;
    const target = r.talking ? Math.atan2(player.x - r.x, player.z - r.z) : Math.atan2(_pt.dx, _pt.dz);
    r.ry = full ? turn(r.ry, target, dtReal * 8) : target;
    return;
  }
  const s = r.slot;
  if (r.wander) {
    if (r.talking) r.ry = turn(r.ry, Math.atan2(player.x - r.x, player.z - r.z), dtReal * 6);
    return;
  }
  // Standing NPCs turn to face Raka while talking or serving him; seated ones stay put and turn their head.
  if ((r.talking || clock < r.serveUntil) && r.settle >= 1 && s.pose === 'stand') {
    r.x = s.x;
    r.z = s.z;
    r.ry = turn(r.ry, Math.atan2(player.x - r.x, player.z - r.z), dtReal * 6);
    return;
  }
  if (r.settle < 1) {
    r.settle = full ? Math.min(1, r.settle + dtReal / 0.6) : 1;
    const k = r.settle * r.settle * (3 - 2 * r.settle);
    r.x = s.approach[0] + (s.x - s.approach[0]) * k;
    r.z = s.approach[1] + (s.z - s.approach[1]) * k;
    r.ry = full ? turn(r.ry, s.ry, dtReal * 6) : s.ry;
  } else {
    r.x = s.x;
    r.z = s.z;
    r.ry = full ? turn(r.ry, s.ry, dtReal * 4) : s.ry;
  }
}

const turn = (a: number, b: number, k: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
};

/** Kids on the lapangan wander between random spots (near and mid tiers only). */
function wander(r: Resident, dtReal: number, dm: number) {
  const w = r.slot.wander;
  if (r.talking && r.wander) return 0;
  if (!w || r.state !== 'at' || r.settle < 1 || r.slot.pose !== 'stand') {
    r.wander = null;
    return 0;
  }
  if (!r.wander) r.wander = { x: r.slot.x, z: r.slot.z, pause: 1 + rnd() * 3 };
  const wd = r.wander;
  const dx = wd.x - r.x,
    dz = wd.z - r.z,
    d = Math.hypot(dx, dz);
  if (d < 0.05) {
    wd.pause -= dtReal;
    if (wd.pause <= 0) {
      wd.x = w[0] + rnd() * (w[1] - w[0]);
      wd.z = w[2] + rnd() * (w[3] - w[2]);
      wd.pause = 1 + rnd() * 4;
    }
    return 0;
  }
  const step = Math.min(d, dm * r.speed * 1.4);
  r.x += (dx / d) * step;
  r.z += (dz / d) * step;
  r.ry = turn(r.ry, Math.atan2(dx, dz), dtReal * 8);
  return step;
}

/** Near tier: sidestep other NPCs and the player; pause if the player blocks the way. */
function avoid(r: Resident, near: Resident[], dtReal: number) {
  let px = 0,
    pz = 0;
  const push = (ox: number, oz: number, R: number) => {
    const dx = r.x - ox,
      dz = r.z - oz,
      d = Math.hypot(dx, dz);
    if (d < R && d > 1e-4) {
      px += (dx / d) * (1 - d / R);
      pz += (dz / d) * (1 - d / R);
    }
  };
  for (const o of near) if (o !== r && !o.hidden) push(o.x - o.avoidX, o.z - o.avoidZ, 0.75);
  push(player.x, player.z, 1.1);
  const tx = Math.max(-0.7, Math.min(0.7, px * 0.6)),
    tz = Math.max(-0.7, Math.min(0.7, pz * 0.6));
  const k = Math.min(1, dtReal * 4);
  r.avoidX += (tx - r.avoidX) * k;
  r.avoidZ += (tz - r.avoidZ) * k;
  // Never sidestep into a wall or post.
  for (let n = 0; n < 3 && hit(r.x + r.avoidX, r.z + r.avoidZ, 0.22); n++) {
    r.avoidX *= 0.5;
    r.avoidZ *= 0.5;
  }
  if (hit(r.x + r.avoidX, r.z + r.avoidZ, 0.22)) r.avoidX = r.avoidZ = 0;
  r.x += r.avoidX;
  r.z += r.avoidZ;
}

/* ================= per-frame update ================= */

let lastT = -1,
  lastDay = -1,
  tickAcc = 0,
  tickT = 0,
  clock = 0;
export const npcStats = { near: 0, mid: 0, far: 0, hidden: 0, walking: 0, ms: 0, tickMs: 0, nodes: 0, edges: 0 };
const pst: PoseState = {
  x: 0,
  z: 0,
  ry: 0,
  seatY: 0,
  pose: 'stand',
  walk: 0,
  phase: 0,
  headYaw: 0,
  gesture: 0,
  reach: 0,
  t: 0,
};
const nearList: Resident[] = [];

export function updateResidents(dtReal: number) {
  const t0 = performance.now();
  const t = S.time;
  clock += dtReal;
  // New day or a jump in time: re-place everyone rather than simulate the gap.
  if (S.day !== lastDay || t < lastT || t - lastT > 30) resync();
  lastT = t;
  lastDay = S.day;
  tickAcc += dtReal;
  if (tickAcc >= 1 || t - tickT >= 1) {
    tickAcc = 0;
    tickT = t;
    const t1 = performance.now();
    tick();
    npcStats.tickMs = performance.now() - t1;
  }
  const renderDist = Math.min(120, fog.far);
  npcStats.near = npcStats.mid = npcStats.far = npcStats.hidden = npcStats.walking = 0;
  nearList.length = 0;
  circles.length = 0;
  for (const r of residents) {
    r.dist = Math.hypot(r.x - player.x, r.z - player.z);
    r.tier = r.dist < NEAR ? 'near' : r.dist < MID ? 'mid' : 'far';
    if (r.tier === 'near') nearList.push(r);
  }
  for (const r of residents) {
    // Mid and far tiers only advance at 10 Hz and 1 Hz.
    const interval = r.tier === 'near' ? 0 : r.tier === 'mid' ? 0.1 : 1;
    const due = clock - r.lastPoseAt >= interval || r.lastPoseAt < 0;
    if (!due) {
      count(r);
      continue;
    }
    const dtR = r.lastPoseAt < 0 ? dtReal : clock - r.lastPoseAt;
    r.lastPoseAt = clock;
    const dm = t - r.simT;
    const wasWalking = r.state === 'walk';
    // Undo last frame's sidestep before moving.
    r.x -= r.avoidX;
    r.z -= r.avoidZ;
    let ds = simulate(r, t);
    const full = r.tier === 'near';
    if (r.state === 'at' && r.tier !== 'far') ds += wander(r, dtR, dm);
    place(r, dtR, full);
    r.hidden = r.state === 'at' && r.settle >= 1 && r.slot.pose === 'hidden';
    if (full && !r.hidden && !r.talking) avoid(r, nearList, dtR);
    else r.avoidX = r.avoidZ = 0;
    const visible = !r.hidden && r.dist < renderDist;
    const moving = wasWalking || ds > 0;
    r.walkAmt = full ? r.walkAmt + ((moving ? 1 : 0) - r.walkAmt) * Math.min(1, dtR * 8) : moving ? 1 : 0;
    r.phase += (ds * Math.PI * 2) / (0.8 * r.npc.appearance.height);
    if (!visible) {
      crowd.hide(r.i);
    } else {
      pose(r, full, dtR);
      if (full) circles.push({ x: r.x, z: r.z, r: 0.28 });
    }
    count(r);
  }
  npcStats.ms = performance.now() - t0;
}

function count(r: Resident) {
  if (r.hidden) npcStats.hidden++;
  else npcStats[r.tier]++;
  if (r.state === 'walk') npcStats.walking++;
}

function pose(r: Resident, full: boolean, dtR: number) {
  const act = today(r)[r.block]?.activity;
  const atSlot = r.state === 'at' && r.settle >= 1 && !r.wander;
  pst.x = r.x;
  pst.z = r.z;
  pst.ry = r.ry;
  pst.seatY = r.slot.y;
  pst.pose = atSlot && r.slot.pose !== 'hidden' ? (r.slot.pose as PoseState['pose']) : 'stand';
  pst.walk = r.walkAmt;
  pst.phase = r.phase;
  pst.t = clock;
  pst.gesture = 0;
  pst.reach = 0;
  let headTarget = 0;
  if (full) {
    if (r.speaking) pst.gesture = 0.55 + 0.45 * Math.sin(clock * 2.1 + r.i);
    else if (atSlot && act === 'chat' && !r.talking) pst.gesture = Math.max(0, Math.sin(clock * 0.45 + r.i * 1.7)) ** 3;
    if (clock < r.serveUntil) pst.reach = 0.9;
    else if (atSlot && act === 'fish') pst.reach = 0.9;
    else if (atSlot && act === 'work' && pst.pose === 'stand') pst.reach = 0.25 + 0.2 * Math.sin(clock * 0.8 + r.i);
    else if (atSlot && act === 'garden') pst.reach = 0.5;
    // Look at the player when he's close and in front.
    if (r.dist < 5) {
      let a = Math.atan2(player.x - r.x, player.z - r.z) - r.ry;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) < 1.9 || r.talking || clock < r.serveUntil) headTarget = Math.max(-1.1, Math.min(1.1, a));
    }
    r.headYaw += (headTarget - r.headYaw) * Math.min(1, dtR * 5);
  } else r.headYaw = 0;
  pst.headYaw = r.headYaw;
  crowd.pose(r.i, pst);
  r.poseT = clock;
}

/* ================= conversation ================= */

/** A shopkeeper hands something over: faces Raka and reaches across for a moment. */
export function serve(r: Resident, seconds = 1.6) {
  r.serveUntil = clock + seconds;
  r.lastPoseAt = -1;
}

/** The resident Raka is looking at within talking range, if any. */
export function talkTarget(yaw: number, range = 2.5): Resident | null {
  // Camera forward on the ground plane.
  const fx = -Math.sin(yaw),
    fz = -Math.cos(yaw);
  let best: Resident | null = null,
    bestA = Infinity;
  for (const r of residents) {
    if (r.hidden || r.tier !== 'near' || r.dist > range) continue;
    const dx = r.x - player.x,
      dz = r.z - player.z,
      d = Math.hypot(dx, dz) || 1e-3;
    const a = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d)));
    // Wider cone up close, where a person fills more of the view.
    if (a < (d < 1.2 ? 0.7 : 0.4) && a < bestA) {
      best = r;
      bestA = a;
    }
  }
  return best;
}

/** Where a resident is heading (for "I'm on my way to..."), or null when not walking. */
export function heading(r: Resident) {
  if (r.state !== 'walk') return null;
  const act = today(r)[r.block]?.activity;
  if (r.slot.poi === homes.get(r.def.household)) return 'home';
  if (r.slot.tag === 'away') return act === 'study' ? (r.def.age < 18 ? 'school' : 'campus') : 'work';
  if (r.slot.poi.id.startsWith('pasar')) return 'the pasar';
  return r.slot.poi.name;
}

/** Name of where a resident is now. */
export function placeName(r: Resident) {
  return r.slot.poi === homes.get(r.def.household)
    ? 'my place'
    : r.slot.poi.id.startsWith('pasar')
      ? 'the pasar'
      : r.slot.poi.name;
}

/* ================= debug helpers ================= */

export function describe(r: Resident) {
  const b = today(r)[r.block];
  const where = r.slot.poi.name;
  return r.state === 'walk' ? `→ ${where} (${b.activity})` : `${b.activity} · ${where}`;
}

export function headPos(r: Resident): [number, number, number] {
  pst.pose =
    r.state === 'at' && r.settle >= 1 && r.slot.pose !== 'hidden' ? (r.slot.pose as PoseState['pose']) : 'stand';
  pst.seatY = r.slot.y;
  return [r.x, crowd.headY(r.i, pst), r.z];
}

export function remainingPath(r: Resident): P2[] {
  if (r.state !== 'walk' || !r.path) return [];
  const out: P2[] = [[r.x, r.z]];
  for (let k = 0; k < r.path.x.length; k++) if (r.path.cum[k] > r.s) out.push([r.path.x[k], r.path.z[k]]);
  return out;
}

export function graphStats() {
  npcStats.nodes = nodes.length;
  npcStats.edges = edgeCount;
}

/** Day-of-week name the schedules are using. */
export const scheduleDay = () => DAYS[S.day % 7];
