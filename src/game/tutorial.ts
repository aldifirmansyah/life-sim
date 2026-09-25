/* The first morning (spec §11): Raka arrives by ojek at the gapura with one
   suitcase. Pak RT meets him there, reminds him to report as a new resident,
   and walks him to his grandmother's house. Then the first goals: greet every
   household on Gang Mawar, and bring something to Bu Sri's warung.
   Also: an objective box and a marker on the HUD, and one-time tips. */
import * as THREE from 'three';
import { $ } from '../core/util';
import { S, inWorld } from '../core/state';
import { camera } from '../render/context';
import { residents, setPlan, headPos, resync, type Resident } from '../npc/npcs';
import { homes } from '../npc/places';
import { on } from './bus';
import * as st from './stats';
import { social, properName } from '../social/social';
import { repute } from '../social/reputation';
import { sendText } from '../social/phone';
import { lineFor } from '../dialogue/provider';
import { bubble } from '../ui/bubbles';
import { toast } from '../ui/hud';

type Stage = 'arrive' | 'follow' | 'house' | 'goals' | 'done';
export const tut = {
  stage: 'goals' as Stage,
  broughtSri: false,
  tips: [] as string[],
  walkLine: 0,
};

const bambang = () => residents.find(r => r.npc.id === 'bambang')!;
const h = (hh: number, mm = 0) => hh * 60 + mm;

/** Households around Gang Mawar (Raka's gang): doors on it, or on the corners where it meets the jalan and the other gangs. */
let mawar: string[] = [];
function mawarHouseholds() {
  if (!mawar.length)
    mawar = [...homes.entries()]
      .filter(([, p]) => Math.abs(p.entry[0][1] - 16) < 6)
      .map(([hh]) => hh)
      .filter(hh => residents.some(r => r.def.household === hh));
  return mawar;
}
const greeted = () => mawarHouseholds().filter(hh => residents.some(r => r.def.household === hh && social(r.npc).met));

/** Start a new game: with the arrival (Pak RT at the gapura), or straight to the goals. */
export function beginNewGame(skipIntro: boolean) {
  tut.stage = skipIntro ? 'goals' : 'arrive';
  if (!skipIntro) {
    // Pak RT waits at the gapura until Raka talks to him.
    setPlan(bambang(), S.day, { start: h(6), end: h(9), location: 'gapura.greet', activity: 'chat' });
    // Put him there now (a plan over the current block doesn't move anyone by itself).
    resync();
    tip(
      'arrive',
      'Welcome to Kampung Sukamaju',
      'Pak RT is waiting by the gapura. Walk up to him (WASD), look at him and press E.',
    );
  } else
    tip(
      'goals',
      'Your first goals',
      'Greet the households on Gang Mawar, and bring something to Bu Sri’s warung. See the box at the top left.',
    );
}

/** After talking to Pak RT at the gate: he walks Raka home. */
export function startWalk() {
  tut.stage = 'follow';
  const r = bambang();
  setPlan(r, S.day, { start: S.time + 1, end: S.time + 80, location: 'raka.work', activity: 'chat' });
  tip('follow', 'Follow Pak RT', 'He’s walking you to Mbah Minah’s house. The marker shows where he is.');
}
/** After the talk at the house: the first goals. */
export function startGoals() {
  tut.stage = 'goals';
  const r = bambang();
  // Pak RT goes back to his day.
  r.plans = r.plans.filter(p => p.block.location !== 'raka.work' && p.block.location !== 'gapura.greet');
  setPlan(r, S.day, { start: S.time + 2, end: S.time + 3, location: 'home.teras', activity: 'relax' });
  tip(
    'goals',
    'Your first goals',
    'Greet the households on Gang Mawar, and bring something to Bu Sri’s warung. Your phone (Tab) has a Journal too.',
  );
}
/** Is this conversation a tutorial moment? ('gate' | 'house' | null) */
export function tutorialScene(r: Resident): 'gate' | 'house' | null {
  if (r.npc.id !== 'bambang') return null;
  if (tut.stage === 'arrive') return 'gate';
  if (tut.stage === 'house') return 'house';
  return null;
}

/* ================= tips ================= */

/** A one-time hint. */
export function tip(id: string, title: string, sub: string) {
  if (tut.tips.includes(id)) return;
  tut.tips.push(id);
  toast(title, sub);
}

/* ================= every second ================= */

