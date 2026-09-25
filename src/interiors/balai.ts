/* Inside the balai warga (interiors plan step 5): an open pavilion, so no door,
   and only half the indoor light and sound. Pak RT's desk in the middle (the
   buku tamu, a stamp, and the arisan jar full of rolled-up names), two rows of
   plastic chairs facing it, a whiteboard on a stand with this week's jobs, the
   kampung's trophies on the east ledge, the Garuda between two framed portraits
   high on the back wall, a small flag in the corner, fans and tube lights.
   - Lapor diri: while Pak RT is at his desk, register as a new resident (once).
   - The arisan draw happens at the desk (game/events.ts). */
import { PropSet } from '../render/props';
import { mat, type Batch } from '../render/batch';
import { addCol } from '../core/collision';
import { S } from '../core/state';
import { residents, headPos } from '../npc/npcs';
import { interactables } from '../game/interact';
import { befriend, properName } from '../social/social';
import { repute } from '../social/reputation';
import { openPanel, closePanel } from '../ui/panel';
import { openDialogue } from '../ui/dialogue';
import { toast } from '../ui/hud';
import { bubble } from '../ui/bubbles';
import { interiors, type Interior } from './interior';
import { BA } from './civiclayout';

export const BALAI = 'Balai Warga';
const WOOD = '#7a5236',
  WOOD_D = '#5e3d22';

let registered = false;

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
  const fl = BA.fl;
  const d = BA.desk;
  const top = 0.9;

  /* On Pak RT's desk: a cloth, the buku tamu, a stamp pad, a pen, and the arisan jar. */
  P(
    (d.x0 + d.x1) / 2,
    top + 0.003,
    (d.z0 + d.z1) / 2,
    d.x1 - d.x0 - 0.1,
    0.004,
    d.z1 - d.z0 + 0.05,
    '#2f6fb3',
    set.cloth,
  );
  P(-13.3, top + 0.02, -26.2, 0.42, 0.03, 0.3, '#f4f1ea');
  P(-13.3, top + 0.04, -26.2, 0.01, 0.01, 0.28, '#b8a07a');
  P(-12.7, top + 0.02, -26.3, 0.12, 0.03, 0.08, '#1a1b1e');
  P(-12.4, top + 0.015, -26.2, 0.14, 0.01, 0.012, '#2f6fb3');
  P(-14.2, top + 0.12, -26.25, 0.1, 0.24, 0.1, '#d8e8e8', set.cyl);
  P(-14.2, top + 0.25, -26.25, 0.105, 0.03, 0.105, '#d8392a', set.cyl);
  for (let k = 0; k < 8; k++)
    P(
      -14.2 + ((k % 3) - 1) * 0.04,
      top + 0.05 + Math.floor(k / 3) * 0.04,
      -26.25 + ((k % 2) - 0.5) * 0.04,
      0.02,
      0.05,
      0.02,
      '#f4efe0',
      set.cyl,
      0,
      0,
      Math.PI / 2,
    );
  // His chair behind the desk.
  const [rx, rz] = BA.rtSeat;
  P(rx, fl + 0.44, rz, 0.46, 0.04, 0.44, WOOD);
  P(rx, fl + 0.72, rz + 0.2, 0.46, 0.5, 0.04, WOOD);
  for (const x of [rx - 0.2, rx + 0.2])
    for (const z of [rz - 0.19, rz + 0.19]) P(x, fl + 0.22, z, 0.04, 0.44, 0.04, WOOD_D);

  /* Plastic chairs, two rows facing the desk. */
  const cols = ['#d8392a', '#2f6fb3', '#3a9a73', '#f2b53c'];
  let k = 0;
  for (const z of BA.chairsZ)
    for (const x of BA.chairsX) {
      const c = cols[k++ % cols.length];
      P(x, fl + 0.42, z, 0.42, 0.04, 0.4, c);
      P(x, fl + 0.7, z - 0.19, 0.42, 0.5, 0.04, c, set.solid, 0, 0.12);
      for (const dx of [-0.18, 0.18])
        for (const dz of [-0.17, 0.17]) P(x + dx, fl + 0.21, z + dz, 0.035, 0.42, 0.035, c);
      colOnly(x - 0.21, x + 0.21, z - 0.21, z + 0.21);
    }

  /* The whiteboard on its stand, with this week's jobs written up. */
  const [wx, wz] = BA.whiteboard;
  P(wx, fl + 1.35, wz, 1.3, 0.85, 0.03, '#f8f8f4', set.solid, -0.5);
  P(wx, fl + 1.35, wz - 0.02, 1.36, 0.9, 0.02, '#9aa0a4', set.solid, -0.5);
  for (let i = 0; i < 5; i++)
    P(
      wx - 0.1 + Math.sin(-0.5) * 0,
      fl + 1.6 - i * 0.12,
      wz + 0.02,
      0.6 + (i % 2) * 0.3,
      0.02,
      0.005,
      i === 0 ? '#d8392a' : '#2f6fb3',
      set.solid,
      -0.5,
    );
  for (const s of [-1, 1])
    P(
      wx + s * 0.55 * Math.cos(0.5),
      fl + 0.6,
      wz + s * 0.55 * Math.sin(0.5),
      0.04,
      1.2,
      0.04,
      '#6f6a62',
      set.solid,
      -0.5,
    );
  colOnly(wx - 0.6, wx + 0.6, wz - 0.3, wz + 0.3);

  /* The kampung's trophies along the top of the east half-wall. */
  for (let i = 0; i < 5; i++) {
    const z = -29.2 + i * 0.9;
    P(-6.38, 1.04, z, 0.14, 0.08, 0.14, '#3a2616');
    P(-6.38, 1.18, z, 0.03, 0.2, 0.03, '#d9b24a', set.cyl);
    P(-6.38, 1.36 + (i % 2) * 0.05, z, 0.08, 0.16 + (i % 2) * 0.1, 0.08, '#d9b24a', set.cone, 0, Math.PI);
  }

  /* The Garuda and two portraits above the mural, a small flag in the corner. */
  P(-13, 3.02, -23.02, 0.5, 0.5, 0.03, '#d9b24a');
  P(-13, 3.02, -23.04, 0.2, 0.3, 0.01, '#b8262a');
  for (const x of [-14.2, -11.8]) {
    P(x, 2.95, -23.02, 0.45, 0.55, 0.03, '#3a2616');
    P(x, 2.95, -23.04, 0.37, 0.47, 0.01, '#c9bda2');
  }
  P(-19.1, fl + 1.0, -23.4, 0.02, 2.0, 0.02, '#e8e8e8', set.cyl);
  P(-18.85, fl + 1.85, -23.4, 0.48, 0.16, 0.01, '#d8261f', set.cloth);
  P(-18.85, fl + 1.69, -23.4, 0.48, 0.16, 0.01, '#f5f3ee', set.cloth);

  /* Fans and tube lights under the roof. */
  for (const x of [-16.5, -9.5]) {
    P(x, 3.0, -26.5, 0.02, 0.5, 0.02, '#e8e8e8', set.cyl);
    for (const r of [0, Math.PI / 3, (2 * Math.PI) / 3]) P(x, 2.75, -26.5, 1.0, 0.01, 0.11, '#f4f4f0', set.solid, r);
  }
  for (const x of [-15, -11]) {
    P(x, 3.2, -24.5, 1.2, 0.05, 0.1, '#e8e8e8');
    P(x, 3.16, -24.5, 1.1, 0.04, 0.05, '#f4fbff', set.glow);
  }
}

