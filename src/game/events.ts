/* Community events (spec §7): kerja bakti every Sunday morning, pengajian on
   Thursday evenings, the arisan on the second Saturday of the month, and the
   17 Agustus festival (upacara, lomba, the night stage). Residents who take part
   get a one-off block laid over their schedule, so they really turn up; Raka
   joins through things he can press E on at the place. */
import * as THREE from 'three';
import { S } from '../core/state';
import { mulberry32 } from '../core/util';
import { scene } from '../render/context';
import { residents, setPlan, todayBlocks, resync, type Resident } from '../npc/npcs';
import { poiById, groups, homes } from '../npc/places';
import { blockIndexAt } from '../npc/schedule';
import type { Activity } from '../npc/types';
import { interactables } from './interact';
import { useTool } from './actions';
import { POSES } from '../render/hands';
import * as st from './stats';
import { item, rupiah, ITEMS } from './items';
import { emit } from './bus';
import { dateOf, isArisan, isFestival, isKerjaBakti, isPengajian, festivalSeason, festivalBuild } from './calendar';
import { agustus, festival, LOMBA } from '../world/festival';
import { social } from '../social/social';
import { befriendAll, gainsText } from './gains';
import { repute } from '../social/reputation';
import { onPhoneDay, schedulePost, sendText } from '../social/phone';
import { toast } from '../ui/hud';
import { passTime } from '../ui/activities';
import { openPanel, closePanel } from '../ui/panel';
import { startGame } from '../ui/minigame';

const h = (hh: number, mm = 0) => hh * 60 + mm;

export interface CommunityEvent {
  id: string;
  name: string;
  start: number;
  end: number;
  place: string;
  blurb: string;
}

/** What's on, on a given day (for the Journal and the notice board). */
export function eventsOn(day: number): CommunityEvent[] {
  const out: CommunityEvent[] = [];
  if (isFestival(day)) {
    out.push(
      {
        id: 'upacara',
        name: 'Upacara bendera',
        start: h(7, 30),
        end: h(8, 10),
        place: 'Lapangan',
        blurb: 'The flag ceremony. Everyone stands for Indonesia Raya.',
      },
      {
        id: 'lomba',
        name: 'Lomba 17-an',
        start: h(8, 15),
        end: h(11, 30),
        place: 'Lapangan',
        blurb: 'Makan kerupuk, balap karung, panjat pinang.',
      },
      {
        id: 'panggung',
        name: 'Panggung malam',
        start: h(19, 30),
        end: h(22),
        place: 'Lapangan',
        blurb: 'The night stage: songs, dangdut, the lomba prizes.',
      },
    );
  }
  if (isKerjaBakti(day))
    out.push({
      id: 'kerja',
      name: 'Kerja bakti',
      start: h(7),
      end: h(9),
      place: 'Every gang',
      blurb: 'Sunday clean-up. Grab a sapu and sweep a stretch of lane.',
    });
  if (isArisan(day))
    out.push({
      id: 'arisan',
      name: 'Arisan ibu-ibu',
      start: h(15),
      end: h(17),
      place: 'Balai warga',
      blurb: 'Rp 20.000 in, one name drawn for the pot. Kue and news.',
    });
  if (isPengajian(day))
    out.push({
      id: 'pengajian',
      name: 'Pengajian',
      start: h(19, 30),
      end: h(20, 30),
      place: 'Musholla',
      blurb: 'Ustadz Hasan’s weekly gathering. All welcome: press E at the musholla door.',
    });
  return out;
}

/** Things Raka has joined, as "id:day". */
export const joined = new Set<string>();
const did = (id: string) => joined.has(`${id}:${S.day}`);
const mark = (id: string) => joined.add(`${id}:${S.day}`);

/* ================= who goes ================= */

const byId = (id: string) => residents.find(r => r.npc.id === id)!;
/** What they'd otherwise be doing at t today. */
function activityAt(r: Resident, t: number): Activity {
  const b = todayBlocks(r);
  return b[blockIndexAt(b, t)].activity;
}
const awayAt = (r: Resident, t: number) => {
  const b = todayBlocks(r);
  const x = b[blockIndexAt(b, t)];
  return x.location === 'away' || x.activity === 'away';
};
function plan(r: Resident, start: number, end: number, location: string, activity: Activity) {
  setPlan(r, S.day, { start, end, location, activity });
}

