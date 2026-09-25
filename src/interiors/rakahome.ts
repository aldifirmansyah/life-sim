/* Living in Mbah Minah's house: what Raka does with the things in it (spec §7,
   interiors plan step 2). Aim at a thing and press E.
   - the laptop on the desk: freelance work, sitting at the desk
   - the stove: cook, standing at it
   - the bed: rest, nap, sleep (lying down, looking at the plafon); mornings
     start in it
   - the kursi tamu: sit down and look around; E stands up again
   - the bak mandi: mandi with the gayung (fresh again, and better after sweat)
   - Mbah's radio: an old keroncong tune while you're home
   - the TV across from the sofa (a box TV, a flat one once the ruang tamu is done)
   - the lemari: keep things out of your bag
   - the calendar by the door: plan the repairs with Pak Karyo
   - what was found restoring each room (the guest book, her recipe tin, the
     letters, the RT ledger, the 17 Agustus photo, the coin tin): look again
   - the guitar, once you have one, leaning in the corner */
import * as THREE from 'three';
import { scene } from '../render/context';
import { S } from '../core/state';
import { player } from '../core/player';
import { sleep, setWake } from '../core/time';
import { interactables } from '../game/interact';
import { sitFor, sitDown, standFor, lieFor, placeInBed, getUp, useTool, type Bed, type Seat } from '../game/actions';
import { POSES } from '../render/hands';
import { poiById } from '../npc/places';
import { rakaHouse } from '../world/landmarks';
import { ROOMS, hasRoom } from '../game/house';
import * as st from '../game/stats';
import { item, ITEMS } from '../game/items';
import { on } from '../game/bus';
import { openPanel, closePanel, type Row } from '../ui/panel';
import { passTime, freelanceMenu, cookMenu, restoreMenu, type Pass } from '../ui/activities';
import { playGuitar } from '../ui/pastimes';
import { toast } from '../ui/hud';
import { setRadio, setTv, sfx } from '../audio/audio';
import { NAME, tvScreen } from './raka';
import * as L from './rakalayout';

const { FL } = L;

/** Local → world, and a local direction → the world yaw that looks along it. */
const W = (lx: number, lz: number) => rakaHouse.F(lx, lz);
function yawAlong(dx: number, dz: number) {
  const [ax, az] = W(0, 0),
    [bx, bz] = W(dx, dz);
  return Math.atan2(-(bx - ax), -(bz - az));
}
/** Seat facing (NPC convention: the way the seated body faces, as atan2(dx, dz) in world). */
function faceAlong(dx: number, dz: number) {
  const [ax, az] = W(0, 0),
    [bx, bz] = W(dx, dz);
  return Math.atan2(bx - ax, bz - az);
}

/* ================= state ================= */

/** Things put away in the lemari. */
export const lemari = new Map<string, { qty: number; q: number }>();
let lastBath = -1e9;
/** Game-minute (absolute) of the last sweaty thing: a jog, futsal, kerja bakti, a warung shift. */
let sweatAt = -1e9;
let radioOn = false;
let tvOn = false;
let radioMood = { day: 0, n: 0, acc: 0 };
/** The day each keepsake was last looked at (a little mood, once a day). */
const lookedAt = new Map<string, number>();

const abs = () => S.day * 1440 + S.time;

/* ================= the things ================= */

