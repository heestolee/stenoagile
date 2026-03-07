import type { Mode } from "../types";

type ModeTabsProps = {
  mode: Mode;
  isBatchMode: boolean;
  onPosition: () => void;
  onWords: () => void;
  onSentences: () => void;
  onLongtext: () => void;
  onBatchSequential: () => void;
  onSequential: () => void;
  onRandom: () => void;
};

export default function ModeTabs({
  mode,
  isBatchMode,
  onPosition,
  onWords,
  onSentences,
  onLongtext,
  onBatchSequential,
  onSequential,
  onRandom,
}: ModeTabsProps) {
  return (
    <div className="flex gap-2">
      <button
        className={`px-4 py-2 rounded ${mode === "position" ? "bg-blue-500 text-white" : "bg-gray-300"}`}
        onClick={onPosition}
      >
        자리
      </button>
      <button
        className={`px-4 py-2 rounded ${mode === "words" ? "bg-blue-500 text-white" : "bg-gray-300"}`}
        onClick={onWords}
      >
        단어
      </button>
      <button
        className={`px-4 py-2 rounded ${mode === "sentences" ? "bg-blue-500 text-white" : "bg-gray-300"}`}
        onClick={onSentences}
      >
        문장
      </button>
      <button
        className={`px-4 py-2 rounded ${mode === "longtext" ? "bg-blue-500 text-white" : "bg-gray-300"}`}
        onClick={onLongtext}
      >
        긴 글
      </button>
      <button
        className={`px-4 py-2 rounded ${mode === "sequential" && isBatchMode ? "bg-blue-500 text-white" : "bg-gray-300"}`}
        onClick={onBatchSequential}
      >
        매매 치라
      </button>
      <button
        className={`px-4 py-2 rounded ${mode === "sequential" && !isBatchMode ? "bg-blue-500 text-white" : "bg-gray-300"}`}
        onClick={onSequential}
      >
        보고 치라
      </button>
      <button
        className={`px-4 py-2 rounded ${mode === "random" ? "bg-blue-500 text-white" : "bg-gray-300"}`}
        onClick={onRandom}
      >
        듣고 치라
      </button>
    </div>
  );
}
