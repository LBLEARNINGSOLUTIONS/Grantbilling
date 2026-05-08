/**
 * Truck Summary Service
 * Calculates hours per truck from valid billing rows.
 * Generates the email-ready text block Maggie pastes into Parsons.
 */

import dayjs from "dayjs";
import { BillingRow, TruckSummaryRow, TruckSummaryResult } from "../types/billing";
import { parseTime, hoursBetween, normalizeTruckType } from "./timeParser";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const SIDE_DUMP_KEY = normalizeTruckType("Side Dump");

/**
 * Build the daily truck summary from valid billing rows. Groups by
 * (truck number + truck type) and sums each submission's (end - start).
 */
export function buildDailyTruckSummary(validRows: BillingRow[]): TruckSummaryResult {
  if (validRows.length === 0) {
    return { summaryRows: [], dateLabel: "", headerLine: "", textLines: [], fullText: "" };
  }

  const hoursMap = new Map<
    string,
    { truckNumber: string; truckType: string; hours: number }
  >();
  let firstDate: dayjs.Dayjs | null = null;

  for (const row of validRows) {
    const start = parseTime(row["Start time"], row["Submission Date & Time"]);
    const end = parseTime(row["End time"], row["Submission Date & Time"]);

    if (!start || !end) {
      console.warn("Skipping row with unparseable times in summary:", row);
      continue;
    }

    if (!firstDate) firstDate = start;

    const rowHours = hoursBetween(start, end);
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

  const summaryRows: TruckSummaryRow[] = [];
  for (const entry of hoursMap.values()) {
    const isSideDump = normalizeTruckType(entry.truckType) === SIDE_DUMP_KEY;
    const prefix = isSideDump ? "SD" : "DT";
    summaryRows.push({
      truckNumber: entry.truckNumber,
      truckType: entry.truckType,
      label: `${prefix} ${entry.truckNumber}`,
      totalHours: round2(entry.hours),
    });
  }

  // DT trucks first (numerically), then SD trucks (numerically).
  const sortByNumber = (a: TruckSummaryRow, b: TruckSummaryRow) => {
    const numA = parseInt(a.truckNumber, 10);
    const numB = parseInt(b.truckNumber, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.truckNumber.localeCompare(b.truckNumber);
  };

  const dtRows = summaryRows
    .filter((r) => normalizeTruckType(r.truckType) !== SIDE_DUMP_KEY)
    .sort(sortByNumber);
  const sdRows = summaryRows
    .filter((r) => normalizeTruckType(r.truckType) === SIDE_DUMP_KEY)
    .sort(sortByNumber);
  const sortedRows = [...dtRows, ...sdRows];

  const dateLabel = firstDate ? firstDate.format("M/D/YY") : "";
  const headerLine = dateLabel ? `${dateLabel} HOURS:` : "";
  const textLines = sortedRows.map(
    (r) => `${r.label}: ${r.totalHours.toFixed(2)}`
  );
  const fullText = headerLine
    ? [headerLine, ...textLines].join("\n")
    : textLines.join("\n");

  return { summaryRows: sortedRows, dateLabel, headerLine, textLines, fullText };
}
