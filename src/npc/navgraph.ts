/* Waypoint graph (spec §8.5): lane centrelines of the jalan and gangs, split at
   crossings and wherever a POI's entry chain joins, searched with A*. POIs are
   leaves hanging off the lanes, so A* only ever runs over lane nodes. */
import * as THREE from 'three';
import { GZ, GX } from '../world/layout';
import { pois, type P2, type Poi, type Slot } from './places';

interface Lane {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
/** Walkable centrelines. The jalan runs from the sawah path out through the gapura to the main road. */
const LANES: Lane[] = [
  { x0: 0, z0: -64, x1: 0, z1: 64.5 },
  ...GZ.map(g => ({ x0: -58, z0: g, x1: 58, z1: g })),
  ...GX.map(x => ({ x0: x, z0: -53.75, x1: x, z1: 58 })),
  { x0: -58, z0: -53.75, x1: 58, z1: -53.75 },
  { x0: -16, z0: 64.5, x1: 16, z1: 64.5 },
];

export interface GraphNode {
  id: number;
  x: number;
  z: number;
  adj: { to: number; w: number }[];
}
export const nodes: GraphNode[] = [];
/** POI id → the lane node its entry chain joins. */
const attachOf = new Map<string, number>();
const byKey = new Map<string, number>();
export let edgeCount = 0;

function nodeAt(x: number, z: number) {
  const k = `${Math.round(x * 100)},${Math.round(z * 100)}`;
  let id = byKey.get(k);
  if (id === undefined) {
    id = nodes.push({ id: nodes.length, x, z, adj: [] }) - 1;
    byKey.set(k, id);
  }
  return id;
}
function link(a: number, b: number) {
  if (a === b || nodes[a].adj.some(e => e.to === b)) return;
  const w = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
  nodes[a].adj.push({ to: b, w });
  nodes[b].adj.push({ to: a, w });
  edgeCount++;
}

const horiz = (l: Lane) => l.z0 === l.z1;
/** Closest point on a lane to (x, z). */
function project(l: Lane, x: number, z: number): P2 {
  return horiz(l)
    ? [Math.max(Math.min(l.x0, l.x1), Math.min(Math.max(l.x0, l.x1), x)), l.z0]
    : [l.x0, Math.max(Math.min(l.z0, l.z1), Math.min(Math.max(l.z0, l.z1), z))];
}

export function buildGraph() {
  // Stops along each lane: its ends, crossings with other lanes, and POI joins.
  const stops: number[][] = LANES.map(l => (horiz(l) ? [l.x0, l.x1] : [l.z0, l.z1]));
  LANES.forEach((a, i) =>
    LANES.forEach((b, j) => {
      if (i >= j || horiz(a) === horiz(b)) return;
      const h = horiz(a) ? a : b,
        v = horiz(a) ? b : a;
      if (v.x0 < Math.min(h.x0, h.x1) || v.x0 > Math.max(h.x0, h.x1)) return;
      if (h.z0 < Math.min(v.z0, v.z1) || h.z0 > Math.max(v.z0, v.z1)) return;
      stops[LANES.indexOf(h)].push(v.x0);
      stops[LANES.indexOf(v)].push(h.z0);
    }),
  );
  const joins: [Poi, number, P2][] = [];
  for (const p of pois) {
    const [ex, ez] = p.entry[0];
    let best = 0,
      bd = Infinity,
      bp: P2 = [0, 0];
    LANES.forEach((l, i) => {
      const q = project(l, ex, ez);
      const d = Math.hypot(q[0] - ex, q[1] - ez);
      if (d < bd) {
        bd = d;
        best = i;
        bp = q;
      }
    });
    stops[best].push(horiz(LANES[best]) ? bp[0] : bp[1]);
    joins.push([p, best, bp]);
  }
  LANES.forEach((l, i) => {
    const ts = [...new Set(stops[i].map(t => Math.round(t * 100) / 100))].sort((a, b) => a - b);
    let prev = -1;
    for (const t of ts) {
      const id = horiz(l) ? nodeAt(t, l.z0) : nodeAt(l.x0, t);
      if (prev >= 0) link(prev, id);
      prev = id;
    }
  });
  for (const [p, , q] of joins) attachOf.set(p.id, nodeAt(q[0], q[1]));
}

/** A* over lane nodes; returns node ids from a to b inclusive. */
export function astar(a: number, b: number): number[] {
  if (a === b) return [a];
  const n = nodes.length;
  const g = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const h = (i: number) => Math.hypot(nodes[i].x - nodes[b].x, nodes[i].z - nodes[b].z);
  // Binary heap of [f, node].
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1,
          r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top[1];
  };
  g[a] = 0;
  push(h(a), a);
  while (heap.length) {
    const i = pop();
    if (i === b) break;
    if (closed[i]) continue;
    closed[i] = 1;
    for (const e of nodes[i].adj) {
      const ng = g[i] + e.w;
      if (ng < g[e.to]) {
        g[e.to] = ng;
        from[e.to] = i;
        push(ng + h(e.to), e.to);
      }
    }
  }
  if (from[b] < 0) return [];
  const out = [b];
  while (out[out.length - 1] !== a) out.push(from[out[out.length - 1]]);
  return out.reverse();
}

