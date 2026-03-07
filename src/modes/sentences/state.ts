import type { IncorrectEntry } from "../words/types";

export type SavedSentenceState = {
  sentences: string[];
  generatedCount: number;
  currentSentenceIndex: number;
  progressCount: number;
  correctCount: number;
  incorrectCount: number;
  incorrectWords: IncorrectEntry[];
  totalCount: number;
};

export type SentenceResumePayload = {
  sentences: string[];
  currentSentenceIndex: number;
  progressCount: number;
  correctCount: number;
  incorrectCount: number;
  incorrectWords: IncorrectEntry[];
  totalCount: number;
};

type CreateSavedSentenceStateParams = {
  sentences: string[];
  generatedCount: number;
  currentSentenceIndex: number;
  progressCount: number;
  correctCount: number;
  incorrectCount: number;
  incorrectWords: IncorrectEntry[];
  totalCount: number;
};

export function createSavedSentenceState(params: CreateSavedSentenceStateParams): SavedSentenceState {
  const {
    sentences,
    generatedCount,
    currentSentenceIndex,
    progressCount,
    correctCount,
    incorrectCount,
    incorrectWords,
    totalCount,
  } = params;

  return {
    sentences: [...sentences],
    generatedCount,
    currentSentenceIndex,
    progressCount,
    correctCount,
    incorrectCount,
    incorrectWords: [...incorrectWords],
    totalCount: totalCount > 0 ? totalCount : sentences.length,
  };
}

export function toSentenceResumePayload(saved: SavedSentenceState): SentenceResumePayload {
  return {
    sentences: saved.sentences,
    currentSentenceIndex: saved.currentSentenceIndex,
    progressCount: saved.progressCount,
    correctCount: saved.correctCount,
    incorrectCount: saved.incorrectCount,
    incorrectWords: saved.incorrectWords,
    totalCount: saved.totalCount > 0 ? saved.totalCount : saved.sentences.length,
  };
}
