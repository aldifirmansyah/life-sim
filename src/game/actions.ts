/* Animated actions: paying and taking things at a shop, sitting down, eating
   and drinking, standing up. Each is a short list of timed steps played on
   wall-clock time; while one runs, S.acting holds input and movement. */
import { S } from '../core/state';
import { player } from '../core/player';
import { Hands, POSES, type HandPose } from '../render/hands';
import { pois, type Slot } from '../npc/places';
import { PLAYER } from '../npc/npcs';
import { item } from './items';

interface Step {
  dur: number;
  start?: () => void;
  /** k runs 0..1 over the step. */
  update?: (k: number) => void;
  end?: () => void;
}
let queue: Step[] = [];
let cur: { step: Step; t0: number } | null = null;
let onDone: (() => void) | null = null;
let hands: Hands;

export function initActions() {
  hands = new Hands();
}

function run(steps: Step[], done?: () => void) {
  S.acting = true;
  queue = steps;
  onDone = done ?? null;
  next();
}
function next() {
  const step = queue.shift();
  if (!step) {
    cur = null;
    S.acting = false;
    hands.hide();
    const d = onDone;
    onDone = null;
    d?.();
    return;
  }
  cur = { step, t0: performance.now() };
  step.start?.();
}

/** Every frame. */
export function updateActions() {
  if (!cur) return;
  const k = Math.min(1, (performance.now() - cur.t0) / 1000 / cur.step.dur);
  cur.step.update?.(k);
  if (k >= 1) {
    cur.step.end?.();
    next();
  }
}

/** Esc while acting: jump to the end, keeping every effect. */
export function skipAction() {
  if (!cur) return;
  cur.step.update?.(1);
  cur.step.end?.();
  for (const s of queue) {
    s.start?.();
    s.update?.(1);
    s.end?.();
  }
  queue = [];
  next();
}

/* ================= hands ================= */

const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const ease = (k: number) => k * k * (3 - 2 * k);

const move = (dur: number, side: 'R' | 'L', a: HandPose, b: HandPose, extra?: Partial<Step>): Step => ({
  dur,
  ...extra,
  update: k => {
    hands.set(side, a, b, k);
    extra?.update?.(k);
  },
});
const wait = (dur: number, extra?: Partial<Step>): Step => ({ dur, ...extra });

/** Pay with the left hand while the seller passes the item into the right, turning to face them. */
function payAndTake(id: string, serve: () => void, seller?: [number, number]): Step[] {
  const cat = item(id).cat;
  let y0 = 0,
    y1 = 0;
  return [
    move(0.35, 'L', POSES.hiddenL, POSES.payL, {
      start: () => {
        serve();
        hands.showNote(true);
        hands.hold(null);
        y0 = player.yaw;
        y1 = seller ? Math.atan2(-(seller[0] - player.x), -(seller[1] - player.z)) : y0;
      },
      update: k => (player.yaw = lerpAngle(y0, y1, ease(k))),
    }),
    move(0.3, 'R', POSES.hiddenR, POSES.reachR, { start: () => hands.hold(id, cat) }),
    {
      dur: 0.35,
      start: () => hands.showNote(false),
      update: k => {
        hands.set('L', POSES.payL, POSES.hiddenL, k);
        hands.set('R', POSES.reachR, POSES.holdR, k);
      },
    },
    wait(0.35),
  ];
}

/** Bites (or sips) of whatever is in the right hand, then put it away. */
function consumeSteps(id: string): Step[] {
  const it = item(id);
  const drink = it.cat === 'drink';
  const mouth = drink ? POSES.sipR : POSES.mouthR;
  const n = it.cat === 'meal' || it.cat === 'dish' ? 4 : drink ? 3 : 2;
  const out: Step[] = [];
  for (let i = 0; i < n; i++) {
    out.push(move(0.3, 'R', POSES.holdR, mouth));
    out.push({
      dur: drink ? 0.55 : 0.4,
      update: k => hands.set('R', mouth, mouth, 1, Math.sin(k * Math.PI * (drink ? 1 : 3)) * 0.01),
      // Food gets smaller with every bite; bowls and cups stay (you eat from them).
      end: () => {
        if (!drink && it.cat !== 'meal' && id !== 'kolak') hands.bite(Math.max(0.25, 1 - (i + 1) / n));
      },
    });
    out.push(move(0.3, 'R', mouth, POSES.holdR));
    out.push(wait(0.25));
  }
  out.push(move(0.35, 'R', POSES.holdR, POSES.hiddenR));
  return out;
}

/* ================= seats ================= */

/** Somewhere Raka can sit: a free POI seat (his own teras bench is one too). */
export interface Seat {
  x: number;
  z: number;
  y: number;
  ry: number;
  approach: [number, number];
  slot?: Slot;
  taken?: boolean;
}

