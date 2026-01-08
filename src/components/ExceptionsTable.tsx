/**
 * ExceptionsTable Component
 * Displays exception rows with Issue(s) column
 * With pagination for better performance with large datasets
 */

import React, { useState, useMemo } from "react";
import { ExceptionRow, OUTPUT_HEADERS } from "../types/billing";

const ROWS_PER_PAGE = 50;

interface ExceptionsTableProps {
  rows: ExceptionRow[];
}

export function ExceptionsTable({
  rows,
}: ExceptionsTableProps): React.ReactElement {
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate pagination
  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, rows.length);

  // Get current page rows
  const currentRows = useMemo(
    () => rows.slice(startIndex, endIndex),
    [rows, startIndex, endIndex]
  );

  // Reset to page 1 when rows change significantly
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [rows.length, totalPages, currentPage]);

  if (rows.length === 0) {
    return (
      <div className="empty-table-message success">
        <p>All rows passed validation!</p>
        <p className="empty-hint">No exceptions found.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      {/* Pagination controls - top */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <span className="pagination-info">
            Showing {startIndex + 1}-{endIndex} of {rows.length} exceptions
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
        <table className="exceptions-table">
          <thead>
            <tr>
              <th className="row-num-header">#</th>
              {OUTPUT_HEADERS.map((header) => (
                <th key={header}>{header}</th>
              ))}
              <th className="issues-header">Issue(s)</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row, index) => (
              <tr key={startIndex + index} className="exception-row">
                <td className="row-num">{startIndex + index + 1}</td>
                {OUTPUT_HEADERS.map((header) => (
                  <td key={header}>{row[header]}</td>
                ))}
                <td className="issues-cell">{row["Issue(s)"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
