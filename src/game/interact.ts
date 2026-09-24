/* What Raka can act on with E: residents (talk) and things in the world (shops,
   his front door, garden pots). Whichever is nearest the centre of view wins. */
import { $ } from '../core/util';
import { player } from '../core/player';
import { S, inWorld } from '../core/state';
import { talkTarget, headPos, wave, type Resident } from '../npc/npcs';
import * as social from '../social/social';
import { openDialogue } from '../ui/dialogue';
import { lineFor } from '../dialogue/provider';
import { bubble, hasBubble } from '../ui/bubbles';
import { addMood } from './stats';

/** Passers-by have no relationship with Raka: a nod, a smile and a one-line greeting. */
const greetedToday = new Map<number, number>();
function greetPasserby(r: Resident) {
  if (hasBubble(r)) return;
  const again = greetedToday.get(r.i) === S.day;
  greetedToday.set(r.i, S.day);
  wave(r, 1.2);
  if (!again) addMood(1);
  void lineFor(r, {
    kind: 'passerby',
    outcome: again ? 'again' : r.npc.age >= 45 ? 'elder' : r.npc.age < 20 ? 'young' : 'adult',
  }).then(text => bubble(r, () => headPos(r), text, 3.5));
}

export interface Interactable {
  x: number;
  z: number;
  /** How close Raka must be, in metres. */
  reach: number;
  /** Prompt text, or null when it can't be used right now (shop closed, nothing to do). */
  label: () => string | null;
  run: () => void;
}
export const interactables: Interactable[] = [];

type Target = { npc: Resident; thing?: undefined } | { thing: Interactable; label: string; npc?: undefined };
let target: Target | null = null;

/** Angle between the camera's forward direction and the direction to (x, z). */
function offAxis(x: number, z: number) {
  const fx = -Math.sin(player.yaw),
    fz = -Math.cos(player.yaw);
  const dx = x - player.x,
    dz = z - player.z,
    d = Math.hypot(dx, dz) || 1e-3;
  return Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d)));
}

export function updateInteraction() {
  target = null;
  if (inWorld()) {
    let best = Infinity;
    const npc = talkTarget(player.yaw);
    if (npc) {
      target = { npc };
      best = offAxis(npc.x, npc.z);
    }
    for (const it of interactables) {
      const d = Math.hypot(it.x - player.x, it.z - player.z);
      if (d > it.reach) continue;
      const a = offAxis(it.x, it.z);
      if (a > (d < 1.2 ? 0.9 : 0.55) || a >= best) continue;
      const label = it.label();
      if (!label) continue;
      target = { thing: it, label };
      best = a;
    }
  }
  const el = $('prompt');
  el.hidden = !target;
  $('ttalk').hidden = !target;
  if (!target) return;
  let text: string;
  if (target.npc?.ambient) text = 'Greet the passer-by';
  else if (target.npc) {
    const met = social.social(target.npc.npc).met;
    text = met ? `Talk to ${social.properName(target.npc.npc)}` : 'Say hello';
  } else text = target.label;
  el.lastElementChild!.textContent = text;
  $('ttalk').textContent = target.npc?.ambient ? 'Greet' : target.npc ? 'Talk' : 'Use';
}

/** E pressed, or the touch button. */
export function interact() {
  if (!target || !inWorld()) return;
  if (target.npc?.ambient) greetPasserby(target.npc);
  else if (target.npc) void openDialogue(target.npc);
  else target.thing.run();
}
