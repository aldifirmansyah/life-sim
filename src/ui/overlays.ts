/* Start screen, pause menu (with settings) and map overlay. */
import { $, TOUCH } from '../core/util';
import { S } from '../core/state';
import { keys } from '../core/player';
import { SETTINGS, saveSettings } from '../core/settings';
import { canvas } from '../render/context';
import { applyQuality } from '../render/quality';
import { resetAmbients } from '../npc/npcs';
import { drawMap } from './map';

export function show(id: string, on: boolean) {
  $(id).hidden = !on;
}
export function tryLock() {
  if (TOUCH) return;
  try {
    const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    /* not allowed */
  }
}

export function play() {
  S.started = true;
  S.paused = false;
  S.map = false;
  show('start', false);
  show('pause', false);
  show('mapview', false);
  show('hud', true);
  tryLock();
  canvas.focus();
}
export function pause() {
  if (!S.started) return;
  S.paused = true;
  keys.clear();
  show('pause', true);
  show('mapview', false);
  S.map = false;
  if (document.pointerLockElement) document.exitPointerLock();
}
export function openMap() {
  if (!S.started) return;
  S.map = true;
  keys.clear();
  show('mapview', true);
  show('pause', false);
  if (document.pointerLockElement) document.exitPointerLock();
  requestAnimationFrame(drawMap);
}
export function closeMap() {
  S.map = false;
  show('mapview', false);
  S.paused = false;
  tryLock();
}

export function bindOverlayButtons() {
  $('resume').onclick = play;
  $('openmap').onclick = openMap;
  $('closemap').onclick = closeMap;
  $('tmap').onclick = openMap;
  $('tpause').onclick = pause;
}

export function bindSettingsUI() {
  document.querySelectorAll<HTMLElement>('#qseg button').forEach(
    b =>
      (b.onclick = () => {
        SETTINGS.quality = +b.dataset.q!;
        saveSettings();
        applyQuality();
        // The number of passers-by follows the quality setting.
        resetAmbients();
      }),
  );
  const sens = $<HTMLInputElement>('sens'),
    bob = $<HTMLInputElement>('bob'),
    dbg = $<HTMLInputElement>('dbg');
  sens.value = String(SETTINGS.sens);
  sens.oninput = () => {
    SETTINGS.sens = +sens.value;
    saveSettings();
  };
  bob.checked = SETTINGS.bob;
  bob.onchange = () => {
    SETTINGS.bob = bob.checked;
    saveSettings();
  };
  dbg.checked = SETTINGS.debug;
  show('debug', SETTINGS.debug);
  dbg.onchange = () => {
    SETTINGS.debug = dbg.checked;
    show('debug', SETTINGS.debug);
    saveSettings();
  };
}
