import { buildTypingSpeedMetrics, countNonSpaceChars, type TypingSpeedMetrics } from "../../common/utils/typingMetrics";

type BuildSequentialPauseMetricsParams = {
  typedWord: string;
  currentWordStartTime: number | null;
  currentWordKeystrokes: number;
  accumulatedKeystrokes: number;
  accumulatedElapsedMs: number;
  pendingImeKeystrokes: number;
};

export type SequentialPauseMetrics = {
  totalKeystrokes: number;
  totalElapsedMs: number;
  speedMetrics: TypingSpeedMetrics | null;
};

export function buildSequentialPauseMetrics(
  params: BuildSequentialPauseMetricsParams,
): SequentialPauseMetrics {
  const {
    typedWord,
    currentWordStartTime,
    currentWordKeystrokes,
    accumulatedKeystrokes,
    accumulatedElapsedMs,
    pendingImeKeystrokes,
  } = params;

  const currentElapsedMs = currentWordStartTime ? Date.now() - currentWordStartTime : 0;
  const totalKeystrokes = accumulatedKeystrokes + currentWordKeystrokes + pendingImeKeystrokes;
  const totalElapsedMs = accumulatedElapsedMs + currentElapsedMs;
  const speedMetrics = buildTypingSpeedMetrics({
    elapsedMs: totalElapsedMs,
    keystrokes: totalKeystrokes,
    charCount: countNonSpaceChars(typedWord),
  });

  return {
    totalKeystrokes,
    totalElapsedMs,
    speedMetrics,
  };
}
