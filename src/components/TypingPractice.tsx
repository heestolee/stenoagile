//테스트용 주석 추가
import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState, useMemo } from "react";
import { useTypingStore, type PositionStage, POSITION_BASE_QUESTION_COUNT, POSITION_RECOMMENDED_MAX_COUNT } from "../store/useTypingStore";
import { savedText1, savedText2, savedText5 } from "../constants";
import { GEMINI_MODEL_NAMES, GEMINI_MODEL_OPTIONS, SENTENCE_STYLES } from "../constants/uiConstants";
import { getFullMarkedText, getMarkedText, analyzeScoring, type FullMarkedChar, type MarkedChar, type ScoringResult } from "../utils/scoringAnalysis";
import { logResult, logSession } from "../utils/sheetLogger";
import { generateSentencesStream } from "../utils/generateSentencesAI";
import { useVideoPlayer } from "../hooks/useVideoPlayer";
import { useHeamiVoice } from "../hooks/useHeamiVoice";
import { useAIGeneration } from "../hooks/useAIGeneration";
import { useSlotManager } from "../hooks/useSlotManager";
import { useWordReview } from "../hooks/useWordReview";
import { useWordProficiency } from "../hooks/useWordProficiency";
import { useAuth } from "../hooks/useAuth";
import LoginPage from "./LoginPage";
import WordProficiencyPanel from "./WordProficiencyPanel";

type PositionKeyDef = { id: string; label: string };
const POSITION_LEFT_ROWS: PositionKeyDef[][] = [
  [{ id: "L_CH", label: "ㅊ" }, { id: "L_T", label: "ㅌ" }, { id: "L_K", label: "ㅋ" }, { id: "L_B", label: "ㅂ" }, { id: "L_P", label: "ㅍ" }],
  [{ id: "L_S", label: "ㅅ" }, { id: "L_D", label: "ㄷ" }, { id: "L_J", label: "ㅈ" }, { id: "L_G", label: "ㄱ" }, { id: "L_G2", label: "(ㅋ)" }],
  [{ id: "L_M", label: "ㅁ" }, { id: "L_R", label: "ㄹ" }, { id: "L_N", label: "ㄴ" }, { id: "L_H", label: "ㅎ" }, { id: "L_NG", label: "ㅢ" }],
];
const POSITION_RIGHT_ROWS: PositionKeyDef[][] = [
  [{ id: "R_GG", label: "ㄲ" }, { id: "R_H", label: "ㅎ" }, { id: "R_T", label: "ㅌ" }, { id: "R_CH", label: "ㅊ" }, { id: "R_P", label: "ㅍ" }],
  [{ id: "R_G", label: "ㄱ" }, { id: "R_N", label: "ㄴ" }, { id: "R_R", label: "ㄹ" }, { id: "R_S", label: "ㅅ" }, { id: "R_B", label: "ㅂ" }],
  [{ id: "R_SS", label: "ㅆ" }, { id: "R_NG", label: "ㅇ" }, { id: "R_M", label: "ㅁ" }, { id: "R_D", label: "ㄷ" }, { id: "R_J", label: "ㅈ" }],
];
const POSITION_THUMB_ROW: PositionKeyDef[] = [
  { id: "V_O", label: "ㅗ" }, { id: "V_A", label: "ㅏ" }, { id: "V_U", label: "ㅜ" },
  { id: "V_EU", label: "ㅡ" }, { id: "V_EO", label: "ㅓ" }, { id: "V_I", label: "ㅣ" },
];

const CHOSEONG_LIST = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const JUNGSEONG_LIST = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const JONGSEONG_LIST = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const POSITION_INITIAL_MAP: Record<string, string[]> = {
  "ㄱ": ["L_G"], "ㄲ": ["L_G2"], "ㄴ": ["L_N"], "ㄷ": ["L_D"], "ㄸ": ["L_D"], "ㄹ": ["L_R"], "ㅁ": ["L_M"],
  "ㅂ": ["L_B"], "ㅃ": ["L_B"], "ㅅ": ["L_S"], "ㅆ": ["L_S"], "ㅇ": ["L_NG"], "ㅈ": ["L_J"], "ㅉ": ["L_J"],
  "ㅊ": ["L_CH"], "ㅋ": ["L_K"], "ㅌ": ["L_T"], "ㅍ": ["L_P"], "ㅎ": ["L_H"],
};
const POSITION_FINAL_MAP: Record<string, string[]> = {
  "ㄱ": ["R_G"], "ㄲ": ["R_GG"], "ㄳ": ["R_G", "R_S"], "ㄴ": ["R_N"], "ㄵ": ["R_N", "R_J"], "ㄶ": ["R_N", "R_H"],
  "ㄷ": ["R_D"], "ㄹ": ["R_R"], "ㄺ": ["R_R", "R_G"], "ㄻ": ["R_R", "R_M"], "ㄼ": ["R_R", "R_B"], "ㄽ": ["R_R", "R_S"],
  "ㄾ": ["R_R", "R_T"], "ㄿ": ["R_R", "R_P"], "ㅀ": ["R_R", "R_H"], "ㅁ": ["R_M"], "ㅂ": ["R_B"], "ㅄ": ["R_B", "R_S"],
  "ㅅ": ["R_S"], "ㅆ": ["R_SS"], "ㅇ": ["R_NG"], "ㅈ": ["R_J"], "ㅊ": ["R_CH"], "ㅋ": ["R_G"], "ㅌ": ["R_T"], "ㅍ": ["R_P"], "ㅎ": ["R_H"],
};
const POSITION_VOWEL_MAP: Record<string, string[]> = {
  "ㅏ": ["V_A"], "ㅐ": ["V_A", "V_I"], "ㅑ": ["V_A"], "ㅒ": ["V_A", "V_I"], "ㅓ": ["V_EO"], "ㅔ": ["V_EO", "V_I"],
  "ㅕ": ["V_EO"], "ㅖ": ["V_EO", "V_I"], "ㅗ": ["V_O"], "ㅘ": ["V_O", "V_A"], "ㅙ": ["V_O", "V_A", "V_I"],
  "ㅚ": ["V_O", "V_I"], "ㅛ": ["V_O"], "ㅜ": ["V_U"], "ㅝ": ["V_U", "V_EO"], "ㅞ": ["V_U", "V_EO", "V_I"],
  "ㅟ": ["V_U", "V_I"], "ㅠ": ["V_U"], "ㅡ": ["V_EU"], "ㅢ": ["V_EU", "V_I"], "ㅣ": ["V_I"],
};
const POSITION_KEY_LABEL: Record<string, string> = {
  L_CH: "ㅊ", L_T: "ㅌ", L_K: "ㅋ", L_B: "ㅂ", L_P: "ㅍ",
  L_S: "ㅅ", L_D: "ㄷ", L_J: "ㅈ", L_G: "ㄱ", L_G2: "(ㅋ)",
  L_M: "ㅁ", L_R: "ㄹ", L_N: "ㄴ", L_H: "ㅎ", L_NG: "ㅢ",
  R_GG: "ㄲ", R_H: "ㅎ", R_T: "ㅌ", R_CH: "ㅊ", R_P: "ㅍ",
  R_G: "ㄱ", R_N: "ㄴ", R_R: "ㄹ", R_S: "ㅅ", R_B: "ㅂ",
  R_SS: "ㅆ", R_NG: "ㅇ", R_M: "ㅁ", R_D: "ㄷ", R_J: "ㅈ",
  V_O: "ㅗ", V_A: "ㅏ", V_U: "ㅜ", V_EU: "ㅡ", V_EO: "ㅓ", V_I: "ㅣ",
};
type PositionKeyRole = "initial" | "vowel_left_thumb" | "vowel_right_thumb" | "final";
const getPositionKeyRole = (id: string): PositionKeyRole => {
  if (id.startsWith("L_")) return "initial";
  if (id.startsWith("R_")) return "final";
  if (id === "V_O" || id === "V_A" || id === "V_U") return "vowel_left_thumb";
  return "vowel_right_thumb";
};
type PositionRoleGroup = "initial" | "vowel" | "final";
const getPositionRoleGroup = (role: PositionKeyRole): PositionRoleGroup =>
  role === "initial" ? "initial" : role === "final" ? "final" : "vowel";
const getPositionRoleColorClass = (role: PositionKeyRole): string =>
  role === "initial"
    ? "text-white bg-blue-600 border-blue-700"
    : role === "final"
      ? "text-white bg-rose-600 border-rose-700"
      : "text-white bg-emerald-600 border-emerald-700";
const getPositionGroupColorClass = (group: PositionRoleGroup): string =>
  group === "initial"
    ? "text-white bg-blue-600 border-blue-700"
    : group === "final"
      ? "text-white bg-rose-600 border-rose-700"
      : "text-white bg-emerald-600 border-emerald-700";
// 경과 시간을 "분:초.밀리초" 형태로 포맷팅 (밀리초 단위 입력)
const formatTime = (ms: number): string => {
  const totalSeconds = ms / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
};

type PositionSample = {
  ms: number;
  correct: boolean;
  at: number;
  stage: PositionStage | "mixed";
  fromKeys: string[];
  toKeys: string[];
  fromChar: string;
  toChar: string;
};

