"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Label,
} from "recharts";
import { BarChart2 } from "lucide-react";
import { ChartSpec } from "@/lib/chartDetector";

// Brand colour palette (cycles for grouped/multi-series charts)
const PALETTE = ["#2563eb", "#60a5fa", "#93c5fd", "#1d4ed8", "#3b82f6"];

const MAX_POINTS = 50;

interface ChartViewProps {
  chartSpec: ChartSpec;
  rows: Record<string, unknown>[];
}

type SliceMode = "first" | "last" | "top";

// ---------------------------------------------------------------------------
// Slice helpers
// ---------------------------------------------------------------------------

function getFirstNumericKey(spec: ChartSpec): string | undefined {
  return spec.valueKeys[0];
}

function applySlice(
  rows: Record<string, unknown>[],
  mode: SliceMode,
  numericKey?: string
): Record<string, unknown>[] {
  if (mode === "last") return rows.slice(-MAX_POINTS);
  if (mode === "top" && numericKey) {
    return [...rows]
      .sort((a, b) => {
        const av = Number(a[numericKey] ?? 0);
        const bv = Number(b[numericKey] ?? 0);
        return bv - av;
      })
      .slice(0, MAX_POINTS);
  }
  // first (default)
  return rows.slice(0, MAX_POINTS);
}

// ---------------------------------------------------------------------------
// ChartView component
// ---------------------------------------------------------------------------

