/* The calendar. Day 1 is Sunday 26 July, the day Aldi lands at Changi, so
   National Day (9 August) is day 15 and 17 Agustus (Indonesia's independence
   day, at the embassy) day 23. */

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const LENGTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Day 1's date: Sunday 26 July. */
const START = { d: 26, m: 6 };

/** Day of the week: 0 Sunday … 6 Saturday. */
export const weekday = (day: number) => (day - 1) % 7;
export const isWeekend = (day: number) => weekday(day) === 0 || weekday(day) === 6;

/** The date of a game day. */
export function dateOf(day: number) {
  let d = START.d + day - 1,
    m = START.m;
  while (d > LENGTH[m]) {
    d -= LENGTH[m];
    m = (m + 1) % 12;
  }
  return { d, m, month: MONTHS[m] };
}
/** "Sunday, 26 July" */
export const dateLabel = (day: number) => {
  const { d, month } = dateOf(day);
  return `${DAYS[weekday(day)]}, ${d} ${month}`;
};
/** "Sun 26 Jul" for compact lists. */
export const shortDate = (day: number) => {
  const { d, month } = dateOf(day);
  return `${DAYS[weekday(day)].slice(0, 3)} ${d} ${month.slice(0, 3)}`;
};

/** Public holidays (no stand-ups): National Day's Monday in lieu, Deepavali's, Christmas, New Year. */
export const HOLIDAYS = [16, 107, 153, 160];
export const isHoliday = (day: number) => HOLIDAYS.includes(day);
