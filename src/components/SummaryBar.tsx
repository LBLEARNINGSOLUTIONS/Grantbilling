/**
 * SummaryBar Component
 * Displays Total rows | Valid rows | Exception rows counts
 */

import React from "react";
import { ProcessingSummary } from "../types/billing";

interface SummaryBarProps {
  summary: ProcessingSummary;
  fileName: string;
}

export function SummaryBar({
  summary,
  fileName,
}: SummaryBarProps): React.ReactElement {
  return (
    <div className="summary-bar">
      <div className="summary-file">
        <span className="summary-label">File:</span>
        <span className="summary-value">{fileName}</span>
      </div>

      <div className="summary-stats">
        <div className="summary-stat">
          <span className="stat-value">{summary.totalRows}</span>
          <span className="stat-label">Total Rows</span>
        </div>

        <div className="summary-stat valid">
          <span className="stat-value">{summary.validCount}</span>
          <span className="stat-label">Valid</span>
        </div>

        <div className="summary-stat exception">
          <span className="stat-value">{summary.exceptionCount}</span>
          <span className="stat-label">Exceptions</span>
        </div>
      </div>
    </div>
  );
}
