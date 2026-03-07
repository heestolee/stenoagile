import type { PositionDifficulty, PositionStage } from "./types";

const CHOSEONG = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"] as const;
const JUNGSEONG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"] as const;
const JONGSEONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"] as const;

const STAGE_INITIAL_MID = ["ㄱ", "ㄷ", "ㅅ", "ㅈ"] as const;
const STAGE_FINAL_MID = ["ㄱ", "ㄴ", "ㄹ", "ㅅ", "ㅂ"] as const;
const STAGE_VOWEL_CORE = ["ㅏ", "ㅓ", "ㅗ", "ㅜ", "ㅡ", "ㅣ"] as const;
const STAGE_BASE_INITIALS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅎ"] as const;
const STAGE_INITIAL_BOTTOM = ["ㅁ", "ㄹ", "ㄴ", "ㅎ", "ㅇ"] as const;
const STAGE_FINAL_BOTTOM = ["ㅆ", "ㅇ", "ㅁ", "ㄷ", "ㅈ"] as const;
const STAGE_INITIAL_TOP = ["ㅊ", "ㅌ", "ㅋ", "ㅂ", "ㅍ"] as const;
const STAGE_FINAL_TOP = ["ㄲ", "ㅎ", "ㅌ", "ㅊ", "ㅍ"] as const;
const STAGE_DOUBLE_INITIAL = ["ㄲ", "ㄸ", "ㅃ", "ㅆ", "ㅉ"] as const;
const STAGE_COMPOUND_VOWEL_1 = ["ㅐ", "ㅔ", "ㅙ", "ㅚ", "ㅟ", "ㅞ"] as const;
const STAGE_COMPOUND_VOWEL_2 = ["ㅑ", "ㅕ", "ㅛ", "ㅠ", "ㅒ", "ㅖ"] as const;
const STAGE_COMPLEX_FINAL = ["ㄳ", "ㄵ", "ㄶ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅄ"] as const;

export const DEFAULT_POSITION_STAGES: PositionStage[] = [
  "initial_mid",
  "final_mid",
  "initial_bottom",
  "final_bottom",
  "initial_top",
  "final_top",
  "double_consonant",
  "compound_vowel_1",
  "compound_vowel_2",
  "complex_final",
];

const randomInt = (max: number): number => Math.floor(Math.random() * max);
const pick = <T>(arr: readonly T[]): T => arr[randomInt(arr.length)];

export const createEmptyPositionStageMap = (): Record<PositionStage, string[]> => ({
  initial_mid: [],
  final_mid: [],
  initial_bottom: [],
  final_bottom: [],
  initial_top: [],
  final_top: [],
  double_consonant: [],
  compound_vowel_1: [],
  compound_vowel_2: [],
  complex_final: [],
});

export const normalizePositionStageMap = (
  map: Partial<Record<PositionStage, string[]>> | undefined
): Record<PositionStage, string[]> => {
  const base = createEmptyPositionStageMap();
  for (const key of DEFAULT_POSITION_STAGES) {
    base[key] = Array.isArray(map?.[key]) ? [...(map?.[key] as string[])] : [];
  }
  return base;
};

const composeSyllable = (initial: string, vowel: string, final = ""): string => {
  const l = CHOSEONG.indexOf(initial as typeof CHOSEONG[number]);
  const v = JUNGSEONG.indexOf(vowel as typeof JUNGSEONG[number]);
  const t = JONGSEONG.indexOf(final as typeof JONGSEONG[number]);
  if (l < 0 || v < 0 || t < 0) return "가";
  return String.fromCharCode(0xac00 + (l * 21 + v) * 28 + t);
};

const createPositionSyllable = (difficulty: PositionDifficulty): string => {
  if (difficulty === "random") {
    const mixed = pick<Exclude<PositionDifficulty, "random">>([
      "initial_mid",
      "final_mid",
      "initial_bottom",
      "final_bottom",
      "initial_top",
      "final_top",
      "double_consonant",
      "compound_vowel_1",
      "compound_vowel_2",
      "complex_final",
    ]);
    return createPositionSyllable(mixed);
  }
  if (difficulty === "initial_mid") {
    return composeSyllable(pick(STAGE_INITIAL_MID), pick(STAGE_VOWEL_CORE), "");
  }
  if (difficulty === "final_mid") {
    return composeSyllable(pick(STAGE_BASE_INITIALS), pick(STAGE_VOWEL_CORE), pick(STAGE_FINAL_MID));
  }
  if (difficulty === "initial_bottom") {
    return composeSyllable(pick(STAGE_INITIAL_BOTTOM), pick(STAGE_VOWEL_CORE), "");
  }
  if (difficulty === "final_bottom") {
    return composeSyllable(pick(STAGE_BASE_INITIALS), pick(STAGE_VOWEL_CORE), pick(STAGE_FINAL_BOTTOM));
  }
  if (difficulty === "initial_top") {
    return composeSyllable(pick(STAGE_INITIAL_TOP), pick(STAGE_VOWEL_CORE), "");
  }
  if (difficulty === "final_top") {
    return composeSyllable(pick(STAGE_BASE_INITIALS), pick(STAGE_VOWEL_CORE), pick(STAGE_FINAL_TOP));
  }
  if (difficulty === "double_consonant") {
    return composeSyllable(pick(STAGE_DOUBLE_INITIAL), pick(STAGE_VOWEL_CORE), "");
  }
  if (difficulty === "compound_vowel_1") {
    return composeSyllable(pick(STAGE_BASE_INITIALS), pick(STAGE_COMPOUND_VOWEL_1), "");
  }
  if (difficulty === "compound_vowel_2") {
    return composeSyllable(pick(STAGE_BASE_INITIALS), pick(STAGE_COMPOUND_VOWEL_2), "");
  }
  return composeSyllable(pick(STAGE_BASE_INITIALS), pick(STAGE_VOWEL_CORE), pick(STAGE_COMPLEX_FINAL));
};

export const createPositionSyllableFromStages = (
  stages: PositionStage[],
  excludedMap?: Record<PositionStage, string[]>
): string => {
  const pool = stages.length > 0 ? stages : DEFAULT_POSITION_STAGES;
  const stage = pick(pool);
  const excludedSet = new Set(excludedMap?.[stage] ?? []);
  if (excludedSet.size === 0) return createPositionSyllable(stage);
  for (let i = 0; i < 40; i++) {
    const next = createPositionSyllable(stage);
    if (!excludedSet.has(next)) return next;
  }
  return createPositionSyllable(stage);
};
