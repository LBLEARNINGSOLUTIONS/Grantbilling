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
  "Submitted By": string;
  "Submission Date & Time": string;
  "Who are you running for?": string;
  "Region": string;
  "Which Pit?": string;
  "Truck Number": string;
  "What type of truck?": string;
  "Customer / Delivery Name": string;
  "Material Type": string;
  "Ticket Number": string;
  "Left the yard": string;
  "Returned to yard": string;
  "Total Tons": string;
  "Loads on this Trip": string;
  // Allow additional properties from CSV that we'll ignore
  [key: string]: string;
}

/**
 * All required input headers for CSV structure validation.
 * Must match exactly (case-sensitive, punctuation-sensitive) — header
 * normalization in csvParser.ts already handles dash/whitespace variants.
 */
/**
 * Required column "slots". Each slot is either a single header name (which
 * must be present in the CSV) or an array of acceptable variants — the slot
 * passes when at least one variant exists. Variants exist for the four
 * fields that were renamed mid-2026 when Maggie reworked the form; Samsara
 * exports both old and new columns side-by-side, with each submission
 * populating whichever set was current at submission time.
 */
export const REQUIRED_INPUT_HEADERS: readonly (string | readonly string[])[] = [
  "Submitted By",
  "Submission Date & Time",
  "Who are you running for?",
  "Region",
  "Which Pit?",
  "Truck Number",
  "What type of truck?",
  "Customer / Delivery Name",
  "Material Type",
  "Ticket Number",
  ["Left the yard", "Job Start Time"],
  ["Returned to yard", "Job End Time"],
  ["Total Tons", "Total tons"],
  ["Loads on this Trip", "Number of Loads"],
] as const;

// =============================================================================
// TRUCK NUMBER CONSTANTS
// =============================================================================

/**
 * Hard-coded truck-number list. Mirrors the multiple-choice options on the
 * Samsara form. Used for the Billing View filter dropdown. Stored as STRINGS
 * to avoid leading-zero / sort-order surprises.
 *
 * Sorted descending (newest trucks first) per Maggie's preference.
 */
export const TRUCK_NUMBERS: readonly string[] = [
  "137", "136", "24", "23", "22", "21", "20",
  "19", "17", "16", "15", "13", "12", "11",
] as const;

/**
 * Known carriers for the "Who are you running for?" filter. Drives the order
 * of the customer pills in the filter bar; any value not in this list is
 * still allowed and shown after these in alphabetical order (handled by the
 * filter bar component).
 */
export const RUNNING_FOR_OPTIONS: readonly string[] = [
  "Parson",
  "Compass",
  "E.K. Bailey",
  "Other",
] as const;

// =============================================================================
// OUTPUT BILLING TYPES
// =============================================================================

/**
 * Canonical truck-type values. Comparison is case-insensitive and treats
 * "&" and "and" as equivalent — see normalizeTruckType() in validator.ts.
 */
export type TruckType = "Truck" | "Truck and Pup" | "Side Dump";

export const VALID_TRUCK_TYPES: readonly TruckType[] = [
  "Truck",
  "Truck and Pup",
  "Side Dump",
] as const;

/**
 * Per-submission billing row (1:1 with a CSV row, after transformation).
 * This is the input to the grouping function — not the final display row.
 */
export interface BillingRow {
  "Submitted By": string;
  "Submission Date & Time": string;  // raw value, used to anchor bare HH:MM times
  "Who are you running for?": string;  // carrier (Parson / Compass / E.K. Bailey / Other)
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
  // Optional advisory note carried by an otherwise-valid row (e.g. auto-set
  // loads). Not a validation failure; not exported (absent from OUTPUT_HEADERS).
  "Issue(s)"?: string;
}

