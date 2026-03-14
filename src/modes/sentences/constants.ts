export const GEMINI_MODEL_NAMES = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite-preview-09-2025",
] as const;

export const GEMINI_MODEL_OPTIONS = [
  { id: "auto", label: "자동 선택", estimatedSentences: "" },
  { id: "gemini-3-flash-preview", label: "3 Flash Preview", estimatedSentences: "" },
  { id: "gemini-3.1-flash-lite-preview", label: "3.1 Flash Lite Preview", estimatedSentences: "" },
  { id: "gemini-2.5-pro", label: "2.5 Pro", estimatedSentences: "" },
  { id: "gemini-2.5-flash", label: "2.5 Flash", estimatedSentences: "" },
  { id: "gemini-2.5-flash-lite", label: "2.5 Flash Lite", estimatedSentences: "" },
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
