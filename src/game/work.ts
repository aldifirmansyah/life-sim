/* The job: software engineer at Chopee (docs/singapore-plan.md, "Work").
   - Onboarding at reception on the first weekday after arrival: the staff pass,
     the laptop, choosing the office days.
   - Two-week sprints of tickets. Each has points and needs hours of work; Aldi
     works on them with the laptop (L) anywhere indoors: an hour of focus, or deep
     work (a short debugging mini-game, better work in less time). At the desk on
     the team floor the team helps and work goes faster; tired, it goes slower.
   - On office days, the stand-up at 10:00 in the Merlion room; every second
     Friday at 15:00 the sprint review and planning, which rates the sprint and
     brings the next one.
   - Salary on the 25th.
   The goals box shows the sprint once the arrival is done, and the marker points
   to what's next (reception, the stand-up, the review). */
import { $, hash, rng } from '../core/util';
import { S } from '../core/state';
import { player } from '../core/player';
import { toast } from '../ui/hud';
import { openPanel, closePanel, type Row } from '../ui/panel';
import { startGame } from '../ui/minigame';
import { passTime } from '../core/time';
import { weekday, dateOf, shortDate, DAYS, isWeekend } from './calendar';
import { earn, addEnergy, addMood, tired, sgd } from './stats';
import { arrivalDone } from './arrival';
import { markTo } from './marker';
import { CHOPEE_HQ, CITY_OFFICE } from '../places/sites';

export interface Ticket {
  id: string;
  title: string;
  points: number;
  /** Hours of work done, and needed. */
  done: number;
  need: number;
  /** Sum of the quality of each session (0..1 each), and how many sessions. */
  q: number;
  n: number;
}

const TEMPLATES: [string, number][] = [
  ['Checkout: add PayNow QR as a payment option', 5],
  ['Bug: cart badge shows 0 after logging in', 2],
  ['Flash sale page is slow on 4G (5 s to load)', 3],
  ["Code review: Hafiz's voucher service PR", 1],
  ["Search: find 'durian' when people type 'durain'", 3],
  ['Bug: long names cut off on the order page', 2],
  ['Seller dashboard: export orders to CSV', 3],
  ['9.9 sale: countdown banner on the home page', 2],
  ['Crash on older Android phones when opening chat', 3],
  ["Code review: Mei Ling's address autocomplete", 1],
  ['Malay translations for the settings page', 2],
  ['Refactor the shipping fee calculator (tests first)', 5],
  ['Dark mode for the order tracking screen', 3],
  ['Bug: vouchers applied twice at checkout', 3],
  ['Add Bahasa Indonesia to the seller app', 2],
  ['Speed up the product image carousel', 3],
];
/** Monthly salary. */
export const SALARY = 7200;
const HOURS_PER_POINT = 1.5;

export const job = {
  /** Onboarded: has the staff pass and the laptop. */
  pass: false,
  /** Office days (weekday numbers, 1 Monday … 5 Friday). */
  office: [] as number[],
  sprint: 0,
  /** The sprint's first day (a Monday) and the review day (the second Friday). */
  start: 0,
  review: 0,
  tickets: [] as Ticket[],
  /** Stand-ups this sprint: attended and missed; the last day one was settled. */
  went: 0,
  missed: 0,
  settled: 0,
  /** The day the review happened (so it happens once). */
  reviewed: 0,
  /** City-office extras this sprint (a seller meeting attended), and the months whose all-hands Aldi went to. */
  bonus: 0,
  allhands: [] as number[],
  /** The day the seller meeting was attended. */
  seller: 0,
  /** Performance so far, 1–5, and the last review's words. */
  rating: 3,
  lastReview: '',
  /** Months (index) the salary has been paid. */
  paid: [] as number[],
  /** The onboarding day (no stand-up to go to that day). */
  joined: 0,
};

const pts = (f: (t: Ticket) => boolean) => job.tickets.filter(f).reduce((a, t) => a + t.points, 0);
const isDone = (t: Ticket) => t.done >= t.need - 1e-6;
export const pointsDone = () => pts(isDone);
export const pointsAll = () => pts(() => true);

