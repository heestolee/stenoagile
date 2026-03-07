import type { RefObject } from "react";
import type { Mode } from "../types";

type WordSentencePracticeStatusProps = {
  mode: Mode;
  isPracticing: boolean;
  isSentenceReview: boolean;
  progressCount: number;
  totalCount: number;
  lastResult: { kpm: number; cpm: number };
  modeResultsLength: number;
  averageResult: { avgKpm: number; avgCpm: number };
  elapsedTimerRef: RefObject<HTMLSpanElement | null>;
  preReviewProgress: number;
  preReviewTotal: number;
  displayElapsedTimeLabel: string;
};

export default function WordSentencePracticeStatus({
  mode,
  isPracticing,
  isSentenceReview,
  progressCount,
  totalCount,
  lastResult,
  modeResultsLength,
  averageResult,
  elapsedTimerRef,
  preReviewProgress,
  preReviewTotal,
  displayElapsedTimeLabel,
}: WordSentencePracticeStatusProps) {
  if (mode === "sequential" || mode === "longtext" || mode === "random" || !isPracticing) {
    return null;
  }

  return (
    <div className={`flex items-center px-3 py-1.5 rounded ${mode === "sentences" && isSentenceReview ? "bg-red-50 border border-red-300" : ""}`}>
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-4 text-sm font-medium">
          {mode === "sentences" && isSentenceReview && (
            <span className="text-red-600">복습: {preReviewProgress}/{preReviewTotal}({progressCount}/{totalCount})</span>
          )}
          {mode === "sentences" && !isSentenceReview && <span className="text-purple-600">진행: {progressCount}/{totalCount}</span>}
          {mode !== "words" && <span className="text-green-600">타수: {lastResult.kpm}/분</span>}
          {mode !== "words" && <span className="text-purple-600">자수: {lastResult.cpm}/분</span>}
          <span ref={elapsedTimerRef} className="text-orange-600">{displayElapsedTimeLabel}</span>
        </div>
        {mode !== "words" && modeResultsLength > 0 && modeResultsLength % 50 === 0 && (
          <div className="flex items-center space-x-4 text-xs text-gray-600">
            <span>평균 타수: {averageResult.avgKpm}/분</span>
            <span>평균 자수: {averageResult.avgCpm}/분</span>
          </div>
        )}
      </div>
    </div>
  );
}