/**
 * Output column headers in EXACT order for export.
 * This is the order Maggie needs for copy/paste to Parsons.
 * Total Time is intentionally not exported — dashboard-only.
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
// GROUPED BILLING TYPES
// =============================================================================

/**
 * One billing line item — represents one or more submissions collapsed by
 * (driver + truck# + pit + customer + material). Every field that's part of
 * the group key has a single value; tons/loads are summed; ticket is "MULTI"
 * when distinct ticket numbers don't agree; total time is the SUM of each
 * submission's (end - start), not (latest end - earliest start).
 */
export interface GroupedBillingRow {
  // Identifying fields (constant within the group)
  "Submitted By": string;
  "Truck #": string;
  "North/South job": string;
  "Pit/Pick up name": string;
  "Job/Delivery name": string;
  "Product type": string;
  "Truck type": string;

  // Aggregated fields
  "Ticket # or Multi": string;       // "MULTI" if distinct tickets, else the shared ticket
  "Start time": string;              // earliest submission's start
  "End time": string;                // latest submission's end
  "Total tons": string;              // sum
  "Total # of loads": string;        // sum

  // Pass-through fields (V2: dashboard filter inputs)
  customer: string;                  // "Who are you running for?" — taken from first submission
  date: string;                      // ISO YYYY-MM-DD — date of first submission, for date filter

  // Computed time (dashboard-only — not in OUTPUT_HEADERS)
  totalMinutes: number;              // sum of (end - start) across submissions
  totalTimeHHMM: string;             // "5:45"
  totalTimeDecimal: string;          // "5.75"

  submissionCount: number;           // for diagnostics / display

  // Non-empty when any submission in this group carried an advisory note
  // (e.g. loads auto-set to 1). Drives the ⚠️ VERIFY badge in the Billing View.
  verifyNote: string;
}

// =============================================================================
// COLUMN MAPPING
// =============================================================================

/**
 * Mapping from BillingRow keys to RawCSVRow column names.
 * "Issue(s)" is excluded — it's a derived advisory note, not a CSV column.
 *
 * A value can be a single string OR an array of strings to try in order. The
 * transformer reads the first non-empty value across the list so a row that
 * was submitted before a column was renamed still resolves correctly. The
 * duplicate "Which Pit?" column (which Samsara emits because the form had
 * the question twice over its history) is disambiguated by csvParser.ts to
 * "Which Pit? (2)" so we can read both occurrences here.
 */
export const COLUMN_MAPPING: Record<Exclude<keyof BillingRow, "Issue(s)">, string | readonly string[]> = {
  "Submitted By": "Submitted By",
  "Submission Date & Time": "Submission Date & Time",
  "Who are you running for?": "Who are you running for?",
  "Truck #": "Truck Number",
  "North/South job": "Region",
  "Pit/Pick up name": ["Which Pit?", "Which Pit? (2)"],
  "Job/Delivery name": "Customer / Delivery Name",
  "Product type": "Material Type",
  "Ticket # or Multi": "Ticket Number",
  "Truck type": "What type of truck?",
  "Start time": ["Left the yard", "Job Start Time"],
  "End time": ["Returned to yard", "Job End Time"],
  "Total tons": ["Total Tons", "Total tons"],
  "Total # of loads": ["Loads on this Trip", "Number of Loads"],
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
  // Advisory note for an auto-corrected but still-valid row (e.g. loads
  // auto-set to 1). Null when no correction was applied.
  autoNote: string | null;
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

// =============================================================================
// DAILY TRUCK SUMMARY TYPES
// =============================================================================

/**
 * Summary row for a single truck's total hours
 */
export interface TruckSummaryRow {
  truckNumber: string;
  truckType: string;
  label: string;       // "DT 157" or "SD 136"
  totalHours: number;  // rounded to 2 decimals
}

/**
 * Complete result of building the daily truck summary
 */
export interface TruckSummaryResult {
  summaryRows: TruckSummaryRow[];
  dateLabel: string;            // "1/6/26"
  headerLine: string;           // "1/6/26 HOURS:"
  textLines: string[];          // ["DT 157: 4.00", "SD 136: 8.75"]
  fullText: string;             // Complete copy-paste text block
}