export function registerHome() {
  const inside = NAME;
  const bed: Bed = {
    ...xz(L.BED_LIE),
    eye: FL + 0.62,
    yaw: yawAlong(0, 1),
    side: W(L.BED_SIDE[0], L.BED_SIDE[1]),
  };

  // Mornings start in the bed; Raka sits up and gets out.
  setWake(
    () => placeInBed(bed),
    () => getUp(bed),
    'Raka wakes up in his grandmother’s old room.',
  );

  /* The bed. */
  const [bcx, bcz] = W((L.BED.x0 + L.BED.x1) / 2, (L.BED.z0 + L.BED.z1) / 2);
  interactables.push({
    x: bcx,
    z: bcz,
    y: FL + 0.5,
    size: 0.9,
    reach: 2.3,
    inside,
    label: () => (hasRoom('kamar') ? 'Lie down on the bed' : 'Lie down on the old kasur'),
    run: () => bedMenu(bed),
  });

  /* The sofa: sit on any free seat (guests take the ends when they come for teh); E stands up again. */
  const raka = poiById.get('raka')!;
  const seats = raka.slots.filter(s => s.tag === 'sofa' || s.tag === 'tamu');
  interactables.push({
    ...xz([L.SOFA.x, L.SOFA.z]),
    y: FL + 0.5,
    size: 0.8,
    reach: 2.2,
    inside,
    label: () => (seats.some(s => s.claimedBy === -1) ? 'Sit on the sofa' : null),
    run: () => {
      const s = seats
        .filter(s => s.claimedBy === -1)
        .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
      if (s) sitDown({ x: s.x, z: s.z, y: s.y, ry: s.ry, approach: s.approach, slot: s });
    },
  });

  /* The TV. */
  const tv = tvMesh();
  interactables.push({
    ...xz([L.TV_CABINET.x, L.TV_CABINET.z]),
    y: FL + L.TV_CABINET.h + 0.3,
    size: 0.45,
    reach: 3.2,
    inside,
    label: () => (tvOn ? 'Turn the TV off' : 'Turn on the TV'),
    run: () => {
      tvOn = !tvOn;
      const [x, z] = W(L.TV_CABINET.x, L.TV_CABINET.z);
      setTv(tvOn ? [x, z] : null);
      sfx('click');
    },
  });

  /* The laptop on the desk. */
  const dc = L.DESK_CHAIR;
  const desk: Seat = {
    ...xz([dc.x, dc.z]),
    y: FL + 0.42,
    ry: faceAlong(0, 1),
    approach: W(dc.approach[0], dc.approach[1]),
  };
  const atDesk: Pass = (m, t, done) => {
    closePanel();
    sitFor(desk, up =>
      passTime(m, t, () => {
        done();
        up();
      }),
    );
  };
  interactables.push({
    ...xz([L.DESK.x, L.DESK.z]),
    y: FL + L.DESK.h + 0.1,
    size: 0.35,
    reach: 1.9,
    inside,
    label: () => 'Work on the laptop',
    run: () => freelanceMenu(atDesk),
  });

  /* The stove. */
  const [sx, sz] = W(L.STOVE[0], L.STOVE[1]);
  const stoveY = FL + L.COUNTER.h + 0.1;
  const atStove: Pass = (m, t, done) => {
    closePanel();
    standFor(W(L.COOK_AT[0], L.COOK_AT[1]), [sx, stoveY, sz], back =>
      passTime(m, t, () => {
        done();
        back();
      }),
    );
  };
  interactables.push({
    x: sx,
    z: sz,
    y: stoveY,
    size: 0.35,
    reach: 1.9,
    inside,
    label: () => (hasRoom('dapur') ? 'Cook at the stove' : 'Cook on the old kompor'),
    run: () => cookMenu(atStove),
  });

  /* The bak mandi. */
  const bk = L.BAK;
  const [bx, bz] = W((bk.x0 + bk.x1) / 2, (bk.z0 + bk.z1) / 2);
  interactables.push({
    x: bx,
    z: bz,
    y: FL + bk.h,
    size: 0.4,
    reach: 1.8,
    inside,
    label: () => 'Mandi (bathe)',
    run: () => mandi(bx, bz, FL + bk.h),
  });

  /* The radio. */
  const [rx, ry, rz] = L.RADIO;
  const [rwx, rwz] = W(rx, rz);
  interactables.push({
    x: rwx,
    z: rwz,
    y: ry,
    size: 0.2,
    reach: 1.8,
    inside,
    label: () => (radioOn ? 'Turn the radio off' : 'Turn on Mbah’s radio'),
    run: () => {
      radioOn = !radioOn;
      setRadio(radioOn ? [rwx, rwz] : null);
      sfx('click');
      if (radioOn) toast('RRI, keroncong hour', 'The old radio still works, just about.');
    },
  });

  /* The lemari. */
  const lm = L.LEMARI;
  interactables.push({
    ...xz([lm.x0, (lm.z0 + lm.z1) / 2]),
    y: FL + 1.1,
    size: 0.6,
    reach: 2.0,
    inside,
    label: () => 'Open the lemari',
    run: () => lemariMenu(),
  });

  /* The calendar by the door: the repairs. */
  const [cx, cy, cz] = L.CALENDAR;
  interactables.push({
    ...xz([cx, cz]),
    y: cy,
    size: 0.3,
    reach: 2.0,
    inside,
    label: () => 'Plan the repairs (calendar)',
    run: () => restoreMenu(),
  });

  /* Keepsakes: where each room's find is kept. */
  const b = L.BUFET;
  const [nx, nz] = L.NIGHTSTAND;
  const keep: [string, [number, number, number], string][] = [
    ['teras', [b.x, FL + b.h, b.z - 0.05], 'Read Mbah’s guest book'],
    ['atap', [b.x, FL + b.h + 0.06, b.z - 0.35], 'Look at the tin of coins'],
    ['ruangtamu', [L.IX - 0.03, 1.75, b.z], 'Look at the 17 Agustus photo'],
    ['kamar', [nx, FL + 0.58, nz], 'Read her letters again'],
    ['meja', [L.DESK.x - 0.15, FL + L.DESK.h, L.DESK.z - 0.12], 'Leaf through the RT ledger'],
    ['dapur', [L.SHELF[0] + 0.22, 1.63, L.SHELF[1] + 0.05], 'Open her recipe tin'],
  ];
  for (const [id, [lx, y, lz], label] of keep)
    interactables.push({
      ...xz([lx, lz]),
      y,
      size: 0.15,
      reach: 1.6,
      inside,
      label: () => (hasRoom(id) ? label : null),
      run: () => keepsake(id),
    });

  /* The guitar in the corner, once Raka has one. */
  const guitar = guitarMesh();
  interactables.push({
    ...xz(L.GUITAR),
    y: 0.8,
    size: 0.35,
    reach: 1.8,
    inside,
    label: () => (st.count('gitar') ? 'Play the guitar' : null),
    run: () => playGuitar('the sofa in the ruang tamu'),
  });

  // Sweat: a mandi after these is worth more.
  for (const e of ['jog', 'futsal', 'kerja', 'shift', 'lomba'] as const) on(e, () => (sweatAt = abs()));

  let acc = 0,
    lastTick = abs();
  homeTick = dt => {
    guitar.visible = st.count('gitar') > 0;
    updateTv(tv, dt);
    acc += dt;
    if (acc < 1) return;
    acc = 0;
    const was = lastTick;
    lastTick = abs();
    // The radio lifts the mood a little while Raka is home: +1 per half hour, up to +4 a day.
    if ((radioOn || tvOn) && S.inside === NAME) {
      if (radioMood.day !== S.day) radioMood = { day: S.day, n: 0, acc: 0 };
      radioMood.acc += Math.max(0, Math.min(5, lastTick - was));
      if (radioMood.acc >= 30 && radioMood.n < 4) {
        radioMood.acc = 0;
        radioMood.n++;
        st.addMood(1);
      }
    }
  };
}

