import type { ChangeEventHandler, CompositionEventHandler, KeyboardEventHandler, RefObject } from "react";
import type { PositionStage } from "../../position/types";
import PositionPracticePanel from "../../position/components/PositionPracticePanel";
import WordSentenceDisplayPanel from "./WordSentenceDisplayPanel";
import SentenceInputPanel from "../../sentences/components/SentenceInputPanel";

type PositionKeyDef = { id: string; label: string };
type PositionStageOption = { key: PositionStage; label: string; numLabel: string; btnLabel: string };
type PositionKeyMetric = { avgMs: number };

type Props = {
  showText: boolean;
  mode: string;
  isPositionMode: boolean;
  isPracticing: boolean;
  positionEnabledStages: PositionStage[];
  setPositionEnabledStages: (stages: PositionStage[]) => void;
  switchPositionStageImmediately: (stage: PositionStage) => void;
  activeSingleStage: PositionStage | null;
  positionStageOptions: PositionStageOption[];
  currentWordIndex: number;
  shuffledWords: string[];
  displayFontSize: number;
  showPositionKeyboard: boolean;
  hoveredPositionKeyId: string | null;
  setHoveredPositionKeyId: (id: string | null) => void;
  hoveredTransitionKeyIds: Set<string>;
  positionPerKeyMap: Map<string, PositionKeyMetric>;
  positionLeftRows: PositionKeyDef[][];
  positionRightRows: PositionKeyDef[][];
  positionThumbRow: PositionKeyDef[];
  isReviewActive: boolean;
  currentSentenceIndex: number;
  sentences: string[];
  lastSentenceTyped: string;
  reviewType: string | null;
  currentReviewIndex: number;
  reviewWordsLength: number;
  currentReviewTarget: string | null;
  typedWord: string;
  isComposing: boolean;
  wordInputRef: RefObject<HTMLInputElement | null>;
  isSentenceReview: boolean;
  onInputChange: ChangeEventHandler<HTMLInputElement>;
  onInputKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onCompositionStart: CompositionEventHandler<HTMLInputElement>;
  onCompositionEnd: CompositionEventHandler<HTMLInputElement>;
};

export default function CommonPracticeTextPanel({
  showText,
  mode,
  isPositionMode,
  isPracticing,
  positionEnabledStages,
  setPositionEnabledStages,
  switchPositionStageImmediately,
  activeSingleStage,
  positionStageOptions,
  currentWordIndex,
  shuffledWords,
  displayFontSize,
  showPositionKeyboard,
  hoveredPositionKeyId,
  setHoveredPositionKeyId,
  hoveredTransitionKeyIds,
  positionPerKeyMap,
  positionLeftRows,
  positionRightRows,
  positionThumbRow,
  isReviewActive,
  currentSentenceIndex,
  sentences,
  lastSentenceTyped,
  reviewType,
  currentReviewIndex,
  reviewWordsLength,
  currentReviewTarget,
  typedWord,
  isComposing,
  wordInputRef,
  isSentenceReview,
  onInputChange,
  onInputKeyDown,
  onCompositionStart,
  onCompositionEnd,
}: Props) {
  if (!showText || mode === "sequential" || mode === "longtext" || mode === "random") return null;

  return (
    <div className="min-h-[200px] p-4 border rounded bg-gray-50">
      {isPositionMode && (
        <PositionPracticePanel
          isPracticing={isPracticing}
          positionEnabledStages={positionEnabledStages}
          setPositionEnabledStages={setPositionEnabledStages}
          switchPositionStageImmediately={switchPositionStageImmediately}
          activeSingleStage={activeSingleStage}
          positionStageOptions={positionStageOptions}
          currentWordIndex={currentWordIndex}
          shuffledWords={shuffledWords}
          displayFontSize={displayFontSize}
          showPositionKeyboard={showPositionKeyboard}
          hoveredPositionKeyId={hoveredPositionKeyId}
          setHoveredPositionKeyId={setHoveredPositionKeyId}
          hoveredTransitionKeyIds={hoveredTransitionKeyIds}
          positionPerKeyMap={positionPerKeyMap}
          positionLeftRows={positionLeftRows}
          positionRightRows={positionRightRows}
          positionThumbRow={positionThumbRow}
        />
      )}

      <WordSentenceDisplayPanel
        mode={mode}
        isReviewActive={isReviewActive}
        currentWordIndex={currentWordIndex}
        shuffledWords={shuffledWords}
        displayFontSize={displayFontSize}
        currentSentenceIndex={currentSentenceIndex}
        sentences={sentences}
        lastSentenceTyped={lastSentenceTyped}
        reviewType={reviewType}
        currentReviewIndex={currentReviewIndex}
        reviewWordsLength={reviewWordsLength}
        currentReviewTarget={currentReviewTarget}
        typedWord={typedWord}
        isComposing={isComposing}
      />

      {mode === "sentences" && (
        <SentenceInputPanel
          wordInputRef={wordInputRef}
          currentSentenceIndex={currentSentenceIndex}
          isSentenceReview={isSentenceReview}
          displayFontSize={displayFontSize}
          sentences={sentences}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
        />
      )}
    </div>
  );
}
