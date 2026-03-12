
type Props = {
  mode: string;
  isReviewActive: boolean;
  currentWordIndex: number;
  shuffledWords: string[];
  displayFontSize: number;
  currentSentenceIndex: number;
  sentences: string[];
  lastSentenceTyped: string;
  reviewType: string | null;
  currentReviewIndex: number;
  reviewWordsLength: number;
  currentReviewTarget: string | null;
  typedWord: string;
  isComposing: boolean;
};

export default function WordSentenceDisplayPanel({
  mode,
  isReviewActive,
  currentWordIndex,
  shuffledWords,
  displayFontSize,
  currentSentenceIndex,
  sentences,
  lastSentenceTyped,
  reviewType,
  currentReviewIndex,
  reviewWordsLength,
  currentReviewTarget,
  typedWord,
  isComposing,
}: Props) {
  const previousSentence = mode === "sentences" && currentSentenceIndex > 0
    ? (sentences[currentSentenceIndex - 1] ?? "")
    : "";

  return (
    <>
      {mode === "words" && !isReviewActive && (
        <div className="flex flex-col items-start gap-1 mb-2">
          {[-2, -1].map((offset) => {
            const idx = currentWordIndex + offset;
            return idx >= 0 && shuffledWords[idx] ? (
              <span key={offset} className="text-gray-400" style={{ fontSize: `${Math.round(displayFontSize * 0.85)}px` }}>
                {shuffledWords[idx]}
              </span>
            ) : null;
          })}
        </div>
      )}

      {mode === "sentences" && previousSentence && (
        <div className="flex flex-col items-start gap-1 mb-3">
          <p className="font-bold whitespace-pre-wrap" style={{ fontSize: `${displayFontSize}px` }}>
            {previousSentence.split("").map((char, i) => {
              const typedChar = lastSentenceTyped[i];
              if (typedChar === undefined) return <span key={i}>{char}</span>;
              if (typedChar !== char) return (
                <span key={i} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", color: "red", verticalAlign: "bottom", whiteSpace: "pre" }}>
                  <span style={{ fontSize: "0.65em", lineHeight: 1.1, WebkitTextStroke: "0.5px red", color: "transparent" }}>ᵛ</span>
                  <span>{char}</span>
                </span>
              );
              return <span key={i}>{char}</span>;
            })}
          </p>
          {lastSentenceTyped && (
            <p className="whitespace-pre-wrap text-gray-500" style={{ fontSize: `${displayFontSize}px` }}>
              {lastSentenceTyped}
            </p>
          )}
        </div>
      )}

      {isReviewActive && mode === "words" && (
        <div className="mb-2 text-sm font-bold text-orange-600">
          {reviewType === "failed" ? "2차복습" : "1차복습"} {currentReviewIndex + 1}/{reviewWordsLength}
        </div>
      )}

      <p className="font-semibold whitespace-pre-wrap" style={{ fontSize: `${displayFontSize}px` }}>
        {mode === "words"
          ? (isReviewActive && currentReviewTarget ? currentReviewTarget : shuffledWords[currentWordIndex])
          : mode === "sentences"
            ? (() => {
                const target = sentences[currentSentenceIndex] || "";
                const confirmedLen = isComposing && typedWord.length > 0 ? typedWord.length - 1 : typedWord.length;
                return target.split("").map((char, i) => {
                  if (i < confirmedLen) {
                    if (typedWord[i] === char) {
                      return <span key={i} style={{ color: "blue" }}>{char}</span>;
                    }
                    return (
                      <span key={i} style={{ position: "relative", display: "inline-block", color: "red", whiteSpace: "pre" }}>
                        <span style={{ position: "absolute", top: "-0.8em", left: "50%", transform: "translateX(-50%)", color: "red", fontSize: "1.2em", fontWeight: "bold", lineHeight: 1 }}>ᵛ</span>
                        {char}
                      </span>
                    );
                  }
                  if (i === confirmedLen && isComposing) {
                    return <span key={i} style={{ color: "#9CA3AF" }}>{char}</span>;
                  }
                  return <span key={i}>{char}</span>;
                });
              })()
            : ""}
      </p>

      {mode === "words" && !isReviewActive && (
        <div className="flex flex-col items-start gap-1 mt-2">
          {[1, 2].map((offset) => {
            const idx = currentWordIndex + offset;
            return idx < shuffledWords.length && shuffledWords[idx] ? (
              <span key={offset} className="text-gray-400" style={{ fontSize: `${Math.round(displayFontSize * 0.85)}px` }}>
                {shuffledWords[idx]}
              </span>
            ) : null;
          })}
        </div>
      )}
    </>
  );
}
