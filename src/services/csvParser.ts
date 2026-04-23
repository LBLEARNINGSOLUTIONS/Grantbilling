/**
 * CSV Parser Service
 * Parses uploaded CSV files using PapaParse
 */

import Papa from "papaparse";
import { RawCSVRow, REQUIRED_INPUT_HEADERS } from "../types/billing";

/**
 * Result of parsing a CSV file
 */
export interface ParseResult {
  success: boolean;
  data: RawCSVRow[];
  headers: string[];
  missingHeaders: string[];
  parseErrors: string[];
}

/**
 * Parse a CSV file and return typed rows
 *
 * @param file - The CSV file to parse
 * @returns Promise with parsed data, headers, and any errors
 */
export function parseCSVFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<RawCSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      // Trim whitespace and normalize unicode dash variants to ASCII hyphen
      // so exports with en-dash / em-dash / non-breaking hyphen still match.
      transformHeader: (header: string) =>
        header.trim().replace(/[‐‑‒–—−]/g, "-"),
      complete: (results) => {
        const headers = results.meta.fields || [];

        // Check for missing required headers (exact string match)
        const missingHeaders = REQUIRED_INPUT_HEADERS.filter(
          (required) => !headers.includes(required)
        );

        // Collect any parse errors
        const parseErrors = results.errors.map(
          (e) => `Row ${e.row}: ${e.message}`
        );

        resolve({
          success: missingHeaders.length === 0,
          data: results.data,
          headers,
          missingHeaders,
          parseErrors,
        });
      },
      error: (error) => {
        resolve({
          success: false,
          data: [],
          headers: [],
          missingHeaders: [...REQUIRED_INPUT_HEADERS],
          parseErrors: [error.message],
        });
      },
    });
  });
}

/**
 * Validate that all required headers are present in the CSV
 * Returns array of missing header names (empty if all present)
 *
 * @param headers - Array of headers found in the CSV
 * @returns Array of missing header names
 */
export function validateHeaders(headers: string[]): string[] {
  return REQUIRED_INPUT_HEADERS.filter(
    (required) => !headers.includes(required)
  );
}
