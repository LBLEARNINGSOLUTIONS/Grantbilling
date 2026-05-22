/**
 * BillingTable Component (V2 — driver-grouped)
 *
 * Renders aggregated billing line items grouped into driver sections, with a
 * filter bar above (Driver, Truck #, Customer, Date Range). Filters compose
 * with AND between filter types and OR within a filter type. Driver totals
 * recalculate against the FILTERED rows. Lines within each driver section
 * are sorted by start time ascending and numbered Line 1, Line 2, ... per
 * Maggie's mental model ("Tim 1, 2, 3 — then Clint 1, 2, 3").
 */

import React, { useMemo, useState } from "react";
import {
  GroupedBillingRow,
  TRUCK_NUMBERS,
  RUNNING_FOR_OPTIONS,
} from "../types/billing";
import { parseTime, formatHHMM } from "../services/timeParser";

interface BillingTableProps {
  rows: GroupedBillingRow[];
}

interface DriverGroup {
  driver: string;
  lines: GroupedBillingRow[];
  totals: { minutes: number; loads: number; tons: number };
}

// Numeric value used to sort lines within a driver section. Falls back to the
// raw string if parseTime fails so we still get a stable order.
function startTimeSortKey(row: GroupedBillingRow): number {
  const parsed = parseTime(row["Start time"], `${row.date} 00:00:00`);
  return parsed ? parsed.valueOf() : 0;
}

function parseFloatSafe(value: string): number {
  const n = parseFloat(value.replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v))).sort((a, b) =>
    a.localeCompare(b)
  );
}

/**
 * Order customers with the canonical RUNNING_FOR_OPTIONS first (in spec
 * order), then any unknown values alphabetically. Keeps the filter pills
 * predictable while still tolerating new carrier values without code changes.
 */
function orderCustomers(values: string[]): string[] {
  const present = new Set(values.filter((v) => v));
  const known = RUNNING_FOR_OPTIONS.filter((v) => present.has(v));
  const unknown = [...present]
    .filter((v) => !RUNNING_FOR_OPTIONS.includes(v))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...unknown];
}

