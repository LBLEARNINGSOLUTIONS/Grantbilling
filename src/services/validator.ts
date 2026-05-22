/**
 * Validator Service
 * Implements all 5 validation rules for billing data
 *
 * Rules:
 * 1. Required fields (non-empty after trim)
 * 2. Truck type enum validation (case-insensitive, & ↔ "and" tolerant)
 * 3. Time parsing + End > Start validation
 * 4. Quantity sanity (not both 0/empty, no negatives)
 * 5. CSV structure (all required headers present)
 */

import {
  RawCSVRow,
  BillingRow,
  ExceptionRow,
  ProcessingResult,
  RowResult,
  VALID_TRUCK_TYPES,
} from "../types/billing";
import { parseCSVFile } from "./csvParser";
import { transformRow } from "./transformer";
import { parseTime, normalizeTruckType } from "./timeParser";

const NORMALIZED_VALID_TRUCK_TYPES = new Set(
  VALID_TRUCK_TYPES.map((t) => normalizeTruckType(t))
);

// =============================================================================
// SUBMISSION DEDUPLICATION (Change 2)
// =============================================================================

/**
 * Drop rows that repeat a "Submission URL" already seen, keeping the first.
 * Rows without a Submission URL can't be de-duped and are always kept.
 * Dropped duplicates are logged to the console.
 */
export function dedupeBySubmissionUrl(rows: RawCSVRow[]): RawCSVRow[] {
  const seen = new Set<string>();
  const result: RawCSVRow[] = [];
  let dropped = 0;

  for (const row of rows) {
    const url = (row["Submission URL"] ?? "").trim();
    if (url === "") {
      result.push(row); // no URL to dedupe on — keep it
      continue;
    }
    if (seen.has(url)) {
      dropped++;
      console.warn(`Dropping duplicate submission (Submission URL: ${url})`);
      continue;
    }
    seen.add(url);
    result.push(row);
  }

  if (dropped > 0) {
    console.warn(`Deduplication removed ${dropped} duplicate submission(s).`);
  }
  return result;
}

// =============================================================================
// BLANK / ZERO LOADS AUTO-CORRECTION (Change 3)
// =============================================================================

const LOADS_AUTOSET_NOTE =
  "Loads was blank/0, auto-set to 1 — verify with driver";

/**
 * If Number of Loads is blank/0 but Total tons > 0, set loads to "1" and
 * return an advisory note. Mutates the row in place. Returns null when no
 * correction applies (including the both-empty case, which stays an exception
 * via the quantity rule). Total tons embedded text like "38.39 tons" parses
 * as 38.39 — the same lenient parse used by validateQuantities.
 */
function autoCorrectLoads(row: BillingRow): string | null {
  const loadsStr = row["Total # of loads"] ?? "";
  const tonsStr = row["Total tons"] ?? "";
  const loads = parseFloat(loadsStr.replace(/,/g, "")) || 0;
  const tons = parseFloat(tonsStr.replace(/,/g, "")) || 0;

  const loadsBlankOrZero = loadsStr.trim() === "" || loads === 0;
  if (loadsBlankOrZero && tons > 0) {
    row["Total # of loads"] = "1";
    return LOADS_AUTOSET_NOTE;
  }
  return null;
}

// =============================================================================
// VALIDATION RULE FUNCTIONS
// =============================================================================

/**
 * Rule 1: Required fields (non-empty after trim).
 * Ticket Number is intentionally NOT required — blank becomes "MULTI".
 */
function validateRequiredFields(row: BillingRow): string[] {
  const issues: string[] = [];
  const requiredFields: (keyof BillingRow)[] = [
    "Submitted By",
    "Truck #",
    "North/South job",
    "Pit/Pick up name",
    "Job/Delivery name",
    "Product type",
    "Truck type",
    "Start time",
    "End time",
  ];

  for (const field of requiredFields) {
    const value = row[field];
    if (value === undefined || value === null || value.trim() === "") {
      issues.push(`${field} is required`);
    }
  }
  return issues;
}

/**
 * Rule 2: Truck type validation. Compares using normalized form so casing
 * and "&" vs "and" don't cause false rejections.
 */
function validateTruckType(row: BillingRow): string[] {
  const issues: string[] = [];
  const truckType = row["Truck type"];
  if (!truckType || truckType.trim() === "") return issues;

  if (!NORMALIZED_VALID_TRUCK_TYPES.has(normalizeTruckType(truckType))) {
    issues.push(
      `Invalid Truck type "${truckType}". Must be one of: ${VALID_TRUCK_TYPES.join(", ")}`
    );
  }
  return issues;
}

