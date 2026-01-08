/**
 * Billing Builder App
 * Main application component
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  FileUploadZone,
  SummaryBar,
  Tabs,
  Tab,
  BillingTable,
  ExceptionsTable,
  TruckSummaryPanel,
} from "./components";
import { processFile } from "./services/validator";
import { downloadBillingCSV, downloadExcel } from "./services/exporter";
import { buildDailyTruckSummary } from "./services/truckSummary";
import { BillingRow, ExceptionRow, ProcessingSummary } from "./types/billing";
import "./App.css";

type TabId = "billing" | "exceptions" | "summary";

interface AppState {
  fileNames: string[];
  validRows: BillingRow[];
  exceptionRows: ExceptionRow[];
  structureError: string | null;
  isProcessing: boolean;
}

const initialState: AppState = {
  fileNames: [],
  validRows: [],
  exceptionRows: [],
  structureError: null,
  isProcessing: false,
};

function App(): React.ReactElement {
  const [state, setState] = useState<AppState>(initialState);
  const [activeTab, setActiveTab] = useState<TabId>("billing");

  const handleFileSelect = useCallback(async (file: File) => {
    setState((prev) => ({
      ...prev,
      isProcessing: true,
      structureError: null,
    }));

    try {
      const result = await processFile(file);

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          structureError: result.structureError,
          isProcessing: false,
        }));
        return;
      }

      // Append new rows to existing rows
      setState((prev) => ({
        fileNames: [...prev.fileNames, file.name],
        validRows: [...prev.validRows, ...result.validRows],
        exceptionRows: [...prev.exceptionRows, ...result.exceptionRows],
        structureError: null,
        isProcessing: false,
      }));

      // Auto-switch to exceptions tab if new file has only exceptions
      if (result.validRows.length === 0 && result.exceptionRows.length > 0) {
        setActiveTab("exceptions");
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        structureError:
          error instanceof Error ? error.message : "Unknown error occurred",
        isProcessing: false,
      }));
    }
  }, []);

  const handleReset = useCallback(() => {
    setState(initialState);
    setActiveTab("billing");
  }, []);

  const handleDownloadCSV = useCallback(() => {
    if (state.validRows.length > 0) {
      downloadBillingCSV(state.validRows);
    }
  }, [state.validRows]);

  // Compute truck summary from valid rows
  const truckSummary = useMemo(
    () => buildDailyTruckSummary(state.validRows),
    [state.validRows]
  );

  const handleDownloadExcel = useCallback(() => {
    downloadExcel(state.validRows, state.exceptionRows, truckSummary);
  }, [state.validRows, state.exceptionRows, truckSummary]);

  const hasData = state.validRows.length > 0 || state.exceptionRows.length > 0;

  // Compute summary from current state
  const summary: ProcessingSummary = {
    totalRows: state.validRows.length + state.exceptionRows.length,
    validCount: state.validRows.length,
    exceptionCount: state.exceptionRows.length,
  };

  // Display file names
  const fileDisplayName = state.fileNames.length === 0
    ? ""
    : state.fileNames.length === 1
    ? state.fileNames[0]
    : `${state.fileNames.length} files combined`;

  const tabs: Tab[] = [
    { id: "billing", label: "Billing View", count: state.validRows.length },
    { id: "exceptions", label: "Exceptions", count: state.exceptionRows.length },
    { id: "summary", label: "Daily Truck Summary", count: truckSummary.summaryRows.length },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Billing Builder</h1>
        {hasData && (
          <button className="reset-button" onClick={handleReset}>
            Clear All Data
          </button>
        )}
      </header>

      <main className="app-main">
        {/* Structure error */}
        {state.structureError && (
          <div className="error-banner">
            <strong>Error:</strong> {state.structureError}
            <button className="error-dismiss" onClick={() => setState(prev => ({ ...prev, structureError: null }))}>
              Dismiss
            </button>
          </div>
        )}

        {/* Upload section - always visible */}
        <section className={`upload-section ${hasData ? "compact" : ""}`}>
          <FileUploadZone
            onFileSelect={handleFileSelect}
            isProcessing={state.isProcessing}
          />
        </section>

        {/* Results section */}
        {hasData && (
          <>
            {/* Summary bar */}
            <section className="summary-section">
              <SummaryBar
                summary={summary}
                fileName={fileDisplayName}
              />
            </section>

            {/* Export buttons */}
            <section className="export-section">
              <div className="export-buttons">
                <button
                  className="export-button csv"
                  onClick={handleDownloadCSV}
                  disabled={state.validRows.length === 0}
                >
                  Download Billing View CSV
                </button>
                <button
                  className="export-button excel"
                  onClick={handleDownloadExcel}
                  disabled={
                    state.validRows.length === 0 &&
                    state.exceptionRows.length === 0
                  }
                >
                  Download Excel (Billing View + Exceptions)
                </button>
              </div>
            </section>

            {/* Tabs and data tables */}
            <section className="data-section">
              <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as TabId)}
              />

              <div
                className="tab-panel"
                role="tabpanel"
                id={`panel-${activeTab}`}
              >
                {activeTab === "billing" && (
                  <BillingTable rows={state.validRows} />
                )}
                {activeTab === "exceptions" && (
                  <ExceptionsTable rows={state.exceptionRows} />
                )}
                {activeTab === "summary" && (
                  <TruckSummaryPanel summary={truckSummary} />
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Billing Builder v1.2</p>
      </footer>
    </div>
  );
}

export default App;