function newSprint(start: number) {
  job.sprint++;
  job.start = start;
  job.review = start + 11;
  job.went = job.missed = 0;
  job.bonus = 0;
  const r = rng(hash('sprint', job.sprint));
  const pool = TEMPLATES.slice();
  const picked: [string, number][] = [];
  let total = 0;
  while (pool.length && (picked.length < 4 || total < 14) && picked.length < 6) {
    const t = pool.splice(r.int(0, pool.length - 1), 1)[0];
    picked.push(t);
    total += t[1];
  }
  job.tickets = picked.map(([title, points], i) => ({
    id: `CHP-${1200 + job.sprint * 10 + i}`,
    title,
    points,
    done: 0,
    need: points * HOURS_PER_POINT,
    q: 0,
    n: 0,
  }));
}

const isOfficeDay = (day: number) => job.pass && job.office.includes(weekday(day));
const officeLabel = () => job.office.map(d => DAYS[d].slice(0, 3)).join(', ');

/* ---------- onboarding (reception) ---------- */

/** E at reception. */
export function reception() {
  if (job.pass) {
    openPanel({
      title: 'Chopee · Reception',
      sub: 'Science Park Drive',
      body: '"Morning! Your pass works at the gantry, the lifts are behind it. Team floor is Level 2."',
      rows: [{ label: 'Thanks!', run: () => closePanel() }],
    });
    return;
  }
  if (!arrivalDone() || S.day < 2 || isWeekend(S.day) || S.time < 8 * 60 || S.time > 19 * 60) {
    openPanel({
      title: 'Chopee · Reception',
      sub: 'Science Park Drive',
      body: isWeekend(S.day)
        ? '"Sorry ah, we are closed on weekends. Come back on Monday!"'
        : '"Good day! Reception opens at 8am. New joiners, please come by in the morning."',
      rows: [{ label: 'OK', run: () => closePanel() }],
    });
    return;
  }
  openPanel({
    title: 'Chopee · Reception',
    sub: 'Your first day',
    body: '"Oh, you must be Aldi! Wei Jie is coming down. Here, your visitor sticker first."',
    rows: [{ label: 'Wait for Wei Jie', run: weiJie }],
  });
}
function weiJie() {
  openPanel({
    title: 'Wei Jie',
    sub: 'Engineering manager · the Checkout team',
    body:
      '"Aldi! Welcome, welcome. Here\'s your staff pass and your laptop. We do two-week sprints: tickets, ' +
      'you work on them wherever you like, but come in for stand-up at 10 on your office days. ' +
      'Sprint review is every second Friday, 3pm. Which days you want to come in?"',
    rows: [
      { label: 'Monday, Wednesday, Thursday', run: () => onboard([1, 3, 4]) },
      { label: 'Tuesday, Wednesday, Friday', run: () => onboard([2, 3, 5]) },
      { label: 'Monday and Thursday', note: 'two days', run: () => onboard([1, 4]) },
      { label: 'Tuesday and Friday', note: 'two days', run: () => onboard([2, 5]) },
    ],
  });
}
function onboard(days: number[]) {
  job.pass = true;
  job.office = days;
  job.joined = S.day;
  job.settled = S.day;
  newSprint(S.day - (weekday(S.day) - 1));
  addMood(8);
  openPanel({
    title: 'Wei Jie',
    sub: `Office days: ${officeLabel()}`,
    body:
      '"Shiok. Your first tickets are in, have a look on the laptop (L). Your desk is on Level 2, next to mine. ' +
      'Lunch at the canteen downstairs is not bad, but the hawker centre at Clementi is better lah."',
    rows: [{ label: "Let's go", run: () => closePanel() }],
  });
  toast('Staff pass and laptop', 'Tap the pass at the gantry. Press L to open the laptop anywhere indoors.', 'good');
}

/* ---------- the laptop ---------- */

/** L, or E at the desk (`atDesk`: the team is around, work goes faster). */
export function openLaptop(atDesk = false) {
  if (!job.pass) {
    toast('No work laptop yet', 'Chopee hands it out on your first day.');
    return;
  }
  if (player.ride) {
    toast('Not on the move', 'Find somewhere to sit down and work.');
    return;
  }
  if (!S.inside) {
    toast('Find a place to work', 'Your desk at Chopee, the studio, or a table at a food centre.');
    return;
  }
  const open = job.tickets.filter(t => !isDone(t));
  const rows: Row[] = open.map(t => ({
    label: `${t.id} · ${t.title}`,
    note: `${t.points} pt · ${Math.round((t.done / t.need) * 100)}%`,
    run: () => ticketPanel(t, atDesk),
  }));
  rows.push({ label: 'Close the laptop', run: () => closePanel() });
  openPanel({
    title: `Chopee · Sprint ${job.sprint}`,
    sub: `${pointsDone()} / ${pointsAll()} points · review ${shortDate(job.review)} 3pm${atDesk ? ' · at your desk' : ''}`,
    body: open.length
      ? `Stand-ups this sprint: ${job.went} (missed ${job.missed}). Rating so far: ${'★'.repeat(Math.round(job.rating))}${'☆'.repeat(5 - Math.round(job.rating))}`
      : 'All tickets done. Steady lah! Take it easy until the review.',
    rows,
  });
}

