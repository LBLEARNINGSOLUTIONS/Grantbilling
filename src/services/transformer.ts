/**
 * Transformer Service
 * Transforms raw CSV rows to billing row format with column mapping
 */

import { RawCSVRow, BillingRow, COLUMN_MAPPING } from "../types/billing";

/**
 * Transform a single raw CSV row to a billing row.
 * Trims everything; converts blank Ticket Number to "MULTI" so a single
 * untagged trip still surfaces in the export rather than appearing empty.
 */
export function transformRow(raw: RawCSVRow): BillingRow {
  const ticketNumber = (raw["Ticket Number"] ?? "").trim();

  return {
    "Submitted By": (raw[COLUMN_MAPPING["Submitted By"]] ?? "").trim(),
    "Submission Date & Time": (raw[COLUMN_MAPPING["Submission Date & Time"]] ?? "").trim(),
    "Who are you running for?": (raw[COLUMN_MAPPING["Who are you running for?"]] ?? "").trim(),
    "Truck #": (raw[COLUMN_MAPPING["Truck #"]] ?? "").trim(),
    "North/South job": (raw[COLUMN_MAPPING["North/South job"]] ?? "").trim(),
    "Pit/Pick up name": (raw[COLUMN_MAPPING["Pit/Pick up name"]] ?? "").trim(),
    "Job/Delivery name": (raw[COLUMN_MAPPING["Job/Delivery name"]] ?? "").trim(),
    "Product type": (raw[COLUMN_MAPPING["Product type"]] ?? "").trim(),
    "Ticket # or Multi": ticketNumber === "" ? "MULTI" : ticketNumber,
    "Truck type": (raw[COLUMN_MAPPING["Truck type"]] ?? "").trim(),
    "Start time": (raw[COLUMN_MAPPING["Start time"]] ?? "").trim(),
    "End time": (raw[COLUMN_MAPPING["End time"]] ?? "").trim(),
    "Total tons": (raw[COLUMN_MAPPING["Total tons"]] ?? "").trim(),
    "Total # of loads": (raw[COLUMN_MAPPING["Total # of loads"]] ?? "").trim(),
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
