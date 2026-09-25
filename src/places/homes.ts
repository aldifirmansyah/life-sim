/* A place to live (step 5). Five homes to rent, found on the HomeLah app (the
   phone, P): a common room in an HDB flat in Clementi, an art deco studio in
   Tiong Bahru, a condo room in River Valley, a co-living room in Tanjong Pagar,
   a shophouse loft in Katong. Each is walk-in:
   - lift homes (Clementi, the condo): a void deck with the lift, a corridor along
     the south face upstairs, the unit's door off it;
   - street homes: the ground floor's shell with the unit's own door.
   Renting: book a viewing (a time), be at the door then, sign the lease there
   (deposit and the first month), and it's home: the door opens for Aldi, mornings
   start there, rent goes out on the 1st at 09:00. Moving again returns the
   deposit. Until then Aldi stays at one-north, which charges by the night after
   the first two weeks (from Monday 10 August).
   Decorating ("Make it yours"): furniture and small things bought for the home,
   drawn as a prop set rebuilt when something is added; each lifts the mood a
   little every morning. */
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { addCol } from '../core/collision';
import { addFloor } from '../core/levels';
import { interiors } from '../interiors/interior';
import { Door } from '../interiors/door';
import { register } from '../game/interact';
import { openPanel, closePanel, type Row } from '../ui/panel';
import { toast } from '../ui/hud';
import { S } from '../core/state';
import { player } from '../core/player';
import { blink, passTime, sleep, setWake } from '../core/time';
import { spend, earn, sgd, addEnergy, addMood } from '../game/stats';
import { dateOf, shortDate, DAYS, weekday } from '../game/calendar';
import { markTo } from '../game/marker';
import { goalLines } from '../game/work';
import { HOME_SITES, unitOf, type HomeId, type HomeSite } from './sites';

interface HomeInfo {
  name: string;
  area: string;
  what: string;
  rent: number;
  deposit: number;
  landlord: string;
  commute: string;
  pitch: string;
  viewing: string;
  wall: string;
  floor: string;
}
export const HOMES: Record<HomeId, HomeInfo> = {
  clementi: {
    name: 'Blk 420 Clementi',
    area: 'Clementi · West',
    what: 'Common room in an HDB flat, with the family',
    rent: 900,
    deposit: 900,
    landlord: 'Aunty Mei',
    commute: 'Bus 96 to Chopee, 10 min · MRT 3 min walk',
    pitch: 'Aircon, own room, share bathroom. Aunty cooks sometimes. No cooking durian.',
    viewing:
      'Aunty Mei shows the room: small but bright, a fan and an aircon, a window over the void deck. "My son overseas already, so the room empty. You work where? Chopee! Wah, good company."',
    wall: '#f1ead8',
    floor: '#c9b48e',
  },
  tiong: {
    name: 'Tiong Bahru art deco studio',
    area: 'Tiong Bahru · Central',
    what: 'Whole studio in a 1930s walk-up',
    rent: 1900,
    deposit: 1900,
    landlord: 'Mr Tan',
    commute: 'MRT to Buona Vista, then bus 96: 25 min · CBD 10 min',
    pitch: 'Curved balconies, cafés downstairs, the market on the corner.',
    viewing:
      'Mr Tan unlocks the studio: high ceiling, terrazzo floor, a round window. "My grandfather bought this in 1950. Please take care of it, hor."',
    wall: '#f4efe4',
    floor: '#b9b2a5',
  },
  condo: {
    name: 'The Riverside Vue, #12-04',
    area: 'River Valley · Central',
    what: 'Master room in a condo, with a pool and gym',
    rent: 2400,
    deposit: 2400,
    landlord: 'Priya (agent)',
    commute: 'MRT from Orchard to Buona Vista, then bus 96: 30 min',
    pitch: 'Pool, gym, BBQ pits, security. Near Orchard.',
    viewing:
      'Priya from the agency walks Aldi through: marble floor, a view of the river, the pool twelve floors down. "Very in demand, this one. Decide fast ah."',
    wall: '#eef0f0',
    floor: '#d8d4ca',
  },
  coliv: {
    name: 'CoLiv Tanjong Pagar',
    area: 'Tanjong Pagar · Central',
    what: 'Room in a co-living house, shared kitchen',
    rent: 1600,
    deposit: 800,
    landlord: 'Jess (community manager)',
    commute: 'Walk to the city office · MRT to Buona Vista, then bus 96: 30 min',
    pitch: 'Young expats, weekly dinners, cleaning included, a short walk to the CBD.',
    viewing:
      'Jess shows the room and the kitchen: "Thursday we do family dinner, everyone cooks. You cook Indonesian? Please say yes."',
    wall: '#e9eef2',
    floor: '#a98d6e',
  },
  katong: {
    name: 'Katong shophouse loft',
    area: 'Katong · East',
    what: 'Loft above a shophouse, near the beach',
    rent: 1700,
    deposit: 1700,
    landlord: 'Uncle Rahim',
    commute: 'Bus and MRT to Chopee: 40 min · East Coast beach 10 min',
    pitch: 'Peranakan tiles, laksa downstairs, the sea at the end of the road.',
    viewing:
      'Uncle Rahim, in a batik shirt: "Selamat datang! Dari Indonesia? Wah, saya punya nenek dari Medan." The loft smells of old wood and the laksa shop below.',
    wall: '#f6ecd6',
    floor: '#8a6a4a',
  },
};

