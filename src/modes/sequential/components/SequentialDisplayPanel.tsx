import type { Dispatch, RefObject, SetStateAction } from "react";
import type { MarkedChar } from "../../common/utils/scoringAnalysis";

type Props = {
  displayAreaRef: RefObject<HTMLDivElement | null>;
  countdown: number | null;
  practiceSlot: number | null;
  slotNames: { [key: number]: string };
  slotCompletedRoundsNormal: Record<number, number>;
  slotCompletedRoundsBatch: Record<number, number>;
  isRoundComplete: boolean;
  markedOriginalText: MarkedChar[];
  hoveredOrigIdx: number | null;
  setHoveredOrigIdx: Dispatch<SetStateAction<number | null>>;
  displayFontSize: number;
  displayedText: string;
  showResumeHighlight: boolean;
  resumePosition: number;
  isBatchMode: boolean;
  batchRandomFillCount: number;
};

export default function SequentialDisplayPanel({
  displayAreaRef,
  countdown,
  practiceSlot,
  slotNames,
  slotCompletedRoundsNormal,
  slotCompletedRoundsBatch,
  isRoundComplete,
  markedOriginalText,
  hoveredOrigIdx,
  setHoveredOrigIdx,
  displayFontSize,
  displayedText,
  showResumeHighlight,
  resumePosition,
  isBatchMode,
  batchRandomFillCount,
}: Props) {
  return (
    <div
      ref={displayAreaRef}
      className={`flex-1 p-4 border-2 border-blue-500 rounded bg-blue-50 relative ${countdown !== null ? "flex flex-col items-center justify-center overflow-hidden" : "overflow-y-auto"}`}
    >
      {countdown !== null ? (
        <>
          {practiceSlot !== null && (
            <p className="text-2xl font-bold text-gray-700 mb-4">{slotNames[practiceSlot] || `슬롯 ${practiceSlot}`}</p>
          )}
          <p className="text-8xl font-bold text-blue-600 animate-pulse">{countdown}</p>
          <div className="mt-6 flex flex-col items-center gap-2 max-w-3xl">
            <div className="text-xs text-gray-500">
              <span className="text-green-700 font-bold">보고</span>
              <span className="text-gray-400 mx-0.5">/</span>
              <span className="text-orange-600 font-bold">매매</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {(() => {
                const normalRounds = { ...slotCompletedRoundsNormal };
                const batchRounds = { ...slotCompletedRoundsBatch };
                const allSlots = new Set([...Object.keys(normalRounds), ...Object.keys(batchRounds)].map(Number));
                return Array.from(allSlots)
                  .sort((a, b) => a - b)
                  .filter((slot) => (normalRounds[slot] || 0) > 0 || (batchRounds[slot] || 0) > 0)
                  .map((slot) => (
                    <div
                      key={slot}
                      className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shadow-sm ${
                        slot === practiceSlot
                          ? "bg-yellow-300 border-2 border-yellow-500 text-yellow-900 font-bold"
                          : "bg-white border-2 border-gray-400 text-gray-700 font-medium"
                      }`}
                    >
                      <span>{slotNames[slot] || `슬롯 ${slot}`}</span>
                      <span className="mx-1.5 text-gray-400">|</span>
                      <span className="text-green-700 font-bold">{normalRounds[slot] || 0}</span>
                      <span className="text-gray-500">/</span>
                      <span className="text-orange-600 font-bold">{batchRounds[slot] || 0}</span>
                    </div>
                  ));
              })()}
            </div>
          </div>
        </>
      ) : (
        <>
          {isRoundComplete && markedOriginalText.length > 0 ? (
            <div className="font-semibold whitespace-pre-wrap w-full" style={{ fontSize: `${displayFontSize}px`, lineHeight: 1.5 }}>
              {markedOriginalText.map((m, idx) => (
                <span
                  key={idx}
                  className={`cursor-pointer ${
                    m.state === "deletion" ? "text-red-600" : m.state === "substitution" ? "text-blue-600" : "text-black"
                  } ${hoveredOrigIdx === idx ? "bg-yellow-300 rounded px-0.5" : ""}`}
                  onMouseEnter={() => setHoveredOrigIdx(idx)}
                  onMouseLeave={() => setHoveredOrigIdx(null)}
                >
                  {m.char}
                  {m.state === "substitution" && m.wrongChar && <span className="text-blue-400">({m.wrongChar})</span>}
                </span>
              ))}
            </div>
          ) : (
            <div className="font-semibold whitespace-pre-wrap w-full" style={{ fontSize: `${displayFontSize}px`, lineHeight: 1.5 }}>
              {(() => {
                const text = displayedText;

                if (showResumeHighlight) {
                  const textChars = [...text];
                  let nonSpaceCount = 0;
                  return textChars.map((char, idx) => {
                    const isSpace = /\s/.test(char);
                    const isCurrentPos = !isSpace && nonSpaceCount === resumePosition;
                    const isTyped = !isSpace && nonSpaceCount < resumePosition;
                    if (!isSpace) nonSpaceCount++;
                    return (
                      <span key={idx} className={isCurrentPos ? "bg-yellow-300 rounded px-0.5" : isTyped ? "text-gray-400" : ""}>
                        {char}
                      </span>
                    );
                  });
                }

                if (isBatchMode && batchRandomFillCount > 0 && text.length > 0) {
                  const originalCount = text.length - batchRandomFillCount;
                  return [...text].map((char, idx) => (
                    <span key={idx} className={idx >= originalCount ? "text-purple-400" : ""}>
                      {char}
                    </span>
                  ));
                }

                return text;
              })()}
            </div>
          )}
          {isRoundComplete && <div className="absolute inset-0 bg-gray-500 bg-opacity-30 pointer-events-none" />}
        </>
      )}
    </div>
  );
}

