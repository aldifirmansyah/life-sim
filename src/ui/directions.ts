/* Directions: how to get to wherever the marker points (or a pin dropped on the
   map). A small journey planner over the ways Aldi can travel: walking, the buses
   (96, 12, 138) and the MRT (both lines), with up to two rides and a walk between
   them. It picks the quickest, keeps to the plan it chose unless another is clearly
   better, and turns it into steps (the #route box) and a waypoint for the marker:
   the bus stop to wait at and which way the bus goes, the station and the platform,
   where to get off, the way out. Aboard, it points at the stop to get off at. The
   planned route is drawn on the map and the minimap. */
import { $ } from '../core/util';
import { player } from '../core/player';
import { placeName } from '../city/geo';
import { poles, stopPoint, routeAt, busRideInfo, busRideMinutes, type Route } from '../city/buses';
import { trainRideInfo, rideMinutes } from '../city/trains';
import { fareGates, type FareGate } from '../city/mrtbuild';
import { LINES, along, PLAT_IN, PLAT_OUT, type Line, type Station } from '../city/mrtdata';
import { toast } from './hud';

type Pt = [number, number];
export interface BusLeg {
  k: 'bus';
  r: Route;
  dir: number;
  /** The stop boarded at (−1: already aboard). */
  from: number;
  to: number;
  board: Pt;
  off: Pt;
}
export interface MrtLeg {
  k: 'mrt';
  line: Line;
  dir: 1 | -1;
  /** Station indices (from −1: already aboard). */
  from: number;
  to: number;
  /** The gate to tap in at (null: already inside) and the way out at the other end. */
  gin: FareGate | null;
  gout: FareGate;
}
export interface ExitLeg {
  k: 'exit';
  gate: FareGate;
}
export type Leg = BusLeg | MrtLeg | ExitLeg;
interface Opt {
  secs: number;
  legs: Leg[];
  key: string;
}
export interface Plan {
  legs: Leg[];
  secs: number;
  key: string;
  tx: number;
  tz: number;
  label: string;
  /** When walking is quickest: the best ride instead, in a line. */
  alt?: string;
  /** Where the plan was made from (the route is drawn from here). */
  fx: number;
  fz: number;
}

/* ---------- costs (real seconds) ---------- */
const WALK = 2.7; // walking pace with the detours of the streets
const BUS_V = 10,
  BUS_STOP = 9,
  BUS_WAIT = 45;
const MRT_V = 30,
  MRT_STOP = 8,
  MRT_IN = 45,
  MRT_OUT = 15;
/** Each ride costs a little more than its time: a walk is preferred when it's close. */
const RIDE = 30;
const walkT = (ax: number, az: number, bx: number, bz: number) => Math.hypot(bx - ax, bz - az) / WALK;

/* ---------- stations ---------- */
const gates = new Map<Station, FareGate[]>();
function gatesOf(st: Station) {
  let g = gates.get(st);
  if (!g) gates.set(st, (g = fareGates.filter(f => f.station === st)));
  return g;
}
function nearGate(st: Station, x: number, z: number) {
  let best = gatesOf(st)[0],
    d = Infinity;
  for (const g of gatesOf(st)) {
    const e = Math.hypot(g.x - x, g.z - z);
    if (e < d) {
      d = e;
      best = g;
    }
  }
  return best;
}
const endOf = (l: Line, dir: number) => (dir === 1 ? l.stations[l.stations.length - 1] : l.stations[0]);
const busEnd = (r: Route, dir: number) => (dir === 1 ? r.stops[r.stops.length - 1] : r.stops[0]).name;
/** Where to stand on the platform for trains going dir (side −1 serves trains towards the last station). */
function platformPoint(st: Station, dir: number, out = PLAT_IN + 1.2): Pt {
  const side = dir === 1 ? -1 : 1;
  return [st.x - st.dz * side * out, st.z + st.dx * side * out];
}
/** Is Aldi inside a station (past the gates: on the stairs or a platform)? */
export function stationHere(): { line: Line; st: Station; i: number } | null {
  if (player.y < 0.6) return null;
  let best: { line: Line; st: Station; i: number } | null = null,
    bd = 46;
  for (const line of LINES)
    line.stations.forEach((st, i) => {
      const d = Math.hypot(st.x - player.x, st.z - player.z);
      if (d < bd && player.y < line.floor + 3) {
        bd = d;
        best = { line, st, i };
      }
    });
  return best;
}