interface Deco {
  id: string;
  name: string;
  price: number;
}
const DECO: Deco[] = [
  { id: 'plant', name: 'A monstera in a pot', price: 25 },
  { id: 'rug', name: 'A batik-print rug', price: 60 },
  { id: 'lamp', name: 'A reading lamp', price: 45 },
  { id: 'poster', name: 'A poster of the Jakarta skyline', price: 20 },
  { id: 'shelf', name: 'A bookshelf', price: 120 },
  { id: 'beanbag', name: 'A beanbag', price: 90 },
  { id: 'lights', name: 'Fairy lights', price: 15 },
  { id: 'flag', name: 'A small Merah Putih flag', price: 10 },
];

/** Aldi's housing. */
export const home = {
  id: null as HomeId | null,
  since: 0,
  appt: null as { id: HomeId; day: number; time: number } | null,
  /** Months (index) whose rent is paid. */
  paid: [] as number[],
  deco: {} as Partial<Record<HomeId, string[]>>,
  /** The last day a night at one-north was charged. */
  night: 0,
};
/** The last free night at one-north (Sunday 9 August). */
const FREE_UNTIL = 15;

const built: Partial<
  Record<HomeId, { door: Door; bed: [number, number, number]; entry: [number, number, number]; extra: PropSet | null }>
> = {};

export function buildHomes() {
  for (const s of HOME_SITES) buildHome(s);
  goalLines.push(() => {
    if (home.appt)
      return `Viewing: ${HOMES[home.appt.id].name}, ${shortDate(home.appt.day)} ${hhmm(home.appt.time)}`;
    if (!home.id)
      return S.day <= FREE_UNTIL
        ? `Find a place to live: HomeLah on the phone (P). one-north is free until ${shortDate(FREE_UNTIL)}`
        : 'Find a place to live: HomeLah (P). one-north now charges S$140 a night';
    return null;
  });
}

const hhmm = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;

