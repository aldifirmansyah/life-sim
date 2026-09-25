/* The calendar (step 8): what happens on which day, from the first weeks on.
   - National Day, 9 August (day 15): flags on the blocks all August; fireworks
     over Marina Bay at 20:15 on the day and at the Saturday previews (1 and 8
     August); Monday 10 August is the holiday in lieu.
   - 17 Agustus (day 23), at the Indonesian embassy off Orchard: the flag
     ceremony at 08:00 (Indonesia Raya, the Merah Putih raised; better in batik)
     and the lomba after, a kerupuk-eating race. Going counts as leave.
   - Hungry Ghost month (days 18–47): a getai stage by Blk 420, shows on Friday
     and Saturday nights, offerings burning by the road.
   - Mid-Autumn (day 62): lanterns at Blk 420's void deck and in Chinatown, a
     lantern walk with the neighbours.
   - The night race round Marina Bay (days 69–71), Deepavali (day 106, the
     holiday on day 107: Serangoon Road's lights, open house at Mr Ravi's) and
     Christmas on Orchard.
   Morning toasts, a line in the goals box, a Calendar on the phone, and the
   people's places on those days (`eventSpot`). */
import * as THREE from 'three';
import { scene } from '../render/context';
import { PropSet } from '../render/props';
import { sign } from '../render/signs';
import { register } from './interact';
import { openPanel, closePanel } from '../ui/panel';
import { toast } from '../ui/hud';
import { startGame } from '../ui/minigame';
import { S } from '../core/state';
import { player } from '../core/player';
import { passTime } from '../core/time';
import { addEnergy, addMood, owned } from './stats';
import { dateOf, shortDate, weekday } from './calendar';
import { markTo } from './marker';
import { goalLines, takeLeave } from './work';
import { EMBASSY, GETAI, HOME_SITES, CT_MARKET, TEKKA, PROMENADE } from '../places/sites';

export const DAY = {
  ndp: 15,
  ndpHoliday: 16,
  merdeka: 23,
  ghostFrom: 18,
  ghostTo: 47,
  midAutumn: 62,
  raceFrom: 69,
  raceTo: 71,
  deepavali: 106,
  deepavaliHoliday: 107,
  christmas: 153,
  newYear: 160,
};
const inRange = (d: number, a: number, b: number) => d >= a && d <= b;
const ghostShow = () =>
  inRange(S.day, DAY.ghostFrom, DAY.ghostTo) &&
  [5, 6].includes(weekday(S.day)) &&
  S.time >= 19.5 * 60 &&
  S.time < 22.5 * 60;
const fireworksDay = (d: number) => d === DAY.ndp || d === 7 || d === 14;
const fireworksNow = () => fireworksDay(S.day) && S.time >= 20.25 * 60 && S.time < 20.6 * 60;
const raceNow = () => inRange(S.day, DAY.raceFrom, DAY.raceTo) && S.time >= 20 * 60 && S.time < 22.5 * 60;

interface CalEvent {
  day: number;
  name: string;
  where: string;
}
const EVENTS: CalEvent[] = [
  { day: 7, name: 'National Day preview: fireworks, 8.15pm', where: 'Marina Bay' },
  { day: 14, name: 'National Day preview: fireworks, 8.15pm', where: 'Marina Bay' },
  { day: DAY.ndp, name: 'National Day: fireworks, 8.15pm', where: 'Marina Bay' },
  { day: DAY.ndpHoliday, name: 'Public holiday (National Day)', where: '' },
  { day: DAY.merdeka, name: '17 Agustus: flag ceremony 8am, lomba after', where: 'Indonesian embassy, off Orchard' },
  { day: DAY.ghostFrom, name: 'Hungry Ghost month begins: getai Fri and Sat nights', where: 'Blk 420' },
  { day: DAY.midAutumn, name: 'Mid-Autumn: lantern walk, 7.30pm', where: 'Blk 420 void deck' },
  { day: DAY.raceFrom, name: 'The night race, three nights', where: 'Marina Bay' },
  { day: DAY.deepavali, name: "Deepavali: open house at Mr Ravi's", where: 'Blk 420, level 7' },
  { day: DAY.deepavaliHoliday, name: 'Public holiday (Deepavali)', where: '' },
  { day: DAY.christmas, name: 'Christmas: public holiday, lights on Orchard', where: 'Orchard Road' },
  { day: DAY.newYear, name: "New Year's Day", where: '' },
];

