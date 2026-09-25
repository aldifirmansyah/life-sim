/* The fare gates at the foot of the station stairs. With an EZ-Lah card they open
   as Aldi walks up to them; going in (from the street towards the stairs) taps in
   and pays the fare. Without a card they stay shut, and say where to get one. */
import { player } from '../core/player';
import { toast } from '../ui/hud';
import { sfx } from '../audio/audio';
import { wallet, spend, sgd } from '../game/stats';
import { fareGates } from './mrtbuild';

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
