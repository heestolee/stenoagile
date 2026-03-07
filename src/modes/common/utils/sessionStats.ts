type ResultStatEntry = {
  kpm: number;
  cpm: number;
  elapsedTime: number;
};

type ModeEntry = {
  mode?: string;
};

export type SessionStats = {
  totalResults: number;
  totalElapsedTime: number;
  avgKpm: number;
  avgCpm: number;
  avgKpmRounded: number;
  avgCpmRounded: number;
};

export function pickModeResults<T extends ModeEntry>(results: T[], mode: string): T[] {
  return results.filter((r) => r.mode === mode);
}

export function computeSessionStats(results: ResultStatEntry[]): SessionStats | null {
  if (results.length === 0) return null;

  const totalResults = results.length;
  const totalKpm = results.reduce((sum, r) => sum + r.kpm, 0);
  const totalCpm = results.reduce((sum, r) => sum + r.cpm, 0);
  const totalElapsedTime = results.reduce((sum, r) => sum + r.elapsedTime, 0);
  const avgKpm = totalKpm / totalResults;
  const avgCpm = totalCpm / totalResults;

  return {
    totalResults,
    totalElapsedTime,
    avgKpm,
    avgCpm,
    avgKpmRounded: Math.round(avgKpm),
    avgCpmRounded: Math.round(avgCpm),
  };
}

export function computeAccuracyPercent(correctCount: number, incorrectCount: number): number {
  const total = correctCount + incorrectCount;
  return total > 0 ? (correctCount / total) * 100 : 0;
}

type SessionLogPayloadParams = {
  mode: string;
  results: ResultStatEntry[];
  correctCount: number;
  incorrectCount: number;
  useRoundedAverage?: boolean;
};

export type SessionLogPayload = {
  mode: string;
  totalResults: number;
  avgKpm: number;
  avgCpm: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  totalElapsedTime: number;
};

export function toSessionLogPayload(params: SessionLogPayloadParams): SessionLogPayload | null {
  const { mode, results, correctCount, incorrectCount, useRoundedAverage = false } = params;
  const stats = computeSessionStats(results);
  if (!stats) return null;

  return {
    mode,
    totalResults: stats.totalResults,
    avgKpm: useRoundedAverage ? stats.avgKpmRounded : stats.avgKpm,
    avgCpm: useRoundedAverage ? stats.avgCpmRounded : stats.avgCpm,
    correctCount,
    incorrectCount,
    accuracy: computeAccuracyPercent(correctCount, incorrectCount),
    totalElapsedTime: stats.totalElapsedTime,
  };
}
