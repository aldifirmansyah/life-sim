/* A tiny event bus: things Raka does (a warung shift, a harvest, turning up to
   kerja bakti) are announced here so story arcs, odd jobs and reputation can
   react without every activity knowing about them. */
export type GameEvent =
  | 'shift'
  | 'cook'
  | 'harvest'
  | 'jog'
  | 'freelance'
  | 'kerja'
  | 'pengajian'
  | 'arisan'
  | 'lomba'
  | 'stage'
  | 'restore'
  | 'fish'
  | 'guitar'
  | 'futsal'
  | 'ronda'
  | 'plan_met'
  | 'gift'
  | 'buy';

type Fn = (detail?: string) => void;
const subs = new Map<GameEvent, Fn[]>();
export function on(e: GameEvent, fn: Fn) {
  if (!subs.has(e)) subs.set(e, []);
  subs.get(e)!.push(fn);
}
export function emit(e: GameEvent, detail?: string) {
  for (const fn of subs.get(e) ?? []) fn(detail);
}