export function ChartView({ chartSpec, rows }: ChartViewProps) {
  const [sliceMode, setSliceMode] = useState<SliceMode>("first");
  const truncated = rows.length > MAX_POINTS;
  const numericKey = getFirstNumericKey(chartSpec);

  const displayRows = useMemo(
    () => (truncated ? applySlice(rows, sliceMode, numericKey) : rows),
    [rows, sliceMode, numericKey, truncated]
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-600">
          <BarChart2 className="w-4 h-4" />
          <span className="text-sm font-medium capitalize">{chartSpec.title}</span>
        </div>

        {/* Slice controls — only when truncation is needed */}
        {truncated && (
          <div className="flex items-center gap-1">
            {(["first", "last", "top"] as SliceMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSliceMode(mode)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  sliceMode === mode
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {mode === "first"
                  ? "First 50"
                  : mode === "last"
                  ? "Last 50"
                  : `Top 50`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart body */}
      <div className="px-2 pt-4 pb-2">
        <ResponsiveContainer width="100%" height={280}>
          {renderChart(chartSpec, displayRows)}
        </ResponsiveContainer>
      </div>

      {/* Truncation note */}
      {truncated && (
        <div className="px-4 pb-2 text-xs text-gray-400">
          {sliceMode === "first" && `Showing first ${MAX_POINTS} of ${rows.length} rows`}
          {sliceMode === "last" && `Showing last ${MAX_POINTS} of ${rows.length} rows`}
          {sliceMode === "top" &&
            `Showing top ${MAX_POINTS} of ${rows.length} rows by ${numericKey ?? "value"}`}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Render switch
// ---------------------------------------------------------------------------

function renderChart(
  chartSpec: ChartSpec,
  data: Record<string, unknown>[]
): React.ReactElement {
  switch (chartSpec.type) {
    case "bar":
      return renderBarChart(chartSpec, data);

    case "bar-grouped":
      return renderBarGroupedChart(chartSpec, data);

    case "line":
      return renderLineChart(chartSpec, data);

    case "pie":
      return renderPieChart(chartSpec, data);

    case "scatter":
      return renderScatterChart(chartSpec, data);

    default:
      return (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Unsupported chart type
        </div>
      ) as unknown as React.ReactElement;
  }
}

// ---------------------------------------------------------------------------
// Individual chart renderers
// ---------------------------------------------------------------------------

function renderBarChart(
  spec: ChartSpec,
  data: Record<string, unknown>[]
): React.ReactElement {
  const isHorizontal = spec.orientation === "horizontal";
  const catKey = spec.categoryKey!;
  const valKey = spec.valueKeys[0];

  if (isHorizontal) {
    return (
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey={catKey}
          width={100}
          tick={{ fontSize: 11 }}
        />
        <Tooltip />
        <Bar dataKey={valKey} fill={PALETTE[0]} radius={[0, 3, 3, 0]} />
      </BarChart>
    );
  }

  return (
    <BarChart data={data} margin={{ left: 8, right: 16, top: 4, bottom: 24 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={catKey} tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip />
      <Bar dataKey={valKey} fill={PALETTE[0]} radius={[3, 3, 0, 0]} />
    </BarChart>
  );
}

function renderBarGroupedChart(
  spec: ChartSpec,
  data: Record<string, unknown>[]
): React.ReactElement {
  const isHorizontal = spec.orientation === "horizontal";
  const catKey = spec.categoryKey!;

  if (isHorizontal) {
    return (
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey={catKey}
          width={100}
          tick={{ fontSize: 11 }}
        />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {spec.valueKeys.map((key, i) => (
          <Bar key={key} dataKey={key} fill={PALETTE[i % PALETTE.length]} radius={[0, 3, 3, 0]} />
        ))}
      </BarChart>
    );
  }

  return (
    <BarChart data={data} margin={{ left: 8, right: 16, top: 4, bottom: 24 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={catKey} tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      {spec.valueKeys.map((key, i) => (
        <Bar key={key} dataKey={key} fill={PALETTE[i % PALETTE.length]} radius={[3, 3, 0, 0]} />
      ))}
    </BarChart>
  );
}

function renderLineChart(
  spec: ChartSpec,
  data: Record<string, unknown>[]
): React.ReactElement {
  const catKey = spec.categoryKey!;

  return (
    <LineChart data={data} margin={{ left: 8, right: 16, top: 4, bottom: 24 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey={catKey} tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      {spec.valueKeys.map((key, i) => (
        <Line
          key={key}
          type="monotone"
          dataKey={key}
          stroke={PALETTE[i % PALETTE.length]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      ))}
    </LineChart>
  );
}

function renderPieChart(
  spec: ChartSpec,
  data: Record<string, unknown>[]
): React.ReactElement {
  const nameKey = spec.categoryKey!;
  const valKey = spec.valueKeys[0];

  return (
    <PieChart margin={{ top: 4, bottom: 4 }}>
      <Pie
        data={data}
        dataKey={valKey}
        nameKey={nameKey}
        cx="50%"
        cy="50%"
        outerRadius={110}
        label={({ name, percent }) =>
          `${name} (${(percent * 100).toFixed(0)}%)`
        }
        labelLine={false}
      >
        {data.map((_, i) => (
          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
        ))}
      </Pie>
      <Tooltip />
      <Legend wrapperStyle={{ fontSize: 11 }} />
    </PieChart>
  );
}

function renderScatterChart(
  spec: ChartSpec,
  data: Record<string, unknown>[]
): React.ReactElement {
  const xKey = spec.valueKeys[0];
  const yKey = spec.valueKeys[1];

  // ScatterChart expects { x, y } shaped data, so remap
  const scatterData = data.map((r) => ({ x: r[xKey], y: r[yKey] }));

  return (
    <ScatterChart margin={{ left: 8, right: 16, top: 4, bottom: 24 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis type="number" dataKey="x" name={xKey} tick={{ fontSize: 11 }}>
        <Label value={xKey} offset={-12} position="insideBottom" style={{ fontSize: 11 }} />
      </XAxis>
      <YAxis type="number" dataKey="y" name={yKey} tick={{ fontSize: 11 }}>
        <Label
          value={yKey}
          angle={-90}
          position="insideLeft"
          style={{ fontSize: 11 }}
          offset={10}
        />
      </YAxis>
      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
      <Scatter data={scatterData} fill={PALETTE[0]} />
    </ScatterChart>
  );
}
