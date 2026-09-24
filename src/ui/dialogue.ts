/* Conversation UI (spec §8.3, §10): the [E] prompt, and the dialogue panel with
   typewriter text and numbered choices (click or 1–6). Rules live in
   social/social.ts; the words come from the DialogueProvider. */
import { $ } from '../core/util';
import { S } from '../core/state';
import { player, keys } from '../core/player';
import { residents, talkTarget, heading, placeName, headPos, type Resident } from '../npc/npcs';
import type { NPC, Topic } from '../npc/types';
import type { DialogueContext, DialogueProvider } from '../dialogue/types';
import { TemplateDialogueProvider, TOPIC_LABEL, firstName, timeGreeting } from '../dialogue/template';
import LINES from '../dialogue/lines.json';
import * as social from '../social/social';
import { drawPortrait } from './portrait';
import { toast } from './hud';
import { tryLock } from './overlays';

/** Swap this for an LLM-backed provider later; it only ever words lines. */
export const provider: DialogueProvider = new TemplateDialogueProvider();
const lines = LINES as unknown as Record<string, string[]>;
const stories = (npc: NPC) => lines[`npc.${npc.id}.story`] ?? [];

/** Game-minutes each exchange takes. */
const EXCHANGE_MIN = 3;
const CPS = 55; // typewriter characters per second

interface Choice {
  label: string;
  note?: string;
  run: () => void | Promise<void>;
}
interface Conversation {
  r: Resident;
  npc: NPC;
  startStage: NPC['playerRelationship']['stage'];
  net: number;
  choices: Choice[];
  back: (() => void) | null;
  busy: boolean;
}
let conv: Conversation | null = null;
/** The line being typed out; it runs on wall-clock time, not the (capped) frame delta. */
let typing: { full: string; start: number; done: () => void } | null = null;
let target: Resident | null = null;

/* ================= prompt ================= */

/** Every frame: find who Raka is looking at, and steer the camera while talking. */
export function updateDialogue(dt: number) {
  if (conv) {
    // Gently turn to face the resident's head.
    const [x, y, z] = headPos(conv.r);
    const dx = x - player.x,
      dz = z - player.z;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(y - 1.62, Math.hypot(dx, dz));
    let d = yaw - player.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const k = Math.min(1, dt * 4);
    player.yaw += d * k;
    player.pitch += (pitch - player.pitch) * k;
    if (typing) {
      const shown = ((performance.now() - typing.start) / 1000) * CPS;
      $('dlg-text').textContent = typing.full.slice(0, Math.floor(shown));
      if (shown >= typing.full.length) finishTyping();
    }
  }
  const canTalk = S.started && !S.paused && !S.map && !S.phone && !S.dialog && !S.sleeping;
  target = canTalk ? talkTarget(player.yaw) : null;
  const el = $('prompt');
  el.hidden = !target;
  $('ttalk').hidden = !target;
  if (target) {
    const met = social.social(target.npc).met;
    el.lastElementChild!.textContent = met ? `Talk to ${social.properName(target.npc)}` : 'Say hello';
  }
}

/** E pressed in the world. */
export function tryTalk() {
  if (target && !conv) void open(target);
}

/* ================= panel ================= */

function ctx(c: Conversation, part: Partial<DialogueContext> & Pick<DialogueContext, 'kind'>): DialogueContext {
  const npc = c.npc;
  return {
    npc,
    stage: npc.playerRelationship.stage,
    mood: npc.mood,
    memories: npc.playerRelationship.memories,
    time: S.time,
    day: S.day,
    location: placeName(c.r),
    heading: heading(c.r) ?? undefined,
    ...part,
  };
}

async function say(c: Conversation, part: Partial<DialogueContext> & Pick<DialogueContext, 'kind'>) {
  const line = await provider.getLine(ctx(c, part));
  const text = $('dlg-text');
  text.dataset.emote = line.emote ?? 'neutral';
  renderChoices([]);
  c.r.speaking = true;
  await new Promise<void>(done => {
    typing = { full: line.text, start: performance.now(), done };
  });
  c.r.speaking = false;
}
function finishTyping() {
  if (!typing) return;
  $('dlg-text').textContent = typing.full;
  const t = typing;
  typing = null;
  t.done();
}

function renderHeader(c: Conversation) {
  const npc = c.npc;
  const st = social.social(npc);
  const rel = npc.playerRelationship;
  $('dlg-name').textContent = st.met ? npc.name : 'Neighbour';
  $('dlg-sub').textContent = st.met ? npc.occupation : '';
  const strained = rel.friendship < 0;
  const stage = $('dlg-stage');
  stage.textContent = strained ? 'strained' : rel.stage;
  stage.classList.toggle('bad', strained);
  renderHearts($('dlg-hearts'), rel.friendship);
  drawPortrait($<HTMLCanvasElement>('dlg-portrait'), npc.appearance, c.r.i, !st.met);
}

