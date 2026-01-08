# Billing Builder

A web application that transforms Samsara CSV exports into clean billing tables for copy/paste into Parsons billing software.

## Features

- **CSV Upload**: Drag-and-drop or click-to-browse file upload
- **Data Transformation**: Automatic column mapping from Samsara format to billing format
- **Validation**: Comprehensive validation with detailed error reporting
- **Exception Handling**: Invalid rows are flagged with specific issues
- **Export Options**:
  - Download Billing View as CSV
  - Download Excel with both Billing View and Exceptions sheets

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Then open http://localhost:5173 in your browser.

## Column Mapping

| Billing View Column | Samsara CSV Column |
|--------------------|--------------------|
| Truck # | Which truck do you have? |
| North/South job | Region |
| Pit/Pick up name | Which Pit? |
| Job/Delivery name | Job Name (as on ticket / E-Hauler label) |
| Product type | Material Type |
| Ticket # or Multi | Ticket Number (blank → "MULTI") |
| Truck type | Truck Type |
| Start time | Job Start Time |
| End time | Job End Time |
| Total tons | Total tons |
| Total # of loads | Number of Loads |

## Validation Rules

1. **Required Fields**: Truck #, North/South job, Pit/Pick up name, Job/Delivery name, Product type, Truck type, Start time, End time
2. **Truck Type**: Must be exactly "Truck", "Truck & Pup", or "Side Dump"
3. **Time Validation**: Start and End times must be parseable and End must be after Start
4. **Quantity Sanity**: Total tons and Total # of loads cannot both be 0/empty; neither can be negative
5. **CSV Structure**: All 11 required columns must be present in the uploaded CSV

## Usage

1. Export your form submissions from Samsara as CSV
2. Open the Billing Builder app
3. Drag and drop the CSV file (or click to browse)
4. Review the summary (Total/Valid/Exception counts)
5. Check the "Billing View" tab for valid records ready for copy/paste
6. Check the "Exceptions" tab for rows with validation issues
7. Download CSV or Excel as needed

## Downloads

- **Download Billing View CSV**: Exports only valid rows with the 11 billing columns
- **Download Excel**: Creates an .xlsx file with two sheets:
  - `Billing_View`: Valid rows with 11 columns
  - `Exceptions`: Exception rows with 11 columns + Issue(s) column

## Technology Stack

- React 18
- TypeScript
- Vite
- PapaParse (CSV parsing)
- SheetJS/xlsx (Excel generation)
- dayjs (date/time parsing)

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.
