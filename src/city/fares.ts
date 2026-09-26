/* The fare gates at the foot of the station stairs. With an EZ-Lah card they open
   as Aldi walks up to them; going in (from the street towards the stairs) taps in
   and pays the fare. Without a card they stay shut, and say where to get one.
   Inside the paid area, each platform has a way across to the other one (the
   overhead bridge), so taking the wrong direction never means tapping out. */
import { player } from '../core/player';
import { blink } from '../core/time';
import { toast } from '../ui/hud';
import { sfx } from '../audio/audio';
import { sign } from '../render/signs';
import { register } from '../game/interact';
import { wallet, spend, sgd } from '../game/stats';
import { fareGates } from './mrtbuild';
import { LINES, PLAT_OUT } from './mrtdata';

/** Where each platform's trains go: side −1 serves the trains towards the last station, side +1 the first
    (trains keep left). At an end station one side is where trains arrive and terminate. */
function endFor(l: (typeof LINES)[number], st: (typeof LINES)[number]['stations'][number], side: number) {
  const end = side < 0 ? l.stations[l.stations.length - 1] : l.stations[0];
  return end === st ? null : end;
}
/** Beside the stairs on every platform: a sign and E to cross to the other platform over the bridge. */
export function buildCrossings() {
  for (const l of LINES)
    for (const st of l.stations) {
      const { x, z, dx, dz } = st;
      const qx = -dz,
        qz = dx;
      const P = (u: number, v: number): [number, number] => [x + dx * u + qx * v, z + dz * u + qz * v];
      for (const side of [-1, 1]) {
        const other = -side;
        const to = endFor(l, st, other);
        const where = to ? `to ${to.name}` : 'arrivals';
        const [sx, sz] = P(6, side * (PLAT_OUT - 0.2));
        sign(
          {
            text: '⇄ Other platform',
            sub: `Trains ${where} · E`,
            w: 2.6,
            h: 0.7,
            bg: l.colour,
            fg: '#ffffff',
            subfg: '#ffffff',
            border: '#ffffff',
            font: 'ui',
          },
          sx,
          l.floor + 1.9,
          sz,
          Math.atan2(-side * qx, -side * qz),
        );
        const [ix, iz] = P(6, side * (PLAT_OUT - 0.8));
        register({
          x: ix,
          y: l.floor + 1.4,
          z: iz,
          reach: 3.5,
          size: 1.2,
          label: () =>
            Math.abs(player.y - l.floor) < 1 ? `Cross to the other platform (${to ? to.name : 'arrivals'})` : null,
          run: () =>
            blink('Over the bridge…', () => {
              const [tx, tz] = P(6, other * (PLAT_OUT - 1.4));
              Object.assign(player, { x: tx, z: tz, y: l.floor, vx: 0, vz: 0 });
              // Facing the tracks.
              player.yaw = Math.atan2(-(side * qx), -(side * qz));
              toast(st.name, to ? `Platform for trains to ${to.name}.` : 'The arrivals platform.', null);
            }),
        });
      }
    }
}

/** One flat fare per trip in. */
export const FARE = 1.2;
const last = new Map<object, number>();
let nagged = -1e9;

export function updateFares() {
  const now = performance.now();
  for (const g of fareGates) {
    const dx = player.x - g.x,
      dz = player.z - g.z;
    if (dx * dx + dz * dz > 36 || player.y > 2) {
      g.col.on = true;
      last.delete(g);
      continue;
    }
    // Which side of the gate: > 0 street, < 0 stairs.
    const s = dx * g.nx + dz * g.nz;
    const prev = last.get(g);
    last.set(g, s);
    const near = Math.hypot(dx, dz) < 2.6;
    if (!wallet.card) {
      g.col.on = true;
      if (near && s > 0 && now - nagged > 20000) {
        nagged = now;
        toast('The gates need a card', 'Buy an EZ-Lah card first (8-Twelve at the airport sells them).');
      }
      continue;
    }
    // Coming in, the gate only opens if the fare can be paid.
    g.col.on = !(near && (s < 0 || wallet.money >= FARE));
    if (prev === undefined) continue;
    if (prev > 0 && s <= 0) {
      if (spend(FARE))
        toast(`Tapped in · ${sgd(FARE)}`, `${g.station.name} · EZ-Lah balance ${sgd(wallet.money)}`, null);
      sfx('tap');
    } else if (prev < 0 && s >= 0) sfx('tap');
  }
}
