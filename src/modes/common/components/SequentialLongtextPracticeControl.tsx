import { useState } from "react";

type ModelOption = {
  id: string;
  label: string;
  estimatedSentences: string;
};

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
  // 긴글모드 랜덤 생성 props
  isGeneratingLongText: boolean;
  generatingKeyword: string;
  generatedLongText: string;
  longtextModelName: string;
  longtextGenerateError: string | null;
  onGenerateLongText: () => void;
  onClearLongtextError: () => void;
  // 모델 선택 + 호출횟수
  selectedModel: string;
  onSelectModel: (model: string) => void;
  modelOptions: readonly ModelOption[];
  apiCallCount: number;
  apiCallModels: Record<string, number>;
  // 문체 + 원문/랜덤 선택
  longtextStyle: string;
  onSetLongtextStyle: (style: string) => void;
  longtextUseRandom: boolean;
  onSetLongtextUseRandom: (v: boolean) => void;
  sentenceStyles: readonly string[];
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
  isGeneratingLongText,
  generatingKeyword,
  generatedLongText,
  longtextModelName,
  longtextGenerateError,
  onGenerateLongText,
  onClearLongtextError,
  selectedModel,
  onSelectModel,
  modelOptions,
  apiCallCount,
  apiCallModels,
  longtextStyle,
  onSetLongtextStyle,
  longtextUseRandom,
  onSetLongtextUseRandom,
  sentenceStyles,
}: Props) {
  const [showApiDetail, setShowApiDetail] = useState(false);

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

        {/* 긴글모드 랜덤 생성 버튼 */}
        {mode === "longtext" && (
          <button
            className={`px-4 py-2 rounded font-semibold transition text-sm ${
              isGeneratingLongText
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
            }`}
            onClick={onGenerateLongText}
          >
            {isGeneratingLongText ? `생성 중단` : "랜덤 생성"}
          </button>
        )}

        {/* 긴글모드 생성 상태 표시 */}
        {mode === "longtext" && isGeneratingLongText && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="animate-pulse">생성 중...</span>
            <span className="text-emerald-600 font-semibold">{generatingKeyword}</span>
            <span className="text-gray-400">({generatedLongText.length}자)</span>
          </div>
        )}

        {/* 긴글모드 모델명 표시 */}
        {mode === "longtext" && longtextModelName && !isGeneratingLongText && (
          <span className="text-xs text-gray-400">[{longtextModelName}]</span>
        )}

        {/* 긴글모드 호출횟수 (팝오버) */}
        {mode === "longtext" && (
          <div className="relative">
            <button
              className="text-xs text-gray-400 hover:text-gray-600 transition"
              onClick={() => setShowApiDetail((prev) => !prev)}
            >
              API 호출 {apiCallCount}회 {showApiDetail ? "▲" : "▼"}
            </button>
            {showApiDetail && (
              <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs text-gray-500 whitespace-nowrap">
                <p className="text-gray-400 mb-1">매일 17:00 리셋</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(apiCallModels).sort(([a], [b]) => {
                    const order = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-preview-09-2025", "gemini-2.5-flash-lite", "gemini-2.5-flash-lite-preview-09-2025", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
                    return order.indexOf(a) - order.indexOf(b);
                  }).map(([model, count]) => (
                    <span key={model} className="px-2 py-0.5 bg-gray-100 rounded-full">
                      {model.replace("gemini-", "").replace("-preview", "")}: {count}회
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 긴글모드 에러 표시 */}
      {mode === "longtext" && longtextGenerateError && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-red-500">{longtextGenerateError}</span>
          <button
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={onClearLongtextError}
          >
            닫기
          </button>
        </div>
      )}

      {/* 긴글모드 원문/랜덤 + 문체 + 모델 선택 */}
      {mode === "longtext" && !isPracticing && !isGeneratingLongText && (
        <>
          <div className="flex gap-1.5">
            <button
              className={`px-2.5 py-1 text-xs rounded-full border transition ${
                !longtextUseRandom
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-500"
              }`}
              onClick={() => onSetLongtextUseRandom(false)}
            >
              원문 단어
            </button>
            <button
              className={`px-2.5 py-1 text-xs rounded-full border transition ${
                longtextUseRandom
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-500"
              }`}
              onClick={() => onSetLongtextUseRandom(true)}
            >
              랜덤 키워드
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sentenceStyles.map((style) => (
              <button
                key={style}
                className={`px-2.5 py-1 text-xs rounded-full border transition ${
                  longtextStyle === style
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-500"
                }`}
                onClick={() => onSetLongtextStyle(style)}
              >
                {style}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {modelOptions.map((model) => (
              <button
                key={model.id}
                className={`px-2.5 py-1 text-xs rounded-full border transition ${
                  selectedModel === model.id
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-500"
                }`}
                onClick={() => onSelectModel(model.id)}
              >
                {model.label}
              </button>
            ))}
          </div>
        </>
      )}

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
              <span className="text-orange-600 font-semibold">시간: {elapsedTimeLabel}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
