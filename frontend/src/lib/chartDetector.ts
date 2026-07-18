/**
 * chartDetector.ts — pure, synchronous chart-type detection.
 *
 * Detection priority (first match wins):
 *   1 cat + 1 num, low-cardinality (≤8)          → "pie"
 *   1 cat + 1 num, time-like column name          → "line"
 *   1 cat + 1 num                                  → "bar"
 *   1 cat + 2+ num                                 → "bar-grouped"
 *   0 cat + 2 num                                  → "scatter"
 *   anything else                                  → null
 */

export type ChartType = "bar" | "bar-grouped" | "bar-stacked" | "line" | "area" | "pie" | "scatter";
export type BarOrientation = "horizontal" | "vertical";

export interface ChartSpec {
  type: ChartType;
  categoryKey?: string;
  valueKeys: string[];
  orientation?: BarOrientation;
  title: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (s: string) => s.toLowerCase().replace(/_/g, " ");

/** ≥80% of non-null values are finite numbers. */
export function isNumericColumn(col: string, rows: Record<string, unknown>[]): boolean {
  const nonNull = rows.filter((r) => r[col] != null);
  if (!nonNull.length) return false;
  return nonNull.filter((r) => isFinite(Number(r[col]))).length / nonNull.length >= 0.8;
}

/** Horizontal when >8 rows OR avg label > 8 chars. */
export function computeOrientation(catCol: string, rows: Record<string, unknown>[]): BarOrientation {
  const labels = rows.map((r) => String(r[catCol] ?? ""));
  if (labels.length > 8) return "horizontal";
  return labels.reduce((s, l) => s + l.length, 0) / labels.length > 8 ? "horizontal" : "vertical";
}

/** Column name looks like a time/sequence axis. */
const TIME_PATTERN = /date|time|month|year|week|day|period|quarter|hour|minute|ts|timestamp/i;
export function isTimeLike(col: string): boolean {
  return TIME_PATTERN.test(col);
}

export function buildTitle(value: string, category: string) {
  return `${fmt(value)} by ${fmt(category)}`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function detectChartType(
  columns: string[],
  rows: Record<string, unknown>[]
): ChartSpec | null {
  if (!columns.length || !rows.length) return null;

  const numeric = columns.filter((c) => isNumericColumn(c, rows));
  const categorical = columns.filter((c) => !isNumericColumn(c, rows));

  // 1 categorical, 1 numeric
  if (categorical.length === 1 && numeric.length === 1) {
    const [cat, val] = [categorical[0], numeric[0]];
    const uniq = new Set(rows.map((r) => r[cat])).size;

    // pie: low-cardinality (≤8 unique values), not time-like
    if (uniq <= 8 && !isTimeLike(cat)) {
      return { type: "pie", categoryKey: cat, valueKeys: [val], title: buildTitle(val, cat) };
    }
    // line: column name looks like a time/ordered series
    if (isTimeLike(cat)) {
      return { type: "line", categoryKey: cat, valueKeys: [val], title: buildTitle(val, cat) };
    }
    // default: bar
    return {
      type: "bar",
      categoryKey: cat,
      valueKeys: [val],
      orientation: computeOrientation(cat, rows),
      title: buildTitle(val, cat),
    };
  }

  // 1 categorical, 2+ numeric → bar-grouped
  if (categorical.length === 1 && numeric.length >= 2) {
    const cat = categorical[0];
    return {
      type: "bar-grouped",
      categoryKey: cat,
      valueKeys: numeric,
      orientation: computeOrientation(cat, rows),
      title: `${numeric.map(fmt).join(" & ")} by ${fmt(cat)}`,
    };
  }

  // 0 categorical, exactly 2 numeric → scatter
  if (!categorical.length && numeric.length === 2) {
    return {
      type: "scatter",
      valueKeys: numeric,
      title: `${fmt(numeric[0])} vs ${fmt(numeric[1])}`,
    };
  }

  return null;
}