export function BillingTable({ rows }: BillingTableProps): React.ReactElement {
  // Available filter values are derived from the data. Drivers are everyone
  // who actually submitted; trucks come from the hard-coded list (so the
  // options stay stable when no submissions exist for a given truck);
  // customers and dates come from the data.
  const allDrivers = useMemo(
    () => uniqueSorted(rows.map((r) => r["Submitted By"])),
    [rows]
  );
  const allCustomers = useMemo(
    () => orderCustomers(rows.map((r) => r.customer)),
    [rows]
  );
  const allDates = useMemo(() => uniqueSorted(rows.map((r) => r.date)), [rows]);
  const minDate = allDates[0] ?? "";
  const maxDate = allDates[allDates.length - 1] ?? "";

  // Initial filter state: everything selected, full date range — so the
  // dashboard looks identical on first render to "no filtering applied."
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(
    () => new Set(allDrivers)
  );
  const [selectedTrucks, setSelectedTrucks] = useState<Set<string>>(
    () => new Set(TRUCK_NUMBERS)
  );
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(
    () => new Set(allCustomers)
  );
  const [dateFrom, setDateFrom] = useState<string>(minDate);
  const [dateTo, setDateTo] = useState<string>(maxDate);

  // When the underlying data changes (new CSV uploaded), re-seed the
  // filters so newly-present drivers/customers/dates are selected.
  React.useEffect(() => {
    setSelectedDrivers(new Set(allDrivers));
  }, [allDrivers]);
  React.useEffect(() => {
    setSelectedCustomers(new Set(allCustomers));
  }, [allCustomers]);
  React.useEffect(() => {
    setDateFrom(minDate);
    setDateTo(maxDate);
  }, [minDate, maxDate]);

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const resetFilters = () => {
    setSelectedDrivers(new Set(allDrivers));
    setSelectedTrucks(new Set(TRUCK_NUMBERS));
    setSelectedCustomers(new Set(allCustomers));
    setDateFrom(minDate);
    setDateTo(maxDate);
  };

  // Apply all four filters with AND between types, OR within a type (a row
  // passes if its driver is in selectedDrivers AND its truck is in
  // selectedTrucks AND ...).
  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          selectedDrivers.has(r["Submitted By"]) &&
          selectedTrucks.has(r["Truck #"]) &&
          selectedCustomers.has(r.customer) &&
          (!dateFrom || r.date >= dateFrom) &&
          (!dateTo || r.date <= dateTo)
      ),
    [rows, selectedDrivers, selectedTrucks, selectedCustomers, dateFrom, dateTo]
  );

  // Group filtered rows by driver, sort lines within each driver by start
  // time ascending, sort drivers alphabetically. Drivers with zero matching
  // lines are omitted entirely.
  const driverGroups = useMemo<DriverGroup[]>(() => {
    const map = new Map<string, GroupedBillingRow[]>();
    for (const r of filteredRows) {
      if (!map.has(r["Submitted By"])) map.set(r["Submitted By"], []);
      map.get(r["Submitted By"])!.push(r);
    }

    const groups: DriverGroup[] = [];
    for (const [driver, lines] of map.entries()) {
      lines.sort((a, b) => startTimeSortKey(a) - startTimeSortKey(b));
      const totals = lines.reduce(
        (acc, l) => ({
          minutes: acc.minutes + l.totalMinutes,
          loads: acc.loads + parseFloatSafe(l["Total # of loads"]),
          tons: acc.tons + parseFloatSafe(l["Total tons"]),
        }),
        { minutes: 0, loads: 0, tons: 0 }
      );
      groups.push({ driver, lines, totals });
    }
    groups.sort((a, b) => a.driver.localeCompare(b.driver));
    return groups;
  }, [filteredRows]);

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
      <FilterBar
        allDrivers={allDrivers}
        allCustomers={allCustomers}
        selectedDrivers={selectedDrivers}
        selectedTrucks={selectedTrucks}
        selectedCustomers={selectedCustomers}
        dateFrom={dateFrom}
        dateTo={dateTo}
        minDate={minDate}
        maxDate={maxDate}
        onToggleDriver={(d) => setSelectedDrivers((s) => toggle(s, d))}
        onToggleTruck={(t) => setSelectedTrucks((s) => toggle(s, t))}
        onToggleCustomer={(c) => setSelectedCustomers((s) => toggle(s, c))}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onReset={resetFilters}
      />

      <div className="overall-summary">
        Showing <strong>{filteredRows.length}</strong> line items across{" "}
        <strong>{driverGroups.length}</strong>{" "}
        {driverGroups.length === 1 ? "driver" : "drivers"}
      </div>

      {driverGroups.length === 0 ? (
        <div className="empty-table-message">
          <p>No line items match the current filters.</p>
          <p className="empty-hint">Try widening the filters or click Reset.</p>
        </div>
      ) : (
        driverGroups.map((g) => <DriverSection key={g.driver} group={g} />)
      )}
    </div>
  );
}

// =============================================================================
// FilterBar
// =============================================================================

interface FilterBarProps {
  allDrivers: string[];
  allCustomers: string[];
  selectedDrivers: Set<string>;
  selectedTrucks: Set<string>;
  selectedCustomers: Set<string>;
  dateFrom: string;
  dateTo: string;
  minDate: string;
  maxDate: string;
  onToggleDriver: (d: string) => void;
  onToggleTruck: (t: string) => void;
  onToggleCustomer: (c: string) => void;
  onDateFromChange: (d: string) => void;
  onDateToChange: (d: string) => void;
  onReset: () => void;
}