function speed(atDesk: boolean) {
  return (atDesk ? 1.25 : 1) * (tired() ? 0.6 : 1);
}

function ticketPanel(t: Ticket, atDesk: boolean) {
  const back = () => openLaptop(atDesk);
  openPanel({
    title: t.id,
    sub: `${t.title} · ${t.points} points`,
    body: `${t.done.toFixed(1)} of ${t.need.toFixed(1)} hours done.${tired() ? ' Aldi is tired: this will go slowly.' : ''}${atDesk ? ' The team is around to help.' : ''}`,
    back,
    rows: [
      { label: 'Focus for an hour', note: '1 h', run: () => session(t, atDesk, 60, 1, 0.6) },
      {
        label: 'Deep work: track the problem down',
        note: 'mini-game · 45 min',
        run: () => {
          closePanel(false);
          startGame({
            kind: 'timing',
            title: `Debugging ${t.id}`,
            sub: t.title,
            help: 'Press Space when the cursor is on the faulty line.',
            seconds: 14,
            goal: 3,
            tries: 6,
            zone: 0.2,
            speed: 0.75,
            done: r => session(t, atDesk, 45, r.won ? 1.5 : 0.7, Math.min(1, r.hits / 3)),
          });
        },
      },
      { label: 'Back', run: back },
    ],
  });
}

function session(t: Ticket, atDesk: boolean, minutes: number, hours: number, quality: number) {
  closePanel();
  passTime(minutes, 'Working…', () => {
    t.done = Math.min(t.need, t.done + hours * speed(atDesk));
    t.q += quality;
    t.n++;
    addEnergy(-6 * (minutes / 60));
    if (isDone(t)) {
      addMood(4);
      toast(`${t.id} done`, `Pull request merged: ${t.title}.`, 'good');
    } else toast(t.id, `${Math.round((t.done / t.need) * 100)}% done.`, null);
    renderGoals();
  });
}

/* ---------- meetings (the Merlion room) ---------- */

const standupNow = () => isOfficeDay(S.day) && S.day !== job.joined && S.time >= 9.5 * 60 && S.time < 10.5 * 60;
const reviewNow = () => job.pass && S.day === job.review && job.reviewed !== S.day && S.time >= 14.5 * 60;

/** What the meeting table offers now, or null. */
export function meetingLabel() {
  if (reviewNow()) return `Sprint ${job.sprint} review and planning`;
  if (standupNow() && job.settled !== S.day) return 'Join the stand-up';
  return null;
}
export function meeting() {
  if (reviewNow()) return review(true);
  if (!standupNow() || job.settled === S.day) return;
  const open = job.tickets.filter(t => !isDone(t));
  const now = open[0];
  openPanel({
    title: 'Stand-up',
    sub: 'The Checkout team · Merlion room',
    body: `Wei Jie: "OK, quick round. Aldi?"`,
    rows: [
      {
        label: now ? `"Working on ${now.id}, should be done soon."` : '"All my tickets done, can help anyone."',
        run: () => standup(3),
      },
      { label: '"Stuck a bit, can someone pair with me after?"', run: () => standup(2) },
      { label: '"Nothing much, same as yesterday."', run: () => standup(0) },
    ],
  });
}
function standup(mood: number) {
  job.went++;
  job.settled = S.day;
  addMood(mood);
  closePanel();
  passTime(15, 'Stand-up…', () => toast('Stand-up done', 'Fifteen minutes, as promised. Back to work.', null));
}

