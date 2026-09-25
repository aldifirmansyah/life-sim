/* The island: real Singapore, compressed. Real latitude and longitude map to game
   metres at 1:10 around (1.35 N, 103.82 E), so the island is about 4.7 × 3.3 km.
   +x is east, +z is south. Towns sit at their real (compressed) centres; what's
   built inside a town is laid out at a gentler scale by the generator, and the
   ground between towns is generated filler (estates, greenery, industry).
   Everything here is data and pure functions: the coastline, water, land use,
   towns and the region names for the HUD. */

export const LAT0 = 1.35,
  LON0 = 103.82;
/** Game metres per degree (1:10 of the real 110.57 km and 111.29 km). */
const KZ = 11057,
  KX = 11129;

/** Real (lat, lon) to game (x, z). */
export const toGame = (lat: number, lon: number): [number, number] => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
/** Game (x, z) to real (lat, lon). */
export const toReal = (x: number, z: number): [number, number] => [LAT0 - z / KZ, LON0 + x / KX];
/** Game metres represent this many real metres between towns. */
export const SCALE = 10;

type LL = [number, number];
const poly = (pts: LL[]) => pts.map(([la, lo]) => toGame(la, lo));

/** The main island, clockwise from Tuas. */
const MAIN: LL[] = [
  [1.318, 103.618],
  [1.335, 103.625],
  [1.352, 103.64],
  [1.37, 103.67],
  [1.385, 103.695],
  [1.405, 103.705],
  [1.425, 103.715],
  [1.44, 103.73],
  [1.448, 103.75],
  [1.452, 103.77],
  [1.448, 103.786],
  [1.456, 103.805],
  [1.464, 103.82],
  [1.465, 103.84],
  [1.453, 103.86],
  [1.44, 103.872],
  [1.43, 103.89],
  [1.42, 103.905],
  [1.408, 103.92],
  [1.395, 103.94],
  [1.386, 103.96],
  [1.392, 103.98],
  [1.394, 103.995],
  [1.38, 104.01],
  [1.36, 104.03],
  [1.335, 104.035],
  [1.32, 104.015],
  [1.31, 103.99],
  [1.305, 103.965],
  [1.302, 103.94],
  [1.299, 103.915],
  [1.295, 103.895],
  [1.288, 103.88],
  [1.278, 103.87],
  [1.268, 103.862],
  [1.264, 103.848],
  [1.26, 103.83],
  [1.266, 103.815],
  [1.275, 103.795],
  [1.285, 103.775],
  [1.295, 103.755],
  [1.3, 103.735],
  [1.305, 103.715],
  [1.31, 103.695],
  [1.305, 103.67],
  [1.31, 103.64],
];
const SENTOSA: LL[] = [
  [1.258, 103.806],
  [1.261, 103.82],
  [1.257, 103.838],
  [1.249, 103.843],
  [1.243, 103.83],
  [1.246, 103.812],
];
const UBIN: LL[] = [
  [1.418, 103.935],
  [1.421, 103.96],
  [1.414, 103.985],
  [1.402, 103.99],
  [1.398, 103.962],
  [1.405, 103.94],
];
const JURONG_ISLAND: LL[] = [
  [1.284, 103.66],
  [1.29, 103.69],
  [1.281, 103.72],
  [1.256, 103.72],
  [1.246, 103.69],
  [1.26, 103.66],
];
const TEKONG: LL[] = [
  [1.425, 104.03],
  [1.43, 104.06],
  [1.41, 104.08],
  [1.395, 104.06],
  [1.4, 104.035],
];
export const ISLANDS = {
  main: poly(MAIN),
  sentosa: poly(SENTOSA),
  ubin: poly(UBIN),
  jurongIsland: poly(JURONG_ISLAND),
  tekong: poly(TEKONG),
};
/** Water inside the coastline: Marina Bay and the reservoirs. */
export const WATERS = {
  marinaBay: poly([
    [1.2914, 103.8532],
    [1.2906, 103.8596],
    [1.287, 103.8626],
    [1.2842, 103.8614],
    [1.2836, 103.8562],
    [1.2862, 103.8534],
  ]),
  kallang: poly([
    [1.304, 103.863],
    [1.3035, 103.874],
    [1.297, 103.878],
    [1.2935, 103.87],
  ]),
  macritchie: poly([
    [1.346, 103.815],
    [1.352, 103.825],
    [1.344, 103.834],
    [1.338, 103.826],
  ]),
  upperSeletar: poly([
    [1.405, 103.795],
    [1.41, 103.815],
    [1.398, 103.825],
    [1.392, 103.805],
  ]),
  jurongLake: poly([
    [1.344, 103.724],
    [1.342, 103.733],
    [1.336, 103.731],
    [1.337, 103.724],
  ]),
};