function buildHome(s: HomeSite) {
  const info = HOMES[s.id];
  const u = unitOf(s);
  const Y = u.y;
  const p = new PropSet('home-' + s.id);
  const bx0 = s.x - s.w / 2,
    bx1 = s.x + s.w / 2,
    bz0 = s.z - s.d / 2,
    bz1 = s.z + s.d / 2;
  const col = (ax: number, bx: number, az: number, bz: number, y0: number, y1: number) => {
    const c = addCol(ax, bx, az, bz, undefined, y0, y1);
    c.on = false;
    p.cols.push(c);
  };
  const wall = (ax: number, bx: number, az: number, bz: number, y0: number, y1: number, c: string) => {
    p.box(ax, bx, y0, y1, az, bz, c);
    col(ax, bx, az, bz, y0 - 1, y1);
  };
  const doorX = u.x0 + 2;
  let entry: [number, number, number];
  if (s.floor !== undefined) {
    // The void deck: pillars, tiles, letterboxes, a stone table; the lift core at the east end.
    p.box(bx0, bx1, 0, 0.06, bz0, bz1, '#c8c2b4');
    for (let x = bx0 + 0.4; x <= bx1; x += 6)
      for (const z of [bz0 + 0.4, bz1 - 0.4]) {
        p.box(x - 0.35, x + 0.35, 0, 3.4, z - 0.35, z + 0.35, '#e8e0cc');
        col(x - 0.35, x + 0.35, z - 0.35, z + 0.35, -1, 3.4);
      }
    wall(bx0 + 2, bx0 + 8, bz0 + 1, bz0 + 1.4, 0, 1.8, '#9aa3a9'); // letterboxes
    p.put(s.x - 6, 0.4, s.z, 1.2, 0.8, 1.2, '#9e9a92', 0, p.cyl);
    for (const [dx, dz] of [
      [1.2, 0],
      [-1.2, 0],
      [0, 1.2],
      [0, -1.2],
    ])
      p.put(s.x - 6 + dx, 0.22, s.z + dz, 0.4, 0.44, 0.4, '#9e9a92', 0, p.cyl);
    const lx = bx1 - 4;
    wall(lx - 1.5, lx + 1.5, s.z - 1.5, s.z + 1.5, 0, 3.4, '#d9d2c3');
    p.box(lx - 0.8, lx + 0.8, 0, 2.2, s.z + 1.5, s.z + 1.56, '#b9c0c6');
    const level = Math.round(s.floor / 2.9) + 1;
    sign(
      { text: s.id === 'condo' ? 'The Riverside Vue' : 'Blk 420', sub: s.id === 'condo' ? 'Tower B' : 'Clementi Ave 3', w: 2.6, h: 0.7, bg: '#1d2b36', fg: '#ffffff', border: '#f2c14e', subfg: '#f2c14e', font: 'ui' },
      lx,
      2.8,
      s.z + 1.6,
      0,
    );
    // The corridor upstairs along the south face, with its parapet, and the lift there.
    const cy = s.floor;
    p.box(bx0, bx1, cy - 0.25, cy, bz1, bz1 + 2, '#cfc8b8');
    addFloor(s.x, bz1 + 1, s.w / 2, 1, 0, cy);
    wall(bx0, bx1, bz1 + 1.9, bz1 + 2.1, cy, cy + 1.1, '#efe6d2');
    wall(bx0 - 0.2, bx0, bz1, bz1 + 2, cy, cy + 2.6, '#efe6d2');
    wall(bx1, bx1 + 0.2, bz1, bz1 + 2, cy, cy + 2.6, '#efe6d2');
    p.box(bx0, bx1, cy + 2.6, cy + 2.75, bz1, bz1 + 2.1, '#e4ddd0');
    p.box(lx - 0.8, lx + 0.8, cy, cy + 2.2, bz1 + 0.02, bz1 + 0.08, '#b9c0c6');
    register({
      x: lx,
      y: 1.2,
      z: s.z + 1.7,
      reach: 3,
      size: 1.2,
      label: () => `Lift to level ${level}`,
      run: () => blink(`Level ${level}`, () => Object.assign(player, { x: lx, z: bz1 + 1, y: cy, yaw: Math.PI / 2 })),
    });
    register({
      x: lx,
      y: cy + 1.2,
      z: bz1 + 0.2,
      reach: 3,
      size: 1.2,
      label: () => 'Lift down to the void deck',
      run: () => blink('Ground floor', () => Object.assign(player, { x: lx, z: s.z + 2.6, y: 0, yaw: 0 })),
    });
    entry = [lx, 1.2, s.z + 2];
    // The condo's pool, on the deck south of the tower.
    if (s.id === 'condo') {
      p.box(s.x - 10, s.x + 10, 0, 0.1, bz1 + 6, bz1 + 16, '#e6e0d4');
      p.box(s.x - 8, s.x + 8, 0.1, 0.14, bz1 + 7.5, bz1 + 14.5, '#4fb3d9');
      register({
        x: s.x,
        y: 0.5,
        z: bz1 + 11,
        reach: 6,
        size: 4,
        label: () => (home.id === 'condo' ? 'Swim a few laps' : null),
        run: () =>
          passTime(40, 'Swimming…', () => {
            addEnergy(-6);
            addMood(8);
            toast('Twenty laps', 'The pool to yourself, the towers all round. Condo life, not bad.', null);
          }),
      });
    }
  } else {
    // A street home: the ground floor's shell, the unit's door in its south wall.
    p.box(bx0, bx1, 0, 0.08, bz0, bz1, '#bdb6a8');
    wall(bx0, bx1, bz0 - 0.2, bz0, 0, 3.4, s.color);
    wall(bx0 - 0.2, bx0, bz0, bz1, 0, 3.4, s.color);
    wall(bx1, bx1 + 0.2, bz0, bz1, 0, 3.4, s.color);
    wall(bx0, u.x0, bz1, bz1 + 0.2, 0, 3.4, s.color);
    wall(u.x1, bx1, bz1, bz1 + 0.2, 0, 3.4, s.color);
    p.box(bx0, bx1, 3.2, 3.4, bz0, bz1, '#d9d2c3');
    entry = [doorX, 1.2, bz1 + 1];
  }
  // The unit: floor, ceiling, walls with the door (and a window) in the south wall.
  const { x0, x1, z0, z1 } = u;
  const H = Y + u.h;
  p.box(x0, x1, Y, Y + 0.06, z0, z1, info.floor);
  p.box(x0, x1, H, H + 0.1, z0, z1, '#f4f2ec');
  wall(x0 + 0.05, x1 - 0.05, z0, z0 + 0.15, Y, H, info.wall);
  wall(x0 + 0.05, x0 + 0.2, z0, z1, Y, H, info.wall);
  wall(x1 - 0.2, x1 - 0.05, z0, z1, Y, H, info.wall);
  wall(x0 + 0.05, doorX - 0.55, z1 - 0.15, z1 - 0.05, Y, H, info.wall);
  wall(doorX + 0.55, x1 - 4, z1 - 0.15, z1 - 0.05, Y, H, info.wall);
  wall(x1 - 1, x1 - 0.05, z1 - 0.15, z1 - 0.05, Y, H, info.wall);
  p.box(doorX - 0.55, doorX + 0.55, Y + 2.2, H, z1 - 0.15, z1 - 0.05, info.wall);
  // The window between x1 − 4 and x1 − 1.
  p.box(x1 - 4, x1 - 1, Y, Y + 0.9, z1 - 0.15, z1 - 0.05, info.wall);
  col(x1 - 4, x1 - 1, z1 - 0.15, z1 - 0.05, Y - 1, H);
  p.box(x1 - 4, x1 - 1, Y + 2.2, H, z1 - 0.15, z1 - 0.05, info.wall);
  p.box(x1 - 4, x1 - 1, Y + 0.9, Y + 2.2, z1 - 0.12, z1 - 0.08, '#a9cbd8', { b: p.glass });
  // Furniture: the bed (north-east), a wardrobe, a desk and chair (north-west), and by kind.
  const bed: [number, number, number] = [x1 - 1.2, Y + 0.6, z0 + 1.4];
  p.box(x1 - 2.2, x1 - 0.2, Y, Y + 0.45, z0 + 0.2, z0 + 2.4, '#8a6a4a');
  p.box(x1 - 2.15, x1 - 0.25, Y + 0.45, Y + 0.65, z0 + 0.25, z0 + 2.35, '#f4f2ea');
  p.box(x1 - 2.1, x1 - 0.3, Y + 0.65, Y + 0.7, z0 + 1, z0 + 2.3, s.id === 'katong' ? '#2f6b4f' : '#3b7dd8');
  col(x1 - 2.2, x1 - 0.2, z0 + 0.2, z0 + 2.4, Y - 1, Y + 0.7);
  p.box(x0 + 0.2, x0 + 0.8, Y, Y + 2.1, z0 + 3, z0 + 4.6, '#b89b7a');
  col(x0 + 0.2, x0 + 0.8, z0 + 3, z0 + 4.6, Y - 1, Y + 2.1);
  p.box(x0 + 0.3, x0 + 1.9, Y + 0.72, Y + 0.76, z0 + 0.2, z0 + 1, '#6b5139');
  col(x0 + 0.3, x0 + 1.9, z0 + 0.2, z0 + 1, Y - 1, Y + 0.8);
  p.box(x0 + 0.8, x0 + 1.4, Y, Y + 0.48, z0 + 1.3, z0 + 1.8, '#2f3a44');
  if (s.id === 'clementi') {
    // The family's living room is out there; Aldi's room is behind a partition (east).
    wall(x0 + 5, x0 + 5.15, z0 + 0.15, z1 - 3.2, Y, H, info.wall);
    wall(x0 + 5, x0 + 5.15, z1 - 2.1, z1 - 0.15, Y, H, info.wall);
    p.box(x0 + 1.2, x0 + 3.8, Y, Y + 0.45, z1 - 2.2, z1 - 1.3, '#7a4a3a'); // sofa
    p.box(x0 + 1.2, x0 + 3.8, Y + 0.45, Y + 0.9, z1 - 1.5, z1 - 1.3, '#6a3e30');
    col(x0 + 1.2, x0 + 3.8, z1 - 2.2, z1 - 1.3, Y - 1, Y + 0.9);
    p.box(x0 + 1.5, x0 + 3.5, Y + 0.5, Y + 1.5, z0 + 5.2, z0 + 5.3, '#1d2b36'); // the TV
    p.put(x0 + 2.5, Y + 0.5, z0 + 3.8, 1.3, 0.05, 1.3, '#d8d0c0', 0, p.cyl); // altar-side table
  } else {
    // A kitchenette on the west wall by the door.
    p.box(x0 + 0.2, x0 + 0.8, Y, Y + 0.95, z1 - 3.5, z1 - 1.3, '#d9d5cc');
    col(x0 + 0.2, x0 + 0.8, z1 - 3.5, z1 - 1.3, Y - 1, Y + 1);
    p.box(x0 + 0.25, x0 + 0.75, Y + 0.95, Y + 1, z1 - 3.4, z1 - 1.4, '#8a8e92');
  }
  p.light((x0 + x1) / 2, H - 0.1, (z0 + z1) / 2, 0.18, '#fff4d8');
  p.build();

  // The door: a viewing, the lease, then Aldi's own door.
  const F = (lx: number, lz: number): [number, number] => [doorX + lx, (z0 + z1) / 2 + lz];
  const door = new Door(F, 0, 0, (z1 - z0) / 2 + 0.07, '#6b4a2f', () => home.id !== s.id);
  door.pivot.position.y = Y;
  door.col.y0 = Y - 1;
  door.col.y1 = H;
  register({
    x: doorX,
    y: Y + 1.2,
    z: z1,
    reach: 2.6,
    size: 0.8,
    label: () => doorLabel(s.id, door),
    run: () => doorUse(s.id, door),
  });
  register({
    x: bed[0],
    y: bed[1],
    z: bed[2],
    reach: 2.4,
    size: 1.2,
    label: () => (home.id !== s.id ? null : S.time >= 20 * 60 ? 'Sleep until morning' : 'Rest for an hour'),
    run: () => (S.time >= 20 * 60 ? sleep() : passTime(60, 'Resting…', () => addEnergy(15))),
  });
  register({
    x: x0 + 1.1,
    y: Y + 0.9,
    z: z0 + 0.6,
    reach: 2.4,
    size: 0.8,
    label: () => (home.id === s.id ? 'Make it yours (decorate)' : null),
    run: () => decorate(s.id),
  });
  built[s.id] = { door, bed, entry, extra: null };
  const rooms = [{ name: s.id === 'clementi' ? 'Your room' : 'Home', x0, x1, z0, z1, y0: Y - 0.5, y1: Y + 3 }];
  if (s.id === 'clementi') rooms.unshift({ name: 'Living room', x0, x1: x0 + 5, z0, z1, y0: Y - 0.5, y1: Y + 3 });
  interiors.push({
    name: info.name,
    rooms,
    props: p,
    extra: () => built[s.id]!.extra,
    door,
    lamp: [(x0 + x1) / 2, H - 0.2, (z0 + z1) / 2],
    lampOn: () => home.id === s.id,
    showWithin: s.floor ? 120 : 60,
  });
  rebuildDeco(s.id);
}

