import type { ChangeEvent, CompositionEvent, Dispatch, KeyboardEvent, RefObject, SetStateAction } from "react";
import type { MarkedChar, ScoringResult } from "../../common/utils/scoringAnalysis";
import SequentialDisplayPanel from "./SequentialDisplayPanel";
import SequentialTypingArea from "./SequentialTypingArea";
import SequentialResumePanel from "./SequentialResumePanel";

type SequentialMarkedChar = {
  state: "correct" | "deletion" | "insertion" | "substitution";
  char: string;
  origIdx?: number;
  expectedChar?: string;
};

type Props = {
  showText: boolean;
  mode: string;
  displayAreaRef: RefObject<HTMLDivElement | null>;
  countdown: number | null;
  practiceSlot: number | null;
  slotNames: { [key: number]: string };
  slotCompletedRoundsNormal: Record<number, number>;
  slotCompletedRoundsBatch: Record<number, number>;
  isRoundComplete: boolean;
  markedOriginalText: MarkedChar[];
  hoveredOrigIdx: number | null;
  setHoveredOrigIdx: Dispatch<SetStateAction<number | null>>;
  displayFontSize: number;
  displayedText: string;
  showResumeHighlight: boolean;
  resumePosition: number;
  isBatchMode: boolean;
  batchRandomFillCount: number;
  scoringResult: ScoringResult | null;
  markedText: SequentialMarkedChar[];
  inputFontSize: number;
  typingTextareaRef: RefObject<HTMLTextAreaElement | null>;
  handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setShowResumeHighlight: (v: boolean) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleCompositionStart: () => void;
  handleCompositionEnd: (e: CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  isFullyComplete: boolean;
  isBatchReviewDone: boolean;
  practiceText: string;
  setPracticeText: (v: string) => void;
  favoriteSlots: Set<number>;
  selectedSlot: number | null;
  updateInputText: (text: string) => void;
  startNextRound: (nextSlot?: number) => void;
  resumeRound: () => void;
};

export default function SequentialPracticePanel({
  showText,
  mode,
  displayAreaRef,
  countdown,
  practiceSlot,
  slotNames,
  slotCompletedRoundsNormal,
  slotCompletedRoundsBatch,
  isRoundComplete,
  markedOriginalText,
  hoveredOrigIdx,
  setHoveredOrigIdx,
  displayFontSize,
  displayedText,
  showResumeHighlight,
  resumePosition,
  isBatchMode,
  batchRandomFillCount,
  scoringResult,
  markedText,
  inputFontSize,
  typingTextareaRef,
  handleInputChange,
  setShowResumeHighlight,
  handleKeyDown,
  handleCompositionStart,
  handleCompositionEnd,
  isFullyComplete,
  isBatchReviewDone,
  practiceText,
  setPracticeText,
  favoriteSlots,
  selectedSlot,
  updateInputText,
  startNextRound,
  resumeRound,
}: Props) {
  if (!showText || mode !== "sequential") return null;

  return (
    <div className="flex-1 flex flex-col gap-4">
      <SequentialDisplayPanel
        displayAreaRef={displayAreaRef}
        countdown={countdown}
        practiceSlot={practiceSlot}
        slotNames={slotNames}
        slotCompletedRoundsNormal={slotCompletedRoundsNormal}
        slotCompletedRoundsBatch={slotCompletedRoundsBatch}
        isRoundComplete={isRoundComplete}
        markedOriginalText={markedOriginalText}
        hoveredOrigIdx={hoveredOrigIdx}
        setHoveredOrigIdx={setHoveredOrigIdx}
        displayFontSize={displayFontSize}
        displayedText={displayedText}
        showResumeHighlight={showResumeHighlight}
        resumePosition={resumePosition}
        isBatchMode={isBatchMode}
        batchRandomFillCount={batchRandomFillCount}
      />
      <SequentialTypingArea
        isRoundComplete={isRoundComplete}
        scoringResult={scoringResult}
        markedText={markedText}
        hoveredOrigIdx={hoveredOrigIdx}
        setHoveredOrigIdx={setHoveredOrigIdx}
        inputFontSize={inputFontSize}
        typingTextareaRef={typingTextareaRef}
        handleInputChange={handleInputChange}
        showResumeHighlight={showResumeHighlight}
        setShowResumeHighlight={setShowResumeHighlight}
        handleKeyDown={handleKeyDown}
        handleCompositionStart={handleCompositionStart}
        handleCompositionEnd={handleCompositionEnd}
      />
      {isRoundComplete && (
        <SequentialResumePanel
          isFullyComplete={isFullyComplete}
          isBatchMode={isBatchMode}
          isBatchReviewDone={isBatchReviewDone}
          practiceText={practiceText}
          setPracticeText={setPracticeText}
          inputFontSize={inputFontSize}
          favoriteSlots={favoriteSlots}
          practiceSlot={practiceSlot}
          selectedSlot={selectedSlot}
          updateInputText={updateInputText}
          startNextRound={startNextRound}
          resumeRound={resumeRound}
        />
      )}
    </div>
  );
}

