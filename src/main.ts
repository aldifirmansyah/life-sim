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
import { S } from './core/state';
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
import { initWorldNav, initResidents, updateResidents, graphStats, npcStats } from './npc/npcs';
import { updateNpcDebug } from './npc/debug';
import { toast, updateHUD } from './ui/hud';
import { show, bindOverlayButtons, bindSettingsUI } from './ui/overlays';

/* ================= input & UI ================= */
addEventListener('resize', resize);
bindOverlayButtons();
initInput();
bindSettingsUI();

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
ALL_BATCHES.forEach(b => b.build());
buildCables();
initResidents();
graphStats();

/* ================= loop ================= */
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
  if (S.started && !S.paused && !S.map && !S.sleeping) {
    updatePlayer(dt);
    advanceTime(dt);
  } else if (!S.started && !REDUCED) {
    player.yaw = Math.sin(now * 0.00011) * 0.32;
    player.pitch = 0.04 + Math.sin(now * 0.00007) * 0.03;
  }
  // NPCs hold still while paused; on the start screen they idle in place.
  updateResidents(!S.started || (!S.paused && !S.map && !S.sleeping) ? dt : 0);
  applyCamera();
  updateEnv((S.time / 60) % 24);
  if (S.started) updateHUD();
  updateNpcDebug(dt);
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
  ]).then(([npcs, nav, places, collision]) => {
    (window as unknown as Record<string, unknown>).__kampung = { S, player, npcs, nav, places, collision, renderer };
  });
}
