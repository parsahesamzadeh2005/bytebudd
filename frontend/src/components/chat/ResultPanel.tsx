"use client";

import { useState, useMemo, useEffect, Component, ReactNode } from "react";
import {
  BarChart2,
  Table2,
  RefreshCw,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import { detectChartType, ChartType, ChartSpec } from "@/lib/chartDetector";
import { ChartView } from "./ChartView";
import { DataGrid } from "./DataGrid";
import { useChartReshape } from "@/hooks/useChartReshape";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResultPanelProps {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

type ActiveView = "chart" | "table";

// The selector only exposes the 4 user-facing types (no bar-grouped in selector)
const SELECTOR_TYPES: ChartType[] = ["bar", "line", "pie", "scatter"];

const MAX_RESHAPE_ROWS = 200;

// Types that can be rendered immediately without AI reshaping.
// bar-grouped auto-detection maps to "bar" in the selector.
const INSTANT_TYPES = new Set<ChartType>(["bar", "scatter"]);

/**
 * Build a renderable ChartSpec for an instant switch (bar or scatter),
 * re-using the auto-detected spec when the type matches, or deriving a
 * minimal compatible spec from it.
 */
function buildInstantSpec(
  type: ChartType,
  autoSpec: ChartSpec | null
): ChartSpec | null {
  if (!autoSpec) return null;

  // bar selector covers both "bar" and "bar-grouped" auto-detected specs
  if (type === "bar" && (autoSpec.type === "bar" || autoSpec.type === "bar-grouped")) {
    return autoSpec;
  }
  if (type === "scatter" && autoSpec.type === "scatter") {
    return autoSpec;
  }
  return null;
}

// ---------------------------------------------------------------------------
// React error boundary — catches Recharts render failures
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean;
}

class ChartErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// ResultPanel
// ---------------------------------------------------------------------------

export function ResultPanel({ columns, rows, rowCount }: ResultPanelProps) {
  // Auto-detect chart spec once per new result set
  const autoSpec: ChartSpec | null = useMemo(
    () => detectChartType(columns, rows),
    [columns, rows]
  );

  // Default view: chart if auto-detection found something, table otherwise
  const [activeView, setActiveView] = useState<ActiveView>(
    autoSpec ? "chart" : "table"
  );

  // Chart-type selector: default to auto-detected type (bar-grouped → bar)
  const defaultSelectorType: ChartType =
    autoSpec
      ? autoSpec.type === "bar-grouped"
        ? "bar"
        : (autoSpec.type as ChartType)
      : "bar";

  const [selectedChartType, setSelectedChartType] =
    useState<ChartType>(defaultSelectorType);

  // Overridden spec from an instant type switch (no AI needed)
  const [instantSpec, setInstantSpec] = useState<ChartSpec | null>(null);

  // Reshape hook
  const {
    reshape,
    reshapeStatus,
    reshapedSpec,
    reshapedRows,
    reshapeError,
    suggestedChartType,
    reset: resetReshape,
  } = useChartReshape();

  // ---------------------------------------------------------------------------
  // Active chart spec resolution:
  //   1. instantSpec  — user clicked bar/scatter selector (no AI)
  //   2. reshapedSpec — successful AI reshape
  //   3. autoSpec     — fallback from auto-detection
  // ---------------------------------------------------------------------------
  const activeSpec: ChartSpec | null =
    instantSpec ??
    (reshapeStatus === "success" && reshapedSpec ? reshapedSpec : autoSpec);

  const activeChartRows =
    reshapeStatus === "success" && reshapedRows.length > 0 && !instantSpec
      ? reshapedRows
      : rows;

  // Whether the toggle should be visible
  const showToggle = activeSpec !== null || reshapeStatus === "success";

  // Chart error boundary fallback
  const handleChartError = () => {
    console.warn("ChartView render error — falling back to table.");
    setActiveView("table");
  };

  // ---------------------------------------------------------------------------
  // Chart type selector click
  // ---------------------------------------------------------------------------
  const handleSelectType = (type: ChartType) => {
    setSelectedChartType(type);

    if (INSTANT_TYPES.has(type)) {
      // Try to switch immediately using auto-detected data
      const spec = buildInstantSpec(type, autoSpec);
      if (spec) {
        setInstantSpec(spec);
        resetReshape();          // clear any previous reshape state
        setActiveView("chart");
        return;
      }
    }

    // For line/pie, or bar/scatter when auto-detection doesn't match,
    // clear the instant override so the user knows they need to reshape
    setInstantSpec(null);
  };

  // Clicking "Prepare for Chart"
  const handleReshape = () => {
    if (reshapeStatus === "loading") return;
    setInstantSpec(null);        // clear instant override; reshape takes over
    reshape(columns, rows, selectedChartType);
  };

  // Switching to a suggested chart type from the error banner
  const handleApplySuggestion = (type: ChartType) => {
    handleSelectType(type);
    resetReshape();
  };

  // When reshape succeeds, switch to chart view
  useEffect(() => {
    if (reshapeStatus === "success" && reshapedSpec) {
      setActiveView("chart");
    }
  }, [reshapeStatus, reshapedSpec]);

  const rowsExceedLimit = rows.length > MAX_RESHAPE_ROWS;

  // Does the selected type need the AI button to render?
  const needsReshape =
    !INSTANT_TYPES.has(selectedChartType) ||
    buildInstantSpec(selectedChartType, autoSpec) === null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50">
        {/* Chart-type selector */}
        <div className="flex items-center gap-1 mr-2">
          {SELECTOR_TYPES.map((type) => {
            const isInstant = INSTANT_TYPES.has(type) && buildInstantSpec(type, autoSpec) !== null;
            return (
              <button
                key={type}
                onClick={() => handleSelectType(type)}
                title={
                  isInstant
                    ? `Switch to ${type} chart`
                    : `Select ${type} — click "Prepare for Chart" to render with AI`
                }
                className={cn(
                  "px-2.5 py-1 text-xs rounded border font-medium transition-colors capitalize",
                  selectedChartType === type
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                )}
              >
                {type}
                {/* Small lightning bolt hint for instant types */}
                {isInstant && selectedChartType !== type && (
                  <span className="ml-1 text-gray-400">⚡</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Prepare for Chart button — dim it when the selected type can switch instantly */}
        <button
          onClick={handleReshape}
          disabled={reshapeStatus === "loading"}
          title={
            needsReshape
              ? `Ask AI to reshape data for ${selectedChartType} chart`
              : `Data already compatible — AI reshape not required, but you can still use it`
          }
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded border transition-colors",
            reshapeStatus === "loading"
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              : needsReshape
              ? "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
              : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
          )}
        >
          {reshapeStatus === "loading" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Prepare for Chart
        </button>

        {/* Row-limit notice */}
        {rowsExceedLimit && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            Only first {MAX_RESHAPE_ROWS} rows sent to AI
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Chart / Table toggle — only when a chart is available */}
        {showToggle && (
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-white">
            <button
              onClick={() => setActiveView("chart")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                activeView === "chart"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              )}
            >
              <BarChart2 className="w-3 h-3" />
              Chart
            </button>
            <button
              onClick={() => setActiveView("table")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                activeView === "table"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              )}
            >
              <Table2 className="w-3 h-3" />
              Table
            </button>
          </div>
        )}

        {/* Row count (when no toggle) */}
        {!showToggle && (
          <div className="flex items-center gap-2 text-gray-600 ml-auto">
            <Table2 className="w-4 h-4" />
            <span className="text-sm font-medium">
              {rowCount} row{rowCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {reshapeStatus === "error" && reshapeError && (
        <div className="flex items-start gap-2 bg-red-50 border-b border-red-100 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{reshapeError}</p>
            {suggestedChartType && (
              <p className="mt-1">
                Suggested alternative:{" "}
                <button
                  onClick={() => handleApplySuggestion(suggestedChartType)}
                  className="font-semibold underline hover:no-underline capitalize"
                >
                  {suggestedChartType}
                </button>
              </p>
            )}
          </div>
          <button
            onClick={resetReshape}
            className="p-0.5 rounded hover:bg-red-100 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Loading overlay ──────────────────────────────────────────────── */}
      {reshapeStatus === "loading" && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500 bg-gray-50 border-b border-gray-200">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          AI is reshaping your data…
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {activeView === "chart" && activeSpec ? (
        <ChartErrorBoundary onError={handleChartError}>
          <ChartView chartSpec={activeSpec} rows={activeChartRows} />
        </ChartErrorBoundary>
      ) : (
        <DataGrid columns={columns} rows={rows} rowCount={rowCount} />
      )}
    </div>
  );
}
