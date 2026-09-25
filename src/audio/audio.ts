/* Sound (spec §2 "Audio", §4 "Ambient life"), all synthesised with Web Audio:
   no files to load. Three buses under a master gain (ambience, effects, UI),
   each with a volume setting.
   - Ambience that follows the time of day and where Raka is: birds by day,
     crickets and the odd tokek at night, the hum of the main road near the
     gapura, water by the kali, rain.
   - World sounds placed in the kampung (volume by distance, panned by
     direction): roosters at dawn, the bedug before each adzan, the ronda's
     kentongan at night, Mas Joko's bowl ("ting ting"), motorbikes on the
     jalan, murmur from neighbours chatting.
   - Raka's footsteps, and UI sounds (clicks, coins, messages, dialogue blips).
   The context starts on the first click (browsers require a gesture). */
import { S, inWorld } from '../core/state';
import { SETTINGS } from '../core/settings';
import { player } from '../core/player';

let ctx: AudioContext | null = null;
let master: GainNode, amb: GainNode, fx: GainNode, ui: GainNode;
let noise: AudioBuffer;

/** Create the audio graph (call from a user gesture). */
export function startAudio() {
  if (ctx) {
    void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
  } catch (e) {
    return;
  }
  master = ctx.createGain();
  master.connect(ctx.destination);
  // Ambience goes through a filter that muffles the outdoors when Raka is inside.
  muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.value = 18000;
  muffle.connect(master);
  // A short synthetic room echo for effects indoors.
  room = ctx.createConvolver();
  room.buffer = roomImpulse(ctx);
  roomSend = ctx.createGain();
  roomSend.gain.value = 0;
  roomSend.connect(room).connect(master);
  amb = ctx.createGain();
  amb.connect(muffle);
  fx = bus();
  fx.connect(roomSend);
  ui = bus();
  // Two seconds of white noise, reused by every noisy sound.
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  beds();
  applyVolume();
}
let muffle: BiquadFilterNode, room: ConvolverNode, roomSend: GainNode;
/** A small room: half a second of decaying noise. */
function roomImpulse(c: AudioContext) {
  const len = Math.floor(c.sampleRate * 0.45);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * 0.5;
  }
  return b;
}
/** 0 outside … 1 inside: muffles the outdoors and adds a little room echo. */
export function setIndoor(v: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  muffle.frequency.setTargetAtTime(18000 - v * 17000, t, 0.25);
  roomSend.gain.setTargetAtTime(v * 0.35, t, 0.25);
}
function bus() {
  const g = ctx!.createGain();
  g.connect(master);
  return g;
}
/** Settings changed (or the game paused): set the bus volumes. */
export function applyVolume() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const muted = !S.started || S.paused;
  master.gain.setTargetAtTime(muted ? SETTINGS.volume * 0.25 : SETTINGS.volume, t, 0.2);
  amb.gain.setTargetAtTime(SETTINGS.ambience, t, 0.2);
  fx.gain.setTargetAtTime(SETTINGS.effects, t, 0.2);
  ui.gain.setTargetAtTime(SETTINGS.effects * 0.8, t, 0.2);
}

/* ================= building blocks ================= */

const now = () => ctx!.currentTime;
function env(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
/** A short tone: type, frequency (optionally gliding to f2), attack, decay, level. */
function tone(
  out: AudioNode,
  type: OscillatorType,
  f: number,
  f2: number | null,
  t: number,
  a: number,
  d: number,
  peak: number,
) {
  const o = ctx!.createOscillator(),
    g = ctx!.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
  env(g, t, a, peak, d);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + a + d + 0.05);
}
/** A burst of filtered noise. */
function hiss(
  out: AudioNode,
  type: BiquadFilterType,
  f: number,
  q: number,
  t: number,
  a: number,
  d: number,
  peak: number,
) {
  const s = ctx!.createBufferSource(),
    fl = ctx!.createBiquadFilter(),
    g = ctx!.createGain();
  s.buffer = noise;
  s.loop = true;
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q;
  env(g, t, a, peak, d);
  s.connect(fl).connect(g).connect(out);
  s.start(t, Math.random());
  s.stop(t + a + d + 0.05);
}
/** A sound source placed in the world: returns a panned, distance-scaled input, or null when out of earshot. */
function at(x: number, z: number, range: number, out: AudioNode = fx): AudioNode | null {
  const dx = x - player.x,
    dz = z - player.z,
    d = Math.hypot(dx, dz);
  if (d > range) return null;
  const g = ctx!.createGain();
  g.gain.value = Math.pow(1 - d / range, 1.6);
  const p = ctx!.createStereoPanner();
  // Camera right is (cos yaw, -sin yaw) on the ground.
  const right = (dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)) / (d || 1);
  p.pan.value = Math.max(-0.9, Math.min(0.9, right));
  g.connect(p).connect(out);
  setTimeout(() => g.disconnect(), 8000);
  return g;
}

