import type { ChangeEventHandler, CompositionEventHandler, KeyboardEventHandler, RefObject } from "react";

type Props = {
  wordInputRef: RefObject<HTMLInputElement | null>;
  currentSentenceIndex: number;
  isSentenceReview: boolean;
  displayFontSize: number;
  sentences: string[];
  onChange: ChangeEventHandler<HTMLInputElement>;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onCompositionStart: CompositionEventHandler<HTMLInputElement>;
  onCompositionEnd: CompositionEventHandler<HTMLInputElement>;
};

export default function SentenceInputPanel({
  wordInputRef,
  currentSentenceIndex,
  isSentenceReview,
  displayFontSize,
  sentences,
  onChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
}: Props) {
  return (
    <>
      <input
        ref={wordInputRef}
        key={`${currentSentenceIndex}-${isSentenceReview ? "review" : "main"}`}
        autoFocus
        autoComplete="off"
        type="text"
        className="w-full p-2 border rounded mt-1"
        style={{ fontSize: `${displayFontSize}px` }}
        placeholder="Tab 키로 연습 칸으로 이동"
        onChange={onChange}
        onKeyDown={onKeyDown}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
      />
      <div className="flex flex-col items-start gap-1 mt-2">
        {[1, 2].map((offset) => {
          const idx = currentSentenceIndex + offset;
          return idx < sentences.length && sentences[idx] ? (
            <span key={offset} className="text-gray-400" style={{ fontSize: `${Math.round(displayFontSize * 0.85)}px` }}>
              {sentences[idx]}
            </span>
          ) : null;
        })}
      </div>
    </>
  );
}
