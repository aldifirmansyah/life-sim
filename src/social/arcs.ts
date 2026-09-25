/* Story arcs (spec §8.4): every resident has a three-step personal story that
   opens up as Raka's friendship with them grows (at 10, 30 and 55). A step
   starts with a short scene when Raka next talks to them, gives him something
   to do, and ends with another scene and a reward. Some endings change the
   kampung you can see; the elders' endings tell him about Mbah Minah.

   Tasks:
   - give: hand over an item (or any dish of a given quality) from the Give menu
   - do: something Raka does anywhere (a warung shift, kerja bakti, a harvest…), heard on the bus
   - meet: be at a place at a time; they turn up too (an appointment)
   - talk: ask another resident about it (Ask… menu), then come back
   - pay: chip in money (Ask… menu)
   - peace: two feuding neighbours must have made peace (good words, Ask…)
   The words live in lines.json as arc.<id>.<step>.start / .end / .other. */
import { S } from '../core/state';
import { residents, type Resident } from '../npc/npcs';
import type { Category } from '../game/items';
import { on, type GameEvent } from '../game/bus';
import * as st from '../game/stats';
import { befriend, remember, social, stageRank } from './social';
import { repute } from './reputation';
import { addMinah } from './minah';
import { OUTINGS, plan, nextSlot, rakaBusy, when, type Outing, appointments } from './plans';
import { toast } from '../ui/hud';

type Task =
  | { kind: 'give'; items?: string[]; cat?: Category; minQ?: number }
  | { kind: 'do'; event: GameEvent; detail?: string; n?: number }
  | {
      kind: 'meet';
      location: string;
      time: number;
      minutes: number;
      place: string;
      activity?: 'chat' | 'walk' | 'relax' | 'eat';
    }
  | { kind: 'talk'; to: string }
  | { kind: 'pay'; amount: number }
  | { kind: 'peace'; a: string; b: string };

interface Step {
  title: string;
  /** What to do, for the Journal. */
  hint: string;
  task: Task;
  reward: {
    f: number;
    rep: number;
    money?: number;
    item?: string;
    flag?: string;
    minah?: { title: string; text: string };
  };
}
export interface Arc {
  title: string;
  steps: [Step, Step, Step];
}

const MIN = [10, 30, 55];
const h = (hh: number, mm = 0) => hh * 60 + mm;
const give = (items: string[]): Task => ({ kind: 'give', items });
const dish = (minQ: number): Task => ({ kind: 'give', cat: 'dish', minQ });
const doing = (event: GameEvent, detail?: string, n?: number): Task => ({ kind: 'do', event, detail, n });
const talk = (to: string): Task => ({ kind: 'talk', to });
const pay = (amount: number): Task => ({ kind: 'pay', amount });
const meet = (
  location: string,
  time: number,
  minutes: number,
  place: string,
  activity: 'chat' | 'walk' | 'relax' | 'eat' = 'chat',
): Task => ({
  kind: 'meet',
  location,
  time,
  minutes,
  place,
  activity,
});
const R = (f: number, rep: number, extra: Partial<Step['reward']> = {}) => ({ f, rep, ...extra });

