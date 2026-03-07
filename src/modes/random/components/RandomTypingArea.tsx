import type { CSSProperties, KeyboardEvent } from "react";

type Props = {
  inputFontSize: number;
  onChangeText: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

export default function RandomTypingArea({ inputFontSize, onChangeText, onKeyDown }: Props) {
  return (
    <div className="flex-1 border-2 border-green-500 rounded bg-green-50 p-4">
      <textarea
        className="w-full h-full p-4 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        style={{ fontSize: `${inputFontSize}px`, lineHeight: 1.5, imeMode: "active" } as CSSProperties}
        placeholder="여기에 받아쓰기 내용을 입력하세요"
        onChange={(e) => onChangeText(e.target.value)}
        onKeyDown={onKeyDown}
        lang="ko"
      />
    </div>
  );
}
