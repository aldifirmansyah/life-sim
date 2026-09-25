/* Keyboard, mouse (pointer lock with drag-to-look fallback) and touch input. */
import { $, clamp, TOUCH } from './util';
import { S, inMenu, inWorld } from './state';
import { SETTINGS, saveSettings } from './settings';
import { player, keys, joy, look } from './player';
import { canvas } from '../render/context';
import { show, tryLock, pause, openMap, closeMap } from '../ui/overlays';
import { panelKey } from '../ui/panel';
import { gameKey } from '../ui/minigame';

/** What E does in the world (set by the game). */
export const actions = { interact: () => {}, skip: () => {}, laptop: () => {}, phone: () => {} };

export function initInput() {
  document.addEventListener('pointerlockchange', () => {
    const was = S.locked;
    S.locked = document.pointerLockElement === canvas;
    if (!S.locked && was && S.started && !inMenu()) pause();
  });
  canvas.addEventListener('click', () => {
    if (S.started && !inMenu() && !S.locked) tryLock();
  });
  let drag: { x: number; y: number } | null = null;
  canvas.addEventListener('mousedown', e => {
    if (!S.locked) drag = { x: e.clientX, y: e.clientY };
  });
  addEventListener('mouseup', () => (drag = null));
  addEventListener('mousemove', e => {
    if (!S.started || inMenu() || S.acting) return;
    const k = 0.0022 * SETTINGS.sens;
    if (S.locked) {
      player.yaw -= e.movementX * k;
      player.pitch -= e.movementY * k;
    } else if (drag) {
      player.yaw -= (e.clientX - drag.x) * k * 1.4;
      player.pitch -= (e.clientY - drag.y) * k * 1.4;
      drag = { x: e.clientX, y: e.clientY };
    }
    player.pitch = clamp(player.pitch, -1.45, 1.45);
  });
  addEventListener('keydown', e => {
    if (e.code === 'F3' || e.code === 'Backquote') {
      e.preventDefault();
      SETTINGS.debug = !SETTINGS.debug;
      $<HTMLInputElement>('dbg').checked = SETTINGS.debug;
      show('debug', SETTINGS.debug);
      saveSettings();
      return;
    }
    if (!S.started) {
      if (e.code === 'Enter') ($('cont').hidden ? $('go') : $('cont')).click();
      return;
    }
    // Paying, sitting, eating: Esc skips to the end, everything else waits.
    if (S.acting) {
      if (e.code === 'Escape') actions.skip();
      e.preventDefault();
      return;
    }
    if (S.game) return gameKey(e);
    if (S.panel) return panelKey(e);
    if (e.code === 'Tab') {
      e.preventDefault();
      return;
    }
    if (e.code === 'KeyE' && inWorld()) {
      actions.interact();
      return;
    }
    if (e.code === 'KeyP' && inWorld()) {
      actions.phone();
      return;
    }
    if (e.code === 'KeyL' && inWorld()) {
      actions.laptop();
      return;
    }
    if (e.code === 'KeyM') {
      e.preventDefault();
      S.map ? closeMap() : openMap();
      return;
    }
    if (e.code === 'Escape') {
      if (S.map) {
        closeMap();
      } else if (!S.paused && !S.locked) {
        pause();
      }
      return;
    }
    if (e.code === 'KeyH') {
      $('hint').classList.toggle('gone');
      return;
    }
    if (S.paused || S.map) return;
    if (e.code === 'BracketRight') {
      S.time = Math.min(S.time + 60, 26 * 60 - 1);
    }
    if (e.code === 'BracketLeft') {
      S.time = Math.max(S.time - 60, 6 * 60);
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  if (TOUCH) initTouch();
}

function initTouch() {
  $('keys').hidden = true;
  $('hint').hidden = true;
  $('touchbtns').hidden = false;
  canvas.addEventListener(
    'touchstart',
    e => {
      if (!S.started || inMenu() || S.acting) return;
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && joy.id === null) {
          joy.id = t.identifier;
          joy.ox = t.clientX;
          joy.oy = t.clientY;
          joy.x = joy.y = 0;
          const j = $('joy');
          j.hidden = false;
          j.style.left = t.clientX + 'px';
          j.style.top = t.clientY + 'px';
          $('knob').style.transform = '';
        } else if (look.id === null) {
          look.id = t.identifier;
          look.x = t.clientX;
          look.y = t.clientY;
        }
      }
      e.preventDefault();
    },
    { passive: false },
  );
  canvas.addEventListener(
    'touchmove',
    e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joy.id) {
          let dx = (t.clientX - joy.ox) / 55,
            dy = (t.clientY - joy.oy) / 55;
          const l = Math.hypot(dx, dy);
          if (l > 1) {
            dx /= l;
            dy /= l;
          }
          joy.x = dx;
          joy.y = dy;
          $('knob').style.transform = `translate(${dx * 36}px,${dy * 36}px)`;
        }
        if (t.identifier === look.id) {
          player.yaw -= (t.clientX - look.x) * 0.005 * SETTINGS.sens;
          player.pitch = clamp(player.pitch - (t.clientY - look.y) * 0.005 * SETTINGS.sens, -1.45, 1.45);
          look.x = t.clientX;
          look.y = t.clientY;
        }
      }
      e.preventDefault();
    },
    { passive: false },
  );
  const end = (e: TouchEvent) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        joy.id = null;
        joy.x = joy.y = 0;
        $('joy').hidden = true;
      }
      if (t.identifier === look.id) look.id = null;
    }
  };
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('touchcancel', end);
}