let plannedDay = -1;
function planDay() {
  plannedDay = S.day;
  sweptToday = 0;
  swept.clear();
  if (isKerjaBakti(S.day)) {
    // Everyone sweeps the stretch of lane nearest their own house, two to a stretch.
    const spots = groups.get('kerja') ?? [];
    const load = new Map<string, number>();
    for (const r of residents) {
      if (r.npc.age < 8 || ['sri', 'slamet', 'joko'].includes(r.npc.id) || awayAt(r, h(7, 30))) continue;
      const home = homes.get(r.def.household)!.entry[0];
      const near = [...spots]
        .filter(p => (load.get(p.id) ?? 0) < 2)
        .sort(
          (a, b) =>
            Math.hypot(a.entry[0][0] - home[0], a.entry[0][1] - home[1]) -
            Math.hypot(b.entry[0][0] - home[0], b.entry[0][1] - home[1]),
        )[0];
      if (!near) continue;
      load.set(near.id, (load.get(near.id) ?? 0) + 1);
      // Nothing else first thing, so they set off in time.
      plan(r, h(6), h(7), 'home.inside', 'home');
      plan(r, h(7), h(9), `#${near.id}.sweep`, 'work');
    }
  }
  pengajianGoers = [];
  if (isPengajian(S.day))
    for (const r of residents) {
      const devout = r.npc.id === 'hasan' || r.npc.likes.includes('religion') || r.npc.age >= 50;
      if (!devout || r.npc.age < 12 || awayAt(r, h(20)) || activityAt(r, h(20)) === 'ronda') continue;
      plan(r, h(19, 30), h(20, 30), 'musholla.inside', 'pray');
      pengajianGoers.push(r.npc.id);
    }
  if (isArisan(S.day))
    for (const id of ARISAN) {
      const r = byId(id);
      if (!awayAt(r, h(16))) plan(r, h(15), h(17), 'balai.inside', 'chat');
    }
  if (isFestival(S.day))
    for (const r of residents) {
      if (r.npc.age < 4) continue;
      // A holiday: no errands first thing, so everyone can walk over in time for the upacara.
      plan(r, h(6), h(7, 30), 'home.inside', 'home');
      plan(r, h(7, 30), h(8, 10), 'fest.crowd', 'relax');
      plan(r, h(8, 10), h(12, 15), r.npc.age < 13 ? 'lapangan.field' : 'fest.crowd', r.npc.age < 13 ? 'play' : 'chat');
      // They stay on a little after the show ends: the walk home would otherwise empty the lapangan early.
      plan(r, h(19, 30), h(22, 45), 'fest.audience', 'relax');
    }
}
/** The ibu-ibu who pay into the arisan. */
const ARISAN = ['ratna', 'yati', 'endang', 'wati', 'sumi', 'lestari', 'ayu'];

/** Messages about events: the group chat, and an arisan invitation once Bu RT knows Raka. */
function phoneDay() {
  const d = S.day,
    { d: date, m } = dateOf(d);
  if (isKerjaBakti(d + 1)) schedulePost(h(19), 'bambang', 'kerja_remind');
  if (isKerjaBakti(d)) schedulePost(h(6, 20), 'bambang', 'kerja_today');
  if (isPengajian(d)) schedulePost(h(16), 'hasan', 'pengajian');
  if (isArisan(d)) {
    schedulePost(h(8), 'ratna', 'arisan');
    const ratna = byId('ratna');
    if (social(ratna.npc).met && ratna.npc.playerRelationship.friendship >= 10)
      sendText('ratna', 'arisan_invite', {}, h(8, 5));
  }
  if (m === 7 && date === 8) schedulePost(h(9), 'bambang', 'agustus_rapat');
  if (m === 7 && date === 10) schedulePost(h(7), 'bambang', 'agustus_flags');
  if (m === 7 && date === 16) schedulePost(h(18), 'bambang', 'agustus_eve');
  if (isFestival(d)) schedulePost(h(6, 10), 'bambang', 'agustus_day');
}

