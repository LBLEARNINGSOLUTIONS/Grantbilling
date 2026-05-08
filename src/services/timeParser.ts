/**
 * Time Parser Service
 * Parses Samsara time strings into dayjs objects.
 *
 * Two distinct shapes show up in real CSVs:
 *   1. Bare HH:MM ("07:30") — emitted by the new multi-choice quarter-hour
 *      questions. Has no date. Must be anchored to the submission date.
 *   2. Full datetime ("Apr 22 2026 6:17AM MDT", "1/6/2026 1:00 PM", etc.) —
 *      emitted by the older time-picker question style.
 */

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

const HHMM_REGEX = /^\d{1,2}:\d{2}$/;

/**
 * Datetime formats accepted for full-datetime values. Order matters — more
 * specific formats first so dayjs strict parsing picks the right one.
 */
const DATETIME_FORMATS = [
  "MMM D YYYY h:mmA z",
  "MMM D YYYY h:mmA",
  "MMM D YYYY h:mm A z",
  "MMM D YYYY h:mm A",
  "MMM DD YYYY h:mmA z",
  "MMM DD YYYY h:mmA",
  "M/D/YYYY h:mm A",
  "MM/DD/YYYY h:mm A",
  "YYYY-MM-DD HH:mm",
  "YYYY-MM-DDTHH:mm:ss",
];

/**
 * Submission Date & Time formats. Samsara auto-collected timestamps are
 * typically "MM/DD/YYYY HH:mm:ss" but we accept a few variants defensively.
 */
const SUBMISSION_DATE_FORMATS = [
  "MM/DD/YYYY HH:mm:ss",
  "M/D/YYYY HH:mm:ss",
  "MM/DD/YYYY H:mm",
  "YYYY-MM-DDTHH:mm:ss",
  "YYYY-MM-DD HH:mm:ss",
];

function parseSubmissionDate(submissionDateStr: string): dayjs.Dayjs | null {
  const trimmed = submissionDateStr.trim();
  if (!trimmed) return null;

  for (const format of SUBMISSION_DATE_FORMATS) {
    const parsed = dayjs(trimmed, format, true);
    if (parsed.isValid()) return parsed;
  }

  const native = new Date(trimmed);
  if (!isNaN(native.getTime())) return dayjs(native);
  return null;
}

/**
 * Parse a time string, optionally anchored to the submission date for bare
 * HH:MM values. Returns null if the string can't be parsed.
 */
export function parseTime(
  timeStr: string,
  submissionDateStr: string
): dayjs.Dayjs | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  // Bare HH:MM — anchor to the submission date so downstream math (epoch
  // arithmetic, day grouping) has a real timestamp to work with.
  if (HHMM_REGEX.test(trimmed)) {
    const submissionDate = parseSubmissionDate(submissionDateStr);
    if (!submissionDate) return null;

    const [hourStr, minuteStr] = trimmed.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (isNaN(hour) || isNaN(minute) || hour > 23 || minute > 59) return null;

    return submissionDate.hour(hour).minute(minute).second(0).millisecond(0);
  }

  // Full datetime — try each format, with and without trailing timezone.
  for (const format of DATETIME_FORMATS) {
    const withoutTz = trimmed.replace(/\s+[A-Z]{2,4}$/, "");
    const a = dayjs(withoutTz, format, true);
    if (a.isValid()) return a;

    const b = dayjs(trimmed, format, true);
    if (b.isValid()) return b;
  }

  const native = new Date(trimmed);
  if (!isNaN(native.getTime())) return dayjs(native);
  return null;
}

/**
 * Compute hours between two parsed datetimes.
 */
export function hoursBetween(start: dayjs.Dayjs, end: dayjs.Dayjs): number {
  return (end.valueOf() - start.valueOf()) / 3_600_000;
}

/**
 * Compute minutes between two parsed datetimes.
 */
export function minutesBetween(start: dayjs.Dayjs, end: dayjs.Dayjs): number {
  return (end.valueOf() - start.valueOf()) / 60_000;
}

/**
 * Format a minute count as "H:MM" (e.g. 345 → "5:45"). Negative values
 * are clamped to 0:00 since negative job duration is meaningless here.
 */
export function formatHHMM(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(m / 60);
  const minutes = m % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Normalize truck-type strings for comparison. Lowercases and treats "&" and
 * "and" as equivalent so old/new spellings ("Truck & Pup", "truck and pup",
 * "TRUCK & PUP") all collapse to the same canonical form.
 */
export function normalizeTruckType(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}
