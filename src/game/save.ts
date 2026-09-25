/* Save and load (spec §2: localStorage, a single slot, autosave at the end of
   each in-game day). Every module with game state has its own save/load pair;
   this file gathers them into one versioned JSON blob. Residents' positions
   aren't saved: they are placed from their schedules on load, and today's
   event plans are made again. */
import { S } from '../core/state';
import { player } from '../core/player';
import { residents, resync } from '../npc/npcs';
import { saveStats, loadStats } from './stats';
import { saveGarden, loadGarden } from './garden';
import { saveEvents, loadEvents } from './events';
import { saveHouse, loadHouse } from './house';
import { saveJobs, loadJobs } from './jobs';
import { saveSocial, loadSocial } from '../social/social';
import { savePlans, loadPlans } from '../social/plans';
import { savePhone, loadPhone } from '../social/phone';
import { saveRep, loadRep } from '../social/reputation';
import { saveArcs, loadArcs } from '../social/arcs';
import { saveMinah, loadMinah } from '../social/minah';
import { saveWarung, loadWarung } from '../interiors/warungshop';
import { saveHome, loadHome } from '../interiors/rakahome';
import { saveTutorial, loadTutorial } from './tutorial';
import { dateLabel } from './calendar';

const KEY = 'kampung-save';
const VERSION = 1;

function snapshot() {
  const npcs = residents.map(r => r.npc);
  return {
    v: VERSION,
    savedAt: Date.now(),
    day: S.day,
    time: S.time,
    player: { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch },
    stats: saveStats(),
    garden: saveGarden(),
    social: saveSocial(npcs),
    plans: savePlans(),
    phone: savePhone(),
    events: saveEvents(),
    house: saveHouse(),
    jobs: saveJobs(),
    rep: saveRep(),
    arcs: saveArcs(),
    minah: saveMinah(),
    warung: saveWarung(),
    home: saveHome(),
    tutorial: saveTutorial(),
  };
}
type Save = ReturnType<typeof snapshot>;

function read(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Save;
    return d && d.v === VERSION ? d : null;
  } catch (e) {
    return null;
  }
}

/** What the start screen shows for Continue, or null when there's no save. */
export function saveInfo() {
  const d = read();
  if (!d) return null;
  const hh = String(Math.floor(d.time / 60) % 24).padStart(2, '0'),
    mm = String(Math.floor(d.time % 60)).padStart(2, '0');
  return { label: `${dateLabel(d.day)}, ${hh}:${mm}`, day: d.day };
}

/** Write the save. Returns false if storage isn't available (private mode, full). */
export function saveGame() {
  if (!S.started) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot()));
    return true;
  } catch (e) {
    return false;
  }
}

/** Load the save into the running (freshly built) game. */
export function loadGame() {
  const d = read();
  if (!d) return false;
  try {
    S.day = d.day;
    S.time = d.time;
    Object.assign(player, d.player);
    loadStats(d.stats);
    loadGarden(d.garden);
    loadSocial(
      d.social,
      residents.map(r => r.npc),
    );
    loadRep(d.rep);
    loadMinah(d.minah);
    loadArcs(d.arcs);
    loadHouse(d.house);
    loadJobs(d.jobs);
    loadPhone(d.phone);
    loadEvents(d.events);
    loadWarung(d.warung ?? (d as { activities?: { shiftDay?: number } }).activities);
    loadHome(d.home);
    loadTutorial(d.tutorial);
    // Plans last: they lay blocks over schedules for the (now loaded) day.
    loadPlans(d.plans);
    resync();
    return true;
  } catch (e) {
    console.error('Could not load the save', e);
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* storage unavailable */
  }
}