let acc = 0;
export function updateTutorial(dt: number, openTalk: (r: Resident) => void) {
  acc += dt;
  if (acc < 1) return;
  acc = 0;
  const r = bambang();
  if (tut.stage === 'follow') {
    // Pak RT points things out on the way, when Raka is keeping up.
    if (r.state === 'walk' && r.dist < 9 && tut.walkLine < 5 && Math.random() < 0.18) {
      const i = tut.walkLine++;
      void lineFor(r, { kind: 'arc', outcome: 'tutorial.walk', line: i }).then(t => bubble(r, () => headPos(r), t, 5));
    }
    if (r.state === 'at' && r.slot.poi.id === 'raka' && r.dist < 7 && inWorld()) {
      tut.stage = 'house';
      openTalk(r);
    }
  }
  if (tut.stage === 'goals') {
    const g = greeted().length,
      n = mawarHouseholds().length;
    if (g >= n && tut.broughtSri) {
      tut.stage = 'done';
      repute(5, 'The new neighbour has said hello to the whole gang.', S.day, true);
      st.earn(50000);
      toast(
        'Welcome home, Raka',
        'You’ve greeted Gang Mawar and brought something to Bu Sri. Reputation +5, and Pak RT’s welcome envelope: Rp 50.000.',
      );
      sendText('bambang', 'tutorial_done');
    }
  }
  // Tips that come up in play.
  if (S.started && inWorld()) {
    if (st.stats.energy < 30)
      tip(
        'tired',
        'You’re getting tired',
        'Eat something (Tab → Bag), have a kopi at the warkop, or rest at home (E at your front door).',
      );
    if (S.time >= h(21))
      tip(
        'night',
        'It’s getting late',
        'Sleep at home (E at your front door) after 20:00. At 02:00 Raka falls asleep wherever he is.',
      );
    if (S.day >= 2 && S.time >= h(9))
      tip(
        'journal',
        'The Journal',
        'Tab → Journal shows what’s coming up, the neighbours’ stories (✦) and Mbah Minah’s memories.',
      );
  }
  renderGoals();
}

/* ================= HUD: goals and marker ================= */

let goalsHtml = '';
function renderGoals() {
  let html = '';
  if (tut.stage === 'arrive') html = '<b>Talk to Pak RT</b><span>He’s waiting by the gapura. Press E.</span>';
  else if (tut.stage === 'follow' || tut.stage === 'house')
    html = '<b>Follow Pak RT</b><span>To Mbah Minah’s house on Gang Mawar.</span>';
  else if (tut.stage === 'goals') {
    const g = greeted().length,
      n = mawarHouseholds().length;
    html =
      `<b>First goals</b>` +
      `<span class="${g >= n ? 'done' : ''}">Greet the households on Gang Mawar (${g}/${n})</span>` +
      `<span class="${tut.broughtSri ? 'done' : ''}">Bring something to Bu Sri’s warung</span>`;
  }
  if (html !== goalsHtml) {
    goalsHtml = html;
    $('goals').innerHTML = html;
    $('goals').hidden = !html;
  }
}

const v = new THREE.Vector3();
/** Every frame: the marker over Pak RT while following him. */
export function updateMarker() {
  const el = $('marker');
  const r = bambang();
  // Only when he's not right there (close up his head is off the top of the screen anyway).
  const show = S.started && (tut.stage === 'follow' || tut.stage === 'arrive') && !r.hidden && r.dist > 5;
  if (!show) {
    el.hidden = true;
    return;
  }
  const [x, y, z] = headPos(r);
  v.set(x, y + 0.7, z).project(camera);
  const behind = v.z > 1;
  let sx = (v.x + 1) / 2,
    sy = (1 - v.y) / 2;
  if (behind) {
    sx = 1 - sx;
    sy = 0.92;
  }
  sx = Math.min(0.96, Math.max(0.04, sx));
  sy = Math.min(0.92, Math.max(0.08, sy));
  el.hidden = false;
  el.style.transform = `translate(${sx * innerWidth}px, ${sy * innerHeight}px) translate(-50%, -100%)`;
  el.querySelector('span')!.textContent = `${properName(r.npc)} · ${Math.round(r.dist)} m`;
}

/* ================= hooks ================= */

export function initTutorial() {
  on('gift', d => {
    if ((d ?? '').startsWith('sri:')) tut.broughtSri = true;
  });
}

export const saveTutorial = () => ({ ...tut, tips: [...tut.tips] });
export function loadTutorial(d: ReturnType<typeof saveTutorial>) {
  Object.assign(tut, d);
  // An unfinished walk picks up again at the goals.
  if (tut.stage === 'arrive' || tut.stage === 'follow' || tut.stage === 'house') tut.stage = 'goals';
}
