export const GEMINI_MODEL_NAMES = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite-preview-09-2025",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
] as const;

export const GEMINI_MODEL_OPTIONS = [
  { id: "auto", label: "자동 선택", estimatedSentences: "쿼터에 따라 다름" },
  { id: "gemini-3-flash-preview", label: "3 Flash Preview", estimatedSentences: "약 100개" },
  { id: "gemini-2.5-flash", label: "2.5 Flash", estimatedSentences: "약 600~1300개" },
  { id: "gemini-2.5-flash-lite", label: "2.5 Flash Lite", estimatedSentences: "약 600~1300개" },
  { id: "gemini-2.0-flash", label: "2.0 Flash", estimatedSentences: "약 80~160개" },
  { id: "gemini-2.0-flash-lite", label: "2.0 Flash Lite", estimatedSentences: "약 80~160개" },
] as const;

export const SENTENCE_STYLES = [
  "자유 문체",
  "뉴스/일상 문체",
  "비즈니스 공문체",
  "에세이/설명체",
  "소설/문학체",
  "법률/계약체",
  "의료/건강체",
  "IT/기술체",
  "스포츠 중계체",
  "유머/캐주얼체",
  "여행/관광체",
] as const;

export const SENTENCE_REVIEW_WINDOW = 50;
export const SENTENCE_REVIEW_PICK_COUNT = 5;
