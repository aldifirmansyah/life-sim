/* Inside Musholla Al-Ikhlas (interiors plan step 5). The prayer hall faces the
   qibla (west): the mihrab in the west wall with the mimbar beside it, a green
   carpet with shaf lines, a digital prayer-time board, a shelf of Qur'an and iqra,
   the infaq box by the door, fans, calligraphy, and a low partition with a
   curtain for the women's rows at the back. Sandals come off at the door.
   - Wudhu at the taps outside (E), then sholat inside (E at the mihrab end): at a
     prayer time it is berjamaah with whoever has come (a respectful fade), other
     times a quiet sholat on your own.
   - The pengajian sits in a circle round Ustadz Hasan; E there joins it.
   - Coming in, Raka says salam; if someone is there, they answer. */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { mat, type Batch } from '../render/batch';
import { addCol } from '../core/collision';
import { S } from '../core/state';
import { residents, headPos } from '../npc/npcs';
import { interactables } from '../game/interact';
import { standFor, useTool } from '../game/actions';
import { POSES } from '../render/hands';
import * as st from '../game/stats';
import { befriendAll, gainsText } from '../game/gains';
import { repute } from '../social/reputation';
import { social } from '../social/social';
import { passTime } from '../ui/activities';
import { toast } from '../ui/hud';
import { bubble } from '../ui/bubbles';
import { sfx } from '../audio/audio';
import { pengajianOpen, joinPengajian } from '../game/events';
import { frame } from '../world/layout';
import { Door } from './door';
import { interiors, type Interior } from './interior';
import { MU } from './civiclayout';

export const MUSHOLLA = 'Musholla Al-Ikhlas';
const WOOD = '#6b4a2f',
  GOLD = '#d9b24a',
  CARPET = '#2f7a55';

/** Prayer times Raka can pray with the jamaah: from the adzan to 35 minutes after. */
const PRAYERS: [string, number][] = [
  ['Dzuhur', 11 * 60 + 55],
  ['Ashar', 15 * 60 + 15],
  ['Maghrib', 17 * 60 + 55],
  ['Isya', 19 * 60 + 5],
];
const jamaahNow = () => PRAYERS.find(([, t]) => S.time >= t - 5 && S.time < t + 35);

const abs = () => S.day * 1440 + S.time;
/** Wudhu lasts until the next sleep (or a few hours). */
let wudhuAt = -1e9;
const hasWudhu = () => abs() - wudhuAt < 240;
let lastPray = -1e9;
const prayedWith = new Map<string, number>();
let salamDay = -1;
let repDay = -1;

