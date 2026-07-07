"use client";

import { useState, useCallback } from "react";
import { ChartSpec, ChartType } from "@/lib/chartDetector";
import { queryApi, ChartReshapeResponse } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReshapeStatus = "idle" | "loading" | "success" | "error";

export interface UseChartReshapeReturn {
  reshape: (
    columns: string[],
    rows: Record<string, unknown>[],
    targetChartType: ChartType,
    conversationId: number
  ) => Promise<void>;
  reshapeStatus: ReshapeStatus;
  reshapedSpec: ChartSpec | null;
  reshapedRows: Record<string, unknown>[];
  reshapeError: string | null;
  suggestedChartType: ChartType | null;
  reset: () => void;
}

// The maximum number of rows sent to the reshape endpoint
const MAX_RESHAPE_ROWS = 200;

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
      targetChartType: ChartType,
      conversationId: number
    ): Promise<void> => {
      setReshapeStatus("loading");
      setReshapeError(null);
      setSuggestedChartType(null);
      setReshapedSpec(null);
      setReshapedRows([]);

      const slicedRows = rows.slice(0, MAX_RESHAPE_ROWS);

      try {
        // Use the shared apiFetch wrapper so 401 auto-redirect and error
        // normalisation (FastAPI 422 arrays) apply consistently.
        const data: ChartReshapeResponse = await queryApi.chartReshape({
          conversation_id: conversationId,
          columns,
          rows: slicedRows,
          target_chart_type: targetChartType,
        });

        if (data.success) {
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
      } catch (err) {
        setReshapeStatus("error");
        setReshapeError(
          err instanceof Error
            ? err.message
            : "AI service is unavailable. Check that Ollama is running and try again."
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