/* ---------- the planner ---------- */
type Memo = Map<string, Opt>;
/** The quickest way between two points for anyone (the named people use it): the rides, or [] to walk. */
export function journey(ax: number, az: number, bx: number, bz: number): Leg[] {
  const walk = walkT(ax, az, bx, bz);
  let best: Opt = { secs: walk, legs: [], key: 'walk' };
  for (const o of options(ax, az, bx, bz, false, null, 2, new Map(), walk)) if (o.secs < best.secs) best = o;
  return best.legs;
}
/** The quickest way from (x, z) to the target, with at most `depth` more rides. */
function tail(
  x: number,
  z: number,
  tx: number,
  tz: number,
  noBus: boolean,
  noLine: Line | null,
  depth: number,
  memo: Memo,
) {
  let best: Opt = { secs: walkT(x, z, tx, tz), legs: [], key: 'walk' };
  if (depth <= 0) return best;
  for (const o of options(x, z, tx, tz, noBus, noLine, depth, memo, best.secs)) if (o.secs < best.secs) best = o;
  return best;
}
/** Every first ride from (x, z), each with the best way on from where it ends. */
function options(
  x: number,
  z: number,
  tx: number,
  tz: number,
  noBus: boolean,
  noLine: Line | null,
  depth: number,
  memo: Memo,
  cap = Infinity,
): Opt[] {
  const out: Opt[] = [];
  if (!noBus)
    for (const p of poles) {
      const w = walkT(x, z, p.x, p.z) + BUS_WAIT + RIDE;
      if (w > cap) continue;
      const st = p.r.stops;
      for (let j = p.stop + p.dir; j >= 0 && j < st.length; j += p.dir) {
        const ride = Math.abs(st[j].s - st[p.stop].s) / BUS_V + BUS_STOP * Math.abs(j - p.stop);
        const off = stopPoint(p.r, j, p.dir);
        const mk = `b${p.r.no}:${p.dir}:${j}:${noLine?.id ?? ''}:${depth}`;
        let t = memo.get(mk);
        if (!t) memo.set(mk, (t = tail(off[0], off[1], tx, tz, true, noLine, depth - 1, memo)));
        out.push({
          secs: w + ride + t.secs,
          legs: [{ k: 'bus', r: p.r, dir: p.dir, from: p.stop, to: j, board: [p.x, p.z], off }, ...t.legs],
          key: `b${p.r.no}:${p.stop}>${j}`,
        });
      }
    }
  for (const line of LINES) {
    if (line === noLine) continue;
    line.stations.forEach((a, ia) => {
      const gin = nearGate(a, x, z);
      const w = walkT(x, z, gin.x, gin.z) + MRT_IN + RIDE;
      if (w > cap) return;
      line.stations.forEach((b, ib) => {
        if (ib === ia) return;
        const ride = Math.abs(b.s - a.s) / MRT_V + MRT_STOP * Math.abs(ib - ia);
        const mk = `m${line.id}${ib}:${noBus}:${depth}`;
        let t = memo.get(mk);
        const gout = nearGate(b, tx, tz);
        if (!t) memo.set(mk, (t = tail(gout.x, gout.z, tx, tz, noBus, line, depth - 1, memo)));
        out.push({
          secs: w + ride + MRT_OUT + t.secs,
          legs: [{ k: 'mrt', line, dir: ib > ia ? 1 : -1, from: ia, to: ib, gin, gout }, ...t.legs],
          key: `m${line.id}${ia}>${ib}`,
        });
      });
    });
  }
  return out;
}
/** All the ways on from where Aldi is now (on foot, in a station, on a bus or a train). */
function candidates(tx: number, tz: number): Opt[] {
  const memo: Memo = new Map();
  const bus = busRideInfo();
  if (bus) {
    const out: Opt[] = [];
    const st = bus.r.stops;
    const first = bus.stop >= 0 ? bus.stop : bus.next;
    for (let j = first; j >= 0 && j < st.length; j += bus.dir) {
      const ride = Math.abs(st[j].s - bus.s) / BUS_V + BUS_STOP * Math.abs(j - first);
      const off = stopPoint(bus.r, j, bus.dir);
      const t = tail(off[0], off[1], tx, tz, true, null, 1, memo);
      out.push({
        secs: ride + t.secs,
        legs: [{ k: 'bus', r: bus.r, dir: bus.dir, from: -1, to: j, board: off, off }, ...t.legs],
        key: `rb${j}`,
      });
    }
    return out;
  }
  const tr = trainRideInfo();
  if (tr) {
    const out: Opt[] = [];
    const sts = tr.line.stations;
    const first = tr.stop >= 0 ? tr.stop : tr.next;
    for (let j = first; j >= 0 && j < sts.length; j += tr.dir) {
      const ride = Math.abs(sts[j].s - tr.s) / MRT_V + MRT_STOP * Math.abs(j - first);
      const gout = nearGate(sts[j], tx, tz);
      const t = tail(gout.x, gout.z, tx, tz, false, tr.line, 1, memo);
      out.push({
        secs: ride + MRT_OUT + t.secs,
        legs: [{ k: 'mrt', line: tr.line, dir: tr.dir, from: -1, to: j, gin: null, gout }, ...t.legs],
        key: `rt${j}`,
      });
    }
    return out;
  }
  const inside = stationHere();
  if (inside) {
    const { line, st, i } = inside;
    const out: Opt[] = [];
    const g = nearGate(st, tx, tz);
    const t = tail(g.x, g.z, tx, tz, false, line, 2, memo);
    out.push({
      secs: walkT(player.x, player.z, g.x, g.z) + t.secs,
      legs: [{ k: 'exit', gate: g }, ...t.legs],
      key: 'exit',
    });
    line.stations.forEach((b, ib) => {
      if (ib === i) return;
      const ride = Math.abs(b.s - st.s) / MRT_V + MRT_STOP * Math.abs(ib - i);
      const gout = nearGate(b, tx, tz);
      const t2 = tail(gout.x, gout.z, tx, tz, false, line, 1, memo);
      out.push({
        secs: 20 + ride + MRT_OUT + t2.secs,
        legs: [{ k: 'mrt', line, dir: ib > i ? 1 : -1, from: i, to: ib, gin: null, gout }, ...t2.legs],
        key: `m${line.id}${i}>${ib}`,
      });
    });
    return out;
  }
  const walk = walkT(player.x, player.z, tx, tz);
  const out = options(player.x, player.z, tx, tz, false, null, 2, memo, walk * 1.2 + 10);
  out.push({ secs: walk, legs: [], key: 'walk' });
  return out;
}

