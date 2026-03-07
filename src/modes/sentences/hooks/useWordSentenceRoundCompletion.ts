import { useEffect, type MutableRefObject } from "react";
import { createWordSentenceRoundOutcome } from "../../common/utils/wordSentenceRound";
import { decideSentenceReviewCompletion } from "../reviewLifecycle";
import { pickSentenceReviewTargets } from "../review";
import type { FinalSentenceReviewSnapshot } from "../roundCompletion";
import type { SavedSentenceState, SentenceResumePayload } from "../state";

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
  totalCount: number;
  progressCount: number;
  isReviewActive: boolean;
  isSentenceReview: boolean;
  allResults: ResultEntry[];
  correctCount: number;
  halfCorrectCount: number;
  incorrectCount: number;
  practiceSlot: number | null;
  preReviewSentenceStateRef: MutableRefObject<SavedSentenceState | null>;
  setIsSentenceReview: (v: boolean) => void;
  clearSentenceResults: () => void;
  createCurrentSentenceState: () => SavedSentenceState;
  startSentenceReviewFlow: (reviewSentences: string[], preReviewProgress?: number) => void;
  resumeSentencePractice: (state: SentenceResumePayload) => void;
  updateTypedWord: (word: string) => void;
  clearInputElement: () => void;
  clearLastSentenceTyped: () => void;
  focusWordInputSoon: () => void;
  setRoundCompleteResult: (v: ReturnType<typeof createWordSentenceRoundOutcome>["roundCompleteResult"]) => void;
  logSession: (payload: NonNullable<ReturnType<typeof createWordSentenceRoundOutcome>["sessionLogPayload"]>) => void;
  finishPracticeAndOpenDrawer: () => void;
  incrementCompletedRounds: (slot: number | null, modeKey: string, amount?: number) => void;
};

export function useWordSentenceRoundCompletion(params: Params) {
  const {
    mode,
    isPracticing,
    totalCount,
    progressCount,
    isReviewActive,
    isSentenceReview,
    allResults,
    correctCount,
    halfCorrectCount,
    incorrectCount,
    practiceSlot,
    preReviewSentenceStateRef,
    setIsSentenceReview,
    clearSentenceResults,
    createCurrentSentenceState,
    startSentenceReviewFlow,
    resumeSentencePractice,
    updateTypedWord,
    clearInputElement,
    clearLastSentenceTyped,
    focusWordInputSoon,
    setRoundCompleteResult,
    logSession,
    finishPracticeAndOpenDrawer,
    incrementCompletedRounds,
  } = params;

  useEffect(() => {
    if (isReviewActive) return;

    if (
      (mode === "words" || mode === "sentences") &&
      isPracticing &&
      totalCount > 0 &&
      progressCount >= totalCount
    ) {
      let finalReviewSnapshot: FinalSentenceReviewSnapshot | null = null;

      if (isSentenceReview) {
        const saved = preReviewSentenceStateRef.current;
        const reviewCompletion = decideSentenceReviewCompletion(saved, correctCount, totalCount);
        const isFinalReview = reviewCompletion.isFinalReview;
        finalReviewSnapshot = reviewCompletion.finalReviewSnapshot;

        setIsSentenceReview(false);
        preReviewSentenceStateRef.current = null;

        if (!isFinalReview && reviewCompletion.resumePayload) {
          clearSentenceResults();
          resumeSentencePractice(reviewCompletion.resumePayload);
          updateTypedWord("");
          clearInputElement();
          clearLastSentenceTyped();
          focusWordInputSoon();
          return;
        }
      }

      if (mode === "sentences" && !isSentenceReview) {
        const reviewSentences = pickSentenceReviewTargets(allResults, progressCount);
        if (reviewSentences.length > 0) {
          preReviewSentenceStateRef.current = createCurrentSentenceState();
          startSentenceReviewFlow(reviewSentences, progressCount);
          return;
        }
      }

      const roundOutcome = createWordSentenceRoundOutcome({
        allResults,
        mode,
        finalReviewSnapshot,
        correctCount,
        halfCorrectCount,
        incorrectCount,
        totalCount,
      });
      setRoundCompleteResult(roundOutcome.roundCompleteResult);
      if (roundOutcome.sessionLogPayload) {
        logSession(roundOutcome.sessionLogPayload);
      }
      finishPracticeAndOpenDrawer();
      if (mode !== "sentences") {
        incrementCompletedRounds(practiceSlot, mode, totalCount);
      }
    }
  }, [
    progressCount,
    totalCount,
    mode,
    isPracticing,
    isReviewActive,
    isSentenceReview,
    allResults,
    correctCount,
    halfCorrectCount,
    incorrectCount,
    practiceSlot,
    preReviewSentenceStateRef,
    setIsSentenceReview,
    clearSentenceResults,
    createCurrentSentenceState,
    startSentenceReviewFlow,
    resumeSentencePractice,
    updateTypedWord,
    clearInputElement,
    clearLastSentenceTyped,
    focusWordInputSoon,
    setRoundCompleteResult,
    logSession,
    finishPracticeAndOpenDrawer,
    incrementCompletedRounds,
  ]);
}
