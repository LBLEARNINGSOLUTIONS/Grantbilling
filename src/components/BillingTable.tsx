/**
 * BillingTable Component
 *
 * Displays grouped billing line items (one row per
 * driver+truck+pit+customer+material). Includes a truck-number filter
 * dropdown and pagination. Total Time is shown in two formats so Maggie
 * can read whichever one Parsons wants on a given invoice.
 */

import React, { useState, useMemo } from "react";
import { GroupedBillingRow, TRUCK_NUMBERS } from "../types/billing";

const ROWS_PER_PAGE = 50;
const ALL_TRUCKS = "__ALL__";

interface BillingTableProps {
  rows: GroupedBillingRow[];
}

export function BillingTable({ rows }: BillingTableProps): React.ReactElement {
  const [currentPage, setCurrentPage] = useState(1);
  const [truckFilter, setTruckFilter] = useState<string>(ALL_TRUCKS);

  const filteredRows = useMemo(
    () =>
      truckFilter === ALL_TRUCKS
        ? rows
        : rows.filter((r) => r["Truck #"] === truckFilter),
    [rows, truckFilter]
  );

  const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, filteredRows.length);

  const currentRows = useMemo(
    () => filteredRows.slice(startIndex, endIndex),
    [filteredRows, startIndex, endIndex]
  );

  // If pagination context outgrows the new filtered view, snap back to page 1.
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredRows.length, totalPages, currentPage]);

  // Reset to page 1 when filter changes so the user always sees the top.
  React.useEffect(() => {
    setCurrentPage(1);
  }, [truckFilter]);

  if (rows.length === 0) {
    return (
      <div className="empty-table-message">
        <p>No valid billing records to display.</p>
        <p className="empty-hint">
          All rows may have validation issues. Check the Exceptions tab.
        </p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <div className="table-toolbar">
        <label className="filter-label">
          Truck #:
          <select
            className="filter-select"
            value={truckFilter}
            onChange={(e) => setTruckFilter(e.target.value)}
          >
            <option value={ALL_TRUCKS}>All trucks</option>
            {TRUCK_NUMBERS.map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </label>
        {truckFilter !== ALL_TRUCKS && (
          <span className="filter-summary">
            Showing {filteredRows.length} of {rows.length} line items
          </span>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <span className="pagination-info">
            {filteredRows.length === 0
              ? "0 rows"
              : `Showing ${startIndex + 1}-${endIndex} of ${filteredRows.length} rows`}
          </span>
          <div className="pagination-buttons">
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </button>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span className="pagination-current">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="billing-table">
          <thead>
            <tr>
              <th className="row-num-header">#</th>
              <th>Driver</th>
              <th>Truck #</th>
              <th>North/South job</th>
              <th>Pit/Pick up name</th>
              <th>Job/Delivery name</th>
              <th>Product type</th>
              <th>Truck type</th>
              <th>Ticket # or Multi</th>
              <th>Start time</th>
              <th>End time</th>
              <th>Total tons</th>
              <th>Total # of loads</th>
              <th>Total Time</th>
              <th>Hrs (decimal)</th>
              <th>Submissions</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row, index) => (
              <tr key={startIndex + index}>
                <td className="row-num">{startIndex + index + 1}</td>
                <td>{row["Submitted By"]}</td>
                <td>{row["Truck #"]}</td>
                <td>{row["North/South job"]}</td>
                <td>{row["Pit/Pick up name"]}</td>
                <td>{row["Job/Delivery name"]}</td>
                <td>{row["Product type"]}</td>
                <td>{row["Truck type"]}</td>
                <td>{row["Ticket # or Multi"]}</td>
                <td>{row["Start time"]}</td>
                <td>{row["End time"]}</td>
                <td>{row["Total tons"]}</td>
                <td>{row["Total # of loads"]}</td>
                <td>{row.totalTimeHHMM}</td>
                <td>{row.totalTimeDecimal}</td>
                <td>{row.submissionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
