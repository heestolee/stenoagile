import type { Mode } from "../types";

type RoundCompleteResult = {
  correct: number;
  halfCorrect: number;
  incorrect: number;
  total: number;
  avgKpm: number;
  avgCpm: number;
  lastKpm: number;
  lastCpm: number;
  reviewCorrect?: number;
  reviewTotal?: number;
};

type WordSentenceRoundResultProps = {
  mode: Mode;
  isPracticing: boolean;
  isSentenceReview: boolean;
  hasSentences: boolean;
  inputText: string;
  selectedSlot: number | null;
  roundCompleteResult: RoundCompleteResult | null;
  onStartSentenceReview: (parsedWords: string[]) => void;
};

export default function WordSentenceRoundResult({
  mode,
  isPracticing,
  isSentenceReview,
  hasSentences,
  inputText,
  selectedSlot,
  roundCompleteResult,
  onStartSentenceReview,
}: WordSentenceRoundResultProps) {
  if (!roundCompleteResult || isPracticing || (mode !== "words" && mode !== "sentences")) {
    return null;
  }

  return (
    <div className="p-4 border-2 border-green-500 rounded bg-green-50">
      <p className="text-lg font-bold text-green-700 mb-2">{isSentenceReview ? "복습 완료!" : "라운드 완료!"}</p>
      <div className="flex gap-4 text-sm">
        {mode === "words" ? (
          <>
            <span className="text-blue-600">완숙: {roundCompleteResult.correct}</span>
            <span className="text-amber-500">반숙: {roundCompleteResult.halfCorrect}</span>
            <span className="text-rose-600">미숙: {roundCompleteResult.incorrect}</span>
          </>
        ) : (
          <>
            <span className="text-blue-600">정답: {roundCompleteResult.correct}</span>
            <span className="text-rose-600">오답: {roundCompleteResult.incorrect}</span>
          </>
        )}
        <span>총: {roundCompleteResult.total}문제</span>
        {roundCompleteResult.lastKpm > 0 && (
          <span className="text-blue-600">마지막 타수 {roundCompleteResult.lastKpm} / 마지막 자수 {roundCompleteResult.lastCpm}</span>
        )}
        {roundCompleteResult.avgKpm > 0 && (
          <span className="text-gray-600">평균 타수 {roundCompleteResult.avgKpm} / 평균 자수 {roundCompleteResult.avgCpm}</span>
        )}
      </div>

      {mode === "sentences" && hasSentences && !isSentenceReview && (
        <button
          className="mt-2 px-4 py-1.5 rounded font-semibold bg-purple-500 text-white hover:bg-purple-600 transition text-sm"
          onClick={() => {
            const parsedWords = inputText.trim().split("/").filter(Boolean);
            onStartSentenceReview(parsedWords);
          }}
        >
          복습하기
        </button>
      )}

      {mode === "sentences" && selectedSlot === null && hasSentences && !isSentenceReview && (
        <p className="mt-1 text-xs text-gray-500">슬롯이 없어도 복습이 가능합니다.</p>
      )}
    </div>
  );
}