/* ================= continuous beds ================= */

interface Bed {
  g: GainNode;
  f?: BiquadFilterNode;
}
let traffic: Bed, water: Bed, rain: Bed;
function bed(type: BiquadFilterType, f: number, q: number): Bed {
  const s = ctx!.createBufferSource();
  s.buffer = noise;
  s.loop = true;
  const fl = ctx!.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q;
  const g = ctx!.createGain();
  g.gain.value = 0;
  s.connect(fl).connect(g).connect(amb);
  s.start();
  return { g, f: fl };
}
function beds() {
  traffic = bed('lowpass', 260, 0.7);
  water = bed('bandpass', 900, 0.6);
  rain = bed('highpass', 1400, 0.4);
}

/** 0..1 rain intensity, set by the weather. */
export let rainLevel = 0;
export const setRain = (v: number) => (rainLevel = v);

/* ================= the soundscape, every frame ================= */

let lastT = 0;
let next = { bird: 0, cricket: 0, tokek: 0, bike: 0, rooster: 0, murmur: 0 };
let stepDist = 0,
  lastX = 0,
  lastZ = 0;

/** What the world sounds need to know this frame: how close the roads and the water are (0..1), and
    optional placed sources. */
export function updateAudio(extra: {
  road?: number;
  water?: number;
  bakso?: [number, number] | null;
  chats?: [number, number][];
  ronda?: boolean;
}) {
  if (!ctx) return;
  applyVolumeLazy();
  const t = now();
  const dt = Math.min(0.1, t - lastT);
  lastT = t;
  const hour = (S.time / 60) % 24;
  const live = S.started && !S.paused;
  const day = hour >= 5.5 && hour < 18.5;
  const k = 0.05;
  // Beds: traffic near the roads, water by the sea and the rivers, rain.
  const road = extra.road ?? 0;
  traffic.g.gain.setTargetAtTime(live ? 0.05 + road * 0.22 * (day ? 1 : 0.5) : 0, t, k * 10);
  water.g.gain.setTargetAtTime(live ? (extra.water ?? 0) * 0.12 : 0, t, k * 10);
  rain.g.gain.setTargetAtTime(live ? rainLevel * 0.35 : 0, t, 0.5);
  if (!live) return;
  // Birds by day (busiest at dawn and dusk), not in the rain.
  if (day && rainLevel < 0.3 && t > next.bird) {
    const busy = hour < 9 || hour > 16.5 ? 1 : 0.4;
    next.bird = t + (0.6 + Math.random() * 2.5) / busy;
    bird(t);
  }
  // Crickets and the tokek at night.
  if (!day && t > next.cricket) {
    next.cricket = t + 0.35 + Math.random() * 0.5;
    cricket(t);
  }
  if (!day && hour > 19 && t > next.tokek) {
    next.tokek = t + 40 + Math.random() * 80;
    if (Math.random() < 0.6) tokek(t);
  }
  // Roosters around sunrise.
  if (hour >= 5.8 && hour < 7.2 && t > next.rooster) {
    next.rooster = t + 12 + Math.random() * 25;
    rooster(t, player.x - 30 + Math.random() * 60, player.z - 30 + Math.random() * 60);
  }
  // Motorbikes pass on the roads nearby, fewer at night.
  if (t > next.bike) {
    next.bike = t + (day ? 10 : 30) + Math.random() * 20;
    if (road > 0.3) motorbike(t);
  }
  // Mas Joko's bowl, while his cart is out.
  if (extra.bakso && t > baksoNext) {
    baksoNext = t + 9 + Math.random() * 8;
    const src = at(extra.bakso[0], extra.bakso[1], 45);
    if (src) for (let i = 0; i < 3; i++) ting(src, t + i * 0.22);
  }
  // Murmur from neighbours chatting nearby.
  if (extra.chats?.length && t > next.murmur) {
    next.murmur = t + 0.4 + Math.random() * 0.5;
    const [x, z] = extra.chats[Math.floor(Math.random() * extra.chats.length)];
    const src = at(x, z, 10);
    if (src) hiss(src, 'bandpass', 400 + Math.random() * 500, 4, t, 0.05, 0.25 + Math.random() * 0.2, 0.18);
  }
  // Mbah Minah's old radio, if it's on, and the TV.
  if (radio) radioTick(t);
  if (tv && t > tvNext) {
    tvNext = t + 0.18 + Math.random() * 0.3;
    const src = at(tv[0], tv[1], 14);
    // Voices from a small speaker, and now and then a jingle.
    if (src) {
      hiss(src, 'bandpass', 500 + Math.random() * 700, 5, t, 0.03, 0.15 + Math.random() * 0.2, 0.16);
      if (Math.random() < 0.06)
        for (let i = 0; i < 3; i++) tone(src, 'square', 660 * [1, 1.25, 1.5][i], null, t + i * 0.12, 0.005, 0.1, 0.03);
    }
  }
  // Footsteps.
  if (inWorld()) {
    const moved = Math.hypot(player.x - lastX, player.z - lastZ);
    if (moved < 1) {
      stepDist += moved;
      const stride = player.running ? 1.05 : 0.72;
      if (stepDist > stride) {
        stepDist = 0;
        hiss(fx, 'bandpass', 700 + Math.random() * 300, 1.2, t, 0.005, 0.07, player.running ? 0.12 : 0.07);
      }
    }
  }
  lastX = player.x;
  lastZ = player.z;
  void dt;
}
let baksoNext = 0;

