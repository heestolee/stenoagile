import type { ChangeEventHandler, ComponentProps, CompositionEventHandler, KeyboardEventHandler, RefObject } from "react";
import type { PositionStage } from "../../position/types";
import WordPositionInputStatus from "./WordPositionInputStatus";
import WordProficiencyPanel from "./WordProficiencyPanel";
import PositionProficiencyPanel from "../../position/components/PositionProficiencyPanel";

type WordStatusProps = ComponentProps<typeof WordPositionInputStatus>;
type WordProficiencyProps = ComponentProps<typeof WordProficiencyPanel>;
type PositionProficiencyProps = ComponentProps<typeof PositionProficiencyPanel>;

type Props = {
  mode: string;
  currentWordIndex: number;
  isReviewActive: boolean;
  currentReviewIndex: number;
  wordInputRef: RefObject<HTMLInputElement | null>;
  onInputChange: ChangeEventHandler<HTMLInputElement>;
  onInputKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onCompositionStart: CompositionEventHandler<HTMLInputElement>;
  onCompositionEnd: CompositionEventHandler<HTMLInputElement>;
  correctCount: number;
  halfCorrectCount: number;
  incorrectCount: number;
  progressCount: number;
  totalCount: number;
  isPositionMode: boolean;
  isPracticing: boolean;
  positionEnabledStages: PositionStage[];
  positionStageSummary: string;
  activeSingleStage: PositionStage | null;
  reviewType: string | null;
  reviewWordsLength: number;
  showProficiencyPanel: boolean;
  onToggleProficiency: () => void;
  todayProficiencies: WordProficiencyProps["todayProficiencies"];
  overallProficiencies: WordProficiencyProps["overallProficiencies"];
  onRefreshToday: () => void;
  onRefreshOverall: () => void;
  onClearTodayWord: () => void;
  onClearOverallWord: () => void;
  onMergeToOverallWord: () => void;
  onCloseWordProficiency: () => void;
  hoveredPositionKeyId: string | null;
  stagePositionMetrics: PositionProficiencyProps["stagePositionMetrics"];
  positionMetrics: PositionProficiencyProps["positionMetrics"];
  overallStagePositionMetrics: PositionProficiencyProps["overallStagePositionMetrics"];
  overallPositionMetrics: PositionProficiencyProps["overallPositionMetrics"];
  overallPositionSampleCount: number;
  activeStageExcludedChars: string[];
  onClearTodayPosition: () => void;
  onIncludeInOverallPosition: () => void;
  onClearOverallPosition: () => void;
  onRemoveExcludedChar: (stage: PositionStage, char: string) => void;
};

export default function WordPositionModePanel({
  mode,
  currentWordIndex,
  isReviewActive,
  currentReviewIndex,
  wordInputRef,
  onInputChange,
  onInputKeyDown,
  onCompositionStart,
  onCompositionEnd,
  correctCount,
  halfCorrectCount,
  incorrectCount,
  progressCount,
  totalCount,
  isPositionMode,
  isPracticing,
  positionEnabledStages,
  positionStageSummary,
  activeSingleStage,
  reviewType,
  reviewWordsLength,
  showProficiencyPanel,
  onToggleProficiency,
  todayProficiencies,
  overallProficiencies,
  onRefreshToday,
  onRefreshOverall,
  onClearTodayWord,
  onClearOverallWord,
  onMergeToOverallWord,
  onCloseWordProficiency,
  hoveredPositionKeyId,
  stagePositionMetrics,
  positionMetrics,
  overallStagePositionMetrics,
  overallPositionMetrics,
  overallPositionSampleCount,
  activeStageExcludedChars,
  onClearTodayPosition,
  onIncludeInOverallPosition,
  onClearOverallPosition,
  onRemoveExcludedChar,
}: Props) {
  return (
    <>
      <WordPositionInputStatus
        mode={mode}
        inputRef={wordInputRef}
        inputKey={`${currentWordIndex}-${isReviewActive ? `r${currentReviewIndex}` : ""}`}
        onChange={onInputChange}
        onKeyDown={onInputKeyDown}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        correctCount={correctCount}
        halfCorrectCount={halfCorrectCount}
        incorrectCount={incorrectCount}
        progressCount={progressCount}
        totalCount={totalCount}
        isPositionMode={isPositionMode}
        isPracticing={isPracticing}
        positionEnabledStages={positionEnabledStages}
        positionStageSummary={positionStageSummary}
        activeSingleStage={activeSingleStage}
        isReviewActive={isReviewActive}
        reviewType={reviewType as WordStatusProps["reviewType"]}
        currentReviewIndex={currentReviewIndex}
        reviewWordsLength={reviewWordsLength}
        showProficiencyPanel={showProficiencyPanel}
        onToggleProficiency={onToggleProficiency}
      />

      {showProficiencyPanel && mode === "words" && (
        <WordProficiencyPanel
          todayProficiencies={todayProficiencies}
          overallProficiencies={overallProficiencies}
          onRefreshToday={onRefreshToday}
          onRefreshOverall={onRefreshOverall}
          onClearToday={onClearTodayWord}
          onClearOverall={onClearOverallWord}
          onMergeToOverall={onMergeToOverallWord}
          onClose={onCloseWordProficiency}
        />
      )}

      {isPositionMode && (
        <PositionProficiencyPanel
          hoveredPositionKeyId={hoveredPositionKeyId}
          stagePositionMetrics={stagePositionMetrics}
          positionMetrics={positionMetrics}
          overallStagePositionMetrics={overallStagePositionMetrics}
          overallPositionMetrics={overallPositionMetrics}
          overallPositionSampleCount={overallPositionSampleCount}
          activeSingleStage={activeSingleStage}
          activeStageExcludedChars={activeStageExcludedChars}
          onClearToday={onClearTodayPosition}
          onIncludeInOverall={onIncludeInOverallPosition}
          onClearOverall={onClearOverallPosition}
          onRemoveExcludedChar={onRemoveExcludedChar}
        />
      )}
    </>
  );
}

