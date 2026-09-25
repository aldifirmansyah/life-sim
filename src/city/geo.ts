/* The island, San Andreas style: a hand-built Singapore of about 3 × 2 km that
   follows the real city's shape (the West is west, the City is by the bay,
   Changi is east, Sentosa south) and keeps the districts and landmarks that make
   it recognisable, with the ordinary stretches between them squeezed to a street
   or two. Everything is in game metres: +x east, +z south, the island within
   x −1500…1500, z −1000…1000. Buildings and roads are real size; distances
   between districts aren't. Everything here is data and pure functions: the
   coastline, water, land use, the districts and the names for the HUD. */

type P = [number, number];

/** The main island, clockwise from the west tip. */
const MAIN: P[] = [
  [-1500, 150],
  [-1420, -150],
  [-1330, -420],
  [-1150, -640],
  [-900, -820],
  [-620, -960],
  [-300, -990],
  [50, -970],
  [420, -900],
  [760, -780],
  [1060, -640],
  [1300, -460],
  [1450, -250],
  [1500, -40],
  [1480, 200],
  [1380, 380],
  [1180, 500],
  [950, 590],
  [760, 660],
  [600, 710],
  [440, 700],
  [300, 690],
  [160, 700],
  [20, 690],
  [-150, 620],
  [-420, 560],
  [-700, 520],
  [-1000, 500],
  [-1250, 420],
  [-1420, 320],
];
const SENTOSA: P[] = [
  [-40, 780],
  [180, 760],
  [400, 790],
  [440, 860],
  [320, 930],
  [120, 950],
  [-20, 900],
];
export const ISLANDS = { main: MAIN, sentosa: SENTOSA };

/** Water inside the coastline: Marina Bay, the Singapore River, the reservoir, Jurong Lake. */
export const WATERS: Record<string, P[]> = {
  marinaBay: [
    [320, 440],
    [470, 430],
    [510, 500],
    [480, 580],
    [400, 600],
    [330, 560],
  ],
  river: [
    [140, 430],
    [240, 440],
    [325, 455],
    [325, 475],
    [240, 460],
    [140, 452],
  ],
  macritchie: [
    [-260, -470],
    [-120, -500],
    [-60, -420],
    [-160, -360],
    [-250, -390],
  ],
  jurongLake: [
    [-1260, -170],
    [-1180, -190],
    [-1150, -120],
    [-1230, -100],
  ],
};
const WATER_NAMES: Record<string, string> = {
  marinaBay: 'Marina Bay',
  river: 'Singapore River',
  macritchie: 'MacRitchie Reservoir',
  jurongLake: 'Jurong Lake',
};

export function inPoly(p: P[], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i],
      [xj, zj] = p[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
/** Distance from a point to a polygon's outline. */
export function polyEdgeDist(p: P[], x: number, z: number) {
  let best = Infinity;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) best = Math.min(best, segDist(x, z, ...p[j], ...p[i]));
  return best;
}
export function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax,
    dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}

/** Areas with their own ground and no ordinary buildings. */
const ZONE_POLYS = {
  airport: [
    [1190, -260],
    [1400, -330],
    [1470, -120],
    [1460, 210],
    [1360, 330],
    [1190, 240],
  ] as P[],
  catchment: [
    [-620, -640],
    [-380, -700],
    [-80, -660],
    [40, -520],
    [-20, -250],
    [-260, -170],
    [-520, -240],
    [-660, -420],
  ] as P[],
};

export type Land = 'sea' | 'water' | 'beach' | 'urban' | 'forest' | 'airport' | 'industry' | 'park';
/** What the ground is at (x, z). */
export function landAt(x: number, z: number): Land {
  const main = inPoly(MAIN, x, z),
    sen = inPoly(SENTOSA, x, z);
  if (!main && !sen) return 'sea';
  for (const w of Object.values(WATERS)) if (inPoly(w, x, z)) return 'water';
  if (sen) return polyEdgeDist(SENTOSA, x, z) < 14 && z > 850 ? 'beach' : 'park';
  if (inPoly(ZONE_POLYS.airport, x, z)) return 'airport';
  if (inPoly(ZONE_POLYS.catchment, x, z)) return 'forest';
  // East Coast Park: a strip of sand along the south-east shore, grass behind it.
  const coast = polyEdgeDist(MAIN, x, z);
  if (x > 620 && x < 1300 && z > 380) {
    if (coast < 12) return 'beach';
    if (coast < 40) return 'park';
  }
  return 'urban';
}

export type TownKind =
  | 'hdb'
  | 'lowhdb'
  | 'cbd'
  | 'mall'
  | 'shophouse'
  | 'mixed'
  | 'campus'
  | 'airport'
  | 'landmark'
  | 'civic'
  | 'park'
  | 'resort'
  | 'kampung'
  | 'industrial'
  | 'lowrise';
export type Region = 'West' | 'Central' | 'North' | 'East' | 'Sentosa';
export interface Town {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Radius in metres of what's built as the district. */
  r: number;
  kind: TownKind;
  region: Region;
}
const T = (id: string, name: string, x: number, z: number, kind: TownKind, r: number, region: Region): Town => ({
  id,
  name,
  x,
  z,
  r,
  kind,
  region,
});

