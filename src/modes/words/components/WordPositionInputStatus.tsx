import type { ChangeEvent, CompositionEvent, KeyboardEvent, RefObject } from "react";
import type { PositionStage } from "../../position/types";

type Props = {
  mode: string;
  inputRef: RefObject<HTMLInputElement | null>;
  inputKey: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onCompositionStart: (e: CompositionEvent<HTMLInputElement>) => void;
  onCompositionEnd: (e: CompositionEvent<HTMLInputElement>) => void;
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
  isReviewActive: boolean;
  reviewType: string | null;
  currentReviewIndex: number;
  reviewWordsLength: number;
  showProficiencyPanel: boolean;
  onToggleProficiency: () => void;
};

export default function WordPositionInputStatus({
  mode,
  inputRef,
  inputKey,
  onChange,
  onKeyDown,
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
  isReviewActive,
  reviewType,
  currentReviewIndex,
  reviewWordsLength,
  showProficiencyPanel,
  onToggleProficiency,
}: Props) {
  return (
    <>
      <input
        ref={inputRef}
        key={inputKey}
        autoFocus
        autoComplete="off"
        type="text"
        className="w-full p-2 border rounded"
        onChange={onChange}
        onKeyDown={onKeyDown}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {mode === "words" ? (
            <>
              <span className="text-blue-600">완숙: {correctCount}</span> |{" "}
              <span className="text-amber-500">반숙: {halfCorrectCount}</span> |{" "}
              <span className="text-rose-600">미숙: {incorrectCount}</span> |
            </>
          ) : (
            <>
              <span className="text-blue-600">정답: {correctCount}</span> |{" "}
              <span className="text-rose-600">오답: {incorrectCount}</span> |
            </>
          )}
          진행: {totalCount > 0 ? `${progressCount} / ${totalCount}` : progressCount}
          {isPositionMode && isPracticing && (
            <> | <span className="text-emerald-600 font-semibold">{positionEnabledStages.length === 1 ? positionStageSummary : `${positionEnabledStages.length}단계 혼합`}</span></>
          )}
          {isReviewActive && mode === "words" && (
            <> | <span className={`font-bold ${reviewType === "failed" ? "text-amber-700" : "text-orange-600"}`}>{reviewType === "failed" ? "2차복습" : "1차복습"}: {currentReviewIndex + 1}/{reviewWordsLength}</span></>
          )}
        </p>
        {isPositionMode && isPracticing && activeSingleStage && (
          <span className="text-[11px] text-gray-400">스페이스: 현재 글자 제외/해제</span>
        )}
      </div>

      {mode === "words" && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={onToggleProficiency}
            className={`text-xs px-3 py-1 rounded border ${showProficiencyPanel ? "bg-blue-500 text-white border-blue-500" : "bg-white border-gray-300 hover:bg-gray-100"}`}
          >
            숙련도
          </button>
        </div>
      )}
    </>
  );
}
