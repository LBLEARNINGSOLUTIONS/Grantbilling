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
 * Check whether a header slot (single name or list of acceptable variants)
 * is satisfied by the parsed CSV headers.
 */
function slotSatisfied(slot: string | readonly string[], headers: string[]): boolean {
  const variants = Array.isArray(slot) ? slot : [slot as string];
  return variants.some((v) => headers.includes(v));
}

/**
 * Return the user-facing name for a slot — the first variant (or the slot
 * itself if it's already a single name).
 */
function slotName(slot: string | readonly string[]): string {
  return Array.isArray(slot) ? slot[0] : (slot as string);
}

function findMissingHeaders(headers: string[]): string[] {
  return REQUIRED_INPUT_HEADERS.filter((slot) => !slotSatisfied(slot, headers)).map(
    slotName
  );
}

/**
 * Parse a CSV file and return typed rows
 *
 * @param file - The CSV file to parse
 * @returns Promise with parsed data, headers, and any errors
 */
export function parseCSVFile(file: File): Promise<ParseResult> {
  // Cache transformed headers by column index. PapaParse can call
  // transformHeader more than once per column (e.g. once during a preview
  // pass and again during the full parse, especially under jsdom), so the
  // function must be idempotent. Keying by index guarantees the same
  // returned name across calls.
  const headerCache = new Map<number, string>();

  return new Promise((resolve) => {
    Papa.parse<RawCSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      // Trim whitespace, strip UTF-8 BOM (Samsara prefixes one), and
      // normalize unicode dash variants to ASCII so renamed-with-en-dash
      // headers still match. Duplicate "Which Pit?" gets disambiguated:
      // the first occurrence keeps its name; later ones become
      // "Which Pit? (2)" etc. so PapaParse doesn't silently collapse rows.
      transformHeader: (header: string, index?: number) => {
        const idx = index ?? -1;
        if (idx >= 0 && headerCache.has(idx)) {
          return headerCache.get(idx)!;
        }
        const cleaned = header
          .replace(/^﻿/, "")
          .trim()
          .replace(/[‐‑‒–—−]/g, "-");

        let final = cleaned;
        if (cleaned === "Which Pit?") {
          const priorPits = Array.from(headerCache.values()).filter(
            (v) => v === "Which Pit?" || v.startsWith("Which Pit? (")
          ).length;
          if (priorPits > 0) {
            final = `Which Pit? (${priorPits + 1})`;
          }
        }

        if (idx >= 0) headerCache.set(idx, final);
        return final;
      },
      complete: (results) => {
        const headers = results.meta.fields || [];

        const missingHeaders = findMissingHeaders(headers);

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
          missingHeaders: REQUIRED_INPUT_HEADERS.map(slotName),
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
  return findMissingHeaders(headers);
}