export function buildBalaiInterior(): Interior {
  const set = new PropSet('balai-dalam');
  build(set);
  set.build();
  const it: Interior = {
    name: BALAI,
    rooms: [{ name: 'Pendopo', x0: BA.x0, x1: BA.x1, z0: BA.z0 + 0.3, z1: BA.z1 }],
    props: set,
    door: { update() {} },
    lamp: BA.lamp,
    lampOn: () => true,
    lampPower: () => 0.7,
    // An open pavilion: shade and a roof, not walls.
    amount: 0.35,
  };
  interiors.push(it);
  return it;
}

/* ================= lapor diri ================= */

const pakRT = () => residents.find(r => r.npc.id === 'bambang')!;
const atDesk = () => {
  const r = pakRT();
  return r.state === 'at' && r.slot.poi.id === 'balai' && r.slot.tag === 'desk' ? r : null;
};

function laporDiri() {
  const r = atDesk();
  if (!r) return;
  if (registered) {
    void openDialogue(r);
    return;
  }
  openPanel({
    title: 'Lapor diri',
    sub: `${properName(r.npc)} · Ketua RT 04`,
    body: '“Ah, Mas Raka. Every new resident reports to the RT, it’s the rule, not me being fussy.” He opens the buku tamu, copies your name and your KTP number, asks where you work (“freelance… from the laptop?”), and stamps a little form. “Surat domisili. Keep it. Selamat datang secara resmi.”',
    rows: [
      {
        label: 'Terima kasih, Pak RT',
        run: () => {
          closePanel();
          registered = true;
          befriend(r.npc, 3, S.day, true);
          repute(3, 'You reported in to Pak RT.', S.day, true);
          bubble(r, () => headPos(r), 'Good. Now you’re one of us on paper too.', 3);
          toast('Lapor diri: done', 'Registered with the RT. Pak RT ♥ +3 · Reputation +3');
        },
      },
    ],
  });
}

export function registerBalai() {
  interactables.push({
    x: (BA.desk.x0 + BA.desk.x1) / 2,
    z: BA.desk.z0 - 0.1,
    y: 0.95,
    size: 1.0,
    reach: 2.2,
    inside: BALAI,
    label: () => (atDesk() ? (registered ? 'Talk to Pak RT at his desk' : 'Lapor diri to Pak RT') : null),
    run: laporDiri,
  });
}

export const saveBalai = () => ({ registered });
export function loadBalai(d: { registered: boolean } | undefined) {
  registered = !!d?.registered;
}