type Poly = [number, number][];
export function inPoly(p: Poly, x: number, z: number) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i],
      [xj, zj] = p[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
/** Distance from a point to a polygon's outline. */
export function polyEdgeDist(p: Poly, x: number, z: number) {
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
  airport: poly([
    [1.374, 103.972],
    [1.378, 104.0],
    [1.36, 104.022],
    [1.332, 104.02],
    [1.328, 103.99],
    [1.345, 103.975],
  ]),
  catchment: poly([
    [1.405, 103.775],
    [1.408, 103.8],
    [1.39, 103.835],
    [1.36, 103.838],
    [1.34, 103.83],
    [1.335, 103.8],
    [1.35, 103.775],
    [1.38, 103.77],
  ]),
  westCatchment: poly([
    [1.41, 103.66],
    [1.42, 103.7],
    [1.4, 103.715],
    [1.37, 103.705],
    [1.36, 103.68],
    [1.38, 103.66],
  ]),
  tuas: poly([
    [1.35, 103.62],
    [1.35, 103.695],
    [1.325, 103.72],
    [1.302, 103.72],
    [1.305, 103.64],
    [1.318, 103.62],
  ]),
};

export type Land = 'sea' | 'water' | 'beach' | 'urban' | 'forest' | 'airport' | 'industry' | 'park';
/** What the ground is at (x, z). */
export function landAt(x: number, z: number): Land {
  const onIsland =
    inPoly(ISLANDS.main, x, z) ||
    inPoly(ISLANDS.sentosa, x, z) ||
    inPoly(ISLANDS.ubin, x, z) ||
    inPoly(ISLANDS.jurongIsland, x, z) ||
    inPoly(ISLANDS.tekong, x, z);
  if (!onIsland) return 'sea';
  for (const w of Object.values(WATERS)) if (inPoly(w, x, z)) return 'water';
  if (inPoly(ISLANDS.ubin, x, z) || inPoly(ISLANDS.tekong, x, z)) return 'forest';
  if (inPoly(ISLANDS.jurongIsland, x, z)) return 'industry';
  if (inPoly(ZONE_POLYS.airport, x, z)) return 'airport';
  if (inPoly(ZONE_POLYS.catchment, x, z) || inPoly(ZONE_POLYS.westCatchment, x, z)) return 'forest';
  if (inPoly(ZONE_POLYS.tuas, x, z)) return 'industry';
  // A strip of sand along the south-east coast (East Coast Park) and Sentosa's south shore.
  const coast = polyEdgeDist(ISLANDS.main, x, z);
  if (coast < 9 && x > 400 && z > 300) return 'beach';
  if (inPoly(ISLANDS.sentosa, x, z) && polyEdgeDist(ISLANDS.sentosa, x, z) < 8 && z > 1110) return 'beach';
  if (inPoly(ISLANDS.sentosa, x, z)) return 'park';
  if (coast < 30 && x > 400 && z > 300) return 'park';
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
export interface Town {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Radius in game metres of what's built as the town. */
  r: number;
  kind: TownKind;
  /** Planning region, for the HUD and the map. */
  region: 'Central' | 'West' | 'North' | 'North-East' | 'East' | 'Islands';
}
const T = (
  id: string,
  name: string,
  lat: number,
  lon: number,
  kind: TownKind,
  r: number,
  region: Town['region'],
): Town => {
  const [x, z] = toGame(lat, lon);
  return { id, name, x, z, r, kind, region };
};

export const TOWNS: Town[] = [
  // East
  T('changi_airport', 'Changi Airport', 1.3574, 103.9884, 'airport', 110, 'East'),
  T('changi_village', 'Changi Village', 1.389, 103.987, 'lowrise', 35, 'East'),
  T('expo', 'Expo', 1.3355, 103.9615, 'mixed', 40, 'East'),
  T('tampines', 'Tampines', 1.3544, 103.9453, 'hdb', 100, 'East'),
  T('pasir_ris', 'Pasir Ris', 1.373, 103.9493, 'hdb', 70, 'East'),
  T('simei', 'Simei', 1.3432, 103.9533, 'hdb', 40, 'East'),
  T('tanah_merah', 'Tanah Merah', 1.3272, 103.9465, 'hdb', 50, 'East'),
  T('bedok', 'Bedok', 1.324, 103.93, 'hdb', 85, 'East'),
  T('katong', 'Katong', 1.305, 103.905, 'shophouse', 55, 'East'),
  T('joo_chiat', 'Joo Chiat', 1.312, 103.902, 'shophouse', 40, 'East'),
  T('geylang_serai', 'Geylang Serai', 1.3165, 103.899, 'mixed', 40, 'East'),
  T('paya_lebar', 'Paya Lebar', 1.3176, 103.8926, 'mixed', 45, 'Central'),
  T('geylang', 'Geylang', 1.313, 103.88, 'shophouse', 55, 'Central'),
  T('kallang', 'Kallang', 1.3065, 103.873, 'mixed', 40, 'Central'),
  // Central
  T('marina_bay', 'Marina Bay', 1.2834, 103.8607, 'landmark', 75, 'Central'),
  T('raffles', 'Raffles Place', 1.284, 103.8515, 'cbd', 70, 'Central'),
  T('city_hall', 'City Hall', 1.2931, 103.852, 'civic', 50, 'Central'),
  T('clarke_quay', 'Clarke Quay', 1.2906, 103.8465, 'shophouse', 35, 'Central'),
  T('chinatown', 'Chinatown', 1.2836, 103.8443, 'shophouse', 55, 'Central'),
  T('tanjong_pagar', 'Tanjong Pagar', 1.2764, 103.8457, 'cbd', 50, 'Central'),
  T('bugis', 'Bugis', 1.3008, 103.8559, 'mixed', 45, 'Central'),
  T('kampong_glam', 'Kampong Glam', 1.3022, 103.859, 'shophouse', 30, 'Central'),
  T('little_india', 'Little India', 1.3066, 103.8493, 'shophouse', 50, 'Central'),
  T('orchard', 'Orchard Road', 1.304, 103.8318, 'mall', 90, 'Central'),
  T('botanic', 'Botanic Gardens', 1.3138, 103.8159, 'park', 70, 'Central'),
  T('tiong_bahru', 'Tiong Bahru', 1.2862, 103.827, 'lowhdb', 45, 'Central'),
  T('novena', 'Novena', 1.3204, 103.8438, 'mixed', 40, 'Central'),
  T('toa_payoh', 'Toa Payoh', 1.3327, 103.8474, 'hdb', 85, 'Central'),
  T('bishan', 'Bishan', 1.351, 103.8485, 'hdb', 75, 'Central'),
  T('queenstown', 'Queenstown', 1.2945, 103.806, 'hdb', 60, 'Central'),
  T('harbourfront', 'HarbourFront', 1.2653, 103.822, 'mall', 55, 'Central'),
  // North-East
  T('ang_mo_kio', 'Ang Mo Kio', 1.37, 103.8496, 'hdb', 95, 'North-East'),
  T('serangoon', 'Serangoon', 1.3498, 103.8737, 'hdb', 65, 'North-East'),
  T('hougang', 'Hougang', 1.3712, 103.8923, 'hdb', 75, 'North-East'),
  T('sengkang', 'Sengkang', 1.3917, 103.895, 'hdb', 85, 'North-East'),
  T('punggol', 'Punggol', 1.4052, 103.9024, 'hdb', 85, 'North-East'),
  // North
  T('yishun', 'Yishun', 1.4295, 103.835, 'hdb', 85, 'North'),
  T('sembawang', 'Sembawang', 1.4491, 103.8201, 'hdb', 65, 'North'),
  T('woodlands', 'Woodlands', 1.437, 103.7865, 'hdb', 95, 'North'),
  T('mandai', 'Mandai', 1.4043, 103.793, 'park', 55, 'North'),
  // West
  T('bukit_panjang', 'Bukit Panjang', 1.3784, 103.7621, 'hdb', 65, 'West'),
  T('choa_chu_kang', 'Choa Chu Kang', 1.3854, 103.7443, 'hdb', 75, 'West'),
  T('bukit_batok', 'Bukit Batok', 1.349, 103.7496, 'hdb', 70, 'West'),
  T('jurong_east', 'Jurong East', 1.3331, 103.7422, 'mall', 80, 'West'),
  T('jurong_lake', 'Jurong Lake Gardens', 1.341, 103.726, 'park', 45, 'West'),
  T('jurong_west', 'Jurong West', 1.3404, 103.707, 'hdb', 95, 'West'),
  T('tuas', 'Tuas', 1.33, 103.645, 'industrial', 130, 'West'),
  T('clementi', 'Clementi', 1.3151, 103.7652, 'hdb', 85, 'West'),
  T('dover', 'Dover', 1.3114, 103.7786, 'hdb', 38, 'West'),
  T('west_coast', 'West Coast', 1.2965, 103.7625, 'park', 40, 'West'),
  T('nus', 'NUS Kent Ridge', 1.2966, 103.7764, 'campus', 70, 'West'),
  T('science_park', 'Science Park', 1.2915, 103.787, 'campus', 42, 'West'),
  T('one_north', 'one-north', 1.2996, 103.7874, 'campus', 38, 'West'),
  T('buona_vista', 'Buona Vista', 1.3072, 103.7903, 'mixed', 38, 'West'),
  T('holland', 'Holland Village', 1.3113, 103.7958, 'lowrise', 32, 'Central'),
  // The islands
  T('sentosa', 'Sentosa', 1.2494, 103.8303, 'resort', 110, 'Islands'),
  T('ubin', 'Pulau Ubin', 1.41, 103.96, 'kampung', 90, 'Islands'),
];
export const townById = (id: string) => TOWNS.find(t => t.id === id)!;

/** The town whose area (grown a little) contains (x, z), nearest first. */
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

/** The planning region by position, for places outside any town. */
export function regionAt(x: number, z: number): Town['region'] {
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

/** The name of where (x, z) is, for the HUD: a town, a named area, or the region. */
export function placeName(x: number, z: number): string {
  const land = landAt(x, z);
  if (land === 'sea') return z > 700 ? 'Singapore Strait' : z < -700 ? 'Strait of Johor' : 'The sea';
  if (land === 'water') {
    for (const [k, w] of Object.entries(WATERS))
      if (inPoly(w, x, z))
        return (
          {
            marinaBay: 'Marina Bay',
            kallang: 'Kallang Basin',
            macritchie: 'MacRitchie Reservoir',
            upperSeletar: 'Upper Seletar Reservoir',
            jurongLake: 'Jurong Lake',
          } as Record<string, string>
        )[k];
  }
  const t = townAt(x, z);
  if (t) return t.name;
  if (land === 'forest')
    return inPoly(ZONE_POLYS.catchment, x, z)
      ? 'Central Catchment'
      : inPoly(ISLANDS.ubin, x, z)
        ? 'Pulau Ubin'
        : 'Western Catchment';
  if (land === 'airport') return 'Changi Airport';
  if (land === 'industry') return inPoly(ISLANDS.jurongIsland, x, z) ? 'Jurong Island' : 'Tuas';
  if (land === 'beach' || (land === 'park' && x > 400)) return 'East Coast Park';
  return `${regionAt(x, z)} Region`;
}

/** The island's bounds in game metres (for the map and the chunk grid). */
export const BOUNDS = { x0: -2400, x1: 3000, z0: -1400, z1: 1300 };
