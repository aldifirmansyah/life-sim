/* Where the walk-in places of step 3 stand, shared by the generator (which keeps
   the ground clear for them) and the places themselves. Game metres. */

/** Chopee's headquarters on Science Park Drive: the walk-in lower floors (lobby 0–4.5 m, the team floor
    4.5–9 m); the tower above them is streamed like any building. The front faces the drive (south). */
export const CHOPEE_HQ = { x0: -642, x1: -608, z0: 277, z1: 299, h: 9, l2: 4.5 };
/** 448 Clementi Market & Food Centre, south of Clementi MRT; the bus interchange along its south side. */
export const CLEMENTI_HAWKER = { x: -935, z: 195, w: 30, d: 22 };
/** Chopee's city office: a tower at Raffles Place, the lobby walk-in (0–6 m) and the office on Level 30
    (a floor at 120 m, 4 m high); the tower is streamed from just above the lobby to 190 m. */
export const CITY_OFFICE = { x0: 214, x1: 242, z0: 504, z1: 532, lobby: 6, floor: 120, top: 190 };
/** Lau Pa Sat, the hawker market in the CBD (satay street at night). */
export const LAU_PA_SAT = { x: 175, z: 530, w: 30, d: 22 };
/** Boat Quay: a row of shophouses on the river's south bank, their café tables on the promenade. */
export const BOAT_QUAY = { x0: 160, x1: 262, z0: 472, z1: 482 };
/** Where the light show is watched from: the promenade by the Merlion. */
export const PROMENADE = { x: 300, z: 503 };

export type HomeId = 'clementi' | 'tiong' | 'condo' | 'coliv' | 'katong';
/** The homes to rent (step 5): the building (centre, size, height, facade) and the unit, which faces
    south. With `floor` the unit is upstairs, reached by a lift from the void deck and a corridor along
    the south face; without it, the unit is on the ground floor with its own door on the street. */
export interface HomeSite {
  id: HomeId;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  style: 'hdb' | 'office' | 'glass' | 'shophouse' | 'house';
  color: string;
  floor?: number;
}
export const HOME_SITES: HomeSite[] = [
  { id: 'clementi', x: -1013, z: 173, w: 40, d: 12, h: 38, style: 'hdb', color: '#efe6d2', floor: 17.4 },
  { id: 'tiong', x: -137, z: 447, w: 20, d: 12, h: 13, style: 'house', color: '#efe9dc' },
  { id: 'condo', x: 0, z: 240, w: 24, d: 24, h: 90, style: 'glass', color: '#a9bcc6', floor: 34.8 },
  { id: 'coliv', x: 197, z: 671, w: 20, d: 12, h: 16, style: 'office', color: '#e6d3a8' },
  { id: 'katong', x: 847, z: 393, w: 20, d: 14, h: 10, style: 'shophouse', color: '#9fc4b8' },
];
/** The walk-in unit of a home: 10 m wide on the south face, 8 m deep. */
export function unitOf(s: HomeSite) {
  const y = s.floor ?? 0;
  return { x0: s.x - 5, x1: s.x + 5, z0: s.z + s.d / 2 - 8, z1: s.z + s.d / 2, y, h: 2.8 };
}

/* Step 7: the rest of the centre. */
/** Masjid Sultan, walk-in; the entrance and the wudhu taps on the south side. */
export const MOSQUE = { x: 344, z: 24, w: 26, d: 30, h: 11 };
/** Tekka Centre (Little India) and Tiong Bahru Market: hawker centres. */
export const TEKKA = { x: 155, z: -54, w: 30, d: 22 };
export const TB_MARKET = { x: -62, z: 467, w: 30, d: 22 };
/** Haji Lane's shops (Kampong Glam), their fronts to the south. */
export const HAJI_LANE = { x0: 335, x1: 365, z0: 52, z1: 60 };
/** Chinatown's street market, the stalls facing north towards the temple. */
export const CT_MARKET = { x0: 42, x1: 78, z0: 548, z1: 556 };
/** Lucky Place on Orchard Road: the ground floor walk-in (the Indonesian shops), the mall above streamed. */
export const LUCKY = { x0: -7, x1: 23, z0: -5, z1: 21, h: 5 };

/* Step 8: the calendar's places. */
/** The Indonesian embassy off Orchard (Chatsworth Road): the compound for 17 Agustus. */
export const EMBASSY = { x: -170, z: 60, w: 30, d: 24 };
/** The getai stage by Blk 420, in Hungry Ghost month. */
export const GETAI = { x: -1013, z: 200 };

/* Step 9: the East, Sentosa and the North. */
/** Katong's Peranakan shophouses (laksa, kueh), facing north. */
export const KATONG_ROW = { x0: 870, x1: 906, z0: 403, z1: 411 };
/** East Coast Lagoon Food Village, and the beach by it (the bike kiosk, the sea). */
export const LAGOON = { x: 986, z: 492, w: 30, d: 22 };
export const BEACH = { x: 1050, z: 535 };
/** The cable car from HarbourFront to Sentosa: the two stations (towers) and their height. */
export const CABLE = { ax: -40, az: 664, bx: 60, bz: 790, h: 30 };
/** Uniworsal Studios' gate (north of the globe) and Siloso Beach's bar. */
export const UNIWORSAL = { x: 120, z: 818 };
export const SILOSO = { x: 40, z: 908 };
/** Mandai Zoo (fenced, the gate on the south side by Woodlands Avenue). */
export const ZOO = { x: -380, z: -794, w: 70, d: 40 };
/** The MacRitchie trailhead, in the forest. */
export const TRAIL = { x: -150, z: -380 };
/** Woodlands Checkpoint, for the Causeway to Johor Bahru. */
export const CHECKPOINT = { x: -686, z: -906, w: 30, d: 16 };

/* Step 11: Aldi's own car. */
/** BB Drive Centre: the yard with the circuit, the office to its west. */
export const DRIVE_CENTRE = { x: -1194, z: 328, w: 60, d: 44 };
/** Leng Kee Autos, the used-car dealer. */
export const DEALER = { x: -358, z: 258 };
/** Petrol stations. */
export const PETROL = [
  { x: -820, z: 240 },
  { x: 620, z: 320 },
];
/** ERP gantries on the roads into the city: where, the road's direction (unit), its width. */
export const ERP = [
  { name: 'Nicoll Highway', x: 400, z: 270, dx: 0.99, dz: -0.124, w: 12 },
  { name: 'Orchard Road', x: 195, z: 110, dx: 0.747, dz: 0.664, w: 12 },
  { name: 'Marina Boulevard', x: 410, z: 620, dx: 0.984, dz: 0.179, w: 10 },
];