let plan: Plan | null = null;
let acc = 99;
function replan(tx: number, tz: number, label: string) {
  const all = candidates(tx, tz);
  if (!all.length) {
    plan = null;
    return;
  }
  let best = all[0];
  for (const o of all) if (o.secs < best.secs) best = o;
  // Keep to the plan already chosen unless another is clearly quicker.
  const same = plan && Math.hypot(plan.tx - tx, plan.tz - tz) < 20 ? all.find(o => o.key === plan!.key) : undefined;
  if (same && same.secs < best.secs * 1.2 + 10) best = same;
  plan = { ...best, tx, tz, label, fx: player.x, fz: player.z };
  if (!best.legs.length) {
    let ride: Opt | null = null;
    for (const o of all) if (o.legs.length && (!ride || o.secs < ride.secs)) ride = o;
    const f = ride?.legs[0];
    if (ride && f && ride.secs < best.secs * 1.8)
      plan.alt =
        f.k === 'bus'
          ? `Or bus ${f.r.no} from ${f.r.stops[f.from].name}, towards ${busEnd(f.r, f.dir)}`
          : f.k === 'mrt' && f.from >= 0
            ? `Or the ${f.line.name} from ${f.line.stations[f.from].name} to ${f.line.stations[f.to].name}`
            : undefined;
  }
}