function review(inPerson: boolean) {
  job.reviewed = S.day;
  const done = pointsDone(),
    all = pointsAll();
  const q = job.tickets.reduce((a, t) => a + (t.n ? t.q / t.n : 0), 0) / Math.max(1, job.tickets.length);
  const shows = job.went / Math.max(1, job.went + job.missed);
  const score = (done / Math.max(1, all)) * 0.6 + q * 0.2 + shows * 0.2 + job.bonus - (inPerson ? 0 : 0.1);
  const stars = Math.max(1, Math.min(5, Math.round(1 + score * 4)));
  job.rating = job.rating * 0.6 + stars * 0.4;
  job.lastReview =
    stars >= 4
      ? 'Wei Jie: "Solid sprint, Aldi. The checkout team noticed."'
      : stars === 3
        ? 'Wei Jie: "Not bad. Some tickets carry over, no stress."'
        : 'Wei Jie: "This sprint a bit slow hor. Let\'s talk about what\'s blocking you."';
  addMood(stars >= 4 ? 8 : stars === 3 ? 2 : -6);
  const summary = `${done} of ${all} points done · stand-ups ${job.went}/${job.went + job.missed} · ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`;
  // Unfinished tickets carry over into the next sprint, with the work already done.
  const carry = job.tickets.filter(t => !isDone(t));
  newSprint(job.review + 3);
  job.tickets = [...carry, ...job.tickets].slice(0, 6);
  if (inPerson) {
    openPanel({
      title: `Sprint ${job.sprint - 1} review`,
      sub: summary,
      body: `${job.lastReview} Next sprint: ${pointsAll()} points, review on ${shortDate(job.review)}.`,
      rows: [{ label: 'OK', run: () => (closePanel(), passTime(60, 'Review and planning…')) }],
    });
  } else toast(`Sprint ${job.sprint - 1} review (joined by phone)`, `${summary}. ${job.lastReview}`, 'msg');
}

/* ---------- the city office (Won Raffles Place, Level 30) ---------- */

/** The seller meeting: the Wednesday of the sprint's second week, 14:00–15:30. */
const sellerDay = () => job.start + 9;
const sellerNow = () =>
  job.pass && S.day === sellerDay() && job.seller !== S.day && S.time >= 13.75 * 60 && S.time < 15.5 * 60;
/** The all-hands: the last Friday of the month, 16:00–17:00. */
function lastFriday(day: number) {
  const { d, m } = dateOf(day);
  return weekday(day) === 5 && dateOf(day + 7).m !== m && d > 20;
}
const allhandsNow = () =>
  job.pass && lastFriday(S.day) && !job.allhands.includes(dateOf(S.day).m) && S.time >= 15.75 * 60 && S.time < 17 * 60;

export function cityLabel() {
  if (allhandsNow()) return 'Join the Chopee all-hands';
  if (sellerNow()) return 'Seller meeting with the Checkout partners';
  return null;
}
export function cityMeeting() {
  if (allhandsNow()) {
    job.allhands.push(dateOf(S.day).m);
    closePanel();
    passTime(60, 'All-hands…', () => {
      addMood(6);
      toast(
        'All-hands',
        'The CEO on stage: orders up, a new logistics hub, free bubble tea for everyone. Aldi claps with the rest.',
        'good',
      );
    });
    return;
  }
  if (!sellerNow()) return;
  openPanel({
    title: 'Seller meeting',
    sub: 'Marina room · Level 30',
    body: 'Three big sellers want faster payouts at checkout. Wei Jie looks at Aldi: "You know the flow best. Want to explain?"',
    rows: [
      {
        label: 'Walk them through the new checkout',
        run: () => seller(0.12, 5, 'The sellers nod. One asks for your card.'),
      },
      {
        label: 'Let Wei Jie do the talking, take notes',
        run: () => seller(0.05, 2, 'Quiet but useful: the notes go to the whole team.'),
      },
    ],
  });
}
function seller(bonus: number, mood: number, text: string) {
  job.seller = S.day;
  job.bonus += bonus;
  closePanel();
  passTime(75, 'Meeting…', () => {
    addMood(mood);
    toast('Seller meeting done', text, null);
  });
}

/* ---------- the day ---------- */

let lastMin = -1;
/** Every frame: once a game minute, the day's checks; the goals box and the marker. */
export function updateWork() {
  if (!S.started || !arrivalDone()) return;
  const m = Math.floor(S.time);
  if (m !== lastMin) {
    lastMin = m;
    minute();
    renderGoals();
  }
  const t = target();
  if (t) markTo(t[0], t[1]);
}

