import { useEffect, useState } from "react";
import { POSITION_OVERALL_SAMPLE_KEY, POSITION_SAMPLE_KEY } from "../constants";
import type { PositionSample } from "../metrics";

const parsePositionSamples = (raw: string | null): PositionSample[] => {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s: Record<string, unknown>) => ({
      ms: Number(s?.ms) || 0,
      correct: !!s?.correct,
      at: Number(s?.at) || Date.now(),
      stage: typeof s?.stage === "string" ? (s.stage as PositionSample["stage"]) : "mixed",
      fromKeys: Array.isArray(s?.fromKeys) ? (s.fromKeys as string[]) : [],
      toKeys: Array.isArray(s?.toKeys) ? (s.toKeys as string[]) : [],
      fromChar: typeof s?.fromChar === "string" ? s.fromChar : "",
      toChar: typeof s?.toChar === "string" ? s.toChar : "",
    }));
  } catch {
    return [];
  }
};

export function usePositionSamples() {
  const [positionSamples, setPositionSamples] = useState<PositionSample[]>(
    () => parsePositionSamples(localStorage.getItem(POSITION_SAMPLE_KEY))
  );
  const [overallPositionSamples, setOverallPositionSamples] = useState<PositionSample[]>(
    () => parsePositionSamples(localStorage.getItem(POSITION_OVERALL_SAMPLE_KEY))
  );

  useEffect(() => {
    localStorage.setItem(POSITION_SAMPLE_KEY, JSON.stringify(positionSamples));
  }, [positionSamples]);

  useEffect(() => {
    localStorage.setItem(POSITION_OVERALL_SAMPLE_KEY, JSON.stringify(overallPositionSamples));
  }, [overallPositionSamples]);

  return {
    positionSamples,
    setPositionSamples,
    overallPositionSamples,
    setOverallPositionSamples,
  };
}
