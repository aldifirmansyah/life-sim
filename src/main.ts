/* Kampung — entry point. Builds the world, wires up input and UI, and runs the frame loop.
   Import order matters a little: three.js assigns material ids in creation order, which
   breaks draw-order ties, so the scene objects are created in the prototype's order. */
import { $, REDUCED } from './core/util';
import { renderer, scene, camera } from './render/context';
import { ALL_BATCHES } from './render/batch';
import './render/sky';
import { updateEnv } from './render/lighting';
import { signs } from './render/signs';
import { applyQuality, resize } from './render/quality';
import { cols } from './core/collision';
import { SETTINGS } from './core/settings';
import { S, inWorld } from './core/state';
import { player, updatePlayer, applyCamera } from './core/player';
import { advanceTime } from './core/time';
import { initInput } from './core/input';
import { buildBlocks } from './world/houses';
import { landmarks } from './world/landmarks';
import { blockTrees } from './world/trees';
import { streets, buildCables } from './world/streets';
import { boundaries } from './world/boundaries';
import { pasarPagi } from './world/pasar';
import { ground } from './world/ground';
import { initWorldNav, initResidents, updateResidents, graphStats, npcStats, residents, crowd } from './npc/npcs';
import { updateNpcDebug } from './npc/debug';
import { updateLife } from './social/life';
import { updatePhone, onPhoneChange, plate, inviteToDinner } from './social/phone';
import { buildPlate, showPlate } from './game/plate';
import { saveGame, loadGame, clearSave, saveInfo } from './game/save';
import { beginNewGame, initTutorial, updateTutorial, updateMarker } from './game/tutorial';
import { dateLabel } from './game/calendar';
import { openDialogue } from './ui/dialogue';
import { buildFestival } from './world/festival';
import { updateAudio } from './audio/audio';
import { buildRain, updateWeather } from './game/weather';
import { initEvents, updateEvents } from './game/events';
import { registerPastimes } from './ui/pastimes';
import { buildHouseProps, updateHouse } from './game/house';
import { buildArcProps } from './world/arcprops';
import { initArcs, updateArcs } from './social/arcs';
import { updateBubbles } from './ui/bubbles';
import { updateGame } from './ui/minigame';
import { dailyDecay } from './social/social';
import { updateDialogue } from './ui/dialogue';
import { updateInteraction, interact } from './game/interact';
import { updateStats } from './game/stats';
import { buildGarden, gardenNewDay } from './game/garden';
import { placeVendorStools, vendorCount, initVendors, updateVendors } from './npc/vendors';
import { RESIDENTS } from './npc/roster';
import { initActions, updateActions } from './game/actions';
import { registerActivities } from './ui/activities';
import { buildWarungInterior } from './interiors/warung';
import { buildWarkopInterior, registerWarkop, updateWarkop } from './interiors/warkop';
import { buildMushollaInterior, registerMusholla } from './interiors/musholla';
import { buildBalaiInterior, registerBalai } from './interiors/balai';
import { carveHomes, buildHomeInteriors, updateHomes } from './interiors/homes';
import { registerWarungShop, updateWarungShop } from './interiors/warungshop';
import { initShoppers, updateShoppers, SHOPPER_SLOTS } from './npc/shoppers';
import { buildRakaInterior } from './interiors/raka';
import { updateInteriors } from './interiors/interior';
import { registerHome, updateHome } from './interiors/rakahome';
import { bindPhone } from './ui/contacts';
import { toast, updateHUD } from './ui/hud';
import { show, play, bindOverlayButtons, bindSettingsUI } from './ui/overlays';

/* ================= input & UI ================= */
addEventListener('resize', resize);
bindOverlayButtons();
initInput();
bindSettingsUI();
bindPhone();
$('ttalk').onclick = interact;

/* ================= build world =================
   Every step draws from the seeded RNG; keep this order or the layout changes. */