function build(set: PropSet) {
  const P = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    c: string,
    b: Batch = set.solid,
    ry = 0,
    rx = 0,
    rz = 0,
  ) => b.add(mat(x, y, z, sx, sy, sz, ry, rx, rz), c);
  const colOnly = (x0: number, x1: number, z0: number, z1: number) => {
    const c = addCol(x0, x1, z0, z1);
    c.on = false;
    set.cols.push(c);
  };
  const { x0, x1, z0, z1, fl, ce } = MU;
  const cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2;

  /* The carpet with shaf lines (parallel to the mihrab wall), a tiled strip by the door, the plafon. */
  P(cx, fl / 2, cz, x1 - x0, fl, z1 - z0, CARPET);
  for (let x = x0 + 1.25; x < x1 - 1; x += 0.9) P(x, fl + 0.002, cz, 0.05, 0.004, z1 - z0 - 0.2, '#e8d28a');
  P(10.3, fl + 0.003, z1 - 0.5, 1.6, 0.004, 0.9, '#d9d4c6');
  P(cx, ce + 0.015, cz, x1 - x0, 0.03, z1 - z0, '#f4f2ea');
  // A pale green dado round the walls.
  for (const x of [x0 + 0.006, x1 - 0.006]) P(x, 0.5, cz, 0.012, 0.9, z1 - z0, '#d9e6dc');
  P(cx, 0.5, z0 + 0.006, x1 - x0, 0.9, 0.012, '#d9e6dc');
  P(cx, 0.5, z1 - 0.006, x1 - x0, 0.9, 0.012, '#d9e6dc');

  /* The mihrab: the niche in the west wall with a pointed frame, and the mimbar beside it. */
  const mz = (MU.mihrab.z0 + MU.mihrab.z1) / 2;
  P(4.765, 1.25, mz, 0.02, 2.5, 1.0, '#e4ece6');
  for (const s of [-1, 1]) P(x0 + 0.01, 1.2, mz + s * 0.56, 0.04, 2.4, 0.12, GOLD);
  for (const s of [-1, 1]) P(x0 + 0.01, 2.55, mz + s * 0.3, 0.04, 0.1, 0.62, GOLD, set.solid, 0, s * 0.45);
  P(x0 + 0.01, 2.72, mz, 0.04, 0.12, 0.12, GOLD);
  // The mimbar: three steps up to a seat with a little canopy, north of the mihrab.
  const bz = -18.6;
  for (let k = 0; k < 3; k++)
    P(x0 + 0.35 + k * 0.0, fl + 0.18 + k * 0.2, bz + 0.3 - k * 0.25, 0.6, 0.36 + k * 0.4, 0.3, WOOD);
  P(x0 + 0.35, 1.9, bz - 0.35, 0.62, 0.06, 0.5, WOOD);
  for (const s of [-1, 1]) P(x0 + 0.35 + s * 0.28, 1.3, bz - 0.35, 0.05, 1.2, 0.05, WOOD);
  colOnly(x0, x0 + 0.7, bz - 0.6, bz + 0.5);
  // Prayer mats in the front row, a digital prayer-time board, calligraphy.
  for (const z of MU.rowZ.filter((_, k) => k % 2 === 0)) P(MU.imam[0] + 0.2, fl + 0.005, z, 1.1, 0.008, 0.6, '#8a2f2f');
  P(MU.imam[0], fl + 0.006, MU.imam[1], 1.1, 0.008, 0.6, '#b8862a');
  P(x0 + 0.02, 2.55, -19.6, 0.04, 0.45, 1.1, '#1a1b1e');
  for (let k = 0; k < 6; k++)
    P(x0 + 0.045, 2.68 - (k % 3) * 0.12, -19.95 + Math.floor(k / 3) * 0.6, 0.004, 0.06, 0.4, '#e84a3a', set.glow);
  for (const z of [-14.4]) {
    P(x0 + 0.02, 2.2, z, 0.03, 0.55, 1.4, '#1f3b2e');
    for (let k = 0; k < 4; k++)
      P(x0 + 0.04, 2.2 + Math.sin(k * 1.7) * 0.1, z - 0.5 + k * 0.33, 0.004, 0.08, 0.25, GOLD, set.solid, 0, k * 0.5);
  }
  P(cx, 2.4, z0 + 0.02, 1.8, 0.5, 0.03, '#1f3b2e');
  for (let k = 0; k < 6; k++)
    P(cx - 0.7 + k * 0.28, 2.4 + Math.sin(k * 2.1) * 0.1, z0 + 0.04, 0.2, 0.07, 0.004, GOLD, set.solid, 0, 0, k * 0.6);
  // A shelf of Qur'an and iqra against the north wall, the infaq box by the door, a wall clock.
  P(9.2, fl + 0.4, z0 + 0.2, 1.4, 0.8, 0.36, WOOD);
  for (let k = 0; k < 12; k++)
    P(8.6 + k * 0.1, fl + 0.9, z0 + 0.2, 0.06, 0.2, 0.22, ['#2f6b4a', '#1f3b2e', '#8a2f2f'][k % 3]);
  colOnly(8.5, 9.9, z0, z0 + 0.4);
  P(11.0, fl + 0.45, z1 - 0.3, 0.35, 0.9, 0.3, WOOD);
  P(11.0, fl + 0.91, z1 - 0.3, 0.2, 0.01, 0.04, '#1a1b1e');
  P(11.0, fl + 0.7, z1 - 0.46, 0.25, 0.12, 0.005, '#f4f1ea');
  colOnly(10.82, 11.18, z1 - 0.46, z1 - 0.14);
  P(x1 - 0.02, 2.4, -17, 0.02, 0.16, 0.16, '#f4efe2', set.cyl, 0, 0, Math.PI / 2);
  // The partition for the women's rows: a low wooden screen with a green curtain, a gap at each end.
  const px = MU.partition;
  P(px, fl + 0.45, -17, 0.06, 0.9, 4.6, WOOD);
  P(px, 1.35, -17, 0.02, 0.9, 4.5, '#3a7a5a', set.cloth);
  colOnly(px - 0.04, px + 0.04, -19.3, -14.7);
  // Two ceiling fans and the lamps.
  for (const z of [-18.8, -15.2]) {
    P(9.3, ce - 0.25, z, 0.02, 0.5, 0.02, '#e8e8e8', set.cyl);
    for (const r of [0, Math.PI / 3, (2 * Math.PI) / 3]) P(9.3, ce - 0.5, z, 1.1, 0.01, 0.12, '#f4f4f0', set.solid, r);
  }
  for (const [x, z] of [
    [7.2, -17],
    [11.4, -17],
  ]) {
    P(x, ce - 0.04, z, 1.2, 0.05, 0.1, '#e8e8e8');
    P(x, ce - 0.08, z, 1.1, 0.04, 0.05, '#f4fbff', set.glow);
  }

  /* The door frame: jambs and a head, so the leaf sits snug in the opening. */
  const dz = MU.door.z - 0.075;
  P(MU.door.x, 2.17, dz, 1.0, 0.06, 0.17, WOOD);
  for (const x of [MU.door.x - 0.49, MU.door.x + 0.49]) P(x, 1.1, dz, 0.03, 2.2, 0.17, WOOD);

  /* Outside by the door: a sandal rack. */
  P(9.2, 0.25, z1 + 0.3, 0.8, 0.5, 0.26, WOOD);
  colOnly(8.8, 9.6, z1 + 0.17, z1 + 0.43);
}