/**
 * Rule 3: Time parsing and End > Start. Uses the submission date stored on
 * the row to anchor bare HH:MM values into real timestamps.
 */
function validateTimes(row: BillingRow): string[] {
  const issues: string[] = [];
  const startTimeStr = row["Start time"];
  const endTimeStr = row["End time"];
  const submissionDate = row["Submission Date & Time"];

  if (!startTimeStr || !endTimeStr) return issues;

  const startTime = parseTime(startTimeStr, submissionDate);
  const endTime = parseTime(endTimeStr, submissionDate);

  if (!startTime) issues.push(`Cannot parse Start time "${startTimeStr}"`);
  if (!endTime) issues.push(`Cannot parse End time "${endTimeStr}"`);

  if (startTime && endTime && !endTime.isAfter(startTime)) {
    issues.push(
      `End time (${endTimeStr}) must be after Start time (${startTimeStr})`
    );
  }
  return issues;
}

/**
 * Rule 4: Quantity sanity. Tons and loads must not BOTH be empty/0; neither
 * may be negative. Embedded text like "38.39 tons" parses as 38.39 — the
 * unit suffix is ignored.
 */
function validateQuantities(row: BillingRow): string[] {
  const issues: string[] = [];
  const tonsStr = row["Total tons"];
  const loadsStr = row["Total # of loads"];

  const tonsClean = tonsStr.replace(/,/g, "");
  const loadsClean = loadsStr.replace(/,/g, "");
  const tons = parseFloat(tonsClean) || 0;
  const loads = parseFloat(loadsClean) || 0;

  if (tons < 0) issues.push(`Total tons cannot be negative (${tonsStr})`);
  if (loads < 0) issues.push(`Total # of loads cannot be negative (${loadsStr})`);

  const tonsEmpty = tonsStr.trim() === "" || tons === 0;
  const loadsEmpty = loadsStr.trim() === "" || loads === 0;
  if (tonsEmpty && loadsEmpty) {
    issues.push("Both Total tons and Total # of loads cannot be zero/empty");
  }
  return issues;
}

/**
 * Validate a single billing row against all rules. Returns a list of issues
 * (empty list means the row passes).
 */
export function validateRow(row: BillingRow): string[] {
  const issues: string[] = [];
  issues.push(...validateRequiredFields(row));
  issues.push(...validateTruckType(row));
  issues.push(...validateTimes(row));
  issues.push(...validateQuantities(row));
  return issues;
}

function processRow(raw: RawCSVRow, rowIndex: number): RowResult {
  const billingRow = transformRow(raw);
  // Auto-correct blank/0 loads when tons > 0 (mutates billingRow) before
  // validation, so the quantity rule doesn't flag the now-corrected loads.
  const autoNote = autoCorrectLoads(billingRow);
  const issues = validateRow(billingRow);
  return {
    rowIndex,
    billingRow,
    issues,
    isValid: issues.length === 0,
    autoNote,
  };
}

/**
 * Process an entire CSV file. Returns valid rows and exception rows.
 */
export async function processFile(file: File): Promise<ProcessingResult> {
  const parseResult = await parseCSVFile(file);

  if (!parseResult.success) {
    const missingList = parseResult.missingHeaders.join(", ");
    return {
      success: false,
      structureError: `Missing required column(s): ${missingList}`,
      validRows: [],
      exceptionRows: [],
      summary: { totalRows: 0, validCount: 0, exceptionCount: 0 },
    };
  }

  // Deduplicate by Submission URL BEFORE validation so repeat submissions
  // are never double-counted in totals.
  const dedupedData = dedupeBySubmissionUrl(parseResult.data);

  const validRows: BillingRow[] = [];
  const exceptionRows: ExceptionRow[] = [];

  for (let i = 0; i < dedupedData.length; i++) {
    const result = processRow(dedupedData[i], i);
    if (result.isValid) {
      // Valid row — attach the advisory note (if any) without routing to
      // exceptions, so an auto-corrected loads row stays billable.
      if (result.autoNote) {
        result.billingRow["Issue(s)"] = result.autoNote;
      }
      validRows.push(result.billingRow);
    } else {
      // Invalid row — keep the advisory note alongside the real issues so no
      // information is lost in the Exceptions tab.
      const allIssues = result.autoNote
        ? [result.autoNote, ...result.issues]
        : result.issues;
      exceptionRows.push({
        ...result.billingRow,
        "Issue(s)": allIssues.join(", "),
      });
    }
  }

  return {
    success: true,
    structureError: null,
    validRows,
    exceptionRows,
    summary: {
      totalRows: dedupedData.length,
      validCount: validRows.length,
      exceptionCount: exceptionRows.length,
    },
  };
}
