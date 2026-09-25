/* What Raka can act on with E: residents (talk) and things in the world (shops,
   doors, furniture, garden pots). Whichever is nearest the centre of view wins. */
import { $ } from '../core/util';
import { player } from '../core/player';
import { S, inWorld } from '../core/state';
import { talkTarget, headPos, wave, type Resident } from '../npc/npcs';
import * as social from '../social/social';
import { openDialogue } from '../ui/dialogue';
import { lineFor } from '../dialogue/provider';
import { bubble, hasBubble } from '../ui/bubbles';
import { addMood } from './stats';
import { standUp, seatedAction } from './actions';

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
  /** Height of the thing, for aiming up or down at it (omit for things at about chest height outdoors). */
  y?: number;
  /** Rough radius of the thing when aimed at in 3D: big things (a door) are easier to aim at up close. */
  size?: number;
  /** How close Raka must be, in metres. */
  reach: number;
  /** Where it can be used from: an interior's name (only inside it), '*' (anywhere, e.g. a door), or
      outdoors only when omitted. */
  inside?: string;
  /** Prompt text, or null when it can't be used right now (shop closed, nothing to do). */
  label: () => string | null;
  run: () => void;
}
export const interactables: Interactable[] = [];

type Target = { npc: Resident; thing?: undefined } | { thing: Interactable; label: string; npc?: undefined };
let target: Target | null = null;

/** Angle between the camera's forward direction and the direction to (x, z), or to (x, y, z) in 3D
    (looking up and down counts) when a height is given. */
function offAxis(x: number, z: number, y?: number) {
  if (y === undefined) {
    const fx = -Math.sin(player.yaw),
      fz = -Math.cos(player.yaw);
    const dx = x - player.x,
      dz = z - player.z,
      d = Math.hypot(dx, dz) || 1e-3;
    return Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d)));
  }
  const cp = Math.cos(player.pitch);
  const fx = -Math.sin(player.yaw) * cp,
    fy = Math.sin(player.pitch),
    fz = -Math.cos(player.yaw) * cp;
  const dx = x - player.x,
    dy = y - player.eye,
    dz = z - player.z,
    d = Math.hypot(dx, dy, dz) || 1e-3;
  return Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy + dz * fz) / d)));
}

/** While seated, E stands Raka up (unless he's looking at someone to talk to). */
const standThing: Interactable = { x: 0, z: 0, reach: 0, label: () => 'Stand up', run: () => standUp() };

export function updateInteraction() {
  target = null;
  if (inWorld() && S.seated) {
    const npc = talkTarget(player.yaw);
    const act = seatedAction;
    target = npc
      ? { npc }
      : act
        ? { thing: { x: 0, z: 0, reach: 0, label: act.label, run: act.run }, label: act.label() }
        : { thing: standThing, label: 'Stand up' };
  } else if (inWorld()) {
    let best = Infinity;
    const npc = talkTarget(player.yaw);
    if (npc) {
      target = { npc };
      best = offAxis(npc.x, npc.z);
    }
    for (const it of interactables) {
      if (it.inside !== '*' && (it.inside ?? '') !== S.inside) continue;
      const d = Math.hypot(it.x - player.x, it.z - player.z);
      if (d > it.reach) continue;
      const a = offAxis(it.x, it.z, it.y);
      // Things in 3D need aiming at, more tightly the farther off they are.
      const cone =
        it.y === undefined
          ? d < 1.2
            ? 0.9
            : 0.55
          : 0.2 + Math.atan((it.size ?? 0.2) / Math.max(0.3, Math.hypot(d, it.y - player.eye)));
      if (a > cone || a >= best) continue;
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
