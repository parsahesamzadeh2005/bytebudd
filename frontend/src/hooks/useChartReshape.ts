"use client";

import { useState, useCallback } from "react";
import { ChartSpec, ChartType } from "@/lib/chartDetector";
import { queryApi, ChartReshapeResponse } from "@/lib/api";

export type ReshapeStatus = "idle" | "loading" | "success" | "error";

export interface UseChartReshapeReturn {
  reshape: (columns: string[], rows: Record<string, unknown>[], targetChartType: ChartType, conversationId: number) => Promise<void>;
  reshapeStatus: ReshapeStatus;
  reshapedSpec: ChartSpec | null;
  reshapeError: string | null;
  suggestedChartType: ChartType | null;
  reset: () => void;
}

// Only a small sample is sent; the spec is applied to the full local rows.
const SAMPLE_SIZE = 10;

export function useChartReshape(): UseChartReshapeReturn {
  const [reshapeStatus, setReshapeStatus] = useState<ReshapeStatus>("idle");
  const [reshapedSpec, setReshapedSpec] = useState<ChartSpec | null>(null);
  const [reshapeError, setReshapeError] = useState<string | null>(null);
  const [suggestedChartType, setSuggestedChartType] = useState<ChartType | null>(null);

  const reset = useCallback(() => {
    setReshapeStatus("idle");
    setReshapedSpec(null);
    setReshapeError(null);
    setSuggestedChartType(null);
  }, []);

  const reshape = useCallback(async (
    columns: string[],
    rows: Record<string, unknown>[],
    targetChartType: ChartType,
    conversationId: number,
  ): Promise<void> => {
    setReshapeStatus("loading");
    setReshapeError(null);
    setSuggestedChartType(null);
    setReshapedSpec(null);

    try {
      const data: ChartReshapeResponse = await queryApi.chartReshape({
        conversation_id: conversationId,
        columns,
        rows: rows.slice(0, SAMPLE_SIZE),
        target_chart_type: targetChartType,
      });

      if (data.success) {
        setReshapedSpec({
          type: data.chart_spec.type as ChartType,
          categoryKey: data.chart_spec.category_key ?? undefined,
          valueKeys: data.chart_spec.value_keys,
          title: data.chart_spec.title,
        });
        setReshapeStatus("success");
      } else {
        setReshapeError(data.error || "Unknown error during reshape.");
        setSuggestedChartType((data.suggested_chart_type as ChartType | null) ?? null);
        setReshapeStatus("error");
      }
    } catch (err) {
      setReshapeStatus("error");
      setReshapeError(
        err instanceof Error ? err.message : "AI service unavailable. Check that Ollama is running.",
      );
    }
  }, []);

  return { reshape, reshapeStatus, reshapedSpec, reshapeError, suggestedChartType, reset };
}