/** The door's hinge frame: the south wall, facing out to +z. */
const F = frame(0, 0, 0);

export function buildMushollaInterior(): Interior {
  const set = new PropSet('musholla-dalam');
  build(set);
  set.build();
  const door = new Door(F, 0, MU.door.x, MU.door.z, '#5a4633');
  // Raka's sandals on the step outside while he's in.
  const sandals = new THREE.Group();
  const sm = new THREE.MeshLambertMaterial({ color: '#3b5f8a' });
  for (const o of [-0.09, 0.09]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.26), sm);
    s.position.set(o, 0.02, 0);
    s.rotation.y = o * 1.2;
    sandals.add(s);
  }
  sandals.position.set(MU.door.x + 0.55, 0, MU.door.z + 0.45);
  sandals.visible = false;
  scene.add(sandals);
  const it: Interior = {
    name: MUSHOLLA,
    rooms: [
      { name: 'Shaf perempuan', x0: MU.partition, x1: MU.x1, z0: MU.z0, z1: MU.z1 },
      { name: 'Ruang sholat', x0: MU.x0, x1: MU.partition, z0: MU.z0, z1: MU.z1 },
    ],
    props: set,
    door,
    lamp: MU.lamp,
    lampOn: () => true,
    sandals,
    onEnter: () => salam(),
  };
  interiors.push(it);
  interactables.push({
    x: door.x,
    z: door.z,
    y: 1.1,
    size: 0.8,
    reach: 2.8,
    inside: '*',
    label: () => (door.target > 0.5 ? 'Close the door' : 'Open the door'),
    run: () => door.toggle(),
  });
  return it;
}

/* ================= salam, wudhu, sholat ================= */

const here = () => residents.filter(r => r.state === 'at' && !r.hidden && r.slot.poi.id === 'mushollaIn');