/* ================= kerja bakti: litter to sweep ================= */

interface Pile {
  x: number;
  z: number;
  i: number;
}
const piles: Pile[] = [];
const swept = new Set<number>();
let sweptToday = 0;
let pileMesh: THREE.InstancedMesh;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const SHARE = 6;

function buildPiles() {
  const rnd = mulberry32(1708);
  for (const p of groups.get('kerja') ?? [])
    for (let k = 0; k < 3; k++) {
      const s = p.slots[0];
      const a = rnd() * Math.PI * 2,
        d = 1.2 + rnd() * 2.2;
      piles.push({ x: s.x + Math.cos(a) * d * 1.4, z: s.z + Math.sin(a) * 0.5, i: piles.length });
    }
  pileMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    piles.length,
  );
  const m = new THREE.Matrix4(),
    c = new THREE.Color();
  for (const p of piles) {
    m.compose(
      new THREE.Vector3(p.x, 0.06, p.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.i, 0)),
      new THREE.Vector3(0.32, 0.1, 0.24),
    );
    pileMesh.setMatrixAt(p.i, m);
    pileMesh.setColorAt(p.i, c.set(['#6b5a3a', '#8a7a52', '#5e6b3a'][p.i % 3]));
  }
  pileMesh.visible = false;
  pileMesh.receiveShadow = true;
  scene.add(pileMesh);
  for (const p of piles)
    interactables.push({
      x: p.x,
      z: p.z,
      reach: 1.8,
      label: () => (kerjaOn() && !swept.has(p.i) ? 'Sweep up the litter' : null),
      run: () => sweep(p),
    });
}
const kerjaOn = () => isKerjaBakti(S.day) && S.time >= h(6, 45) && S.time < h(9);

function sweep(p: Pile) {
  useTool('sapu', POSES.sweepA, POSES.sweepB, 3, 0.26, () => {
    swept.add(p.i);
    pileMesh.setMatrixAt(p.i, ZERO);
    pileMesh.instanceMatrix.needsUpdate = true;
    sweptToday++;
    S.time += 3;
    st.addEnergy(-2);
    st.practise('fitness', 2);
    if (sweptToday === SHARE) {
      mark('kerja');
      const near = residents.filter(r => r.slot.poi.id.startsWith('kerja') && social(r.npc).met && r.dist < 30);
      const g = befriendAll(
        near.map(r => r.npc),
        () => 2,
        S.day,
        { mood: 4, rep: 4 },
      );
      repute(4, 'You did your share at kerja bakti.', S.day, true);
      st.addMood(4);
      toast('Kerja bakti: your stretch is clean', gainsText(g));
      emit('kerja');
    } else if (sweptToday < SHARE) toast(`Swept ${sweptToday} of ${SHARE}`);
  });
}

let missedKerja = 0;
function kerjaOver() {
  if (did('kerja')) {
    missedKerja = 0;
    return;
  }
  if (sweptToday > 0) return repute(1, 'You helped a little at kerja bakti.', S.day, true);
  missedKerja++;
  repute(-2, 'People noticed you missed kerja bakti.', S.day);
  if (missedKerja >= 2) sendText('bambang', 'kerja_missed');
}

/* ================= pengajian, arisan ================= */

/** Who is expected at tonight's pengajian (set when the day is planned). */
let pengajianGoers: string[] = [];
function joinPengajian() {
  mark('pengajian');
  const end = h(20, 30);
  // Everyone who comes tonight, counted now (by the end they are already walking home).
  const goers = residents.filter(r => pengajianGoers.includes(r.npc.id) || r.slot.poi.id === 'musholla');
  passTime(Math.max(20, end - S.time), 'Ustadz Hasan’s pengajian…', () => {
    const met = goers.filter(r => social(r.npc).met);
    const g = befriendAll(
      met.map(r => r.npc),
      n => (n.id === 'hasan' ? 3 : 1),
      S.day,
      { mood: 6, rep: 2 },
    );
    st.addMood(6);
    repute(2, 'You sat in on the pengajian.', S.day, true);
    const unmet = goers.length - met.length;
    toast('Pengajian: a calm hour', gainsText(g) + (unmet ? ` · ${unmet} more you haven’t met yet` : ''));
    emit('pengajian');
  });
}