/* ---------- the pin (dropped on the map) ---------- */
export let pin: { x: number; z: number; label: string } | null = null;
export function setPin(x: number, z: number, label?: string) {
  pin = { x, z, label: label ?? `Pin · ${placeName(x, z)}` };
  plan = null;
  acc = 99;
}
export function clearPin() {
  pin = null;
  plan = null;
}

/* ---------- guiding ---------- */
export const currentPlan = () => plan;
/** The target the marker would show (for the minimap), set by guide(). */
export let target: { x: number; z: number; label: string } | null = null;
let lastRide = '';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** Turns the marker's target into the next waypoint of the plan, and fills in the steps box. */
export function guide(w: { label: string; at: [number, number, number] } | null, dt: number) {
  if (pin && Math.hypot(pin.x - player.x, pin.z - player.z) < 14) {
    toast('You made it', pin.label.replace('Pin · ', ''), null);
    clearPin();
  }
  if (pin) w = { label: pin.label, at: [pin.x, 0, pin.z] };
  target = w ? { x: w.at[0], z: w.at[2], label: w.label } : null;
  const box = $('route');
  const bus = busRideInfo(),
    tr = trainRideInfo();
  // In a taxi, Aldi's car or the cable car: straight to the target.
  const other = !!player.ride && !bus && !tr;
  if (!w && (bus || tr)) {
    plan = null;
    rideBox(box);
    return w;
  }
  if (!w || other || (!bus && !tr && !stationHere() && Math.hypot(w.at[0] - player.x, w.at[2] - player.z) < 160)) {
    plan = null;
    box.hidden = true;
    return w;
  }
  const ride = bus ? 'b' + bus.r.no : tr ? 't' + tr.line.id : '';
  acc += dt;
  if (
    !plan ||
    ride !== lastRide ||
    acc > 1.5 ||
    Math.hypot(plan.tx - w.at[0], plan.tz - w.at[2]) > 20 ||
    plan.label !== w.label
  ) {
    acc = 0;
    lastRide = ride;
    replan(w.at[0], w.at[2], w.label);
  }
  if (!plan) {
    box.hidden = true;
    return w;
  }
  const steps: string[] = [];
  let now = 0;
  let way: { label: string; at: [number, number, number] } = w;
  plan.legs.forEach((leg, n) => {
    const first = n === 0;
    if (leg.k === 'bus') {
      const r = leg.r;
      const stops = r.stops;
      if (leg.from >= 0) {
        steps.push(`Walk to the bus ${r.no} stop at ${stops[leg.from].name} (the side for ${busEnd(r, leg.dir)})`);
        if (first) {
          const at = Math.hypot(leg.board[0] - player.x, leg.board[1] - player.z) < 7;
          way = {
            label: at ? `Wait for bus ${r.no}` : `Bus ${r.no} stop → ${busEnd(r, leg.dir)}`,
            at: [leg.board[0], 0, leg.board[1]],
          };
        }
      }
      const n = leg.from >= 0 ? Math.abs(leg.to - leg.from) : 0;
      steps.push(
        leg.from >= 0
          ? `Bus ${r.no} towards ${busEnd(r, leg.dir)}: ${plural(n, 'stop')}, get off at ${stops[leg.to].name}`
          : `Stay on bus ${r.no} to ${stops[leg.to].name} (${eta(busRideMinutes(leg.to))}); E to ring the bell`,
      );
      if (first && leg.from < 0) {
        now = steps.length - 1;
        const standing = bus && bus.stop === leg.to;
        way = {
          label: standing ? 'Get off here · E' : `Get off at ${stops[leg.to].name}`,
          at: [leg.off[0], 0, leg.off[1]],
        };
      }
    } else if (leg.k === 'mrt') {
      const l = leg.line;
      const sts = l.stations;
      const to = sts[leg.to];
      const end = endOf(l, leg.dir).name;
      if (leg.gin) {
        steps.push(`Walk to ${sts[leg.from].name} MRT and tap in`);
        if (first) way = { label: `${sts[leg.from].name} MRT`, at: [leg.gin.x, 0, leg.gin.z] };
      }
      steps.push(
        leg.from >= 0
          ? `${l.name} towards ${end}: ${plural(Math.abs(leg.to - leg.from), 'stop')}, get off at ${to.name}`
          : `Stay on to ${to.name} (${eta(rideMinutes(leg.to))}); E to pick the stop`,
      );
      if (first && !leg.gin) {
        now = steps.length - 1;
        if (tr) {
          const standing = tr.stop === leg.to;
          way = { label: standing ? 'Get off here' : `Get off at ${to.name}`, at: [to.x, l.floor, to.z] };
        } else {
          const st = sts[leg.from];
          const [px, pz] = platformPoint(st, leg.dir);
          const up = Math.abs(player.y - l.floor) < 1;
          // Which platform Aldi is on: the side of the station's normal.
          const side = Math.sign((player.x - st.x) * -st.dz + (player.z - st.z) * st.dx);
          const wrong = up && side === (leg.dir === 1 ? 1 : -1);
          if (wrong) {
            const [cx, cz] = platformPoint(st, -leg.dir, PLAT_OUT - 0.8);
            way = { label: `Other platform (to ${end}) · cross here`, at: [cx + st.dx * 6, l.floor, cz + st.dz * 6] };
          } else way = { label: `Platform: trains to ${end}`, at: [px, l.floor, pz] };
        }
      }
    } else {
      steps.push(`Leave by the fare gates`);
      if (first) way = { label: 'Way out', at: [leg.gate.x, 0, leg.gate.z] };
    }
  });
  const last = plan.legs[plan.legs.length - 1];
  const from: Pt = !last
    ? [player.x, player.z]
    : last.k === 'bus'
      ? last.off
      : last.k === 'mrt'
        ? [last.gout.x, last.gout.z]
        : [last.gate.x, last.gate.z];
  steps.push(`Walk to ${w.label} (${Math.round(Math.hypot(from[0] - w.at[0], from[1] - w.at[2]) / 10) * 10} m)`);
  box.hidden = false;
  const html =
    `<b>Getting to ${esc(w.label)}</b>` +
    steps.map((s, i) => `<span class="${i < now ? 'done' : i === now ? 'now' : ''}">${esc(s)}</span>`).join('') +
    (plan.alt ? `<em>${esc(plan.alt)}</em>` : '') +
    (plan.secs > 200 && !player.ride ? `<em>Or book a Nab on the phone (P)</em>` : '');
  if (box.innerHTML !== html) box.innerHTML = html;
  return way;
}
const eta = (m: number) => (Number.isNaN(m) ? '…' : m < 0.5 ? 'here' : `${Math.max(1, Math.round(m))} min`);
/** Aboard with nowhere in particular to go: the next stops and how long to each. */
function rideBox(box: HTMLElement) {
  const bus = busRideInfo(),
    tr = trainRideInfo();
  const rows: string[] = [];
  let title = '';
  if (bus) {
    const st = bus.r.stops;
    title = `Bus ${bus.r.no} to ${busEnd(bus.r, bus.dir)}`;
    for (let j = bus.stop >= 0 ? bus.stop : bus.next; j >= 0 && j < st.length && rows.length < 5; j += bus.dir)
      rows.push(`${st[j].name} · ${eta(busRideMinutes(j))}`);
  } else if (tr) {
    const sts = tr.line.stations;
    title = `${tr.line.name} to ${endOf(tr.line, tr.dir).name}`;
    for (let j = tr.stop >= 0 ? tr.stop : tr.next; j >= 0 && j < sts.length && rows.length < 5; j += tr.dir)
      rows.push(`${sts[j].name} · ${eta(rideMinutes(j))}`);
  }
  const html =
    `<b>${esc(title)}</b>` +
    rows.map((r, i) => `<span class="${i === 0 ? 'now' : ''}">${esc(r)}</span>`).join('') +
    `<em>E: ${bus ? 'ring the bell for a stop' : 'pick where to get off'}</em>`;
  box.hidden = false;
  if (box.innerHTML !== html) box.innerHTML = html;
}
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