export const ARCS: Record<string, Arc> = {
  bambang: {
    title: 'The new resident',
    steps: [
      { title: 'Lapor diri', hint: 'Show your face at Sunday kerja bakti.', task: doing('kerja'), reward: R(6, 2) },
      {
        title: 'The RT kas',
        hint: 'Put Rp 50.000 into the RT kas for the 17-an prizes (Ask… menu).',
        task: pay(50000),
        reward: R(8, 4),
      },
      {
        title: 'Her old job',
        hint: 'Ask Pak Hartono about the RT books.',
        task: talk('hartono'),
        reward: R(10, 5, {
          minah: {
            title: 'The treasurer',
            text: 'Pak RT says Mbah Minah kept the RT kas for eleven years, and never once came up short. "She would chase me for Rp 500," he laughs.',
          },
        }),
      },
    ],
  },
  ratna: {
    title: 'Kue for the arisan',
    steps: [
      {
        title: 'Sold out',
        hint: 'Bring Bu RT some klepon or onde-onde from the pasar pagi.',
        task: give(['klepon', 'onde_onde']),
        reward: R(6, 1),
      },
      {
        title: 'One of the ibu-ibu',
        hint: 'Join the arisan (second Saturday of the month, 15:00, balai warga).',
        task: doing('arisan'),
        reward: R(8, 3),
      },
      {
        title: 'Her recipe',
        hint: 'Cook something good (3★ or better) and bring it to Bu RT.',
        task: dish(3),
        reward: R(10, 3, {
          minah: {
            title: 'Kue for everyone',
            text: 'Bu RT learned to make kue from Mbah Minah. "Every funeral, every wedding, every sick neighbour: a tray of her kue at the door before anyone asked."',
          },
        }),
      },
    ],
  },
  sri: {
    title: 'The minimarket',
    steps: [
      { title: 'A busy day', hint: 'Help at the warung for a shift.', task: doing('shift'), reward: R(6, 2) },
      {
        title: 'Word of mouth',
        hint: 'Ask Fajar to make a video about the warung.',
        task: talk('fajar'),
        reward: R(8, 3),
      },
      {
        title: 'A fresh coat',
        hint: 'Chip in Rp 100.000 for a new menu board and paint (Ask… menu).',
        task: pay(100000),
        reward: R(10, 5, {
          flag: 'warung_board',
          minah: {
            title: 'The first warung',
            text: 'Bu Sri started her warung with a loan from Mbah Minah, thirty years ago. "She never asked for it back. She said: pay the kampung back instead."',
          },
        }),
      },
    ],
  },
  dimas: {
    title: 'The futsal team',
    steps: [
      {
        title: 'Pick-up game',
        hint: 'Play futsal at the lapangan (late afternoon).',
        task: doing('futsal'),
        reward: R(6, 1),
      },
      { title: 'A real ball', hint: 'Bring Dimas a new bola from the warung.', task: give(['bola']), reward: R(8, 2) },
      {
        title: 'Training',
        hint: 'Meet Dimas at the lapangan to train.',
        task: meet('lapangan.bench', h(16, 30), 60, 'the lapangan', 'relax'),
        reward: R(10, 3),
      },
    ],
  },
  darto: {
    title: 'The broken window',
    steps: [
      {
        title: 'Who broke it?',
        hint: 'Ask Bu Darto what really happened to the window.',
        task: talk('sumi'),
        reward: R(6, 1),
      },
      {
        title: 'Amends',
        hint: 'Bring Pak Darto a pack of good kopi bubuk.',
        task: give(['kopi_bubuk']),
        reward: R(8, 2),
      },
      {
        title: 'Kali mornings',
        hint: 'Walk with Pak Darto by the kali in the morning.',
        task: meet('bridge.rail', h(6, 30), 45, 'the bridge', 'walk'),
        reward: R(12, 4, {
          flag: 'darto_bench',
          minah: {
            title: 'Kali mornings',
            text: 'Every morning for forty years, Pak Darto and Mbah Minah walked to the bridge and back. "She talked, I listened. Now it is too quiet." He has built you a bench.',
          },
        }),
      },
    ],
  },
  sumi: {
    title: 'Her best friend',
    steps: [
      {
        title: 'Flowers for Mbah',
        hint: 'Bring Bu Darto some bunga from the pasar.',
        task: give(['bunga']),
        reward: R(6, 1),
      },
      { title: 'Together', hint: 'Go to the Thursday pengajian.', task: doing('pengajian'), reward: R(8, 3) },
      {
        title: 'Her sayur asem',
        hint: 'Cook something and bring it to Bu Darto.',
        task: dish(2),
        reward: R(12, 3, {
          minah: {
            title: 'Best friends',
            text: 'Bu Darto and Mbah Minah were best friends from 1962. "We were brides the same year. We raised our children in each other’s kitchens."',
          },
        }),
      },
    ],
  },
  yusuf: {
    title: 'Morning rides',
    steps: [
      {
        title: 'Keep up',
        hint: 'Go for a morning jog (before 09:30).',
        task: doing('jog', 'morning'),
        reward: R(6, 1),
      },
      {
        title: 'Ngopi pagi',
        hint: 'Meet Mas Yusuf for kopi at the warkop at 07:00.',
        task: meet('warkop.seat', h(7), 45, 'Warkop Berkah'),
        reward: R(8, 2),
      },
      {
        title: 'A second helmet',
        hint: 'Chip in Rp 75.000 for a helmet for his kids (Ask… menu).',
        task: pay(75000),
        reward: R(10, 3),
      },
    ],
  },
  lestari: {
    title: 'Lestari Catering, online',
    steps: [
      {
        title: 'A logo',
        hint: 'Ask Mbak Nadia (the design student) to sketch a logo.',
        task: talk('nadia'),
        reward: R(6, 1),
      },
      {
        title: 'The menu',
        hint: 'Design her menu: do a freelance session at home.',
        task: doing('freelance'),
        reward: R(8, 2),
      },
      {
        title: 'Taste test',
        hint: 'Bring her something you cooked, 3★ or better.',
        task: dish(3),
        reward: R(12, 4, { flag: 'lestari_banner' }),
      },
    ],
  },
  bima: {
    title: 'Layangan',
    steps: [
      { title: 'Paper', hint: 'Bring Bima a koran for the kite.', task: give(['koran']), reward: R(6, 1) },
      { title: 'Bamboo', hint: 'Ask Pak Karyo for bamboo sticks.', task: talk('karyo'), reward: R(8, 2) },
      {
        title: 'Up it goes',
        hint: 'Meet Bima at the lapangan in the afternoon.',
        task: meet('lapangan.bench', h(16, 30), 60, 'the lapangan', 'relax'),
        reward: R(10, 3, { flag: 'kites' }),
      },
    ],
  },
  putri: {
    title: 'Putri’s garden',
    steps: [
      { title: 'A flower', hint: 'Bring Putri a bunga.', task: give(['bunga']), reward: R(6, 1) },
      { title: 'Show me', hint: 'Grow and harvest something in your garden.', task: doing('harvest'), reward: R(8, 2) },
      {
        title: 'Her own pot',
        hint: 'Give Putri something you grew (tomat, cabai or kemangi).',
        task: give(['tomat', 'cabai', 'kemangi']),
        reward: R(10, 2),
      },
    ],
  },
  slamet: {
    title: 'Nonton bareng',
    steps: [
      {
        title: 'Good coffee',
        hint: 'Bring Pak Slamet a pack of kopi bubuk.',
        task: give(['kopi_bubuk']),
        reward: R(6, 1),
      },
      {
        title: 'The antenna',
        hint: 'Ask Bang Udin to fix the warkop’s TV antenna.',
        task: talk('udin'),
        reward: R(8, 2),
      },
      {
        title: 'Match night',
        hint: 'Watch the football at the warkop at 19:30.',
        task: meet('warkop.seat', h(19, 30), 90, 'Warkop Berkah'),
        reward: R(10, 4),
      },
    ],
  },
  hartono: {
    title: 'Peace and quiet',
    steps: [
      {
        title: 'Something to read',
        hint: 'Bring Pak Hartono a koran or a buku TTS.',
        task: give(['koran', 'buku_tts']),
        reward: R(6, 1),
      },
      {
        title: 'The other side',
        hint: 'Ask Bang Udin about the motorbike noise.',
        task: talk('udin'),
        reward: R(8, 2),
      },
      {
        title: 'Made up',
        hint: 'Help Pak Hartono and Bang Udin make peace (put in good words with both).',
        task: { kind: 'peace', a: 'hartono', b: 'udin' },
        reward: R(12, 5, {
          minah: {
            title: 'The audit',
            text: 'Pak Hartono once audited the RT books, and found them perfect. "Your grandmother was the only honest treasurer I ever met. I told her so. She said: then you can pay for the tea."',
          },
        }),
      },
    ],
  },
  joko: {
    title: 'The secret of the broth',
    steps: [
      {
        title: 'A regular',
        hint: 'Have a bowl of bakso at Mas Joko’s cart.',
        task: doing('buy', 'bakso:bakso'),
        reward: R(6, 1),
      },
      { title: 'Out of bawang', hint: 'Bring Mas Joko some bawang.', task: give(['bawang']), reward: R(8, 2) },
      {
        title: 'Late-night bakso',
        hint: 'Meet Mas Joko at his cart at 19:00.',
        task: meet('bakso.customer', h(19), 45, 'the bakso cart', 'eat'),
        reward: R(10, 3),
      },
    ],
  },
  udin: {
    title: 'The noisy motorbike',
    steps: [
      { title: 'Snack break', hint: 'Bring Bang Udin some gorengan.', task: give(['gorengan']), reward: R(6, 1) },
      { title: 'What he said', hint: 'Ask Pak Hartono what his problem is.', task: talk('hartono'), reward: R(8, 2) },
      {
        title: 'Quiet nights',
        hint: 'Help Bang Udin and Pak Hartono make peace.',
        task: { kind: 'peace', a: 'udin', b: 'hartono' },
        reward: R(12, 5),
      },
    ],
  },
  rahmat: {
    title: 'Night shift',
    steps: [
      { title: 'Company', hint: 'Keep the night watch at the pos ronda.', task: doing('ronda'), reward: R(6, 2) },
      { title: 'Stay awake', hint: 'Bring Pak Rahmat some kopi sachet.', task: give(['kopi_sachet']), reward: R(8, 2) },
      { title: 'Worries', hint: 'Ask Ustadz Hasan for advice on his behalf.', task: talk('hasan'), reward: R(10, 3) },
    ],
  },
  yati: {
    title: 'Seragam arisan',
    steps: [
      { title: 'Measurements', hint: 'Ask Bu RT for the arisan ladies’ sizes.', task: talk('ratna'), reward: R(6, 1) },
      { title: 'Fabric', hint: 'Chip in Rp 60.000 for batik fabric (Ask… menu).', task: pay(60000), reward: R(8, 2) },
      { title: 'A thank-you', hint: 'Bring Bu Yati some kue lapis.', task: give(['kue_lapis']), reward: R(10, 3) },
    ],
  },
  endang: {
    title: 'The loan',
    steps: [
      {
        title: 'How she feels',
        hint: 'Ask Bu Wati how she really feels about the loan.',
        task: talk('wati'),
        reward: R(6, 1),
      },
      {
        title: 'Part of it',
        hint: 'Help Bu Endang with Rp 100.000 towards what she owes (Ask… menu).',
        task: pay(100000),
        reward: R(8, 3),
      },
      {
        title: 'Lunas',
        hint: 'Help Bu Endang and Bu Wati make peace.',
        task: { kind: 'peace', a: 'endang', b: 'wati' },
        reward: R(12, 5),
      },
    ],
  },
  wati: {
    title: 'Jamu',
    steps: [
      { title: 'Jeruk', hint: 'Bring Bu Wati some jeruk for her jamu.', task: give(['jeruk']), reward: R(6, 1) },
      { title: 'Herbs', hint: 'Grow and harvest something in your garden.', task: doing('harvest'), reward: R(8, 2) },
      {
        title: 'Forgiving',
        hint: 'Help Bu Wati and Bu Endang make peace.',
        task: { kind: 'peace', a: 'wati', b: 'endang' },
        reward: R(12, 5, {
          minah: {
            title: 'Jamu in the last year',
            text: 'Bu Wati brought Mbah Minah jamu every morning in her last year, and never took money. "She taught me that. Some debts you write down, some you forget on purpose."',
          },
        }),
      },
    ],
  },
  rizky: {
    title: 'The kampung wifi',
    steps: [
      { title: 'All-nighter', hint: 'Bring Mas Rizky some kopi sachet.', task: give(['kopi_sachet']), reward: R(6, 1) },
      {
        title: 'Permission',
        hint: 'Ask Pak RT about a shared wifi for the gang.',
        task: talk('bambang'),
        reward: R(8, 2),
      },
      {
        title: 'The router',
        hint: 'Chip in Rp 80.000 for the router (Ask… menu).',
        task: pay(80000),
        reward: R(10, 4),
      },
    ],
  },
  nadia: {
    title: 'The mural',
    steps: [
      {
        title: 'Shop talk',
        hint: 'Show her how freelancing works: do a freelance session.',
        task: doing('freelance'),
        reward: R(6, 1),
      },
      {
        title: 'Permission',
        hint: 'Ask Pak RT if Nadia can paint the balai wall.',
        task: talk('bambang'),
        reward: R(8, 2),
      },
      {
        title: 'Paint',
        hint: 'Chip in Rp 120.000 for paint (Ask… menu).',
        task: pay(120000),
        reward: R(12, 5, { flag: 'mural' }),
      },
    ],
  },
  hasan: {
    title: 'The musholla',
    steps: [
      { title: 'All welcome', hint: 'Come to the Thursday pengajian.', task: doing('pengajian'), reward: R(6, 2) },
      { title: 'Clean hands', hint: 'Do your share at Sunday kerja bakti.', task: doing('kerja'), reward: R(8, 3) },
      {
        title: 'A new speaker',
        hint: 'Give Rp 100.000 infaq for the musholla speaker (Ask… menu).',
        task: pay(100000),
        reward: R(10, 5, {
          minah: {
            title: 'Friday mornings',
            text: 'Ustadz Hasan says Mbah Minah swept the musholla every Friday before Subuh, for as long as anyone can remember. Nobody ever saw her do it; it was just always clean.',
          },
        }),
      },
    ],
  },
  karyo: {
    title: 'Pak Karyo’s craft',
    steps: [
      { title: 'First job', hint: 'Restore a room of your house with him.', task: doing('restore'), reward: R(6, 2) },
      {
        title: 'A good tukang',
        hint: 'Bring Pak Karyo a pack of kopi bubuk.',
        task: give(['kopi_bubuk']),
        reward: R(8, 2),
      },
      {
        title: 'Two more rooms',
        hint: 'Restore two more rooms with him.',
        task: doing('restore', undefined, 2),
        reward: R(12, 4),
      },
    ],
  },
  ayu: {
    title: 'Quiet hours',
    steps: [
      { title: 'A break', hint: 'Bring Mbak Ayu a teh manis.', task: give(['teh_manis']), reward: R(6, 1) },
      {
        title: 'The noise',
        hint: 'Ask Fajar to film somewhere else during her calls.',
        task: talk('fajar'),
        reward: R(8, 2),
      },
      {
        title: 'Teh on your teras',
        hint: 'Have tea with Mbak Ayu on your teras at 16:00.',
        task: meet('raka.teras', h(16), 60, 'your teras'),
        reward: R(10, 3),
      },
    ],
  },
  fajar: {
    title: 'Going viral',
    steps: [
      {
        title: 'B-roll',
        hint: 'Meet Fajar at the lapangan so he can film.',
        task: meet('lapangan.bench', h(16, 30), 45, 'the lapangan', 'relax'),
        reward: R(6, 1),
      },
      {
        title: 'A soundtrack',
        hint: 'Play the guitar for his video (buy one, then play at home or the pos ronda).',
        task: doing('guitar'),
        reward: R(8, 2),
      },
      {
        title: 'The warung video',
        hint: 'Ask Bu Sri if Fajar can film at the warung.',
        task: talk('sri'),
        reward: R(12, 4, { flag: 'ringlight' }),
      },
    ],
  },
};