export const TOWNS: Town[] = [
  // The West: home and work.
  T('jurong_east', 'Jurong East', -1290, 10, 'mall', 120, 'West'),
  T('clementi', 'Clementi', -950, 110, 'hdb', 150, 'West'),
  T('dover', 'Dover', -700, 60, 'hdb', 70, 'West'),
  T('west_coast', 'West Coast Park', -960, 440, 'park', 60, 'West'),
  T('nus', 'NUS Kent Ridge', -820, 360, 'campus', 100, 'West'),
  T('science_park', 'Science Park', -600, 330, 'campus', 85, 'West'),
  T('one_north', 'one-north', -560, 180, 'campus', 60, 'West'),
  T('buona_vista', 'Buona Vista', -440, 90, 'mixed', 60, 'West'),
  T('holland', 'Holland Village', -430, -60, 'lowrise', 50, 'West'),
  // The middle: Orchard and the gardens, Little India, Kampong Glam.
  T('botanic', 'Botanic Gardens', -270, -70, 'park', 100, 'Central'),
  T('orchard', 'Orchard Road', -40, 30, 'mall', 140, 'Central'),
  T('little_india', 'Little India', 170, -60, 'shophouse', 80, 'Central'),
  T('kampong_glam', 'Kampong Glam', 330, 10, 'shophouse', 60, 'Central'),
  T('bugis', 'Bugis', 300, 120, 'mixed', 55, 'Central'),
  T('queenstown', 'Queenstown', -280, 310, 'hdb', 80, 'Central'),
  T('tiong_bahru', 'Tiong Bahru', -100, 410, 'lowhdb', 60, 'Central'),
  // The City.
  T('city_hall', 'City Hall', 200, 270, 'civic', 70, 'Central'),
  T('clarke_quay', 'Clarke Quay', 110, 400, 'shophouse', 50, 'Central'),
  T('raffles', 'Raffles Place', 260, 510, 'cbd', 80, 'Central'),
  T('chinatown', 'Chinatown', 60, 530, 'shophouse', 75, 'Central'),
  T('tanjong_pagar', 'Tanjong Pagar', 190, 620, 'cbd', 55, 'Central'),
  T('marina_bay', 'Marina Bay', 520, 560, 'landmark', 90, 'Central'),
  T('harbourfront', 'HarbourFront', -60, 650, 'mall', 50, 'Central'),
  // The North (later steps fill it in).
  T('toa_payoh', 'Toa Payoh', 90, -330, 'hdb', 100, 'North'),
  T('ang_mo_kio', 'Ang Mo Kio', 150, -640, 'hdb', 110, 'North'),
  T('mandai', 'Mandai', -380, -760, 'park', 90, 'North'),
  T('woodlands', 'Woodlands', -720, -800, 'hdb', 110, 'North'),
  // The East.
  T('kallang', 'Kallang', 520, 250, 'mixed', 70, 'East'),
  T('geylang', 'Geylang', 620, 120, 'shophouse', 75, 'East'),
  T('paya_lebar', 'Paya Lebar', 780, 40, 'mixed', 65, 'East'),
  T('katong', 'Katong', 850, 400, 'shophouse', 85, 'East'),
  T('bedok', 'Bedok', 1030, 170, 'hdb', 90, 'East'),
  T('tampines', 'Tampines', 1060, -220, 'hdb', 110, 'East'),
  T('punggol', 'Punggol', 650, -680, 'hdb', 100, 'East'),
  T('changi_airport', 'Changi Airport', 1300, 30, 'airport', 140, 'East'),
  T('changi_village', 'Changi Village', 1260, -440, 'lowrise', 50, 'East'),
  // Sentosa.
  T('sentosa', 'Sentosa', 200, 860, 'resort', 170, 'Sentosa'),
];
export const townById = (id: string) => TOWNS.find(t => t.id === id)!;

/** The district whose area (grown a little) contains (x, z), nearest first. */
export function townAt(x: number, z: number, grow = 1.15): Town | null {
  let best: Town | null = null,
    bd = Infinity;
  for (const t of TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z) / t.r;
    if (d < grow && d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

/** The region by position, for places outside any district. */
export function regionAt(x: number, z: number): Region {
  let best = TOWNS[0],
    bd = Infinity;
  for (const t of TOWNS) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best.region;
}

/** The name of where (x, z) is, for the HUD: a district, a named area, or the region. */
export function placeName(x: number, z: number): string {
  const land = landAt(x, z);
  if (land === 'sea') return z > 300 ? 'Singapore Strait' : z < -300 ? 'Strait of Johor' : 'The sea';
  if (land === 'water') {
    for (const [k, w] of Object.entries(WATERS)) if (inPoly(w, x, z)) return WATER_NAMES[k];
  }
  if (land === 'forest') return 'Central Catchment';
  if (land === 'airport') return 'Changi Airport';
  if (land === 'beach' || (land === 'park' && x > 600)) return inPoly(SENTOSA, x, z) ? 'Sentosa' : 'East Coast Park';
  const t = townAt(x, z);
  if (t) return t.name;
  return `${regionAt(x, z)} Singapore`;
}

/** The island's bounds (for the map and the chunk grid). */
export const BOUNDS = { x0: -1600, x1: 1600, z0: -1060, z1: 1060 };