let homeTick: (dt: number) => void = () => {};
/** Every frame. */
export function updateHome(dt: number) {
  homeTick(dt);
}

function xz(p: [number, number]) {
  const [x, z] = W(p[0], p[1]);
  return { x, z };
}

/* ================= bed ================= */

function bedMenu(bed: Bed) {
  const h = (S.time / 60) % 24;
  const late = S.time >= 20 * 60;
  const lie = (minutes: number, text: string, effect: () => void) => {
    closePanel();
    lieFor(bed, up =>
      passTime(minutes, text, () => {
        effect();
        up();
      }),
    );
  };
  const rows: Row[] = [
    {
      label: 'Rest for an hour',
      note: '+15 energy',
      run: () =>
        lie(60, 'An hour later…', () => {
          st.addEnergy(15);
          st.addMood(2);
        }),
    },
    {
      label: 'Take a nap',
      note: '2 hours · +25 energy',
      disabled: h < 11 ? 'too early for a nap' : late ? 'it’s late: sleep instead' : undefined,
      run: () =>
        lie(120, 'Zzz…', () => {
          st.addEnergy(25);
          st.addMood(3);
        }),
    },
    {
      label: 'Sleep',
      note: 'until 06:00',
      disabled: late ? undefined : 'after 20:00',
      run: () => {
        closePanel();
        lieFor(bed, () => sleep());
      },
    },
  ];
  openPanel({
    title: hasRoom('kamar') ? 'Your bed' : 'Mbah Minah’s old kasur',
    sub: hasRoom('kamar')
      ? 'A proper mattress, batik sheets, a guling'
      : 'Thin kapuk, lumpy and a little musty. It’ll do for now.',
    rows,
  });
}