/* ================= state ================= */

export interface ArcState {
  /** Steps completed (0–3). */
  step: number;
  /** A step is under way. */
  active: boolean;
  /** Its task is done; the ending plays next time they talk. */
  ready: boolean;
  /** Progress toward counted tasks. */
  progress: number;
  /** Day the last step ended (one step a day). */
  day: number;
  /** Talk task: the other person has been asked. */
  asked: boolean;
}
const states = new Map<string, ArcState>();
export function arcState(id: string): ArcState {
  let s = states.get(id);
  if (!s) states.set(id, (s = { step: 0, active: false, ready: false, progress: 0, day: -1, asked: false }));
  return s;
}
/** World changes from finished arcs. */
export const flags = new Set<string>();
const flagListeners: ((f: string) => void)[] = [];
export const onFlag = (fn: (f: string) => void) => flagListeners.push(fn);

const byId = (id: string) => residents.find(r => r.npc.id === id)!;
export const current = (id: string) => {
  const s = arcState(id);
  return s.step < 3 ? ARCS[id].steps[s.step] : null;
};

/** What should happen when Raka talks to this resident: an ending, a new step, or nothing. */
export function pending(r: Resident): 'end' | 'start' | null {
  const id = r.npc.id;
  if (!ARCS[id]) return null;
  const s = arcState(id);
  if (s.step >= 3) return null;
  if (s.active) {
    if (!s.ready) checkPeace(id);
    return s.ready ? 'end' : null;
  }
  if (s.day === S.day) return null;
  return r.npc.playerRelationship.friendship >= MIN[s.step] && social(r.npc).met ? 'start' : null;
}

