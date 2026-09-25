/* Short real-time mini-games (spec §7: lomba, futsal, fishing) in the dialogue
   card style. Three kinds:
   - race: press keys to move your lane along against rivals (mash one key, or alternate two)
   - timing: a marker swings across a bar; press when it's in the zone
   - reflex: wait for a bite, then press quickly
   Runs on wall-clock time; the world pauses behind it (S.game is a menu state). */
import { $, TOUCH } from '../core/util';
import { S } from '../core/state';
import { keys } from '../core/player';
import { tryLock } from './overlays';
import { sfx } from '../audio/audio';

export interface RaceSpec {
  kind: 'race';
  title: string;
  sub?: string;
  help: string;
  /** 'mash': one key (Space); 'alternate': ← and → (or A and D) in turn. */
  input: 'mash' | 'alternate';
  seconds: number;
  /** Progress per good press (0..1 of the track). */
  step: number;
  /** Rivals: name and speed (track per second). */
  rivals: { name: string; speed: number }[];
  /** Label for Raka's lane and the track. */
  you?: string;
  done: (r: { won: boolean; place: number; progress: number }) => void;
}
export interface TimingSpec {
  kind: 'timing';
  title: string;
  sub?: string;
  help: string;
  seconds: number;
  /** Hits needed to win (e.g. rungs of the pole), and how many tries at most (e.g. shots). */
  goal: number;
  tries?: number;
  /** Zone width (0..1) and marker speed (sweeps per second). */
  zone: number;
  speed: number;
  /** Losing a hit on a miss (sliding down the pole). */
  slip?: boolean;
  done: (r: { won: boolean; hits: number; tries: number }) => void;
}
export interface ReflexSpec {
  kind: 'reflex';
  title: string;
  sub?: string;
  help: string;
  rounds: number;
  /** Seconds to react once it bites. */
  window: number;
  done: (r: { caught: number; rounds: number }) => void;
}
type Spec = RaceSpec | TimingSpec | ReflexSpec;

let spec: Spec | null = null;
let t0 = 0;
let msg = '';
// race
let you = 0,
  last = '',
  stumble = 0;
let rivals: number[] = [];
// timing
let hits = 0,
  tries = 0,
  flash = 0;
// reflex
let round = 0,
  caught = 0,
  biteAt = 0,
  waitUntil = 0,
  state: 'wait' | 'bite' | 'pause' = 'wait';
let finished = false;
let lastFrame = 0;

const now = () => performance.now() / 1000;

export function startGame(s: Spec) {
  spec = s;
  S.game = true;
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  t0 = lastFrame = now();
  msg = '';
  finished = false;
  you = 0;
  last = '';
  stumble = 0;
  rivals = s.kind === 'race' ? s.rivals.map(() => 0) : [];
  hits = tries = 0;
  flash = 0;
  round = caught = 0;
  if (s.kind === 'reflex') nextRound();
  $('mg-title').textContent = s.title;
  $('mg-sub').textContent = s.sub ?? '';
  $('mg-help').textContent = s.help;
  const touch = $('mg-touch');
  touch.hidden = !TOUCH;
  touch.querySelector<HTMLElement>('[data-k="a"]')!.hidden = s.kind !== 'race' || s.input !== 'alternate';
  touch.querySelector<HTMLElement>('[data-k="b"]')!.hidden = s.kind !== 'race' || s.input !== 'alternate';
  touch.querySelector<HTMLElement>('[data-k="main"]')!.hidden = s.kind === 'race' && s.input === 'alternate';
  touch
    .querySelectorAll<HTMLElement>('button')
    .forEach(
      b =>
        (b.onpointerdown = e => (
          e.preventDefault(),
          press(b.dataset.k === 'a' ? 'L' : b.dataset.k === 'b' ? 'R' : 'M')
        )),
    );
  $('mg-field').innerHTML = '';
  $('minigame').hidden = false;
  render();
}

function nextRound() {
  state = 'wait';
  waitUntil = now() + 1.5 + Math.random() * 3.5;
}

export function gameKey(e: KeyboardEvent) {
  e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') return end(true);
  const k =
    e.code === 'ArrowLeft' || e.code === 'KeyA'
      ? 'L'
      : e.code === 'ArrowRight' || e.code === 'KeyD'
        ? 'R'
        : ['Space', 'KeyE', 'Enter'].includes(e.code)
          ? 'M'
          : '';
  if (k) press(k);
}

function press(k: string) {
  const s = spec;
  if (!s || finished) return;
  const t = now();
  if (s.kind === 'race') {
    if (t < stumble) return;
    if (s.input === 'mash') {
      if (k === 'M') {
        you += s.step;
        sfx('tick');
      }
    } else if (k === 'L' || k === 'R') {
      if (k === last) {
        // Same foot twice: you trip in the sack.
        stumble = t + 0.6;
        msg = 'Whoa! You stumble in the sack.';
        sfx('bad');
      } else {
        you += s.step;
        sfx('tick');
        msg = '';
      }
      last = k;
    }
    you = Math.min(1, you);
  } else if (s.kind === 'timing') {
    if (k !== 'M') return;
    tries++;
    const m = marker(t);
    if (Math.abs(m - 0.5) <= s.zone / 2) {
      hits++;
      flash = t;
      sfx('good');
      msg = s.tries ? 'Goal!' : 'Up you go!';
    } else {
      sfx('bad');
      if (s.slip) hits = Math.max(0, hits - 1);
      msg = s.tries ? 'Saved by the keeper.' : 'You slip back down.';
    }
  } else if (s.kind === 'reflex') {
    if (k !== 'M') return;
    if (state === 'bite') {
      caught++;
      msg = 'Got one!';
      sfx('splash');
      endRound();
    } else if (state === 'wait') {
      msg = 'Too soon. The fish swims off.';
      endRound();
    }
  }
}