buildBlocks();
landmarks();
blockTrees();
streets();
boundaries();
pasarPagi();
ground();
// NPC places and the waypoint graph; homes without a teras bench get stools, so this comes before the batches are built.
initWorldNav();
// Residents' homes are hollowed out now that it's known which houses they are (before the batches are built).
carveHomes();
// Raka's planters go into the static batches too.
buildGarden();
// Stools for the pasar stall-keepers.
placeVendorStools();
ALL_BATCHES.forEach(b => b.build());
buildCables();
// Spare crowd slots after the residents: the pasar stall-keepers, then the warung's shift customers.
initResidents(vendorCount() + SHOPPER_SLOTS);
initVendors(crowd, RESIDENTS.length);
initShoppers(crowd, RESIDENTS.length + vendorCount());
initActions();
buildPlate();
buildFestival();
buildRain();
buildHouseProps();
buildArcProps();
// Walk-in interiors (no R() calls; built after the world so they sit inside the hollow shells).
buildRakaInterior();
const warung = buildWarungInterior();
buildWarkopInterior();
buildMushollaInterior();
buildBalaiInterior();
buildHomeInteriors();
onPhoneChange(() => showPlate(plate?.state === 'waiting'));
registerActivities();
registerHome();
registerWarungShop(warung);
registerWarkop();
registerMusholla();
registerBalai();
initEvents();
initTutorial();
registerPastimes();
initArcs(inviteToDinner);
graphStats();

/* ================= loop ================= */
let decayDay = S.day;
let last = performance.now(),
  fpsA = 60,
  dbgT = 0;
/** Smoothed CPU time per frame: game update, and three.js building the frame (render submit). */
let updMs = 0,
  drawMs = 0;