/** The start scene has played: set the task going. */
export function begin(r: Resident) {
  const id = r.npc.id;
  const s = arcState(id);
  const step = current(id)!;
  s.active = true;
  s.ready = false;
  s.progress = 0;
  s.asked = false;
  toast(`✦ ${ARCS[id].title}: ${step.title}`, step.hint);
  if (step.task.kind === 'meet') arrange(r, s.step);
  if (step.task.kind === 'give' && step.task.cat === 'dish') {
    // (handled in the Give menu)
  }
}

/** The outing behind a story meeting (made up front, so saved plans can find it). */
function arcOuting(id: string, n: number) {
  const oid = `arc-${id}-${n}`;
  let o = OUTINGS.find(x => x.id === oid);
  const t = ARCS[id].steps[n].task as Extract<Task, { kind: 'meet' }>;
  if (!o) {
    o = {
      id: oid,
      name: ARCS[id].steps[n].title,
      short: ARCS[id].steps[n].title.toLowerCase(),
      location: t.location,
      activity: t.activity ?? 'chat',
      times: [t.time],
      minutes: t.minutes,
      place: t.place,
      hidden: true,
    };
    OUTINGS.push(o);
  }
  return o;
}

/** A story meeting is set for the next time it can happen. */
function arrange(r: Resident, n: number) {
  const o = arcOuting(r.npc.id, n);
  let { day, start } = nextSlot(o, 90);
  while (rakaBusy(day, start, o.minutes)) day++;
  const a = plan(r, o as Outing, day, start, 'npc');
  toast(`Plan: ${o.name} with ${r.npc.name}`, `${when(a.day, a.start)} at ${o.place}. It’s in your phone.`);
}

