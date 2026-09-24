/* A general-purpose menu panel for activities: shops, home, cooking, the
   garden. Numbered rows (keys 1–8, or click), 9 for more, Esc to go back. */
import { $ } from '../core/util';
import { S } from '../core/state';
import { keys } from '../core/player';
import { tryLock } from './overlays';

export interface Row {
  label: string;
  /** Right-aligned detail: price, time, what you have. */
  note?: string;
  /** Why it can't be chosen right now. */
  disabled?: string;
  run: () => void;
}
export interface PanelSpec {
  title: string;
  sub?: string;
  /** A line of text above the rows: what just happened, or a description. */
  body?: string;
  rows: Row[];
  /** Esc goes here; closes the panel when absent. */
  back?: () => void;
  /** Keep the current page when re-rendering the same list (e.g. after buying). */
  keepPage?: boolean;
  /** Called when the panel is finally closed (not when it hides for an animation). */
  onClose?: () => void;
}

const PER_PAGE = 8;
let spec: PanelSpec | null = null;
let page = 0;

export function openPanel(p: PanelSpec) {
  if (!S.panel) {
    S.panel = true;
    keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  if (!p.keepPage) page = 0;
  // Leaving one menu for another counts as closing it (e.g. a shop's keeper goes back to work).
  if (spec && spec !== p) spec.onClose?.();
  spec = p;
  render();
  $('panel').hidden = false;
}

/** Close the panel. `final: false` just hides it for an animation that reopens it afterwards. */
export function closePanel(final = true) {
  if (!S.panel) return;
  S.panel = false;
  const s = spec;
  spec = null;
  $('panel').hidden = true;
  if (final) {
    s?.onClose?.();
    tryLock();
  }
}

/** Update the stats line at the bottom (money, energy) from outside. */
export let panelFooter: () => string = () => '';
export function setPanelFooter(f: () => string) {
  panelFooter = f;
}

function render() {
  if (!spec) return;
  $('panel-title').textContent = spec.title;
  $('panel-sub').textContent = spec.sub ?? '';
  const body = $('panel-body');
  body.textContent = spec.body ?? '';
  body.hidden = !spec.body;
  const pages = Math.max(1, Math.ceil(spec.rows.length / PER_PAGE));
  page = Math.min(page, pages - 1);
  const rows = spec.rows.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const ol = $('panel-rows');
  ol.innerHTML = '';
  const addRow = (key: string, r: Row) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.disabled = !!r.disabled;
    b.innerHTML = `<kbd></kbd><span class="pl"></span><span class="pn"></span>`;
    b.querySelector('kbd')!.textContent = key;
    b.querySelector('.pl')!.textContent = r.label;
    b.querySelector('.pn')!.textContent = r.disabled ?? r.note ?? '';
    b.onclick = () => r.run();
    li.appendChild(b);
    ol.appendChild(li);
  };
  rows.forEach((r, i) => addRow(String(i + 1), r));
  if (pages > 1)
    addRow('9', {
      label: `More (${page + 1}/${pages})`,
      run: () => {
        page = (page + 1) % pages;
        render();
      },
    });
  $('panel-foot').textContent = panelFooter();
}

export function panelKey(e: KeyboardEvent) {
  if (!spec) return;
  e.preventDefault();
  if (e.code === 'Escape' || e.code === 'Digit0' || e.code === 'Numpad0') {
    if (spec.back) spec.back();
    else closePanel();
    return;
  }
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (!m) return;
  const buttons = [...$('panel-rows').querySelectorAll('button')];
  const idx = m[1] === '9' ? buttons.length - 1 : +m[1] - 1;
  if (m[1] === '9' && buttons[idx]?.querySelector('kbd')?.textContent !== '9') return;
  const b = buttons[idx];
  if (b && !b.disabled) b.click();
}
