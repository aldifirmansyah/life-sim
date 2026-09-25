/* Singapore — entry point. Generates the island, wires up input and UI, and runs
   the frame loop. The city is generated once as data (city/gen.ts) and streamed
   in around Aldi (city/stream.ts); the MRT runs on its own rail clock
   (city/trains.ts). */
import { $, REDUCED } from './core/util';
import { renderer, scene, camera } from './render/context';
import './render/sky';
import { updateEnv, prewarm } from './render/lighting';
import { buildSigns } from './render/signs';
import { applyQuality, resize } from './render/quality';
import { cols } from './core/collision';
import { SETTINGS } from './core/settings';
import { S, inWorld } from './core/state';
import { player, updatePlayer, applyCamera } from './core/player';
import { advanceTime, resetWake } from './core/time';
import { initInput } from './core/input';
import { updateInteriors } from './interiors/interior';
import { updateAudio } from './audio/audio';
import { updateGame } from './ui/minigame';
import { toast, updateHUD } from './ui/hud';
import { show, play, bindOverlayButtons, bindSettingsUI } from './ui/overlays';
import { saveGame, loadGame, deleteSave, saveInfo } from './game/save';
import { dateLabel } from './game/calendar';
import { generateCity } from './city/gen';
import { buildMrt } from './city/mrtbuild';
import { initStream, updateStream, applyCityFog, liveChunks, pools } from './city/stream';
import { updateTrains, pickStop } from './city/trains';
import { updateFares } from './city/fares';
import { updateInteraction, interact } from './game/interact';
import { startArrival, updateArrival, loadArrival } from './game/arrival';
import { updateWork, openLaptop, loadWork } from './game/work';
import { updateMarker } from './game/marker';
import { buildBuses, updateBuses, busMenu } from './city/buses';
import { buildChopee } from './places/chopee';
import { buildClementi } from './places/clementi';
import { buildCbd, updateCbd } from './places/cbd';
import { buildHomes, updateHomes, homeMarker, homeApp, loadHomes } from './places/homes';
import { openPhone, apps } from './game/phone';
import { buildPeople, updatePeople, contacts, loadPeople, birthdaysToday } from './npc/people';
import { buildCrowds, updateCrowds } from './npc/crowds';
import { buildCentre, loadCentre } from './places/centre';
import { updateNear } from './places/shops';
import { buildEvents, updateEvents, calendarApp, loadEvents } from './game/events';
import { buildWeather, updateWeather } from './game/weather';
import { buildRegions, updateRegions, loadRegions } from './places/regions';
import { buildRoadGraph } from './city/roadgraph';
import { buildTraffic, updateTraffic } from './city/traffic';
import { buildTaxis, updateTaxis, taxiMenu, nabApp } from './game/taxi';
import { buildCar, updateCar, carMenu, carApp, carMarker, loadCar } from './game/car';
import { properName } from './social/social';
import { showMoney, showVitals, resetStats, drain, addEnergy, addMood } from './game/stats';
import { buildChangi, updateChangi, ARRIVAL } from './places/changi';
import { buildOneNorth, loadOneNorth } from './places/onenorth';
import { actions } from './core/input';
import { roadCloseness } from './city/roads';
import { landAt, polyEdgeDist, ISLANDS } from './city/geo';

/* ================= input & UI ================= */
addEventListener('resize', resize);
// E: aboard a bus, ring the bell; aboard a train, choose the stop; otherwise use what's in front.
actions.interact = () => {
  if (player.ride) carMenu() || taxiMenu() || busMenu() || pickStop();
  else interact();
};
// L: the work laptop.
actions.laptop = () => openLaptop();
// P: the phone.
actions.phone = () => openPhone();
bindOverlayButtons();
initInput();
bindSettingsUI();

/* ================= build the island ================= */
const tGen = performance.now();
generateCity();
buildMrt();
buildChangi();
buildOneNorth();
buildChopee();
buildClementi();
buildCbd();
buildHomes();
buildCentre();
buildEvents();
buildRegions();
buildRoadGraph();
buildTraffic();
buildTaxis();
buildCar();
buildWeather();
apps.push({ label: 'HomeLah', note: 'rooms for rent', run: homeApp });
buildPeople();
buildCrowds();
apps.push({ label: 'Contacts', note: 'people you know', run: contacts });
apps.push({ label: 'Calendar', note: "what's on", run: calendarApp });
apps.push({ label: 'Nab', note: 'ride-hail', run: nabApp });
apps.push({ label: 'My car', run: carApp });
buildBuses();
initStream();
const genMs = performance.now() - tGen;

