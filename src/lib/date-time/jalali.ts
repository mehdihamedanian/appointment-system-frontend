/**
 * Jalali (Solar Hijri) <-> Gregorian conversion on plain calendar numbers.
 * Display-only: API values stay Gregorian ISO dates. Based on the Borkowski
 * leap-year breaks used by jalaali-js; valid for Jalali years -61..3177.
 */
export type JalaliDate = { jy: number; jm: number; jd: number };
export type GregorianDate = { gy: number; gm: number; gd: number };

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
] as const;

export const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

function mod(a: number, b: number): number {
  return a - Math.trunc(a / b) * b;
}

export function isSupportedJalaliYear(jy: number): boolean {
  return Number.isInteger(jy) && jy >= BREAKS[0] && jy < BREAKS[BREAKS.length - 1];
}

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  if (!isSupportedJalaliYear(jy)) {
    throw new RangeError(`Unsupported Jalali year: ${jy}`);
  }
  const gy = jy + 621;
  let leapJ = -14;
  let jp: number = BREAKS[0];
  let jump = 0;
  for (let index = 1; index < BREAKS.length; index += 1) {
    const jm = BREAKS[index];
    jump = jm - jp;
    if (jy < jm) {
      break;
    }
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) {
    leapJ += 1;
  }
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) {
    n = n - jump + div(jump + 4, 33) * 33;
  }
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) {
    leap = 4;
  }
  return { leap, gy, march };
}

function gregorianToDayNumber(gy: number, gm: number, gd: number): number {
  let day =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  day = day - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return day;
}

function dayNumberToGregorian(dayNumber: number): GregorianDate {
  let j = 4 * dayNumber + 139361631;
  j = j + div(div(4 * dayNumber + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function jalaliToDayNumber(jy: number, jm: number, jd: number): number {
  const calendar = jalCal(jy);
  return (
    gregorianToDayNumber(calendar.gy, 3, calendar.march) +
    (jm - 1) * 31 -
    div(jm, 7) * (jm - 7) +
    jd -
    1
  );
}

function dayNumberToJalali(dayNumber: number): JalaliDate {
  const { gy } = dayNumberToGregorian(dayNumber);
  let jy = gy - 621;
  const calendar = jalCal(jy);
  const firstDay = gregorianToDayNumber(gy, 3, calendar.march);
  let offset = dayNumber - firstDay;
  if (offset >= 0) {
    if (offset <= 185) {
      return { jy, jm: 1 + div(offset, 31), jd: mod(offset, 31) + 1 };
    }
    offset -= 186;
  } else {
    jy -= 1;
    offset += 179;
    if (calendar.leap === 1) {
      offset += 1;
    }
  }
  return { jy, jm: 7 + div(offset, 30), jd: mod(offset, 30) + 1 };
}

export function isJalaliLeapYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

export function toJalali(gy: number, gm: number, gd: number): JalaliDate {
  return dayNumberToJalali(gregorianToDayNumber(gy, gm, gd));
}

export function toGregorian(jy: number, jm: number, jd: number): GregorianDate {
  return dayNumberToGregorian(jalaliToDayNumber(jy, jm, jd));
}

export function isValidJalaliDate(jy: number, jm: number, jd: number): boolean {
  return (
    isSupportedJalaliYear(jy) &&
    Number.isInteger(jm) &&
    Number.isInteger(jd) &&
    jm >= 1 &&
    jm <= 12 &&
    jd >= 1 &&
    jd <= jalaliMonthLength(jy, jm)
  );
}