/** The end scene has played: reward, and move on to the next step. */
export function finish(r: Resident) {
  const id = r.npc.id;
  const s = arcState(id);
  const step = current(id)!;
  const rw = step.reward;
  const ch = befriend(r.npc, rw.f, S.day, true);
  repute(rw.rep, `${ARCS[id].title}: ${step.title}`, S.day, true);
  if (rw.money) st.earn(rw.money);
  if (rw.item) st.add(rw.item);
  remember(r.npc, { day: S.day, kind: 'arc', text: `${step.title}: Raka helped`, weight: 3, about: id });
  if (rw.minah) addMinah({ id: `arc-${id}`, title: rw.minah.title, text: rw.minah.text, from: r.npc.name }, S.day);
  if (rw.flag) {
    flags.add(rw.flag);
    for (const fn of flagListeners) fn(rw.flag);
  }
  s.step++;
  s.active = s.ready = false;
  s.day = S.day;
  const done = s.step >= 3;
  toast(
    done ? `✦ ${ARCS[id].title}: complete` : `✦ ${step.title}: done`,
    `+${ch.delta} ♥ · reputation +${rw.rep}${done ? ' · See how the kampung has changed.' : ''}`,
  );
  return ch.delta;
}

function ready(id: string) {
  const s = arcState(id);
  if (!s.active || s.ready) return;
  s.ready = true;
  toast(`✦ ${current(id)!.title}`, `Go and tell ${byId(id).npc.name}.`);
}

