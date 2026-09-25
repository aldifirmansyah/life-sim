/* The road graph (step 10): every road segment (expressways, main roads, town
   streets) split where it meets or crosses another, as nodes and edges, for the
   taxis, the ride-hail cars, the traffic and route finding. Built once, after the
   generator has added the town streets. Paths are found with A* (edge costs:
   length, a little more on town streets, a little less on expressways). */
import { allSegs } from './roads';

export interface GNode {
  id: number;
  x: number;
  z: number;
  /** Neighbour node ids and the edge length, and whether it's a street. */
  out: { to: number; len: number; cost: number; w: number }[];
}
export const nodes: GNode[] = [];
const byKey = new Map<string, number>();
const CELL = 64;
const grid = new Map<string, number[]>();

function nodeAt(x: number, z: number) {
  const k = `${Math.round(x * 2)},${Math.round(z * 2)}`;
  let id = byKey.get(k);
  if (id === undefined) {
    id = nodes.push({ id: nodes.length, x, z, out: [] }) - 1;
    byKey.set(k, id);
    const gk = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    let c = grid.get(gk);
    if (!c) grid.set(gk, (c = []));
    c.push(id);
  }
  return id;
}
function link(a: number, b: number, w: number, kind: string) {
  if (a === b) return;
  const A = nodes[a],
    B = nodes[b];
  const len = Math.hypot(A.x - B.x, A.z - B.z);
  const cost = len * (kind === 'street' ? 1.3 : kind === 'expressway' ? 0.8 : 1);
  if (!A.out.some(e => e.to === b)) A.out.push({ to: b, len, cost, w });
  if (!B.out.some(e => e.to === a)) B.out.push({ to: a, len, cost, w });
}

/** Where segment p meets segment q: the parameter along p (0..1), or null. */
function cross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number) {
  const rx = bx - ax,
    rz = bz - az,
    sx = dx - cx,
    sz = dz - cz;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sz - (cz - az) * sx) / den;
  const u = ((cx - ax) * rz - (cz - az) * rx) / den;
  // Allow a small overshoot so roads ending just short of another still join.
  const lp = Math.hypot(rx, rz),
    lq = Math.hypot(sx, sz);
  const et = 3 / lp,
    eu = 3 / lq;
  if (t < -et || t > 1 + et || u < -eu || u > 1 + eu) return null;
  return Math.max(0, Math.min(1, t));
}

