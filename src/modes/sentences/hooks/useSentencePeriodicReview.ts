import { useEffect, type MutableRefObject } from "react";
import { pickSentenceReviewTargetsFromRecentWindow } from "../review";

type ResultEntry = {
  kpm: number;
  cpm: number;
  elapsedTime: number;
  chars: string;
  mode?: string;
};

type Params = {
  mode: string;
  isPracticing: boolean;
  isSentenceReview: boolean;
  isReviewActive: boolean;
  progressCount: number;
  allResults: ResultEntry[];
  reviewWindow: number;
  lastSentenceReviewAtRef: MutableRefObject<number>;
  savePreReviewState: () => void;
  startSentenceReviewFlow: (reviewSentences: string[]) => void;
};

export function useSentencePeriodicReview(params: Params) {
  const {
    mode,
    isPracticing,
    isSentenceReview,
    isReviewActive,
    progressCount,
    allResults,
    reviewWindow,
    lastSentenceReviewAtRef,
    savePreReviewState,
    startSentenceReviewFlow,
  } = params;

  useEffect(() => {
    if (mode !== "sentences" || !isPracticing || isSentenceReview || isReviewActive) return;
    if (progressCount === 0 || progressCount % reviewWindow !== 0) return;
    if (lastSentenceReviewAtRef.current === progressCount) return;

    lastSentenceReviewAtRef.current = progressCount;
    const reviewSentences = pickSentenceReviewTargetsFromRecentWindow(allResults, reviewWindow);
    if (reviewSentences.length === 0) return;

    savePreReviewState();
    startSentenceReviewFlow(reviewSentences);
  }, [
    progressCount,
    mode,
    isPracticing,
    isSentenceReview,
    isReviewActive,
    allResults,
    reviewWindow,
    lastSentenceReviewAtRef,
    savePreReviewState,
    startSentenceReviewFlow,
  ]);
}
