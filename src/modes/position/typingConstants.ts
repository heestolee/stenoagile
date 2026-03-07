import type { PositionStage } from "./types";

export type PositionKeyDef = { id: string; label: string };

export const POSITION_LEFT_ROWS: PositionKeyDef[][] = [
  [{ id: "L_CH", label: "ㅊ" }, { id: "L_T", label: "ㅌ" }, { id: "L_K", label: "ㅋ" }, { id: "L_B", label: "ㅂ" }, { id: "L_P", label: "ㅍ" }],
  [{ id: "L_S", label: "ㅅ" }, { id: "L_D", label: "ㄷ" }, { id: "L_J", label: "ㅈ" }, { id: "L_G", label: "ㄱ" }, { id: "L_G2", label: "(ㅋ)" }],
  [{ id: "L_M", label: "ㅁ" }, { id: "L_R", label: "ㄹ" }, { id: "L_N", label: "ㄴ" }, { id: "L_H", label: "ㅎ" }, { id: "L_NG", label: "ㅢ" }],
];

export const POSITION_RIGHT_ROWS: PositionKeyDef[][] = [
  [{ id: "R_GG", label: "ㄲ" }, { id: "R_H", label: "ㅎ" }, { id: "R_T", label: "ㅌ" }, { id: "R_CH", label: "ㅊ" }, { id: "R_P", label: "ㅍ" }],
  [{ id: "R_G", label: "ㄱ" }, { id: "R_N", label: "ㄴ" }, { id: "R_R", label: "ㄹ" }, { id: "R_S", label: "ㅅ" }, { id: "R_B", label: "ㅂ" }],
  [{ id: "R_SS", label: "ㅆ" }, { id: "R_NG", label: "ㅇ" }, { id: "R_M", label: "ㅁ" }, { id: "R_D", label: "ㄷ" }, { id: "R_J", label: "ㅈ" }],
];

export const POSITION_THUMB_ROW: PositionKeyDef[] = [
  { id: "V_O", label: "ㅗ" },
  { id: "V_A", label: "ㅏ" },
  { id: "V_U", label: "ㅜ" },
  { id: "V_EU", label: "ㅡ" },
  { id: "V_EO", label: "ㅓ" },
  { id: "V_I", label: "ㅣ" },
];

export const CHOSEONG_LIST = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
export const JUNGSEONG_LIST = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
export const JONGSEONG_LIST = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

export const POSITION_INITIAL_MAP: Record<string, string[]> = {
  "ㄱ": ["L_G"], "ㄲ": ["L_G2"], "ㄴ": ["L_N"], "ㄷ": ["L_D"], "ㄸ": ["L_D"], "ㄹ": ["L_R"], "ㅁ": ["L_M"],
  "ㅂ": ["L_B"], "ㅃ": ["L_B"], "ㅅ": ["L_S"], "ㅆ": ["L_S"], "ㅇ": ["L_NG"], "ㅈ": ["L_J"], "ㅉ": ["L_J"],
  "ㅊ": ["L_CH"], "ㅋ": ["L_K"], "ㅌ": ["L_T"], "ㅍ": ["L_P"], "ㅎ": ["L_H"],
};

export const POSITION_FINAL_MAP: Record<string, string[]> = {
  "ㄱ": ["R_G"], "ㄲ": ["R_GG"], "ㄳ": ["R_G", "R_S"], "ㄴ": ["R_N"], "ㄵ": ["R_N", "R_J"], "ㄶ": ["R_N", "R_H"],
  "ㄷ": ["R_D"], "ㄹ": ["R_R"], "ㄺ": ["R_R", "R_G"], "ㄻ": ["R_R", "R_M"], "ㄼ": ["R_R", "R_B"], "ㄽ": ["R_R", "R_S"],
  "ㄾ": ["R_R", "R_T"], "ㄿ": ["R_R", "R_P"], "ㅀ": ["R_R", "R_H"], "ㅁ": ["R_M"], "ㅂ": ["R_B"], "ㅄ": ["R_B", "R_S"],
  "ㅅ": ["R_S"], "ㅆ": ["R_SS"], "ㅇ": ["R_NG"], "ㅈ": ["R_J"], "ㅊ": ["R_CH"], "ㅋ": ["R_G"], "ㅌ": ["R_T"], "ㅍ": ["R_P"], "ㅎ": ["R_H"],
};

export const POSITION_VOWEL_MAP: Record<string, string[]> = {
  "ㅏ": ["V_A"], "ㅐ": ["V_A", "V_I"], "ㅑ": ["V_A"], "ㅒ": ["V_A", "V_I"], "ㅓ": ["V_EO"], "ㅔ": ["V_EO", "V_I"],
  "ㅕ": ["V_EO"], "ㅖ": ["V_EO", "V_I"], "ㅗ": ["V_O"], "ㅘ": ["V_O", "V_A"], "ㅙ": ["V_O", "V_A", "V_I"],
  "ㅚ": ["V_O", "V_I"], "ㅛ": ["V_O"], "ㅜ": ["V_U"], "ㅝ": ["V_U", "V_EO"], "ㅞ": ["V_U", "V_EO", "V_I"],
  "ㅟ": ["V_U", "V_I"], "ㅠ": ["V_U"], "ㅡ": ["V_EU"], "ㅢ": ["V_EU", "V_I"], "ㅣ": ["V_I"],
};

