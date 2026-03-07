import type { IncorrectEntry } from "../types";

export type WordEnterEvaluation = {
  targetClean: string;
  inputClean: string;
  isCorrect: boolean;
  isExact: boolean;
  isHalf: boolean;
};

type EvaluateWordEnterSubmissionParams = {
  target: string;
  typedWord: string;
};

type BuildNextIncorrectWordsParams = {
  incorrectWords: IncorrectEntry[];
  isCorrect: boolean;
  targetClean: string;
  typedWord: string;
};

export function normalizeWordKey(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "");
}

export function evaluateWordEnterSubmission(
  params: EvaluateWordEnterSubmissionParams,
): WordEnterEvaluation {
  const targetClean = normalizeWordKey(params.target);
  const inputClean = normalizeWordKey(params.typedWord);
  const isCorrect = inputClean.endsWith(targetClean) && targetClean.length > 0;
  const isExact = inputClean === targetClean;
  const isHalf = !isExact && isCorrect;
  return {
    targetClean,
    inputClean,
    isCorrect,
    isExact,
    isHalf,
  };
}

export function buildNextIncorrectWordsForReview(
  params: BuildNextIncorrectWordsParams,
): IncorrectEntry[] {
  const { incorrectWords, isCorrect, targetClean, typedWord } = params;
  if (isCorrect) return incorrectWords;
  return [...incorrectWords, { word: targetClean, typed: typedWord.trim() }];
}