/* ================= tasks ================= */

/** Does this item (from the Give menu) finish their current step? */
export function wantsGift(r: Resident, itemId: string, cat: Category, q: number) {
  const s = arcState(r.npc.id);
  const step = current(r.npc.id);
  if (!s.active || s.ready || !step || step.task.kind !== 'give') return false;
  const t = step.task;
  if (t.items) return t.items.includes(itemId);
  return cat === t.cat && q >= (t.minQ ?? 0);
}
export function gave(r: Resident) {
  arcState(r.npc.id).ready = true;
}

/** Their current step wants money (the Ask… menu offers it). */
export function wantsMoney(r: Resident) {
  const s = arcState(r.npc.id);
  const step = current(r.npc.id);
  return s.active && !s.ready && step?.task.kind === 'pay' ? step.task.amount : 0;
}
export function paid(r: Resident) {
  const amount = wantsMoney(r);
  if (!amount || !st.canAfford(amount)) return false;
  st.spend(amount);
  arcState(r.npc.id).ready = true;
  return true;
}

/** Stories where this resident is the one to ask ("Ask Fajar to…"): [whose arc, step]. */
export function askedAbout(r: Resident) {
  const out: { id: string; step: Step; n: number }[] = [];
  for (const id of Object.keys(ARCS)) {
    const s = arcState(id);
    const step = current(id);
    if (s.active && !s.ready && !s.asked && step?.task.kind === 'talk' && step.task.to === r.npc.id)
      out.push({ id, step, n: s.step });
  }
  return out;
}
export function asked(id: string) {
  const s = arcState(id);
  s.asked = true;
  ready(id);
}

