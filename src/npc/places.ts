/* Places NPCs go: points of interest (POIs) with slots they claim (seats,
   standing spots, doors). Each POI has an entry chain: the first point sits on
   a lane of the waypoint graph and the rest lead in to the POI. */
import { C } from '../render/batch';
import { hit } from '../core/collision';
import { houses, type House } from '../world/houses';
import { pasarCols } from '../world/pasar';
import { rakaHouse } from '../world/landmarks';

export type P2 = [number, number];
export type Pose = 'stand' | 'sit' | 'squat' | 'hidden';

export interface Slot {
  x: number;
  z: number;
  /** Facing (rotation about y); forward is (sin ry, cos ry). */
  ry: number;
  pose: Pose;
  tag: string;
  /** Seat height for `sit`. */
  y: number;
  /** Points walked between the POI entry and the slot. */
  via: P2[];
  /** Where the walk ends before settling onto the slot (seats are approached from the front). */
  approach: P2;
  /** Any number of NPCs can use it (doors, the away point). */
  shared: boolean;
  /** Wander inside this rect [x0, x1, z0, z1] once there. */
  wander?: [number, number, number, number];
  claimedBy: number;
  poi: Poi;
}

export interface Poi {
  id: string;
  name: string;
  entry: P2[];
  slots: Slot[];
}

export const pois: Poi[] = [];
export const poiById = new Map<string, Poi>();
/** Location group → POIs. `home` is resolved per household instead. */
export const groups = new Map<string, Poi[]>();
/** Household id → home POI. */
export const homes = new Map<string, Poi>();

/** Is the straight walk from a to b clear of colliders? */
function clear(a: P2, b: P2) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2);
  for (let i = 0; i <= n; i++)
    if (hit(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, 0.2)) return false;
  return true;
}

export const face = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

interface SlotSpec {
  at: P2;
  face: P2 | number;
  pose?: Pose;
  y?: number;
  via?: P2[];
  approach?: P2;
  shared?: boolean;
  wander?: [number, number, number, number];
}

function poi(id: string, name: string, group: string, entry: P2[], slots: Record<string, SlotSpec[]>) {
  const p: Poi = { id, name, entry, slots: [] };
  for (const [tag, list] of Object.entries(slots))
    for (const s of list) {
      const ry = typeof s.face === 'number' ? s.face : face(s.at[0], s.at[1], s.face[0], s.face[1]);
      const pose = s.pose ?? 'stand';
      const approach: P2 =
        s.approach ?? (pose === 'sit' ? [s.at[0] + Math.sin(ry) * 0.55, s.at[1] + Math.cos(ry) * 0.55] : s.at);
      p.slots.push({
        x: s.at[0],
        z: s.at[1],
        ry,
        pose,
        tag,
        y: s.y ?? 0,
        via: s.via ?? [],
        approach,
        shared: s.shared ?? pose === 'hidden',
        wander: s.wander,
        claimedBy: -1,
        poi: p,
      });
    }
  pois.push(p);
  poiById.set(id, p);
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group)!.push(p);
  return p;
}

const sit = (at: P2, faceTo: P2 | number, y: number, o: Partial<SlotSpec> = {}): SlotSpec => ({
  at,
  face: faceTo,
  pose: 'sit',
  y,
  ...o,
});
const stand = (at: P2, faceTo: P2 | number, o: Partial<SlotSpec> = {}): SlotSpec => ({ at, face: faceTo, ...o });
const door = (at: P2): SlotSpec => ({ at, face: 0, pose: 'hidden' });

