/* Global game state. `time` is in game-minutes since midnight of the current day
   and runs from 06:00 to 26:00 (02:00 the next morning). */
export const S = {
  time: 7 * 60,
  day: 1,
  started: false,
  paused: true,
  map: false,
  /** Talking to someone. */
  dialog: false,
  /** The phone is open. */
  phone: false,
  /** An activity panel is open. */
  panel: false,
  sleeping: false,
  /** A mini-game has the keyboard. */
  game: false,
  /** Busy with an animated action; input and movement wait. */
  acting: false,
  /** Sitting down: Aldi can look around; E stands up. */
  seated: false,
  locked: false,
  lastZone: '',
  /** The room Aldi is in, or '' outdoors. */
  room: '',
  /** The interior Aldi is inside (its name), or '' outdoors. */
  inside: '',
  /** Multiplies the clock rate (riding the MRT runs the clock faster). */
  clockScale: 1,
};

/** An overlay that owns the mouse and keyboard is open (the world keeps rendering behind it). */
export const inMenu = () => S.paused || S.map || S.dialog || S.phone || S.panel || S.game;
/** Aldi can walk around and time runs. */
export const inWorld = () => S.started && !inMenu() && !S.sleeping && !S.acting;
