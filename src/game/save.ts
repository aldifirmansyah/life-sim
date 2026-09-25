/* Save and load (one slot in localStorage). For now: where Aldi is, the day and
   the time. Each module with game state will add a saveX()/loadX() pair here as
   it arrives (see docs/singapore-plan.md). A version mismatch is ignored. */
import { S } from '../core/state';
import { player } from '../core/player';
import { dateLabel } from './calendar';

const KEY = 'sg-save';
const VERSION = 1;

export function saveGame(): boolean {
  // Not while riding: a saved game resumes on solid ground.
  if (player.ride || !S.started) return false;
  const d = {
    v: VERSION,
    day: S.day,
    time: S.time,
    p: { x: player.x, z: player.z, y: player.y, yaw: player.yaw },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch (e) {
    return false;
  }
}
function read() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    return d && d.v === VERSION ? d : null;
  } catch (e) {
    return null;
  }
}
export function saveInfo() {
  const d = read();
  return d ? { label: dateLabel(d.day) } : null;
}
export function loadGame(): boolean {
  const d = read();
  if (!d) return false;
  S.day = d.day;
  S.time = d.time;
  Object.assign(player, { x: d.p.x, z: d.p.z, y: d.p.y, yaw: d.p.yaw, pitch: 0 });
  return true;
}
export function deleteSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* storage unavailable */
  }
}
