/* The calendar. Day 1 is Senin 3 Agustus, so 17 Agustus (Independence Day, the
   kampung's biggest festival) falls on day 15, a Monday. Weekly and monthly
   community events hang off the day of the week and the date. */
import { DAYS } from '../core/state';

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const LENGTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Day 1's date: 3 Agustus. */
const START = { d: 3, m: 7 };

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
/** "Senin, 3 Agustus" */
export const dateLabel = (day: number) => {
  const { d, month } = dateOf(day);
  return `${DAYS[day % 7]}, ${d} ${month}`;
};
/** "3 Agu" for compact lists. */
export const shortDate = (day: number) => {
  const { d, month } = dateOf(day);
  return `${DAYS[day % 7].slice(0, 3)} ${d} ${month.slice(0, 3)}`;
};

export const isFestival = (day: number) => {
  const { d, m } = dateOf(day);
  return d === 17 && m === 7;
};
/** The week before 17 Agustus: flags and bunting go up. */
export const festivalSeason = (day: number) => {
  const { d, m } = dateOf(day);
  return (m === 7 && d >= 8 && d <= 24) || isFestival(day);
};
/** Stage and lomba props stand from two days before until the day after. */
export const festivalBuild = (day: number) => {
  const { d, m } = dateOf(day);
  return m === 7 && d >= 15 && d <= 18;
};
export const isKerjaBakti = (day: number) => day % 7 === 0;
export const isPengajian = (day: number) => day % 7 === 4;
/** Arisan: the second Saturday of the month. */
export const isArisan = (day: number) => day % 7 === 6 && dateOf(day).d >= 8 && dateOf(day).d <= 14;