/* ---------- viewings and the lease ---------- */

const apptNow = (id: HomeId) =>
  home.appt?.id === id && S.day === home.appt.day && S.time >= home.appt.time - 30 && S.time <= home.appt.time + 60;

function doorLabel(id: HomeId, door: Door) {
  if (home.id === id) return door.target > 0.5 ? 'Close the door' : 'Open the door';
  if (apptNow(id)) return `Viewing with ${HOMES[id].landlord}`;
  return `${HOMES[id].name} (knock)`;
}
function doorUse(id: HomeId, door: Door) {
  const h = HOMES[id];
  if (home.id === id) return door.toggle();
  if (!apptNow(id)) {
    toast(h.name, home.appt?.id === id ? `The viewing is at ${hhmm(home.appt.time)}.` : 'Nobody answers. Book a viewing on HomeLah (P).');
    return;
  }
  const cost = h.deposit + h.rent;
  openPanel({
    title: `Viewing: ${h.name}`,
    sub: `${h.what} · ${sgd(h.rent)} a month`,
    body: h.viewing,
    rows: [
      {
        label: `Sign the lease (deposit ${sgd(h.deposit)} + first month ${sgd(h.rent)})`,
        note: sgd(cost),
        disabled: undefined,
        run: () => sign_(id, door),
      },
      {
        label: 'Think about it',
        run: () => {
          home.appt = null;
          closePanel();
          toast(h.landlord, '"OK, let me know soon ah. Got other people asking."', null);
        },
      },
    ],
  });
}
function sign_(id: HomeId, door: Door) {
  const h = HOMES[id];
  if (!spend(h.deposit + h.rent)) return toast('Not enough money', `The deposit and the first month come to ${sgd(h.deposit + h.rent)}.`);
  closePanel();
  const old = home.id;
  if (old) {
    earn(HOMES[old].deposit);
    toast(`Moved out of ${HOMES[old].name}`, `Deposit back: ${sgd(HOMES[old].deposit)}.`, null);
  }
  home.id = id;
  home.since = S.day;
  home.appt = null;
  home.paid.push(dateOf(S.day).m);
  door.target = 1;
  wakeHome();
  addMood(12);
  toast(`Home: ${h.name}`, `Lease signed. The key is Aldi's. Rent ${sgd(h.rent)} on the 1st of each month.`, 'good');
}