/** People's places on event days: a spot key, or undefined for their usual plan. */
export function eventSpot(id: string, day: number, t: number): string | undefined {
  if (day === DAY.merdeka && t >= 7.5 * 60 && t < 12.5 * 60) {
    const i = ['dewi', 'bayu', 'ana', 'harun'].indexOf(id);
    if (i >= 0) return `emb.${i}`;
  }
  if (day === DAY.midAutumn && t >= 19.5 * 60 && t < 22 * 60) {
    const i = ['auntymei', 'kokwah', 'jasmine', 'rosnah'].indexOf(id);
    if (i >= 0) return `b.lantern.${i}`;
  }
  if (ghostShow()) {
    const i = ['kokwah', 'rosnah'].indexOf(id);
    if (i >= 0 && day === S.day) return `g.seat.${i}`;
  }
  return undefined;
}

/* ---------- the places ---------- */

let flag: THREE.Mesh;
let flags: PropSet, embassy: PropSet, getai: PropSet, lanterns: PropSet, lights: PropSet;
let fireworks: Fireworks;
const race: THREE.Mesh[] = [];

export function buildEvents() {
  // Flags on Blk 420's corridor all August.
  flags = new PropSet('ndp-flags');
  const B = HOME_SITES.find(h => h.id === 'clementi')!;
  for (let lv = 1; lv < 11; lv++) {
    const y = lv * 2.9 + 1.2;
    for (let x = B.x - B.w / 2 + 3; x < B.x + B.w / 2; x += 9) {
      flags.box(x, x + 0.7, y + 0.25, y + 0.5, B.z + B.d / 2 + 2.12, B.z + B.d / 2 + 2.14, '#d7263d', {
        b: flags.cloth,
      });
      flags.box(x, x + 0.7, y, y + 0.25, B.z + B.d / 2 + 2.12, B.z + B.d / 2 + 2.14, '#ffffff', { b: flags.cloth });
    }
  }
  flags.build();
  buildEmbassy();
  buildGetai();
  // Mid-Autumn lanterns at the void deck and over Chinatown's market.
  lanterns = new PropSet('lanterns');
  for (let k = 0; k < 10; k++) {
    lanterns.light(B.x - 15 + k * 3, 2.9, B.z + B.d / 2 - 0.6, 0.25, ['#ff5a3c', '#ffb03c', '#ff3c7a'][k % 3]);
    lanterns.light(CT_MARKET.x0 + 2 + k * 3.4, 4.2, CT_MARKET.z0 - 2.5, 0.3, ['#ff3c3c', '#ffb03c'][k % 2]);
  }
  lanterns.build();
  // Deepavali lights: arches of little lights along the road by Tekka.
  lights = new PropSet('deepavali');
  for (let a = 0; a < 6; a++) {
    const z = TEKKA.z - 30 + a * 12;
    for (let k = 0; k <= 16; k++) {
      const u = k / 16;
      lights.light(
        TEKKA.x + TEKKA.w / 2 + 6 + (u - 0.5) * 12,
        5 + Math.sin(u * Math.PI) * 3,
        z,
        0.12,
        ['#ffd24f', '#ff7a4f', '#ff4fd8', '#4fd1ff'][k % 4],
      );
    }
  }
  lights.build();
  fireworks = new Fireworks();
  // The night race: lit cars round Marina Boulevard.
  const g = new THREE.BoxGeometry(4, 1, 2);
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ color: ['#e8e4da', '#d7263d', '#2f6fb3', '#f2c14e'][i % 4] }),
    );
    m.visible = false;
    scene.add(m);
    race.push(m);
  }
  // Watching from the promenade.
  register({
    x: PROMENADE.x + 3,
    y: 1.2,
    z: PROMENADE.z + 2,
    reach: 8,
    size: 6,
    label: () => (fireworksNow() ? 'Watch the fireworks' : raceNow() ? 'Watch the night race' : null),
    run: () => {
      const fw = fireworksNow();
      passTime(fw ? 12 : 40, fw ? 'Fireworks over the bay…' : 'Engines echoing off the towers…', () => {
        addMood(fw ? 12 : 8);
        toast(
          fw ? (S.day === DAY.ndp ? 'Happy National Day!' : 'The fireworks preview') : 'The night race',
          fw
            ? 'Red and white bursts over Marina Bay, the whole promenade cheering "Majulah!". Aldi cheers too.'
            : 'Cars screaming round the bay under the lights. Loud, bright, very Singapore.',
          'good',
        );
      });
    },
  });
  goalLines.push(() => {
    const next = EVENTS.find(e => e.day >= S.day && e.day - S.day <= 6);
    if (!next) return null;
    return `${next.day === S.day ? 'Today' : shortDate(next.day)}: ${next.name}${next.where ? ` (${next.where})` : ''}`;
  });
}

