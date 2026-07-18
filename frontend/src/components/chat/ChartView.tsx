"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar,
  AreaChart, Area,
  LineChart, Line,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Label,
  ResponsiveContainer,
} from "recharts";
import { BarChart2 } from "lucide-react";
import { ChartSpec } from "@/lib/chartDetector";

// ---------------------------------------------------------------------------
// Palette — perceptually distinct (ColorBrewer Set2-inspired)
// ---------------------------------------------------------------------------
const PALETTE = ["#e07b54", "#4e9af1", "#56b87e", "#f0c040", "#9b6dd6", "#e05c8a", "#4db8c8", "#a0b830"];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_POINTS = 50;

// Chart height by type — pie needs more vertical room; scatter/area/line less
const CHART_HEIGHT: Record<string, number> = {
  pie: 320,
  scatter: 260,
  line: 260,
  area: 260,
  bar: 280,
  "bar-grouped": 280,
  "bar-stacked": 280,
};

// ---------------------------------------------------------------------------
// Axis formatters
// ---------------------------------------------------------------------------
const numFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function fmtNumber(v: unknown): string {
  const n = Number(v);
  return isFinite(n) ? numFmt.format(n) : String(v);
}

/** Best-effort date formatter — returns original string if not parseable. */
function fmtDate(v: unknown): string {
  const s = String(v ?? "");
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  // If the original string looks like YYYY-MM (no day), keep it short
  if (/^\d{4}-\d{2}$/.test(s)) return d.toLocaleDateString("en", { year: "numeric", month: "short" });
  if (/^\d{4}$/.test(s)) return s; // bare year
  return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "2-digit" });
}

// ---------------------------------------------------------------------------
// Slice helpers
// ---------------------------------------------------------------------------
type SliceMode = "first" | "last" | "top";

function applySlice(rows: Record<string, unknown>[], mode: SliceMode, numKey?: string) {
  if (mode === "last") return rows.slice(-MAX_POINTS);
  if (mode === "top" && numKey)
    return [...rows].sort((a, b) => Number(b[numKey] ?? 0) - Number(a[numKey] ?? 0)).slice(0, MAX_POINTS);
  return rows.slice(0, MAX_POINTS);
}

// ---------------------------------------------------------------------------
// ChartView
// ---------------------------------------------------------------------------
interface ChartViewProps {
  chartSpec: ChartSpec;
  rows: Record<string, unknown>[];
}

