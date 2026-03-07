export type TypingSpeedMetrics = {
  kpm: number;
  cpm: number;
  elapsedTime: number;
};

type BuildTypingSpeedMetricsParams = {
  elapsedMs: number;
  keystrokes: number;
  charCount: number;
  minElapsedMs?: number;
  maxRate?: number;
};

export function countNonSpaceChars(value: string): number {
  return value.trim().replace(/\s+/g, "").length;
}

export function buildTypingSpeedMetrics(
  params: BuildTypingSpeedMetricsParams,
): TypingSpeedMetrics | null {
  const { elapsedMs, keystrokes, charCount, minElapsedMs = 100, maxRate = 3000 } = params;
  if (elapsedMs < minElapsedMs || keystrokes <= 0) return null;

  const elapsedMinutes = elapsedMs / 1000 / 60;
  const kpm = Math.min(maxRate, Math.round(keystrokes / elapsedMinutes));
  const cpm = Math.min(maxRate, Math.round(charCount / elapsedMinutes));
  return { kpm, cpm, elapsedTime: elapsedMs };
}
