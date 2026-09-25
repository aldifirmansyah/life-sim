/* one-north Residences: the serviced apartment where Aldi stays for the first two
   weeks. The tower is an ordinary streamed building (city/gen.ts); the studio on
   the ground floor beside it is walk-in: a door that opens once Aldi has checked
   in, a bed (sleep, or rest an hour), a desk, a wardrobe, a kitchenette. After
   check-in, mornings start here. */
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { interiors } from '../interiors/interior';
import { Door } from '../interiors/door';
import { register } from '../game/interact';
import { toast } from '../ui/hud';
import { S } from '../core/state';
import { player } from '../core/player';
import { sleep, passTime, setWake } from '../core/time';
import { markDone, setTarget } from '../game/arrival';

/** The studio: x0..x1, z0..z1; the door in the middle of the south wall. */
export const STUDIO = { x0: -538, x1: -526, z0: 158, z1: 168, h: 3.4 };
export const TOWER = { x: -532, z: 148, w: 24, d: 18, h: 46 };
const DOOR_X = (STUDIO.x0 + STUDIO.x1) / 2;
const BED = { x: STUDIO.x0 + 1.2, z: STUDIO.z0 + 1.6 };

let checkedIn = false;
let door: Door;

function wakeHere() {
  setWake(
    () => {
      player.x = BED.x + 1.6;
      player.z = BED.z + 0.4;
      player.y = 0;
      player.yaw = Math.PI; // facing the door
      player.pitch = 0;
    },
    () => {},
    'Morning in the studio at one-north.',
  );
}

export function buildOneNorth() {
  const p = new PropSet('onenorth-studio');
  const { x0, x1, z0, z1, h } = STUDIO;
  const T = 0.15;
  p.box(x0, x1, 0, 0.12, z0, z1, '#cdb99a'); // wooden floor
  p.box(x0 - T, x1 + T, h, h + 0.3, z0 - T, z1 + T, '#e8e4dc'); // ceiling / roof
  p.box(x0 - T, x1 + T, 0, h, z0 - T, z0, '#efeae0', { col: true });
  p.box(x0 - T, x0, 0, h, z0, z1, '#efeae0', { col: true });
  // The east wall with a wide window.
  p.box(x1, x1 + T, 0, 0.9, z0, z1, '#efeae0', { col: true });
  p.box(x1, x1 + T, 2.6, h, z0, z1, '#efeae0', { col: true });
  p.box(x1, x1 + T, 0.9, 2.6, z0, z0 + 1, '#efeae0', { col: true });
  p.box(x1, x1 + T, 0.9, 2.6, z1 - 1, z1, '#efeae0', { col: true });
  p.box(x1 + 0.02, x1 + 0.06, 0.9, 2.6, z0 + 1, z1 - 1, '#a9cbd8', { col: true, b: p.cloth });
  // The south wall with the doorway.
  p.box(x0 - T, DOOR_X - 0.55, 0, h, z1, z1 + T, '#efeae0', { col: true });
  p.box(DOOR_X + 0.55, x1 + T, 0, h, z1, z1 + T, '#efeae0', { col: true });
  p.box(DOOR_X - 0.55, DOOR_X + 0.55, 2.2, h, z1, z1 + T, '#efeae0');
  // Bed, bedside table, desk and chair, wardrobe, kitchenette.
  p.box(x0, x0 + 2, 0.12, 0.5, z0, z0 + 3.2, '#8a6a4a', { col: true });
  p.box(x0 + 0.05, x0 + 1.95, 0.5, 0.72, z0 + 0.05, z0 + 3.1, '#f4f2ea');
  p.box(x0 + 0.2, x0 + 1.8, 0.72, 0.85, z0 + 0.1, z0 + 0.6, '#ffffff');
  p.box(x0 + 0.1, x0 + 1.9, 0.72, 0.78, z0 + 1.2, z0 + 3.1, '#3b7dd8');
  p.box(x0 + 2.1, x0 + 2.6, 0.12, 0.6, z0, z0 + 0.5, '#8a6a4a');
  p.box(x0 + 2.2, x0 + 2.5, 0.6, 0.9, z0 + 0.1, z0 + 0.4, '#f2c14e');
  p.box(x1 - 2.2, x1 - 0.2, 0.12, 0.76, z0, z0 + 0.8, '#6b5139', { col: true });
  p.box(x1 - 1.6, x1 - 0.8, 0.76, 1.2, z0 + 0.15, z0 + 0.2, '#1d2b36'); // monitor
  p.box(x1 - 1.5, x1 - 0.9, 0.12, 0.5, z0 + 1.1, z0 + 1.6, '#2f3a44'); // chair
  p.box(x0, x0 + 0.7, 0.12, 2.3, z1 - 3.5, z1 - 1.5, '#b89b7a', { col: true });
  p.box(x1 - 0.7, x1, 0.12, 0.95, z1 - 4, z1 - 1.4, '#d9d5cc', { col: true });
  p.box(x1 - 0.65, x1 - 0.05, 0.95, 1.0, z1 - 3.9, z1 - 1.5, '#8a8e92');
  p.light((x0 + x1) / 2, h - 0.1, (z0 + z1) / 2, 0.2, '#fff4d8');
  p.build();
  const F = (lx: number, lz: number): [number, number] => [DOOR_X + lx, (z0 + z1) / 2 + lz];
  door = new Door(F, 0, 0, (z1 - z0) / 2 + 0.07, '#6b4a2f', () => !checkedIn);
  interiors.push({
    name: 'one-north Residences',
    rooms: [{ name: 'Studio 01-07', x0, x1, z0, z1 }],
    props: p,
    door,
    lamp: [(x0 + x1) / 2, h - 0.2, (z0 + z1) / 2],
    lampOn: () => S.inside === 'one-north Residences',
    showWithin: 40,
  });
  sign(
    {
      text: 'one-north Residences',
      sub: 'Serviced apartments',
      w: 7,
      h: 1.3,
      bg: '#1d2b36',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#f2c14e',
      font: 'ui',
    },
    TOWER.x,
    4.5,
    TOWER.z + TOWER.d / 2 + 0.2,
    0,
  );
  setTarget('checkin', [DOOR_X, 1, z1 + 1]);
  // The door: check in the first time, then open and close it.
  register({
    x: DOOR_X,
    y: 1.2,
    z: z1,
    reach: 2.6,
    size: 0.8,
    label: () =>
      checkedIn ? (door.target > 0.5 ? 'Close the door' : 'Open the door') : 'Check in (key card waiting at the door)',
    run: () => {
      if (!checkedIn) {
        checkedIn = true;
        wakeHere();
        markDone('checkin');
        toast('Checked in', 'Studio 01-07, one-north Residences. Two weeks here while you look for a place.');
        door.target = 1;
        return;
      }
      door.toggle();
    },
  });
  // The bed: sleep in the evening, or rest an hour.
  register({
    x: BED.x,
    y: 0.7,
    z: BED.z,
    reach: 2.4,
    size: 1.2,
    label: () => (S.time >= 20 * 60 || S.time < 6 * 60 ? 'Sleep until morning' : 'Rest for an hour'),
    run: () => {
      if (S.time >= 20 * 60) sleep();
      else passTime(60, 'Resting…');
    },
  });
}

export const saveOneNorth = () => ({ checkedIn });
export function loadOneNorth(d: { checkedIn: boolean } | undefined) {
  checkedIn = !!d?.checkedIn;
  if (checkedIn) wakeHere();
}