function checkPeace(id: string) {
  const step = current(id);
  if (step?.task.kind !== 'peace') return;
  const a = byId(step.task.a).npc,
    b = byId(step.task.b).npc;
  if ((a.relationships[b.id] ?? 0) >= 0 && (b.relationships[a.id] ?? 0) >= 0) ready(id);
}

/** Things Raka does anywhere. */
function heard(event: GameEvent, detail?: string) {
  for (const id of Object.keys(ARCS)) {
    const s = arcState(id);
    const step = current(id);
    if (!s.active || s.ready || !step || step.task.kind !== 'do' || step.task.event !== event) continue;
    if (step.task.detail && !(detail ?? '').startsWith(step.task.detail)) continue;
    s.progress++;
    if (s.progress >= (step.task.n ?? 1)) ready(id);
  }
}

/* ================= milestones ================= */

/** Close friends ask Raka to dinner; best friends tell him a secret (next time they talk). */
const milestone = new Map<string, number>();
export const secretDue = (r: Resident) => (milestone.get(r.npc.id) ?? 0) >= 4 && !secrets.has(r.npc.id);
export const secrets = new Set<string>();

/* ================= wiring ================= */

export function initArcs(dinner: (r: Resident) => void) {
  for (const [id, arc] of Object.entries(ARCS))
    arc.steps.forEach((st, n) => st.task.kind === 'meet' && arcOuting(id, n));
  const events: GameEvent[] = [
    'shift',
    'cook',
    'harvest',
    'jog',
    'freelance',
    'kerja',
    'pengajian',
    'arisan',
    'lomba',
    'stage',
    'restore',
    'fish',
    'guitar',
    'futsal',
    'ronda',
    'gift',
    'buy',
  ];
  for (const e of events) on(e, d => heard(e, d));
  on('plan_met', d => {
    const [npc, outing] = (d ?? ':').split(':');
    if (outing.startsWith('arc-')) {
      const [, id, n] = outing.split('-');
      if (id === npc && arcState(id).step === +n) ready(id);
    }
    if (outing === 'makan') {
      st.addEnergy(25);
      st.addMood(8);
    }
  });
  let acc = 0;
  onTick = (dt: number) => {
    acc += dt;
    if (acc < 1) return;
    acc = 0;
    for (const r of residents) {
      const rank = stageRank(r.npc.playerRelationship.stage);
      const got = milestone.get(r.npc.id) ?? 0;
      if (rank >= 3 && got < 3 && !S.dialog) {
        milestone.set(r.npc.id, 3);
        if (!appointments.some(a => a.npc === r.npc.id && a.outing === 'makan')) dinner(r);
      }
      if (rank >= 4 && (milestone.get(r.npc.id) ?? 0) < 4) milestone.set(r.npc.id, 4);
    }
  };
}
let onTick: (dt: number) => void = () => {};
export const updateArcs = (dt: number) => onTick(dt);

/** For the Journal: stories under way and finished. */
export function journal() {
  return residents
    .filter(r => ARCS[r.npc.id] && social(r.npc).met)
    .map(r => {
      const s = arcState(r.npc.id);
      const arc = ARCS[r.npc.id];
      const step = current(r.npc.id);
      return {
        r,
        title: arc.title,
        step: s.step,
        active: s.active,
        ready: s.ready,
        stepTitle: step?.title,
        hint: s.ready ? `Go and tell ${r.npc.name}.` : step?.hint,
        next: MIN[s.step],
      };
    })
    .filter(x => x.step > 0 || x.active);
}

/* ================= save ================= */

export const saveArcs = () => ({
  states: [...states.entries()],
  flags: [...flags],
  secrets: [...secrets],
  milestone: [...milestone.entries()],
});
export function loadArcs(d: ReturnType<typeof saveArcs>) {
  states.clear();
  for (const [k, v] of d.states) states.set(k, v);
  secrets.clear();
  for (const k of d.secrets) secrets.add(k);
  milestone.clear();
  for (const [k, v] of d.milestone) milestone.set(k, v);
  for (const f of d.flags)
    if (!flags.has(f)) {
      flags.add(f);
      for (const fn of flagListeners) fn(f);
    }
}