/** A walk: a polyline with cumulative lengths. `lane[i]` marks segment i (pts i → i+1) as lane walking. */
export interface Path {
  x: number[];
  z: number[];
  cum: number[];
  lane: boolean[];
  length: number;
}

/** Route from standing at one slot to the approach point of another. */
export function buildPath(from: Slot, to: Slot): Path {
  const pts: [number, number, boolean][] = [];
  const add = (p: P2, lane = false) => {
    const l = pts[pts.length - 1];
    if (l && Math.hypot(l[0] - p[0], l[1] - p[1]) < 0.05) {
      l[2] = l[2] && lane;
      return;
    }
    pts.push([p[0], p[1], lane]);
  };
  add([from.x, from.z]);
  add(from.approach);
  for (let i = from.via.length - 1; i >= 0; i--) add(from.via[i]);
  if (from.poi === to.poi) {
    add(from.poi.entry[from.poi.entry.length - 1]);
  } else {
    for (let i = from.poi.entry.length - 1; i >= 0; i--) add(from.poi.entry[i]);
    const route = astar(attachOf.get(from.poi.id)!, attachOf.get(to.poi.id)!);
    for (const id of route) add([nodes[id].x, nodes[id].z], true);
    for (const p of to.poi.entry) add(p);
  }
  for (const p of to.via) add(p);
  add(to.approach);
  const path: Path = { x: [], z: [], cum: [], lane: [], length: 0 };
  pts.forEach(([x, z, lane], i) => {
    if (i > 0) path.length += Math.hypot(x - path.x[i - 1], z - path.z[i - 1]);
    path.x.push(x);
    path.z.push(z);
    path.cum.push(path.length);
    // A segment is lane walking when both ends lie on a lane.
    if (i > 0) path.lane.push(lane && pts[i - 1][2]);
  });
  return path;
}

/** Point and heading at distance s along the path, written into out. Returns the segment index. */
export function sample(p: Path, s: number, out: { x: number; z: number; dx: number; dz: number }) {
  const n = p.x.length;
  if (n === 1 || s <= 0) {
    out.x = p.x[0];
    out.z = p.z[0];
    if (n > 1) setDir(p, 0, out);
    return 0;
  }
  if (s >= p.length) {
    out.x = p.x[n - 1];
    out.z = p.z[n - 1];
    setDir(p, n - 2, out);
    return n - 2;
  }
  let i = 0;
  while (i < n - 2 && p.cum[i + 1] < s) i++;
  const seg = p.cum[i + 1] - p.cum[i] || 1;
  const t = (s - p.cum[i]) / seg;
  out.x = p.x[i] + (p.x[i + 1] - p.x[i]) * t;
  out.z = p.z[i] + (p.z[i + 1] - p.z[i]) * t;
  setDir(p, i, out);
  return i;
}
function setDir(p: Path, i: number, out: { dx: number; dz: number }) {
  const dx = p.x[i + 1] - p.x[i],
    dz = p.z[i + 1] - p.z[i];
  const l = Math.hypot(dx, dz) || 1;
  out.dx = dx / l;
  out.dz = dz / l;
}

/** Lane edges, entry chains and slot approaches, for the debug view. */
export function graphLines(): THREE.LineSegments {
  const v: number[] = [];
  const seg = (a: P2, b: P2) => v.push(a[0], 0.09, a[1], b[0], 0.09, b[1]);
  for (const n of nodes) for (const e of n.adj) if (e.to > n.id) seg([n.x, n.z], [nodes[e.to].x, nodes[e.to].z]);
  for (const p of pois) {
    const a = attachOf.get(p.id)!;
    let prev: P2 = [nodes[a].x, nodes[a].z];
    for (const q of p.entry) {
      seg(prev, q);
      prev = q;
    }
    for (const s of p.slots) {
      let q = prev;
      for (const w of s.via) {
        seg(q, w);
        q = w;
      }
      seg(q, s.approach);
      seg(s.approach, [s.x, s.z]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const lines = new THREE.LineSegments(
    g,
    new THREE.LineBasicMaterial({ color: 0x19e6c1, depthTest: false, transparent: true, opacity: 0.8 }),
  );
  lines.renderOrder = 5;
  return lines;
}
