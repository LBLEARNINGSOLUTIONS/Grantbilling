/**
 * Validator Service
 * Implements all 5 validation rules for billing data
 *
 * Rules:
 * 1. Required fields (non-empty after trim)
 * 2. Truck type enum validation
 * 3. Time parsing + End > Start validation
 * 4. Quantity sanity (not both 0/empty, no negatives)
 * 5. CSV structure (all required headers present)
 */

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import {
  RawCSVRow,
  BillingRow,
  ExceptionRow,
  ProcessingResult,
  RowResult,
  VALID_TRUCK_TYPES,
  TruckType,
} from "../types/billing";
import { parseCSVFile } from "./csvParser";
import { transformRow } from "./transformer";

// Enable custom format parsing for dayjs
dayjs.extend(customParseFormat);

/**
 * Supported datetime formats for parsing Samsara times
 * Primary format: "Jan 6 2026 1:00PM MST"
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

// =============================================================================
// VALIDATION RULE FUNCTIONS
// =============================================================================

/**
 * Rule 1: Required fields validation
 * Required fields: Truck #, North/South job, Pit/Pick up name, Job/Delivery name,
 *                  Product type, Truck type, Start time, End time
 * Note: "Ticket # or Multi" is NOT required (blank becomes "MULTI")
 */
function validateRequiredFields(row: BillingRow): string[] {
  const issues: string[] = [];

  const requiredFields: (keyof BillingRow)[] = [
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
 * Rule 2: Truck type enum validation
 * Must be exactly one of: "Truck", "Truck & Pup", "Side Dump"
 */
function validateTruckType(row: BillingRow): string[] {
  const issues: string[] = [];
  const truckType = row["Truck type"];

  // Skip if empty (will be caught by required fields)
  if (!truckType || truckType.trim() === "") {
    return issues;
  }

  if (!VALID_TRUCK_TYPES.includes(truckType as TruckType)) {
    issues.push(
      `Invalid Truck type "${truckType}". Must be one of: ${VALID_TRUCK_TYPES.join(", ")}`
    );
  }

  return issues;
}

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
 * Rule 3: Time validation
 * - Parse Start time and End time
 * - If parsing fails: exception
 * - If End time <= Start time: exception
 */
function validateTimes(row: BillingRow): string[] {
  const issues: string[] = [];
  const startTimeStr = row["Start time"];
  const endTimeStr = row["End time"];

  // Skip validation if times are empty (caught by required fields)
  if (!startTimeStr || !endTimeStr) {
    return issues;
  }

  const startTime = parseDateTime(startTimeStr);
  const endTime = parseDateTime(endTimeStr);

  // Check if start time parsing failed
  if (!startTime) {
    issues.push(`Cannot parse Start time "${startTimeStr}"`);
  }

  // Check if end time parsing failed
  if (!endTime) {
    issues.push(`Cannot parse End time "${endTimeStr}"`);
  }

  // If both parsed successfully, check End > Start
  if (startTime && endTime) {
    if (!endTime.isAfter(startTime)) {
      issues.push(
        `End time (${endTimeStr}) must be after Start time (${startTimeStr})`
      );
    }
  }

  return issues;
}

/**
 * Rule 4: Quantity sanity validation
 * - Total tons and Total # of loads cannot BOTH be empty/0
 * - Neither can be negative
 */
function validateQuantities(row: BillingRow): string[] {
  const issues: string[] = [];
  const tonsStr = row["Total tons"];
  const loadsStr = row["Total # of loads"];

  // Parse numeric values (handle commas in numbers)
  const tonsClean = tonsStr.replace(/,/g, "");
  const loadsClean = loadsStr.replace(/,/g, "");

  const tons = parseFloat(tonsClean) || 0;
  const loads = parseFloat(loadsClean) || 0;

  // Check for negative values
  if (tons < 0) {
    issues.push(`Total tons cannot be negative (${tonsStr})`);
  }

  if (loads < 0) {
    issues.push(`Total # of loads cannot be negative (${loadsStr})`);
  }

  // Check that not both are zero/empty
  const tonsEmpty = tonsStr.trim() === "" || tons === 0;
  const loadsEmpty = loadsStr.trim() === "" || loads === 0;

  if (tonsEmpty && loadsEmpty) {
    issues.push("Both Total tons and Total # of loads cannot be zero/empty");
  }

  return issues;
}

/**
 * Validate a single billing row against all rules
 * Returns array of issue messages (empty if valid)
 */
export function validateRow(row: BillingRow): string[] {
  const issues: string[] = [];

  // Apply all validation rules
  issues.push(...validateRequiredFields(row));
  issues.push(...validateTruckType(row));
  issues.push(...validateTimes(row));
  issues.push(...validateQuantities(row));

  return issues;
}

/**
 * Process a single row: transform and validate
 */
function processRow(raw: RawCSVRow, rowIndex: number): RowResult {
  const billingRow = transformRow(raw);
  const issues = validateRow(billingRow);

  return {
    rowIndex,
    billingRow,
    issues,
    isValid: issues.length === 0,
  };
}

/**
 * Process an entire CSV file
 * Returns valid rows and exception rows with issues
 */
export async function processFile(file: File): Promise<ProcessingResult> {
  // Parse the CSV file
  const parseResult = await parseCSVFile(file);

  // Check for structure errors (missing headers)
  if (!parseResult.success) {
    const missingList = parseResult.missingHeaders.join(", ");
    return {
      success: false,
      structureError: `Missing required column(s): ${missingList}`,
      validRows: [],
      exceptionRows: [],
      summary: {
        totalRows: 0,
        validCount: 0,
        exceptionCount: 0,
      },
    };
  }

  // Process each row
  const validRows: BillingRow[] = [];
  const exceptionRows: ExceptionRow[] = [];

  for (let i = 0; i < parseResult.data.length; i++) {
    const result = processRow(parseResult.data[i], i);

    if (result.isValid) {
      validRows.push(result.billingRow);
    } else {
      // Create exception row with Issue(s) column
      const exceptionRow: ExceptionRow = {
        ...result.billingRow,
        "Issue(s)": result.issues.join(", "),
      };
      exceptionRows.push(exceptionRow);
    }
  }

  return {
    success: true,
    structureError: null,
    validRows,
    exceptionRows,
    summary: {
      totalRows: parseResult.data.length,
      validCount: validRows.length,
      exceptionCount: exceptionRows.length,
    },
  };
}
