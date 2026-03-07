import type { CSSProperties } from "react";

type Props = {
  isFullyComplete: boolean;
  isBatchMode: boolean;
  isBatchReviewDone: boolean;
  practiceText: string;
  setPracticeText: (v: string) => void;
  inputFontSize: number;
  favoriteSlots: Set<number>;
  practiceSlot: number | null;
  selectedSlot: number | null;
  updateInputText: (text: string) => void;
  startNextRound: (nextSlot?: number) => void;
  resumeRound: () => void;
};

export default function SequentialResumePanel({
  isFullyComplete,
  isBatchMode,
  isBatchReviewDone,
  practiceText,
  setPracticeText,
  inputFontSize,
  favoriteSlots,
  practiceSlot,
  selectedSlot,
  updateInputText,
  startNextRound,
  resumeRound,
}: Props) {
  return (
    <div className="border-2 border-orange-400 rounded bg-orange-50 p-4">
      <div className="text-sm text-orange-600 mb-2 font-medium">
        연습칸 (엔터: {isFullyComplete ? "다음 라운드" : "재개"})
        {isBatchMode && (
          <span className="ml-2 text-gray-500 font-normal">
            | 슬롯번호+엔터: 해당 슬롯 | 99+엔터: 랜덤 슬롯
          </span>
        )}
      </div>
      <textarea
        className="w-full p-4 border-2 border-orange-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none bg-white"
        style={{
          fontSize: `${inputFontSize}px`,
          lineHeight: 1.5,
          minHeight: "120px",
          imeMode: "active",
        } as CSSProperties}
        placeholder="여기서 바로 연습하세요"
        value={practiceText}
        onChange={(e) => setPracticeText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const trimmed = practiceText.trimEnd();
            const endsWithNum = trimmed.match(/(\d+)$/);
            const slotNum = endsWithNum ? parseInt(endsWithNum[1], 10) : NaN;

            if (slotNum === 99) {
              const slotsWithContent: number[] = [];
              const targetSlots = favoriteSlots.size > 0 ? [...favoriteSlots] : Array.from({ length: 20 }, (_, i) => i + 1);
              const currentSlot = practiceSlot ?? selectedSlot ?? -1;
              for (const i of targetSlots) {
                if (localStorage.getItem(`slot_${i}`) && i !== currentSlot) {
                  slotsWithContent.push(i);
                }
              }
              if (slotsWithContent.length > 0) {
                const randomSlot = slotsWithContent[Math.floor(Math.random() * slotsWithContent.length)];
                const savedText = localStorage.getItem(`slot_${randomSlot}`);
                if (savedText) {
                  updateInputText(savedText);
                }
                startNextRound(randomSlot);
                return;
              }
            }

            if (slotNum >= 1 && slotNum <= 20) {
              const savedText = localStorage.getItem(`slot_${slotNum}`);
              if (savedText) {
                updateInputText(savedText);
              }
              startNextRound(slotNum);
              return;
            }

            if (isBatchMode && !isBatchReviewDone) {
              resumeRound();
            } else if (isFullyComplete) {
              startNextRound();
            } else {
              resumeRound();
            }
          }
        }}
        autoFocus
      />
    </div>
  );
}
