/**
 * Ethiopian (Amharic) calendar utilities.
 *
 * The database stores dates in Gregorian format. This module converts
 * at the UI boundary so users see and enter Ethiopian dates while
 * PostgreSQL date arithmetic keeps working under the hood.
 */

import { toEthiopian, toGregorian } from "ethiopian-calendar-new";
import { parseISO } from "date-fns";

/* ------------------------------------------------------------------ */
/*  MONTH NAMES (Amharic script)                                       */
/* ------------------------------------------------------------------ */

/** Amharic month names, 1-indexed (index 0 is unused placeholder). */
export const ETH_MONTHS: readonly string[] = [
  "",          // placeholder so month 1 = index 1
  "መስከረም",   // 1  Meskerem
  "ጥቅምት",    // 2  Tikimt
  "ኅዳር",     // 3  Hidar
  "ታኅሣሥ",    // 4  Tahsas
  "ጥር",      // 5  Tir
  "የካቲት",    // 6  Yekatit
  "መጋቢት",    // 7  Megabit
  "ሚያዝያ",    // 8  Miazia
  "ግንቦት",    // 9  Ginbot
  "ሰኔ",      // 10 Sene
  "ሐምሌ",     // 11 Hamle
  "ነሐሴ",     // 12 Nehasse
  "ጳጉሜ",     // 13 Pagume
];

/* ------------------------------------------------------------------ */
/*  CONVERSION HELPERS                                                 */
/* ------------------------------------------------------------------ */

export interface EthDate {
  year: number;
  month: number;
  day: number;
}

/** Convert a Gregorian Date (or ISO string) to an Ethiopian date. */
export function toEth(value: Date | string): EthDate {
  const d = typeof value === "string" ? parseISO(value) : value;
  const result = toEthiopian(
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate()
  );
  return { year: result.year, month: result.month, day: result.day };
}

/** Convert an Ethiopian date to a Gregorian Date object. */
export function toGreg(year: number, month: number, day: number): Date {
  const result = toGregorian(year, month, day);
  return new Date(result.year, result.month - 1, result.day);
}

/** Convert an Ethiopian date to a Gregorian ISO date string (YYYY-MM-DD). */
export function toGregISO(year: number, month: number, day: number): string {
  const d = toGreg(year, month, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/* ------------------------------------------------------------------ */
/*  MONTH / DAY HELPERS                                                */
/* ------------------------------------------------------------------ */

/** Is the given Ethiopian year a leap year? (every 4 years, no exceptions) */
export function isEthLeapYear(ethYear: number): boolean {
  return ethYear % 4 === 3;
}

/** Number of days in a given Ethiopian month. */
export function ethMonthDays(month: number, ethYear: number): number {
  if (month >= 1 && month <= 12) return 30;
  if (month === 13) return isEthLeapYear(ethYear) ? 6 : 5;
  return 0;
}

/** Returns the current Ethiopian year. */
export function currentEthYear(): number {
  return toEth(new Date()).year;
}

/** Returns the current Ethiopian date. */
export function currentEthDate(): EthDate {
  return toEth(new Date());
}

/* ------------------------------------------------------------------ */
/*  FORMATTING                                                         */
/* ------------------------------------------------------------------ */

/**
 * Format a Gregorian date as an Ethiopian date string.
 * Example: "ሐምሌ 15, 2017"
 */
export function formatEthDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const eth = toEth(value);
  return `${ETH_MONTHS[eth.month]} ${eth.day}, ${eth.year}`;
}

/**
 * Format a Gregorian date as an Ethiopian date+time string.
 * Example: "ሐምሌ 15, 2017 3:30 PM"
 */
export function formatEthDateTime(
  value: Date | string | null | undefined
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  const eth = toEth(d);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${ETH_MONTHS[eth.month]} ${eth.day}, ${eth.year} ${h12}:${minutes} ${ampm}`;
}

/**
 * Format a Gregorian date as Ethiopian month + year.
 * Example: "ሐምሌ 2017"
 */
export function formatEthMonthYear(
  value: Date | string | null | undefined
): string {
  if (!value) return "—";
  const eth = toEth(value);
  return `${ETH_MONTHS[eth.month]} ${eth.year}`;
}

/**
 * Given an Ethiopian year, return the Gregorian date range that covers
 * the full Ethiopian year (for database queries).
 */
export function ethYearToGregRange(ethYear: number): {
  from: string;
  to: string;
} {
  const from = toGregISO(ethYear, 1, 1);
  // Last day of Pagume
  const lastDay = isEthLeapYear(ethYear) ? 6 : 5;
  const to = toGregISO(ethYear, 13, lastDay);
  return { from, to };
}

/**
 * Given an Ethiopian year and month, return the Gregorian date range
 * that covers that Ethiopian month (for database queries).
 */
export function ethMonthToGregRange(
  ethYear: number,
  ethMonth: number
): { from: string; to: string } {
  const from = toGregISO(ethYear, ethMonth, 1);
  const lastDay = ethMonthDays(ethMonth, ethYear);
  const to = toGregISO(ethYear, ethMonth, lastDay);
  return { from, to };
}
