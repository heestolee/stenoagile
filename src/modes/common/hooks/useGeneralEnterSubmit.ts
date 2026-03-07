import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { PositionStage } from "../../position/types";
import { buildPositionTransitionPair } from "../../position/utils/enterSubmit";
import {
  buildNextIncorrectWordsForReview,
  evaluateWordEnterSubmission,
  normalizeWordKey,
} from "../../words/utils/enterSubmit";
import { buildTypingSpeedMetrics, countNonSpaceChars, type TypingSpeedMetrics } from "../utils/typingMetrics";

type ModeResultEntry = {
  kpm: number;
  cpm: number;
  elapsedTime: number;
  chars: string;
  mode?: string;
};

type ReviewType = "primary" | "failed" | null;

type UseGeneralEnterSubmitParams = {
  typedWord: string;
  mode: string;
  sentences: string[];
  currentSentenceIndex: number;
  shuffledWords: string[];
  currentWordIndex: number;
  isPositionMode: boolean;
  currentPositionSampleStage: PositionStage | "mixed";
  currentWordStartTime: number | null;
  currentWordKeystrokes: number;
  isReviewActive: boolean;
  currentReviewTarget: string | null;
  reviewType: ReviewType;
  progressCount: number;
  incorrectWords: { word: string; typed: string }[];
  totalCount: number;
  setLastResult: Dispatch<SetStateAction<TypingSpeedMetrics>>;
  setAllResults: Dispatch<SetStateAction<ModeResultEntry[]>>;
  setReviewFailedWords: Dispatch<SetStateAction<{ word: string; typed: string }[]>>;
  recordResult: (word: string, result: "correct" | "half" | "incorrect") => void;
  handleReviewSubmit: (value: string) => boolean;
  recordPositionTransition: (
    isCorrect: boolean,
    elapsedMs: number,
    fromChar: string,
    toChar: string,
    stage: PositionStage | "mixed",
  ) => void;
  submitAnswer: (input: string) => void;
  checkAndStartReview: (
    progressCount: number,
    incorrectWords: { word: string; typed: string }[],
    totalCount: number,
  ) => void;
  resetCurrentWordTracking: () => void;
  updateTypedWord: (value: string) => void;
  clearInputElement: () => void;
  logResult: (payload: { mode: string; kpm: number; cpm: number; elapsedTime: number }) => void;
};

export function useGeneralEnterSubmit(params: UseGeneralEnterSubmitParams) {
  const {
    typedWord,
    mode,
    sentences,
    currentSentenceIndex,
    shuffledWords,
    currentWordIndex,
    isPositionMode,
    currentPositionSampleStage,
    currentWordStartTime,
    currentWordKeystrokes,
    isReviewActive,
    currentReviewTarget,
    reviewType,
    progressCount,
    incorrectWords,
    totalCount,
    setLastResult,
    setAllResults,
    setReviewFailedWords,
    recordResult,
    handleReviewSubmit,
    recordPositionTransition,
    submitAnswer,
    checkAndStartReview,
    resetCurrentWordTracking,
    updateTypedWord,
    clearInputElement,
    logResult,
  } = params;

  return useCallback(() => {
    let elapsedMs = 0;
    if (currentWordStartTime && currentWordKeystrokes > 0) {
      elapsedMs = Date.now() - currentWordStartTime;

      const speedMetrics = buildTypingSpeedMetrics({
        elapsedMs,
        keystrokes: currentWordKeystrokes,
        charCount: countNonSpaceChars(typedWord),
      });
      if (speedMetrics) {
        const { kpm, cpm, elapsedTime } = speedMetrics;
        setLastResult(speedMetrics);
        const currentChars = mode === "sentences" && sentences[currentSentenceIndex]
          ? sentences[currentSentenceIndex].trim()
          : shuffledWords[currentWordIndex]?.trim() || "";
        setAllResults((prev) => [...prev, { kpm, cpm, elapsedTime, chars: currentChars, mode }]);
        logResult({ mode, kpm, cpm, elapsedTime });
      }
    }

    if (isReviewActive && mode === "words") {
      const reviewTarget = normalizeWordKey(currentReviewTarget);
      const reviewCorrect = handleReviewSubmit(typedWord);
      if (reviewTarget) {
        recordResult(reviewTarget, reviewCorrect ? "correct" : "incorrect");
        if (!reviewCorrect && reviewType === "primary") {
          setReviewFailedWords((prev) => [...prev, { word: reviewTarget, typed: typedWord.trim() }]);
        }
        if (reviewCorrect && reviewType === "failed") {
          setReviewFailedWords((prev) => prev.filter((item) => item.word !== reviewTarget));
        }
      }
      resetCurrentWordTracking();
      updateTypedWord("");
      clearInputElement();
      return;
    }

    const currentTarget = shuffledWords[currentWordIndex] || "";
    const wordEnterEval = (mode === "words" || isPositionMode)
      ? evaluateWordEnterSubmission({ target: currentTarget, typedWord })
      : null;

    if (mode === "words" && wordEnterEval) {
      recordResult(
        wordEnterEval.targetClean,
        wordEnterEval.isExact ? "correct" : wordEnterEval.isHalf ? "half" : "incorrect",
      );
    }

    if (isPositionMode && wordEnterEval) {
      const pair = buildPositionTransitionPair({ words: shuffledWords, currentIndex: currentWordIndex });
      recordPositionTransition(wordEnterEval.isCorrect, elapsedMs, pair.fromChar, pair.toChar, currentPositionSampleStage);
    }

    submitAnswer(typedWord);
    if (mode === "words" && wordEnterEval) {
      const nextProgress = progressCount + 1;
      checkAndStartReview(
        nextProgress,
        buildNextIncorrectWordsForReview({
          incorrectWords,
          isCorrect: wordEnterEval.isCorrect,
          targetClean: wordEnterEval.targetClean,
          typedWord,
        }),
        totalCount,
      );
    }
    resetCurrentWordTracking();
  }, [
    checkAndStartReview,
    clearInputElement,
    currentPositionSampleStage,
    currentReviewTarget,
    currentSentenceIndex,
    currentWordIndex,
    currentWordKeystrokes,
    currentWordStartTime,
    handleReviewSubmit,
    incorrectWords,
    isPositionMode,
    isReviewActive,
    logResult,
    mode,
    progressCount,
    recordPositionTransition,
    recordResult,
    resetCurrentWordTracking,
    reviewType,
    sentences,
    setAllResults,
    setLastResult,
    setReviewFailedWords,
    shuffledWords,
    submitAnswer,
    totalCount,
    typedWord,
    updateTypedWord,
  ]);
}
