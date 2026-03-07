import type { SavedSentenceState } from "./state";

export type FinalSentenceReviewSnapshot = {
  originalCorrect: number;
  originalIncorrect: number;
  originalTotal: number;
  reviewCorrect: number;
  reviewTotal: number;
};

export type WordSentenceRoundCompleteResult = {
  correct: number;
  halfCorrect: number;
  incorrect: number;
  total: number;
  avgKpm: number;
  avgCpm: number;
  lastKpm: number;
  lastCpm: number;
  reviewCorrect?: number;
  reviewTotal?: number;
};

type EvaluateSentenceReviewCompletionResult = {
  isFinalReview: boolean;
  finalReviewSnapshot: FinalSentenceReviewSnapshot | null;
};

type BuildWordSentenceRoundCompleteResultParams = {
  finalReviewSnapshot: FinalSentenceReviewSnapshot | null;
  correctCount: number;
  halfCorrectCount: number;
  incorrectCount: number;
  totalCount: number;
  avgKpm: number;
  avgCpm: number;
  lastKpm: number;
  lastCpm: number;
};

export function evaluateSentenceReviewCompletion(
  saved: SavedSentenceState | null,
  reviewCorrect: number,
  reviewTotal: number,
): EvaluateSentenceReviewCompletionResult {
  const isFinalReview = !!saved && saved.progressCount >= saved.totalCount;
  if (!isFinalReview || !saved) {
    return {
      isFinalReview: false,
      finalReviewSnapshot: null,
    };
  }

  return {
    isFinalReview: true,
    finalReviewSnapshot: {
      originalCorrect: saved.correctCount,
      originalIncorrect: saved.incorrectCount,
      originalTotal: saved.totalCount,
      reviewCorrect,
      reviewTotal,
    },
  };
}

export function buildWordSentenceRoundCompleteResult(
  params: BuildWordSentenceRoundCompleteResultParams,
): WordSentenceRoundCompleteResult {
  const {
    finalReviewSnapshot,
    correctCount,
    halfCorrectCount,
    incorrectCount,
    totalCount,
    avgKpm,
    avgCpm,
    lastKpm,
    lastCpm,
  } = params;

  return {
    correct: finalReviewSnapshot ? finalReviewSnapshot.originalCorrect : correctCount,
    halfCorrect: halfCorrectCount,
    incorrect: finalReviewSnapshot ? finalReviewSnapshot.originalIncorrect : incorrectCount,
    total: finalReviewSnapshot ? finalReviewSnapshot.originalTotal : totalCount,
    avgKpm,
    avgCpm,
    lastKpm,
    lastCpm,
    ...(finalReviewSnapshot
      ? {
          reviewCorrect: finalReviewSnapshot.reviewCorrect,
          reviewTotal: finalReviewSnapshot.reviewTotal,
        }
      : {}),
  };
}
