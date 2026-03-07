import type {
  ChangeEvent,
  CompositionEvent,
  CSSProperties,
  KeyboardEvent,
  RefObject,
} from "react";
import type { ScoringResult } from "../../common/utils/scoringAnalysis";

type SequentialMarkedChar = {
  state: "correct" | "deletion" | "insertion" | "substitution";
  char: string;
  origIdx?: number;
  expectedChar?: string;
};

type Props = {
  isRoundComplete: boolean;
  scoringResult: ScoringResult | null;
  markedText: SequentialMarkedChar[];
  hoveredOrigIdx: number | null;
  setHoveredOrigIdx: (idx: number | null) => void;
  inputFontSize: number;
  typingTextareaRef: RefObject<HTMLTextAreaElement | null>;
  handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  showResumeHighlight: boolean;
  setShowResumeHighlight: (v: boolean) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleCompositionStart: () => void;
  handleCompositionEnd: (e: CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

export default function SequentialTypingArea({
  isRoundComplete,
  scoringResult,
  markedText,
  hoveredOrigIdx,
  setHoveredOrigIdx,
  inputFontSize,
  typingTextareaRef,
  handleInputChange,
  showResumeHighlight,
  setShowResumeHighlight,
  handleKeyDown,
  handleCompositionStart,
  handleCompositionEnd,
}: Props) {
  return (
    <div className="flex-1 border-2 border-green-500 rounded bg-green-50 p-4 flex flex-col">
      {isRoundComplete && scoringResult && (
        <div className="mb-2 p-2 bg-white rounded border text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>전체: <span className="font-bold">{scoringResult.totalChars}</span></span>
            <span><span className="text-red-600 font-bold">■</span> 탈자: <span className="font-bold text-red-600">{scoringResult.deletions}</span></span>
            <span><span className="text-green-600 font-bold">■</span> 첨자: <span className="font-bold text-green-600">{scoringResult.insertions}</span></span>
            <span><span className="text-blue-600 font-bold">■</span> 오자: <span className="font-bold text-blue-600">{scoringResult.substitutions}</span></span>
            <span>정확도: <span className="font-bold text-purple-600">{scoringResult.accuracy}%</span></span>
          </div>
        </div>
      )}
      <div className="flex-1">
        {isRoundComplete && markedText.length > 0 ? (
          <div
            className="w-full h-full p-4 border-2 border-gray-300 rounded overflow-auto whitespace-pre-wrap break-all bg-white"
            style={{ fontSize: `${inputFontSize}px`, lineHeight: 1.5 }}
          >
            {markedText.map((m, idx) => (
              <span
                key={idx}
                className={`cursor-pointer ${
                  m.state === "deletion"
                    ? "text-red-600"
                    : m.state === "insertion"
                      ? "text-green-600"
                      : m.state === "substitution"
                        ? "text-blue-600"
                        : "text-black"
                } ${hoveredOrigIdx !== null && m.origIdx === hoveredOrigIdx ? "bg-yellow-300 rounded px-0.5" : ""}`}
                onMouseEnter={() => {
                  if (m.origIdx !== undefined) {
                    setHoveredOrigIdx(m.origIdx);
                  }
                }}
                onMouseLeave={() => setHoveredOrigIdx(null)}
              >
                {m.char}
                {m.state === "substitution" && m.expectedChar && (
                  <span className="text-blue-400">({m.expectedChar})</span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <textarea
            ref={typingTextareaRef}
            className="w-full h-full p-4 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            style={{
              fontSize: `${inputFontSize}px`,
              lineHeight: 1.5,
              imeMode: "active",
            } as CSSProperties}
            placeholder="여기에 타이핑하세요"
            onChange={(e) => {
              handleInputChange(e);
              if (showResumeHighlight) setShowResumeHighlight(false);
            }}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            lang="ko"
          />
        )}
      </div>
    </div>
  );
}