/* ================= mandi ================= */

function mandi(bx: number, bz: number, y: number) {
  const since = abs() - lastBath;
  if (since < 180) {
    toast('Still fresh', 'You had a mandi not long ago.');
    return;
  }
  const sweaty = abs() - sweatAt < 300;
  // Scoop and pour a few times, then that's it: fresh, a quarter of an hour later.
  standFor(W(L.BATHE_AT[0], L.BATHE_AT[1]), [bx, y - 0.1, bz], () =>
    useTool(
      'gayung',
      POSES.dipR,
      POSES.pourR,
      4,
      0.42,
      () => {
        lastBath = abs();
        S.time = Math.min(S.time + 15, 26 * 60 - 0.5);
        st.addMood(sweaty ? 8 : 5);
        st.addEnergy(3);
        toast(
          'Segar!',
          sweaty
            ? 'The cold water after all that sweat: wonderful. Mood +8'
            : 'Cold water from the bak wakes you right up. Mood +5',
        );
      },
      () => sfx('splash'),
    ),
  );
}

/* ================= lemari ================= */

function lemariMenu(note?: string) {
  const stored = ITEMS.filter(i => lemari.has(i.id));
  const bag = st.contents();
  openPanel({
    title: 'Lemari',
    sub: hasRoom('kamar') ? 'Polished teak, a mirror on the door' : 'You lift the dust sheet and open the doors',
    body: note ?? 'Keep things here instead of carrying them around.',
    keepPage: true,
    rows: [
      {
        label: 'Put things away…',
        note: bag.length ? `${bag.length} kinds in your bag` : 'bag is empty',
        disabled: bag.length ? undefined : 'nothing in your bag',
        run: () => putAway(),
      },
      {
        label: 'Take things out…',
        note: stored.length ? `${stored.length} kinds stored` : 'empty',
        disabled: stored.length ? undefined : 'the lemari is empty',
        run: () => takeOut(),
      },
    ],
  });
}
function putAway() {
  openPanel({
    title: 'Put away',
    sub: 'From your bag into the lemari',
    keepPage: true,
    rows: st.contents().map(e => ({
      label: e.item.name,
      note: `×${e.qty}${e.q ? ` ${'★'.repeat(e.q)}` : ''}`,
      run: () => {
        st.take(e.item.id, e.qty);
        const s = lemari.get(e.item.id) ?? { qty: 0, q: 0 };
        lemari.set(e.item.id, { qty: s.qty + e.qty, q: Math.max(s.q, e.q) });
        sfx('click');
        if (st.contents().length) putAway();
        else lemariMenu(`Put away the ${e.item.name.toLowerCase()}.`);
      },
    })),
    back: () => lemariMenu(),
  });
}
function takeOut() {
  openPanel({
    title: 'Take out',
    sub: 'From the lemari into your bag',
    keepPage: true,
    rows: ITEMS.filter(i => lemari.has(i.id)).map(i => {
      const s = lemari.get(i.id)!;
      return {
        label: i.name,
        note: `×${s.qty}${s.q ? ` ${'★'.repeat(s.q)}` : ''}`,
        run: () => {
          lemari.delete(i.id);
          st.add(i.id, s.qty, s.q);
          sfx('click');
          if (lemari.size) takeOut();
          else lemariMenu(`Took out the ${item(i.id).name.toLowerCase()}.`);
        },
      };
    }),
    back: () => lemariMenu(),
  });
}