/** Five hearts, each 20 friendship points; filled in quarters. */
export function renderHearts(el: HTMLElement, friendship: number) {
  if (el.childElementCount !== 5) el.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
  const f = Math.max(0, friendship);
  [...el.children].forEach((h, i) => {
    const fill = Math.max(0, Math.min(1, (f - i * 20) / 20));
    (h as HTMLElement).style.setProperty('--fill', `${Math.round(fill * 4) * 25}%`);
  });
  el.setAttribute('aria-label', `Friendship ${friendship} of 100`);
}

function renderChoices(list: Choice[]) {
  if (conv) conv.choices = list;
  const ol = $('dlg-choices');
  ol.innerHTML = '';
  list.forEach((ch, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<kbd>${i + 1}</kbd><span></span>${ch.note ? '<small></small>' : ''}`;
    b.querySelector('span')!.textContent = ch.label;
    if (ch.note) b.querySelector('small')!.textContent = ch.note;
    b.onclick = () => choose(i);
    li.appendChild(b);
    ol.appendChild(li);
  });
}

function choose(i: number) {
  const c = conv;
  if (!c || c.busy) return;
  const ch = c.choices[i];
  if (!ch) return;
  c.busy = true;
  Promise.resolve(ch.run()).finally(() => {
    if (conv === c) c.busy = false;
  });
}

/** Keys while talking: 1–6 pick, Esc goes back or says goodbye, E / Space / Enter skip the typing. */
export function dialogKey(e: KeyboardEvent) {
  e.preventDefault();
  if (typing && ['KeyE', 'Space', 'Enter', 'NumpadEnter', 'Escape'].includes(e.code)) return finishTyping();
  const m = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
  if (m) return choose(+m[1] - 1);
  if (e.code === 'Escape' && conv && !conv.busy && !typing) {
    const c = conv;
    if (c.back) c.back();
    else {
      c.busy = true;
      void goodbye(c);
    }
  }
}

/** Show a floating "+3" by the hearts. */
function float(delta: number, capped: boolean) {
  const el = document.createElement('span');
  el.className = 'dlg-float' + (delta < 0 ? ' bad' : '');
  el.textContent = capped ? 'enough for today' : `${delta > 0 ? '+' : ''}${delta} ♥`;
  $('dlg-floats').appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

function apply(c: Conversation, delta: number) {
  S.time = Math.min(S.time + EXCHANGE_MIN, 26 * 60 - 2);
  if (delta === 0) return;
  const ch = social.befriend(c.npc, delta, S.day);
  c.net += ch.delta;
  if (ch.delta !== 0 || delta > 0) float(ch.delta, delta > 0 && ch.delta === 0);
  renderHeader(c);
}

async function open(r: Resident) {
  const c: Conversation = {
    r,
    npc: r.npc,
    startStage: r.npc.playerRelationship.stage,
    net: 0,
    choices: [],
    back: null,
    busy: true,
  };
  conv = c;
  S.dialog = true;
  r.talking = true;
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  $('prompt').hidden = true;
  $('dialog').hidden = false;
  renderHeader(c);
  const npc = c.npc;
  const g = social.greetingKind(npc, S.day, r.state === 'walk');
  await say(c, { kind: g.kind, outcome: g.outcome, topic: g.topic });
  if (g.kind === 'intro') {
    social.meet(npc, S.day);
    renderHeader(c);
  }
  c.busy = false;
  if (social.social(npc).greetedDay !== S.day) greetMenu(c);
  else mainMenu(c);
}

/** Etiquette: greet with the right title (Pak, Bu, Mas, Mbak, Dek…) or just their first name. */
function greetMenu(c: Conversation) {
  const npc = c.npc;
  const word = { Pagi: 'pagi', Siang: 'siang', Sore: 'sore', Malam: 'malam' }[timeGreeting(S.time)];
  const reply = async (proper: boolean) => {
    const g = social.greet(npc, proper, S.day);
    await say(c, { kind: 'address', outcome: g.outcome });
    apply(c, g.delta);
    mainMenu(c);
  };
  c.back = null;
  renderChoices([
    { label: `“Selamat ${word}, ${social.properName(npc)}.”`, run: () => reply(true) },
    { label: `“${timeGreeting(S.time)}, ${firstName(npc.name)}!”`, run: () => reply(false) },
  ]);
}

function mainMenu(c: Conversation) {
  const npc = c.npc;
  const who = social.properName(npc);
  c.back = null;
  renderChoices([
    { label: 'Chat…', run: () => topicMenu(c, 0) },
    { label: `Ask about ${who}`, run: () => doAsk(c) },
    { label: `Compliment ${who}`, run: () => doSimple(c, 'compliment', social.compliment(npc, S.day)) },
    { label: 'Joke around…', run: () => jokeMenu(c) },
    { label: 'Hear the gossip', run: () => doGossip(c) },
    { label: 'Goodbye', run: () => goodbye(c) },
  ]);
}

const PAGE = 5;
function topicMenu(c: Conversation, page: number) {
  const st = social.social(c.npc);
  const pages = Math.ceil(social.TOPICS.length / PAGE);
  const list: Choice[] = social.TOPICS.slice(page * PAGE, page * PAGE + PAGE).map(t => {
    const label = TOPIC_LABEL[t];
    const notes: string[] = [];
    if (st.known.likes.includes(t)) notes.push('♥ likes');
    if (st.known.dislikes.includes(t)) notes.push('✕ dislikes');
    const last = st.topicDay[t];
    if (last !== undefined && S.day - last < 2) notes.push('talked recently');
    return {
      label: label.charAt(0).toUpperCase() + label.slice(1),
      note: notes.join(' · ') || undefined,
      run: () => doTopic(c, t),
    };
  });
  list.push(
    page + 1 < pages
      ? { label: 'More topics…', run: () => topicMenu(c, page + 1) }
      : { label: 'Back', run: () => mainMenu(c) },
  );
  c.back = () => mainMenu(c);
  renderChoices(list);
}

function jokeMenu(c: Conversation) {
  const npc = c.npc;
  c.back = () => mainMenu(c);
  renderChoices([
    { label: 'Tell a joke', run: () => doSimple(c, 'joke', social.joke(npc, S.day)) },
    { label: `Tease ${social.properName(npc)}`, run: () => doSimple(c, 'tease', social.tease(npc, S.day)) },
    { label: 'Back', run: () => mainMenu(c) },
  ]);
}

async function doTopic(c: Conversation, t: Topic) {
  const res = social.chat(c.npc, t, S.day);
  await say(c, { kind: res.kind, topic: t });
  apply(c, res.delta);
  mainMenu(c);
}

async function doAsk(c: Conversation) {
  const res = social.ask(c.npc, S.day, stories(c.npc));
  await say(c, {
    kind: res.kind,
    topic: 'topic' in res ? res.topic : undefined,
    detail: 'detail' in res ? res.detail : undefined,
  });
  apply(c, res.delta);
  mainMenu(c);
}

async function doSimple(
  c: Conversation,
  kind: 'compliment' | 'joke' | 'tease',
  res: { outcome: string; delta: number },
) {
  await say(c, { kind, outcome: res.outcome });
  apply(c, res.delta);
  mainMenu(c);
}

async function doGossip(c: Conversation) {
  const res = social.gossip(c.npc, S.day, id => residents.some(r => r.npc.id === id));
  const other = res.other ? residents.find(r => r.npc.id === res.other)?.npc : undefined;
  await say(c, { kind: 'gossip', outcome: res.outcome, other });
  apply(c, res.delta);
  mainMenu(c);
}

async function goodbye(c: Conversation) {
  await say(c, { kind: 'bye', outcome: social.byeKind(c.npc) });
  await new Promise(r => setTimeout(r, 650));
  close(c);
}

function close(c: Conversation) {
  finishTyping();
  conv = null;
  S.dialog = false;
  c.r.talking = false;
  c.r.speaking = false;
  $('dialog').hidden = true;
  const npc = c.npc;
  const after = npc.playerRelationship.stage;
  const up = social.stageRank(after) - social.stageRank(c.startStage);
  const plural: Record<string, string> = {
    stranger: 'strangers again',
    acquaintance: 'acquaintances',
    friend: 'friends',
    'close friend': 'close friends',
    'best friend': 'best friends',
  };
  if (up > 0)
    toast(`You and ${npc.name} are now ${plural[after]}`, 'Check your Contacts (Tab) to see what you know about them.');
  else if (up < 0) toast(`${npc.name} is cooling on you`, 'Maybe give it a day, and mind your manners.');
  else if (c.net > 0) toast(`${npc.name} likes you more`);
  else if (c.net < 0) toast(`${npc.name} seems put off`);
  tryLock();
}

/** Close the panel without the goodbye line (e.g. when the game pauses). */
export function endDialogue() {
  if (conv) close(conv);
}
