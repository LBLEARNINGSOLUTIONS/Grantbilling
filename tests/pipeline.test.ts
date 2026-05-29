/**
 * Pipeline tests for the four V3 fix behaviors:
 *   A — grouping merges normalized-equal keys (no duplicate output keys)
 *   B — submission dedup by Submission URL
 *   C — blank/0 loads with tons > 0 auto-set to 1 and kept in validRows
 *   D — full pipeline runs end-to-end without throwing
 *
 * Runs in jsdom (see vitest.config.ts) so the File/FileReader globals that
 * PapaParse needs are available, letting processFile run against a real File.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Papa from "papaparse";

import { processFile, dedupeBySubmissionUrl } from "../src/services/validator";
import { buildGroupedBilling, normalizeKey } from "../src/services/groupedBilling";
import { RawCSVRow } from "../src/types/billing";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "fixtures", "apr_to_may_2026.csv");
const csvContent = readFileSync(FIXTURE_PATH, "utf-8");

function makeFile(content: string): File {
  return new File([content], "apr_to_may_2026.csv", { type: "text/csv" });
}

function parseRaw(content: string): RawCSVRow[] {
  return Papa.parse<RawCSVRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  }).data;
}

const AUTOSET_MARKER = "auto-set to 1";

describe("billing pipeline fixes", () => {
  it("Test A — no two output rows share the same normalized group key", async () => {
    const result = await processFile(makeFile(csvContent));
    const grouped = buildGroupedBilling(result.validRows);

    const keys = grouped.map((g) =>
      [
        g["Submitted By"],
        g["Truck #"],
        g["Pit/Pick up name"],
        g["Job/Delivery name"],
        g["Product type"],
      ]
        .map(normalizeKey)
        .join("|")
    );

    expect(new Set(keys).size).toBe(keys.length);

    // Sanity: the three casing/spacing variants of Clint+BODEC collapsed into
    // a single output row (would be 3 distinct rows without normalization).
    const bodecRows = grouped.filter(
      (g) => normalizeKey(g["Job/Delivery name"]) === "bodec inc."
    );
    expect(bodecRows.length).toBe(1);
    expect(bodecRows[0].submissionCount).toBe(3);
  });

  it("Test B — after dedup, input row count equals unique Submission URL count", () => {
    const rawRows = parseRaw(csvContent);
    const uniqueUrls = new Set(
      rawRows.map((r) => (r["Submission URL"] ?? "").trim()).filter((u) => u !== "")
    );

    const deduped = dedupeBySubmissionUrl(rawRows);

    expect(deduped.length).toBe(uniqueUrls.size);
    // Fixture has one intentional duplicate (dup1), so dedup drops exactly one.
    expect(deduped.length).toBe(rawRows.length - 1);
  });

  it("Test C — blank/0 loads with tons > 0 land in validRows with loads=1 and a note", async () => {
    const result = await processFile(makeFile(csvContent));

    const autoCorrected = result.validRows.filter((r) =>
      (r["Issue(s)"] ?? "").includes(AUTOSET_MARKER)
    );

    // Fixture has two such rows (Tim, trucks 136 and 137).
    expect(autoCorrected.length).toBe(2);
    for (const row of autoCorrected) {
      expect(row["Total # of loads"]).toBe("1");
      expect(row["Issue(s)"]).toContain("Loads was blank/0, auto-set to 1");
    }

    // These rows must NOT be routed to exceptions.
    const exceptionAutoset = result.exceptionRows.filter((r) =>
      r["Issue(s)"].includes(AUTOSET_MARKER)
    );
    expect(exceptionAutoset.length).toBe(0);

    // The genuine both-zero row stays an exception (current behavior preserved).
    const bothZeroException = result.exceptionRows.some((r) =>
      r["Issue(s)"].includes("cannot be zero/empty")
    );
    expect(bothZeroException).toBe(true);

    // The verify flag must propagate through grouping so the dashboard can
    // badge the line. Both auto-corrected rows are on distinct trucks, so
    // exactly two grouped line items should carry a verifyNote.
    const grouped = buildGroupedBilling(result.validRows);
    const flagged = grouped.filter((g) => g.verifyNote !== "");
    expect(flagged.length).toBe(2);
    for (const g of flagged) {
      expect(g.verifyNote).toContain("auto-set to 1");
    }
  });

  it("Test D — pipeline runs end-to-end without throwing", async () => {
    const result = await processFile(makeFile(csvContent));
    const grouped = buildGroupedBilling(result.validRows);

    expect(result.success).toBe(true);
    expect(grouped.length).toBeGreaterThan(0);
    // 6 distinct line items from the fixture (see fixture comments).
    expect(grouped.length).toBe(6);
  });
});

// =============================================================================
// Mixed-columns CSV: Samsara now exports BOTH old and new column names side
// by side after Maggie's mid-2026 form edits. Submissions made before the
// rename populate the OLD columns; submissions made after populate the NEW
// ones. The header also has a duplicate "Which Pit?" column (an artifact of
// the form's conditional follow-up questions) — for North-region submissions
// the value lives in the second occurrence; for South, the first.
// =============================================================================

const MIXED_FIXTURE_PATH = join(__dirname, "fixtures", "mixed_columns.csv");
const mixedCsvContent = readFileSync(MIXED_FIXTURE_PATH, "utf-8");

describe("mixed old/new column handling", () => {
  it("Test E — rows with OLD loads/tons columns are read via fallback", async () => {
    const result = await processFile(
      new File([mixedCsvContent], "mixed_columns.csv", { type: "text/csv" })
    );

    // The "old-loads" row (Steve Davis, truck 24, Brigham City, Tycon, road
    // base) has blank NEW Total Tons / Loads on this Trip and populated OLD
    // Total tons (38.50) / Number of Loads (3). The fallback must surface
    // those values into the BillingRow.
    const oldLoadsRow = result.validRows.find(
      (r) => r["Submitted By"] === "Steve Davis" && r["Truck #"] === "24"
    );
    expect(oldLoadsRow).toBeDefined();
    expect(oldLoadsRow!["Total tons"]).toBe("38.50");
    expect(oldLoadsRow!["Total # of loads"]).toBe("3");
  });

  it("Test F — duplicate 'Which Pit?' columns resolve correctly per region", async () => {
    const result = await processFile(
      new File([mixedCsvContent], "mixed_columns.csv", { type: "text/csv" })
    );

    // North-region row: pit value lives in the SECOND "Which Pit?" column
    // (which csvParser renames to "Which Pit? (2)"). Falls back through.
    const north = result.validRows.find(
      (r) =>
        r["Submitted By"] === "Clint Dahl" &&
        r["North/South job"] === "North" &&
        r["Job/Delivery name"] === "BODEC INC."
    );
    expect(north).toBeDefined();
    expect(north!["Pit/Pick up name"]).toBe("Maguire");

    // South-region row: pit value lives in the FIRST "Which Pit?" column.
    const south = result.validRows.find(
      (r) =>
        r["Submitted By"] === "Clint Dahl" &&
        r["North/South job"] === "South" &&
        r["Job/Delivery name"] === "NEPHI CO"
    );
    expect(south).toBeDefined();
    expect(south!["Pit/Pick up name"]).toBe("Nebo");
  });

  it("Test G — rows missing Truck Number (older submissions) route to exceptions", async () => {
    const result = await processFile(
      new File([mixedCsvContent], "mixed_columns.csv", { type: "text/csv" })
    );

    // Tim Sacre's row has blank Truck Number — would have been a valid row
    // before Maggie added the truck-number question. It must surface in the
    // Exceptions tab with a clear message rather than silently vanish.
    const exceptions = result.exceptionRows.filter(
      (r) => r["Submitted By"] === "Tim Sacre"
    );
    expect(exceptions.length).toBe(1);
    expect(exceptions[0]["Issue(s)"]).toContain("Truck # is required");
  });
});