function FilterBar(props: FilterBarProps): React.ReactElement {
  return (
    <div className="filter-bar">
      <FilterPills
        label="Driver"
        options={props.allDrivers}
        selected={props.selectedDrivers}
        onToggle={props.onToggleDriver}
      />
      <FilterPills
        label="Truck #"
        options={[...TRUCK_NUMBERS]}
        selected={props.selectedTrucks}
        onToggle={props.onToggleTruck}
      />
      <FilterPills
        label="Customer"
        options={props.allCustomers}
        selected={props.selectedCustomers}
        onToggle={props.onToggleCustomer}
      />
      <div className="filter-section">
        <span className="filter-section-label">Date</span>
        <div className="date-range">
          <input
            type="date"
            value={props.dateFrom}
            min={props.minDate}
            max={props.maxDate}
            onChange={(e) => props.onDateFromChange(e.target.value)}
            aria-label="Date from"
          />
          <span className="date-range-sep">–</span>
          <input
            type="date"
            value={props.dateTo}
            min={props.minDate}
            max={props.maxDate}
            onChange={(e) => props.onDateToChange(e.target.value)}
            aria-label="Date to"
          />
        </div>
      </div>
      <button className="reset-filters-btn" onClick={props.onReset}>
        Reset filters
      </button>
    </div>
  );
}

interface FilterPillsProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}

function FilterPills({
  label,
  options,
  selected,
  onToggle,
}: FilterPillsProps): React.ReactElement {
  if (options.length === 0) {
    return (
      <div className="filter-section">
        <span className="filter-section-label">{label}</span>
        <span className="filter-empty">— none —</span>
      </div>
    );
  }
  return (
    <div className="filter-section">
      <span className="filter-section-label">{label}</span>
      <div className="filter-pills">
        {options.map((opt) => {
          const isOn = selected.has(opt);
          return (
            <button
              key={opt}
              type="button"
              className={`filter-pill ${isOn ? "on" : "off"}`}
              onClick={() => onToggle(opt)}
              aria-pressed={isOn}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// DriverSection
// =============================================================================

interface DriverSectionProps {
  group: DriverGroup;
}

function DriverSection({ group }: DriverSectionProps): React.ReactElement {
  const { driver, lines, totals } = group;
  return (
    <section className="driver-section">
      <header className="driver-header">
        <span className="driver-name">{driver}</span>
        <span className="driver-line-count">
          {lines.length} {lines.length === 1 ? "line" : "lines"}
        </span>
      </header>
      <div className="table-container">
        <table className="billing-table">
          <thead>
            <tr>
              <th className="row-num-header">#</th>
              <th>Truck #</th>
              <th>Customer</th>
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
            {lines.map((row, i) => {
              const needsVerify = row.verifyNote !== "";
              return (
                <tr key={i} className={needsVerify ? "verify-row" : undefined}>
                  <td className="row-num">
                    Line {i + 1}
                    {needsVerify && (
                      <span className="verify-badge" title={row.verifyNote}>
                        ⚠️ VERIFY
                      </span>
                    )}
                  </td>
                  <td>{row["Truck #"]}</td>
                  <td>{row.customer}</td>
                  <td>{row["Pit/Pick up name"]}</td>
                  <td>{row["Job/Delivery name"]}</td>
                  <td>{row["Product type"]}</td>
                  <td>{row["Truck type"]}</td>
                  <td>{row["Ticket # or Multi"]}</td>
                  <td>{row["Start time"]}</td>
                  <td>{row["End time"]}</td>
                  <td>{row["Total tons"]}</td>
                  <td className={needsVerify ? "verify-cell" : undefined}>
                    {row["Total # of loads"]}
                  </td>
                  <td>{row.totalTimeHHMM}</td>
                  <td>{row.totalTimeDecimal}</td>
                  <td>{row.submissionCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="driver-total">
        <strong>Driver Total:</strong> {formatHHMM(totals.minutes)} ({(
          totals.minutes / 60
        ).toFixed(2)} hrs) | {formatLoads(totals.loads)} loads |{" "}
        {totals.tons.toFixed(2)} tons
      </div>
    </section>
  );
}

function formatLoads(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}