/* ================= the radio ================= */

/** Where the TV is on, or null. */
let tv: [number, number] | null = null;
let tvNext = 0;
export function setTv(at: [number, number] | null) {
  tv = at;
}
/** Where the radio is playing, or null when it's off. */
let radio: [number, number] | null = null;
let radioNext = 0,
  radioStep = 0;
export function setRadio(at: [number, number] | null) {
  radio = at;
  if (at && ctx) radioNext = now();
}
// An old keroncong-ish tune on a small speaker: a D major pentatonic melody over I–IV–V–I, bass on the beat,
// the "cak–cuk" strums on the off-beats.
const SCALE = [293.7, 329.6, 370, 440, 493.9, 587.3];
const MELODY = [0, 2, 3, 4, 3, 2, 0, -1, 1, 2, 4, 5, 4, 3, 2, -1, 4, 5, 4, 3, 2, 3, 1, -1, 0, 1, 2, 1, 0, -1, 0, -1];
const ROOTS = [73.4, 98, 110, 73.4];
function radioTick(t: number) {
  const [rx, rz] = radio!;
  while (radioNext < t + 0.3) {
    const s = radioStep++;
    const t0 = Math.max(radioNext, t + 0.02);
    radioNext = t0 + 0.27;
    const src = at(rx, rz, 16);
    if (!src) continue;
    // A tinny little speaker.
    const f = ctx!.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1300;
    f.Q.value = 0.6;
    f.connect(src);
    const root = ROOTS[Math.floor(s / 8) % 4];
    if (s % 4 === 0) tone(f, 'triangle', root * 2, null, t0, 0.01, 0.35, 0.22);
    if (s % 2 === 1) tone(f, 'square', root * 4 * [1, 1.25, 1.5][s % 3], null, t0, 0.004, 0.07, 0.035);
    const m = MELODY[s % MELODY.length];
    if (m >= 0) tone(f, 'triangle', SCALE[m] * (Math.floor(s / 32) % 2 ? 1 : 2), null, t0, 0.01, 0.24, 0.08);
  }
}
let volKey = '';
function applyVolumeLazy() {
  const k = `${SETTINGS.volume}|${SETTINGS.ambience}|${SETTINGS.effects}|${S.started}|${S.paused}`;
  if (k !== volKey) {
    volKey = k;
    applyVolume();
  }
}

/* ================= voices of the kampung ================= */

