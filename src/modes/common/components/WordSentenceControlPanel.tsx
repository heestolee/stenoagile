import { useState } from "react";
import type { Mode } from "../types";

type ModelOption = {
  id: string;
  label: string;
  estimatedSentences?: string;
};

type WordSentenceControlPanelProps = {
  mode: Mode;
  practicingMode: string | null;
  isGenerating: boolean;
  generatedCount: number;
  isPracticing: boolean;
  todayCompletedRounds: number;
  generateError: string | null;
  generateErrorMessage: string;
  showRawGenerateError: boolean;
  aiModelName: string;
  canGenerateMore: boolean;
  selectedModel: string;
  modelOptions: readonly ModelOption[];
  sentenceStyles: readonly string[];
  sentenceStyle: string;
  useRandomSentences: boolean;
  inputText: string;
  sentences: string[];
  sentenceTargetCount: number;
  apiCallCount: number;
  apiCallModels: Record<string, number>;
  onStartOrStop: () => void;
  onResetSentences: () => void;
  onSelectModel: (modelId: string) => void;
  onGenerateMore: (words: string[], targetCount: number, alreadyGenerated: number, existingSentences: string[]) => void;
  onSetUseRandomSentences: (v: boolean) => void;
  onSetSentenceStyle: (style: string) => void;
};

export default function WordSentenceControlPanel({
  mode,
  practicingMode,
  isGenerating,
  generatedCount,
  isPracticing,
  todayCompletedRounds,
  generateError,
  generateErrorMessage,
  showRawGenerateError,
  aiModelName,
  canGenerateMore,
  selectedModel,
  modelOptions,
  sentenceStyles,
  sentenceStyle,
  useRandomSentences,
  inputText,
  sentences,
  sentenceTargetCount,
  apiCallCount,
  apiCallModels,
  onStartOrStop,
  onResetSentences,
  onSelectModel,
  onGenerateMore,
  onSetUseRandomSentences,
  onSetSentenceStyle,
}: WordSentenceControlPanelProps) {
  const [showApiDetail, setShowApiDetail] = useState(false);

  if (mode === "sequential" || mode === "longtext" || mode === "random") return null;

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          className={`px-4 py-2 rounded font-semibold transition ${
            practicingMode === mode || (mode === "sentences" && isGenerating)
              ? "bg-gray-500 text-white hover:bg-gray-600"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
          onClick={onStartOrStop}
        >
          {mode === "sentences"
            ? (isGenerating
                ? `문장 생성 중... (${generatedCount})`
                : practicingMode === "sentences" && generatedCount > 0
                  ? "문장 생성 완료"
                  : "문장 생성 시작")
            : (practicingMode === mode ? "연습 종료" : "연습 시작")}
        </button>
        {mode === "sentences" && (
          <button className="px-3 py-2 rounded font-semibold text-sm bg-orange-400 text-white hover:bg-orange-500 transition" onClick={onResetSentences}>
            초기화
          </button>
        )}
        {mode === "sentences" && generateError && (
          <div className="flex flex-col">
            <span className="text-sm text-red-500 font-medium">{generateErrorMessage}</span>
            {showRawGenerateError && <span className="text-xs text-gray-400">{generateError}</span>}
          </div>
        )}

        {/* API 호출횟수 팝오버 */}
        {mode === "sentences" && (
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

      {mode === "sentences" && (isGenerating || (isPracticing && generatedCount > 0)) && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">{aiModelName ? `[${aiModelName}]` : ""}</span>
          {canGenerateMore && !isGenerating && (
            <div className="flex items-center gap-1 border border-blue-400 rounded-full px-1 py-0.5 bg-blue-50 shadow-sm">
              {modelOptions.map((model) => (
                <button
                  key={model.id}
                  className={`text-xs px-1.5 py-0.5 rounded-full transition ${
                    selectedModel === model.id ? "bg-emerald-500 text-white" : "text-gray-500 hover:text-emerald-500"
                  }`}
                  onClick={() => onSelectModel(model.id)}
                >
                  {model.label}
                </button>
              ))}
              <button
                className="text-xs px-2 py-0.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 font-medium ml-0.5"
                onClick={() => {
                  const words = useRandomSentences ? [] : inputText.trim().split("/").filter(Boolean);
                  onGenerateMore(words, sentenceTargetCount, generatedCount, sentences);
                }}
              >
                추가생성
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "sentences" && !isPracticing && !isGenerating && (
        <>
          <div className="flex gap-1.5 mt-2">
            <button
              className={`px-2.5 py-1 text-xs rounded-full border transition ${
                !useRandomSentences
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-500"
              }`}
              onClick={() => onSetUseRandomSentences(false)}
            >
              원문 단어
            </button>
            <button
              className={`px-2.5 py-1 text-xs rounded-full border transition ${
                useRandomSentences
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-500"
              }`}
              onClick={() => onSetUseRandomSentences(true)}
            >
              랜덤 문장
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {sentenceStyles.map((style) => (
              <button
                key={style}
                className={`px-2.5 py-1 text-xs rounded-full border transition ${
                  sentenceStyle === style
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-500"
                }`}
                onClick={() => onSetSentenceStyle(style)}
              >
                {style}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
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
    </div>
  );
}
