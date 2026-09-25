/* Global game state. `time` is in game-minutes since midnight of the current day
   and runs from 06:00 to 26:00 (02:00 the next morning). */
export const S = {
  time: 7 * 60,
  day: 1,
  started: false,
  paused: true,
  map: false,
  /** Talking to a resident. */
  dialog: false,
  /** The phone (Contacts, Glossary) is open. */
  phone: false,
  /** An activity panel (shop, home, garden, warung shift) is open. */
  panel: false,
  sleeping: false,
  /** A mini-game (lomba, futsal, fishing) has the keyboard. */
  game: false,
  /** Raka is busy with an animated action (paying, sitting, eating); input and movement wait. */
  acting: false,
  locked: false,
  lastZone: '',
  /** The room Raka is in ("Rumah Raka · Dapur"), or '' outdoors. */
  room: '',
  /** The interior Raka is inside (its name), or '' outdoors. */
  inside: '',
};
export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** An overlay that owns the mouse and keyboard is open (the world keeps rendering behind it). */
export const inMenu = () => S.paused || S.map || S.dialog || S.phone || S.panel || S.game;
/** Raka can walk around and time runs. */
export const inWorld = () => S.started && !inMenu() && !S.sleeping && !S.acting;
