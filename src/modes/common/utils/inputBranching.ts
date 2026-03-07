type BuildAutoSubmitTargetParams = {
  isReviewActive: boolean;
  currentReviewTarget: string | null;
  mode: string;
  isPracticing: boolean;
  sentences: string[];
  currentSentenceIndex: number;
  isWordLikeMode: boolean;
  shuffledWords: string[];
  currentWordIndex: number;
};

export function normalizeNoSpace(value: string): string {
  return value.replace(/\s+/g, "");
}

export function buildAutoSubmitTarget(params: BuildAutoSubmitTargetParams): string | null {
  const {
    isReviewActive,
    currentReviewTarget,
    mode,
    isPracticing,
    sentences,
    currentSentenceIndex,
    isWordLikeMode,
    shuffledWords,
    currentWordIndex,
  } = params;

  if (isReviewActive && currentReviewTarget) return currentReviewTarget.trim();

  if ((mode === "sentences" || mode === "longtext") && isPracticing && sentences[currentSentenceIndex]) {
    return sentences[currentSentenceIndex].trim();
  }

  if (isWordLikeMode && isPracticing && shuffledWords[currentWordIndex]) {
    return shuffledWords[currentWordIndex].trim();
  }

  return null;
}

export function isAutoSubmitMatch(params: {
  value: string;
  target: string | null;
  isWordLikeMode: boolean;
  isReviewActive: boolean;
  isAutoSubmitting: boolean;
}): boolean {
  const { value, target, isWordLikeMode, isReviewActive, isAutoSubmitting } = params;
  if (!target || isAutoSubmitting) return false;

  if (isWordLikeMode || isReviewActive) {
    const inputClean = normalizeNoSpace(value);
    const targetClean = normalizeNoSpace(target);
    return targetClean.length > 0 && inputClean.endsWith(targetClean);
  }

  return value.trim() === target;
}

const EXCLUDED_KEYS = new Set([
  "Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "Escape",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "Home", "End", "PageUp", "PageDown", "Insert",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
]);

export function shouldCountKeystroke(params: {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isIMEComposing: boolean;
}): boolean {
  const { key, ctrlKey, altKey, metaKey, isIMEComposing } = params;
  if (ctrlKey || altKey || metaKey) return false;
  if (isIMEComposing) return false;
  return !EXCLUDED_KEYS.has(key);
}

