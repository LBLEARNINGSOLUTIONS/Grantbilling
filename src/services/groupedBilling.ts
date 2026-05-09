/**
 * Grouped Billing Service
 *
 * Collapses per-submission BillingRows into one billing line item per
 * (driver + truck# + pit + customer + material). Within each group:
 *   - Total tons and Total # of loads are summed
 *   - Ticket # is "MULTI" if distinct tickets disagree, else the shared value
 *   - Start time = earliest submission, End time = latest submission
 *   - Total Time = SUM of (end - start) per submission (NOT latest - earliest;
 *     gaps between submissions are excluded so a lunch break doesn't bill)
 */

import dayjs from "dayjs";
import { BillingRow, GroupedBillingRow } from "../types/billing";
import { parseTime, minutesBetween, formatHHMM } from "./timeParser";

/**
 * Extract a YYYY-MM-DD ISO date from a Submission Date & Time string. Falls
 * back to today's date if unparseable so date filtering doesn't drop rows
 * silently — the row will just be tagged with today and remain visible.
 */
function extractIsoDate(submissionDateStr: string): string {
  const trimmed = submissionDateStr.trim();
  if (trimmed) {
    const formats = [
      "MM/DD/YYYY HH:mm:ss",
      "M/D/YYYY HH:mm:ss",
      "MM/DD/YYYY H:mm",
      "YYYY-MM-DDTHH:mm:ss",
      "YYYY-MM-DD HH:mm:ss",
    ];
    for (const format of formats) {
      const parsed = dayjs(trimmed, format, true);
      if (parsed.isValid()) return parsed.format("YYYY-MM-DD");
    }
    const native = new Date(trimmed);
    if (!isNaN(native.getTime())) return dayjs(native).format("YYYY-MM-DD");
  }
  return dayjs().format("YYYY-MM-DD");
}

function groupKey(row: BillingRow): string {
  return [
    row["Submitted By"],
    row["Truck #"],
    row["Pit/Pick up name"],
    row["Job/Delivery name"],
    row["Product type"],
  ].join("␟"); // unit-separator char — won't collide with field content
}

function parseNumeric(value: string): number {
  return parseFloat(value.replace(/,/g, "")) || 0;
}

/**
 * Collapse rows into grouped billing line items.
 * Order of returned rows is the order each group was first encountered,
 * preserving the original CSV ordering for the leading submission of each.
 */
export function buildGroupedBilling(rows: BillingRow[]): GroupedBillingRow[] {
  const groups = new Map<string, BillingRow[]>();
  const insertionOrder: string[] = [];

  for (const row of rows) {
    const key = groupKey(row);
    if (!groups.has(key)) {
      groups.set(key, []);
      insertionOrder.push(key);
    }
    groups.get(key)!.push(row);
  }

  return insertionOrder.map((key) => collapseGroup(groups.get(key)!));
}

function collapseGroup(submissions: BillingRow[]): GroupedBillingRow {
  const first = submissions[0];

  let totalTons = 0;
  let totalLoads = 0;
  let totalMinutes = 0;
  let earliest: { row: BillingRow; ms: number } | null = null;
  let latest: { row: BillingRow; ms: number } | null = null;
  const tickets = new Set<string>();

  for (const s of submissions) {
    totalTons += parseNumeric(s["Total tons"]);
    totalLoads += parseNumeric(s["Total # of loads"]);

    const start = parseTime(s["Start time"], s["Submission Date & Time"]);
    const end = parseTime(s["End time"], s["Submission Date & Time"]);
    if (start && end) {
      totalMinutes += minutesBetween(start, end);
      const startMs = start.valueOf();
      const endMs = end.valueOf();
      if (!earliest || startMs < earliest.ms) earliest = { row: s, ms: startMs };
      if (!latest || endMs > latest.ms) latest = { row: s, ms: endMs };
    }

    const ticket = s["Ticket # or Multi"];
    if (ticket && ticket !== "MULTI") tickets.add(ticket);
  }

  const ticketDisplay =
    tickets.size === 0 ? "MULTI" : tickets.size === 1 ? [...tickets][0] : "MULTI";

  return {
    "Submitted By": first["Submitted By"],
    "Truck #": first["Truck #"],
    "North/South job": first["North/South job"],
    "Pit/Pick up name": first["Pit/Pick up name"],
    "Job/Delivery name": first["Job/Delivery name"],
    "Product type": first["Product type"],
    "Truck type": first["Truck type"],
    "Ticket # or Multi": ticketDisplay,
    "Start time": earliest ? earliest.row["Start time"] : first["Start time"],
    "End time": latest ? latest.row["End time"] : first["End time"],
    "Total tons": formatNumber(totalTons),
    "Total # of loads": formatNumber(totalLoads),
    customer: first["Who are you running for?"],
    date: extractIsoDate(first["Submission Date & Time"]),
    totalMinutes,
    totalTimeHHMM: formatHHMM(totalMinutes),
    totalTimeDecimal: (totalMinutes / 60).toFixed(2),
    submissionCount: submissions.length,
  };
}

/**
 * Format a numeric total. Integers render without trailing ".00"; decimals
 * keep two places to match how Maggie reads tonnage on Parsons invoices.
 */
function formatNumber(n: number): string {
  if (n === 0) return "0";
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

/**
 * Project a grouped row down to a flat BillingRow so existing export and
 * filter code (which expects BillingRow shape) keeps working unchanged.
 */
export function groupedToBillingRow(g: GroupedBillingRow): BillingRow {
  return {
    "Submitted By": g["Submitted By"],
    "Submission Date & Time": "",  // not meaningful at the group level
    "Who are you running for?": g.customer,
    "Truck #": g["Truck #"],
    "North/South job": g["North/South job"],
    "Pit/Pick up name": g["Pit/Pick up name"],
    "Job/Delivery name": g["Job/Delivery name"],
    "Product type": g["Product type"],
    "Ticket # or Multi": g["Ticket # or Multi"],
    "Truck type": g["Truck type"],
    "Start time": g["Start time"],
    "End time": g["End time"],
    "Total tons": g["Total tons"],
    "Total # of loads": g["Total # of loads"],
  };
}