/* ================= keepsakes ================= */

const MORE: Record<string, string> = {
  teras: 'On the last page, in shakier writing: "Raka came for Lebaran. He is so tall now."',
  dapur: 'One card has no name next to it, only: "for when Raka comes home".',
  kamar: 'You read one again. It still smells faintly of her cupboard: kapur barus and sandalwood.',
  meja: 'The last entry balances to the rupiah. Someone has pencilled a small star next to her name.',
  ruangtamu: 'You find her in the photo again: the flag in one hand, the other on a small boy’s shoulder.',
  atap: 'You leave the coins where they are. They are for the kampung’s children, after all.',
};
function keepsake(id: string) {
  const room = ROOMS.find(r => r.id === id)!;
  const first = lookedAt.get(id) !== S.day;
  lookedAt.set(id, S.day);
  if (first) st.addMood(2);
  openPanel({
    title: room.find.title,
    sub: 'Mbah Minah',
    body: `${room.find.text}\n\n${MORE[id]}`,
    rows: [{ label: 'Put it back', run: () => closePanel() }],
  });
}

/* ================= the TV ================= */

/** The screen: dark when off; when on, a picture that shifts colour now and then (a sinetron, the news, football). */
function tvMesh() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x15181b }));
  m.visible = false;
  scene.add(m);
  return m;
}
const TV_COLOURS = [0x6a9ad0, 0xd8a86a, 0x58a860, 0xc86a6a, 0x9a8ad8, 0xe8e0c8];
let tvT = 0,
  tvC = 0;
function updateTv(m: THREE.Mesh, dt: number) {
  const scr = tvScreen();
  const [x, z] = W(scr.x, scr.z);
  m.position.set(x, scr.y, z);
  // The plane faces +z by default; the screen faces the sofa (local −z).
  m.rotation.y = rakaHouse.th + Math.PI;
  m.scale.set(scr.w, scr.h, 1);
  m.visible = S.inside === NAME || Math.hypot(player.x - x, player.z - z) < 12;
  const mat = m.material as THREE.MeshBasicMaterial;
  if (!tvOn) {
    mat.color.setHex(0x15181b);
    return;
  }
  tvT -= dt;
  if (tvT <= 0) {
    tvT = 1.5 + Math.random() * 4;
    tvC = TV_COLOURS[Math.floor(Math.random() * TV_COLOURS.length)];
  }
  // A little flicker, the way a screen lights a dark room.
  mat.color.setHex(tvC).multiplyScalar(0.85 + Math.random() * 0.15);
}

/* ================= the guitar ================= */

function guitarMesh() {
  const g = new THREE.Group();
  const m = (c: string) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12), m('#8a5a33'));
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.32;
  body.scale.set(1, 1, 1.25);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.102, 10), m('#2a1a10'));
  hole.rotation.x = Math.PI / 2;
  hole.position.y = 0.38;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), m('#5e3d22'));
  neck.position.y = 0.78;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.03), m('#3a2616'));
  head.position.y = 1.08;
  g.add(body, hole, neck, head);
  const [x, z] = W(L.GUITAR[0], L.GUITAR[1]);
  g.position.set(x, FL, z);
  g.rotation.y = rakaHouse.th + Math.PI / 2;
  g.rotation.z = 0.2;
  g.visible = false;
  scene.add(g);
  return g;
}

/* ================= save ================= */

export const saveHome = () => ({ lemari: [...lemari], lastBath, sweatAt });
export function loadHome(d: ReturnType<typeof saveHome> | undefined) {
  lemari.clear();
  if (!d) return;
  for (const [id, e] of d.lemari) lemari.set(id, e);
  lastBath = d.lastBath;
  sweatAt = d.sweatAt;
}
