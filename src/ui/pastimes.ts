/* Pastimes (spec §7): the notice board at the balai (this week's events, odd jobs,
   a second-hand guitar for sale), the ronda night watch at the pos ronda,
   fishing at the kali, playing the guitar, and futsal at the lapangan. Each can
   be done alongside the neighbours who are there, for bonus friendship. */
import { S } from '../core/state';
import { residents, headPos, type Resident } from '../npc/npcs';
import { poiById } from '../npc/places';
import { interactables } from '../game/interact';
import * as st from '../game/stats';
import { rupiah, item } from '../game/items';
import { emit } from '../game/bus';
import { eventsOn } from '../game/events';
import { todaysJobs, describeJob, take } from '../game/jobs';
import { shortDate } from '../game/calendar';
import { social } from '../social/social';
import { befriendAll, gainsText } from '../game/gains';
import { repute } from '../social/reputation';
import { bubble } from './bubbles';
import { toast } from './hud';
import { openPanel, closePanel, type Row } from './panel';
import { passTime } from './activities';
import { startGame } from './minigame';

const h = (hh: number, mm = 0) => hh * 60 + mm;
const clock = (t: number) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
/** Residents at a place right now (settled, not walking past). */
const at = (poi: string, tag?: string) =>
  residents.filter(r => r.state === 'at' && r.slot.poi.id === poi && (!tag || r.slot.tag === tag) && !r.hidden);
/** Neighbours within earshot. */
const around = (d: number) => residents.filter(r => !r.hidden && r.dist < d);

/* ================= notice board ================= */

function boardMenu() {
  const week: string[] = [];
  for (let d = S.day; d < S.day + 7; d++)
    for (const e of eventsOn(d))
      week.push(`${d === S.day ? 'Today' : shortDate(d)} ${clock(e.start)}: ${e.name} (${e.place})`);
  const rows: Row[] = todaysJobs().map(j => ({
    label: j.kind === 'titip' ? 'Titip: bring something round' : 'Antar: deliver a parcel',
    note: j.done ? 'done' : j.taken ? 'taken' : `${rupiah(j.pay)} · ${describeJob(j)}`,
    disabled: j.done ? 'done' : j.taken ? 'you took this one' : undefined,
    run: () => {
      take(j);
      boardMenu();
    },
  }));
  if (st.count('gitar') === 0)
    rows.push({
      label: 'DIJUAL: gitar bekas (Mas Rizky)',
      note: `${rupiah(item('gitar').price)} · play it at home or the pos ronda`,
      disabled: st.canAfford(item('gitar').price) ? undefined : `${rupiah(item('gitar').price)}, not enough money`,
      run: () => {
        st.spend(item('gitar').price);
        st.add('gitar');
        toast('A guitar!', 'Mas Rizky’s old gitar. Play it at home or at the pos ronda at night.');
        boardMenu();
      },
    });
  rows.push({ label: 'Close', run: () => closePanel() });
  openPanel({
    title: 'Papan pengumuman',
    sub: 'Notice board · Balai warga RT 04',
    body: week.length
      ? `This week:\n${week.slice(0, 6).join('\n')}`
      : 'Nothing special this week. Kerja bakti is every Sunday at 07:00.',
    rows,
  });
}

/* ================= ronda ================= */

const rondaNight = new Set<number>();
function rondaMenu() {
  const crew = at('ronda');
  const guitar = st.count('gitar') > 0;
  openPanel({
    title: 'Pos ronda',
    sub: crew.length ? `On watch tonight: ${crew.map(r => r.npc.name).join(', ')}` : 'Nobody on watch yet',
    body: 'Kentongan, a flask of kopi, a pack of cards. The night watch keeps the gang safe until Subuh.',
    rows: [
      {
        label: 'Keep watch with them',
        note: 'until 01:00 · cards, kopi and stories',
        disabled: !crew.length
          ? 'nobody is on watch'
          : rondaNight.has(S.day)
            ? 'you did your watch tonight'
            : S.time >= h(25)
              ? 'too late'
              : undefined,
        run: () => {
          rondaNight.add(S.day);
          const mins = Math.max(30, h(25) - S.time);
          passTime(mins, 'Gaple, kopi, and a slow walk round the gangs…', () => {
            const g = befriendAll(
              crew.filter(r => social(r.npc).met).map(r => r.npc),
              () => 3,
              S.day,
              { energy: -12, mood: 4, rep: 3 },
            );
            st.addEnergy(-12);
            st.addMood(4);
            st.practise('charisma', 6);
            repute(3, 'You kept the night watch.', S.day, true);
            toast('Ronda: the gang is quiet and safe', gainsText(g));
            emit('ronda');
          });
        },
      },
      {
        label: 'Play the guitar for them',
        note: '30 min',
        disabled: guitar ? undefined : 'you don’t have a guitar',
        run: () => playGuitar('the pos ronda'),
      },
      { label: 'Head home', run: () => closePanel() },
    ],
  });
}

