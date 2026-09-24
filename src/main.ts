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
ALL_BATCHES.forEach(b => b.build());
buildCables();

/* ================= loop ================= */
let last = performance.now(),
  fpsA = 60,
  dbgT = 0;
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.started && !S.paused && !S.map && !S.sleeping) {
    updatePlayer(dt);
    advanceTime(dt);
  } else if (!S.started && !REDUCED) {
    player.yaw = Math.sin(now * 0.00011) * 0.32;
    player.pitch = 0.04 + Math.sin(now * 0.00007) * 0.03;
  }
  applyCamera();
  updateEnv((S.time / 60) % 24);
  if (S.started) updateHUD();
  renderer.render(scene, camera);
  fpsA += (1 / Math.max(dt, 1e-3) - fpsA) * 0.05;
  if (SETTINGS.debug && (dbgT += dt) > 0.25) {
    dbgT = 0;
    const i = renderer.info.render;
    $('debug').textContent =
      `fps      ${fpsA.toFixed(0)}\ndraws    ${i.calls}\ntris     ${(i.triangles / 1000).toFixed(1)}k\ncolliders ${cols.length}\npos      ${player.x.toFixed(1)}, ${player.z.toFixed(1)}\nquality  ${['low', 'medium', 'high'][SETTINGS.quality]}`;
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