function arisanMenu() {
  openPanel({
    title: 'Arisan ibu-ibu',
    sub: 'Balai warga · second Saturday of the month',
    body: 'Everyone puts in Rp 20.000. One name is drawn and takes the whole pot. Then tea, kue, and all the news.',
    rows: [
      {
        label: 'Put in Rp 20.000 and join',
        disabled: st.canAfford(20000) ? undefined : 'not enough money',
        run: () => {
          st.spend(20000);
          mark('arisan');
          const members = residents.filter(r => ARISAN.includes(r.npc.id) && r.slot.poi.id === 'balai');
          const n = members.length + 1;
          passTime(Math.max(30, h(17) - S.time), 'Tea, kue, and a lot of news…', () => {
            const pot = n * 20000;
            const win = Math.floor(Math.random() * n);
            if (win === members.length) {
              st.earn(pot);
              toast(`Your name was drawn! +${rupiah(pot)}`, 'The ibu-ibu cheer. Beginner’s luck, they say.');
            } else toast(`${members[win].npc.name} takes the pot`, `${rupiah(pot)}. Maybe your name next month.`);
            // The news of the month: Raka learns how some neighbours feel about each other.
            let learned = 0;
            const g = befriendAll(
              members.filter(r => social(r.npc).met).map(r => r.npc),
              () => 2,
              S.day,
              { mood: 5, rep: 2 },
            );
            for (const r of members) {
              const s = social(r.npc);
              if (!s.met) continue;
              const tie = Object.entries(r.npc.relationships)
                .filter(([id]) => !s.known.ties.includes(id) && residents.some(o => o.npc.id === id))
                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
              if (tie && learned < 3) {
                s.known.ties.push(tie[0]);
                learned++;
              }
            }
            st.addMood(5);
            repute(2, 'You joined the arisan.', S.day, true);
            toast(
              'The arisan',
              gainsText(g) + (learned ? ` · learned ${learned} new things about who gets on with whom (Contacts)` : ''),
            );
            emit('arisan');
          });
        },
      },
      { label: 'Maybe next month', run: () => closePanel() },
    ],
  });
}

/* ================= 17 Agustus ================= */

const kid = (id: string) => byId(id).npc.name;
const PRIZE_GIFTS = ITEMS.filter(i => (i.cat === 'gift' || i.cat === 'snack') && i.price > 0).map(i => i.id);

function lombaDone(id: string, won: boolean, prize: number, place?: number) {
  mark(id);
  const crowd = residents.filter(r => r.slot.poi.id === 'fest' && social(r.npc).met);
  const g = befriendAll(
    crowd.map(r => r.npc),
    () => (won ? 2 : 1),
    S.day,
    {
      mood: won ? 8 : 4,
      energy: -6,
      rep: won ? 3 : 1,
    },
  );
  st.addEnergy(-6);
  st.addMood(won ? 8 : 4);
  st.practise('fitness', 6);
  if (won) {
    st.earn(prize);
    const gift = PRIZE_GIFTS[Math.floor(Math.random() * PRIZE_GIFTS.length)];
    st.add(gift);
    g.money = `+${rupiah(prize)} and ${item(gift).name}`;
    repute(3, 'The whole kampung cheered your win.', S.day, true);
    toast('Juara! The crowd cheers', gainsText(g));
  } else {
    repute(1, 'You joined the lomba.', S.day, true);
    toast(
      place ? `You came ${['', 'first', 'second', 'third', 'fourth', 'fifth'][place]}` : 'Not this year',
      `Everyone laughs, you most of all. ${gainsText(g)}`,
    );
  }
  S.time += 10;
  emit('lomba', id);
}

