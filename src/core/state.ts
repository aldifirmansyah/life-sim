/* Global game state. `time` is in game-minutes since midnight of the current day
   and runs from 06:00 to 26:00 (02:00 the next morning). */
export const S = {
  time: 7 * 60,
  day: 1,
  started: false,
  paused: true,
  map: false,
  sleeping: false,
  locked: false,
  lastZone: '',
};
export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
