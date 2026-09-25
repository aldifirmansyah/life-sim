/* The arrival: the first goals after landing, shown in the goals box, with a marker
   over the next place to go. Buy a SIM and an EZ-Lah card at 8-Twelve, see the Rain
   Vortex (optional), ride the East-West Line to Buona Vista, check in at the
   serviced apartment in one-north. Places register their marker spots with
   `setTarget`; they report goals with `markDone`. */
import * as THREE from 'three';
import { $ } from '../core/util';
import { S } from '../core/state';
import { player } from '../core/player';
import { camera } from '../render/context';
import { toast } from '../ui/hud';
import { sfx } from '../audio/audio';
import { EWL, PLAT_OUT } from '../city/mrtdata';
import { stationAt } from '../city/trains';

export type GoalId = 'cards' | 'jool' | 'mrt' | 'checkin';
const GOALS: { id: GoalId; text: string; optional?: boolean }[] = [
  { id: 'cards', text: 'Buy a SIM card and an EZ-Lah card at 8-Twelve' },
  { id: 'jool', text: 'See the Rain Vortex at Jool', optional: true },
  { id: 'mrt', text: 'Take the East-West Line to Buona Vista' },
  { id: 'checkin', text: 'Check in at one-north Residences' },
];
const done = new Set<GoalId>();
let finished = false;
const targets: Partial<Record<GoalId, [number, number, number]>> = {};
export const setTarget = (id: GoalId, at: [number, number, number]) => (targets[id] = at);

/** The foot of the Changi Airport station's stairs on the hall's side, and Buona Vista's platforms. */
{
  const st = EWL.stations[0];
  const qx = -st.dz,
    qz = st.dx;
  const side = qz < 0 ? 1 : -1; // the side toward the terminal (−z)
  const d = PLAT_OUT + EWL.stair + 1;
  targets.mrt = [st.x + qx * side * d, 1, st.z + qz * side * d];
}
const bv = EWL.stations.find(s => s.name === 'Buona Vista')!;

export function markDone(id: GoalId) {
  if (done.has(id) || finished) return;
  done.add(id);
  sfx('good');
  render();
  if (GOALS.every(g => g.optional || done.has(g.id))) finish();
}
function finish() {
  finished = true;
  setTimeout(() => {
    toast(
      'Wei Jie (Chopee): Welcome to Singapore!',
      'Settled in already? Rest today lah. Monday 10am, Science Park Drive, I bring you round for onboarding.',
      'msg',
    );
    render();
  }, 2500);
}

function render() {
  const el = $('goals');
  if (finished || !S.started) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = '<b>Arrival</b>';
  for (const g of GOALS) {
    const s = document.createElement('span');
    s.textContent = g.text + (g.optional ? ' (optional)' : '');
    if (done.has(g.id)) s.className = 'done';
    el.appendChild(s);
  }
}

const _v = new THREE.Vector3();
/** Every frame: check the MRT goal, and put the marker over the next place. */
export function updateArrival() {
  const m = $('marker');
  if (finished || !S.started) {
    m.hidden = true;
    return;
  }
  if (!done.has('mrt')) {
    const at = stationAt(player.x, player.z, player.y);
    if (at?.st === bv && !player.ride) markDone('mrt');
  }
  const next = GOALS.find(g => !g.optional && !done.has(g.id));
  let t = next ? targets[next.id] : undefined;
  if (next?.id === 'mrt' && (player.ride || stationAt(player.x, player.z, player.y)))
    t = player.ride ? undefined : [bv.x, EWL.floor + 1, bv.z];
  if (!t || S.map || S.paused) {
    m.hidden = true;
    return;
  }
  // Project the spot onto the screen; off-screen or behind, pin it to the edge.
  const p = _v.set(t[0], t[1] + 2, t[2]).project(camera);
  const behind = p.z > 1;
  let sx = (p.x * 0.5 + 0.5) * innerWidth,
    sy = (-p.y * 0.5 + 0.5) * innerHeight;
  if (behind) {
    sx = innerWidth - sx;
    sy = innerHeight - 40;
  }
  sx = Math.max(40, Math.min(innerWidth - 40, sx));
  sy = Math.max(60, Math.min(innerHeight - 40, sy));
  const dist = Math.hypot(t[0] - player.x, t[2] - player.z);
  m.hidden = false;
  m.querySelector('span')!.textContent =
    `${next!.id === 'cards' ? '8-Twelve' : next!.id === 'mrt' ? (stationAt(player.x, player.z, player.y) ? 'Buona Vista' : 'MRT') : 'one-north Residences'} · ${Math.round(dist)} m`;
  m.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
}

export const arrivalDone = () => finished;
export function startArrival() {
  render();
}
export const saveArrival = () => ({ done: [...done], finished });
export function loadArrival(d: { done: GoalId[]; finished: boolean } | undefined) {
  done.clear();
  if (d) {
    d.done.forEach(g => done.add(g));
    finished = d.finished;
  }
  render();
}