function kerupuk() {
  startGame({
    kind: 'race',
    title: 'Lomba makan kerupuk',
    sub: 'Hands behind your back. Eat the kerupuk off the string.',
    help: 'Tap Space (or the Go button) as fast as you can.',
    input: 'mash',
    seconds: 15,
    step: 0.045,
    you: 'Raka',
    rivals: [
      { name: kid('bima'), speed: 0.085 },
      { name: kid('fajar'), speed: 0.095 },
      { name: kid('dimas'), speed: 0.09 },
    ],
    done: r => lombaDone('kerupuk', r.won, 20000, r.place),
  });
}
function karung() {
  startGame({
    kind: 'race',
    title: 'Balap karung',
    sub: 'Both legs in a rice sack, hop to the far line.',
    help: 'Alternate ← and → (or A and D). The same key twice and you trip.',
    input: 'alternate',
    seconds: 20,
    step: 0.036,
    you: 'Raka',
    rivals: [
      { name: kid('yusuf'), speed: 0.072 },
      { name: kid('udin'), speed: 0.078 },
      { name: kid('rizky'), speed: 0.068 },
    ],
    done: r => lombaDone('karung', r.won, 25000, r.place),
  });
}
function pinang() {
  startGame({
    kind: 'timing',
    title: 'Panjat pinang',
    sub: 'A greased pole, prizes at the top. Pak Karyo and Mas Yusuf hold you up.',
    help: 'Press Space when the marker is in the green to climb. A miss and you slide down.',
    seconds: 30,
    goal: 6,
    zone: 0.2,
    speed: 0.95,
    slip: true,
    done: r => lombaDone('pinang', r.won, 50000),
  });
}

function upacara() {
  mark('upacara');
  passTime(Math.max(10, h(8, 10) - S.time), 'Indonesia Raya… the Merah Putih goes up the pole.', () => {
    st.addMood(5);
    repute(3, 'You stood with the kampung at the upacara.', S.day, true);
    toast('Dirgahayu Republik Indonesia', `${gainsText({ mood: 5, rep: 3 })} · then: lomba!`);
  });
}

function panggungMenu() {
  const hasGuitar = st.count('gitar') > 0;
  const music = st.level('music');
  openPanel({
    title: 'Panggung malam',
    sub: '17 Agustus · the night stage',
    body: 'Fairy lights, a borrowed sound system, and half the kampung on plastic chairs.',
    rows: [
      {
        label: 'Watch the show for an hour',
        disabled: did('watch') ? 'you watched already' : undefined,
        run: () => {
          mark('watch');
          const aud = residents.filter(r => r.slot.poi.id === 'fest' && social(r.npc).met);
          passTime(60, 'Dangdut, a kids’ dance, Pak RT’s speech…', () => {
            const g = befriendAll(
              aud.map(r => r.npc),
              () => 1,
              S.day,
              { mood: 10 },
            );
            st.addMood(10);
            toast('What a night', gainsText(g));
            emit('stage', 'watch');
          });
        },
      },
      {
        label: 'Go up and sing a song',
        note: 'with your guitar',
        disabled: did('sing')
          ? 'once is enough'
          : !hasGuitar
            ? 'you need a guitar'
            : music < 2
              ? 'practise first (Music 2)'
              : undefined,
        run: () => {
          mark('sing');
          const ok = Math.random() < 0.35 + music * 0.08;
          const aud = residents.filter(r => r.slot.poi.id === 'fest' && social(r.npc).met);
          passTime(
            20,
            ok ? 'You play, and the whole lapangan sings along…' : 'Your voice cracks on the high note…',
            () => {
              const g = befriendAll(
                aud.map(r => r.npc),
                () => (ok ? 2 : 1),
                S.day,
                {
                  mood: ok ? 12 : 4,
                  rep: ok ? 6 : 2,
                },
              );
              st.practise('music', 12);
              st.addMood(ok ? 12 : 4);
              repute(ok ? 6 : 2, ok ? 'Your song on the panggung.' : 'Brave, singing on the panggung.', S.day, true);
              toast(ok ? 'Tepuk tangan! Encore!' : 'They cheer anyway', gainsText(g));
              emit('stage', 'sing');
            },
          );
        },
      },
      { label: 'Not now', run: () => closePanel() },
    ],
  });
}

/* ================= wiring ================= */

