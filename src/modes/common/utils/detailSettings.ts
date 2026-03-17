import type { Mode } from "../types";

export type DetailSettings = {
  speechRate?: number;
  displayFontSize?: number;
  inputFontSize?: number;
  charsPerRead?: number;
  sequentialSpeechRate?: number;
  batchSize?: number;
  rankFontSize?: number;
  longTextLength?: number;
  showText?: boolean;
  isSoundEnabled?: boolean;
  showPositionKeyboard?: boolean;
  sentenceReviewWindow?: number;
  wordsPerSentence?: number;
  sentenceMinLength?: number;
  sentenceMaxLength?: number;
};

export const GLOBAL_DETAIL_SETTINGS_KEY = "detailSettings";

export function getModeDetailSettingsKey(mode: Mode): string | null {
  if (mode === "sentences") return "detailSettings_sentences";
  if (mode === "position") return "detailSettings_position";
  if (mode === "words") return "detailSettings_words";
  return null;
}

export function loadDetailSettings(key: string): DetailSettings | null {
  const saved = localStorage.getItem(key);
  if (!saved) return null;

  try {
    return JSON.parse(saved) as DetailSettings;
  } catch {
    return null;
  }
}

export function saveDetailSettings(key: string, settings: DetailSettings) {
  localStorage.setItem(key, JSON.stringify(settings));
}
