/**
 * FileUploadZone Component
 * Large drag-and-drop area with file picker for CSV upload
 */

import React, { useCallback, useState, useRef } from "react";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export function FileUploadZone({
  onFileSelect,
  isProcessing,
}: FileUploadZoneProps): React.ReactElement {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (isProcessing) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith(".csv")) {
          onFileSelect(file);
        } else {
          alert("Please upload a CSV file.");
        }
      }
    },
    [onFileSelect, isProcessing]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
      // Reset input to allow re-selecting same file
      e.target.value = "";
    },
    [onFileSelect]
  );

  const handleClick = useCallback(() => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  }, [isProcessing]);

  return (
    <div
      className={`file-upload-zone ${isDragActive ? "drag-active" : ""} ${
        isProcessing ? "processing" : ""
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
    >
      <div className="upload-content">
        <div className="upload-icon">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        {isProcessing ? (
          <p className="upload-text">Processing file...</p>
        ) : (
          <>
            <p className="upload-main-text">
              Drag and drop your CSV file here
            </p>
            <p className="upload-sub-text">or click to browse</p>
            <p className="upload-hint">
              Accepts Samsara form export CSV files
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          disabled={isProcessing}
          className="file-input-hidden"
          aria-label="Upload CSV file"
        />
      </div>
    </div>
  );
}