/** Landmarks. Coordinates follow the geometry in world/landmarks.ts. */
function landmarkPois() {
  poi('warung', 'Warung Bu Sri', 'warung', [[9.0, -7.5]], {
    owner: [stand([10.3, -5.8], [10.3, -8])],
    helper: [stand([9.3, -5.75], [9.3, -8])],
    customer: [
      stand([9.55, -6.7], [9.55, -5]),
      stand([8.95, -7.0], [9.3, -5]),
      stand([5.6, -6.2], [7, -5], { via: [[5.9, -7.2]] }),
    ],
    bench: [sit([6.8, -6.33], [6.8, -8], 0.45), sit([8.0, -6.33], [8.0, -8], 0.45)],
  });
  poi('warungMeja', 'Meja warung', 'meja', [[2.3, -1.2]], {
    seat: [
      sit([3.5, -1.6], [4.2, -2.7], 0.45, { approach: [3.4, -1.1] }),
      sit([4.9, -1.7], [4.2, -2.7], 0.45, { approach: [5.0, -1.15] }),
    ],
  });
  poi('warungHome', 'Rumah Bu Sri', 'warungHome', [[2.3, -0.3]], { inside: [door([5.35, -0.8])] });

  // The south bench is too tight to reach between the table and the wall, so only the north bench and stools are used.
  poi('warkop', 'Warkop Berkah', 'warkop', [[-6.7, 16.9]], {
    owner: [stand([-6.1, 19.5], [-8.5, 18.6], { via: [[-6.3, 18.45]] })],
    seat: [
      ...[-9.7, -8.5, -7.3].map(x => sit([x, 17.8], [x, 19], 0.44, { approach: [x, 17.1] })),
      sit([-6.3, 17.8], [-5.05, 18.45], 0.44, { approach: [-6.3, 17.2] }),
      sit([-3.9, 18.2], [-5.05, 18.45], 0.44, { via: [[-3.95, 16.95]], approach: [-3.35, 18.3] }),
      sit([-5.1, 17.6], [-5.05, 18.45], 0.44, { approach: [-5.1, 17.1] }),
    ],
  });

  poi('musholla', 'Musholla Al-Ikhlas', 'musholla', [[2.4, -17]], {
    inside: [door([4.75, -17])],
    porch: [stand([4.1, -15.6], [0, -15.6]), stand([4.1, -18.4], [0, -18.4])],
  });

  poi('balai', 'Balai Warga', 'balai', [[-13, -31.4]], {
    inside: [
      stand([-13, -27.3], [-13, -26]),
      stand([-16, -27.3], [-15, -26.3]),
      stand([-10, -27.3], [-11, -26.3]),
      stand([-13, -25.2], [-13, -26.8], {
        via: [
          [-10.5, -27.8],
          [-10.5, -25.2],
        ],
      }),
    ],
    board: [stand([-7.1, -31.45], [-7.1, -30.5])],
  });

  poi('ronda', 'Pos Ronda', 'ronda', [[-2.4, 41.1]], {
    seat: [
      sit([-4.05, 40.4], [0, 40.4], 0.58),
      sit([-4.05, 41.8], [0, 41.8], 0.58),
      sit([-5.3, 39.95], [-5.3, 38], 0.58, { via: [[-3.3, 39.4]] }),
      sit([-6.4, 39.95], [-6.4, 38], 0.58, { via: [[-3.3, 39.4]] }),
    ],
  });
  poi('bakso', 'Bakso Mas Joko', 'bakso', [[-2.3, 45.0]], {
    vendor: [stand([-4.85, 43.85], [-6, 43.85])],
    customer: [stand([-4.3, 44.75], [-5.6, 43.9]), stand([-4.5, 43.0], [-5.6, 43.8], { via: [[-3.3, 44.9]] })],
  });

  const field: [number, number, number, number] = [-54, -35.5, -4, 12];
  poi('lapangan', 'Lapangan', 'lapangan', [[-44, -7.3]], {
    field: (
      [
        [-48, 2],
        [-44, 6],
        [-40, 1],
        [-46, 9],
        [-42, -2],
        [-38, 5],
      ] as P2[]
    ).map(p => stand(p, [-44.85, 4], { wander: field })),
    bench: [-48.8, -47.2, -40.8, -39.2].map(x => sit([x, -6.41], [x, 2], 0.45, { via: [[-44, -5.7]] })),
  });

  poi('ojek', 'Pangkalan Ojek', 'ojek', [[2.4, 54.95]], {
    seat: [
      sit([6.4, 54.35], [0, 54.35], 0.46, { via: [[5.3, 54.95]], approach: [5.45, 54.35] }),
      sit([6.4, 53.3], [0, 53.3], 0.46, { via: [[5.3, 54.95]], approach: [5.45, 53.6] }),
    ],
  });

  poi(
    'kebun',
    'Kebun Warga',
    'kebun',
    [
      [41.65, -53.0],
      [41.65, -52.3],
      [39.9, -51.25],
    ],
    {
      plot: (
        [
          [44.5, -49.15],
          [49, -47.3],
          [46.5, -45.45],
          [52, -49.15],
        ] as P2[]
      ).map(([x, z]) => ({
        at: [x, z] as P2,
        face: [x, z - 0.8] as P2,
        pose: 'squat' as Pose,
        via: [[39.9, z]] as P2[],
      })),
    },
  );

  for (const [id, x] of [
    ['kaliW', -18],
    ['kaliE', 16],
  ] as const)
    poi(id, 'Tepi Kali', 'kali', [[x, -54.4]], {
      fish: [stand([x - 0.6, -55.15], [x - 0.6, -58]), stand([x + 0.8, -55.15], [x + 0.8, -58])],
    });

  poi('bridge', 'Jembatan', 'bridge', [[0, -57.6]], {
    rail: [stand([2.65, -57.2], [6, -57.2]), stand([-2.65, -58.4], [-6, -58.4]), stand([2.65, -58.6], [6, -58.6])],
  });

  // Leaving the kampung: out through the gapura and along the main road.
  poi('awayW', 'Luar kampung', 'away', [[-16, 64.5]], { away: [door([-16, 64.5])] });
  poi('awayE', 'Luar kampung', 'away', [[16, 64.5]], { away: [door([16, 64.5])] });
}