/** A new game: Aldi has just come through immigration at Changi, early on day 1. */
function newGame() {
  player.x = ARRIVAL.x;
  player.z = ARRIVAL.z;
  player.y = 0;
  player.yaw = ARRIVAL.yaw;
  player.pitch = 0;
  S.day = 1;
  S.time = 7 * 60 + 30;
  resetWake();
  resetStats();
  loadArrival(undefined);
  loadOneNorth(undefined);
  loadWork(undefined);
  loadHomes(undefined);
  loadPeople(undefined);
  loadCentre(undefined);
  loadEvents(undefined);
  loadRegions(undefined);
  loadCar(undefined);
}

/** Energy runs down with the hours awake; a night's sleep fills it up. */
let lastTime = -1,
  lastDay = -1;
function vitalsTick() {
  if (!S.started) return;
  if (lastDay >= 0 && S.day > lastDay) {
    addEnergy(100);
    addMood(3);
    for (const p of birthdaysToday())
      toast(`${properName(p.npc)}'s birthday today`, 'A gift would go down well.', 'msg');
  } else if (lastTime >= 0 && S.time > lastTime) drain(S.time - lastTime);
  lastTime = S.time;
  lastDay = S.day;
}

/* ================= loop ================= */
let last = performance.now(),
  fpsA = 60,
  dbgT = 0;
let updMs = 0,
  drawMs = 0;
/** With the overlay on: smoothed ms per part of the update, to see which system costs what. */
const parts = new Map<string, number>();
let lapT = 0;
function lap(name: string) {
  if (!SETTINGS.debug) return;
  const t = performance.now();
  parts.set(name, (parts.get(name) ?? 0) * 0.9 + (t - lapT) * 0.1);
  lapT = t;
}
function loop(now: number) {
  const t0 = performance.now();
  lapT = t0;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (inWorld()) {
    updatePlayer(dt);
    advanceTime(dt);
  } else if (!S.started && !REDUCED) {
    player.yaw += dt * 0.03;
    player.pitch = 0.02 + Math.sin(now * 0.00007) * 0.03;
  }
  lap('player');
  updateTrains(dt);
  lap('trains');
  updateBuses(dt);
  updateRegions(dt);
  updateTaxis(dt);
  updateCar();
  lap('vehicles');
  if (S.started) {
    updatePeople(dt);
    updateCrowds(dt);
    updateTraffic(dt);
  }
  lap('people');
  updateStream(player.x, player.z);
  lap('stream');
  applyCamera();
  updateInteriors(dt);
  updateChangi(dt);
  updateCbd();
  updateNear(player.x, player.z);
  updateEvents(dt);
  updateFares();
  updateInteraction();
  if (S.started) {
    updateArrival();
    updateHomes();
    homeMarker();
    carMarker();
    updateWork();
    vitalsTick();
  }
  updateMarker();
  lap('places');
  const water =
    landAt(player.x, player.z) === 'sea' ? 1 : Math.max(0, 1 - polyEdgeDist(ISLANDS.main, player.x, player.z) / 40);
  updateAudio({ road: roadCloseness(player.x, player.z), water });
  updateEnv((S.time / 60) % 24);
  updateWeather(dt);
  lap('env+sound');
  if (S.started) updateHUD();
  updateGame();
  lap('hud');
  const t1 = performance.now();
  renderer.render(scene, camera);
  const t2 = performance.now();
  updMs += (t1 - t0 - updMs) * 0.1;
  drawMs += (t2 - t1 - drawMs) * 0.1;
  fpsA += (1 / Math.max(dt, 1e-3) - fpsA) * 0.05;
  if (SETTINGS.debug && (dbgT += dt) > 0.25) {
    dbgT = 0;
    const i = renderer.info.render;
    const inst = Object.values(pools)
      .map(p => p.live)
      .reduce((a, b) => a + b, 0);
    $('debug').textContent =
      `fps      ${fpsA.toFixed(0)}\ndraws    ${i.calls}\ntris     ${(i.triangles / 1000).toFixed(1)}k\njs       ${updMs.toFixed(2)} update · ${drawMs.toFixed(2)} render ms\n` +
      `parts    ${[...parts]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, v]) => `${k} ${v.toFixed(2)}`)
        .join(' · ')}\n` +
      `chunks   ${liveChunks()} loaded · ${inst} instances\ncolliders ${cols.length}\n` +
      `pos      ${player.x.toFixed(1)}, ${player.y.toFixed(1)}, ${player.z.toFixed(1)}\nquality  ${['low', 'medium', 'high'][SETTINGS.quality]}\ngen      ${genMs.toFixed(0)} ms`;
  }
  requestAnimationFrame(loop);
}