/* ================= guitar ================= */

/** Play for half an hour: Music practice, and neighbours in earshot who like music gather and sing. */
export function playGuitar(where: string) {
  const lvl = st.level('music');
  // Whoever is in earshot when you start playing.
  const near = around(14).filter(r => social(r.npc).met);
  passTime(30, `Strumming on ${where}…`, () => {
    const fans = near.filter(r => !r.npc.dislikes.includes('music'));
    const grumps = near.filter(r => r.npc.dislikes.includes('music'));
    let sang = 0;
    for (const r of fans)
      if (r.npc.likes.includes('music') || Math.random() < 0.3 + lvl * 0.05) {
        sang++;
        bubble(r, () => headPos(r), '♪ ♫', 4, true);
      }
    const mood = 4 + Math.min(4, sang);
    const g = befriendAll(
      fans.map(r => r.npc),
      n => (n.likes.includes('music') ? 3 : 1),
      S.day,
      { mood },
    );
    befriendAll(
      grumps.map(r => r.npc),
      () => -1,
      S.day,
      g,
    );
    st.practise('music', 10);
    st.addMood(mood);
    toast(
      sang ? `${sang} neighbour${sang > 1 ? 's' : ''} sang along` : 'You play for yourself',
      `${gainsText(g)} · Music practice (level ${st.level('music')})${grumps.length ? ` · ${grumps.map(r => r.npc.name).join(', ')} would rather you didn’t` : ''}`,
    );
    emit('guitar');
  });
}

/* ================= fishing ================= */

function fish(where: Resident[]) {
  if (st.count('pancing') === 0) {
    toast('You need a pancing', 'Warung Bu Sri sells bamboo fishing rods.');
    return;
  }
  startGame({
    kind: 'reflex',
    title: 'Mancing',
    sub: 'The kali is slow and brown. Something is down there.',
    help: 'Wait for the float to dip, then press Space (or Go) quickly. Too soon and it swims off.',
    rounds: 4,
    window: 0.75,
    done: r => {
      passTime(40, 'Waiting by the water…', () => {
        if (r.caught) st.add('ikan', r.caught);
        const g = befriendAll(
          where.filter(x => social(x.npc).met).map(x => x.npc),
          () => 2,
          S.day,
          { mood: 3 + r.caught, energy: -3 },
        );
        st.addMood(3 + r.caught);
        st.addEnergy(-3);
        toast(
          r.caught ? `${r.caught} ikan mujair (in your bag)` : 'Nothing biting',
          `${gainsText(g)}${r.caught ? ' · fry them: Cook → Ikan goreng' : ''}`,
        );
        emit('fish');
      });
    },
  });
}

/* ================= futsal ================= */

function futsal() {
  const players = at('lapangan', 'field');
  startGame({
    kind: 'timing',
    title: 'Futsal',
    sub: `Five shots at goal${players.length ? `, with ${players.map(r => r.npc.name).join(', ')}` : ''}.`,
    help: 'Press Space when the marker is in the green to shoot past the keeper.',
    seconds: 25,
    goal: 5,
    tries: 5,
    zone: 0.17 + st.level('fitness') * 0.01,
    speed: 1.1,
    done: r => {
      passTime(45, 'Running round the lapangan…', () => {
        const g = befriendAll(
          players.filter(x => social(x.npc).met).map(x => x.npc),
          () => 2 + (r.hits >= 3 ? 1 : 0),
          S.day,
          { mood: 3 + r.hits, energy: -12 },
        );
        st.practise('fitness', 10 + r.hits * 3);
        st.addEnergy(-12);
        st.addMood(3 + r.hits);
        toast(`${r.hits} goal${r.hits === 1 ? '' : 's'} from 5`, gainsText(g));
        emit('futsal');
      });
    },
  });
}

/* ================= wiring ================= */

export function registerPastimes() {
  const add = (x: number, z: number, reach: number, label: () => string | null, run: () => void) =>
    interactables.push({ x, z, reach, label, run });
  const board = poiById.get('balai')!.slots.find(s => s.tag === 'board')!;
  add(board.x, board.z - 0.2, 2.4, () => 'Read the notice board', boardMenu);
  add(-5.5, 41.1, 3.2, () => (S.time >= h(21, 30) ? 'Pos ronda: the night watch' : null), rondaMenu);
  for (const id of ['kaliW', 'kaliE']) {
    const p = poiById.get(id)!;
    const [x, z] = [p.slots[0].x + 2.2, p.slots[0].z];
    add(
      x,
      z,
      2.6,
      () => (st.count('pancing') ? 'Fish here' : null),
      () => fish(at(id)),
    );
  }
  add(
    -44.8,
    -1,
    6,
    () => {
      const hour = S.time / 60;
      return hour >= 15.5 && hour < 18.5 && at('lapangan', 'field').length >= 2 ? 'Join the futsal game' : null;
    },
    futsal,
  );
}