/** Wake at home: beside the bed, with a little mood from how it's decorated. */
function wakeHome() {
  const id = home.id;
  if (!id) return;
  const b = built[id]!;
  setWake(
    () => Object.assign(player, { x: b.bed[0] - 1.6, z: b.bed[2] + 1.2, y: b.bed[1] - 0.6, yaw: Math.PI, pitch: 0 }),
    () => addMood(Math.min(6, (home.deco[id] ?? []).length)),
    `Morning at ${HOMES[id].name}.`,
  );
}

/* ---------- the app ---------- */

/** HomeLah: the listings. */
export function homeApp() {
  const rows: Row[] = (Object.keys(HOMES) as HomeId[]).map(id => ({
    label: `${HOMES[id].name} · ${HOMES[id].area}`,
    note: home.id === id ? 'your home' : `${sgd(HOMES[id].rent)}/mo`,
    run: () => listing(id),
  }));
  openPanel({
    title: 'HomeLah',
    sub: 'Rooms and flats for rent',
    body: home.id ? `Home: ${HOMES[home.id].name}. Rent ${sgd(HOMES[home.id].rent)} on the 1st.` : 'Pick a listing to see it and book a viewing.',
    rows,
  });
}
function listing(id: HomeId) {
  const h = HOMES[id];
  const slots: [number, number][] = [];
  if (S.time < 18.5 * 60) slots.push([S.day, 19.5 * 60]);
  slots.push([S.day + 1, 11 * 60], [S.day + 1, 19.5 * 60], [S.day + 2, 11 * 60]);
  openPanel({
    title: h.name,
    sub: `${h.area} · ${h.what}`,
    body: `${sgd(h.rent)} a month, deposit ${sgd(h.deposit)}. ${h.pitch} ${h.commute}. Contact: ${h.landlord}.`,
    back: homeApp,
    rows:
      home.id === id
        ? [{ label: 'Back', run: homeApp }]
        : [
            ...slots.map(([day, t]) => ({
              label: `Book a viewing: ${day === S.day ? 'today' : DAYS[weekday(day)]} ${hhmm(t)}`,
              note: shortDate(day),
              run: () => {
                home.appt = { id, day, time: t };
                closePanel();
                toast(`Viewing booked: ${h.name}`, `${shortDate(day)}, ${hhmm(t)}. ${h.landlord} will meet Aldi at the door.`, 'msg');
              },
            })),
            { label: 'Back', run: homeApp },
          ],
  });
}

