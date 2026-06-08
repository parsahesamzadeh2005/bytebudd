/**
 * chartDetector.ts
 *
 * Pure, synchronous chart-type detection logic.
 * Analyses column metadata and row values to determine whether query results
 * can be rendered as a chart, and if so, which type.
 *
 * NOTE: detectChartType() never returns "line" or "pie" — those are
 * exclusively produced by the Ollama reshape path (useChartReshape).
 */

/** All supported chart types (includes line/pie for reshape path) */
export type ChartType = "bar" | "bar-grouped" | "line" | "pie" | "scatter";

/** Bar orientation */
export type BarOrientation = "horizontal" | "vertical";

/** Describes a renderable chart */
export interface ChartSpec {
  type: ChartType;
  /** Categorical column name — used as X-axis category (bar/bar-grouped/line/pie) */
  categoryKey?: string;
  /** Numeric column name(s) — Y-axis series */
  valueKeys: string[];
  /** Bar orientation (bar/bar-grouped only) */
  orientation?: BarOrientation;
  /** Human-readable title e.g. "revenue by product" */
  title: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when ≥ 80 % of non-null values in the column are finite numbers.
 * All-null columns are treated as categorical (returns false).
 */
export function isNumericColumn(
  col: string,
  rows: Record<string, unknown>[]
): boolean {
  const nonNull = rows.filter(
    (r) => r[col] !== null && r[col] !== undefined
  );
  if (nonNull.length === 0) return false;

  let numericCount = 0;
  for (const row of nonNull) {
    const value = Number(row[col]);
    if (isFinite(value)) numericCount++;
  }

  return numericCount / nonNull.length >= 0.8;
}

/**
 * Decides bar orientation based on label count and average label length.
 * Returns "horizontal" when rows > 8 OR average label > 8 chars.
 */
export function computeOrientation(
  catCol: string,
  rows: Record<string, unknown>[]
): BarOrientation {
  const labels = rows.map((r) => String(r[catCol] ?? ""));

  if (labels.length > 8) return "horizontal";

  const avgLen =
    labels.reduce((sum, l) => sum + l.length, 0) / labels.length;

  return avgLen > 8 ? "horizontal" : "vertical";
}

/**
 * Builds a human-readable chart title.
 * For bar/bar-grouped: "<value> by <category>"
 * For scatter: "<a> vs <b>"  (called with (colA, colB))
 * Labels are lower-cased with underscores replaced by spaces.
 */
export function buildTitle(valueLabel: string, categoryLabel: string): string {
  const fmt = (s: string) => s.toLowerCase().replace(/_/g, " ");
  return `${fmt(valueLabel)} by ${fmt(categoryLabel)}`;
}

export function buildScatterTitle(colA: string, colB: string): string {
  const fmt = (s: string) => s.toLowerCase().replace(/_/g, " ");
  return `${fmt(colA)} vs ${fmt(colB)}`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Analyses columns and rows and returns a ChartSpec if the data is
 * visualisable, or null if the table-only fallback should be used.
 *
 * Detection priority (first match wins):
 *   1 categorical + 1 numeric      → "bar"
 *   1 categorical + 2+ numeric     → "bar-grouped"
 *   0 categorical + 2 numeric      → "scatter"
 *   anything else                  → null
 *
 * This function NEVER returns type "line" or "pie".
 */
export function detectChartType(
  columns: string[],
  rows: Record<string, unknown>[]
): ChartSpec | null {
  if (columns.length === 0 || rows.length === 0) return null;

  // Classify each column
  const numericCols: string[] = [];
  const categoricalCols: string[] = [];

  for (const col of columns) {
    if (isNumericColumn(col, rows)) {
      numericCols.push(col);
    } else {
      categoricalCols.push(col);
    }
  }

  // Rule 1: 1 categorical + 1 numeric → bar
  if (categoricalCols.length === 1 && numericCols.length === 1) {
    const catCol = categoricalCols[0];
    const valCol = numericCols[0];
    return {
      type: "bar",
      categoryKey: catCol,
      valueKeys: [valCol],
      orientation: computeOrientation(catCol, rows),
      title: buildTitle(valCol, catCol),
    };
  }

  // Rule 2: 1 categorical + 2+ numeric → bar-grouped
  if (categoricalCols.length === 1 && numericCols.length >= 2) {
    const catCol = categoricalCols[0];
    const joinedLabel = numericCols
      .map((c) => c.toLowerCase().replace(/_/g, " "))
      .join(" & ");
    const catLabel = catCol.toLowerCase().replace(/_/g, " ");
    return {
      type: "bar-grouped",
      categoryKey: catCol,
      valueKeys: numericCols,
      orientation: computeOrientation(catCol, rows),
      title: `${joinedLabel} by ${catLabel}`,
    };
  }

  // Rule 3: 0 categorical + exactly 2 numeric → scatter
  if (categoricalCols.length === 0 && numericCols.length === 2) {
    return {
      type: "scatter",
      valueKeys: numericCols,
      title: buildScatterTitle(numericCols[0], numericCols[1]),
    };
  }

  return null;
}
