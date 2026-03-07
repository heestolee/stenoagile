import { useEffect, useState } from "react";

export type ReviewFailedWord = { word: string; typed: string };

export function useReviewFailedWords() {
  const [reviewFailedWords, setReviewFailedWords] = useState<ReviewFailedWord[]>(() => {
    try {
      const saved = localStorage.getItem("reviewFailedWords");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("reviewFailedWords", JSON.stringify(reviewFailedWords));
  }, [reviewFailedWords]);

  return { reviewFailedWords, setReviewFailedWords };
}