/* ---------- decorating ---------- */

function decorate(id: HomeId) {
  const have = home.deco[id] ?? [];
  openPanel({
    title: 'Make it yours',
    sub: HOMES[id].name,
    body: have.length ? `${have.length} things so far. Every morning here feels a bit better.` : 'Bare walls. Time to make it feel like home.',
    keepPage: true,
    rows: DECO.map(d => ({
      label: d.name,
      note: have.includes(d.id) ? 'got it' : sgd(d.price),
      disabled: have.includes(d.id) ? 'Already here' : undefined,
      run: () => {
        if (!spend(d.price)) return toast('Not enough money', `${d.name} is ${sgd(d.price)}.`);
        home.deco[id] = [...have, d.id];
        rebuildDeco(id);
        addMood(3);
        decorate(id);
      },
    })),
  });
}

function rebuildDeco(id: HomeId) {
  const b = built[id];
  if (!b) return;
  if (b.extra) {
    for (const c of b.extra.cols) c.on = false;
    b.extra.dispose();
    b.extra = null;
  }
  const have = home.deco[id] ?? [];
  if (!have.length) return;
  const s = HOME_SITES.find(h => h.id === id)!;
  const { x0, x1, z0, z1, y: Y, h } = unitOf(s);
  const p = new PropSet('deco-' + id);
  for (const d of have)
    switch (d) {
      case 'plant':
        p.put(x1 - 0.6, Y + 0.25, z1 - 0.6, 0.5, 0.5, 0.5, '#b5553a', 0, p.cyl);
        p.put(x1 - 0.6, Y + 1.1, z1 - 0.6, 0.7, 1.3, 0.7, '#3f7d3a', 0.3, p.cone);
        break;
      case 'rug':
        p.box(x0 + 2.5, x1 - 3, Y + 0.06, Y + 0.08, z0 + 2.8, z1 - 2.5, '#9c4a34');
        p.box(x0 + 2.8, x1 - 3.3, Y + 0.08, Y + 0.09, z0 + 3.1, z1 - 2.8, '#e0a02a');
        break;
      case 'lamp':
        p.post(x1 - 2.6, z0 + 0.5, Y, Y + 1.4, 0.04, '#3a4046');
        p.light(x1 - 2.6, Y + 1.45, z0 + 0.5, 0.14, '#ffe2a8');
        break;
      case 'poster':
        p.box(x0 + 2.4, x0 + 3.8, Y + 1.3, Y + 2.2, z0 + 0.15, z0 + 0.18, '#3f7fd0');
        p.box(x0 + 2.5, x0 + 3.7, Y + 1.35, Y + 1.7, z0 + 0.18, z0 + 0.2, '#f2c14e');
        break;
      case 'shelf':
        p.box(x0 + 0.2, x0 + 0.6, Y, Y + 1.8, z0 + 5, z0 + 6.2, '#6b5139');
        for (let k = 0; k < 4; k++) p.box(x0 + 0.25, x0 + 0.55, Y + 0.3 + k * 0.4, Y + 0.55 + k * 0.4, z0 + 5.1, z0 + 6.1, ['#b8342a', '#2f8a4e', '#3f7fd0', '#e0a02a'][k]);
        break;
      case 'beanbag':
        p.put(x1 - 2.5, Y + 0.3, z1 - 1.4, 0.9, 0.6, 0.9, '#e07a1f', 0, p.cone);
        break;
      case 'lights':
        for (let x = x0 + 0.6; x < x1 - 0.4; x += 0.6) p.light(x, h + Y - 0.15 - Math.sin((x - x0) * 2) * 0.05, z0 + 0.25, 0.04, '#ffd98a');
        break;
      case 'flag':
        p.post(x0 + 4.3, z0 + 0.3, Y + 1.2, Y + 2.2, 0.02, '#8e969c');
        p.box(x0 + 4.32, x0 + 5, Y + 1.85, Y + 2.15, z0 + 0.29, z0 + 0.31, '#d7263d', { b: p.cloth });
        p.box(x0 + 4.32, x0 + 5, Y + 1.55, Y + 1.85, z0 + 0.29, z0 + 0.31, '#ffffff', { b: p.cloth });
        break;
    }
  p.build();
  b.extra = p;
}

