import type { KeyboardEventHandler, RefObject } from "react";
import SentencePracticePanel from "./SentencePracticePanel";

type ResultItem = {
  kpm: number;
  cpm: number;
  elapsedTime: number;
  chars: string;
  mode?: string;
};

type CountResult = {
  correct?: number;
  incorrect?: number;
} | null;

type Props = {
  mode: string;
  isPracticing: boolean;
  correctCount: number;
  incorrectCount: number;
  roundCompleteResult: CountResult;
  progressLabel: string;
  isSentenceReview: boolean;
  practiceText: string;
  setPracticeText: (value: string) => void;
  practiceInputRef: RefObject<HTMLTextAreaElement | null>;
  rankFontSize: number;
  results: ResultItem[];
  onClearSentenceResults: () => void;
  onClearPracticeText: () => void;
  onPracticeTab: KeyboardEventHandler<HTMLTextAreaElement>;
};

export default function SentenceModePanel({
  mode,
  isPracticing,
  correctCount,
  incorrectCount,
  roundCompleteResult,
  progressLabel,
  isSentenceReview,
  practiceText,
  setPracticeText,
  practiceInputRef,
  rankFontSize,
  results,
  onClearSentenceResults,
  onClearPracticeText,
  onPracticeTab,
}: Props) {
  if (mode !== "sentences") return null;

  return (
    <SentencePracticePanel
      correctCount={isPracticing ? correctCount : (roundCompleteResult?.correct ?? correctCount)}
      incorrectCount={isPracticing ? incorrectCount : (roundCompleteResult?.incorrect ?? incorrectCount)}
      progressLabel={progressLabel}
      showReviewBadge={isSentenceReview && isPracticing}
      practiceText={practiceText}
      setPracticeText={setPracticeText}
      practiceInputRef={practiceInputRef}
      rankFontSize={rankFontSize}
      results={results}
      onClearSentenceResults={onClearSentenceResults}
      onClearPracticeText={onClearPracticeText}
      onPracticeTab={onPracticeTab}
    />
  );
}