export const POSITION_KEY_LABEL: Record<string, string> = {
  L_CH: "ㅊ", L_T: "ㅌ", L_K: "ㅋ", L_B: "ㅂ", L_P: "ㅍ",
  L_S: "ㅅ", L_D: "ㄷ", L_J: "ㅈ", L_G: "ㄱ", L_G2: "(ㅋ)",
  L_M: "ㅁ", L_R: "ㄹ", L_N: "ㄴ", L_H: "ㅎ", L_NG: "ㅢ",
  R_GG: "ㄲ", R_H: "ㅎ", R_T: "ㅌ", R_CH: "ㅊ", R_P: "ㅍ",
  R_G: "ㄱ", R_N: "ㄴ", R_R: "ㄹ", R_S: "ㅅ", R_B: "ㅂ",
  R_SS: "ㅆ", R_NG: "ㅇ", R_M: "ㅁ", R_D: "ㄷ", R_J: "ㅈ",
  V_O: "ㅗ", V_A: "ㅏ", V_U: "ㅜ", V_EU: "ㅡ", V_EO: "ㅓ", V_I: "ㅣ",
};

export type PositionKeyRole = "initial" | "vowel_left_thumb" | "vowel_right_thumb" | "final";

export const getPositionKeyRole = (id: string): PositionKeyRole => {
  if (id.startsWith("L_")) return "initial";
  if (id.startsWith("R_")) return "final";
  if (id === "V_O" || id === "V_A" || id === "V_U") return "vowel_left_thumb";
  return "vowel_right_thumb";
};

export type PositionRoleGroup = "initial" | "vowel" | "final";

export const getPositionRoleGroup = (role: PositionKeyRole): PositionRoleGroup =>
  role === "initial" ? "initial" : role === "final" ? "final" : "vowel";

export const POSITION_SAMPLE_KEY = "position_transition_samples";
export const POSITION_OVERALL_SAMPLE_KEY = "position_transition_samples_overall";
export const POSITION_FAST_THRESHOLD_MS = 900;
export const POSITION_SAMPLE_LIMIT = 200;
export const POSITION_OVERALL_SAMPLE_LIMIT = 2000;
export const HANGUL_CHAR = /^[가-힣]$/;
export const HANGUL_WORD_2_3 = /^[가-힣]{2,3}$/;
export const POSITION_RECOMMENDED_SOURCE_WORD_COUNT = 10;
export const POSITION_WEAK_LINK_HIGHLIGHT_LIMIT = 6;
export const POSITION_STAGE_OPTIONS: Array<{ key: PositionStage; label: string; numLabel: string; btnLabel: string }> = [
  { key: "initial_mid", label: "1단계 초성 중간자리", numLabel: "1", btnLabel: "초성중간" },
  { key: "final_mid", label: "2단계 종성 중간자리", numLabel: "2", btnLabel: "종성중간" },
  { key: "initial_bottom", label: "3단계 초성 아랫자리", numLabel: "3", btnLabel: "초성아래" },
  { key: "final_bottom", label: "4단계 종성 아랫자리", numLabel: "4", btnLabel: "종성아래" },
  { key: "initial_top", label: "5단계 초성 윗자리", numLabel: "5", btnLabel: "초성위" },
  { key: "final_top", label: "6단계 종성 윗자리", numLabel: "6", btnLabel: "종성위" },
  { key: "double_consonant", label: "7단계 쌍자음", numLabel: "7", btnLabel: "쌍자음" },
  { key: "compound_vowel_1", label: "8단계 겹모음 1", numLabel: "8", btnLabel: "겹모음1" },
  { key: "compound_vowel_2", label: "9단계 겹모음 2", numLabel: "9", btnLabel: "겹모음2" },
  { key: "complex_final", label: "10단계 겹받침", numLabel: "10", btnLabel: "겹받침" },
];

export const getPositionKeyIdsForChar = (char: string): string[] => {
  if (!char) return [];
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return [];
  const offset = code - 0xac00;
  const initial = CHOSEONG_LIST[Math.floor(offset / (21 * 28))];
  const vowel = JUNGSEONG_LIST[Math.floor((offset % (21 * 28)) / 28)];
  const final = JONGSEONG_LIST[offset % 28];

  const ids = new Set<string>();
  POSITION_INITIAL_MAP[initial]?.forEach((id) => ids.add(id));
  POSITION_VOWEL_MAP[vowel]?.forEach((id) => ids.add(id));
  if (final) POSITION_FINAL_MAP[final]?.forEach((id) => ids.add(id));
  return [...ids];
};

export const decomposeHangulSyllable = (char: string): { initial: string; vowel: string; final: string } | null => {
  if (!char) return null;
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const offset = code - 0xac00;
  const initial = CHOSEONG_LIST[Math.floor(offset / (21 * 28))];
  const vowel = JUNGSEONG_LIST[Math.floor((offset % (21 * 28)) / 28)];
  const final = JONGSEONG_LIST[offset % 28];
  return { initial, vowel, final };
};

export const getContextTokensForChar = (char: string, baseGroup: PositionRoleGroup): string[] => {
  const parts = decomposeHangulSyllable(char);
  if (!parts) return [];
  const tokens: string[] = [];
  if (baseGroup !== "initial" && parts.initial) tokens.push(parts.initial);
  if (baseGroup !== "vowel" && parts.vowel) tokens.push(parts.vowel);
  if (baseGroup !== "final" && parts.final) tokens.push(parts.final);
  return tokens;
};
