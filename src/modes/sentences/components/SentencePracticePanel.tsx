import type { KeyboardEventHandler, RefObject } from "react";

type ResultItem = {
  kpm: number;
  cpm: number;
  elapsedTime: number;
  chars: string;
  mode?: string;
};

type Props = {
  correctCount: number;
  incorrectCount: number;
  progressLabel: string;
  showReviewBadge: boolean;
  practiceText: string;
  setPracticeText: (value: string) => void;
  practiceInputRef: RefObject<HTMLTextAreaElement | null>;
  rankFontSize: number;
  results: ResultItem[];
  onClearSentenceResults: () => void;
  onClearPracticeText: () => void;
  onPracticeTab: KeyboardEventHandler<HTMLTextAreaElement>;
};

export default function SentencePracticePanel({
  correctCount,
  incorrectCount,
  progressLabel,
  showReviewBadge,
  practiceText,
  setPracticeText,
  practiceInputRef,
  rankFontSize,
  results,
  onClearSentenceResults,
  onClearPracticeText,
  onPracticeTab,
}: Props) {
  const sorted = [...results].sort((a, b) => b.kpm - a.kpm);
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          <span className="text-blue-600">정답: {correctCount}</span> | <span className="text-rose-600">오답: {incorrectCount}</span> | 진행: {progressLabel}
          {showReviewBadge && <> | <span className="font-bold text-purple-600">복습 중</span></>}
        </p>
      </div>
      <div className="border rounded p-3 bg-gray-50 mt-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-gray-600 text-base">연습 칸</span>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{practiceText.length}자</span>
            {practiceText.length > 0 && (
              <button className="px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs" onClick={onClearPracticeText}>
                지우기
              </button>
            )}
          </div>
        </div>
        <textarea
          ref={practiceInputRef}
          className="w-full p-2 border rounded resize-none"
          rows={3}
          placeholder="Tab 키로 이동하여 자유롭게 연습..."
          value={practiceText}
          onChange={(e) => setPracticeText(e.target.value)}
          onKeyDown={onPracticeTab}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 mt-1 text-sm">
        <button
          className="ml-auto px-3 py-1 text-xs font-semibold text-red-500 bg-red-50 border border-red-300 rounded hover:bg-red-100 active:bg-red-200 transition-colors"
          onClick={onClearSentenceResults}
        >
          초기화
        </button>
        <div className="border rounded p-3 bg-blue-50">
          <div className="font-bold text-blue-600 mb-1 text-base">최고타</div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="py-0.5">
              {top5[i] ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-700 whitespace-nowrap">
                    <span className="font-semibold">{top5[i].kpm}</span>
                    <span className="text-gray-500">타</span> <span className="font-semibold">{top5[i].cpm}</span>
                    <span className="text-gray-500">자</span>
                  </span>
                  <span className="text-gray-400 break-all" style={{ fontSize: `${rankFontSize}px` }}>
                    {top5[i].chars}
                  </span>
                </div>
              ) : (
                <span className="text-gray-300">-</span>
              )}
            </div>
          ))}
        </div>
        <div className="border rounded p-3 bg-rose-50">
          <div className="font-bold text-rose-600 mb-1 text-base">최저타</div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="py-0.5">
              {bottom5[i] ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-700 whitespace-nowrap">
                    <span className="font-semibold">{bottom5[i].kpm}</span>
                    <span className="text-gray-500">타</span> <span className="font-semibold">{bottom5[i].cpm}</span>
                    <span className="text-gray-500">자</span>
                  </span>
                  <span className="text-gray-400 break-all" style={{ fontSize: `${rankFontSize}px` }}>
                    {bottom5[i].chars}
                  </span>
                </div>
              ) : (
                <span className="text-gray-300">-</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