function bird(t: number) {
  const src = at(player.x + (Math.random() - 0.5) * 40, player.z + (Math.random() - 0.5) * 40, 40, amb);
  if (!src) return;
  const f = 2600 + Math.random() * 1800;
  const n = 1 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++)
    tone(src, 'sine', f * (1 + Math.random() * 0.1), f * (0.7 + Math.random() * 0.6), t + i * 0.13, 0.01, 0.08, 0.06);
}
function cricket(t: number) {
  const src = at(player.x + (Math.random() - 0.5) * 30, player.z + (Math.random() - 0.5) * 30, 30, amb);
  if (!src) return;
  for (let i = 0; i < 3; i++) tone(src, 'sine', 4300 + Math.random() * 300, null, t + i * 0.045, 0.005, 0.03, 0.035);
}
function tokek(t: number) {
  const src = at(player.x + (Math.random() - 0.5) * 30, player.z + (Math.random() - 0.5) * 30, 35, amb);
  if (!src) return;
  const n = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    tone(src, 'square', 360, 300, t + i * 0.9, 0.01, 0.12, 0.05);
    tone(src, 'square', 250, 200, t + i * 0.9 + 0.2, 0.01, 0.18, 0.05);
  }
}
function rooster(t: number, x: number, z: number) {
  const src = at(x, z, 120, amb);
  if (!src) return;
  // Ku-ku-ru-yuuuk: four syllables, the last long and falling.
  const notes: [number, number, number][] = [
    [520, 600, 0.12],
    [640, 700, 0.12],
    [700, 760, 0.14],
    [780, 520, 0.6],
  ];
  let tt = t;
  for (const [f1, f2, d] of notes) {
    const o = ctx!.createOscillator(),
      g = ctx!.createGain(),
      fl = ctx!.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f1, tt);
    o.frequency.linearRampToValueAtTime(f2, tt + d);
    fl.type = 'bandpass';
    fl.frequency.value = 1400;
    fl.Q.value = 2;
    env(g, tt, 0.02, 0.05, d);
    o.connect(fl).connect(g).connect(src);
    o.start(tt);
    o.stop(tt + d + 0.1);
    tt += d + 0.03;
  }
}
function motorbike(t: number) {
  // Passes along the jalan: louder and higher as it comes, lower as it goes.
  const dist = Math.abs(player.x) + 3;
  const level = Math.max(0, 1 - dist / 30) * 0.12;
  if (level <= 0.005) return;
  const dur = 4 + Math.random() * 2;
  const o = ctx!.createOscillator(),
    fl = ctx!.createBiquadFilter(),
    g = ctx!.createGain(),
    p = ctx!.createStereoPanner();
  o.type = 'sawtooth';
  const base = 70 + Math.random() * 30;
  o.frequency.setValueAtTime(base * 1.15, t);
  o.frequency.linearRampToValueAtTime(base * 1.2, t + dur / 2);
  o.frequency.linearRampToValueAtTime(base * 0.85, t + dur);
  fl.type = 'lowpass';
  fl.frequency.value = 500;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + dur / 2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const dir = Math.random() < 0.5 ? -1 : 1;
  p.pan.setValueAtTime(-0.8 * dir, t);
  p.pan.linearRampToValueAtTime(0.8 * dir, t + dur);
  o.connect(fl).connect(g).connect(p).connect(fx);
  o.start(t);
  o.stop(t + dur + 0.1);
}
function ting(out: AudioNode, t: number) {
  // A spoon on a bowl: a bright tone with a couple of inharmonic partials.
  for (const [f, v] of [
    [2640, 0.12],
    [4020, 0.05],
    [6130, 0.03],
  ])
    tone(out, 'sine', f, null, t, 0.002, 0.5, v);
}
/** The bedug before the adzan: a few deep beats from a mosque at (x, z), then a roll. */
export function bedug(x: number, z: number) {
  if (!ctx) return;
  const t = now();
  const src = at(x, z, 160, amb);
  if (!src) return;
  const beats = [0, 0.9, 1.8, 2.5, 3.0, 3.35, 3.65, 3.9, 4.1, 4.3];
  for (const b of beats) {
    tone(src, 'sine', 95, 45, t + b, 0.005, 0.7, 0.5);
    hiss(src, 'lowpass', 300, 0.7, t + b, 0.002, 0.08, 0.2);
  }
}

