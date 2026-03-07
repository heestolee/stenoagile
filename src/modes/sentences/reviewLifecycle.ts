import { evaluateSentenceReviewCompletion, type FinalSentenceReviewSnapshot } from "./roundCompletion";
import { toSentenceResumePayload, type SavedSentenceState, type SentenceResumePayload } from "./state";

export type SentenceReviewCompletionDecision = {
  isFinalReview: boolean;
  finalReviewSnapshot: FinalSentenceReviewSnapshot | null;
  resumePayload: SentenceResumePayload | null;
};

export function decideSentenceReviewCompletion(
  saved: SavedSentenceState | null,
  reviewCorrect: number,
  reviewTotal: number,
): SentenceReviewCompletionDecision {
  const reviewCompletion = evaluateSentenceReviewCompletion(saved, reviewCorrect, reviewTotal);
  if (!reviewCompletion.isFinalReview && saved) {
    return {
      isFinalReview: false,
      finalReviewSnapshot: null,
      resumePayload: toSentenceResumePayload(saved),
    };
  }

  return {
    isFinalReview: reviewCompletion.isFinalReview,
    finalReviewSnapshot: reviewCompletion.finalReviewSnapshot,
    resumePayload: null,
  };
}
