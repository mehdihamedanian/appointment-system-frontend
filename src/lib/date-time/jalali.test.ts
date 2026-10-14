import { describe, expect, it } from "vitest";
import {
  isJalaliLeapYear,
  isValidJalaliDate,
  jalaliMonthLength,
  toGregorian,
  toJalali,
} from "@/lib/date-time/jalali";

const intlPersian = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: "UTC",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

function intlJalali(gy: number, gm: number, gd: number) {
  const values: Record<string, string> = {};
  for (const part of intlPersian.formatToParts(new Date(Date.UTC(gy, gm - 1, gd, 12)))) {
    values[part.type] = part.value;
  }
  return { jy: Number(values.year), jm: Number(values.month), jd: Number(values.day) };
}

describe("Jalali conversion", () => {
  it("converts known reference dates", () => {
    expect(toJalali(2026, 3, 21)).toEqual({ jy: 1405, jm: 1, jd: 1 });
    expect(toJalali(2026, 3, 20)).toEqual({ jy: 1404, jm: 12, jd: 29 });
    expect(toJalali(2026, 8, 22)).toEqual({ jy: 1405, jm: 5, jd: 31 });
    expect(toJalali(2026, 8, 23)).toEqual({ jy: 1405, jm: 6, jd: 1 });
    expect(toJalali(2025, 3, 20)).toEqual({ jy: 1403, jm: 12, jd: 30 });
    expect(toGregorian(1405, 5, 1)).toEqual({ gy: 2026, gm: 7, gd: 23 });
  });

  it("knows leap years and month lengths", () => {
    expect(isJalaliLeapYear(1403)).toBe(true);
    expect(isJalaliLeapYear(1404)).toBe(false);
    expect(jalaliMonthLength(1405, 1)).toBe(31);
    expect(jalaliMonthLength(1405, 7)).toBe(30);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    expect(isValidJalaliDate(1404, 12, 30)).toBe(false);
    expect(isValidJalaliDate(1403, 12, 30)).toBe(true);
  });

  it("matches the Intl Persian calendar used for display labels", () => {
    const mismatches: string[] = [];
    for (let ms = Date.UTC(2000, 0, 1); ms <= Date.UTC(2040, 11, 31); ms += 3 * 86_400_000) {
      const date = new Date(ms);
      const gy = date.getUTCFullYear();
      const gm = date.getUTCMonth() + 1;
      const gd = date.getUTCDate();
      const ours = toJalali(gy, gm, gd);
      const theirs = intlJalali(gy, gm, gd);
      if (ours.jy !== theirs.jy || ours.jm !== theirs.jm || ours.jd !== theirs.jd) {
        mismatches.push(`${gy}-${gm}-${gd}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("round-trips every day of a Jalali year", () => {
    for (let jm = 1; jm <= 12; jm += 1) {
      for (let jd = 1; jd <= jalaliMonthLength(1405, jm); jd += 1) {
        const { gy, gm, gd } = toGregorian(1405, jm, jd);
        expect(toJalali(gy, gm, gd)).toEqual({ jy: 1405, jm, jd });
      }
    }
  });
});