/* ================= UI and actions ================= */

export type Sfx =
  | 'click'
  | 'back'
  | 'toast'
  | 'coin'
  | 'msg'
  | 'level'
  | 'good'
  | 'bad'
  | 'cheer'
  | 'tick'
  | 'splash'
  | 'sweep'
  | 'blip'
  | 'doorOpen'
  | 'doorClose'
  | 'sandal'
  | 'knock'
  | 'chime';
/** A short UI or action sound. `pitch` shifts dialogue blips per speaker. */
export function sfx(kind: Sfx, pitch = 1) {
  if (!ctx || !S.started) return;
  const t = now();
  switch (kind) {
    case 'click':
      tone(ui, 'triangle', 900, 700, t, 0.002, 0.05, 0.08);
      break;
    case 'back':
      tone(ui, 'triangle', 600, 450, t, 0.002, 0.06, 0.07);
      break;
    case 'toast':
      tone(ui, 'sine', 880, null, t, 0.005, 0.12, 0.05);
      break;
    case 'coin':
      tone(ui, 'square', 1320, null, t, 0.002, 0.06, 0.04);
      tone(ui, 'square', 1760, null, t + 0.07, 0.002, 0.12, 0.04);
      break;
    case 'msg':
      tone(ui, 'sine', 1175, null, t, 0.005, 0.1, 0.08);
      tone(ui, 'sine', 1568, null, t + 0.09, 0.005, 0.16, 0.08);
      break;
    case 'level':
      [523, 659, 784, 1047].forEach((f, i) => tone(ui, 'triangle', f, null, t + i * 0.09, 0.005, 0.25, 0.08));
      break;
    case 'good':
      tone(ui, 'sine', 660, 990, t, 0.005, 0.18, 0.08);
      break;
    case 'bad':
      tone(ui, 'sine', 300, 180, t, 0.005, 0.22, 0.09);
      break;
    case 'cheer':
      hiss(fx, 'bandpass', 1200, 0.6, t, 0.3, 1.8, 0.25);
      hiss(fx, 'bandpass', 700, 0.8, t + 0.1, 0.3, 1.6, 0.2);
      break;
    case 'tick':
      tone(ui, 'square', 1400, null, t, 0.001, 0.02, 0.03);
      break;
    case 'splash':
      hiss(fx, 'lowpass', 1600, 0.8, t, 0.01, 0.35, 0.25);
      break;
    case 'sweep':
      hiss(fx, 'bandpass', 2400, 0.9, t, 0.05, 0.22, 0.12);
      break;
    case 'blip':
      tone(ui, 'sine', 420 * pitch, null, t, 0.002, 0.04, 0.035);
      break;
    case 'doorOpen':
      // A latch click and a creaking hinge.
      hiss(fx, 'bandpass', 2600, 6, t, 0.002, 0.04, 0.2);
      tone(fx, 'sawtooth', 190, 260, t + 0.05, 0.05, 0.45, 0.025);
      break;
    case 'doorClose':
      tone(fx, 'sine', 110, 60, t, 0.003, 0.18, 0.35);
      hiss(fx, 'lowpass', 900, 0.8, t, 0.002, 0.1, 0.25);
      hiss(fx, 'bandpass', 2600, 6, t + 0.06, 0.002, 0.03, 0.15);
      break;
    case 'knock':
      // Three knuckle raps on a wooden door.
      for (let i = 0; i < 3; i++) {
        tone(fx, 'triangle', 180, 120, t + i * 0.22, 0.002, 0.08, 0.25);
        hiss(fx, 'bandpass', 900, 3, t + i * 0.22, 0.002, 0.04, 0.12);
      }
      break;
    case 'sandal':
      hiss(fx, 'bandpass', 1400, 1.5, t, 0.003, 0.05, 0.12);
      hiss(fx, 'bandpass', 1300, 1.5, t + 0.2, 0.003, 0.05, 0.12);
      break;
    case 'chime':
      // The MRT's three-note chime before an announcement.
      for (const [i, f] of [
        [0, 784],
        [1, 659],
        [2, 523],
      ])
        tone(ui, 'sine', f, null, t + i * 0.28, 0.01, 0.5, 0.16);
      break;
  }
}
