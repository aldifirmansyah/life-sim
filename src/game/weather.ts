/* Weather (spec §5): an occasional tropical downpour in the afternoon, 20–40
   game-minutes. The sky greys and dims, rain streaks fall around Raka, and it
   hisses. Neighbours caught out in the open (the lapangan, the kali, the pasar,
   the bridge…) run for shelter under the warung, the pos ronda or the warkop,
   or go home, which bunches people together for a chat. */
import { player } from '../core/player';
import * as THREE from 'three';
import { mulberry32 } from '../core/util';
import { S } from '../core/state';
import { scene, camera } from '../render/context';
import { setOvercast } from '../render/lighting';
import { residents, setPlan, todayBlocks, type Resident } from '../npc/npcs';
import { groups, homes } from '../npc/places';
import { blockIndexAt } from '../npc/schedule';
import { setRain } from '../audio/audio';
import { isFestival, isKerjaBakti } from './calendar';
import { schedulePost } from '../social/phone';
import { toast } from '../ui/hud';

const h = (hh: number, mm = 0) => hh * 60 + mm;

/** Today's shower, if any: start and end in game-minutes. */
export function showerOn(day: number): { start: number; end: number } | null {
  if (isFestival(day)) return null;
  const rnd = mulberry32(day * 7121 + 99);
  if (rnd() > 0.35) return null;
  const start = Math.round(h(13, 30) + rnd() * 210);
  const end = start + Math.round(20 + rnd() * 20);
  if (isKerjaBakti(day) && start < h(9, 30)) return null;
  return { start, end };
}

/** 0..1 now: ramps in over 5 minutes and out over 8. */
export function rainNow() {
  const r = showerOn(S.day);
  if (!r) return 0;
  const t = S.time;
  if (t < r.start || t > r.end + 8) return 0;
  const up = Math.min(1, (t - r.start) / 5);
  const down = t > r.end ? 1 - (t - r.end) / 8 : 1;
  return Math.max(0, Math.min(up, down));
}

/* ================= streaks ================= */

const N = 1400;
const BOX = 24;
let mesh: THREE.LineSegments;
const uniforms = { time: { value: 0 }, cam: { value: new THREE.Vector3() }, level: { value: 0 } };

export function buildRain() {
  const pos = new Float32Array(N * 2 * 3);
  const rnd = mulberry32(5150);
  for (let i = 0; i < N; i++) {
    const x = rnd() * BOX,
      y = rnd() * BOX,
      z = rnd() * BOX;
    pos.set([x, y, z, x, y, z], i * 6);
  }
  const end = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) end[i * 2 + 1] = 1;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('tail', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float tail;
      uniform float time; uniform vec3 cam; uniform float level;
      varying float vA;
      void main() {
        // Wrap each drop into a box that travels with the camera, falling fast and slightly slanted.
        vec3 p = position;
        p.y = mod(p.y - time * 14.0, ${BOX.toFixed(1)});
        p.x = mod(p.x - cam.x + time * 1.2, ${BOX.toFixed(1)}) + cam.x - ${(BOX / 2).toFixed(1)};
        p.z = mod(p.z - cam.z, ${BOX.toFixed(1)}) + cam.z - ${(BOX / 2).toFixed(1)};
        p.y += cam.y - ${(BOX / 2).toFixed(1)} + 4.0;
        p.y += tail * 0.55;
        p.x -= tail * 0.05;
        // Only a share of the drops show in a light shower.
        vA = step(fract(position.x * 7.13 + position.z * 3.7), level) * 0.45;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying float vA;
      void main() { if (vA <= 0.0) discard; gl_FragColor = vec4(0.78, 0.82, 0.88, vA); }`,
  });
  mesh = new THREE.LineSegments(g, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
}

/* ================= sheltering ================= */

/** Places in the open: people there get wet. */
const EXPOSED = ['lapangan', 'bridge', 'kali', 'kebun', 'pasar', 'fest', 'kerja', 'ojek', 'balai.board', 'bakso'];
const exposed = (loc: string) => EXPOSED.some(e => loc === e || loc.startsWith(e + '.') || loc.startsWith(`#${e}`));
const SHELTERS = ['warung.bench', 'warung.customer', 'ronda.seat', 'warkop.seat', 'meja.seat'];

function shelterFor(r: Resident) {
  let best = 'home.inside',
    bd = Infinity;
  const home = homes.get(r.def.household)!.entry[0];
  const dHome = Math.hypot(home[0] - r.x, home[1] - r.z);
  for (const loc of SHELTERS) {
    const p = groups.get(loc.split('.')[0])?.[0];
    if (!p) continue;
    const d = Math.hypot(p.entry[0][0] - r.x, p.entry[0][1] - r.z);
    if (d < bd) {
      bd = d;
      best = loc;
    }
  }
  // Home if it's about as close as anywhere else.
  return dHome < bd * 1.3 ? 'home.inside' : best;
}

let shelteredDay = -1;
function takeShelter(until: number) {
  shelteredDay = S.day;
  for (const r of residents) {
    if (r.hidden || r.talking) continue;
    const b = todayBlocks(r);
    const cur = b[blockIndexAt(b, S.time)];
    if (!exposed(cur.location) && r.state !== 'walk') continue;
    if (r.state === 'walk' && !exposed(b[r.block].location)) continue;
    setPlan(r, S.day, { start: S.time + 1, end: until, location: shelterFor(r), activity: 'chat' });
  }
}

/* ================= every frame ================= */

let announced = -1;
export function updateWeather(dt: number) {
  const level = rainNow();
  setOvercast(Math.min(1, level * 1.2));
  setRain(level);
  uniforms.level.value = level;
  uniforms.time.value += dt;
  uniforms.cam.value.copy(camera.position);
  // No streaks inside a house (the rain box follows the camera); the sound carries on, muffled.
  mesh.visible = level > 0.02 && !player.indoor;
  const r = showerOn(S.day);
  if (r && S.time >= r.start && S.time < r.end && announced !== S.day) {
    announced = S.day;
    toast('Hujan!', 'A tropical downpour. Neighbours run for cover under the warung and the pos ronda.');
    schedulePost(S.time + 1, ['sri', 'ratna', 'yati', 'endang'][S.day % 4], 'rain');
  }
  if (r && S.time >= r.start && S.time < r.end && shelteredDay !== S.day) takeShelter(r.end + 6);
}