function buildEmbassy() {
  const { x, z, w, d } = EMBASSY;
  const p = new PropSet('embassy');
  const x0 = x - w / 2,
    x1 = x + w / 2,
    z0 = z - d / 2,
    z1 = z + d / 2;
  p.box(x0, x1, 0, 0.06, z0, z1, '#cfc8b8');
  // The building at the back, the fence with the gate on the south.
  p.box(x0 + 3, x1 - 3, 0, 9, z0, z0 + 7, '#f1ede2', { col: true });
  p.box(x0 + 2.5, x1 - 2.5, 9, 9.6, z0 - 0.5, z0 + 7.5, '#9c4a34');
  for (const [ax, bx, az, bz] of [
    [x0, x0 + 0.2, z0, z1],
    [x1 - 0.2, x1, z0, z1],
    [x0, x - 3, z1 - 0.2, z1],
    [x + 3, x1, z1 - 0.2, z1],
  ])
    p.box(ax, bx, 0, 1.8, az, bz, '#3a4046', { col: true });
  sign(
    {
      text: 'Kedutaan Besar Republik Indonesia',
      sub: 'Embassy of the Republic of Indonesia',
      w: 8,
      h: 1.2,
      bg: '#1d2b36',
      fg: '#ffffff',
      subfg: '#f2c14e',
      border: '#d7263d',
      font: 'ui',
    },
    x,
    6,
    z0 + 7.1,
    0,
  );
  // The flagpole in the middle of the courtyard.
  p.post(x, z + 2, 0, 12, 0.08, '#d8d4cc');
  p.box(x - 1, x + 1, 0, 0.3, z + 1, z + 3, '#8e969c');
  p.build();
  embassy = p;
  flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.2).translate(0.9, -0.6, 0),
    new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader:
        'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'varying vec2 vUv; void main(){ gl_FragColor = vUv.y > 0.5 ? vec4(0.84, 0.15, 0.24, 1.0) : vec4(1.0); }',
    }),
  );
  flag.position.set(x + 0.08, 12, z + 2);
  scene.add(flag);
  register({
    x,
    y: 1.5,
    z: z + 5,
    reach: 9,
    size: 5,
    label: () =>
      S.day === DAY.merdeka && S.time >= 7.5 * 60 && S.time < 9 * 60 && !done.includes('upacara')
        ? 'Join the flag ceremony (upacara)'
        : S.day === DAY.merdeka && S.time >= 9.5 * 60 && S.time < 12.5 * 60 && !done.includes('lomba')
          ? 'Join the lomba: the kerupuk-eating race'
          : S.day === DAY.merdeka
            ? null
            : 'Indonesian Embassy (consular hours 9am–1pm)',
    run: () => {
      if (S.day !== DAY.merdeka)
        return toast('Kedutaan Besar RI', 'Passports, visas, consular help. On 17 August, everyone comes here.');
      if (S.time < 9 * 60) return ceremony();
      lomba();
    },
  });
}

