"use client";

import { useState, useCallback } from "react";
import { ChartSpec, ChartType } from "@/lib/chartDetector";
import { getToken } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReshapeStatus = "idle" | "loading" | "success" | "error";

export interface UseChartReshapeReturn {
  reshape: (
    columns: string[],
    rows: Record<string, unknown>[],
    targetChartType: ChartType
  ) => Promise<void>;
  reshapeStatus: ReshapeStatus;
  reshapedSpec: ChartSpec | null;
  reshapedRows: Record<string, unknown>[];
  reshapeError: string | null;
  suggestedChartType: ChartType | null;
  reset: () => void;
}

// Backend response shapes
interface ChartSpecOut {
  type: string;
  category_key?: string | null;
  value_keys: string[];
  title: string;
}

interface ReshapeSuccessResponse {
  success: true;
  columns: string[];
  rows: Record<string, unknown>[];
  chart_spec: ChartSpecOut;
}

interface ReshapeErrorResponse {
  success: false;
  error: string;
  suggested_chart_type?: string | null;
}

type ReshapeApiResponse = ReshapeSuccessResponse | ReshapeErrorResponse;

// The maximum number of rows sent to the reshape endpoint
const MAX_RESHAPE_ROWS = 200;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChartReshape(): UseChartReshapeReturn {
  const [reshapeStatus, setReshapeStatus] = useState<ReshapeStatus>("idle");
  const [reshapedSpec, setReshapedSpec] = useState<ChartSpec | null>(null);
  const [reshapedRows, setReshapedRows] = useState<Record<string, unknown>[]>([]);
  const [reshapeError, setReshapeError] = useState<string | null>(null);
  const [suggestedChartType, setSuggestedChartType] = useState<ChartType | null>(null);

  const reset = useCallback(() => {
    setReshapeStatus("idle");
    setReshapedSpec(null);
    setReshapedRows([]);
    setReshapeError(null);
    setSuggestedChartType(null);
  }, []);

  const reshape = useCallback(
    async (
      columns: string[],
      rows: Record<string, unknown>[],
      targetChartType: ChartType
    ): Promise<void> => {
      setReshapeStatus("loading");
      setReshapeError(null);
      setSuggestedChartType(null);
      setReshapedSpec(null);
      setReshapedRows([]);

      const slicedRows = rows.slice(0, MAX_RESHAPE_ROWS);
      const token = getToken();

      try {
        const response = await fetch(`${API_BASE}/v1/query/chart-reshape`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            columns,
            rows: slicedRows,
            target_chart_type: targetChartType,
          }),
        });

        if (!response.ok) {
          // Non-2xx: treat as service unavailable
          setReshapeStatus("error");
          setReshapeError(
            response.status === 401
              ? "Authentication failed. Please log in again."
              : "AI service is unavailable. Check that Ollama is running and try again."
          );
          return;
        }

        const data: ReshapeApiResponse = await response.json();

        if (data.success) {
          // Build a ChartSpec from the backend's snake_case response
          const spec: ChartSpec = {
            type: data.chart_spec.type as ChartType,
            categoryKey: data.chart_spec.category_key ?? undefined,
            valueKeys: data.chart_spec.value_keys,
            title: data.chart_spec.title,
          };

          setReshapedSpec(spec);
          setReshapedRows(data.rows);
          setReshapeStatus("success");
        } else {
          setReshapeError(data.error || "An unknown error occurred during reshaping.");
          setSuggestedChartType(
            (data.suggested_chart_type as ChartType | null) ?? null
          );
          setReshapeStatus("error");
        }
      } catch {
        setReshapeStatus("error");
        setReshapeError(
          "AI service is unavailable. Check that Ollama is running and try again."
        );
      }
    },
    []
  );

  return {
    reshape,
    reshapeStatus,
    reshapedSpec,
    reshapedRows,
    reshapeError,
    suggestedChartType,
    reset,
  };
}