/** The nearest free seat within reach, if any. */
export function findSeat(maxDist = 4): Seat | null {
  let best: Seat | null = null,
    bd = maxDist;
  const consider = (s: Seat) => {
    const d = Math.hypot(s.approach[0] - player.x, s.approach[1] - player.z);
    if (d < bd) {
      bd = d;
      best = s;
    }
  };
  for (const p of pois)
    for (const s of p.slots)
      if (s.pose === 'sit' && !s.shared && s.claimedBy === -1)
        consider({ x: s.x, z: s.z, y: s.y, ry: s.ry, approach: s.approach, slot: s });
  return best;
}

function sitSteps(seat: Seat): Step[] {
  let sx = 0,
    sz = 0,
    syaw = 0,
    spitch = 0;
  const [ax, az] = seat.approach;
  // Seated, Raka looks the way the seat faces (camera forward is -z, seats face +z at ry 0).
  const faceYaw = seat.ry + Math.PI;
  const dist = Math.hypot(ax - player.x, az - player.z);
  return [
    {
      dur: Math.min(1.2, 0.25 + dist * 0.25),
      start: () => {
        sx = player.x;
        sz = player.z;
        syaw = player.yaw;
        spitch = player.pitch;
        if (seat.slot) seat.slot.claimedBy = PLAYER;
        seat.taken = true;
      },
      update: k => {
        const e = ease(k);
        player.x = sx + (ax - sx) * e;
        player.z = sz + (az - sz) * e;
        // Walk over looking at the seat, then turn round to sit.
        player.yaw = lerpAngle(syaw, Math.atan2(-(seat.x - sx), -(seat.z - sz)), e);
        player.pitch = spitch + (-0.2 - spitch) * e;
      },
    },
    {
      dur: 0.6,
      start: () => (syaw = player.yaw),
      update: k => {
        const e = ease(k);
        player.x = ax + (seat.x - ax) * e;
        player.z = az + (seat.z - az) * e;
        player.eye = 1.7 + (seat.y + 0.72 - 1.7) * e;
        player.yaw = lerpAngle(syaw, faceYaw, e);
        player.pitch = -0.2 - 0.1 * e;
      },
    },
  ];
}

function standSteps(seat: Seat): Step[] {
  return [
    {
      dur: 0.55,
      update: k => {
        const e = ease(k);
        player.eye = seat.y + 0.72 + (1.7 - seat.y - 0.72) * e;
        player.x = seat.x + (seat.approach[0] - seat.x) * e;
        player.z = seat.z + (seat.approach[1] - seat.z) * e;
        player.pitch = -0.3 + 0.3 * e;
      },
      end: () => {
        player.eye = 1.7;
        if (seat.slot && seat.slot.claimedBy === PLAYER) seat.slot.claimedBy = -1;
        seat.taken = false;
      },
    },
  ];
}

/* ================= public sequences ================= */

/** Buy something to take away: pay, take it, put it in the bag. */
export function buyToBag(id: string, serve: () => void, seller: [number, number] | undefined, done: () => void) {
  run([...payAndTake(id, serve, seller), move(0.35, 'R', POSES.holdR, POSES.hiddenR)], done);
}

/** Buy something to have on the spot: pay, take it, sit down if there's a seat, eat or drink it, get up. */
export function buyAndConsume(
  id: string,
  serve: () => void,
  seller: [number, number] | undefined,
  seat: Seat | null,
  done: () => void,
) {
  const steps = payAndTake(id, serve, seller);
  if (seat) steps.push(...sitSteps(seat));
  steps.push(...consumeSteps(id));
  if (seat) steps.push(...standSteps(seat));
  run(steps, done);
}

/** Eat or drink something from the bag. Meals and home cooking are eaten sitting down if a seat is close. */
export function consumeFromBag(id: string, seat: Seat | null, done: () => void) {
  const it = item(id);
  const steps: Step[] = [];
  if (seat) steps.push(...sitSteps(seat));
  steps.push(move(0.4, 'R', POSES.hiddenR, POSES.holdR, { start: () => hands.hold(id, it.cat) }));
  steps.push(...consumeSteps(id));
  if (seat) steps.push(...standSteps(seat));
  run(steps, done);
}

/** Work with a tool in hand: sweep, cast a line, strum. Swings between two poses a few times. */
export function useTool(
  id: string,
  a: HandPose,
  b: HandPose,
  strokes: number,
  stroke: number,
  done: () => void,
  onStroke?: (i: number) => void,
) {
  const steps: Step[] = [move(0.35, 'R', POSES.hiddenR, a, { start: () => hands.hold(id, 'gift') })];
  for (let i = 0; i < strokes; i++) {
    steps.push(move(stroke, 'R', a, b, { end: () => onStroke?.(i) }));
    steps.push(move(stroke, 'R', b, a));
  }
  steps.push(move(0.35, 'R', a, POSES.hiddenR));
  run(steps, done);
}

