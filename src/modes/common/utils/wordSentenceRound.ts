import {
  buildWordSentenceRoundCompleteResult,
  type FinalSentenceReviewSnapshot,
  type WordSentenceRoundCompleteResult,
} from "../../sentences/roundCompletion";
import { pickModeResults, toSessionLogPayload, type SessionLogPayload } from "./sessionStats";

type RoundResultEntry = {
  kpm: number;
  cpm: number;
  elapsedTime: number;
  mode?: string;
};

type CreateWordSentenceRoundOutcomeParams = {
  allResults: RoundResultEntry[];
  mode: string;
  finalReviewSnapshot: FinalSentenceReviewSnapshot | null;
  correctCount: number;
  halfCorrectCount: number;
  incorrectCount: number;
  totalCount: number;
};

export type WordSentenceRoundOutcome = {
  roundCompleteResult: WordSentenceRoundCompleteResult;
  sessionLogPayload: SessionLogPayload | null;
};

export function createWordSentenceRoundOutcome(
  params: CreateWordSentenceRoundOutcomeParams,
): WordSentenceRoundOutcome {
  const {
    allResults,
    mode,
    finalReviewSnapshot,
    correctCount,
    halfCorrectCount,
    incorrectCount,
    totalCount,
  } = params;

  const currentModeResults = pickModeResults(allResults, mode);
  const sessionLogPayload = toSessionLogPayload({
    mode,
    results: currentModeResults,
    correctCount,
    incorrectCount,
    useRoundedAverage: true,
  });
  const avgKpm = sessionLogPayload ? Math.round(sessionLogPayload.avgKpm) : 0;
  const avgCpm = sessionLogPayload ? Math.round(sessionLogPayload.avgCpm) : 0;

  const lastEntry = currentModeResults.length > 0 ? currentModeResults[currentModeResults.length - 1] : null;
  const lastKpm = lastEntry ? Math.round(lastEntry.kpm) : 0;
  const lastCpm = lastEntry ? Math.round(lastEntry.cpm) : 0;

  const roundCompleteResult = buildWordSentenceRoundCompleteResult({
    finalReviewSnapshot,
    correctCount,
    halfCorrectCount,
    incorrectCount,
    totalCount,
    avgKpm,
    avgCpm,
    lastKpm,
    lastCpm,
  });

  return {
    roundCompleteResult,
    sessionLogPayload,
  };
}
