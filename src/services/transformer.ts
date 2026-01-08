/**
 * Transformer Service
 * Transforms raw CSV rows to billing row format with column mapping
 */

import { RawCSVRow, BillingRow, COLUMN_MAPPING } from "../types/billing";

/**
 * Transform a single raw CSV row to a billing row
 * Applies column mapping and handles special cases:
 * - Trims all string values
 * - Converts blank/empty Ticket Number to "MULTI"
 *
 * @param raw - The raw CSV row from Samsara export
 * @returns Transformed billing row with output column names
 */
export function transformRow(raw: RawCSVRow): BillingRow {
  // Get and trim the ticket number
  const ticketNumber = (raw["Ticket Number"] ?? "").trim();

  // Transform to billing row with column mapping
  return {
    "Truck #": (raw[COLUMN_MAPPING["Truck #"]] ?? "").trim(),
    "North/South job": (raw[COLUMN_MAPPING["North/South job"]] ?? "").trim(),
    "Pit/Pick up name": (raw[COLUMN_MAPPING["Pit/Pick up name"]] ?? "").trim(),
    "Job/Delivery name": (raw[COLUMN_MAPPING["Job/Delivery name"]] ?? "").trim(),
    "Product type": (raw[COLUMN_MAPPING["Product type"]] ?? "").trim(),
    // Special handling: blank ticket number becomes "MULTI"
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
 *
 * @param rawRows - Array of raw CSV rows
 * @returns Array of transformed billing rows
 */
export function transformAllRows(rawRows: RawCSVRow[]): BillingRow[] {
  return rawRows.map(transformRow);
}