/* ================= at home ================= */

/** Sit down, do something (which calls `standUp` when it's over), then get up. */
export function sitFor(seat: Seat, during: (standUp: () => void) => void) {
  run(sitSteps(seat), () => during(() => run(standSteps(seat))));
}

/** Walk to a spot and look at something (a stove, the bak), do it, then look up again. */
export function standFor(at: [number, number], look: [number, number, number], during: (done: () => void) => void) {
  let sx = 0,
    sz = 0,
    syaw = 0,
    spitch = 0;
  const dist = Math.hypot(at[0] - player.x, at[1] - player.z);
  run(
    [
      {
        dur: Math.min(1.2, 0.3 + dist * 0.3),
        start: () => {
          sx = player.x;
          sz = player.z;
          syaw = player.yaw;
          spitch = player.pitch;
        },
        update: k => {
          const e = ease(k);
          player.x = sx + (at[0] - sx) * e;
          player.z = sz + (at[1] - sz) * e;
          const yaw = Math.atan2(-(look[0] - at[0]), -(look[2] - at[1]));
          const pitch = Math.atan2(look[1] - player.eye, Math.hypot(look[0] - at[0], look[2] - at[1]));
          player.yaw = lerpAngle(syaw, yaw, e);
          player.pitch = spitch + (pitch - spitch) * e;
        },
      },
    ],
    () =>
      during(() =>
        run([{ dur: 0.4, start: () => (spitch = player.pitch), update: k => (player.pitch = spitch * (1 - ease(k))) }]),
      ),
  );
}

/** A bed: where Raka lies (head end, eye height, the way he faces lying down) and where he gets in and out. */
export interface Bed {
  x: number;
  z: number;
  eye: number;
  yaw: number;
  side: [number, number];
}
/** Lying on his back, looking at the ceiling. */
function lyingPose(b: Bed, k = 1) {
  player.eye = 1.7 + (b.eye - 1.7) * k;
  player.pitch = 1.25 * k;
}
/** Lie down on the bed; `during` calls `getUp` when it's over. */
export function lieFor(b: Bed, during: (getUp: () => void) => void) {
  let sx = 0,
    sz = 0,
    syaw = 0;
  run(
    [
      {
        dur: Math.min(1.2, 0.3 + Math.hypot(b.side[0] - player.x, b.side[1] - player.z) * 0.3),
        start: () => {
          sx = player.x;
          sz = player.z;
          syaw = player.yaw;
        },
        update: k => {
          const e = ease(k);
          player.x = sx + (b.side[0] - sx) * e;
          player.z = sz + (b.side[1] - sz) * e;
          player.yaw = lerpAngle(syaw, Math.atan2(-(b.x - b.side[0]), -(b.z - b.side[1])), e);
          player.pitch = -0.35 * e;
        },
      },
      {
        dur: 1.1,
        start: () => (syaw = player.yaw),
        update: k => {
          const e = ease(k);
          player.x = b.side[0] + (b.x - b.side[0]) * e;
          player.z = b.side[1] + (b.z - b.side[1]) * e;
          player.yaw = lerpAngle(syaw, b.yaw, e);
          player.eye = 1.7 + (b.eye - 1.7) * e;
          player.pitch = -0.35 + (1.25 + 0.35) * e;
        },
      },
      wait(0.5),
    ],
    () => during(() => getUp(b)),
  );
}
/** Put Raka in bed, lying down (waking up in the morning). */
export function placeInBed(b: Bed) {
  player.x = b.x;
  player.z = b.z;
  player.yaw = b.yaw;
  lyingPose(b);
}
/** Sit up, swing the legs over and stand by the bed. */
export function getUp(b: Bed) {
  let syaw = 0;
  run([
    wait(0.6),
    {
      dur: 0.9,
      update: k => {
        const e = ease(k);
        player.pitch = 1.25 * (1 - e) - 0.2 * e;
        player.eye = b.eye + (1.05 - b.eye) * e;
      },
    },
    {
      dur: 0.9,
      start: () => (syaw = player.yaw),
      update: k => {
        const e = ease(k);
        player.x = b.x + (b.side[0] - b.x) * e;
        player.z = b.z + (b.side[1] - b.z) * e;
        player.yaw = lerpAngle(syaw, Math.atan2(-(b.side[0] - b.x), -(b.side[1] - b.z)), e);
        player.eye = 1.05 + (1.7 - 1.05) * e;
        player.pitch = -0.2 * (1 - e);
      },
      end: () => {
        player.eye = 1.7;
        player.pitch = 0;
      },
    },
  ]);
}