/** One POI per pasar pagi stall, with customers standing on the jalan side. */
function pasarPois() {
  pasarCols.forEach((c, k) => {
    const s = c.x0 < 0 ? -1 : 1;
    const zc = (c.z0 + c.z1) / 2;
    const xc = (c.x0 + c.x1) / 2;
    poi(`pasar${k}`, 'Pasar pagi', 'pasar', [[0, zc + 0.45]], {
      customer: [stand([s * 1.05, zc + 0.2], [xc, zc + 0.2]), stand([s * 1.05, zc + 0.75], [xc, zc + 0.75])],
    });
  });
}

/** Raka's own teras bench: where he sits, and where guests he invites for tea sit with him. */
function rakaPoi() {
  const h = rakaHouse;
  const { F, fz, dx, sb, th } = h;
  const bx = h.bench ?? 1.2;
  const seat = (o: number): SlotSpec => {
    const [x, z] = F(bx + o, fz + 0.42);
    return sit([x, z], th, 0.46, { approach: F(bx + o, fz + 1.0) });
  };
  poi('raka', 'Rumah Raka', 'raka', [F(dx, fz + sb + 0.9), F(dx, fz + 1.0)], { teras: [seat(-0.35), seat(0.35)] });
}

/** Home POI for a row house: in through the door, or out on the teras bench (a stool pair if it has none). */
function housePoi(h: House, k: number, household: string) {
  const { F, fz, dx, sb, th, w } = h;
  const bx = h.bench ?? (dx < 0 ? w / 2 - 1.1 : -w / 2 + 1.1);
  if (h.bench === null) {
    // Plastic stools for households that had no bench.
    for (const o of [-0.4, 0.4]) {
      const [x, z] = F(bx + o, fz + 0.45);
      C(x, z, 0, 0.42, 0.17, ['#d8392a', '#2f6fb3', '#3a9a73'][k % 3], { col: true });
    }
  }
  const seat = (o: number): SlotSpec => {
    const [x, z] = F(bx + o, fz + 0.42);
    const [ax, az] = F(bx + o, fz + 1.0);
    return sit([x, z], th, 0.44, { approach: [ax, az] });
  };
  // Step out to the lane straight from the door, or a little to one side if a lamp post is in the way.
  const step = F(dx, fz + 1.0);
  let front = F(dx, fz + sb + 0.9);
  for (const o of [0, 0.6, -0.6, 1.1, -1.1]) {
    front = F(dx + o, fz + sb + 0.9);
    if (clear(step, front)) break;
  }
  const p = poi(`house${k}`, 'Rumah', 'house', [front, step], {
    inside: [door(F(dx, fz + 0.1))],
    teras: [seat(-0.35), seat(0.35)],
  });
  homes.set(household, p);
  return p;
}

/** Where each household lives: the free row house whose door is nearest the given point. */
export const HOUSEHOLD_SITES: Record<string, P2 | 'warung'> = {
  rt: [8, 17.5],
  sri: 'warung',
  darto: [24, 17.5],
  yusuf: [-20, 37],
  slamet: [-17, 17.5],
  hartono: [-18, -9],
  joko: [-14, 39],
  udin: [20, 39],
  rahmat: [42, 17.5],
  yati: [-42, -31],
  endang: [20, -31],
  wati: [-22, -7],
  hasan: [16, -9.5],
  karyo: [31, -20],
  ayu: [-31, 22],
};

export function buildPlaces() {
  landmarkPois();
  rakaPoi();
  pasarPois();
  const taken = new Set<number>();
  for (const [household, site] of Object.entries(HOUSEHOLD_SITES)) {
    if (site === 'warung') {
      homes.set(household, poiById.get('warungHome')!);
      continue;
    }
    let best = -1,
      bd = Infinity;
    houses.forEach((h, i) => {
      if (taken.has(i)) return;
      const [x, z] = h.F(h.dx, h.fz);
      const d = Math.hypot(x - site[0], z - site[1]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    taken.add(best);
    housePoi(houses[best], best, household);
  }
}