const done: string[] = [];
function ceremony() {
  done.push('upacara');
  takeLeave(S.day);
  passTime(45, 'Indonesia Raya…', () => {
    const batik = owned.includes('batik');
    addMood(batik ? 20 : 15);
    toast(
      'Dirgahayu Republik Indonesia!',
      `Hundreds in the courtyard, the Merah Putih going up, everyone singing Indonesia Raya. Aldi\'s voice cracks a little.${batik ? ' The batik shirt was the right call.' : ''}`,
      'good',
    );
  });
}
function lomba() {
  done.push('lomba');
  startGame({
    kind: 'race',
    title: 'Lomba makan kerupuk',
    sub: 'Hands behind your back, kerupuk on a string',
    help: 'Mash Space to eat faster!',
    input: 'mash',
    seconds: 12,
    step: 0.045,
    rivals: [
      { name: 'Bayu', speed: 0.07 },
      { name: 'Dewi', speed: 0.065 },
      { name: 'Pak Harun', speed: 0.05 },
    ],
    you: 'Aldi',
    done: r => {
      addMood(r.won ? 12 : 7);
      addEnergy(-3);
      passTime(30, 'Lomba…', () =>
        toast(
          r.won ? 'Juara satu!' : `Place ${r.place}`,
          r.won
            ? 'Aldi wins a hamper of Indonesian snacks and eternal glory.'
            : 'Bayu is unbearable about winning. Next year.',
          'good',
        ),
      );
    },
  });
}

function buildGetai() {
  const { x, z } = GETAI;
  const p = new PropSet('getai');
  p.box(x - 6, x + 6, 0, 1.2, z - 9, z - 3, '#2b2622', { col: true });
  p.box(x - 6, x + 6, 1.2, 7, z - 9.2, z - 9, '#b8342a');
  for (let k = 0; k < 12; k++) p.light(x - 5.5 + k, 6.7, z - 8.9, 0.12, ['#ffd24f', '#ff4fd8', '#4fd1ff'][k % 3]);
  for (let row = 0; row < 4; row++)
    for (let k = -4; k <= 4; k++)
      p.box(x + k * 1.2 - 0.25, x + k * 1.2 + 0.25, 0, 0.45, z + row * 1.8 - 0.25, z + row * 1.8 + 0.25, '#d7263d');
  // Offerings burning in a bin by the path.
  p.put(x + 9, 0.45, z - 2, 0.9, 0.9, 0.9, '#6d757c', 0, p.cyl);
  p.light(x + 9, 1.1, z - 2, 0.35, '#ff7a1f');
  sign(
    {
      text: '中元节 Getai',
      sub: 'Hungry Ghost Festival · Fri & Sat',
      w: 5,
      h: 1,
      bg: '#b8342a',
      fg: '#ffd24f',
      subfg: '#ffffff',
      border: '#ffd24f',
      font: 'ui',
    },
    x,
    7.6,
    z - 8.95,
    0,
  );
  p.build();
  getai = p;
  register({
    x,
    y: 1.5,
    z: z - 5,
    reach: 12,
    size: 6,
    label: () => (ghostShow() && !done.includes(`getai${S.day}`) ? 'Watch the getai show' : null),
    run: () => {
      done.push(`getai${S.day}`);
      passTime(30, 'Getai…', () => {
        addMood(6);
        toast(
          'Getai',
          'Sequins, a live band, Hokkien songs at full volume. The front row stays empty: those seats are for the ghosts.',
          null,
        );
      });
    },
  });
  // The lantern walk at the void deck on Mid-Autumn night.
  const B = HOME_SITES.find(h => h.id === 'clementi')!;
  register({
    x: B.x - 6,
    y: 1,
    z: B.z + 2,
    reach: 8,
    size: 5,
    label: () =>
      S.day === DAY.midAutumn && S.time >= 19.5 * 60 && S.time < 22 * 60 && !done.includes('lanterns')
        ? 'Lantern walk with the neighbours'
        : null,
    run: () => {
      done.push('lanterns');
      passTime(40, 'Lanterns and mooncakes…', () => {
        addMood(10);
        toast(
          'Mid-Autumn',
          'Jasmine with a rabbit lantern, Aunty Mei cutting mooncakes, Uncle Kok Wah pointing out the moon. Like family.',
          'good',
        );
      });
    },
  });
  // Deepavali open house at Mr Ravi's.
  register({
    x: B.x + 8,
    y: B.floor! + 1.2,
    z: B.z + B.d / 2 + 1,
    reach: 4,
    size: 2,
    label: () =>
      S.day === DAY.deepavali && S.time >= 11 * 60 && S.time < 17 * 60 && !done.includes('deepavali')
        ? "Deepavali open house at Mr Ravi's"
        : null,
    run: () => {
      done.push('deepavali');
      passTime(60, 'Murukku, biryani, more biryani…', () => {
        addMood(12);
        addEnergy(15);
        toast(
          'Happy Deepavali!',
          'Oil lamps at the door, kolam on the floor, and Mrs Ravi refusing to let anyone leave hungry.',
          'good',
        );
      });
    },
  });
}

