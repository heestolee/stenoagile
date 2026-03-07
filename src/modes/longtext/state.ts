import type { IncorrectEntry } from "../words/types";

export type SavedLongtextState = {
  sentences: string[];
  currentSentenceIndex: number;
  progressCount: number;
  correctCount: number;
  incorrectCount: number;
  incorrectWords: IncorrectEntry[];
  totalCount: number;
  inputText: string;
};

type CreateSavedLongtextStateParams = {
  sentences: string[];
  currentSentenceIndex: number;
  progressCount: number;
  correctCount: number;
  incorrectCount: number;
  incorrectWords: IncorrectEntry[];
  totalCount: number;
  inputText: string;
};

export function createSavedLongtextState(params: CreateSavedLongtextStateParams): SavedLongtextState {
  const {
    sentences,
    currentSentenceIndex,
    progressCount,
    correctCount,
    incorrectCount,
    incorrectWords,
    totalCount,
    inputText,
  } = params;

  return {
    sentences: [...sentences],
    currentSentenceIndex,
    progressCount,
    correctCount,
    incorrectCount,
    incorrectWords: [...incorrectWords],
    totalCount: totalCount > 0 ? totalCount : sentences.length,
    inputText,
  };
}

export function toLongtextResumePayload(saved: SavedLongtextState) {
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
