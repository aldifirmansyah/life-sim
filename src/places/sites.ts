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