/* ---------- drawing the route (map and minimap) ---------- */
/** Draws the plan onto a 2D map with the projection P; `px` is the line width scale. */
export function drawRoute(g: CanvasRenderingContext2D, P: (x: number, z: number) => [number, number], px = 1) {
  if (!target) return;
  const path: Pt[][] = [];
  const walks: Pt[][] = [];
  let cur: Pt = [player.x, player.z];
  if (plan) {
    for (const leg of plan.legs) {
      if (leg.k === 'bus') {
        if (leg.from >= 0) walks.push([cur, leg.board]);
        const a = leg.from >= 0 ? leg.r.stops[leg.from].s : (busRideInfo()?.s ?? leg.r.stops[leg.to].s);
        const b = leg.r.stops[leg.to].s;
        const pts: Pt[] = [];
        const n = Math.max(2, Math.ceil(Math.abs(b - a) / 15));
        for (let i = 0; i <= n; i++) {
          const [x, z] = routeAt(leg.r, a + ((b - a) * i) / n);
          pts.push([x, z]);
        }
        path.push(pts);
        cur = leg.off;
      } else if (leg.k === 'mrt') {
        const sts = leg.line.stations;
        if (leg.gin) walks.push([cur, [leg.gin.x, leg.gin.z]]);
        const a = leg.from >= 0 ? sts[leg.from].s : (trainRideInfo()?.s ?? sts[leg.to].s);
        const b = sts[leg.to].s;
        const pts: Pt[] = [];
        const n = Math.max(2, Math.ceil(Math.abs(b - a) / 20));
        for (let i = 0; i <= n; i++) {
          const [x, z] = along(leg.line, a + ((b - a) * i) / n);
          pts.push([x, z]);
        }
        path.push(pts);
        cur = [leg.gout.x, leg.gout.z];
      } else {
        walks.push([cur, [leg.gate.x, leg.gate.z]]);
        cur = [leg.gate.x, leg.gate.z];
      }
    }
  }
  walks.push([cur, [target.x, target.z]]);
  const line = (pts: Pt[]) => {
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(...P(x, z)) : g.moveTo(...P(x, z))));
    g.stroke();
  };
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const pts of path) {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 7 * px;
    line(pts);
    g.strokeStyle = '#c2185b';
    g.lineWidth = 4 * px;
    line(pts);
  }
  g.setLineDash([4 * px, 5 * px]);
  g.strokeStyle = '#c2185b';
  g.lineWidth = 2.6 * px;
  for (const pts of walks) line(pts);
  g.setLineDash([]);
  g.restore();
}
export function drawPin(g: CanvasRenderingContext2D, x: number, z: number, px = 1) {
  g.beginPath();
  g.moveTo(x, z);
  g.arc(x, z - 11 * px, 6 * px, Math.PI * 0.8, Math.PI * 2.2);
  g.closePath();
  g.fillStyle = '#f2b53c';
  g.strokeStyle = '#2a1f16';
  g.lineWidth = 1.5 * px;
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(x, z - 11 * px, 2.2 * px, 0, Math.PI * 2);
  g.fillStyle = '#2a1f16';
  g.fill();
}
export const directionsDebug = {
  setPin,
  clearPin,
  candidates,
  get plan() {
    return plan;
  },
  stationHere,
};
