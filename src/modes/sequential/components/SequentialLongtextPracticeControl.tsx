type Props = {
  mode: "sequential" | "longtext";
  practicingMode: string | null;
  countdown: number | null;
  onTogglePractice: () => void;
  isPracticing: boolean;
  isRoundComplete: boolean;
  isFullyComplete: boolean;
  practiceSlot: number | null;
  slotNames: Record<number, string>;
  lastResult: { kpm: number; cpm: number; elapsedTime: number };
  modeResultsLength: number;
  averageResult: { avgKpm: number; avgCpm: number };
  isBatchMode: boolean;
  slotCompletedRoundsBatch: Record<number, number>;
  slotCompletedRoundsNormal: Record<number, number>;
  progressCount: number;
  totalCount: number;
  isReviewMode: boolean;
  reviewIndex: number;
  reviewBatchesLength: number;
  batchStartIndex: number;
  batchSize: number;
  randomizedIndicesLength: number;
  currentDisplayIndex: number;
  elapsedTimeLabel: string;
};

export default function SequentialLongtextPracticeControl({
  mode,
  practicingMode,
  countdown,
  onTogglePractice,
  isPracticing,
  isRoundComplete,
  isFullyComplete,
  practiceSlot,
  slotNames,
  lastResult,
  modeResultsLength,
  averageResult,
  isBatchMode,
  slotCompletedRoundsBatch,
  slotCompletedRoundsNormal,
  progressCount,
  totalCount,
  isReviewMode,
  reviewIndex,
  reviewBatchesLength,
  batchStartIndex,
  batchSize,
  randomizedIndicesLength,
  currentDisplayIndex,
  elapsedTimeLabel,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <button
          className={`px-4 py-2 rounded font-semibold transition ${
            practicingMode === mode || countdown !== null
              ? "bg-gray-500 text-white hover:bg-gray-600"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
          onClick={onTogglePractice}
        >
          {countdown !== null ? `${countdown}초` : practicingMode === mode ? "연습 종료" : "연습 시작"}
        </button>
      </div>

      {(isPracticing || countdown !== null || isRoundComplete) && (
        <div className="flex items-center space-x-4 text-sm">
          {isRoundComplete ? (
            <>
              <span className={`font-bold ${isFullyComplete ? "text-green-600" : "text-yellow-600"}`}>
                {practiceSlot !== null ? `${slotNames[practiceSlot] || `슬롯 ${practiceSlot}`} ` : ""}
                {isFullyComplete ? "라운드 완료" : "라운드 일시정지"}
              </span>
              <span className="text-blue-600 font-semibold">타수: {lastResult.kpm}/분</span>
              <span className="text-green-600 font-semibold">자수: {lastResult.cpm}/분</span>
              <span className="text-orange-600 font-semibold">시간: {elapsedTimeLabel}</span>
              {modeResultsLength > 1 && (
                <>
                  <span className="text-gray-600">평균 타수: {averageResult.avgKpm}/분</span>
                  <span className="text-gray-600">평균 자수: {averageResult.avgCpm}/분</span>
                </>
              )}
              <span className="text-gray-500">{isFullyComplete ? "(엔터: 다음 라운드)" : "(엔터: 재개)"}</span>
              {isFullyComplete && practiceSlot !== null && (
                <span className="text-teal-600 font-semibold">
                  {slotNames[practiceSlot] || `슬롯 ${practiceSlot}`} ({isBatchMode ? "매매치라" : "보고치라"}) :{" "}
                  {((isBatchMode ? slotCompletedRoundsBatch[practiceSlot] : slotCompletedRoundsNormal[practiceSlot]) || 0) + 1}회 완료
                </span>
              )}
            </>
          ) : mode === "longtext" ? (
            <>
              <span className="text-purple-600 font-semibold">진행: {progressCount}/{totalCount}</span>
              <span className="text-blue-600 font-semibold">타수: {lastResult.kpm}/분</span>
              <span className="text-green-600 font-semibold">자수: {lastResult.cpm}/분</span>
              <span className="text-orange-600 font-semibold">시간: {elapsedTimeLabel}</span>
            </>
          ) : (
            <>
              {isBatchMode && (
                <>
                  {isReviewMode ? (
                    <span className="text-red-600 font-semibold">복습: {reviewIndex + 1}/{reviewBatchesLength}</span>
                  ) : (
                    <span className="text-purple-600 font-semibold">진행: {Math.min(batchStartIndex + batchSize, randomizedIndicesLength)}/{randomizedIndicesLength}</span>
                  )}
                  {lastResult.kpm > 0 && (
                    <>
                      <span className="text-blue-600 font-semibold">타수: {lastResult.kpm}/분</span>
                      <span className="text-green-600 font-semibold">자수: {lastResult.cpm}/분</span>
                    </>
                  )}
                </>
              )}
              {!isBatchMode && <span className="text-purple-600 font-semibold">진행: {currentDisplayIndex}/{randomizedIndicesLength}</span>}
              {!isBatchMode && lastResult.kpm > 0 && (
                <>
                  <span className="text-blue-600 font-semibold">타수: {lastResult.kpm}/분</span>
                  <span className="text-green-600 font-semibold">자수: {lastResult.cpm}/분</span>
                </>
              )}
              <span className="text-orange-600 font-semibold">시간: {elapsedTimeLabel}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