async function start() {
  // Signs are drawn to canvas textures, so wait (briefly) for the web fonts.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('64px "Shrikhand"'), document.fonts.load('800 64px "Figtree"')]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch (e) {
    /* draw with fallbacks */
  }
  buildSigns();
  // Energy, mood and money under the clock.
  document.querySelector<HTMLElement>('.vitals')!.hidden = false;
  showMoney();
  showVitals();
  applyQuality();
  applyCityFog();
  // Behind the start screen: the new-game spot, or where the saved game left off.
  if (!(saveInfo() && loadGame())) newGame();
  updateStream(player.x, player.z, 0, true);
  prewarm();
  $('loading').remove();
  show('start', true);
  const info = saveInfo();
  if (info) {
    $('cont').hidden = false;
    $('continfo').hidden = false;
    $('continfo').textContent = `Saved game: ${info.label}`;
    $('go').textContent = 'New game';
    $('go').className = 'ghost';
    $('cont').focus();
  } else $('go').focus();
  requestAnimationFrame(loop);
}

/* ================= new game, continue, saving ================= */

let started = false;
$('go').addEventListener('click', () => {
  if (started) return;
  if (saveInfo() && !confirm('Start a new game? Your saved game will be replaced.')) return;
  started = true;
  deleteSave();
  newGame();
  updateStream(player.x, player.z, 0, true);
  play();
  startArrival();
  toast(
    'Welcome to Singapore',
    'Changi Airport, Sunday morning. Get a SIM card and an EZ-Lah card, then take the MRT.',
  );
});
$('cont').addEventListener('click', () => {
  if (started) return;
  started = true;
  if (!loadGame()) {
    toast('Could not load the saved game', 'Starting a new one instead.');
    newGame();
  } else toast(`Welcome back. ${dateLabel(S.day)}`, 'Your game has been loaded.');
  updateStream(player.x, player.z, 0, true);
  play();
  startArrival();
});
$('savenow').addEventListener('click', () => {
  $('savemsg').textContent = saveGame()
    ? `Saved: ${dateLabel(S.day)}`
    : player.ride
      ? 'You can save once you are off the train.'
      : 'Could not save (storage unavailable).';
});
let discarding = false;
$('newgame').addEventListener('click', () => {
  if (!confirm('Start over from arrival day? Your saved game will be deleted.')) return;
  discarding = true;
  deleteSave();
  location.reload();
});
// Save when the tab is hidden or closed, and every couple of minutes.
addEventListener('pagehide', () => !discarding && saveGame());
document.addEventListener('visibilitychange', () => document.hidden && !discarding && saveGame());
setInterval(() => inWorld() && saveGame(), 120000);
start();

// Dev-only handle for headless checks.
if (import.meta.env.DEV) {
  Promise.all([
    import('./city/geo'),
    import('./city/gen'),
    import('./city/stream'),
    import('./city/trains'),
    import('./city/mrtdata'),
    import('./core/collision'),
    import('./core/levels'),
    import('./city/mrtbuild'),
    import('./core/settings'),
    import('./render/quality'),
    import('./game/stats'),
    import('./places/changi'),
    import('./places/onenorth'),
    import('./game/work'),
    import('./city/buses'),
    import('./places/sites'),
    import('./places/cbd'),
    import('./places/hawker'),
    import('./city/roads'),
    import('./places/homes'),
    import('./npc/people'),
    import('./places/centre'),
    import('./game/events'),
    import('./game/weather'),
    import('./places/regions'),
    import('./game/taxi'),
    import('./city/traffic'),
    import('./city/roadgraph'),
    import('./game/car'),
  ]).then(
    ([
      geo,
      gen,
      stream,
      trains,
      mrt,
      collision,
      levels,
      mrtbuild,
      settings,
      quality,
      stats,
      changi,
      onenorth,
      work,
      buses,
      sites,
      cbd,
      hawker,
      roads,
      homes,
      people,
      centre,
      events,
      weather,
      regions,
      taxi,
      traffic,
      roadgraph,
      car,
    ]) => {
      (window as unknown as Record<string, unknown>).__sg = {
        S,
        player,
        geo,
        gen,
        stream,
        trains,
        mrt,
        collision,
        levels,
        mrtbuild,
        settings,
        quality,
        stats,
        changi,
        onenorth,
        work,
        buses,
        sites,
        cbd,
        hawker,
        roads,
        homes,
        people,
        centre,
        events,
        weather,
        regions,
        taxi,
        traffic,
        roadgraph,
        car,
        renderer,
        parts,
        ms: () => ({ upd: updMs, draw: drawMs }),
      };
    },
  );
}