let built = false;
export function buildRoadGraph() {
  if (built) return;
  built = true;
  const segs = allSegs;
  const cuts: number[][] = segs.map(() => [0, 1]);
  // Candidate pairs through a coarse grid of the segments' boxes.
  const sgrid = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (
      let ix = Math.floor((Math.min(s.ax, s.bx) - 4) / CELL);
      ix <= Math.floor((Math.max(s.ax, s.bx) + 4) / CELL);
      ix++
    )
      for (
        let iz = Math.floor((Math.min(s.az, s.bz) - 4) / CELL);
        iz <= Math.floor((Math.max(s.az, s.bz) + 4) / CELL);
        iz++
      ) {
        const k = ix + ',' + iz;
        let c = sgrid.get(k);
        if (!c) sgrid.set(k, (c = []));
        c.push(i);
      }
  });
  const seen = new Set<number>();
  for (const cell of sgrid.values())
    for (let a = 0; a < cell.length; a++)
      for (let b = a + 1; b < cell.length; b++) {
        const i = cell[a],
          j = cell[b];
        const key = i < j ? i * 100000 + j : j * 100000 + i;
        if (seen.has(key)) continue;
        seen.add(key);
        const p = segs[i],
          q = segs[j];
        const t = cross(p.ax, p.az, p.bx, p.bz, q.ax, q.az, q.bx, q.bz);
        const u = cross(q.ax, q.az, q.bx, q.bz, p.ax, p.az, p.bx, p.bz);
        if (t === null || u === null) continue;
        cuts[i].push(t);
        cuts[j].push(u);
      }
  // Split each segment at its cuts (and every 60 m, so nodes are never far apart).
  segs.forEach((s, i) => {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    for (let d = 60; d < len; d += 60) cuts[i].push(d / len);
    const ts = [...new Set(cuts[i].map(t => Math.round(t * 1e4) / 1e4))].sort((a, b) => a - b);
    let prev = nodeAt(s.ax + (s.bx - s.ax) * ts[0], s.az + (s.bz - s.az) * ts[0]);
    for (let k = 1; k < ts.length; k++) {
      const cur = nodeAt(s.ax + (s.bx - s.ax) * ts[k], s.az + (s.bz - s.az) * ts[k]);
      link(prev, cur, s.w, s.road.kind);
      prev = cur;
    }
  });
  // Roads drawn to end near another road join it: each dead end links to the nearest node within 60 m
  // that isn't already its neighbour (a short connector).
  for (const n of nodes) {
    if (n.out.length !== 1) continue;
    let best: GNode | null = null,
      bd = 60;
    for (const m of nearNodes(n.x, n.z, 60)) {
      if (m === n || n.out.some(e => e.to === m.id) || m.out.some(e => e.to === n.id)) continue;
      // Not back along its own road: the connector should leave roughly away from the one edge it has.
      const o = nodes[n.out[0].to];
      const ax = n.x - o.x,
        az = n.z - o.z,
        bx = m.x - n.x,
        bz = m.z - n.z;
      if (ax * bx + az * bz < 0) continue;
      const d = Math.hypot(bx, bz);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (best) link(n.id, best.id, 7, 'street');
  }
}
function* nearNodes(x: number, z: number, r: number) {
  for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++)
    for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++)
      for (const id of grid.get(ix + ',' + iz) ?? [])
        if (Math.hypot(nodes[id].x - x, nodes[id].z - z) < r) yield nodes[id];
}
/** How many separate pieces the network is in (for checks). */
export function components() {
  const seen = new Set<number>();
  let k = 0;
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    k++;
    const stack = [n.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const e of nodes[id].out) stack.push(e.to);
    }
  }
  return k;
}

/** The node nearest to (x, z) that has roads leaving it, within `r` metres. */
export function nearestNode(x: number, z: number, r = 200): GNode | null {
  let best: GNode | null = null,
    bd = r;
  for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++)
    for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++)
      for (const id of grid.get(ix + ',' + iz) ?? []) {
        const n = nodes[id];
        if (!n.out.length) continue;
        const d = Math.hypot(n.x - x, n.z - z);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
  return best;
}

/** A* from one node to another: the nodes along the way (both ends included), or null. */
export function findPath(from: GNode, to: GNode): GNode[] | null {
  const g = new Map<number, number>([[from.id, 0]]);
  const came = new Map<number, number>();
  const h = (n: GNode) => Math.hypot(n.x - to.x, n.z - to.z) * 0.8;
  // A small binary heap of [f, id].
  const heap: [number, number][] = [[h(from), from.id]];
  const push = (e: [number, number]) => {
    heap.push(e);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1,
          r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const closed = new Set<number>();
  let steps = 0;
  while (heap.length && steps++ < 200000) {
    const [, id] = pop();
    if (id === to.id) {
      const out: GNode[] = [to];
      let c = id;
      while (came.has(c)) {
        c = came.get(c)!;
        out.push(nodes[c]);
      }
      return out.reverse();
    }
    if (closed.has(id)) continue;
    closed.add(id);
    const gi = g.get(id)!;
    for (const e of nodes[id].out) {
      const ng = gi + e.cost;
      if (ng < (g.get(e.to) ?? Infinity)) {
        g.set(e.to, ng);
        came.set(e.to, id);
        push([ng + h(nodes[e.to]), e.to]);
      }
    }
  }
  return null;
}

/** A path as points, from near (ax, az) to near (bx, bz), or null when there's no road between. */
export function route(ax: number, az: number, bx: number, bz: number): [number, number][] | null {
  const a = nearestNode(ax, az),
    b = nearestNode(bx, bz);
  if (!a || !b) return null;
  const p = findPath(a, b);
  return p ? p.map(n => [n.x, n.z]) : null;
}
/** Length of a path of points. */
export const pathLength = (p: [number, number][]) =>
  p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);
