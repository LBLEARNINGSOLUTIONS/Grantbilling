/**
 * TruckSummaryPanel Component
 * Displays daily truck hours summary with copy-to-clipboard functionality
 * Shows email-ready text block matching Maggie's format to Parsons
 */

import React, { useState } from "react";
import { TruckSummaryResult } from "../types/billing";

interface TruckSummaryPanelProps {
  summary: TruckSummaryResult;
}

export function TruckSummaryPanel({
  summary,
}: TruckSummaryPanelProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary.fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  if (summary.summaryRows.length === 0) {
    return (
      <div className="empty-table-message">
        <p>No valid rows to summarize.</p>
        <p className="empty-hint">
          Upload a CSV with valid billing records to see the truck summary.
        </p>
      </div>
    );
  }

  return (
    <div className="truck-summary-panel">
      {/* Email-ready text block */}
      <div className="summary-text-block">
        <pre className="summary-text">{summary.fullText}</pre>
        <button className="copy-button" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy Summary to Clipboard"}
        </button>
      </div>

      {/* Table view */}
      <div className="summary-table-container">
        <h4>Hours by Truck</h4>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Truck</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {summary.summaryRows.map((row, index) => (
              <tr key={index}>
                <td>{row.label}</td>
                <td>{row.totalHours.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
