import type { ChangeEvent, CompositionEvent, KeyboardEvent, RefObject } from "react";
import LongtextPracticePanel from "./LongtextPracticePanel";

type ResultItem = {
  kpm: number;
  cpm: number;
  elapsedTime: number;
  chars: string;
  mode?: string;
};

type Props = {
  showText: boolean;
  mode: string;
  displayAreaRef: RefObject<HTMLDivElement | null>;
  wordInputRef: RefObject<HTMLInputElement | null>;
  practiceInputRef: RefObject<HTMLTextAreaElement | null>;
  countdown: number | null;
  practiceSlot: number | null;
  slotNames: { [key: number]: string };
  practicingMode: string | null;
  isPracticing: boolean;
  displayFontSize: number;
  lastSentenceTyped: string;
  sentences: string[];
  isRoundComplete: boolean;
  currentSentenceIndex: number;
  typedWord: string;
  isComposing: boolean;
  correctCount: number;
  incorrectCount: number;
  totalCount: number;
  onStartNextRound: () => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onInputKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onCompositionStart: () => void;
  onCompositionEnd: (e: CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  practiceText: string;
  onPracticeTextChange: (value: string) => void;
  modeResults: ResultItem[];
  rankFontSize: number;
  onResetResults: () => void;
};

export default function LongtextModePanel({
  showText,
  mode,
  displayAreaRef,
  wordInputRef,
  practiceInputRef,
  countdown,
  practiceSlot,
  slotNames,
  practicingMode,
  isPracticing,
  displayFontSize,
  lastSentenceTyped,
  sentences,
  isRoundComplete,
  currentSentenceIndex,
  typedWord,
  isComposing,
  correctCount,
  incorrectCount,
  totalCount,
  onStartNextRound,
  onInputChange,
  onInputKeyDown,
  onCompositionStart,
  onCompositionEnd,
  practiceText,
  onPracticeTextChange,
  modeResults,
  rankFontSize,
  onResetResults,
}: Props) {
  if (!showText || mode !== "longtext") return null;

  return (
    <LongtextPracticePanel
      displayAreaRef={displayAreaRef}
      wordInputRef={wordInputRef}
      practiceInputRef={practiceInputRef}
      countdown={countdown}
      practiceSlot={practiceSlot}
      slotNames={slotNames}
      practicingMode={practicingMode}
      isPracticing={isPracticing}
      displayFontSize={displayFontSize}
      lastSentenceTyped={lastSentenceTyped}
      sentences={sentences}
      isRoundComplete={isRoundComplete}
      currentSentenceIndex={currentSentenceIndex}
      typedWord={typedWord}
      isComposing={isComposing}
      correctCount={correctCount}
      incorrectCount={incorrectCount}
      totalCount={totalCount}
      onStartNextRound={onStartNextRound}
      onInputChange={onInputChange}
      onInputKeyDown={onInputKeyDown}
      onCompositionStart={onCompositionStart}
      onCompositionEnd={onCompositionEnd}
      practiceText={practiceText}
      onPracticeTextChange={onPracticeTextChange}
      modeResults={modeResults}
      rankFontSize={rankFontSize}
      onResetResults={onResetResults}
    />
  );
}
