export type TypingSpeedMetrics = {
  kpm: number;
  cpm: number;
  elapsedTime: number;
};

type BuildTypingSpeedMetricsParams = {
  elapsedMs: number;
  keystrokes: number;
  charCount: number;
  minElapsedMs?: number;
  maxRate?: number;
};

export function countNonSpaceChars(value: string): number {
  return value.trim().replace(/\s+/g, "").length;
}

// 2벌식 기준 타수 계산: 한글 음절을 자모로 분해해 키 입력 횟수를 산출
export function countJamoKeystrokes(text: string): number {
  let count = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      // 초성(1) + 중성(1) + 종성(있으면 1)
      const jongseong = (code - 0xac00) % 28;
      count += jongseong > 0 ? 3 : 2;
    } else {
      count += 1; // 공백·영문·특수문자 등
    }
  }
  return count;
}

export function buildTypingSpeedMetrics(
  params: BuildTypingSpeedMetricsParams,
): TypingSpeedMetrics | null {
  const { elapsedMs, keystrokes, charCount, minElapsedMs = 100, maxRate = 3000 } = params;
  if (elapsedMs < minElapsedMs || keystrokes <= 0) return null;

  const elapsedMinutes = elapsedMs / 1000 / 60;
  const kpm = Math.min(maxRate, Math.round(keystrokes / elapsedMinutes));
  const cpm = Math.min(maxRate, Math.round(charCount / elapsedMinutes));
  return { kpm, cpm, elapsedTime: elapsedMs };
}
