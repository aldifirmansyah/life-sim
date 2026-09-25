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
import { buildFestival } from './world/festival';
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
import { registerActivities, updateActivities } from './ui/activities';
import { bindPhone } from './ui/contacts';
import { toast, updateHUD } from './ui/hud';
import { show, bindOverlayButtons, bindSettingsUI } from './ui/overlays';

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
// Raka's planters go into the static batches too.
buildGarden();
// Stools for the pasar stall-keepers.
placeVendorStools();
ALL_BATCHES.forEach(b => b.build());
buildCables();
initResidents(vendorCount());
initVendors(crowd, RESIDENTS.length);
initActions();
buildPlate();
buildFestival();
buildHouseProps();
buildArcProps();
onPhoneChange(() => showPlate(plate?.state === 'waiting'));
registerActivities();
initEvents();
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
  }
  updateVendors();
  applyCamera();
  if (S.started) updateBubbles();
  updateEnv((S.time / 60) % 24);
  if (S.started) updateHUD();
  updateNpcDebug(dt);
  updateDialogue(dt);
  updateInteraction();
  updateActivities();
  updateActions();
  updateGame();
  if (inWorld()) updateStats(dt);
  // Friendships Raka has neglected for a week fade a little each new day.
  if (S.day !== decayDay) {
    decayDay = S.day;
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

let toastIntro = false;
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
  $('go').focus();
  toastIntro = true;
  requestAnimationFrame(loop);
}
$('go').addEventListener('click', () => {
  if (toastIntro) {
    toastIntro = false;
    setTimeout(
      () =>
        toast('Pasar pagi is open', 'Vegetable stalls line Jalan Sukamaju until 09:30. Rumah Raka is on Gang Mawar.'),
      600,
    );
  }
});
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
        renderer,
      };
    },
  );
}
