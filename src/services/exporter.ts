/**
 * Exporter Service
 * Handles CSV and Excel file downloads
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { BillingRow, ExceptionRow, OUTPUT_HEADERS, TruckSummaryResult } from "../types/billing";

/**
 * Convert billing rows to CSV string
 * Uses exact column order from OUTPUT_HEADERS
 */
export function billingRowsToCSV(rows: BillingRow[]): string {
  return Papa.unparse(rows, {
    columns: [...OUTPUT_HEADERS],
    header: true,
  });
}

/**
 * Trigger a file download in the browser
 */
function downloadFile(content: BlobPart, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download valid billing rows as CSV
 * Filename: billing-view-YYYY-MM-DD.csv
 */
export function downloadBillingCSV(rows: BillingRow[]): void {
  const csv = billingRowsToCSV(rows);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `billing-view-${date}.csv`;
  downloadFile(csv, filename, "text/csv;charset=utf-8;");
}

/**
 * Download Excel workbook with three sheets:
 * - Sheet 1: "Billing_View" (11 columns, valid rows only)
 * - Sheet 2: "Exceptions" (11 columns + "Issue(s)", exception rows only)
 * - Sheet 3: "Daily_Truck_Summary" (email-ready text block + hours table)
 */
export function downloadExcel(
  validRows: BillingRow[],
  exceptionRows: ExceptionRow[],
  truckSummary: TruckSummaryResult
): void {
  // Create workbook
  const workbook = XLSX.utils.book_new();

  // -------------------------------------------------------------------------
  // Sheet 1: Billing_View (valid rows with 11 columns)
  // -------------------------------------------------------------------------
  const billingData: string[][] = [
    // Header row
    [...OUTPUT_HEADERS],
    // Data rows
    ...validRows.map((row) =>
      OUTPUT_HEADERS.map((header) => row[header] ?? "")
    ),
  ];

  const billingSheet = XLSX.utils.aoa_to_sheet(billingData);

  // Set column widths for readability
  billingSheet["!cols"] = OUTPUT_HEADERS.map((header) => ({
    wch: Math.max(header.length + 2, 15),
  }));

  XLSX.utils.book_append_sheet(workbook, billingSheet, "Billing_View");

  // -------------------------------------------------------------------------
  // Sheet 2: Exceptions (11 columns + Issue(s))
  // -------------------------------------------------------------------------
  const exceptionHeaders = [...OUTPUT_HEADERS, "Issue(s)"] as const;

  const exceptionData: string[][] = [
    // Header row
    [...exceptionHeaders],
    // Data rows
    ...exceptionRows.map((row) =>
      exceptionHeaders.map((header) => {
        if (header === "Issue(s)") {
          return row["Issue(s)"];
        }
        return row[header as keyof BillingRow] ?? "";
      })
    ),
  ];

  const exceptionsSheet = XLSX.utils.aoa_to_sheet(exceptionData);

  // Set column widths for readability
  exceptionsSheet["!cols"] = exceptionHeaders.map((header) => ({
    wch: header === "Issue(s)" ? 50 : Math.max(header.length + 2, 15),
  }));

  XLSX.utils.book_append_sheet(workbook, exceptionsSheet, "Exceptions");

  // -------------------------------------------------------------------------
  // Sheet 3: Daily_Truck_Summary (email-ready text + table)
  // -------------------------------------------------------------------------
  const summaryData: (string | number)[][] = [];

  // Email-ready text block at top
  if (truckSummary.headerLine) {
    summaryData.push([truckSummary.headerLine]);
    for (const line of truckSummary.textLines) {
      summaryData.push([line]);
    }

    // Empty rows for spacing
    summaryData.push([]);
    summaryData.push([]);
  }

  // Table header
  summaryData.push(["Truck", "Hours"]);

  // Table data
  for (const row of truckSummary.summaryRows) {
    summaryData.push([row.label, row.totalHours]);
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Daily_Truck_Summary");

  // -------------------------------------------------------------------------
  // Write and download
  // -------------------------------------------------------------------------
  const date = new Date().toISOString().slice(0, 10);
  const filename = `billing-export-${date}.xlsx`;

  // Generate Excel file as array buffer
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  downloadFile(
    excelBuffer,
    filename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}