function loop(now: number) {
  const t0 = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (inWorld()) {
    updatePlayer(dt);
    advanceTime(dt);
  } else if (!S.started && !REDUCED) {
    player.yaw = Math.sin(now * 0.00011) * 0.32;
    player.pitch = 0.04 + Math.sin(now * 0.00007) * 0.03;
  }
  // NPCs hold still while paused; on the start screen they idle in place.
  // NPCs keep living while Raka talks or eats; they hold still while the game is paused.
  const living = !S.started || S.dialog || S.acting || inWorld();
  updateResidents(living ? dt : 0);
  if (S.started && living) {
    updateLife(dt);
    updatePhone(dt);
    updateEvents(dt);
    updateHouse(dt);
    updateArcs(dt);
    updateTutorial(dt, r => void openDialogue(r));
  }
  updateVendors();
  updateShoppers(S.paused ? 0 : dt);
  applyCamera();
  updateInteriors(dt);
  if (S.started) updateHome(dt);
  if (S.started) updateBubbles();
  updateMarker();
  if (S.started) updateWeather(dt);
  soundscape();
  updateEnv((S.time / 60) % 24);
  if (S.started) updateHUD();
  updateNpcDebug(dt);
  updateDialogue(dt);
  updateInteraction();
  if (S.started) {
    updateWarungShop();
    updateWarkop(dt);
    updateHomes(dt);
  }
  updateActions();
  updateGame();
  if (inWorld()) updateStats(dt);
  // Friendships Raka has neglected for a week fade a little each new day.
  if (S.day !== decayDay) {
    decayDay = S.day;
    // Autosave at the end of each day (spec §2).
    if (S.started && saveGame()) setTimeout(() => toast('Game saved', dateLabel(S.day)), 2500);
    dailyDecay(
      residents.map(r => r.npc),
      S.day,
    );
    gardenNewDay(S.day);
  }
  const t1 = performance.now();
  renderer.render(scene, camera);
  const t2 = performance.now();
  updMs += (t1 - t0 - updMs) * 0.1;
  drawMs += (t2 - t1 - drawMs) * 0.1;
  fpsA += (1 / Math.max(dt, 1e-3) - fpsA) * 0.05;
  if (SETTINGS.debug && (dbgT += dt) > 0.25) {
    dbgT = 0;
    const i = renderer.info.render;
    $('debug').textContent =
      `fps      ${fpsA.toFixed(0)}\ndraws    ${i.calls}\ntris     ${(i.triangles / 1000).toFixed(1)}k\njs       ${updMs.toFixed(2)} update · ${drawMs.toFixed(2)} render ms\n` +
      `colliders ${cols.length}\npos      ${player.x.toFixed(1)}, ${player.z.toFixed(1)}\nquality  ${['low', 'medium', 'high'][SETTINGS.quality]}\n` +
      `npcs     ${npcStats.near} near · ${npcStats.mid} mid · ${npcStats.far} far\n         ${npcStats.hidden} indoors/away · ${npcStats.walking} walking\n` +
      `npc sim  ${npcStats.ms.toFixed(2)} ms\ngraph    ${npcStats.nodes} nodes · ${npcStats.edges} edges\nG        waypoint graph`;
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
  signs();
  applyQuality();
  $('loading').remove();
  show('start', true);
  // A saved game can be continued.
  const info = saveInfo();
  if (info) {
    $('cont').hidden = false;
    $('cont').textContent = 'Continue';
    $('continfo').hidden = false;
    $('continfo').textContent = `Saved game: ${info.label}`;
    $('go').textContent = 'New game';
    $('go').className = 'ghost';
    $('cont').focus();
  } else $('go').focus();
  requestAnimationFrame(loop);
}

/* ================= sound ================= */

const chatSpots: [number, number][] = [];
/** What the world sounds need to know this frame: the bakso cart, the ronda, chats nearby. */
function soundscape() {
  const hour = (S.time / 60) % 24;
  const joko = residents.find(r => r.npc.id === 'joko')!;
  const cartOut = joko.state === 'at' && joko.slot.poi.id === 'bakso' && !joko.hidden;
  const ronda = (hour >= 22 || hour < 2) && residents.some(r => r.state === 'at' && r.slot.poi.id === 'ronda');
  chatSpots.length = 0;
  for (const r of residents) if (r.chat && r.dist < 10) chatSpots.push([r.x, r.z]);
  updateAudio({ bakso: cartOut ? [-5.4, 43.85] : null, ronda, chats: chatSpots });
}

/* ================= new game, continue, saving ================= */

let started = false;
$('go').addEventListener('click', () => {
  if (started) return;
  if (saveInfo() && !confirm('Start a new game? Your saved game will be replaced.')) return;
  started = true;
  clearSave();
  beginNewGame($<HTMLInputElement>('skipintro').checked);
  play();
});
$('cont').addEventListener('click', () => {
  if (started) return;
  started = true;
  if (!loadGame()) {
    toast('Could not load the saved game', 'Starting a new one instead.');
    beginNewGame(false);
  } else toast(`Welcome back. ${dateLabel(S.day)}`, 'Your game has been loaded.');
  play();
});
$('savenow').addEventListener('click', () => {
  $('savemsg').textContent = saveGame() ? `Saved: ${dateLabel(S.day)}` : 'Could not save (storage unavailable).';
});
let discarding = false;
$('newgame').addEventListener('click', () => {
  if (!confirm('Start over from the first morning? Your saved game will be deleted.')) return;
  discarding = true;
  clearSave();
  location.reload();
});
// Save when the tab is hidden or closed, and every couple of minutes.
addEventListener('pagehide', () => !discarding && saveGame());
document.addEventListener('visibilitychange', () => document.hidden && !discarding && saveGame());
setInterval(() => inWorld() && saveGame(), 120000);
start();

// Dev-only handle for headless checks (scripts drive time and read NPC state through it).
if (import.meta.env.DEV) {
  Promise.all([
    import('./npc/npcs'),
    import('./npc/navgraph'),
    import('./npc/places'),
    import('./core/collision'),
    import('./game/stats'),
    import('./game/garden'),
    import('./world/landmarks'),
    import('./social/social'),
    import('./social/plans'),
    import('./social/phone'),
    import('./social/arcs'),
    import('./game/events'),
    import('./game/house'),
    import('./game/jobs'),
    import('./social/reputation'),
    import('./dialogue/lines.json'),
    import('./game/interact'),
    import('./game/save'),
    import('./game/tutorial'),
  ]).then(
    ([
      npcs,
      nav,
      places,
      collision,
      stats,
      garden,
      landmarks,
      social,
      plans,
      phone,
      arcs,
      events,
      house,
      jobs,
      reputation,
      lines,
      interact,
      save,
      tutorial,
    ]) => {
      (window as unknown as Record<string, unknown>).__kampung = {
        S,
        player,
        npcs,
        nav,
        places,
        collision,
        stats,
        garden,
        landmarks,
        social,
        plans,
        phone,
        arcs,
        events,
        house,
        jobs,
        reputation,
        lines: lines.default,
        interact,
        save,
        tutorial,
        renderer,
      };
    },
  );
}