function minute() {
  // Salary on the 25th.
  const { d, m } = dateOf(S.day);
  if (job.pass && d === 25 && S.time >= 9 * 60 && !job.paid.includes(m)) {
    job.paid.push(m);
    earn(SALARY);
    toast(`Salary in: ${sgd(SALARY)}`, 'Chopee pays on the 25th. Rent comes on the 1st.', 'good');
  }
  if (!job.pass) return;
  // A missed stand-up.
  if (isOfficeDay(S.day) && S.day !== job.joined && job.settled !== S.day && S.time >= 10.5 * 60) {
    job.settled = S.day;
    job.missed++;
    addMood(-3);
    toast('Wei Jie (Chopee)', 'Eh Aldi, never see you at stand-up today? All OK?', 'msg');
  }
  // The review, if Aldi didn't come: joined by phone at five.
  if (S.day === job.review && job.reviewed !== S.day && S.time >= 17 * 60) review(false);
  // Reminders.
  if (isOfficeDay(S.day) && S.day !== job.joined && Math.floor(S.time) === 8 * 60 + 45)
    toast('Office day', 'Stand-up at 10:00 at Chopee, Science Park Drive.', null);
  if (S.day === sellerDay() && Math.floor(S.time) === 9 * 60)
    toast('Seller meeting at 2pm', 'At the city office: Won Raffles Place, Level 30 (Raffles Place MRT).', null);
  if (lastFriday(S.day) && Math.floor(S.time) === 9 * 60)
    toast('All-hands at 4pm', 'The whole company at the city office, Won Raffles Place.', null);
  if (S.day === job.review && Math.floor(S.time) === 13 * 60)
    toast('Sprint review at 3pm', 'In the Merlion room at Chopee.', null);
}

const RECEPTION: [number, number, number] = [CHOPEE_HQ.x0 + 8, 1.2, CHOPEE_HQ.z1 - 5];
const MEETING: [number, number, number] = [CHOPEE_HQ.x0 + 5, CHOPEE_HQ.l2 + 1, CHOPEE_HQ.z0 + 4];
const CITY: [number, number, number] = [(CITY_OFFICE.x0 + CITY_OFFICE.x1) / 2, 2, CITY_OFFICE.z1];
const MARINA: [number, number, number] = [CITY_OFFICE.x0 + 5.5, CITY_OFFICE.floor + 1, CITY_OFFICE.z1 - 6];
/** The city office's door from outside, the Marina room once up on Level 30. */
const city = (): [number, number, number] => (player.y > CITY_OFFICE.floor - 5 ? MARINA : CITY);
function target(): [string, [number, number, number]] | null {
  if (!job.pass) return S.day >= 2 && !isWeekend(S.day) ? ['Chopee reception', RECEPTION] : null;
  if (reviewNow() || (S.day === job.review && S.time > 13 * 60 && job.reviewed !== S.day))
    return ['Sprint review', MEETING];
  if (isOfficeDay(S.day) && S.day !== job.joined && job.settled !== S.day && S.time > 8 * 60)
    return ['Stand-up', MEETING];
  if (S.day === sellerDay() && job.seller !== S.day && S.time > 12 * 60 && S.time < 15.5 * 60)
    return ['Seller meeting', city()];
  if (lastFriday(S.day) && !job.allhands.includes(dateOf(S.day).m) && S.time > 14 * 60 && S.time < 17 * 60)
    return ['All-hands', city()];
  return null;
}

function renderGoals() {
  const el = $('goals');
  el.hidden = false;
  if (!job.pass) {
    el.innerHTML = '<b>Chopee</b>';
    const s = document.createElement('span');
    s.textContent = 'Onboarding: Monday 10am at reception, Science Park Drive (bus 96 from one-north)';
    el.appendChild(s);
    return;
  }
  if (!job.sprint) return;
  el.innerHTML = `<b>Chopee · Sprint ${job.sprint}</b>`;
  const lines = [
    `Tickets: ${pointsDone()} / ${pointsAll()} points (review ${shortDate(job.review)}, 3pm)`,
    `Office days: ${officeLabel()} · stand-up 10:00`,
    `Seller meeting ${shortDate(sellerDay())}, 2pm · city office (Raffles Place)`,
  ];
  for (const l of lines) {
    const s = document.createElement('span');
    s.textContent = l;
    el.appendChild(s);
  }
}

/* ---------- saving ---------- */

export const saveWork = () => JSON.parse(JSON.stringify(job));
export function loadWork(d: Partial<typeof job> | undefined) {
  Object.assign(job, {
    pass: false,
    office: [],
    sprint: 0,
    start: 0,
    review: 0,
    tickets: [],
    went: 0,
    missed: 0,
    settled: 0,
    reviewed: 0,
    bonus: 0,
    allhands: [],
    seller: 0,
    rating: 3,
    lastReview: '',
    paid: [],
    joined: 0,
  });
  if (d) Object.assign(job, d);
  lastMin = -1;
}
