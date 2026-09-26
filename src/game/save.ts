/* Save and load (one slot in localStorage): where Aldi is, the day and the time,
   the wallet, cards, energy and mood, the arrival goals, the serviced apartment, the job. Each module with game state will add a saveX()/loadX() pair here as
   it arrives (see docs/singapore-plan.md). Older versions load with the missing parts at their defaults; newer ones are ignored. */
import { resnapShutters } from '../places/shutters';
import { S } from '../core/state';
import { player } from '../core/player';
import { dateLabel } from './calendar';
import { saveStats, loadStats } from './stats';
import { saveArrival, loadArrival } from './arrival';
import { saveOneNorth, loadOneNorth } from '../places/onenorth';
import { saveWork, loadWork } from './work';
import { saveHomes, loadHomes } from '../places/homes';
import { savePeople, loadPeople } from '../npc/people';
import { saveCentre, loadCentre } from '../places/centre';
import { saveEvents, loadEvents } from './events';
import { saveRegions, loadRegions } from '../places/regions';
import { saveCar, loadCar } from './car';

const KEY = 'sg-save';
const VERSION = 3;

export function saveGame(): boolean {
  // Not while riding: a saved game resumes on solid ground.
  if (player.ride || !S.started) return false;
  const d = {
    v: VERSION,
    day: S.day,
    time: S.time,
    p: { x: player.x, z: player.z, y: player.y, yaw: player.yaw },
    stats: saveStats(),
    arrival: saveArrival(),
    onenorth: saveOneNorth(),
    work: saveWork(),
    homes: saveHomes(),
    people: savePeople(),
    faith: saveCentre(),
    events: saveEvents(),
    regions: saveRegions(),
    car: saveCar(),
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
    return d && d.v >= 2 && d.v <= VERSION ? d : null;
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
  loadStats(d.stats);
  loadArrival(d.arrival);
  loadOneNorth(d.onenorth);
  loadWork(d.work);
  loadHomes(d.homes);
  loadPeople(d.people);
  resnapShutters();
  loadCentre(d.faith);
  loadEvents(d.events);
  loadRegions(d.regions);
  loadCar(d.car);
  return true;
}
export function deleteSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* storage unavailable */
  }
}