export function ChartView({ chartSpec, rows }: ChartViewProps) {
  const [sliceMode, setSliceMode] = useState<SliceMode>("first");
  const truncated = rows.length > MAX_POINTS;
  const numKey = chartSpec.valueKeys[0];

  const displayRows = useMemo(
    () => (truncated ? applySlice(rows, sliceMode, numKey) : rows),
    [rows, sliceMode, numKey, truncated],
  );

  const height = CHART_HEIGHT[chartSpec.type] ?? 280;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-600">
          <BarChart2 className="w-4 h-4" />
          <span className="text-sm font-medium capitalize">{chartSpec.title}</span>
        </div>

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
                {mode === "first" ? "First 50" : mode === "last" ? "Last 50" : "Top 50"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 pt-4 pb-2">
        <ResponsiveContainer width="100%" height={height}>
          {renderChart(chartSpec, displayRows)}
        </ResponsiveContainer>
      </div>

      {truncated && (
        <div className="px-4 pb-2 text-xs text-gray-400">
          Showing {sliceMode === "top" ? `top` : sliceMode} {MAX_POINTS} of {rows.length} rows
          {sliceMode === "top" && ` by ${numKey}`}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared axis props
// ---------------------------------------------------------------------------
const tickStyle = { fontSize: 11 };
const numAxis = { tick: tickStyle, tickFormatter: fmtNumber };
const catAxis = (isTimeLike: boolean) => ({
  tick: tickStyle,
  tickFormatter: isTimeLike ? fmtDate : undefined,
});

function looksTimeLike(key: string) {
  return /date|time|month|year|week|day|period|quarter|hour|minute|ts|timestamp/i.test(key);
}

// ---------------------------------------------------------------------------
// Render switch
// ---------------------------------------------------------------------------
function renderChart(spec: ChartSpec, data: Record<string, unknown>[]): React.ReactElement {
  switch (spec.type) {
    case "bar":           return renderBar(spec, data, false);
    case "bar-grouped":   return renderBar(spec, data, false);
    case "bar-stacked":   return renderBar(spec, data, true);
    case "line":          return renderLine(spec, data, false);
    case "area":          return renderLine(spec, data, true);
    case "pie":           return renderPie(spec, data);
    case "scatter":       return renderScatter(spec, data);
    default:
      return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Unsupported chart type</div> as unknown as React.ReactElement;
  }
}

// ---------------------------------------------------------------------------
// Bar (covers bar, bar-grouped, bar-stacked)
// ---------------------------------------------------------------------------
function renderBar(spec: ChartSpec, data: Record<string, unknown>[], stacked: boolean): React.ReactElement {
  const isH = spec.orientation === "horizontal";
  const cat = spec.categoryKey!;
  const stack = stacked ? "stack" : undefined;

  const bars = spec.valueKeys.map((key, i) => (
    <Bar key={key} dataKey={key} stackId={stack} fill={PALETTE[i % PALETTE.length]} radius={isH ? [0, 3, 3, 0] : [3, 3, 0, 0]} />
  ));

  if (isH) {
    return (
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...numAxis} />
        <YAxis type="category" dataKey={cat} width={100} tick={tickStyle} />
        <Tooltip formatter={(v) => fmtNumber(v)} />
        {spec.valueKeys.length > 1 && <Legend wrapperStyle={tickStyle} />}
        {bars}
      </BarChart>
    );
  }

  return (
    <BarChart data={data} margin={{ left: 8, right: 16, top: 4, bottom: 24 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={cat} {...catAxis(looksTimeLike(cat))} />
      <YAxis {...numAxis} />
      <Tooltip formatter={(v) => fmtNumber(v)} />
      {spec.valueKeys.length > 1 && <Legend wrapperStyle={tickStyle} />}
      {bars}
    </BarChart>
  );
}

// ---------------------------------------------------------------------------
// Line / Area
// ---------------------------------------------------------------------------
function renderLine(spec: ChartSpec, data: Record<string, unknown>[], asArea: boolean): React.ReactElement {
  const cat = spec.categoryKey!;
  const isTime = looksTimeLike(cat);

  const series = spec.valueKeys.map((key, i) =>
    asArea ? (
      <Area key={key} type="monotone" dataKey={key} stroke={PALETTE[i % PALETTE.length]}
        fill={PALETTE[i % PALETTE.length]} fillOpacity={0.15} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
    ) : (
      <Line key={key} type="monotone" dataKey={key} stroke={PALETTE[i % PALETTE.length]}
        strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
    ),
  );

  const Chart = asArea ? AreaChart : LineChart;

  return (
    <Chart data={data} margin={{ left: 8, right: 16, top: 4, bottom: 24 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey={cat} {...catAxis(isTime)} />
      <YAxis {...numAxis} />
      <Tooltip formatter={(v) => fmtNumber(v)} labelFormatter={isTime ? fmtDate : undefined} />
      {spec.valueKeys.length > 1 && <Legend wrapperStyle={tickStyle} />}
      {series}
    </Chart>
  );
}

// ---------------------------------------------------------------------------
// Pie — donut style, legend instead of inline labels
// ---------------------------------------------------------------------------
function renderPie(spec: ChartSpec, data: Record<string, unknown>[]): React.ReactElement {
  const nameKey = spec.categoryKey!;
  const valKey = spec.valueKeys[0];
  const total = data.reduce((s, r) => s + Number(r[valKey] ?? 0), 0);

  return (
    <PieChart margin={{ top: 4, bottom: 4 }}>
      <Pie data={data} dataKey={valKey} nameKey={nameKey}
        cx="50%" cy="50%" innerRadius="55%" outerRadius="80%"
        paddingAngle={2} label={false} labelLine={false}>
        {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        {/* Center total */}
        <Label
          position="center"
          content={() => (
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
              <tspan x="50%" dy="-0.4em" style={{ fontSize: 18, fontWeight: 600, fill: "#111" }}>
                {fmtNumber(total)}
              </tspan>
              <tspan x="50%" dy="1.4em" style={{ fontSize: 11, fill: "#6b7280" }}>
                total
              </tspan>
            </text>
          )}
        />
      </Pie>
      <Tooltip formatter={(v) => fmtNumber(v)} />
      <Legend wrapperStyle={tickStyle} />
    </PieChart>
  );
}

// ---------------------------------------------------------------------------
// Scatter
// ---------------------------------------------------------------------------
function renderScatter(spec: ChartSpec, data: Record<string, unknown>[]): React.ReactElement {
  const [xKey, yKey] = spec.valueKeys;
  const pts = data.map((r) => ({ x: r[xKey], y: r[yKey] }));

  return (
    <ScatterChart margin={{ left: 8, right: 16, top: 4, bottom: 24 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis type="number" dataKey="x" name={xKey} {...numAxis}>
        <Label value={xKey} offset={-12} position="insideBottom" style={tickStyle} />
      </XAxis>
      <YAxis type="number" dataKey="y" name={yKey} {...numAxis}>
        <Label value={yKey} angle={-90} position="insideLeft" style={tickStyle} offset={10} />
      </YAxis>
      <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v) => fmtNumber(v)} />
      <Scatter data={pts} fill={PALETTE[0]} />
    </ScatterChart>
  );
}
