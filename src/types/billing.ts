/**
 * Type definitions for the Billing Builder app
 * Defines exact column mappings and validation types
 */

// =============================================================================
// INPUT CSV TYPES
// =============================================================================

/**
 * Raw CSV row as parsed from Samsara export
 * These are the EXACT column headers expected in the uploaded CSV (case-sensitive)
 */
export interface RawCSVRow {
  "Which truck do you have?": string;
  "Region": string;
  "Which Pit?": string;
  "Job Name (as on ticket / E‑Hauler label)": string;
  "Material Type": string;
  "Ticket Number": string;
  "Truck Type": string;
  "Job Start Time": string;
  "Job End Time": string;
  "Total tons": string;
  "Number of Loads": string;
  // Allow additional properties from CSV that we'll ignore
  [key: string]: string;
}

/**
 * All 11 required input headers for CSV structure validation
 * Must match exactly (case-sensitive, punctuation-sensitive)
 */
export const REQUIRED_INPUT_HEADERS: readonly string[] = [
  "Which truck do you have?",
  "Region",
  "Which Pit?",
  "Job Name (as on ticket / E‑Hauler label)",
  "Material Type",
  "Ticket Number",
  "Truck Type",
  "Job Start Time",
  "Job End Time",
  "Total tons",
  "Number of Loads",
] as const;

// =============================================================================
// OUTPUT BILLING TYPES
// =============================================================================

/**
 * Valid truck type values - EXACTLY these strings only
 */
export type TruckType = "Truck" | "Truck & Pup" | "Side Dump";

export const VALID_TRUCK_TYPES: readonly TruckType[] = [
  "Truck",
  "Truck & Pup",
  "Side Dump",
] as const;

/**
 * Transformed billing row with output column names
 * This is the format for display and export
 */
export interface BillingRow {
  "Truck #": string;
  "North/South job": string;
  "Pit/Pick up name": string;
  "Job/Delivery name": string;
  "Product type": string;
  "Ticket # or Multi": string;
  "Truck type": string;
  "Start time": string;
  "End time": string;
  "Total tons": string;
  "Total # of loads": string;
}

/**
 * Output column headers in EXACT order for export
 * This is the order Maggie needs for copy/paste to Parsons
 */
export const OUTPUT_HEADERS: readonly (keyof BillingRow)[] = [
  "Truck #",
  "North/South job",
  "Pit/Pick up name",
  "Job/Delivery name",
  "Product type",
  "Ticket # or Multi",
  "Truck type",
  "Start time",
  "End time",
  "Total tons",
  "Total # of loads",
] as const;

// =============================================================================
// COLUMN MAPPING
// =============================================================================

/**
 * Explicit mapping from OUTPUT columns to INPUT columns
 * Key = Output column name, Value = Input column name
 */
export const COLUMN_MAPPING: Record<keyof BillingRow, string> = {
  "Truck #": "Which truck do you have?",
  "North/South job": "Region",
  "Pit/Pick up name": "Which Pit?",
  "Job/Delivery name": "Job Name (as on ticket / E‑Hauler label)",
  "Product type": "Material Type",
  "Ticket # or Multi": "Ticket Number",
  "Truck type": "Truck Type",
  "Start time": "Job Start Time",
  "End time": "Job End Time",
  "Total tons": "Total tons",
  "Total # of loads": "Number of Loads",
};

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Exception row includes the billing data plus the Issue(s) column
 */
export interface ExceptionRow extends BillingRow {
  "Issue(s)": string;
}

/**
 * Result of processing a single row
 */
export interface RowResult {
  rowIndex: number;
  billingRow: BillingRow;
  issues: string[];
  isValid: boolean;
}

/**
 * Summary statistics for the processed file
 */
export interface ProcessingSummary {
  totalRows: number;
  validCount: number;
  exceptionCount: number;
}

/**
 * Complete result of processing a CSV file
 */
export interface ProcessingResult {
  success: boolean;
  structureError: string | null;
  validRows: BillingRow[];
  exceptionRows: ExceptionRow[];
  summary: ProcessingSummary;
}
