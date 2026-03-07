import type {
  ChangeEvent,
  CompositionEvent,
  CSSProperties,
  KeyboardEvent,
  RefObject,
} from "react";
import LongtextRankingPanel from "./LongtextRankingPanel";

type ResultItem = {
  kpm: number;
  cpm: number;
  elapsedTime: number;
  chars: string;
  mode?: string;
};

type Props = {
  displayAreaRef: RefObject<HTMLDivElement | null>;
  wordInputRef: RefObject<HTMLInputElement | null>;
  practiceInputRef: RefObject<HTMLTextAreaElement | null>;
  countdown: number | null;
  practiceSlot: number | null;
  slotNames: Record<number, string>;
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
  onInputChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onCompositionStart: () => void;
  onCompositionEnd: (event: CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  practiceText: string;
  onPracticeTextChange: (value: string) => void;
  modeResults: ResultItem[];
  rankFontSize: number;
  onResetResults: () => void;
};

export default function LongtextPracticePanel({
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
  return (
    <div className="flex flex-col gap-2">
      <div
        ref={displayAreaRef}
        className={`p-4 border rounded bg-gray-50 relative ${countdown !== null ? "flex flex-col items-center justify-center" : ""}`}
      >
        {countdown !== null ? (
          <>
            {practiceSlot !== null && (
              <p className="text-2xl font-bold text-gray-700 mb-4">
                {slotNames[practiceSlot] || `슬롯 ${practiceSlot}`}
              </p>
            )}
            <p className="text-8xl font-bold text-blue-600 animate-pulse">
              {countdown}
            </p>
          </>
        ) : (practicingMode !== "longtext" && practicingMode !== null) || !isPracticing ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center py-4 text-gray-400 text-lg">
              연습 시작을 눌러주세요
            </div>

            <input
              ref={wordInputRef}
              autoComplete="off"
              type="text"
              className="w-full p-2 border rounded"
              style={{ fontSize: `${displayFontSize}px` }}
              placeholder="Tab 키로 연습 칸으로 이동"
              disabled
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {lastSentenceTyped && sentences.length > 0 && (() => {
              const prevIdx = isRoundComplete
                ? currentSentenceIndex
                : currentSentenceIndex - 1;
              const prevSentence = prevIdx >= 0 ? sentences[prevIdx] : null;
              if (!prevSentence) return null;
              return (
                <div className="flex flex-col gap-0.5">
                  <p className="font-semibold whitespace-nowrap overflow-hidden" style={{ fontSize: `${displayFontSize}px`, lineHeight: 1.4 }}>
                    {prevSentence.split("").map((char, i) => {
                      const typedChar = lastSentenceTyped[i];
                      if (typedChar === undefined) return <span key={i}>{char}</span>;
                      if (typedChar === char) return <span key={i} style={{ color: "blue" }}>{char}</span>;
                      return <span key={i} style={{ color: "red" }}>{char}</span>;
                    })}
                  </p>
                  <p className="whitespace-nowrap overflow-hidden text-gray-500" style={{ fontSize: `${displayFontSize}px`, lineHeight: 1.4 }}>
                    {lastSentenceTyped}
                  </p>
                </div>
              );
            })()}

            {isRoundComplete && (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-xl font-bold text-green-600">라운드 완료!</p>
                <p className="text-gray-600 text-sm">
                  정답: {correctCount} | 오답: {incorrectCount} | 전체: {totalCount}문장
                </p>
                <button
                  className="px-6 py-2 bg-blue-500 text-white rounded font-semibold hover:bg-blue-600"
                  onClick={onStartNextRound}
                >
                  다시하기
                </button>
              </div>
            )}

            {!isRoundComplete && (
              <p className="font-bold whitespace-nowrap overflow-hidden" style={{ fontSize: `${displayFontSize}px`, lineHeight: 1.4 }}>
                {(() => {
                  const target = sentences[currentSentenceIndex] || "";
                  const confirmedLen = isComposing && typedWord.length > 0
                    ? typedWord.length - 1
                    : typedWord.length;
                  return target.split("").map((char, i) => {
                    let style: CSSProperties = {};
                    let displayChar = char;
                    if (i < confirmedLen) {
                      if (typedWord[i] === char) {
                        style = { color: "blue" };
                      } else if (char === " ") {
                        displayChar = "\u2228";
                        style = { color: "red", fontSize: "0.8em" };
                      } else {
                        style = { color: "red", textDecoration: "underline" };
                      }
                    } else if (i === confirmedLen && isComposing) {
                      style = { color: "#9CA3AF" };
                    }
                    return <span key={i} style={style}>{displayChar}</span>;
                  });
                })()}
              </p>
            )}

            <input
              ref={wordInputRef}
              key={`longtext-${currentSentenceIndex}`}
              autoFocus
              autoComplete="off"
              type="text"
              className="w-full p-2 border rounded"
              style={{ fontSize: `${displayFontSize}px` }}
              placeholder="Tab 키로 연습 칸으로 이동"
              onChange={onInputChange}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  practiceInputRef.current?.focus();
                  return;
                }
                onInputKeyDown(e);
              }}
              onCompositionStart={() => onCompositionStart()}
              onCompositionEnd={onCompositionEnd}
            />

            {!isRoundComplete && (
              <div className="flex flex-col gap-0.5">
                {[1, 2, 3, 4].map((offset) => {
                  const idx = currentSentenceIndex + offset;
                  return (
                    <span key={offset} className="text-gray-400 whitespace-nowrap overflow-hidden" style={{ fontSize: `${Math.round(displayFontSize * 0.85)}px`, lineHeight: 1.4 }}>
                      {idx < sentences.length && sentences[idx] ? sentences[idx] : "\u00A0"}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border rounded p-3 bg-gray-50">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-gray-600 text-base">연습 칸</span>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{practiceText.length}자</span>
            {practiceText.length > 0 && (
              <button
                className="px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs"
                onClick={() => {
                  onPracticeTextChange("");
                  if (practiceInputRef.current) practiceInputRef.current.value = "";
                }}
              >
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
          onChange={(e) => onPracticeTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              onPracticeTextChange("");
              wordInputRef.current?.focus();
            }
          }}
        />
      </div>

      <LongtextRankingPanel
        results={modeResults}
        rankFontSize={rankFontSize}
        onReset={onResetResults}
      />
    </div>
  );
}