function endRound() {
  const s = spec as ReflexSpec;
  round++;
  state = 'pause';
  waitUntil = now() + 1.2;
  if (round >= s.rounds) waitUntil = now() + 0.9;
}

const marker = (t: number) => {
  const s = spec as TimingSpec;
  const ph = ((t - t0) * s.speed) % 2;
  return ph < 1 ? ph : 2 - ph;
};

/** Every frame while a game is open. */
export function updateGame() {
  const s = spec;
  if (!s || finished) return;
  const t = now();
  const dt = Math.min(0.1, t - lastFrame);
  lastFrame = t;
  if (s.kind === 'race') {
    s.rivals.forEach((r, i) => (rivals[i] = Math.min(1, rivals[i] + r.speed * dt * (0.7 + Math.random() * 0.6))));
    if (you >= 1 || rivals.some(v => v >= 1) || t - t0 >= s.seconds) return end();
  } else if (s.kind === 'timing') {
    if (hits >= s.goal || (s.tries && tries >= s.tries) || t - t0 >= s.seconds) return end();
  } else if (s.kind === 'reflex') {
    if (state === 'wait' && t >= waitUntil) {
      state = 'bite';
      biteAt = t;
      sfx('tick');
      msg = '!';
    } else if (state === 'bite' && t - biteAt > s.window) {
      msg = 'Too slow. It got away.';
      endRound();
    } else if (state === 'pause' && t >= waitUntil) {
      if (round >= s.rounds) return end();
      msg = '';
      nextRound();
    }
  }
  render();
}

function render() {
  const s = spec!;
  const t = now();
  const field = $('mg-field');
  let html = '';
  if (s.kind === 'race') {
    const lane = (name: string, v: number, me = false) =>
      `<div class="mg-lane${me ? ' me' : ''}"><span>${name}</span><b><i style="left:${(v * 100).toFixed(1)}%"></i></b></div>`;
    html = lane(s.you ?? 'You', you, true) + s.rivals.map((r, i) => lane(r.name, rivals[i])).join('');
    $('mg-clock').textContent = `${Math.max(0, Math.ceil(s.seconds - (t - t0)))}s`;
  } else if (s.kind === 'timing') {
    const m = marker(t);
    const pct = s.tries ? `${hits} / ${tries} of ${s.tries}` : `${hits} / ${s.goal}`;
    html = `<div class="mg-meter${t - flash < 0.25 ? ' hit' : ''}"><em style="left:${((0.5 - s.zone / 2) * 100).toFixed(1)}%;width:${(s.zone * 100).toFixed(1)}%"></em><i style="left:${(m * 100).toFixed(1)}%"></i></div><p class="mg-count">${pct}</p>`;
    if (!s.tries) html += `<div class="mg-pole"><i style="height:${((hits / s.goal) * 100).toFixed(0)}%"></i></div>`;
    $('mg-clock').textContent = `${Math.max(0, Math.ceil(s.seconds - (t - t0)))}s`;
  } else {
    html = `<div class="mg-water${state === 'bite' ? ' bite' : ''}"><i></i></div><p class="mg-count">${caught} caught · cast ${Math.min(round + 1, s.rounds)} of ${s.rounds}</p>`;
    $('mg-clock').textContent = '';
  }
  if (field.innerHTML !== html) field.innerHTML = html;
  $('mg-msg').textContent = msg;
}

function end(quit = false) {
  const s = spec;
  if (!s || finished) return;
  finished = true;
  const close = () => {
    spec = null;
    S.game = false;
    $('minigame').hidden = true;
    tryLock();
  };
  if (s.kind === 'race') {
    const place = 1 + rivals.filter(v => v > you).length;
    const won = !quit && place === 1;
    if (won) sfx('cheer');
    msg = quit
      ? 'You drop out.'
      : won
        ? 'You win!'
        : `You come ${['', 'first', 'second', 'third', 'fourth', 'fifth'][place]}.`;
    render();
    setTimeout(() => (close(), s.done({ won, place, progress: you })), 1100);
  } else if (s.kind === 'timing') {
    const won = !quit && hits >= s.goal;
    if (won) sfx('cheer');
    msg = quit
      ? 'You give up.'
      : won
        ? s.tries
          ? 'Great shooting!'
          : 'You made it to the top!'
        : s.tries
          ? 'Good game.'
          : 'Time’s up.';
    render();
    setTimeout(() => (close(), s.done({ won, hits, tries })), 1100);
  } else {
    msg = quit ? 'You pack up.' : caught ? `${caught} fish.` : 'Nothing today.';
    render();
    setTimeout(() => (close(), s.done({ caught, rounds: round })), 900);
  }
}