const POSITION_SAMPLE_KEY = "position_transition_samples";
const POSITION_OVERALL_SAMPLE_KEY = "position_transition_samples_overall";
const POSITION_FAST_THRESHOLD_MS = 900;
const POSITION_SAMPLE_LIMIT = 200;
const POSITION_OVERALL_SAMPLE_LIMIT = 2000;
const HANGUL_CHAR = /^[가-힣]$/;
const HANGUL_WORD_2_3 = /^[가-힣]{2,3}$/;
const POSITION_RECOMMENDED_SOURCE_WORD_COUNT = 10;
const POSITION_WEAK_LINK_HIGHLIGHT_LIMIT = 6;
const POSITION_STAGE_OPTIONS: Array<{ key: PositionStage; label: string; numLabel: string; btnLabel: string }> = [
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

const getPositionKeyIdsForChar = (char: string): string[] => {
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

const decomposeHangulSyllable = (char: string): { initial: string; vowel: string; final: string } | null => {
  if (!char) return null;
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const offset = code - 0xac00;
  const initial = CHOSEONG_LIST[Math.floor(offset / (21 * 28))];
  const vowel = JUNGSEONG_LIST[Math.floor((offset % (21 * 28)) / 28)];
  const final = JONGSEONG_LIST[offset % 28];
  return { initial, vowel, final };
};

const getContextTokensForChar = (char: string, baseGroup: PositionRoleGroup): string[] => {
  const parts = decomposeHangulSyllable(char);
  if (!parts) return [];
  const tokens: string[] = [];
  if (baseGroup !== "initial" && parts.initial) tokens.push(parts.initial);
  if (baseGroup !== "vowel" && parts.vowel) tokens.push(parts.vowel);
  if (baseGroup !== "final" && parts.final) tokens.push(parts.final);
  return tokens;
};
export default function TypingPractice() {
  const {
    inputText,
    shuffledWords,
    sentences,
    currentWordIndex,
    currentSentenceIndex,
    currentLetterIndex,
    typedWord,
    correctCount,
    incorrectCount,
    incorrectWords,
    progressCount,
    totalCount,
    mode,
    positionEnabledStages,
    positionStageExcludedChars,
    speechRate,
    isSoundEnabled,
    updateInputText,
    updateTypedWord,
    switchMode,
    setPositionEnabledStages,
    switchPositionStageImmediately,
    addPositionExcludedChar,
    removePositionExcludedChar,
    regeneratePositionQueueFromCurrent,
    injectPositionRecommendedWords,
    toggleSound,
    isPracticing,
    startPractice,
    stopPractice,
    submitAnswer,
    currentWordStartTime,
    currentWordKeystrokes,
    startCurrentWordTracking,
    incrementCurrentWordKeystrokes,
    resetCurrentWordTracking,
    sequentialText,
    sequentialSpeed,
    randomizedIndices,
    currentDisplayIndex,
    addDisplayedCharIndex,
    updateSequentialSpeed,
    incrementDisplayIndex,
    restartSequentialPractice,
    setSentences,
    addSentence,
    setTotalCount,
    resumeSentencePractice,
  } = useTypingStore();
  const { user, signOut } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showModeStats, setShowModeStats] = useState(false);
  const isPositionMode = mode === "position";
  const isWordLikeMode = mode === "words" || mode === "position";

  const [showText, setShowText] = useState(true);
  const [showPositionKeyboard, setShowPositionKeyboard] = useState(true);
  const [hoveredPositionKeyId, setHoveredPositionKeyId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState({ kpm: 0, cpm: 0, elapsedTime: 0 });
  const [allResults, setAllResults] = useState<{ kpm: number, cpm: number, elapsedTime: number, chars: string }[]>([]);
  const sequentialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    selectedSlot, setSelectedSlot, slotNames, favoriteSlots,
    todayCompletedRounds, slotCompletedRoundsNormal, slotCompletedRoundsBatch, modeCompletedRounds,
    practiceSlot, setPracticeSlot, pendingIncrementSlot, setPendingIncrementSlot,
    incrementCompletedRounds, handleRenameSlot, toggleFavoriteSlot, handleSaveToSlot,
  } = useSlotManager(inputText);
  const [displayFontSize, setDisplayFontSize] = useState(20); // 위쪽 표시 영역 글자 크기
  const [inputFontSize, setInputFontSize] = useState(19.5); // 아래쪽 타이핑 영역 글자 크기
  const [charsPerRead, setCharsPerRead] = useState(3); // 몇 글자씩 읽을지
  const [sequentialSpeechRate, setSequentialSpeechRate] = useState(1); // 보고치라 음성 속도 (1배속)
  const { speakText, clearAllTimeouts } = useHeamiVoice(isSoundEnabled, speechRate, sequentialSpeechRate);
  const [countdown, setCountdown] = useState<number | null>(null); // 카운트다운 상태
  const [, setRoundStartTime] = useState<number | null>(null); // 라운드 시작 시간
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRoundComplete, setIsRoundComplete] = useState(false); // 라운드 완료 상태 (결과 확인 대기)
  const [isSentenceReview, setIsSentenceReview] = useState(false); // 문장모드 복습 중 여부
  const [accumulatedKeystrokes, setAccumulatedKeystrokes] = useState(0); // 누적 타수
  const [accumulatedElapsedMs, setAccumulatedElapsedMs] = useState(0); // 누적 경과 시간
  const [displayElapsedTime, setDisplayElapsedTime] = useState(0); // 실시간 표시용 경과 시간
  const typingTextareaRef = useRef<HTMLTextAreaElement | null>(null); // 타이핑 칸 참조
  const wordInputRef = useRef<HTMLInputElement | null>(null); // 단어/문장 모드 입력 칸 참조
  const isAutoSubmittingRef = useRef(false); // 자동 제출 중복 방지
  const displayAreaRef = useRef<HTMLDivElement | null>(null); // 원문 표시 영역 참조

  // 매매치라 모드 상태
  const [isBatchMode, setIsBatchMode] = useState(false); // 매매치라 모드 활성화 여부
  const [batchSize, setBatchSize] = useState(5); // 한번에 보여줄 글자 수
  const [batchStartIndex, setBatchStartIndex] = useState(0); // 현재 배치 시작 인덱스
  const [currentBatchChars, setCurrentBatchChars] = useState<string>(""); // 현재 배치에 표시된 글자들
  const [batchRandomFillCount, setBatchRandomFillCount] = useState(0); // 마지막 배치에서 랜덤으로 채운 글자 수

  // 복습 모드 상태 (시간 많이 걸린 5개 다시 연습)
  const [isReviewMode, setIsReviewMode] = useState(false); // 복습 모드 여부
  const [reviewBatches, setReviewBatches] = useState<string[]>([]); // 복습할 배치 목록
  const [reviewIndex, setReviewIndex] = useState(0); // 현재 복습 중인 인덱스
  const [isBatchReviewDone, setIsBatchReviewDone] = useState(false); // 복습까지 완전히 끝났는지

  // 단어모드 오답 자동복습 훅
  const {
    isReviewActive, reviewWords, currentReviewIndex, currentReviewTarget,
    reviewType, checkAndStartReview, startFailedReview, handleReviewSubmit, resetReview,
  } = useWordReview();

  // 단어 숙련도 추적 훅
  const {
    todayProficiencies, overallProficiencies, recordResult,
    refreshToday, refreshOverall, clearToday, clearOverall, mergeToOverall,
  } = useWordProficiency("words");
  const [showProficiencyPanel, setShowProficiencyPanel] = useState(false);
  const [reviewFailedWords, setReviewFailedWords] = useState<{ word: string; typed: string }[]>(() => {
    try {
      const saved = localStorage.getItem('reviewFailedWords');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem('reviewFailedWords', JSON.stringify(reviewFailedWords));
  }, [reviewFailedWords]);

  const [positionSamples, setPositionSamples] = useState<PositionSample[]>(() => {
    try {
      const raw = localStorage.getItem(POSITION_SAMPLE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((s) => ({
        ms: Number(s?.ms) || 0,
        correct: !!s?.correct,
        at: Number(s?.at) || Date.now(),
        stage: typeof s?.stage === "string" ? (s.stage as PositionStage | "mixed") : "mixed",
        fromKeys: Array.isArray(s?.fromKeys) ? s.fromKeys : [],
        toKeys: Array.isArray(s?.toKeys) ? s.toKeys : [],
        fromChar: typeof s?.fromChar === "string" ? s.fromChar : "",
        toChar: typeof s?.toChar === "string" ? s.toChar : "",
      }));
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem(POSITION_SAMPLE_KEY, JSON.stringify(positionSamples));
  }, [positionSamples]);
  const [overallPositionSamples, setOverallPositionSamples] = useState<PositionSample[]>(() => {
    try {
      const raw = localStorage.getItem(POSITION_OVERALL_SAMPLE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((s: Record<string, unknown>) => ({
        ms: Number(s?.ms) || 0,
        correct: !!s?.correct,
        at: Number(s?.at) || Date.now(),
        stage: typeof s?.stage === "string" ? (s.stage as PositionStage | "mixed") : "mixed",
        fromKeys: Array.isArray(s?.fromKeys) ? s.fromKeys : [],
        toKeys: Array.isArray(s?.toKeys) ? s.toKeys : [],
        fromChar: typeof s?.fromChar === "string" ? s.fromChar : "",
        toChar: typeof s?.toChar === "string" ? s.toChar : "",
      }));
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem(POSITION_OVERALL_SAMPLE_KEY, JSON.stringify(overallPositionSamples));
  }, [overallPositionSamples]);
  const computePositionMetrics = (samples: PositionSample[]) => {
    const transitions = samples.filter((s) => s.correct && s.ms > 0);

    const transitionMap = new Map<string, { sumMs: number; sumSqMs: number; count: number; fastCount: number }>();
    const transitionContextMap = new Map<string, {
      sumMs: number;
      sumSqMs: number;
      count: number;
      fastCount: number;
      group: PositionRoleGroup;
      fromUnit: string;
      toUnit: string;
      fromKeys: string[];
      toKeys: string[];
      fromChar: string;
      toChar: string;
      fromComp: string[];
      toComp: string[];
    }>();
    const fromKeyMap = new Map<string, { sumMs: number; count: number; fastCount: number }>();
    for (const s of transitions) {
      const fromKeys = s.fromKeys ?? [];
      const toKeys = s.toKeys ?? [];
      if (fromKeys.length === 0 || toKeys.length === 0) continue;
      for (const fromKey of fromKeys) {
        for (const toKey of toKeys) {
          const transitionId = `${fromKey}->${toKey}`;
          const item = transitionMap.get(transitionId) ?? { sumMs: 0, sumSqMs: 0, count: 0, fastCount: 0 };
          item.sumMs += s.ms;
          item.sumSqMs += s.ms * s.ms;
          item.count += 1;
          if (s.ms <= POSITION_FAST_THRESHOLD_MS) item.fastCount += 1;
          transitionMap.set(transitionId, item);

        }
        const fromItem = fromKeyMap.get(fromKey) ?? { sumMs: 0, count: 0, fastCount: 0 };
        fromItem.sumMs += s.ms;
        fromItem.count += 1;
        if (s.ms <= POSITION_FAST_THRESHOLD_MS) fromItem.fastCount += 1;
        fromKeyMap.set(fromKey, fromItem);
      }

      const fromParts = decomposeHangulSyllable(s.fromChar);
      const toParts = decomposeHangulSyllable(s.toChar);
      if (!fromParts || !toParts) continue;

      const contexts: Array<{
        group: PositionRoleGroup;
        fromUnit: string;
        toUnit: string;
        fromKeys: string[];
        toKeys: string[];
      }> = [
        {
          group: "initial",
          fromUnit: fromParts.initial,
          toUnit: toParts.initial,
          fromKeys: POSITION_INITIAL_MAP[fromParts.initial] ?? [],
          toKeys: POSITION_INITIAL_MAP[toParts.initial] ?? [],
        },
        {
          group: "vowel",
          fromUnit: fromParts.vowel,
          toUnit: toParts.vowel,
          fromKeys: POSITION_VOWEL_MAP[fromParts.vowel] ?? [],
          toKeys: POSITION_VOWEL_MAP[toParts.vowel] ?? [],
        },
        {
          group: "final",
          fromUnit: fromParts.final,
          toUnit: toParts.final,
          fromKeys: fromParts.final ? (POSITION_FINAL_MAP[fromParts.final] ?? []) : [],
          toKeys: toParts.final ? (POSITION_FINAL_MAP[toParts.final] ?? []) : [],
        },
      ];

      for (const ctx of contexts) {
        if (!ctx.fromUnit || !ctx.toUnit) continue;
        const fromComp = getContextTokensForChar(s.fromChar, ctx.group);
        const toComp = getContextTokensForChar(s.toChar, ctx.group);
        const contextId = `${ctx.group}:${ctx.fromUnit}->${ctx.toUnit}|FC:${s.fromChar}|TC:${s.toChar}|F:${fromComp.join("+")}|T:${toComp.join("+")}`;
        const contextItem = transitionContextMap.get(contextId) ?? {
          sumMs: 0,
          sumSqMs: 0,
          count: 0,
          fastCount: 0,
          group: ctx.group,
          fromUnit: ctx.fromUnit,
          toUnit: ctx.toUnit,
          fromKeys: [...ctx.fromKeys],
          toKeys: [...ctx.toKeys],
          fromChar: s.fromChar,
          toChar: s.toChar,
          fromComp,
          toComp,
        };
        contextItem.sumMs += s.ms;
        contextItem.sumSqMs += s.ms * s.ms;
        contextItem.count += 1;
        if (s.ms <= POSITION_FAST_THRESHOLD_MS) contextItem.fastCount += 1;
        contextItem.fromKeys = [...new Set([...contextItem.fromKeys, ...ctx.fromKeys])];
        contextItem.toKeys = [...new Set([...contextItem.toKeys, ...ctx.toKeys])];
        transitionContextMap.set(contextId, contextItem);
      }
    }

    const calcStdDev = (sumMs: number, sumSqMs: number, count: number): number => {
      if (count < 2) return 0;
      const mean = sumMs / count;
      const variance = Math.max(0, sumSqMs / count - mean * mean);
      return Math.round(Math.sqrt(variance));
    };
    const classifyStability = (avgMs: number, stdDev: number, count: number): "stable_slow" | "unstable" | "fast" => {
      if (count < 3) return "unstable";
      if (avgMs <= POSITION_FAST_THRESHOLD_MS) return "fast";
      // 변동계수(CV) = stdDev / avgMs. 0.3 이상이면 불안정
      const cv = avgMs > 0 ? stdDev / avgMs : 0;
      return cv >= 0.3 ? "unstable" : "stable_slow";
    };

    const perTransition = [...transitionMap.entries()]
      .map(([id, v]) => {
        const [from, to] = id.split("->");
        const fromRole = getPositionKeyRole(from);
        const toRole = getPositionKeyRole(to);
        const avgMs = Math.round(v.sumMs / v.count);
        const stdDev = calcStdDev(v.sumMs, v.sumSqMs, v.count);
        return {
          id,
          from,
          to,
          fromLabel: POSITION_KEY_LABEL[from] || from,
          toLabel: POSITION_KEY_LABEL[to] || to,
          fromRole,
          toRole,
          fromGroup: getPositionRoleGroup(fromRole),
          toGroup: getPositionRoleGroup(toRole),
          avgMs,
          stdDev,
          stability: classifyStability(avgMs, stdDev, v.count),
          fastRate: Math.round((v.fastCount / v.count) * 100),
          count: v.count,
        };
      })
      .sort((a, b) => b.avgMs - a.avgMs);

    const perTransitionByContext = [...transitionContextMap.entries()]
      .map(([id, v]) => {
        const avgMs = Math.round(v.sumMs / v.count);
        const stdDev = calcStdDev(v.sumMs, v.sumSqMs, v.count);
        return {
          id,
          group: v.group,
          fromUnit: v.fromUnit,
          toUnit: v.toUnit,
          fromKeys: v.fromKeys,
          toKeys: v.toKeys,
          fromChar: v.fromChar,
          toChar: v.toChar,
          fromComp: v.fromComp,
          toComp: v.toComp,
          fromCompLabel: v.fromComp.join("+"),
          toCompLabel: v.toComp.join("+"),
          avgMs,
          stdDev,
          stability: classifyStability(avgMs, stdDev, v.count),
          fastRate: Math.round((v.fastCount / v.count) * 100),
          count: v.count,
        };
      })
      .sort((a, b) => b.avgMs - a.avgMs);

    const perKey = [...fromKeyMap.entries()]
      .map(([key, v]) => ({
        key,
        label: POSITION_KEY_LABEL[key] || key,
        role: getPositionKeyRole(key),
        avgMs: Math.round(v.sumMs / v.count),
        fastRate: Math.round((v.fastCount / v.count) * 100),
        count: v.count,
      }))
      .sort((a, b) => b.avgMs - a.avgMs);

    return {
      perTransition,
      perTransitionByContext,
      perKey,
    };
  };
  const positionMetrics = useMemo(() => computePositionMetrics(positionSamples), [positionSamples]);
  const overallPositionMetrics = useMemo(() => computePositionMetrics(overallPositionSamples), [overallPositionSamples]);
  const positionPerKeyMap = useMemo(() => {
    const m = new Map<string, { avgMs: number; fastRate: number; count: number }>();
    for (const row of positionMetrics.perKey) {
      m.set(row.key, { avgMs: row.avgMs, fastRate: row.fastRate, count: row.count });
    }
    return m;
  }, [positionMetrics.perKey]);
  const hoveredTransitionKeyIds = useMemo(() => {
    if (!hoveredPositionKeyId) return new Set<string>();
    const related = positionMetrics.perTransition
      .filter((row) => row.from === hoveredPositionKeyId || row.to === hoveredPositionKeyId)
      .sort((a, b) => b.avgMs - a.avgMs);
    const picked = (related.filter((row) => row.count >= 2).slice(0, POSITION_WEAK_LINK_HIGHLIGHT_LIMIT).length > 0
      ? related.filter((row) => row.count >= 2).slice(0, POSITION_WEAK_LINK_HIGHLIGHT_LIMIT)
      : related.slice(0, POSITION_WEAK_LINK_HIGHLIGHT_LIMIT));
    const ids = new Set<string>();
    for (const row of picked) {
      ids.add(row.from === hoveredPositionKeyId ? row.to : row.from);
    }
    return ids;
  }, [hoveredPositionKeyId, positionMetrics.perTransition]);
  const currentPositionSampleStage = useMemo<PositionStage | "mixed">(
    () => (positionEnabledStages.length === 1 ? positionEnabledStages[0] : "mixed"),
    [positionEnabledStages]
  );
  const activeSingleStage = useMemo<PositionStage | null>(
    () => (positionEnabledStages.length === 1 ? positionEnabledStages[0] : null),
    [positionEnabledStages]
  );
  const activeStageExcludedChars = useMemo<string[]>(
    () => (activeSingleStage ? (positionStageExcludedChars[activeSingleStage] ?? []) : []),
    [activeSingleStage, positionStageExcludedChars]
  );
  const stagePositionMetrics = useMemo(() => {
    const stageOrder: Array<PositionStage | "mixed"> = [...POSITION_STAGE_OPTIONS.map((v) => v.key), "mixed"];
    return stageOrder.map((stage) => {
      const samples = positionSamples.filter((s) => s.stage === stage);
      const transitions = samples.filter((s) => s.correct && s.ms > 0);
      const avgMs = transitions.length > 0
        ? Math.round(transitions.reduce((sum, s) => sum + s.ms, 0) / transitions.length)
        : 0;
      const fastCount = transitions.filter((s) => s.ms <= POSITION_FAST_THRESHOLD_MS).length;
      const fastRate = transitions.length > 0 ? Math.round((fastCount / transitions.length) * 100) : 0;
      return { stage, count: transitions.length, avgMs, fastRate };
    }).filter((row) => row.count > 0);
  }, [positionSamples]);
  const overallStagePositionMetrics = useMemo(() => {
    const stageOrder: Array<PositionStage | "mixed"> = [...POSITION_STAGE_OPTIONS.map((v) => v.key), "mixed"];
    return stageOrder.map((stage) => {
      const samples = overallPositionSamples.filter((s) => s.stage === stage);
      const transitions = samples.filter((s) => s.correct && s.ms > 0);
      const avgMs = transitions.length > 0
        ? Math.round(transitions.reduce((sum, s) => sum + s.ms, 0) / transitions.length)
        : 0;
      const fastCount = transitions.filter((s) => s.ms <= POSITION_FAST_THRESHOLD_MS).length;
      const fastRate = transitions.length > 0 ? Math.round((fastCount / transitions.length) * 100) : 0;
      return { stage, count: transitions.length, avgMs, fastRate };
    }).filter((row) => row.count > 0);
  }, [overallPositionSamples]);
  const recommendedWordsForPositionRound = useMemo(() => {
    const dictionaryCandidates = `${savedText1}/${savedText2}/${savedText5}`
      .split(/[\s/]+/)
      .map((v) => v.trim())
      .filter((v) => HANGUL_WORD_2_3.test(v));
    const observedWords = positionSamples
      .filter((s) => s.correct && s.fromChar && s.toChar)
      .map((s) => `${s.fromChar}${s.toChar}`)
      .filter((v) => HANGUL_WORD_2_3.test(v));
    const unique = [...new Set([...observedWords, ...dictionaryCandidates])];

    // 약점 전환 패턴 수집: 불안정(자리 미숙) > 안정적으로 느림(물리적 어려움) 순
    const weakTransitions = positionMetrics.perTransitionByContext
      .filter((r) => r.stability !== "fast" && r.count >= 2);
    const unstableSet = new Set(
      weakTransitions.filter((r) => r.stability === "unstable").map((r) => `${r.fromChar}${r.toChar}`)
    );
    const stableSlowSet = new Set(
      weakTransitions.filter((r) => r.stability === "stable_slow").map((r) => `${r.fromChar}${r.toChar}`)
    );

    // 단어별 약점 점수 계산: 불안정 패턴 포함 = 2점, 안정느림 포함 = 1점
    const scoreWord = (word: string): number => {
      let score = 0;
      for (let i = 0; i < word.length - 1; i++) {
        const pair = word[i] + word[i + 1];
        if (unstableSet.has(pair)) score += 2;
        else if (stableSlowSet.has(pair)) score += 1;
      }
      return score;
    };

    const scored = unique.map((word) => ({ word, score: scoreWord(word) }));
    scored.sort((a, b) => b.score - a.score);

    // 점수 높은 순으로 뽑되, 연쇄(끝글자=다음첫글자) 방지
    const pickedWords: string[] = [];
    for (const { word } of scored) {
      const prev = pickedWords[pickedWords.length - 1];
      const isChained = !!prev && prev[prev.length - 1] === word[0];
      if (!isChained) {
        pickedWords.push(word);
      }
      if (pickedWords.length >= POSITION_RECOMMENDED_SOURCE_WORD_COUNT) break;
    }
    if (pickedWords.length < POSITION_RECOMMENDED_SOURCE_WORD_COUNT) {
      for (const { word } of scored) {
        if (!pickedWords.includes(word)) {
          pickedWords.push(word);
        }
        if (pickedWords.length >= POSITION_RECOMMENDED_SOURCE_WORD_COUNT) break;
      }
    }

    // 2~3글자 추천 단어를 1글자 문제로 분해해서 사용
    const toChars = (words: string[]): string[] =>
      words.flatMap((w) => [...w].filter((ch) => HANGUL_CHAR.test(ch)));

    const pickedChars = toChars(pickedWords);
    return pickedChars.slice(0, POSITION_RECOMMENDED_MAX_COUNT);
  }, [positionSamples, positionMetrics.perTransitionByContext]);
  const positionRecommendedInjectedRef = useRef(false);
  useEffect(() => {
    if (!isPositionMode || !isPracticing) {
      positionRecommendedInjectedRef.current = false;
      return;
    }
    if (progressCount === 0) {
      positionRecommendedInjectedRef.current = false;
    }
    if (progressCount < POSITION_BASE_QUESTION_COUNT) return;
    if (positionRecommendedInjectedRef.current) return;

    injectPositionRecommendedWords(recommendedWordsForPositionRound);
    positionRecommendedInjectedRef.current = true;
  }, [isPositionMode, isPracticing, progressCount, recommendedWordsForPositionRound]);
  const prevReviewActiveRef = useRef(false);
  const prevReviewTypeRef = useRef<string | null>(null);

  // 1차 복습 끝나면 오답노트 자동 복습 (1회만)
  useEffect(() => {
    const wasActive = prevReviewActiveRef.current;
    const wasType = prevReviewTypeRef.current;
    prevReviewActiveRef.current = isReviewActive;
    prevReviewTypeRef.current = reviewType;

    // 1차 복습이 방금 끝났을 때만 2차 시작
    if (wasActive && !isReviewActive && wasType === "primary" && reviewFailedWords.length > 0) {
      startFailedReview(reviewFailedWords);
    }
  }, [isReviewActive, reviewType, reviewFailedWords, startFailedReview]);

  // 비디오 플레이어 훅
  const {
    videoPlaylist, currentVideoIndex, setCurrentVideoIndex,
    videoPlaybackRate, setVideoPlaybackRate, videoVolume, setVideoVolume,
    videoLoop, setVideoLoop, playlistLoop, setPlaylistLoop,
    abRepeat, setAbRepeat, skipSeconds, setSkipSeconds, isDragging,
    videoSourceTab, setVideoSourceTab, youtubeUrl, setYoutubeUrl, youtubeVideoId,
    videoRef, dropZoneRef, videoSrc,
    handleYoutubeUrlSubmit, removeVideoFromPlaylist,
    clearPlaylist, playPreviousVideo, playNextVideo,
    handleDragEnter, handleDragOver, handleDragLeave, handleDrop,
  } = useVideoPlayer(mode);

  // 하이라이트용 상태 (아래칸 hover 시 윗칸 해당 위치 표시)
  const [hoveredOrigIdx, setHoveredOrigIdx] = useState<number | null>(null);

  // 라운드 완료 후 연습용 텍스트
  const [practiceText, setPracticeText] = useState("");

  // 재개 직후 하이라이트 표시용
  const [showResumeHighlight, setShowResumeHighlight] = useState(false);
  const [resumePosition, setResumePosition] = useState(0);
  const prevPositionProgressRef = useRef(0);
  const [positionCycleToast, setPositionCycleToast] = useState<string | null>(null);


  // 드로어 열림/닫힘 상태
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // 단어/문장 모드 라운드 완료 결과
  const [roundCompleteResult, setRoundCompleteResult] = useState<{
    correct: number;
    incorrect: number;
    total: number;
    avgKpm: number;
    avgCpm: number;
  } | null>(null);

  // AI 문장 생성 훅
  const {
    geminiApiKey, setGeminiApiKey, isGenerating, setIsGenerating,
    generatedCount, setGeneratedCount, aiModelName, setAiModelName,
    sentenceStyle, setSentenceStyle, useRandomSentences, setUseRandomSentences,
    selectedModel, setSelectedModel, aiModelNameRef,
    generateError, setGenerateError, generateAbortRef,
    apiCallCount, apiCallModels, incrementApiCallCount,
    setGenerateErrorWithRetry, getErrorMessage,
  } = useAIGeneration();
  const [canGenerateMore, setCanGenerateMore] = useState(false);
  const sentenceTargetCountRef = useRef(0);
  // 문장모드 상태 보존 (모드 전환 시 API 호출 절약)
  const savedSentenceStateRef = useRef<{
    sentences: string[];
    generatedCount: number;
    currentSentenceIndex: number;
    progressCount: number;
    correctCount: number;
    incorrectCount: number;
    incorrectWords: typeof incorrectWords;
    totalCount: number;
  } | null>(null);



  // 저장된 상세설정 복원
  useEffect(() => {
    const saved = localStorage.getItem('detailSettings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.displayFontSize !== undefined) setDisplayFontSize(settings.displayFontSize);
        if (settings.inputFontSize !== undefined) setInputFontSize(settings.inputFontSize);
        if (settings.charsPerRead !== undefined) setCharsPerRead(settings.charsPerRead);
        if (settings.sequentialSpeechRate !== undefined) setSequentialSpeechRate(settings.sequentialSpeechRate);
        if (settings.batchSize !== undefined) setBatchSize(settings.batchSize);
      } catch (e) {
        // 파싱 실패 시 기본값 유지
      }
    }
  }, []);


  // 단어/문장/자리 모드 라운드 완료 감지
  useEffect(() => {
    // 복습 중에는 라운드 완료 방지
    if (isReviewActive) return;
    if (
      ((mode === "words") || mode === "sentences") &&
      isPracticing &&
      totalCount > 0 &&
      progressCount >= totalCount
    ) {
      // 결과 저장 (stopPractice가 리셋하기 전에)
      const avgKpm = allResults.length > 0
        ? Math.round(allResults.reduce((sum, r) => sum + r.kpm, 0) / allResults.length)
        : 0;
      const avgCpm = allResults.length > 0
        ? Math.round(allResults.reduce((sum, r) => sum + r.cpm, 0) / allResults.length)
        : 0;
      setRoundCompleteResult({
        correct: correctCount,
        incorrect: incorrectCount,
        total: totalCount,
        avgKpm,
        avgCpm,
      });
      // 세션 로깅
      if (allResults.length > 0) {
        const totalElapsed = allResults.reduce((sum, r) => sum + r.elapsedTime, 0);
        const total = correctCount + incorrectCount;
        logSession({
          mode,
          totalResults: allResults.length,
          avgKpm,
          avgCpm,
          correctCount,
          incorrectCount,
          accuracy: total > 0 ? (correctCount / total) * 100 : 0,
          totalElapsedTime: totalElapsed,
        });
      }
      // 연습 종료 + 드로어 열기 + 라운드 카운트 증가
      stopPractice();
      resetReview();
      setIsDrawerOpen(true);
      incrementCompletedRounds(practiceSlot, mode, totalCount);
      // 복습 완료 시 복습 상태 해제
      if (isSentenceReview) {
        setIsSentenceReview(false);
      }
    }
  }, [progressCount, totalCount, mode, isPracticing, isReviewActive, isSentenceReview]);

  // 자리모드 자동 반복: 40개 완료 후 즉시 0으로 리셋되므로 완료 횟수를 별도로 반영
  useEffect(() => {
    if (!isPositionMode || !isPracticing || totalCount <= 0) {
      prevPositionProgressRef.current = progressCount;
      return;
    }

    const prev = prevPositionProgressRef.current;
    const justCompletedCycle = prev === totalCount - 1 && progressCount === 0;
    if (justCompletedCycle) {
      incrementCompletedRounds(practiceSlot, "position");
      setPositionCycleToast("사이클 완료! 다음 라운드 시작");
      setTimeout(() => setPositionCycleToast(null), 2000);
    }
    prevPositionProgressRef.current = progressCount;
  }, [isPositionMode, isPracticing, totalCount, progressCount, incrementCompletedRounds, practiceSlot]);


  // 카운트다운 시작 함수
  const startCountdown = (onComplete: () => void) => {
    setCountdown(5);
    let count = 5;

    const tick = () => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        countdownTimerRef.current = setTimeout(tick, 1000);
      } else {
        setCountdown(null);
        onComplete();
      }
    };

    countdownTimerRef.current = setTimeout(tick, 1000);
  };

  // 마지막 10~1글자로 원본에서 가장 정확한 구간 찾기
  const findBestMatchPosition = (typed: string, original: string): number => {
    // 공백 제거
    const typedNoSpace = typed.replace(/\s+/g, '');
    const originalNoSpace = original.replace(/\s+/g, '');

    if (typedNoSpace.length === 0) return 0;

    // 10글자부터 1글자까지 검사하여 완전 일치 구간 찾기
    for (let len = Math.min(10, typedNoSpace.length); len >= 1; len--) {
      const lastChars = typedNoSpace.slice(-len);

      // 원본에서 완전 일치하는 구간 찾기 (뒤에서부터 검색하여 가장 마지막 일치 위치 선택)
      for (let i = originalNoSpace.length - len; i >= 0; i--) {
        const window = originalNoSpace.slice(i, i + len);
        if (window === lastChars) {
          // 완전 일치 발견 - 해당 구간의 끝 위치 (다음 글자 위치) 반환
          return i + len;
        }
      }
    }

    // 완전 일치가 없으면 가장 유사한 구간 찾기 (기존 로직)
    let bestPos = 0;
    let bestScore = 0;
    const searchLen = Math.min(10, typedNoSpace.length);
    const lastChars = typedNoSpace.slice(-searchLen);

    for (let i = 0; i <= originalNoSpace.length - searchLen; i++) {
      const window = originalNoSpace.slice(i, i + searchLen);
      let score = 0;
      for (let j = 0; j < searchLen; j++) {
        if (window[j] === lastChars[j]) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestPos = i + searchLen;
      }
    }

    return bestPos;
  };

  // 라운드 재개 (일시정지에서 이어서)
  const resumeRound = () => {
    // 마지막 10글자로 원본에서 가장 유사한 위치 찾기
    const text = isBatchMode
      ? currentBatchChars
      : randomizedIndices.slice(0, currentDisplayIndex).map(index => sequentialText[index]).join('');

    const bestPos = findBestMatchPosition(typedWord, text);
    setResumePosition(bestPos);
    setShowResumeHighlight(true);

    setIsRoundComplete(false);
    setPracticeText(""); // 연습 텍스트 초기화
    // 타이핑 칸에 포커스하고 커서를 끝으로 이동
    setTimeout(() => {
      const textarea = typingTextareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, 50);
  };

  // 다음 라운드 시작 (카운트다운 포함)
  // completedSlot: 방금 완료한 슬롯 (카운트다운 끝난 후 increment)
  // wasBatchMode: 완료한 라운드가 매매치라 모드였는지
  // nextSlot: 다음에 시작할 슬롯 (지정하지 않으면 selectedSlot 사용)
  const startNextRound = (completedSlot?: number | null, completedModeKey?: string, nextSlot?: number) => {
    // 드로어 닫기
    setIsDrawerOpen(false);
    // 다음 슬롯 설정 (nextSlot이 있으면 사용, 없으면 selectedSlot)
    const targetSlot = nextSlot ?? selectedSlot;
    setPracticeSlot(targetSlot);
    if (nextSlot !== undefined) {
      setSelectedSlot(nextSlot);
    }
    // 카운트다운 중 표시할 방금 완료한 슬롯 설정
    setPendingIncrementSlot(completedSlot ?? null);
    setIsRoundComplete(false);
    setAccumulatedKeystrokes(0);
    setAccumulatedElapsedMs(0);
    setDisplayElapsedTime(0);
    updateTypedWord(""); // 타이핑 칸 초기화
    setPracticeText(""); // 연습 텍스트 초기화
    setShowResumeHighlight(false); // 하이라이트 초기화
    resetBatchAndReviewState();
    // 타수/자수 초기화
    setLastResult({ kpm: 0, cpm: 0, elapsedTime: 0 });
    setAllResults([]);
    startCountdown(() => {
      // 카운트다운 끝난 후 완료 횟수 증가
      if (completedSlot !== undefined && completedSlot !== null) {
        incrementCompletedRounds(completedSlot, completedModeKey ?? "sequential");
      }
      setPendingIncrementSlot(null); // 표시용 상태 초기화
      setRoundStartTime(Date.now());
      restartSequentialPractice();
      // 타이핑 칸에 포커스
      setTimeout(() => typingTextareaRef.current?.focus(), 50);
    });
  };


  const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) =>
    updateInputText(event.target.value);

  const handleTextareaDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    // 텍스트 드래그&드롭 처리
    const droppedText = event.dataTransfer.getData("text/plain");
    if (droppedText) {
      updateInputText(inputText ? inputText + "/" + droppedText : droppedText);
      return;
    }
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      if (text.includes("\uFFFD")) {
        const fallbackReader = new FileReader();
        fallbackReader.onload = (e2) => {
          const text2 = e2.target?.result as string;
          if (text2) updateInputText(text2);
        };
        fallbackReader.readAsText(file, "EUC-KR");
      } else {
        updateInputText(text);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const recordPositionTransition = (
    isCorrect: boolean,
    elapsedMs: number,
    fromChar: string,
    toChar: string,
    stage: PositionStage | "mixed"
  ) => {
    const safeMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? Math.round(elapsedMs) : 0;
    const fromKeys = getPositionKeyIdsForChar(fromChar);
    const toKeys = getPositionKeyIdsForChar(toChar);
    setPositionSamples((prev) => {
      const next = [...prev, { ms: safeMs, correct: isCorrect, at: Date.now(), stage, fromKeys, toKeys, fromChar, toChar }];
      return next.length > POSITION_SAMPLE_LIMIT ? next.slice(next.length - POSITION_SAMPLE_LIMIT) : next;
    });
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isAutoSubmittingRef.current) return; // 자동 제출 직후 IME 잔여 이벤트 무시
    const value = event.target.value;
    updateTypedWord(value);

    // 단어/문장 모드: 입력값이 정답과 일치하면 자동 제출
    // 복습 중이면 복습 단어를 타겟으로 사용
    const autoSubmitTarget =
      isReviewActive && currentReviewTarget
        ? currentReviewTarget.trim()
        : mode === "sentences" && isPracticing && sentences[currentSentenceIndex]
          ? sentences[currentSentenceIndex].trim()
          : isWordLikeMode && isPracticing && shuffledWords[currentWordIndex]
            ? shuffledWords[currentWordIndex].trim()
            : null;

    const isMatch = autoSubmitTarget && !isAutoSubmittingRef.current && (
      isWordLikeMode || isReviewActive
        ? value.replace(/\s+/g, '').endsWith(autoSubmitTarget.replace(/\s+/g, '')) && autoSubmitTarget.replace(/\s+/g, '').length > 0
        : value.trim() === autoSubmitTarget
    );
    if (isMatch) {
      isAutoSubmittingRef.current = true;
      // 타수/자수 계산
      const elapsedMs = (currentWordStartTime && currentWordKeystrokes > 0) ? Date.now() - currentWordStartTime : 0;
      if (elapsedMs >= 100) {
        const elapsedMinutes = elapsedMs / 1000 / 60;
        const kpm = Math.min(3000, Math.round(currentWordKeystrokes / elapsedMinutes));
        const charCount = value.trim().replace(/\s+/g, '').length;
        const cpm = Math.min(3000, Math.round(charCount / elapsedMinutes));
        setLastResult({ kpm, cpm, elapsedTime: elapsedMs });
        setAllResults(prev => [...prev, { kpm, cpm, elapsedTime: elapsedMs, chars: '' }]);
        logResult({ mode, kpm, cpm, elapsedTime: elapsedMs });
      }
      if (isReviewActive) {
        // 복습 모드: 복습 제출 + 숙련도 기록
        const reviewTarget = autoSubmitTarget;
        const reviewCorrect = handleReviewSubmit(value);
        recordResult(reviewTarget, reviewCorrect);
        if (!reviewCorrect && reviewType === "primary") {
          setReviewFailedWords(prev => [...prev, { word: reviewTarget, typed: value.trim() }]);
        }
        if (reviewCorrect && reviewType === "failed") {
          setReviewFailedWords(prev => prev.filter(item => item.word !== reviewTarget));
        }
        updateTypedWord("");
      } else {
        // 일반 모드: 제출 + 숙련도 기록 + 복습 체크
        const target = isWordLikeMode ? shuffledWords[currentWordIndex] : autoSubmitTarget;
        const targetClean = target.replace(/\s+/g, '');
        const inputClean = value.replace(/\s+/g, '');
        const isCorrect = isWordLikeMode
          ? inputClean.endsWith(targetClean) && targetClean.length > 0
          : value.trim() === autoSubmitTarget;
        submitAnswer(value);
        if (isPositionMode) {
          const fromChar = currentWordIndex > 0 ? shuffledWords[currentWordIndex - 1] : "";
          const toChar = shuffledWords[currentWordIndex] || "";
          recordPositionTransition(isCorrect, elapsedMs, fromChar, toChar, currentPositionSampleStage);
        }
        if (mode === "words") {
          recordResult(targetClean, isCorrect);
          const nextProgress = progressCount + 1;
          checkAndStartReview(nextProgress, isCorrect ? incorrectWords : [...incorrectWords, { word: targetClean, typed: value.trim() }], totalCount);
        }
      }
      resetCurrentWordTracking();
      // IME의 후속 onChange 이벤트가 중복 제출하지 않도록 잠시 가드
      setTimeout(() => { isAutoSubmittingRef.current = false; }, 50);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isPositionMode && isPracticing && event.key === " ") {
      event.preventDefault();
      if (!activeSingleStage) return;
      const currentChar = shuffledWords[currentWordIndex] ?? "";
      if (!currentChar) return;
      const isAlreadyExcluded = activeStageExcludedChars.includes(currentChar);
      if (isAlreadyExcluded) {
        removePositionExcludedChar(activeSingleStage, currentChar);
        regeneratePositionQueueFromCurrent();
      } else {
        addPositionExcludedChar(activeSingleStage, currentChar);
        // 현재 문제도 바로 교체되도록 현재 인덱스부터 재생성
        regeneratePositionQueueFromCurrent();
      }
      return;
    }

    if (event.key === "Enter") {
      // 연습 시작 전 99+엔터: 원문이 있는 슬롯 중 랜덤으로 연습 시작
      if (!isPracticing && typedWord.trim() === "99") {
        event.preventDefault();
        const slotsWithText: number[] = [];
        // 즐겨찾기가 있으면 즐겨찾기 중에서만, 없으면 전체에서 선택
        const targetSlots = favoriteSlots.size > 0 ? [...favoriteSlots] : Array.from({ length: 20 }, (_, i) => i + 1);
        for (const i of targetSlots) {
          const savedText = localStorage.getItem(`slot_${i}`);
          // 현재 슬롯 제외
          if (savedText && savedText.trim().length > 0 && i !== selectedSlot) {
            slotsWithText.push(i);
          }
        }
        if (slotsWithText.length > 0) {
          const randomSlot = slotsWithText[Math.floor(Math.random() * slotsWithText.length)];
          const savedText = localStorage.getItem(`slot_${randomSlot}`);
          if (savedText) {
            updateInputText(savedText);
            updateTypedWord("");
            setSelectedSlot(randomSlot);
            // 연습 시작
            const words = savedText.split(/\s+/).filter((w) => w.length > 0);
            if (words.length > 0) {
              setPracticeSlot(randomSlot);
              setIsDrawerOpen(false);
              if (mode === "longtext") {
                setRoundStartTime(Date.now());
                startPractice(words);
                setTimeout(() => typingTextareaRef.current?.focus(), 50);
              } else if (mode === "sequential" || mode === "random") {
                startCountdown(() => {
                  setRoundStartTime(Date.now());
                  startPractice(words);
                  setTimeout(() => typingTextareaRef.current?.focus(), 50);
                });
              } else {
                startPractice(words);
                setTimeout(() => wordInputRef.current?.focus(), 50);
              }
            }
          }
        }
        return;
      }

      // 보고치라/긴글/랜덤 모드에서는 다른 처리
      if ((mode === "sequential" || mode === "longtext" || mode === "random") && isPracticing) {
        event.preventDefault();

        // 라운드 완료/일시정지 상태에서 엔터 처리
        if (isRoundComplete) {
          // 매매치라 모드: 복습 5/5 완료 전에는 무조건 재개
          if (isBatchMode) {
            if (isBatchReviewDone) {
              const slotNum = parseInt(typedWord.trim());
              if (slotNum >= 1 && slotNum <= 20) {
                const savedText = localStorage.getItem(`slot_${slotNum}`);
                if (savedText) {
                  updateInputText(savedText);
                }
                setSelectedSlot(slotNum);
                startNextRound(practiceSlot, "batch");
                return;
              }
              startNextRound(practiceSlot, "batch");
            } else {
              resumeRound();
            }
            return;
          }
          // 보고치라 모드
          if (mode === "sequential") {
            if (isFullyComplete) {
              startNextRound(practiceSlot, "sequential");
            } else {
              resumeRound();
            }
            return;
          }
          // 긴글 모드
          if (mode === "longtext") {
            if (isFullyComplete) {
              startNextRound(practiceSlot, "longtext");
            } else {
              resumeRound();
            }
            return;
          }
          // 랜덤 모드
          if (mode === "random") {
            if (isFullyComplete) {
              startNextRound(practiceSlot, "random");
            } else {
              resumeRound();
            }
            return;
          }
          return;
        }

        // 결과 계산 (누적 값 포함)
        const currentElapsedMs = currentWordStartTime ? Date.now() - currentWordStartTime : 0;
        const totalKeystrokes = accumulatedKeystrokes + currentWordKeystrokes;
        const totalElapsedMs = accumulatedElapsedMs + currentElapsedMs;

        // 0.1초(100ms) 이상 경과하면 계산
        if (totalElapsedMs >= 100 && totalKeystrokes > 0) {
          const totalElapsedMinutes = totalElapsedMs / 1000 / 60;
          const kpm = Math.min(3000, Math.round(totalKeystrokes / totalElapsedMinutes));
          const charCount = typedWord.trim().replace(/\s+/g, '').length;
          const cpm = Math.min(3000, Math.round(charCount / totalElapsedMinutes));
          setLastResult({ kpm, cpm, elapsedTime: totalElapsedMs });
          setAllResults(prev => [...prev, { kpm, cpm, elapsedTime: totalElapsedMs, chars: '' }]);
          // Google Sheets 로깅
          logResult({ mode, kpm, cpm, elapsedTime: totalElapsedMs });
        }

        // 누적 값 업데이트
        setAccumulatedKeystrokes(totalKeystrokes);
        setAccumulatedElapsedMs(totalElapsedMs);
        resetCurrentWordTracking();
        // 첫 번째 엔터: 결과만 보여주고 대기 (라운드 완료 상태로 전환)
        setIsRoundComplete(true);
        // 드로어는 라운드 완료 시에만 열기 (일시정지 시에는 닫힌 상태 유지)
        return;
      }

      // 기존 모드에서의 엔터 처리
      let elapsedMs = 0;
      if (currentWordStartTime && currentWordKeystrokes > 0) {
        elapsedMs = Date.now() - currentWordStartTime;

        // 0.1초(100ms) 이상 경과하면 계산
        if (elapsedMs >= 100) {
          const elapsedMinutes = elapsedMs / 1000 / 60;
          const kpm = Math.min(3000, Math.round(currentWordKeystrokes / elapsedMinutes));
          const charCount = typedWord.trim().replace(/\s+/g, '').length;
          const cpm = Math.min(3000, Math.round(charCount / elapsedMinutes));
          setLastResult({ kpm, cpm, elapsedTime: elapsedMs });
          setAllResults(prev => [...prev, { kpm, cpm, elapsedTime: elapsedMs, chars: '' }]);
          // Google Sheets 로깅
          logResult({ mode, kpm, cpm, elapsedTime: elapsedMs });
        }
      }

      // 복습 중 + 단어모드 → 복습 제출
      if (isReviewActive && mode === "words") {
        const reviewTarget = currentReviewTarget?.replace(/\s+/g, '') || '';
        const reviewCorrect = handleReviewSubmit(typedWord);
        if (reviewTarget) {
          recordResult(reviewTarget, reviewCorrect);
          if (!reviewCorrect && reviewType === "primary") {
            setReviewFailedWords(prev => [...prev, { word: reviewTarget, typed: typedWord.trim() }]);
          }
          if (reviewCorrect && reviewType === "failed") {
            setReviewFailedWords(prev => prev.filter(item => item.word !== reviewTarget));
          }
        }
        resetCurrentWordTracking();
        updateTypedWord("");
        return;
      }

      // 일반 제출
      if (mode === "words" || isPositionMode) {
        const target = shuffledWords[currentWordIndex];
        const targetClean = target.replace(/\s+/g, '');
        const inputClean = typedWord.replace(/\s+/g, '');
        const isCorrect = inputClean.endsWith(targetClean) && targetClean.length > 0;
        if (mode === "words") {
          recordResult(targetClean, isCorrect);
        }
        if (isPositionMode) {
          const fromChar = currentWordIndex > 0 ? shuffledWords[currentWordIndex - 1] : "";
          const toChar = shuffledWords[currentWordIndex] || "";
          recordPositionTransition(isCorrect, elapsedMs, fromChar, toChar, currentPositionSampleStage);
        }
      }
      submitAnswer(typedWord);
      if (mode === "words") {
        const nextProgress = progressCount + 1;
        const target = shuffledWords[currentWordIndex];
        const targetClean = target.replace(/\s+/g, '');
        const inputClean = typedWord.replace(/\s+/g, '');
        const isCorrect = inputClean.endsWith(targetClean) && targetClean.length > 0;
        checkAndStartReview(nextProgress, isCorrect ? incorrectWords : [...incorrectWords, { word: targetClean, typed: typedWord.trim() }], totalCount);
      }
      resetCurrentWordTracking(); // 다음 단어를 위해 리셋
      return;
    }

    // 실제 문자 입력 키만 카운트
    // 수정자 키(Ctrl, Alt, Meta), 방향키, 기능키 등은 제외
    const excludedKeys = [
      'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'PageUp', 'PageDown', 'Insert',
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
    ];

    // Ctrl, Alt, Meta와 함께 누른 조합키는 제외 (Ctrl+C, Ctrl+V 등)
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    // 제외된 키가 아니면 타수 증가 (Backspace, Delete, Space 포함)
    if (!excludedKeys.includes(event.key)) {
      // 보고치라/긴글/랜덤 모드에서 라운드 완료 상태일 때 타이핑 시작하면 자동으로 재개
      if ((mode === "sequential" || mode === "longtext" || mode === "random") && isRoundComplete) {
        setIsRoundComplete(false);
      }

      // 첫 번째 키 입력 시 타이머 시작 (공백은 무시 — '. ' 약어 패턴의 잔여 스페이스 방지)
      if (!currentWordStartTime) {
        if (event.key === ' ' || event.key === 'Backspace' || event.key === 'Delete') return;
        startCurrentWordTracking();
        setDisplayElapsedTime(0);
      }
      incrementCurrentWordKeystrokes();
    }
  };


  const generateMoreSentences = async (
    words: string[],
    targetCount: number,
    alreadyGenerated: number,
    isAppending: boolean,
    batchSize = 2500,
  ) => {
    setGenerateError(null);
    setIsGenerating(true);
    setCanGenerateMore(false);
    sentenceTargetCountRef.current = targetCount;
    if (!isAppending) {
      setGeneratedCount(0);
    }
    const abortController = new AbortController();
    generateAbortRef.current = abortController;
    let totalGenerated = alreadyGenerated;
    let started = isAppending;

    const remaining = targetCount - totalGenerated;
    if (remaining <= 0) {
      setIsGenerating(false);
      generateAbortRef.current = null;
      setTotalCount(totalGenerated);
      return;
    }

    const batchCount = Math.min(batchSize, remaining);

    try {
      await generateSentencesStream(
        words,
        batchCount,
        geminiApiKey,
        sentenceStyle,
        (sentence, _index) => {
          totalGenerated++;
          setGeneratedCount(totalGenerated);
          if (!started) {
            started = true;
            setSentences([sentence]);
            startPractice(words);
          } else {
            addSentence(sentence);
          }
        },
        async (_batchTotal) => {
          setIsGenerating(false);
          generateAbortRef.current = null;
          setTotalCount(totalGenerated);
          if (totalGenerated < targetCount || useRandomSentences) {
            setCanGenerateMore(true);
          }
        },
        (error) => {
          setGenerateErrorWithRetry(error);
          setIsDrawerOpen(true);
          setIsGenerating(false);
          generateAbortRef.current = null;
          if (totalGenerated > 0) setTotalCount(totalGenerated);
        },
        (model) => { aiModelNameRef.current = model; setAiModelName(model); incrementApiCallCount(); },
        abortController.signal,
        selectedModel,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setGenerateErrorWithRetry(err instanceof Error ? err.message : "문장 생성에 실패했습니다.");
      setIsDrawerOpen(true);
      setIsGenerating(false);
      generateAbortRef.current = null;
      if (totalGenerated > 0) setTotalCount(totalGenerated);
    }
  };

  const handleStartOrStopPractice = async () => {
    // 생성 중에 클릭하면 생성만 중지하고 기존 문장으로 계속 연습
    if (isGenerating) {
      generateAbortRef.current?.abort();
      generateAbortRef.current = null;
      setIsGenerating(false);
      if (generatedCount > 0) {
        setTotalCount(generatedCount);
      }
      return;
    }
    // 카운트다운 중이거나 연습 중이면 중지
    if (isPracticing || countdown !== null) {
      window.speechSynthesis.cancel();
      clearAllTimeouts();
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
      setRoundStartTime(null);
      setIsRoundComplete(false);
      setAccumulatedKeystrokes(0);
      setAccumulatedElapsedMs(0);
      setDisplayElapsedTime(0);
      resetCurrentWordTracking();
      resetBatchAndReviewState();
      // Google Sheets 세션 로깅
      if (allResults.length > 0) {
        const totalKpm = allResults.reduce((sum, r) => sum + r.kpm, 0);
        const totalCpm = allResults.reduce((sum, r) => sum + r.cpm, 0);
        const totalElapsed = allResults.reduce((sum, r) => sum + r.elapsedTime, 0);
        const total = correctCount + incorrectCount;
        logSession({
          mode,
          totalResults: allResults.length,
          avgKpm: totalKpm / allResults.length,
          avgCpm: totalCpm / allResults.length,
          correctCount,
          incorrectCount,
          accuracy: total > 0 ? (correctCount / total) * 100 : 0,
          totalElapsedTime: totalElapsed,
        });
      }
      stopPractice();
      resetReview();
      // 드로어 열기
      setIsDrawerOpen(true);
      // 타이핑칸에 포커스
      setTimeout(() => typingTextareaRef.current?.focus(), 50);
    } else {
      const parsedWords = inputText.trim().split("/").filter(Boolean);
      const words = isPositionMode ? (parsedWords.length > 0 ? parsedWords : ["자리"]) : parsedWords;
      if (words.length > 0) {
        // 이전 라운드 결과 초기화
        setRoundCompleteResult(null);
        resetBatchAndReviewState();
        // 연습 시작 시 현재 슬롯 저장
        setPracticeSlot(selectedSlot);
        // 드로어 닫기
        setIsDrawerOpen(false);
        if (mode === "longtext" || mode === "sequential" || mode === "random") {
          // 보고치라/랜덤 모드: 카운트다운 후 시작
          startCountdown(() => {
            setRoundStartTime(Date.now());
            startPractice(words);
            // 타이핑 칸에 포커스
            setTimeout(() => typingTextareaRef.current?.focus(), 50);
          });
        } else if (mode === "sentences") {
          // 저장된 문장이 있으면 API 호출 없이 바로 사용
          if (savedSentenceStateRef.current) {
            restoreSentenceState();
          } else {
            if (!geminiApiKey) {
              setGenerateError("문장 모드를 사용하려면 API 키를 입력하세요.");
              setIsDrawerOpen(true);
              return;
            }
            // 문장 모드: AI 문장 스트리밍 생성 (배치 분할)
            setIsSentenceReview(false);
            setSentences([]);
            setGenerateError(null);
            setIsGenerating(true);
            setGeneratedCount(0);
            setAiModelName("");
            const abortController = new AbortController();
            generateAbortRef.current = abortController;
            const sentenceWords = useRandomSentences ? [] : words;
            const targetCount = useRandomSentences ? 2500 : words.length;
            const BATCH_SIZE = 2500;
            generateMoreSentences(sentenceWords, targetCount, 0, false, BATCH_SIZE);
          }
        } else {
          // 단어 모드
          startPractice(words);
          setTimeout(() => wordInputRef.current?.focus(), 50);
        }
      }
    }
  };


  const handleSaveDetailSettings = () => {
    const settings = {
      displayFontSize,
      inputFontSize,
      charsPerRead,
      sequentialSpeechRate,
      batchSize,
    };
    localStorage.setItem('detailSettings', JSON.stringify(settings));
    alert('상세설정이 기본값으로 저장되었습니다');
  };

  const handleLoadPreset = (slot: number) => {
    // 진행 중일 때는 슬롯 변경 불가 (라운드 완료 상태에서는 허용)
    if ((isPracticing && !isRoundComplete) || countdown !== null) {
      return;
    }
    setSelectedSlot(slot);
    const saved = localStorage.getItem(`slot_${slot}`);

    if (saved) {
      updateInputText(saved);
    } else {
      // 기본값 사용
      switch (slot) {
        case 1:
          updateInputText(savedText1);
          break;
        case 2:
          updateInputText(savedText2);
          break;
        case 3:
        case 4:
        case 5:
          updateInputText(savedText5);
          break;
        default:
          updateInputText("");
          break;
      }
    }
  };

  useEffect(() => {
    if (!isPracticing) return;

    if (mode === "sequential" || mode === "longtext" || mode === "random") {
      // 라운드 완료 상태면 글자 표시 멈춤
      if (isRoundComplete) return;

      // 카운트다운 중이면 글자 표시 안 함 (새 라운드 데이터 준비 전)
      if (countdown !== null) return;

      // 매매치라 모드: batchSize만큼 한번에 표시
      if (isBatchMode) {
        // 복습 모드일 경우
        if (isReviewMode && currentBatchChars === "") {
          const reviewChars = reviewBatches[reviewIndex];
          if (reviewChars) {
            setCurrentBatchChars(reviewChars);
            if (isSoundEnabled) {
              speakText(reviewChars, true);
            }
          }
          return;
        }

        if (!isReviewMode && batchStartIndex < randomizedIndices.length && currentBatchChars === "") {
          // 현재 배치의 글자들 계산
          const endIndex = Math.min(batchStartIndex + batchSize, randomizedIndices.length);
          let batchIndices = randomizedIndices.slice(batchStartIndex, endIndex);
          // 마지막 배치가 batchSize보다 적으면 랜덤 글자로 채움
          let randomFill = 0;
          if (batchIndices.length < batchSize && batchIndices.length > 0) {
            const shortage = batchSize - batchIndices.length;
            randomFill = shortage;
            const allIndices = Array.from({ length: sequentialText.length }, (_, i) => i);
            for (let i = 0; i < shortage; i++) {
              const randIdx = allIndices[Math.floor(Math.random() * allIndices.length)];
              batchIndices.push(randIdx);
            }
          }
          setBatchRandomFillCount(randomFill);
          const batchChars = batchIndices
            .map(idx => sequentialText[idx])
            .join('');
          setCurrentBatchChars(batchChars);
          updateTypedWord(""); // 새 배치 시작 시 타이핑 칸 비우기

          // 소리 재생
          if (isSoundEnabled && batchChars) {
            speakText(batchChars, true);
          }
        }
        return;
      }

      // 보고치라/랜덤 모드: 랜덤 순서로 한 글자씩 표시
      if (currentDisplayIndex < randomizedIndices.length) {
        sequentialTimerRef.current = setTimeout(() => {
          const nextCharIndex = randomizedIndices[currentDisplayIndex];
          addDisplayedCharIndex(nextCharIndex);

          incrementDisplayIndex();

          // 설정된 글자 수마다 또는 마지막 글자일 때 소리 재생
          const newDisplayIndex = currentDisplayIndex + 1;
          if (isSoundEnabled && (newDisplayIndex % charsPerRead === 0 || newDisplayIndex === randomizedIndices.length)) {
            // 마지막 N글자(또는 남은 글자)를 모아서 읽어줌
            const startIdx = Math.max(0, newDisplayIndex - charsPerRead);
            const textToSpeak = randomizedIndices
              .slice(startIdx, newDisplayIndex)
              .map(idx => sequentialText[idx])
              .join('');
            if (textToSpeak) {
              speakText(textToSpeak, true);
            }
          }
        }, sequentialSpeed);
      }

      return () => {
        if (sequentialTimerRef.current) {
          clearTimeout(sequentialTimerRef.current);
        }
      };
    } else {
      // 기존 모드: 음성 재생
      if (isWordLikeMode && shuffledWords.length > 0) {
        speakText(shuffledWords[currentWordIndex]);
      } else if (mode === "sentences" && sentences.length > 0) {
        speakText(sentences[currentSentenceIndex]);
      }
    }
  }, [isPracticing, mode, currentWordIndex, currentSentenceIndex, currentLetterIndex, speechRate, currentDisplayIndex, randomizedIndices, sequentialSpeed, isSoundEnabled, sequentialText, charsPerRead, isRoundComplete, isBatchMode, batchSize, batchStartIndex, currentBatchChars, isReviewMode, reviewBatches, reviewIndex, countdown]);

  // 매매치라 모드: 타이핑 확인 및 다음 배치로 이동
  useEffect(() => {
    if (!isPracticing || !isBatchMode || isRoundComplete) return;
    if (currentBatchChars === "") return;

    // 띄어쓰기 제거하고 비교 (마지막에 제시어가 정확히 나오면 정답)
    const typedClean = typedWord.replace(/\s+/g, '');
    const targetClean = currentBatchChars.replace(/\s+/g, '');

    if (typedClean.endsWith(targetClean) && targetClean.length > 0) {
      // 타수/자수 계산 (일시정지 누적값 포함)
      const currentElapsedMs = currentWordStartTime ? Date.now() - currentWordStartTime : 0;
      const totalKeystrokes = accumulatedKeystrokes + currentWordKeystrokes;
      const totalElapsedMs = accumulatedElapsedMs + currentElapsedMs;

      if (totalElapsedMs >= 100 && totalKeystrokes > 0) {
        const totalElapsedMinutes = totalElapsedMs / 1000 / 60;
        const kpm = Math.min(3000, Math.round(totalKeystrokes / totalElapsedMinutes));
        const charCount = typedClean.length;
        const cpm = Math.min(3000, Math.round(charCount / totalElapsedMinutes));
        setLastResult({ kpm, cpm, elapsedTime: totalElapsedMs });
        // 복습 모드가 아닐 때만 결과 저장 (복습 모드에서는 저장 안 함)
        if (!isReviewMode) {
          setAllResults(prev => [...prev, { kpm, cpm, elapsedTime: totalElapsedMs, chars: currentBatchChars }]);
          // Google Sheets 로깅
          logResult({ mode, kpm, cpm, elapsedTime: totalElapsedMs, chars: currentBatchChars });
        }
      }
      // 누적값 초기화
      setAccumulatedKeystrokes(0);
      setAccumulatedElapsedMs(0);
      resetCurrentWordTracking();

      // 복습 모드일 경우
      if (isReviewMode) {
        const nextReviewIndex = reviewIndex + 1;
        if (nextReviewIndex >= reviewBatches.length) {
          // 복습 완료 - 진짜 라운드 완료
          setIsReviewMode(false);
          setReviewBatches([]);
          setReviewIndex(0);
          setIsBatchReviewDone(true);
          setIsRoundComplete(true);
          setIsDrawerOpen(true);
        } else {
          // 다음 복습 배치
          setReviewIndex(nextReviewIndex);
          setCurrentBatchChars("");
          updateTypedWord("");
        }
        return;
      }

      // 정답! 다음 배치로 이동
      const nextBatchStart = batchStartIndex + batchSize;

      if (nextBatchStart >= randomizedIndices.length) {
        // 모든 글자 완료 - 시간 많이 걸린 5개 복습 시작
        // allResults에서 시간 기준 내림차순 정렬 후 상위 5개 추출
        // 참고: 방금 저장한 결과는 아직 allResults에 반영 안 됨, prev로 접근
        setAllResults(prev => {
          const sorted = [...prev].sort((a, b) => b.elapsedTime - a.elapsedTime);
          const top5 = sorted.slice(0, 5).map(r => r.chars).filter(c => c.length > 0);
          if (top5.length > 0) {
            // setTimeout으로 상태 업데이트 분리 (React batching 이슈 방지)
            setTimeout(() => {
              setReviewBatches(top5);
              setReviewIndex(0);
              setIsReviewMode(true);
              setBatchRandomFillCount(0);
              setCurrentBatchChars("");
              updateTypedWord("");
            }, 0);
          } else {
            // 결과가 없으면 바로 라운드 완료
            setTimeout(() => {
              setIsRoundComplete(true);
              setIsDrawerOpen(true);
            }, 0);
          }
          return prev;
        });
      } else {
        // 다음 배치 준비
        setBatchStartIndex(nextBatchStart);
        setCurrentBatchChars("");
        updateTypedWord("");
      }
    }
  }, [typedWord, currentBatchChars, isPracticing, isBatchMode, batchStartIndex, batchSize, randomizedIndices.length, isRoundComplete, currentWordStartTime, currentWordKeystrokes, accumulatedKeystrokes, accumulatedElapsedMs, isReviewMode, reviewIndex, reviewBatches]);

  // 연습 종료 시 결과 초기화
  useEffect(() => {
    if (!isPracticing && countdown === null) {
      setLastResult({ kpm: 0, cpm: 0, elapsedTime: 0 });
      setAllResults([]);
    }
  }, [isPracticing, countdown]);

  // 실시간 경과 시간 업데이트
  useEffect(() => {
    if (!isPracticing || countdown !== null || isRoundComplete) {
      return;
    }

    const interval = setInterval(() => {
      if (currentWordStartTime) {
        const currentMs = Date.now() - currentWordStartTime;
        const totalMs = accumulatedElapsedMs + currentMs;
        setDisplayElapsedTime(totalMs);
      }
    }, 10);

    return () => clearInterval(interval);
  }, [isPracticing, countdown, isRoundComplete, currentWordStartTime, accumulatedElapsedMs]);

  // 원문 표시 영역 자동 스크롤 (새 글자가 나올 때 아래로)
  useEffect(() => {
    if (displayAreaRef.current && isPracticing && !isRoundComplete) {
      displayAreaRef.current.scrollTop = displayAreaRef.current.scrollHeight;
    }
  }, [currentDisplayIndex, isPracticing, isRoundComplete]);


  // ESC 키로 연습 시작/종료
  const handleStartOrStopRef = useRef(handleStartOrStopPractice);
  handleStartOrStopRef.current = handleStartOrStopPractice;

  useEffect(() => {
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleStartOrStopRef.current();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // 평균 계산 (JSX에서 여러 번 참조되므로 useMemo로 1회만 계산)
  const averageResult = useMemo(() => {
    if (allResults.length === 0) return { avgKpm: 0, avgCpm: 0, avgTime: 0 };
    const totalKpm = allResults.reduce((sum, result) => sum + result.kpm, 0);
    const totalCpm = allResults.reduce((sum, result) => sum + result.cpm, 0);
    const totalTime = allResults.reduce((sum, result) => sum + result.elapsedTime, 0);
    return {
      avgKpm: Math.round(totalKpm / allResults.length),
      avgCpm: Math.round(totalCpm / allResults.length),
      avgTime: Math.round(totalTime / allResults.length)
    };
  }, [allResults]);

  // 윗칸에 표시된 글자
  const displayedText = useMemo((): string => {
    if (isBatchMode) {
      return currentBatchChars;
    }
    // 보고치라/긴글 모드: 인덱스 순서대로 표시 (긴글은 순차, 보고치라는 랜덤)
    return randomizedIndices.slice(0, currentDisplayIndex).map(index => sequentialText[index]).join('');
  }, [isBatchMode, currentBatchChars, randomizedIndices, currentDisplayIndex, sequentialText]);

  // 타이핑한 위치까지의 원문 (마지막 10~1글자 매칭으로 찾기)
  const scoringOriginalText = useMemo((): string => {
    if (!isRoundComplete || typedWord.length === 0) return '';

    const displayedClean = displayedText.replace(/\s+/g, '');
    const typedClean = typedWord.replace(/\s+/g, '');

    if (typedClean.length === 0) return '';

    // 마지막 10~1글자로 원문에서 위치 찾기
    for (let len = Math.min(10, typedClean.length); len >= 1; len--) {
      const lastChars = typedClean.slice(-len);

      // 원문에서 뒤에서부터 검색
      for (let i = displayedClean.length - len; i >= 0; i--) {
        const window = displayedClean.slice(i, i + len);
        if (window === lastChars) {
          // 해당 위치까지의 원문 반환
          return displayedClean.slice(0, i + len);
        }
      }
    }

    // 찾지 못하면 전체 원문 반환
    return displayedClean;
  }, [isRoundComplete, displayedText, typedWord]);

  // 색상 마킹 (일시정지/완료 시에만) - 타이핑한 위치까지만 비교
  const markedText = useMemo((): FullMarkedChar[] => {
    if ((mode !== "sequential" && mode !== "longtext") || !isRoundComplete || typedWord.length === 0) {
      return [];
    }
    return getFullMarkedText(scoringOriginalText, typedWord);
  }, [mode, isRoundComplete, scoringOriginalText, typedWord]);

  // 채점 결과 (일시정지/완료 시에만) - 타이핑한 위치까지만 비교
  const scoringResult = useMemo((): ScoringResult | null => {
    if ((mode !== "sequential" && mode !== "longtext") || !isRoundComplete || typedWord.length === 0) {
      return null;
    }
    return analyzeScoring(scoringOriginalText, typedWord);
  }, [mode, isRoundComplete, scoringOriginalText, typedWord]);

  // 윗칸 (원문) 색상 마킹 (일시정지/완료 시에만) - 타이핑한 위치까지만 비교
  const markedOriginalText = useMemo((): MarkedChar[] => {
    if ((mode !== "sequential" && mode !== "longtext") || !isRoundComplete || !scoringResult) {
      return [];
    }
    return getMarkedText(scoringOriginalText, scoringResult);
  }, [mode, isRoundComplete, scoringOriginalText, scoringResult]);

  // 라운드가 진짜 완료인지 (마지막 10~1글자 일치 확인)
  const isFullyComplete = useMemo((): boolean => {
    if (!isRoundComplete) return false;

    // 매매치라 모드: 복습까지 완전히 끝났을 때만 다음 라운드
    if (isBatchMode) {
      return isBatchReviewDone;
    }

    const displayedClean = displayedText.replace(/\s+/g, '');
    const typedClean = typedWord.replace(/\s+/g, '');

    // 최소 길이 체크 (원문의 50% 이상은 쳐야 함)
    if (typedClean.length < displayedClean.length * 0.5) return false;

    // 마지막 10~1글자 중 하나라도 일치하면 완료
    for (let len = Math.min(10, displayedClean.length); len >= 1; len--) {
      const originalEnd = displayedClean.slice(-len);
      const typedEnd = typedClean.slice(-len);
      if (originalEnd === typedEnd) {
        return true;
      }
    }
    return false;
  }, [isRoundComplete, displayedText, typedWord, isBatchMode, isBatchReviewDone]);

  // 라운드 완료 시에만 드로어 열기 (일시정지 시에는 닫힌 상태 유지)
  useEffect(() => {
    if (isFullyComplete) {
      setIsDrawerOpen(true);
    }
  }, [isFullyComplete]);

  // 문장모드 상태 저장 (다른 모드로 전환 시)
  const saveSentenceState = () => {
    if (mode === "sentences" && sentences.length > 0) {
      savedSentenceStateRef.current = {
        sentences: [...sentences],
        generatedCount,
        currentSentenceIndex,
        progressCount,
        correctCount,
        incorrectCount,
        incorrectWords: [...incorrectWords],
        totalCount,
      };
    }
  };


  // 배치/복습 상태 초기화
  const resetBatchAndReviewState = () => {
    setBatchStartIndex(0);
    setCurrentBatchChars("");
    setIsReviewMode(false);
    setReviewBatches([]);
    setReviewIndex(0);
    setIsBatchReviewDone(false);
  };

  // 모드 전환 시 정리 (연습 중이면 중지 + 배치/복습 초기화 + UI 초기화)
  const cleanupForModeSwitch = () => {
    setRoundCompleteResult(null);
    if (isPracticing || countdown !== null) {
      stopPractice();
      resetReview();
      resetBatchAndReviewState();
      setIsRoundComplete(false);
      setCountdown(null);
      setIsDrawerOpen(true);
    }
  };

  // 문장모드 상태 복원 (문장모드로 돌아올 때)
  const restoreSentenceState = () => {
    const saved = savedSentenceStateRef.current;
    if (saved) {
      setGeneratedCount(saved.generatedCount);
      resumeSentencePractice({
        sentences: saved.sentences,
        currentSentenceIndex: saved.currentSentenceIndex,
        progressCount: saved.progressCount,
        correctCount: saved.correctCount,
        incorrectCount: saved.incorrectCount,
        incorrectWords: saved.incorrectWords,
        totalCount: saved.totalCount,
      });
    }
  };

  return (
    <div className="p-4 w-full">
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">Stenosaurus</h1>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded ${
              mode === "position" ? "bg-blue-500 text-white" : "bg-gray-300"
            }`}
            onClick={() => {
              saveSentenceState();
              cleanupForModeSwitch();
              switchMode("position");
            }}
          >
            자리
          </button>
          <button
            className={`px-4 py-2 rounded ${
              mode === "words" ? "bg-blue-500 text-white" : "bg-gray-300"
            }`}
            onClick={() => {
              saveSentenceState();
              cleanupForModeSwitch();
              switchMode("words");
            }}
          >
            단어
          </button>
          <button
            className={`px-4 py-2 rounded ${
              mode === "sentences" ? "bg-blue-500 text-white" : "bg-gray-300"
            }`}
            onClick={() => {
              cleanupForModeSwitch();
              switchMode("sentences");
              restoreSentenceState();
            }}
          >
            문장
          </button>
          <button
            className={`px-4 py-2 rounded ${
              mode === "longtext" ? "bg-blue-500 text-white" : "bg-gray-300"
            }`}
            onClick={() => {
              saveSentenceState();
              cleanupForModeSwitch();
              switchMode("longtext");
            }}
          >
            긴 글
          </button>
          <button
            className={`px-4 py-2 rounded ${
              mode === "sequential" && isBatchMode ? "bg-blue-500 text-white" : "bg-gray-300"
            }`}
            onClick={() => {
              saveSentenceState();
              if (!isBatchMode || mode !== "sequential") {
                stopPractice();
      resetReview();
                resetBatchAndReviewState();
                setIsRoundComplete(false);
              }
              switchMode("sequential");
              setIsBatchMode(true);
            }}
          >
            매매 치라
          </button>
          <button
            className={`px-4 py-2 rounded ${
              mode === "sequential" && !isBatchMode ? "bg-blue-500 text-white" : "bg-gray-300"
            }`}
            onClick={() => {
              saveSentenceState();
              if (isBatchMode || mode !== "sequential") {
                stopPractice();
      resetReview();
                resetBatchAndReviewState();
                setIsRoundComplete(false);
              }
              switchMode("sequential");
              setIsBatchMode(false);
            }}
          >
            보고 치라
          </button>
          <button
            className={`px-4 py-2 rounded ${
              mode === "random" ? "bg-blue-500 text-white" : "bg-gray-300"
            }`}
            onClick={() => {
              saveSentenceState();
              cleanupForModeSwitch();
              switchMode("random");
            }}
          >
            듣고 치라
          </button>
        </div>
        {user ? (
          <button
            onClick={signOut}
            className="ml-auto px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
          >
            로그아웃
          </button>
        ) : (
          <button
            onClick={() => setShowLoginModal(true)}
            className="ml-auto px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
          >
            로그인
          </button>
        )}
      </div>

      <div className="flex flex-row gap-0">
        {/* 드로어 */}
        <div className={`transition-all duration-300 overflow-hidden flex-shrink-0 ${isDrawerOpen ? "w-96" : "w-0"}`}>
          <div className="w-96 space-y-4 pr-4">
            {/* 슬롯 버튼 (words/sentences 모드, 자리모드 제외) */}
            {mode !== "random" && !isPositionMode && (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => {
                    const name = slotNames[num] || `${num}`;
                    const len = name.length;
                    const fontSize = len <= 3 ? 'text-sm' : len <= 6 ? 'text-xs' : 'text-[10px]';
                    return (
                    <button
                      key={num}
                      className={`h-8 rounded relative overflow-hidden ${fontSize} leading-tight ${
                        selectedSlot === num
                          ? "bg-blue-500 text-white"
                          : favoriteSlots.has(num)
                            ? "bg-yellow-100 hover:bg-yellow-200 ring-1 ring-yellow-400"
                            : "bg-gray-200 hover:bg-gray-300"
                      }`}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          toggleFavoriteSlot(num);
                        } else {
                          handleLoadPreset(num);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleRenameSlot(num);
                      }}
                      title="클릭: 불러오기 | Shift+클릭: 즐겨찾기 | 우클릭: 이름 변경"
                    >
                      {favoriteSlots.has(num) && <span className="absolute -top-1 -right-1 text-xs">⭐</span>}
                      <span className="block w-full text-center truncate px-1">{name}</span>
                    </button>
                    );
                  })}
                </div>
                <button
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 w-full"
                  onClick={handleSaveToSlot}
                >
                  현재 문장 저장
                </button>
              </div>
            )}

            {/* 단어/문장 모드: 상세설정 */}
            {(isWordLikeMode || mode === "sentences") && (
              <div className="space-y-2 border-t pt-2">
                <div className="text-sm font-semibold text-gray-600">상세설정</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    <label className="text-xs whitespace-nowrap">음성속도</label>
                    <input
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={speechRate.toFixed(1)}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value);
                        if (!isNaN(rate) && rate >= 0.1 && rate <= 10) {
                          useTypingStore.getState().changeSpeechRate(rate);
                        }
                      }}
                      className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">배속</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs whitespace-nowrap">글자크기</label>
                    <input
                      type="number"
                      min={12}
                      max={48}
                      step={0.1}
                      value={displayFontSize}
                      onChange={(e) => {
                        const size = parseFloat(e.target.value);
                        if (!isNaN(size) && size >= 12 && size <= 48) {
                          setDisplayFontSize(size);
                        }
                      }}
                      className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">px</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                      showText
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                    }`}
                    onClick={() => setShowText(!showText)}
                  >
                    글자 {showText ? "ON" : "OFF"}
                  </button>
                  <button
                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                      isSoundEnabled
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                    }`}
                    onClick={toggleSound}
                  >
                    소리 {isSoundEnabled ? "ON" : "OFF"}
                  </button>
                  {isPositionMode && (
                    <button
                      className={`px-2 py-1 rounded text-xs font-medium transition ${
                        showPositionKeyboard
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                      }`}
                      onClick={() => setShowPositionKeyboard(!showPositionKeyboard)}
                    >
                      키보드 {showPositionKeyboard ? "ON" : "OFF"}
                    </button>
                  )}
                </div>
                {mode === "sentences" && (
                  <>
                    <div className="flex items-center gap-1">
                      <label className="text-xs whitespace-nowrap">API 키</label>
                      <input
                        type="password"
                        className="flex-1 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="AIza..."
                        value={geminiApiKey}
                        onChange={(e) => {
                          setGeminiApiKey(e.target.value);
                          localStorage.setItem("gemini_api_key", e.target.value);
                        }}
                      />
                    </div>
                    {!geminiApiKey && (
                      <p className="text-xs text-red-500">문장 모드를 사용하려면 API 키를 입력하세요.</p>
                    )}
                    {geminiApiKey && (
                      <div className="text-xs text-gray-500">
                        <p>오늘 API 호출: {apiCallCount}회 (매일 17:00 리셋)</p>
                        <div className="ml-2 mt-0.5 space-y-0">
                          {GEMINI_MODEL_NAMES.map((model) => (
                            <p key={model} className={apiCallModels[model] ? "text-gray-700" : "text-gray-300"}>
                              {model}: {apiCallModels[model] || 0}회
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {generateError && (
                      <p className="text-xs text-red-500">{generateError}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* sequential/longtext 모드 설정 */}
            {(mode === "sequential" || mode === "longtext") && (
              <div className="space-y-2 border-t pt-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-gray-600">상세설정</div>
                  <button
                    className="px-2 py-0.5 rounded text-xs font-medium transition bg-gray-500 text-white hover:bg-gray-600"
                    onClick={handleSaveDetailSettings}
                  >
                    기본값 저장
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    <label className="text-xs whitespace-nowrap">표시속도</label>
                    <input
                      type="number"
                      min={30}
                      max={600}
                      step={10}
                      value={Math.round(60000 / sequentialSpeed)}
                      onChange={(e) => {
                        const cpm = parseFloat(e.target.value);
                        if (!isNaN(cpm) && cpm > 0) {
                          updateSequentialSpeed(Math.round(60000 / cpm));
                        }
                      }}
                      className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={isBatchMode}
                    />
                    <span className="text-xs text-gray-500">자/분</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs whitespace-nowrap">음성속도</label>
                    <input
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={sequentialSpeechRate.toFixed(1)}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value);
                        if (!isNaN(rate) && rate >= 0.1 && rate <= 10) {
                          setSequentialSpeechRate(rate);
                        }
                      }}
                      className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">배속</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs whitespace-nowrap">위 글자</label>
                    <input
                      type="number"
                      min={12}
                      max={48}
                      step={0.1}
                      value={displayFontSize}
                      onChange={(e) => {
                        const size = parseFloat(e.target.value);
                        if (!isNaN(size) && size >= 12 && size <= 48) {
                          setDisplayFontSize(size);
                        }
                      }}
                      className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">px</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs whitespace-nowrap">아래글자</label>
                    <input
                      type="number"
                      min={12}
                      max={48}
                      step={0.1}
                      value={inputFontSize}
                      onChange={(e) => {
                        const size = parseFloat(e.target.value);
                        if (!isNaN(size) && size >= 12 && size <= 48) {
                          setInputFontSize(size);
                        }
                      }}
                      className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">px</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs whitespace-nowrap">읽기단위</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      step={1}
                      value={charsPerRead}
                      onChange={(e) => {
                        const count = parseInt(e.target.value);
                        if (!isNaN(count) && count >= 1 && count <= 50) {
                          setCharsPerRead(count);
                        }
                      }}
                      className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500">자</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs whitespace-nowrap">매매 치라</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={batchSize}
                      onChange={(e) => {
                        const size = parseInt(e.target.value);
                        if (!isNaN(size) && size >= 1 && size <= 100) {
                          setBatchSize(size);
                          if (isPracticing && isBatchMode && !isReviewMode) {
                            setCurrentBatchChars("");
                            updateTypedWord("");
                          }
                        }
                      }}
                      className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={!isBatchMode}
                    />
                    <span className="text-xs text-gray-500">자</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                      showText
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                    }`}
                    onClick={() => setShowText(!showText)}
                  >
                    글자 {showText ? "ON" : "OFF"}
                  </button>
                  <button
                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                      isSoundEnabled
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                    }`}
                    onClick={toggleSound}
                  >
                    소리 {isSoundEnabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
            )}

            {/* random 모드 설정 */}
            {mode === "random" && (
            <>
              <div className="flex items-center gap-1 mt-1">
                <label className="text-xs">글자</label>
                <input
                  type="number"
                  min={12}
                  max={48}
                  step={0.1}
                  value={inputFontSize}
                  onChange={(e) => {
                    const size = parseFloat(e.target.value);
                    if (!isNaN(size) && size >= 12 && size <= 48) {
                      setInputFontSize(size);
                    }
                  }}
                  className="w-12 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-1 mt-1">
                <label className="text-xs">속도</label>
                <input
                  type="number"
                  min={0.25}
                  max={4}
                  step={0.25}
                  value={videoPlaybackRate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value);
                    if (!isNaN(rate) && rate >= 0.25 && rate <= 4) {
                      setVideoPlaybackRate(rate);
                      if (videoRef.current) {
                        videoRef.current.playbackRate = rate;
                      }
                    }
                  }}
                  className="w-12 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs">x</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <label className="text-xs">볼륨</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(videoVolume * 100)}
                  onChange={(e) => {
                    const vol = Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) / 100;
                    setVideoVolume(vol);
                    if (videoRef.current) {
                      videoRef.current.volume = vol;
                    }
                  }}
                  className="w-12 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs">%</span>
              </div>
              {videoPlaylist.length > 0 && (
                <div className="mt-1 border border-gray-300 rounded bg-gray-50 overflow-hidden flex flex-col flex-1">
                  <div className="bg-gray-200 px-1 py-0.5 text-xs font-semibold border-b">
                    목록 ({videoPlaylist.length})
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {videoPlaylist.map((video, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-1 px-1 py-0.5 cursor-pointer hover:bg-gray-100 ${
                          index === currentVideoIndex ? 'bg-blue-100 border-l-2 border-blue-500' : ''
                        }`}
                        onClick={() => {
                          setCurrentVideoIndex(index);
                          setAbRepeat({ a: null, b: null });
                        }}
                      >
                        <span className="text-xs text-gray-500 w-3">{index + 1}</span>
                        <span className="flex-1 text-xs truncate" title={video.name}>
                          {video.name}
                        </span>
                        <button
                          className="text-red-500 hover:text-red-700 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeVideoFromPlaylist(index);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {(mode === "words" || mode === "sentences") && !isPositionMode && inputText.trim() && (
            <p className="text-xs text-gray-500">
              단어 {inputText.trim().split("/").filter(Boolean).length}개
            </p>
          )}
          {mode !== "random" && !isPositionMode && (
            <>
            <span className="text-xs text-gray-500">원문 {inputText.replace(/\s/g, '').length}자</span>
            <textarea
              className="w-full p-2 border rounded"
              rows={25}
              placeholder={mode === "sentences" || mode === "words"
                ? "단어를 /로 구분하여 입력하세요\n(예: 경제/기술/환경)\n텍스트 파일을 드래그하여 넣을 수도 있습니다"
                : "텍스트 파일을 드래그하여 넣을 수도 있습니다"}
              value={inputText}
              onChange={handleTextareaChange}
              onDrop={handleTextareaDrop}
              onDragOver={(e) => e.preventDefault()}
            />
            </>
          )}
          </div>
        </div>

        {/* 토글 버튼 */}
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="w-6 h-full min-h-[400px] bg-gray-200 hover:bg-gray-300 flex items-center justify-center flex-shrink-0 rounded-r transition-colors"
          title={isDrawerOpen ? "설정 패널 닫기" : "설정 패널 열기"}
        >
          <span className="text-gray-600">{isDrawerOpen ? "◀" : "▶"}</span>
        </button>

        {/* 메인 타이핑 영역 */}
        <div className="flex-1 flex flex-col gap-4 pl-4">
          {mode !== "sequential" && mode !== "longtext" && mode !== "random" && (
            <div>
              <div className="flex items-center gap-4">
                <button
                  className={`px-4 py-2 rounded font-semibold transition ${
                    isPracticing || (mode === "sentences" && isGenerating)
                      ? "bg-gray-500 text-white hover:bg-gray-600"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                  onClick={handleStartOrStopPractice}
                >
                  {isGenerating ? "문장 생성 중..." : isPracticing && mode === "sentences" && generatedCount > 0 ? "문장 생성 완료" : isPracticing ? "연습 종료" : mode === "sentences" ? "문장 생성 시작" : "연습 시작"}
                </button>
                {todayCompletedRounds > 0 && (
                  <span className="text-sm text-gray-600 font-medium">
                    오늘 {todayCompletedRounds}회 완료
                  </span>
                )}
                {mode === "sentences" && generateError && (
                  <div className="flex flex-col">
                    <span className="text-sm text-red-500 font-medium">
                      {getErrorMessage(generateError)}
                    </span>
                    {getErrorMessage(generateError) !== generateError && (
                      <span className="text-xs text-gray-400">
                        {generateError}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {mode === "sentences" && (isGenerating || (isPracticing && generatedCount > 0)) && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">
                    ({generatedCount}/{inputText.trim().split("/").filter(Boolean).length}){aiModelName ? ` [${aiModelName}]` : ""}
                  </span>
                  {canGenerateMore && !isGenerating && (
                    <div className="flex items-center gap-1 border border-blue-400 rounded-full px-1 py-0.5 bg-blue-50 shadow-sm">
                      {GEMINI_MODEL_OPTIONS.map((model) => (
                        <button
                          key={model.id}
                          className={`text-xs px-1.5 py-0.5 rounded-full transition ${
                            selectedModel === model.id
                              ? "bg-emerald-500 text-white"
                              : "text-gray-500 hover:text-emerald-500"
                          }`}
                          onClick={() => setSelectedModel(model.id)}
                        >
                          {model.label}
                        </button>
                      ))}
                      <button
                        className="text-xs px-2 py-0.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 font-medium ml-0.5"
                        onClick={() => {
                          const words = useRandomSentences ? [] : inputText.trim().split("/").filter(Boolean);
                          generateMoreSentences(words, sentenceTargetCountRef.current, generatedCount, true);
                        }}
                      >
                        추가생성
                      </button>
                    </div>
                  )}
                </div>
              )}
              {mode === "sentences" && !isPracticing && !isGenerating && (
                <>
                  <div className="flex gap-1.5 mt-2">
                    <button
                      className={`px-2.5 py-1 text-xs rounded-full border transition ${
                        !useRandomSentences
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-500"
                      }`}
                      onClick={() => setUseRandomSentences(false)}
                    >
                      원문 단어
                    </button>
                    <button
                      className={`px-2.5 py-1 text-xs rounded-full border transition ${
                        useRandomSentences
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-500"
                      }`}
                      onClick={() => setUseRandomSentences(true)}
                    >
                      랜덤 문장
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {SENTENCE_STYLES.map((style) => (
                      <button
                        key={style}
                        className={`px-2.5 py-1 text-xs rounded-full border transition ${
                          sentenceStyle === style
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-500"
                        }`}
                        onClick={() => setSentenceStyle(style)}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {GEMINI_MODEL_OPTIONS.map((model) => (
                      <button
                        key={model.id}
                        className={`px-2.5 py-1 text-xs rounded-full border transition ${
                          selectedModel === model.id
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-500"
                        }`}
                        onClick={() => setSelectedModel(model.id)}
                      >
                        {model.label} ({model.estimatedSentences})
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 단어/문장 모드 라운드 완료 결과 */}
          {roundCompleteResult && !isPracticing && (mode === "words" || mode === "sentences") && (
            <div className="p-4 border-2 border-green-500 rounded bg-green-50">
              <p className="text-lg font-bold text-green-700 mb-2">{isSentenceReview ? "복습 완료!" : "라운드 완료!"}</p>
              <div className="flex gap-4 text-sm">
                <span className="text-blue-600">정답: {roundCompleteResult.correct}</span>
                <span className="text-rose-600">오답: {roundCompleteResult.incorrect}</span>
                <span>총: {roundCompleteResult.total}문제</span>
                {roundCompleteResult.avgKpm > 0 && (
                  <span className="text-gray-600">평균 타수 {roundCompleteResult.avgKpm} / 자수 {roundCompleteResult.avgCpm}</span>
                )}
              </div>
              {mode === "sentences" && sentences.length > 0 && !isSentenceReview && (
                <button
                  className="mt-2 px-4 py-1.5 rounded font-semibold bg-purple-500 text-white hover:bg-purple-600 transition text-sm"
                  onClick={() => {
                    const parsedWords = inputText.trim().split("/").filter(Boolean);
                    setIsSentenceReview(true);
                    setRoundCompleteResult(null);
                    resetBatchAndReviewState();
                    setPracticeSlot(selectedSlot);
                    setIsDrawerOpen(false);
                    startPractice(parsedWords);
                    setTotalCount(sentences.length);
                    setTimeout(() => wordInputRef.current?.focus(), 50);
                  }}
                >
                  복습하기
                </button>
              )}
            </div>
          )}

          {(mode === "sequential" || mode === "longtext") && (
            <div className="space-y-2">
              {/* 연습 시작/종료 + 상태 표시 */}
              <div className="flex items-center gap-4">
                <button
                  className={`px-4 py-2 rounded font-semibold transition ${
                    isPracticing || countdown !== null
                      ? "bg-gray-500 text-white hover:bg-gray-600"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                  onClick={handleStartOrStopPractice}
                >
                  {countdown !== null ? `${countdown}초` : isPracticing ? "연습 종료" : "연습 시작"}
                </button>
              </div>

              {(isPracticing || countdown !== null || isRoundComplete) && (
                <div className="flex items-center space-x-4 text-sm">
                  {isRoundComplete ? (
                    <>
                      <span className={`font-bold ${isFullyComplete ? 'text-green-600' : 'text-yellow-600'}`}>
                        {practiceSlot !== null ? `${slotNames[practiceSlot] || `슬롯 ${practiceSlot}`} ` : ''}
                        {isFullyComplete ? '라운드 완료' : '라운드 일시정지'}
                      </span>
                      <span className="text-blue-600 font-semibold">타수: {lastResult.kpm}/분</span>
                      <span className="text-purple-600 font-semibold">자수: {lastResult.cpm}/분</span>
                      {allResults.length > 1 && (
                        <>
                          <span className="text-gray-600">평균 타수: {averageResult.avgKpm}/분</span>
                          <span className="text-gray-600">평균 자수: {averageResult.avgCpm}/분</span>
                        </>
                      )}
                      <span className="text-orange-600 font-semibold">시간: {formatTime(lastResult.elapsedTime)}</span>
                      <span className="text-gray-500">
                        {isFullyComplete ? '(엔터: 다음 라운드)' : '(엔터: 재개)'}
                      </span>
                      {isFullyComplete && practiceSlot !== null && (
                        <span className="text-teal-600 font-semibold">
                          {slotNames[practiceSlot] || `슬롯 ${practiceSlot}`} ({isBatchMode ? '매매치라' : '보고치라'}) : {((isBatchMode ? slotCompletedRoundsBatch[practiceSlot] : slotCompletedRoundsNormal[practiceSlot]) || 0) + 1}회 완료
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {isBatchMode && (
                        <>
                          {isReviewMode ? (
                            <span className="text-red-600 font-semibold">
                              복습: {reviewIndex + 1}/{reviewBatches.length}
                            </span>
                          ) : (
                            <span className="text-purple-600 font-semibold">
                              진행: {Math.min(batchStartIndex + batchSize, randomizedIndices.length)}/{randomizedIndices.length}
                            </span>
                          )}
                          {lastResult.kpm > 0 && (
                            <>
                              <span className="text-blue-600 font-semibold">타수: {lastResult.kpm}/분</span>
                              <span className="text-green-600 font-semibold">자수: {lastResult.cpm}/분</span>
                            </>
                          )}
                        </>
                      )}
                      {!isBatchMode && (
                        <span className="text-purple-600 font-semibold">
                          진행: {currentDisplayIndex}/{randomizedIndices.length}
                        </span>
                      )}
                      <span className="text-orange-600 font-semibold">시간: {formatTime(displayElapsedTime)}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {mode !== "sequential" && mode !== "longtext" && mode !== "random" && isPracticing && (
            <div className="flex items-center">
              <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-4 text-sm font-medium">
                  {mode !== "words" && <span className="text-green-600">타수: {lastResult.kpm}/분</span>}
                  {mode !== "words" && <span className="text-purple-600">자수: {lastResult.cpm}/분</span>}
                  <span className="text-orange-600">시간: {formatTime(displayElapsedTime)}</span>
                </div>
                {mode !== "words" && allResults.length > 0 && allResults.length % 50 === 0 && (
                  <div className="flex items-center space-x-4 text-xs text-gray-600">
                    <span>평균 타수: {averageResult.avgKpm}/분</span>
                    <span>평균 자수: {averageResult.avgCpm}/분</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {showText && (mode === "sequential" || mode === "longtext") && (
            <div className="flex-1 flex flex-col gap-4">
              <div
                ref={displayAreaRef}
                className={`flex-1 p-4 border-2 border-blue-500 rounded bg-blue-50 relative ${countdown !== null ? 'flex flex-col items-center justify-center overflow-hidden' : 'overflow-y-auto'}`}
              >
                {countdown !== null ? (
                  <>
                    {practiceSlot !== null && (
                      <p className="text-2xl font-bold text-gray-700 mb-4">
                        {slotNames[practiceSlot] || `슬롯 ${practiceSlot}`}
                      </p>
                    )}
                    <p className="text-8xl font-bold text-blue-600 animate-pulse">
                      {countdown}
                    </p>
                    {mode !== "longtext" && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-3xl">
                      {(() => {
                        // 보고치라 횟수
                        const normalRounds = { ...slotCompletedRoundsNormal };
                        // 매매치라 횟수
                        const batchRounds = { ...slotCompletedRoundsBatch };
                        // 방금 완료한 슬롯만 +1 (아직 increment 안 됨)
                        if (pendingIncrementSlot !== null) {
                          if (isBatchMode) {
                            batchRounds[pendingIncrementSlot] = (batchRounds[pendingIncrementSlot] || 0) + 1;
                          } else {
                            normalRounds[pendingIncrementSlot] = (normalRounds[pendingIncrementSlot] || 0) + 1;
                          }
                        }
                        const allSlots = new Set([...Object.keys(normalRounds), ...Object.keys(batchRounds)].map(Number));
                        return Array.from(allSlots)
                          .sort((a, b) => a - b)
                          .filter(slot => (normalRounds[slot] || 0) > 0 || (batchRounds[slot] || 0) > 0)
                          .map((slot) => (
                            <div
                              key={slot}
                              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shadow-sm ${
                                slot === practiceSlot
                                  ? 'bg-yellow-300 border-2 border-yellow-500 text-yellow-900 font-bold'
                                  : 'bg-white border-2 border-gray-400 text-gray-700 font-medium'
                              }`}
                            >
                              <span>{slotNames[slot] || `슬롯 ${slot}`}</span>
                              <span className="mx-1.5 text-gray-400">|</span>
                              <span className="text-green-700 font-bold">{normalRounds[slot] || 0}</span>
                              <span className="text-gray-500">/</span>
                              <span className="text-orange-600 font-bold">{batchRounds[slot] || 0}</span>
                            </div>
                          ));
                      })()}
                    </div>
                    )}
                  </>
                ) : (
                  <>
                    {isRoundComplete && markedOriginalText.length > 0 ? (
                      /* 일시정지/완료 시 원문 색상 표시 */
                      <div
                        className="font-semibold whitespace-pre-wrap w-full"
                        style={{ fontSize: `${displayFontSize}px`, lineHeight: 1.5 }}
                      >
                        {markedOriginalText.map((m, idx) => (
                          <span
                            key={idx}
                            className={`cursor-pointer ${
                              m.state === 'deletion'
                                ? 'text-red-600'
                                : m.state === 'substitution'
                                ? 'text-blue-600'
                                : 'text-black'
                            } ${hoveredOrigIdx === idx ? 'bg-yellow-300 rounded px-0.5' : ''}`}
                            onMouseEnter={() => setHoveredOrigIdx(idx)}
                            onMouseLeave={() => setHoveredOrigIdx(null)}
                          >
                            {m.char}
                            {m.state === 'substitution' && m.wrongChar && (
                              <span className="text-blue-400">({m.wrongChar})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div
                        className="font-semibold whitespace-pre-wrap w-full"
                        style={{ fontSize: `${displayFontSize}px`, lineHeight: 1.5 }}
                      >
                        {(() => {
                          // displayedText 사용 (이미 계산됨)
                          const text = displayedText;

                          // 재개 직후 하이라이트만 표시 (마지막 10~1글자 유사도 기반)
                          if (showResumeHighlight) {
                            const textChars = [...text];
                            // resumePosition: 공백 제거된 원본에서의 재개 위치 (다음에 칠 글자)
                            let nonSpaceCount = 0;
                            return textChars.map((char, idx) => {
                              const isSpace = /\s/.test(char);
                              const isCurrentPos = !isSpace && nonSpaceCount === resumePosition;
                              const isTyped = !isSpace && nonSpaceCount < resumePosition;
                              if (!isSpace) {
                                nonSpaceCount++;
                              }
                              return (
                                <span
                                  key={idx}
                                  className={
                                    isCurrentPos
                                      ? 'bg-yellow-300 rounded px-0.5'
                                      : isTyped
                                      ? 'text-gray-400'
                                      : ''
                                  }
                                >
                                  {char}
                                </span>
                              );
                            });
                          }

                          // 매매치라 마지막 배치: 랜덤 채운 글자를 보라색으로 표시
                          if (isBatchMode && batchRandomFillCount > 0 && text.length > 0) {
                            const originalCount = text.length - batchRandomFillCount;
                            return [...text].map((char, idx) => (
                              <span
                                key={idx}
                                className={idx >= originalCount ? 'text-purple-400' : ''}
                              >
                                {char}
                              </span>
                            ));
                          }

                          return text;
                        })()}
                      </div>
                    )}
                    {isRoundComplete && (
                      <div className="absolute inset-0 bg-gray-500 bg-opacity-30 pointer-events-none" />
                    )}
                  </>
                )}
              </div>
              <div className="flex-1 border-2 border-green-500 rounded bg-green-50 p-4 flex flex-col">
                {/* 채점 결과 및 색깔 범례 (일시정지 시에만) */}
                {isRoundComplete && scoringResult && (
                  <div className="mb-2 p-2 bg-white rounded border text-sm">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>전체: <span className="font-bold">{scoringResult.totalChars}</span></span>
                      <span><span className="text-red-600 font-bold">■</span> 탈자: <span className="font-bold text-red-600">{scoringResult.deletions}</span></span>
                      <span><span className="text-green-600 font-bold">■</span> 첨자: <span className="font-bold text-green-600">{scoringResult.insertions}</span></span>
                      <span><span className="text-blue-600 font-bold">■</span> 오자: <span className="font-bold text-blue-600">{scoringResult.substitutions}</span></span>
                      <span>정확도: <span className="font-bold text-purple-600">{scoringResult.accuracy}%</span></span>
                    </div>
                  </div>
                )}
                <div className="flex-1">
                  {isRoundComplete && markedText.length > 0 ? (
                    /* 일시정지/완료 시 색상 표시 */
                    <div
                      className="w-full h-full p-4 border-2 border-gray-300 rounded overflow-auto whitespace-pre-wrap break-all bg-white"
                      style={{ fontSize: `${inputFontSize}px`, lineHeight: 1.5 }}
                    >
                      {markedText.map((m, idx) => (
                        <span
                          key={idx}
                          className={`cursor-pointer ${
                            m.state === 'deletion'
                              ? 'text-red-600'
                              : m.state === 'insertion'
                              ? 'text-green-600'
                              : m.state === 'substitution'
                              ? 'text-blue-600'
                              : 'text-black'
                          } ${hoveredOrigIdx !== null && m.origIdx === hoveredOrigIdx ? 'bg-yellow-300 rounded px-0.5' : ''}`}
                          onMouseEnter={() => {
                            if (m.origIdx !== undefined) {
                              setHoveredOrigIdx(m.origIdx);
                            }
                          }}
                          onMouseLeave={() => setHoveredOrigIdx(null)}
                        >
                          {m.char}
                          {m.state === 'substitution' && m.expectedChar && (
                            <span className="text-blue-400">({m.expectedChar})</span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    /* 입력 중 textarea */
                    <textarea
                      ref={typingTextareaRef}
                      className="w-full h-full p-4 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      style={{
                        fontSize: `${inputFontSize}px`,
                        lineHeight: 1.5,
                        imeMode: 'active'
                      } as React.CSSProperties}
                      placeholder="여기에 타이핑하세요"
                      value={typedWord}
                      onChange={(e) => {
                        updateTypedWord(e.target.value);
                        if (showResumeHighlight) setShowResumeHighlight(false);
                      }}
                      onKeyDown={handleKeyDown}
                      lang="ko"
                    />
                  )}
                </div>
              </div>
              {/* 라운드 완료/일시정지 시 별도 연습칸 */}
              {isRoundComplete && (
                <div className="border-2 border-orange-400 rounded bg-orange-50 p-4">
                  <div className="text-sm text-orange-600 mb-2 font-medium">
                    연습칸 (엔터: {isFullyComplete ? '다음 라운드' : '재개'})
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
                      minHeight: '120px',
                      imeMode: 'active'
                    } as React.CSSProperties}
                    placeholder="여기서 바로 연습하세요"
                    value={practiceText}
                    onChange={(e) => setPracticeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        // 숫자 입력 시 슬롯 이동 (보고치라/매매치라 모두 지원)
                        const trimmed = practiceText.trimEnd();
                        const endsWithNum = trimmed.match(/(\d+)$/);
                        const slotNum = endsWithNum ? parseInt(endsWithNum[1]) : NaN;
                        if (slotNum === 99) {
                          // 99 입력 시 랜덤 슬롯 (현재 슬롯 제외, 즐겨찾기 우선)
                          const slotsWithContent: number[] = [];
                          const targetSlots = favoriteSlots.size > 0 ? [...favoriteSlots] : Array.from({ length: 20 }, (_, i) => i + 1);
                          // practiceSlot이 null이면 selectedSlot 사용
                          const currentSlot = practiceSlot ?? selectedSlot;
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
                            startNextRound(practiceSlot, isBatchMode ? "batch" : mode, randomSlot);
                            return;
                          }
                        }
                        if (slotNum >= 1 && slotNum <= 20) {
                          const savedText = localStorage.getItem(`slot_${slotNum}`);
                          if (savedText) {
                            updateInputText(savedText);
                          }
                          startNextRound(practiceSlot, isBatchMode ? "batch" : mode, slotNum);
                          return;
                        }
                        // 매매치라 모드: 복습 5/5 완료 전에는 무조건 재개
                        if (isBatchMode && !isBatchReviewDone) {
                          resumeRound();
                        } else if (isFullyComplete) {
                          startNextRound(practiceSlot, isBatchMode ? "batch" : mode); // 카운트다운 후 완료 횟수 증가
                        } else {
                          resumeRound();
                        }
                      }
                    }}
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          {mode === "random" && (
            <div className="flex-1 flex flex-col gap-2">
              {/* 탭 UI */}
              <div className="flex gap-2">
                <button
                  className={`px-4 py-2 rounded font-medium ${videoSourceTab === 'upload' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                  onClick={() => setVideoSourceTab('upload')}
                >
                  파일 업로드
                </button>
                <button
                  className={`px-4 py-2 rounded font-medium ${videoSourceTab === 'youtube' ? 'bg-red-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                  onClick={() => setVideoSourceTab('youtube')}
                >
                  YouTube 링크
                </button>
              </div>

              {/* 재생 컨트롤 - 파일 업로드 탭에서만 표시 */}
              {videoSourceTab === 'upload' && (
              <>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  onClick={playPreviousVideo}
                  disabled={videoPlaylist.length === 0}
                >
                  ⏮ 이전
                </button>
                <button
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - skipSeconds);
                    }
                  }}
                >
                  ◀ {skipSeconds}초
                </button>
                <button
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  onClick={() => {
                    if (videoRef.current) {
                      if (videoRef.current.paused) {
                        videoRef.current.play();
                      } else {
                        videoRef.current.pause();
                      }
                    }
                  }}
                >
                  ▶ / ⏸
                </button>
                <button
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = Math.min(
                        videoRef.current.duration,
                        videoRef.current.currentTime + skipSeconds
                      );
                    }
                  }}
                >
                  {skipSeconds}초 ▶
                </button>
                <button
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  onClick={playNextVideo}
                  disabled={videoPlaylist.length === 0}
                >
                  다음 ⏭
                </button>
                <div className="flex items-center gap-1">
                  <span className="text-sm">건너뛰기:</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={skipSeconds}
                    onChange={(e) => setSkipSeconds(Math.max(1, Math.min(60, parseInt(e.target.value) || 5)))}
                    className="w-12 px-1 py-1 border rounded text-sm"
                  />
                  <span className="text-sm">초</span>
                </div>
                <button
                  className={`px-3 py-1 rounded text-sm ${videoLoop ? "bg-blue-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
                  onClick={() => {
                    setVideoLoop(!videoLoop);
                    if (videoRef.current) {
                      videoRef.current.loop = !videoLoop;
                    }
                  }}
                >
                  영상반복 {videoLoop ? "ON" : "OFF"}
                </button>
                <button
                  className={`px-3 py-1 rounded text-sm ${playlistLoop ? "bg-purple-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
                  onClick={() => setPlaylistLoop(!playlistLoop)}
                >
                  목록반복 {playlistLoop ? "ON" : "OFF"}
                </button>
                <button
                  className={`px-3 py-1 rounded text-sm ${abRepeat.a !== null ? "bg-green-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
                  onClick={() => {
                    if (videoRef.current) {
                      if (abRepeat.a === null) {
                        setAbRepeat({ a: videoRef.current.currentTime, b: null });
                      } else if (abRepeat.b === null) {
                        setAbRepeat({ ...abRepeat, b: videoRef.current.currentTime });
                      } else {
                        setAbRepeat({ a: null, b: null });
                      }
                    }
                  }}
                >
                  {abRepeat.a === null ? "A-B 시작" : abRepeat.b === null ? "B 지점" : "A-B 해제"}
                </button>
                {abRepeat.a !== null && (
                  <span className="text-xs text-gray-600">
                    A: {Math.floor(abRepeat.a)}초 {abRepeat.b !== null && `→ B: ${Math.floor(abRepeat.b)}초`}
                  </span>
                )}
                <button
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  onClick={() => {
                    if (videoRef.current && document.pictureInPictureEnabled) {
                      if (document.pictureInPictureElement) {
                        document.exitPictureInPicture();
                      } else {
                        videoRef.current.requestPictureInPicture();
                      }
                    }
                  }}
                >
                  PIP
                </button>
                <button
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
                  onClick={() => {
                    if (videoRef.current) {
                      if (document.fullscreenElement) {
                        document.exitFullscreen();
                      } else {
                        videoRef.current.requestFullscreen();
                      }
                    }
                  }}
                >
                  전체화면
                </button>
                {videoPlaylist.length > 0 && (
                  <button
                    className="px-3 py-1 bg-red-400 text-white rounded hover:bg-red-500 text-sm"
                    onClick={clearPlaylist}
                  >
                    목록 삭제
                  </button>
                )}
              </div>

              {/* 단축키 안내 */}
              <div className="text-xs text-gray-500 flex flex-wrap gap-x-3">
                <span>Space: 재생/정지</span>
                <span>←/→: 건너뛰기</span>
                <span>↑/↓: 볼륨</span>
                <span>&lt;/&gt;: 속도</span>
                <span>B/N: 이전/다음</span>
                <span>L: 영상반복</span>
                <span>A: 구간반복</span>
                <span>M: 음소거</span>
                <span>F: 전체화면</span>
                <span>P: PIP</span>
                <span>Home/End: 처음/끝</span>
              </div>
              </>
              )}

              {/* YouTube 탭 콘텐츠 */}
              {videoSourceTab === 'youtube' && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="YouTube URL을 입력하세요 (예: https://youtube.com/watch?v=...)"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleYoutubeUrlSubmit();
                    }}
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    onClick={handleYoutubeUrlSubmit}
                  >
                    재생
                  </button>
                </div>
              )}

              {/* 동영상 영역 - 파일 업로드 탭 */}
              {videoSourceTab === 'upload' && (
              <div className="flex-1 flex gap-2" style={{ height: "75vh" }}>
                {/* 동영상 플레이어 */}
                <div
                  ref={dropZoneRef}
                  className={`flex-1 border-2 rounded overflow-hidden bg-black relative ${isDragging ? 'border-green-500 border-4' : 'border-blue-500'}`}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {/* 드래그 오버레이 */}
                  {isDragging && (
                    <div className="absolute inset-0 bg-green-500 bg-opacity-50 z-10 flex items-center justify-center pointer-events-none">
                      <span className="text-white text-2xl font-bold">여기에 영상/오디오 파일을 놓으세요</span>
                    </div>
                  )}
                  {videoSrc ? (
                    <video
                      ref={videoRef}
                      src={videoSrc}
                      className="w-full h-full object-contain"
                      style={{ height: "75vh" }}
                      controls
                      autoPlay
                      loop={videoLoop}
                      disablePictureInPicture
                      controlsList="noplaybackrate"
                      onLoadedMetadata={() => {
                        if (videoRef.current) {
                          videoRef.current.playbackRate = videoPlaybackRate;
                          videoRef.current.volume = videoVolume;
                          videoRef.current.loop = videoLoop;
                          // 저장된 재생 위치로 이동 (localStorage에서 직접 읽어서 모드 전환 후에도 복원)
                          const savedTime = localStorage.getItem('videoCurrentTime');
                          const savedIndex = localStorage.getItem('videoCurrentIndex');
                          if (savedTime !== null && savedIndex !== null && parseInt(savedIndex) === currentVideoIndex) {
                            videoRef.current.currentTime = parseFloat(savedTime);
                          }
                        }
                      }}
                      onTimeUpdate={() => {
                        if (videoRef.current && abRepeat.a !== null && abRepeat.b !== null) {
                          if (videoRef.current.currentTime >= abRepeat.b) {
                            videoRef.current.currentTime = abRepeat.a;
                          }
                        }
                      }}
                      onEnded={() => {
                        // 영상 끝나면 다음 영상 재생 (영상반복이 꺼져있을 때만)
                        if (!videoLoop && videoPlaylist.length > 1) {
                          if (currentVideoIndex < videoPlaylist.length - 1) {
                            setCurrentVideoIndex(prev => prev + 1);
                          } else if (playlistLoop) {
                            setCurrentVideoIndex(0);
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-900 gap-2">
                      <span className="text-4xl">📁</span>
                      <span>영상/오디오 파일을 드래그하거나 선택하세요</span>
                      <span className="text-sm">(여러 파일 선택 가능)</span>
                    </div>
                  )}
                </div>

              </div>
              )}

              {/* YouTube 영역 */}
              {videoSourceTab === 'youtube' && (
                <div className="flex gap-2" style={{ height: "60vh" }}>
                  <div className="flex-1 border-2 border-red-500 rounded overflow-hidden bg-black">
                    {youtubeVideoId ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="YouTube video"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-900 gap-2">
                        <span className="text-4xl">▶️</span>
                        <span>YouTube URL을 입력하고 재생 버튼을 누르세요</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 타이핑 영역 */}
              <div className="flex-1 border-2 border-green-500 rounded bg-green-50 p-4">
                <textarea
                  className="w-full h-full p-4 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ fontSize: `${inputFontSize}px`, lineHeight: 1.5, imeMode: 'active' } as React.CSSProperties}
                  placeholder="여기에 타이핑하세요"
                  value={typedWord}
                  onChange={(e) => updateTypedWord(e.target.value)}
                  onKeyDown={handleKeyDown}
                  lang="ko"
                />
              </div>
            </div>
          )}

          {showText && mode !== "sequential" && mode !== "longtext" && mode !== "random" && (
            <div className="min-h-[200px] p-4 border rounded bg-gray-50">
              {isPositionMode && (
                <div className="rounded-2xl border border-amber-300 bg-gradient-to-b from-amber-50 to-amber-100 p-4">
                  <div className="mb-2 flex justify-start">
                    <button
                      onClick={() => {
                        const allStageKeys = POSITION_STAGE_OPTIONS.map((s) => s.key);
                        const isAllSelected = allStageKeys.every((k) => positionEnabledStages.includes(k));
                        setPositionEnabledStages(isAllSelected ? [POSITION_STAGE_OPTIONS[0].key] : allStageKeys);
                      }}
                      className="px-2 py-1 rounded border text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    >
                      단계 전체선택
                    </button>
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {!activeSingleStage && (
                      <span className="text-[11px] text-gray-500">단계 1개 선택 시 사용 가능</span>
                    )}
                  </div>
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-1 mb-4 max-w-[920px] mx-auto">
                    {POSITION_STAGE_OPTIONS.map(({ key, label, numLabel, btnLabel }) => {
                      const enabled = positionEnabledStages.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (isPositionMode && isPracticing) {
                              switchPositionStageImmediately(key);
                              return;
                            }
                            if (enabled && positionEnabledStages.length === 1) return;
                            setPositionEnabledStages(
                              enabled
                                ? positionEnabledStages.filter((k) => k !== key)
                                : [...positionEnabledStages, key]
                            );
                          }}
                          className={`h-9 rounded border text-[10px] leading-tight font-semibold text-center ${
                            enabled
                              ? "bg-emerald-600 text-white border-emerald-700"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                          title={label}
                        >
                          <div>{numLabel}</div>
                          <div>{btnLabel}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-10 gap-1.5 max-w-[920px] mx-auto mb-4">
                    {Array.from({ length: 30 }, (_, offset) => offset).map((offset) => {
                      const pageStart = Math.floor(currentWordIndex / 30) * 30;
                      const idx = pageStart + offset;
                      const char = idx >= 0 && idx < shuffledWords.length ? shuffledWords[idx] : "-";
                      const isCurrent = idx === currentWordIndex;
                      return (
                        <div
                          key={`position-line-${offset}`}
                          className={`h-9 rounded-lg border flex items-center justify-center font-semibold ${
                            isCurrent
                              ? "bg-rose-100 border-rose-300 text-rose-700"
                              : "bg-white/80 border-amber-200 text-gray-500"
                          }`}
                          style={{ fontSize: `${Math.max(18, Math.round(displayFontSize))}px` }}
                        >
                          {char}
                        </div>
                      );
                    })}
                  </div>
                  {showPositionKeyboard && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[700px] mx-auto">
                        {[POSITION_LEFT_ROWS, POSITION_RIGHT_ROWS].map((rows, sideIdx) => (
                          <div key={`position-side-${sideIdx}`} className="rounded-2xl bg-white/70 border border-amber-200 p-3">
                            {rows.map((row, rowIdx) => (
                              <div key={`position-side-${sideIdx}-row-${rowIdx}`} className="grid grid-cols-5 gap-2 mb-2 last:mb-0">
                                {row.map((keyDef, colIdx) => (
                                  <div
                                    key={`position-key-${sideIdx}-${rowIdx}-${colIdx}`}
                                    className={`h-14 rounded-xl border flex flex-col items-center justify-center bg-white border-gray-300 cursor-pointer transition-all duration-150 ${
                                      hoveredPositionKeyId === keyDef.id
                                        ? "bg-gray-900 text-white border-black ring-4 ring-gray-300 shadow-lg scale-105"
                                        : hoveredTransitionKeyIds.has(keyDef.id)
                                          ? "bg-rose-500 text-white border-rose-700 ring-2 ring-rose-200 shadow"
                                          : "text-gray-800"
                                    }`}
                                    onMouseEnter={() => setHoveredPositionKeyId(keyDef.id)}
                                    onMouseLeave={() => setHoveredPositionKeyId(null)}
                                  >
                                    <div
                                      className="text-lg font-semibold leading-none"
                                      style={{
                                        color: "#000000",
                                        textShadow: "none",
                                      }}
                                    >
                                      {keyDef.label}
                                    </div>
                                    <div className="text-[10px] leading-tight mt-1 text-black"
                                    style={{
                                      textShadow: "none",
                                    }}>
                                      {(() => { const m = positionPerKeyMap.get(keyDef.id); return m != null ? `${m.avgMs}ms` : "-"; })()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="max-w-[360px] mx-auto mt-4 rounded-2xl bg-white/70 border border-amber-200 p-3">
                        <div className="grid grid-cols-6 gap-2">
                          {POSITION_THUMB_ROW.map((keyDef, idx) => (
                            <div
                              key={`position-thumb-${idx}`}
                              className={`h-14 rounded-xl border flex flex-col items-center justify-center bg-white border-gray-300 cursor-pointer transition-all duration-150 ${
                                hoveredPositionKeyId === keyDef.id
                                  ? "bg-gray-900 text-white border-black ring-4 ring-gray-300 shadow-lg scale-105"
                                  : hoveredTransitionKeyIds.has(keyDef.id)
                                    ? "bg-rose-500 text-white border-rose-700 ring-2 ring-rose-200 shadow"
                                    : "text-gray-800"
                              }`}
                              onMouseEnter={() => setHoveredPositionKeyId(keyDef.id)}
                              onMouseLeave={() => setHoveredPositionKeyId(null)}
                            >
                              <div
                                className="text-lg font-semibold leading-none"
                                style={{
                                  color: "#000000",
                                  textShadow: "none",
                                }}
                              >
                                {keyDef.label}
                              </div>
                              <div className="text-[10px] leading-tight mt-1 text-black"
                              style={{
                                textShadow: "none",
                              }}>
                                {(() => { const m = positionPerKeyMap.get(keyDef.id); return m != null ? `${m.avgMs}ms` : "-"; })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              {mode === "words" && !isReviewActive && (
                <div className="flex flex-col items-start gap-1 mb-2">
                  {[-2, -1].map(offset => {
                    const idx = currentWordIndex + offset;
                    return idx >= 0 && shuffledWords[idx] ? (
                      <span key={offset} className="text-gray-400" style={{ fontSize: `${Math.round(displayFontSize * 0.85)}px` }}>
                        {shuffledWords[idx]}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              {mode === "sentences" && (
                <div className="flex flex-col items-start gap-1 mb-2">
                  {[-2, -1].map(offset => {
                    const idx = currentSentenceIndex + offset;
                    return idx >= 0 && sentences[idx] ? (
                      <span key={offset} className="text-gray-400" style={{ fontSize: `${Math.round(displayFontSize * 0.85)}px` }}>
                        {sentences[idx]}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              {isReviewActive && mode === "words" && (
                <div className="mb-2 text-sm font-bold text-orange-600">
                  {reviewType === "failed" ? "2차복습" : "1차복습"} {currentReviewIndex + 1}/{reviewWords.length}
                </div>
              )}
              <p className="font-semibold whitespace-pre-wrap" style={{ fontSize: `${displayFontSize}px` }}>
                {mode === "words"
                  ? (isReviewActive && currentReviewTarget ? currentReviewTarget : shuffledWords[currentWordIndex])
                  : mode === "sentences"
                  ? (() => {
                      const target = sentences[currentSentenceIndex] || "";
                      return target.split("").map((char, i) => {
                        let style: React.CSSProperties = {};
                        let displayChar = char;
                        if (i < typedWord.length) {
                          if (typedWord[i] === char) {
                            style = { color: "blue" };
                          } else {
                            if (char === " ") {
                              displayChar = "∨";
                              style = { color: "red", fontSize: "0.8em" };
                            } else {
                              style = { color: "red", textDecoration: "underline" };
                            }
                          }
                        }
                        return <span key={i} style={style}>{displayChar}</span>;
                      });
                    })()
                  : ""}
              </p>
              {mode === "words" && !isReviewActive && (
                <div className="flex flex-col items-start gap-1 mt-2">
                  {[1, 2].map(offset => {
                    const idx = currentWordIndex + offset;
                    return idx < shuffledWords.length && shuffledWords[idx] ? (
                      <span key={offset} className="text-gray-400" style={{ fontSize: `${Math.round(displayFontSize * 0.85)}px` }}>
                        {shuffledWords[idx]}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              {mode === "sentences" && (
                <div className="flex flex-col items-start gap-1 mt-2">
                  {[1, 2].map(offset => {
                    const idx = currentSentenceIndex + offset;
                    return idx < sentences.length && sentences[idx] ? (
                      <span key={offset} className="text-gray-400" style={{ fontSize: `${Math.round(displayFontSize * 0.85)}px` }}>
                        {sentences[idx]}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}

          {positionCycleToast && (
            <div className="text-center py-1.5 px-4 rounded-full bg-emerald-500 text-white text-sm font-semibold animate-pulse">
              {positionCycleToast}
            </div>
          )}
          {mode !== "sequential" && mode !== "longtext" && mode !== "random" && (
            <>
              <input
                ref={wordInputRef}
                key={`${mode === "sentences" ? currentSentenceIndex : currentWordIndex}-${isReviewActive ? `r${currentReviewIndex}` : ''}`}
                autoFocus
                type="text"
                className="w-full p-2 border rounded"
                value={typedWord}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />

              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  <span className="text-blue-600">정답: {correctCount}</span> |{" "}
                  <span className="text-rose-600">오답: {incorrectCount}</span> |
                  진행: {totalCount > 0 ? `${progressCount} / ${totalCount}` : progressCount}
                  {isPositionMode && isPracticing && (
                    <> | <span className="text-emerald-600 font-semibold">{positionEnabledStages.length === 1
                      ? (POSITION_STAGE_OPTIONS.find((v) => v.key === positionEnabledStages[0])?.label ?? positionEnabledStages[0])
                      : `${positionEnabledStages.length}단계 혼합`
                    }</span></>
                  )}
                  {isReviewActive && mode === "words" && (
                    <> | <span className={`font-bold ${reviewType === "failed" ? "text-amber-700" : "text-orange-600"}`}>{reviewType === "failed" ? "2차복습" : "1차복습"}: {currentReviewIndex + 1}/{reviewWords.length}</span></>
                  )}
                  {isSentenceReview && mode === "sentences" && isPracticing && (
                    <> | <span className="font-bold text-purple-600">복습 중</span></>
                  )}
                </p>
                {isPositionMode && isPracticing && activeSingleStage && (
                  <span className="text-[11px] text-gray-400">스페이스: 현재 글자 제외/해제</span>
                )}
              </div>

              {mode === "words" && (
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => {
                      const next = !showProficiencyPanel;
                      setShowProficiencyPanel(next);
                      if (next) {
                        refreshToday();
                        refreshOverall();
                      }
                    }}
                    className={`text-xs px-3 py-1 rounded border ${showProficiencyPanel ? 'bg-blue-500 text-white border-blue-500' : 'bg-white border-gray-300 hover:bg-gray-100'}`}
                  >
                    숙련도
                  </button>
                </div>
              )}

              {showProficiencyPanel && mode === "words" && (
                <WordProficiencyPanel
                  todayProficiencies={todayProficiencies}
                  overallProficiencies={overallProficiencies}
                  onRefreshToday={refreshToday}
                  onRefreshOverall={refreshOverall}
                  onClearToday={clearToday}
                  onClearOverall={clearOverall}
                  onMergeToOverall={mergeToOverall}
                  onClose={() => setShowProficiencyPanel(false)}
                />
              )}
              {isPositionMode && (
                <div className="mt-2">
                    <div className="border rounded p-4 bg-white space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">오늘의 숙련도</h3>
                        <button
                          onClick={() => setPositionSamples([])}
                          className="text-xs px-3 py-1.5 rounded border text-red-600 border-red-300 hover:bg-red-50"
                        >
                          초기화
                        </button>
                        <button
                          onClick={() => {
                            setOverallPositionSamples((prev) => [...prev, ...positionSamples].slice(-POSITION_OVERALL_SAMPLE_LIMIT));
                            setPositionSamples([]);
                          }}
                          className="text-xs px-3 py-1.5 rounded border text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                        >
                          전체에 포함
                        </button>
                      </div>
                      {hoveredPositionKeyId && (
                        <div className="text-xs text-amber-700">
                          선택 키: <span className="font-semibold">{POSITION_KEY_LABEL[hoveredPositionKeyId] || hoveredPositionKeyId}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded border ${getPositionRoleColorClass("initial")}`}>초성 (왼손)</span>
                        <span className={`px-2 py-0.5 rounded border ${getPositionRoleColorClass("vowel_left_thumb")}`}>중성 (양엄지)</span>
                        <span className={`px-2 py-0.5 rounded border ${getPositionRoleColorClass("final")}`}>종성 (오른손)</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        위 키 배열에서 키를 hover하면 느린 전환 키가 노란색으로 강조됩니다.
                      </div>
                      <div className="grid grid-cols-3 gap-3 items-start">
                        {/* 왼쪽: 자리전환숙련도 */}
                        <div className="space-y-3">
                          <div className="border rounded bg-gray-50 p-2">
                            <div className="text-sm font-semibold mb-1">단계별 숙련도</div>
                            {stagePositionMetrics.length === 0 ? (
                              <div className="text-xs text-gray-500">데이터 없음</div>
                            ) : (
                              <div className="space-y-1">
                                {stagePositionMetrics.map((row) => (
                                  <div key={`stage-position-metric-${row.stage}`} className="text-xs flex items-center justify-between gap-2">
                                    <span className="font-medium">
                                      {row.stage === "mixed"
                                        ? "복합선택"
                                        : (POSITION_STAGE_OPTIONS.find((v) => v.key === row.stage)?.label ?? row.stage)}
                                    </span>
                                    <span className="text-gray-600">{row.avgMs}ms | 빠른 {row.fastRate}% | {row.count}회</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold mb-1">동시 조합별 약점</div>
                            <div className="max-h-80 overflow-y-auto border rounded">
                              {positionMetrics.perTransitionByContext.length === 0 ? (
                                <div className="p-2 text-xs text-gray-400">데이터 없음</div>
                              ) : (
                                positionMetrics.perTransitionByContext.slice(0, 80).map((row) => (
                                  <div
                                    key={row.id}
                                    className={`px-2 py-1 text-xs border-b last:border-b-0 transition ${
                                      !hoveredPositionKeyId
                                        ? ""
                                        : (row.fromKeys.includes(hoveredPositionKeyId) || row.toKeys.includes(hoveredPositionKeyId))
                                          ? "bg-amber-100"
                                          : "opacity-40"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-medium flex items-center gap-1">
                                        <span className={`px-1.5 py-0.5 rounded border ${getPositionGroupColorClass(row.group)}`}>{row.fromUnit}</span>
                                        <span className="text-gray-400">→</span>
                                        <span className={`px-1.5 py-0.5 rounded border ${getPositionGroupColorClass(row.group)}`}>{row.toUnit}</span>
                                      </span>
                                      <span className="text-gray-600 flex items-center gap-1">
                                        {row.stability === "unstable" && <span className="px-1 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700 border border-amber-300">불안정</span>}
                                        {row.stability === "stable_slow" && <span className="px-1 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 border border-blue-300">느림</span>}
                                        평균 {row.avgMs}ms ±{row.stdDev} | 빠른 {row.fastRate}% | {row.count}회
                                      </span>
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-gray-500">
                                      글자: {row.fromChar || "-"} → {row.toChar || "-"}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                        {/* 가운데: 전체 숙련도 */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-sm font-semibold">전체 숙련도</div>
                            <span className="text-xs text-gray-500">{overallPositionSamples.length}개</span>
                            <button
                              onClick={() => setOverallPositionSamples([])}
                              className="text-xs px-2 py-0.5 rounded border text-red-600 border-red-300 hover:bg-red-50"
                            >
                              초기화
                            </button>
                          </div>
                          <div className="border rounded bg-gray-50 p-2">
                            <div className="text-sm font-semibold mb-1">단계별 숙련도</div>
                            {overallStagePositionMetrics.length === 0 ? (
                              <div className="text-xs text-gray-500">데이터 없음</div>
                            ) : (
                              <div className="space-y-1">
                                {overallStagePositionMetrics.map((row) => (
                                  <div key={`overall-stage-position-metric-${row.stage}`} className="text-xs flex items-center justify-between gap-2">
                                    <span className="font-medium">
                                      {row.stage === "mixed"
                                        ? "복합선택"
                                        : (POSITION_STAGE_OPTIONS.find((v) => v.key === row.stage)?.label ?? row.stage)}
                                    </span>
                                    <span className="text-gray-600">{row.avgMs}ms | 빠른 {row.fastRate}% | {row.count}회</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold mb-1">동시 조합별 약점</div>
                            <div className="max-h-80 overflow-y-auto border rounded">
                              {overallPositionMetrics.perTransitionByContext.length === 0 ? (
                                <div className="p-2 text-xs text-gray-400">데이터 없음</div>
                              ) : (
                                overallPositionMetrics.perTransitionByContext.slice(0, 80).map((row) => (
                                  <div
                                    key={row.id}
                                    className="px-2 py-1 text-xs border-b last:border-b-0"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-medium flex items-center gap-1">
                                        <span className={`px-1.5 py-0.5 rounded border ${getPositionGroupColorClass(row.group)}`}>{row.fromUnit}</span>
                                        <span className="text-gray-400">→</span>
                                        <span className={`px-1.5 py-0.5 rounded border ${getPositionGroupColorClass(row.group)}`}>{row.toUnit}</span>
                                      </span>
                                      <span className="text-gray-600 flex items-center gap-1">
                                        {row.stability === "unstable" && <span className="px-1 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700 border border-amber-300">불안정</span>}
                                        {row.stability === "stable_slow" && <span className="px-1 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 border border-blue-300">느림</span>}
                                        평균 {row.avgMs}ms ±{row.stdDev} | 빠른 {row.fastRate}% | {row.count}회
                                      </span>
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-gray-500">
                                      글자: {row.fromChar || "-"} → {row.toChar || "-"}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                        {/* 오른쪽: 제외목록 */}
                        <div>
                          <div className="border rounded bg-gray-50 p-2">
                            <div className="text-sm font-semibold mb-1">제외목록</div>
                            {activeSingleStage ? (
                              <>
                                <div className="text-xs text-gray-600 mb-1">
                                  현재 단계: {POSITION_STAGE_OPTIONS.find((v) => v.key === activeSingleStage)?.label ?? activeSingleStage}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {activeStageExcludedChars.length > 0 ? (
                                    activeStageExcludedChars.map((char) => (
                                      <button
                                        key={`excluded-panel-char-${activeSingleStage}-${char}`}
                                        onClick={() => {
                                          removePositionExcludedChar(activeSingleStage, char);
                                          regeneratePositionQueueFromCurrent();
                                        }}
                                        className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm"
                                        title="클릭하면 제외 해제"
                                      >
                                        {char}
                                      </button>
                                    ))
                                  ) : (
                                    <span className="text-sm text-gray-500">현재 단계 제외 글자 없음</span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-gray-500">단계 1개를 선택하면 해당 단계 제외목록이 표시됩니다.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {showLoginModal && (
        <LoginPage onClose={() => setShowLoginModal(false)} />
      )}
      {/* 우하단 모드별 완료 현황 토글 */}
      <div className="fixed bottom-4 right-4 z-50">
        {showModeStats && (
          <div className="mb-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-sm min-w-[150px]">
            <div className="font-semibold text-gray-700 mb-2 border-b pb-1">오늘의 완료 현황</div>
            {([
              ["sequential", "보고치라"],
              ["batch", "매매치라"],
              ["longtext", "긴글"],
              ["random", "랜덤"],
              ["words", "단어"],
              ["sentences", "문장"],
              ["position", "자리"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex justify-between py-0.5">
                <span className="text-gray-600">{label}</span>
                <span className="font-semibold text-gray-800">{modeCompletedRounds[key] || 0}{key === "words" ? "단어" : key === "sentences" ? "문장" : "회"}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowModeStats(prev => !prev)}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg text-lg"
          title="모드별 완료 현황"
        >
          {todayCompletedRounds}
        </button>
      </div>
    </div>
  );
}