/* ---------- the days ---------- */

let lastMin = -1,
  lastDay = -1;
export function updateHomes() {
  if (!S.started) return;
  const m = Math.floor(S.time);
  if (m === lastMin) return;
  lastMin = m;
  // A new morning without a home, after the free fortnight: another night at one-north.
  if (lastDay >= 0 && S.day !== lastDay && !home.id && S.day > FREE_UNTIL && home.night !== S.day) {
    home.night = S.day;
    if (spend(140)) toast('one-north Residences', `Another night in the studio: ${sgd(140)}. Time to find a place.`, null);
  }
  lastDay = S.day;
  // Rent on the 1st at 09:00.
  const { d, m: month } = dateOf(S.day);
  if (home.id && d === 1 && S.time >= 9 * 60 && !home.paid.includes(month) && home.since < S.day) {
    const rent = HOMES[home.id].rent;
    if (spend(rent)) {
      home.paid.push(month);
      toast(`Rent paid: ${sgd(rent)}`, `${HOMES[home.id].name} · to ${HOMES[home.id].landlord}.`, null);
    } else if (S.time < 9 * 60 + 1) {
      addMood(-5);
      toast(`${HOMES[home.id].landlord}`, '"Eh, the rent never come in yet leh."', 'msg');
    }
  }
  // A missed viewing.
  const a = home.appt;
  if (a && (S.day > a.day || (S.day === a.day && S.time > a.time + 60))) {
    home.appt = null;
    addMood(-2);
    toast(HOMES[a.id].landlord, '"You never come for the viewing? Nevermind, book again if you still want."', 'msg');
  }
}
/** The marker: to the viewing, from two hours before. */
export function homeMarker() {
  const a = home.appt;
  if (!a || S.day !== a.day || S.time < a.time - 120) return;
  const b = built[a.id]!;
  const s = HOME_SITES.find(h => h.id === a.id)!;
  const u = unitOf(s);
  const onFloor = s.floor !== undefined && player.y > s.floor - 2;
  markTo(`Viewing: ${HOMES[a.id].name}`, s.floor === undefined || onFloor ? [u.x0 + 2, u.y + 1, u.z1] : b.entry);
}

export const saveHomes = () => JSON.parse(JSON.stringify(home));
export function loadHomes(d: Partial<typeof home> | undefined) {
  Object.assign(home, { id: null, since: 0, appt: null, paid: [], deco: {}, night: 0 });
  if (d) Object.assign(home, d);
  for (const id of Object.keys(built) as HomeId[]) rebuildDeco(id);
  if (home.id) wakeHome();
  lastDay = -1;
}
