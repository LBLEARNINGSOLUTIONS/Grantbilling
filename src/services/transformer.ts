/**
 * Transformer Service
 * Transforms raw CSV rows to billing row format with column mapping
 */

import { RawCSVRow, BillingRow, COLUMN_MAPPING } from "../types/billing";

/**
 * Read a value from the raw CSV row using the COLUMN_MAPPING entry. The
 * entry may be a single column name OR a list of names to try in order;
 * the first non-empty trimmed value wins. Returns "" if nothing matches.
 */
function readField(raw: RawCSVRow, source: string | readonly string[]): string {
  const keys = Array.isArray(source) ? source : [source as string];
  for (const key of keys) {
    const val = (raw[key] ?? "").trim();
    if (val !== "") return val;
  }
  return "";
}

/**
 * Transform a single raw CSV row to a billing row.
 * Trims everything; converts blank Ticket Number to "MULTI" so a single
 * untagged trip still surfaces in the export rather than appearing empty.
 */
export function transformRow(raw: RawCSVRow): BillingRow {
  const ticketNumber = readField(raw, COLUMN_MAPPING["Ticket # or Multi"]);

  return {
    "Submitted By": readField(raw, COLUMN_MAPPING["Submitted By"]),
    "Submission Date & Time": readField(raw, COLUMN_MAPPING["Submission Date & Time"]),
    "Who are you running for?": readField(raw, COLUMN_MAPPING["Who are you running for?"]),
    "Truck #": readField(raw, COLUMN_MAPPING["Truck #"]),
    "North/South job": readField(raw, COLUMN_MAPPING["North/South job"]),
    "Pit/Pick up name": readField(raw, COLUMN_MAPPING["Pit/Pick up name"]),
    "Job/Delivery name": readField(raw, COLUMN_MAPPING["Job/Delivery name"]),
    "Product type": readField(raw, COLUMN_MAPPING["Product type"]),
    "Ticket # or Multi": ticketNumber === "" ? "MULTI" : ticketNumber,
    "Truck type": readField(raw, COLUMN_MAPPING["Truck type"]),
    "Start time": readField(raw, COLUMN_MAPPING["Start time"]),
    "End time": readField(raw, COLUMN_MAPPING["End time"]),
    "Total tons": readField(raw, COLUMN_MAPPING["Total tons"]),
    "Total # of loads": readField(raw, COLUMN_MAPPING["Total # of loads"]),
  };
}

/**
 * Transform all rows from raw CSV to billing format
 */
export function transformAllRows(rawRows: RawCSVRow[]): BillingRow[] {
  return rawRows.map(transformRow);
}

/**
 * Get the raw Submission Date & Time string for a row (used by the time
 * parser to anchor bare HH:MM values to a real date).
 */
export function getSubmissionDate(raw: RawCSVRow): string {
  return (raw["Submission Date & Time"] ?? "").trim();
}