/* ---------- fireworks ---------- */

class Fireworks {
  N = 1200;
  per = 120;
  next = 0;
  geo = new THREE.BufferGeometry();
  mat: THREE.ShaderMaterial;
  pts: THREE.Points;
  t = 0;
  wait = 0;
  constructor() {
    const g = this.geo;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.N * 3), 3));
    g.setAttribute('vel', new THREE.BufferAttribute(new Float32Array(this.N * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.N * 3), 3));
    g.setAttribute('born', new THREE.BufferAttribute(new Float32Array(this.N).fill(-100), 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 vel; attribute vec3 color; attribute float born;
        uniform float time; varying vec3 vC; varying float vA;
        void main() {
          float t = time - born;
          vec3 p = position + vel * t + vec3(0.0, -4.0, 0.0) * t * t;
          vA = t < 0.0 ? 0.0 : clamp(1.0 - t / 2.4, 0.0, 1.0);
          vC = color;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(1400.0 / -mv.z, 1.5, 9.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vC; varying float vA;
        void main() { if (vA <= 0.0) discard; vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard; gl_FragColor = vec4(vC * vA, vA); }`,
    });
    this.pts = new THREE.Points(g, this.mat);
    this.pts.frustumCulled = false;
    this.pts.visible = false;
    scene.add(this.pts);
  }
  burst() {
    const g = this.geo;
    const pos = g.attributes.position as THREE.BufferAttribute,
      vel = g.attributes.vel as THREE.BufferAttribute,
      col = g.attributes.color as THREE.BufferAttribute,
      born = g.attributes.born as THREE.BufferAttribute;
    const cx = 420 + Math.random() * 90,
      cz = 470 + Math.random() * 90,
      cy = 70 + Math.random() * 50;
    const c = new THREE.Color([0xff3040, 0xffffff, 0xffd24f, 0xff4fd8, 0x4fd1ff][Math.floor(Math.random() * 5)]);
    const s = 14 + Math.random() * 8;
    for (let k = 0; k < this.per; k++) {
      const i = this.next * this.per + k;
      const u = Math.random() * 2 - 1,
        a = Math.random() * Math.PI * 2,
        r = Math.sqrt(1 - u * u);
      pos.setXYZ(i, cx, cy, cz);
      vel.setXYZ(i, r * Math.cos(a) * s, u * s, r * Math.sin(a) * s);
      col.setXYZ(i, c.r, c.g, c.b);
      born.setX(i, this.t);
    }
    this.next = (this.next + 1) % (this.N / this.per);
    for (const a of [pos, vel, col, born]) a.needsUpdate = true;
  }
  update(dt: number, on: boolean) {
    this.t += dt;
    this.mat.uniforms.time.value = this.t;
    this.pts.visible = on || this.wait > -3;
    if (!on) {
      this.wait -= dt;
      return;
    }
    this.wait -= dt;
    if (this.wait <= 0) {
      this.burst();
      this.wait = 0.25 + Math.random() * 0.5;
    }
  }
}

/* ---------- every frame ---------- */

let lastMin = -1;
export function updateEvents(dt: number) {
  const d = S.day;
  const { m } = dateOf(d);
  const night = S.time >= 19 * 60;
  flags.show(m === 7 && Math.hypot(player.x - HOME_SITES[0].x, player.z - HOME_SITES[0].z) < 400);
  embassy.show(Math.hypot(player.x - EMBASSY.x, player.z - EMBASSY.z) < 300);
  flag.visible = embassy.visible;
  if (flag.visible) {
    // Raised during the ceremony, at the top otherwise.
    const t = d === DAY.merdeka ? Math.min(1, Math.max(0, (S.time - 8 * 60) / 10)) : 1;
    flag.position.y = 1.5 + t * 10.4;
    flag.rotation.y = Math.sin(performance.now() / 700) * 0.15;
  }
  getai.show(inRange(d, DAY.ghostFrom, DAY.ghostTo) && Math.hypot(player.x - GETAI.x, player.z - GETAI.z) < 300);
  lanterns.show(inRange(d, DAY.midAutumn - 7, DAY.midAutumn + 1) && night);
  lights.show(inRange(d, DAY.deepavali - 20, DAY.deepavali + 5) && S.time >= 18.5 * 60);
  fireworks.update(dt, fireworksNow());
  const rn = raceNow();
  const t = performance.now() / 1000;
  race.forEach((c, i) => {
    c.visible = rn;
    if (!rn) return;
    const pts: [number, number][] = [
      [300, 600],
      [520, 640],
      [620, 520],
      [560, 400],
      [300, 600],
    ];
    const u = (t * 0.04 + i / race.length) % 1;
    const seg = Math.floor(u * 4),
      f = u * 4 - seg;
    const [ax, az] = pts[seg],
      [bx, bz] = pts[seg + 1];
    c.position.set(ax + (bx - ax) * f, 0.6, az + (bz - az) * f);
    c.rotation.y = Math.atan2(-(bz - az), bx - ax);
  });
  // Morning toasts and the marker on the big days.
  const mm = Math.floor(S.time);
  if (mm !== lastMin) {
    lastMin = mm;
    if (mm === 6 * 60 + 5) {
      const e = EVENTS.find(e => e.day === d);
      if (e) toast(e.name, e.where || 'Enjoy the day.', 'msg');
    }
  }
  if (
    d === DAY.merdeka &&
    S.time >= 6.5 * 60 &&
    S.time < 12.5 * 60 &&
    !(done.includes('upacara') && done.includes('lomba'))
  )
    markTo('17 Agustus', [EMBASSY.x, 1.5, EMBASSY.z + 5]);
  if (fireworksDay(d) && S.time >= 19.5 * 60 && S.time < 20.6 * 60)
    markTo('Fireworks', [PROMENADE.x, 1.5, PROMENADE.z]);
}

/** The phone's Calendar: the next month. */
export function calendarApp() {
  const next = EVENTS.filter(e => e.day >= S.day && e.day - S.day <= 45);
  openPanel({
    title: 'Calendar',
    sub: `Today: ${shortDate(S.day)}`,
    body: next.length ? undefined : 'Nothing special coming up.',
    rows: [
      ...next.map(e => ({ label: e.name, note: shortDate(e.day), run: () => closePanel() })),
      { label: 'Close', run: () => closePanel() },
    ],
  });
}

export const saveEvents = () => [...done];
export function loadEvents(d: string[] | undefined) {
  done.length = 0;
  done.push(...(d ?? []));
}