export function initEvents() {
  buildPiles();
  onPhoneDay(phoneDay);
  const at = (p: [number, number], reach: number, label: () => string | null, run: () => void) =>
    interactables.push({ x: p[0], z: p[1], reach, label, run });
  // At the musholla door, where everyone goes in.
  const door = poiById.get('musholla')!.slots.find(s => s.tag === 'inside')!;
  at(
    [door.x - 0.2, door.z],
    3.2,
    () =>
      isPengajian(S.day) && S.time >= h(19) && S.time < h(20, 20) && !did('pengajian') ? 'Join the pengajian' : null,
    joinPengajian,
  );
  at(
    [-13, -30.2],
    2.8,
    () => {
      if (!isArisan(S.day) || S.time < h(14, 50) || S.time >= h(15, 50) || did('arisan')) return null;
      const ratna = byId('ratna');
      return social(ratna.npc).met && ratna.npc.playerRelationship.friendship >= 10 ? 'Join the arisan' : null;
    },
    arisanMenu,
  );
  const fest = (from: number, to: number, id: string) => isFestival(S.day) && S.time >= from && S.time < to && !did(id);
  at(LOMBA.upacara, 4, () => (fest(h(7, 15), h(8), 'upacara') ? 'Join the upacara' : null), upacara);
  at(LOMBA.kerupuk, 2.4, () => (fest(h(8, 15), h(11, 30), 'kerupuk') ? 'Lomba makan kerupuk' : null), kerupuk);
  at(LOMBA.karung, 2.4, () => (fest(h(8, 15), h(11, 30), 'karung') ? 'Balap karung' : null), karung);
  at(LOMBA.pinang, 2.4, () => (fest(h(8, 15), h(11, 30), 'pinang') ? 'Panjat pinang' : null), pinang);
  at(
    [LOMBA.stage[0], LOMBA.stage[1] - 2.5],
    4,
    () => (isFestival(S.day) && S.time >= h(19, 30) && S.time < h(22) ? 'Panggung malam' : null),
    panggungMenu,
  );
}

let acc = 0;
let kerjaChecked = -1;

/** A heads-up toast as each event starts, saying where to press E. */
const reminded = new Set<string>();
function reminders() {
  const say = (id: string, at: number, title: string, sub: string) => {
    const key = `${id}:${S.day}`;
    if (S.time >= at && S.time < at + 45 && !reminded.has(key) && !did(id)) {
      reminded.add(key);
      toast(title, sub);
    }
  };
  if (isKerjaBakti(S.day))
    say(
      'kerja',
      h(6, 45),
      'Kerja bakti is starting',
      'Find the litter piles along the gangs and press E to sweep. Six is your share.',
    );
  if (isPengajian(S.day))
    say(
      'pengajian',
      h(19),
      'Pengajian at the musholla',
      'Ustadz Hasan’s gathering starts at 19:30. Press E at the musholla door to join.',
    );
  if (isArisan(S.day) && social(byId('ratna').npc).met && byId('ratna').npc.playerRelationship.friendship >= 10)
    say('arisan', h(14, 45), 'Arisan at the balai', 'Press E at the front of the balai warga to join (Rp 20.000).');
  if (isFestival(S.day))
    say(
      'upacara',
      h(7, 10),
      'Upacara at the lapangan',
      'Stand with the kampung at 07:30: press E by the flag pole on the lapangan.',
    );
}
/** Once a second: plan the day's events, show decorations, close out kerja bakti. */
export function updateEvents(dt: number) {
  acc += dt;
  if (acc < 1 && plannedDay === S.day) return;
  acc = 0;
  if (plannedDay !== S.day) {
    planDay();
    // The day's plans came just after the morning resync; place everyone again so long walks to an
    // early event start partway along, as if they had set off before 06:00.
    if (S.time < h(6, 30)) resync();
  }
  agustus.show(festivalSeason(S.day));
  festival.show(festivalBuild(S.day));
  pileMesh.visible = kerjaOn();
  reminders();
  if (isKerjaBakti(S.day) && S.time >= h(9) && kerjaChecked !== S.day) {
    kerjaChecked = S.day;
    kerjaOver();
  }
}
