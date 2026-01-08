/**
 * Truck Summary Service
 * Calculates hours per truck from valid billing rows
 * Generates email-ready text block matching Maggie's format to Parsons
 */

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { BillingRow, TruckSummaryRow, TruckSummaryResult } from "../types/billing";

// Enable custom format parsing for dayjs
dayjs.extend(customParseFormat);

/**
 * Supported datetime formats for parsing Samsara times
 * Must match the formats in validator.ts
 */
const DATETIME_FORMATS = [
  "MMM D YYYY h:mmA z",    // Jan 6 2026 1:00PM MST
  "MMM D YYYY h:mmA",      // Jan 6 2026 1:00PM (no timezone)
  "MMM D YYYY h:mm A z",   // Jan 6 2026 1:00 PM MST (with space)
  "MMM D YYYY h:mm A",     // Jan 6 2026 1:00 PM (with space, no tz)
  "MMM DD YYYY h:mmA z",   // Jan 06 2026 1:00PM MST (2-digit day)
  "MMM DD YYYY h:mmA",     // Jan 06 2026 1:00PM
  "M/D/YYYY h:mm A",       // 1/6/2026 1:00 PM
  "MM/DD/YYYY h:mm A",     // 01/06/2026 1:00 PM
  "YYYY-MM-DD HH:mm",      // 2026-01-06 13:00
  "YYYY-MM-DDTHH:mm:ss",   // ISO format
];

/**
 * Attempt to parse a datetime string using multiple formats
 * Strips timezone suffix before parsing if present
 */
function parseDateTime(dateTimeStr: string): dayjs.Dayjs | null {
  if (!dateTimeStr || dateTimeStr.trim() === "") {
    return null;
  }

  const trimmed = dateTimeStr.trim();

  // Try each format
  for (const format of DATETIME_FORMATS) {
    // Try with timezone stripped (remove last word if it looks like a timezone)
    const withoutTz = trimmed.replace(/\s+[A-Z]{2,4}$/, "");
    const parsed = dayjs(withoutTz, format, true);
    if (parsed.isValid()) {
      return parsed;
    }

    // Also try the original string
    const parsedOriginal = dayjs(trimmed, format, true);
    if (parsedOriginal.isValid()) {
      return parsedOriginal;
    }
  }

  // Last resort: try native Date parsing
  const nativeDate = new Date(trimmed);
  if (!isNaN(nativeDate.getTime())) {
    return dayjs(nativeDate);
  }

  return null;
}

/**
 * Compute hours between two datetimes
 */
function computeHours(start: dayjs.Dayjs, end: dayjs.Dayjs): number {
  return (end.valueOf() - start.valueOf()) / 3600000;
}

/**
 * Round a number to 2 decimal places
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build the daily truck summary from valid billing rows
 * Groups rows by truck, calculates total hours, and formats for email
 */
export function buildDailyTruckSummary(validRows: BillingRow[]): TruckSummaryResult {
  // Return empty result if no valid rows
  if (validRows.length === 0) {
    return {
      summaryRows: [],
      dateLabel: "",
      headerLine: "",
      textLines: [],
      fullText: "",
    };
  }

  // Map: "truckNum|truckType" -> accumulated hours
  const hoursMap = new Map<
    string,
    { truckNumber: string; truckType: string; hours: number }
  >();
  let firstDate: dayjs.Dayjs | null = null;

  for (const row of validRows) {
    const start = parseDateTime(row["Start time"]);
    const end = parseDateTime(row["End time"]);

    // Skip rows with unparseable times (should already be exceptions, but be defensive)
    if (!start || !end) {
      console.warn("Skipping row with unparseable times in summary:", row);
      continue;
    }

    // Capture the first date for the header
    if (!firstDate) {
      firstDate = start;
    }

    const rowHours = computeHours(start, end);
    const key = `${row["Truck #"]}|${row["Truck type"]}`;

    if (hoursMap.has(key)) {
      hoursMap.get(key)!.hours += rowHours;
    } else {
      hoursMap.set(key, {
        truckNumber: row["Truck #"],
        truckType: row["Truck type"],
        hours: rowHours,
      });
    }
  }

  // Build summary rows with labels
  const summaryRows: TruckSummaryRow[] = [];
  for (const entry of hoursMap.values()) {
    // "Side Dump" gets "SD" prefix, everything else gets "DT"
    const prefix = entry.truckType === "Side Dump" ? "SD" : "DT";
    summaryRows.push({
      truckNumber: entry.truckNumber,
      truckType: entry.truckType,
      label: `${prefix} ${entry.truckNumber}`,
      totalHours: round2(entry.hours),
    });
  }

  // Sort: DT trucks first (sorted numerically), then SD trucks (sorted numerically)
  const sortByNumber = (a: TruckSummaryRow, b: TruckSummaryRow) => {
    const numA = parseInt(a.truckNumber, 10);
    const numB = parseInt(b.truckNumber, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.truckNumber.localeCompare(b.truckNumber);
  };

  const dtRows = summaryRows
    .filter((r) => r.truckType !== "Side Dump")
    .sort(sortByNumber);
  const sdRows = summaryRows
    .filter((r) => r.truckType === "Side Dump")
    .sort(sortByNumber);
  const sortedRows = [...dtRows, ...sdRows];

  // Format date as M/D/YY (no leading zeros)
  const dateLabel = firstDate ? firstDate.format("M/D/YY") : "";
  const headerLine = dateLabel ? `${dateLabel} HOURS:` : "";

  // Build text lines - each line is "LABEL: HOURS" with exactly 2 decimals
  const textLines = sortedRows.map(
    (r) => `${r.label}: ${r.totalHours.toFixed(2)}`
  );

  // Full text block for copy/paste
  const fullText = headerLine
    ? [headerLine, ...textLines].join("\n")
    : textLines.join("\n");

  return {
    summaryRows: sortedRows,
    dateLabel,
    headerLine,
    textLines,
    fullText,
  };
}
