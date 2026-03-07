import type { ChangeEvent, DragEvent } from "react";
import type { Mode } from "../types";

type SourceTextPanelProps = {
  mode: Mode;
  isPositionMode: boolean;
  inputText: string;
  onInputTextChange: (text: string) => void;
  onSaveToSlot: () => void;
  onTextareaChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onTextareaDrop: (event: DragEvent<HTMLTextAreaElement>) => void;
};

export default function SourceTextPanel({
  mode,
  isPositionMode,
  inputText,
  onInputTextChange,
  onSaveToSlot,
  onTextareaChange,
  onTextareaDrop,
}: SourceTextPanelProps) {
  const showWordStats = (mode === "words" || mode === "sentences") && !isPositionMode && inputText.trim().length > 0;
  const showEditor = mode !== "random" && !isPositionMode;

  return (
    <>
      {showWordStats && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">단어 {inputText.trim().split("/").filter(Boolean).length}개</span>
          {(() => {
            const words = inputText.trim().split("/").filter(Boolean).map((w) => w.trim());
            const seen = new Map<string, number>();
            const dupes: string[] = [];
            for (const w of words) {
              seen.set(w, (seen.get(w) || 0) + 1);
            }
            for (const [w, count] of seen) {
              if (count > 1) dupes.push(`${w}(${count})`);
            }
            return dupes.length > 0 ? (
              <span className="text-red-500 font-medium">중복: {dupes.join(", ")}</span>
            ) : (
              <span className="text-green-500 font-medium">중복 없음</span>
            );
          })()}
          <button
            className="px-2 py-0.5 bg-gray-200 hover:bg-gray-300 rounded text-gray-600"
            onClick={() => {
              const sorted = inputText
                .trim()
                .split("/")
                .filter(Boolean)
                .map((w) => w.trim())
                .sort((a, b) => a.localeCompare(b, "ko"));
              onInputTextChange(sorted.join("/"));
            }}
          >
            가나다순
          </button>
          <button
            className="px-2 py-0.5 bg-red-100 hover:bg-red-200 rounded text-red-600"
            onClick={() => {
              const unique = [...new Set(inputText.trim().split("/").filter(Boolean).map((w) => w.trim()))];
              onInputTextChange(unique.join("/"));
            }}
          >
            중복제거
          </button>
        </div>
      )}
      {showEditor && (
        <>
          <span className="text-xs text-gray-500">원문 {inputText.replace(/\s/g, "").length}자</span>
          <button
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 w-full"
            onClick={onSaveToSlot}
          >
            현재 문장 저장
          </button>
          <textarea
            className="w-full p-2 border rounded"
            rows={25}
            placeholder={
              mode === "sentences" || mode === "words"
                ? "단어를 /로 구분하여 입력하세요\n(예: 경제/기술/환경)\n텍스트 파일을 드래그하여 넣을 수도 있습니다"
                : "텍스트 파일을 드래그하여 넣을 수도 있습니다"
            }
            value={inputText}
            onChange={onTextareaChange}
            onDrop={onTextareaDrop}
            onDragOver={(e) => e.preventDefault()}
          />
        </>
      )}
    </>
  );
}
