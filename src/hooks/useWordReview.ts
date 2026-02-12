import { useState, useCallback } from "react";
import { useTypingStore, type IncorrectEntry } from "../store/useTypingStore";

const removeWhitespace = (text: string): string => text.replace(/\s+/g, "");

export type ReviewType = "primary" | "failed" | null;

export function useWordReview() {
  const [isReviewActive, setIsReviewActive] = useState(false);
  const [reviewWords, setReviewWords] = useState<IncorrectEntry[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [reviewType, setReviewType] = useState<ReviewType>(null);

  const removeIncorrectWord = useTypingStore((s) => s.removeIncorrectWord);

  const currentReviewTarget = isReviewActive && reviewWords[currentReviewIndex]
    ? reviewWords[currentReviewIndex].word
    : null;

  const checkAndStartReview = useCallback(
    (progressCount: number, incorrectWords: IncorrectEntry[], totalCount: number) => {
      const interval = totalCount < 10 ? totalCount : 10;
      if (interval <= 0) return;

      if ((progressCount % interval === 0 || progressCount >= totalCount) && incorrectWords.length > 0) {
        const uniqueWords = incorrectWords.filter(
          (item, idx, arr) => arr.findIndex((x) => x.word === item.word) === idx
        );
        setReviewWords(uniqueWords);
        setCurrentReviewIndex(0);
        setIsReviewActive(true);
        setReviewType("primary");
      }
    },
    []
  );

  const startFailedReview = useCallback(
    (failedWords: IncorrectEntry[]) => {
      if (failedWords.length === 0) return;
      const uniqueWords = failedWords.filter(
        (item, idx, arr) => arr.findIndex((x) => x.word === item.word) === idx
      );
      setReviewWords(uniqueWords);
      setCurrentReviewIndex(0);
      setIsReviewActive(true);
      setReviewType("failed");
    },
    []
  );

  const handleReviewSubmit = useCallback(
    (input: string): boolean => {
      if (!isReviewActive || !reviewWords[currentReviewIndex]) return false;

      const target = reviewWords[currentReviewIndex].word;
      const isCorrect = removeWhitespace(input).endsWith(removeWhitespace(target)) &&
        removeWhitespace(target).length > 0;

      if (isCorrect && reviewType === "primary") {
        const targetWord = reviewWords[currentReviewIndex];
        removeIncorrectWord(targetWord.word, targetWord.typed);
      }

      const nextIndex = currentReviewIndex + 1;
      if (nextIndex >= reviewWords.length) {
        const completedType = reviewType;
        setIsReviewActive(false);
        setReviewWords([]);
        setCurrentReviewIndex(0);
        setReviewType(null);
        return isCorrect;
      } else {
        setCurrentReviewIndex(nextIndex);
      }

      return isCorrect;
    },
    [isReviewActive, reviewWords, currentReviewIndex, removeIncorrectWord, reviewType]
  );

  const resetReview = useCallback(() => {
    setIsReviewActive(false);
    setReviewWords([]);
    setCurrentReviewIndex(0);
    setReviewType(null);
  }, []);

  return {
    isReviewActive,
    reviewWords,
    currentReviewIndex,
    currentReviewTarget,
    reviewType,
    checkAndStartReview,
    startFailedReview,
    handleReviewSubmit,
    resetReview,
  };
}