function salam() {
  if (salamDay === S.day) return;
  salamDay = S.day;
  const inside = here();
  toast(
    '“Assalamualaikum.”',
    inside.length ? 'You say salam as you step in, softly.' : 'You say salam to the empty hall.',
  );
  const r = inside.find(r => r.npc.id === 'hasan') ?? inside[0];
  if (r) setTimeout(() => bubble(r, () => headPos(r), 'Wa’alaikumsalam.', 2.5), 800);
}

function wudhu() {
  const [tx, tz] = MU.taps;
  stream.visible = true;
  standFor(MU.wudhuAt, [tx, 0.9, tz], () =>
    useTool(
      '',
      POSES.dipR,
      POSES.pourR,
      3,
      0.45,
      () => {
        wudhuAt = abs();
        stream.visible = false;
        S.time += 5;
        toast('Wudhu', 'Hands, mouth, face, arms, head, ears, feet. Cool water in the heat.');
      },
      () => sfx('splash'),
    ),
  );
}

function sholat() {
  if (!hasWudhu()) {
    toast('Wudhu first', 'The taps are outside, round the side of the musholla by the door.');
    return;
  }
  const jam = jamaahNow();
  if (!jam && abs() - lastPray < 120) {
    toast('Sholat', 'You prayed a little while ago.');
    return;
  }
  const people = here();
  passTime(jam ? 12 : 8, jam ? `Sholat ${jam[0]} berjamaah…` : 'A quiet sholat…', () => {
    lastPray = abs();
    if (!jam) {
      st.addMood(3);
      toast('Sholat', 'A few quiet minutes. Mood +3');
      return;
    }
    // Praying together: a little closer to each neighbour in the rows, once a day each.
    const met = people.filter(r => social(r.npc).met && prayedWith.get(r.npc.id) !== S.day);
    met.forEach(r => prayedWith.set(r.npc.id, S.day));
    const rep = repDay !== S.day;
    repDay = S.day;
    const g = befriendAll(
      met.map(r => r.npc),
      n => (n.id === 'hasan' ? 2 : 1),
      S.day,
      { mood: 5, rep: rep ? 1 : 0 },
    );
    st.addMood(5);
    if (rep) repute(1, 'You were at the musholla for sholat.', S.day, true);
    toast(`Sholat ${jam[0]} berjamaah`, `${gainsText(g)}${people.length ? '' : ' · a quiet hall today'}`);
  });
}

/** Water running from the tap while Raka washes. */
let stream: THREE.Mesh;

export function registerMusholla() {
  stream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.024, 0.75, 6),
    new THREE.MeshBasicMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.75 }),
  );
  stream.position.set(MU.taps[0], 0.42, MU.taps[1] + 0.03);
  stream.visible = false;
  scene.add(stream);
  const [tx, tz] = MU.taps;
  interactables.push({
    x: tx,
    z: tz,
    y: 0.9,
    size: 0.9,
    reach: 2.2,
    label: () => (hasWudhu() ? 'Wudhu again at the taps' : 'Wudhu at the taps'),
    run: wudhu,
  });
  // Sholat: facing the mihrab from the front of the hall.
  interactables.push({
    x: MU.x0 + 0.3,
    z: -17,
    y: 1.2,
    size: 1.0,
    reach: 6.5,
    inside: MUSHOLLA,
    label: () => {
      if (pengajianOpen()) return null;
      const jam = jamaahNow();
      return jam ? `Sholat ${jam[0]} berjamaah` : 'Sholat';
    },
    run: sholat,
  });
  // The pengajian circle.
  interactables.push({
    x: MU.circle.x,
    z: MU.circle.z,
    y: 0.4,
    size: 1.6,
    reach: 4,
    inside: MUSHOLLA,
    label: () => (pengajianOpen() ? 'Join the pengajian' : null),
    run: joinPengajian,
  });
}

export const saveMusholla = () => ({ wudhuAt, lastPray });
export function loadMusholla(d: { wudhuAt: number; lastPray: number } | undefined) {
  if (!d) return;
  wudhuAt = d.wudhuAt;
  lastPray = d.lastPray;
}
