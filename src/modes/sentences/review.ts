import { SENTENCE_REVIEW_PICK_COUNT, SENTENCE_REVIEW_WINDOW } from "./constants";

type SentenceResult = {
  kpm: number;
  chars: string;
  mode?: string;
};

type WithMode = {
  mode?: string;
};

export function pickSentenceModeResults<T extends WithMode>(results: T[]): T[] {
  return results.filter((r) => r.mode === "sentences");
}

export function pickSentenceReviewTargets(results: SentenceResult[], count: number) {
  const sentenceResults = pickSentenceModeResults(results);
  if (sentenceResults.length === 0) return [];

  const recentSize = count % SENTENCE_REVIEW_WINDOW === 0 ? SENTENCE_REVIEW_WINDOW : count % SENTENCE_REVIEW_WINDOW;
  const recent = sentenceResults.slice(-recentSize);
  const sorted = [...recent].sort((a, b) => a.kpm - b.kpm);
  return sorted
    .slice(0, SENTENCE_REVIEW_PICK_COUNT)
    .map((r) => r.chars)
    .filter((chars) => chars.length > 0);
}

export function pickSentenceReviewTargetsFromRecentWindow(results: SentenceResult[], windowSize: number = SENTENCE_REVIEW_WINDOW) {
  const sentenceResults = pickSentenceModeResults(results);
  if (sentenceResults.length === 0) return [];

  const recentWindow = sentenceResults.slice(-windowSize);
  const sorted = [...recentWindow].sort((a, b) => a.kpm - b.kpm);
  return sorted
    .slice(0, SENTENCE_REVIEW_PICK_COUNT)
    .map((r) => r.chars)
    .filter((chars) => chars.length > 0);
}

export function toSentenceReviewResumePayload(reviewSentences: string[]) {
  return {
    sentences: reviewSentences,
    currentSentenceIndex: 0,
    progressCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    incorrectWords: [],
    totalCount: reviewSentences.length,
  };
}
