import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEY } from "../constants";
import { cpsToRate } from "../utils/speechUtils";

export type Mode = "words" | "position" | "sentences" | "longtext" | "random" | "sequential";
export type PositionDifficulty =
  | "initial_mid"
  | "final_mid"
  | "initial_bottom"
  | "final_bottom"
  | "initial_top"
  | "final_top"
  | "double_consonant"
  | "compound_vowel_1"
  | "compound_vowel_2"
  | "complex_final"
  | "random";
export type PositionStage = Exclude<PositionDifficulty, "random">;

export interface IncorrectEntry {
  word: string;
  typed: string;
}

interface TypingState {
  inputText: string;
  shuffledWords: string[];
  sentences: string[];
  randomLetters: string[];
  currentWordIndex: number;
  currentSentenceIndex: number;
  currentLetterIndex: number;
  typedWord: string;
  correctCount: number;
  incorrectCount: number;
  incorrectWords: IncorrectEntry[];
  totalCount: number;
  progressCount: number;
  mode: Mode;
  positionEnabledStages: PositionStage[];
  positionStageExcludedChars: Record<PositionStage, string[]>;
  positionStageExcludeHistory: Record<PositionStage, string[]>;
  speechRate: number;
  isSoundEnabled: boolean;
  isPracticing: boolean;

  // ????먯닔 異붿쟻 (?꾩옱 ?⑥뼱 湲곗?)
  currentWordStartTime: number | null;
  currentWordKeystrokes: number;

  // ?쒖감 ?쒖떆 紐⑤뱶 (蹂닿퀬移섎씪)
  sequentialText: string;
  displayedCharIndices: Set<number>; // ?대? ?쒖떆??湲?먯쓽 ?몃뜳?ㅻ뱾
  sequentialSpeed: number; // ms per character
  randomizedIndices: number[]; // ?쒕뜡 ?쒖꽌濡??쒖떆??湲???몃뜳??
  currentDisplayIndex: number; // ?꾩옱源뚯? ?쒖떆??湲??媛쒖닔

  updateInputText: (text: string) => void;
  updateTypedWord: (text: string) => void;
  switchMode: (mode: Mode) => void;
  setPositionEnabledStages: (stages: PositionStage[]) => void;
  switchPositionStageImmediately: (stage: PositionStage) => void;
  addPositionExcludedChar: (stage: PositionStage, char: string) => void;
  removePositionExcludedChar: (stage: PositionStage, char: string) => void;
  regeneratePositionQueueFromCurrent: () => void;
  injectPositionRecommendedWords: (recommendedWords: string[]) => void;
  changeSpeechRate: (rate: number) => void;
  toggleSound: () => void;
  removeIncorrectWord: (word: string, typed: string) => void;
  startCurrentWordTracking: () => void;
  incrementCurrentWordKeystrokes: () => void;
  resetCurrentWordTracking: () => void;

  // ?쒖감 ?쒖떆 ?≪뀡
  addDisplayedCharIndex: (index: number) => void;
  updateSequentialSpeed: (speed: number) => void;
  resetSequential: () => void;
  incrementDisplayIndex: () => void;
  restartSequentialPractice: () => void;

  lastSentenceTyped: string;

  setSentences: (sentences: string[]) => void;
  addSentence: (sentence: string) => void;
  setTotalCount: (count: number) => void;
  startPractice: (words: string[]) => void;
  stopPractice: () => void;
  submitAnswer: (input: string) => void;
  resumeSentencePractice: (state: {
    sentences: string[];
    currentSentenceIndex: number;
    progressCount: number;
    correctCount: number;
    incorrectCount: number;
    incorrectWords: IncorrectEntry[];
    totalCount: number;
  }) => void;
}

const removeWhitespace = (text: string): string => text.replace(/\s+/g, "");
const HANGUL_SINGLE_CHAR = /^[가-힣]$/;
const toSingleHangul = (text: string): string => {
  const compact = removeWhitespace(text ?? "");
  if (HANGUL_SINGLE_CHAR.test(compact)) return compact;
  const match = compact.match(/[가-힣]/);
  return match ? match[0] : "";
};

const randomInt = (max: number): number => Math.floor(Math.random() * max);
const pick = <T>(arr: readonly T[]): T => arr[randomInt(arr.length)];
export const POSITION_BASE_QUESTION_COUNT = 30;
export const POSITION_RECOMMENDED_MIN_COUNT = 20;
export const POSITION_RECOMMENDED_MAX_COUNT = 30;
const POSITION_TOTAL_QUESTION_COUNT = POSITION_BASE_QUESTION_COUNT + POSITION_RECOMMENDED_MAX_COUNT;

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
// 영상 예시(재/제/쥐/취, 돼) 기준으로 겹모음1 우선군
const STAGE_COMPOUND_VOWEL_1 = ["ㅐ", "ㅔ", "ㅙ", "ㅚ", "ㅟ", "ㅞ"] as const;
// 영상 예시(샤/셔/쇼/슈, 죠) 기준으로 겹모음2 우선군
const STAGE_COMPOUND_VOWEL_2 = ["ㅑ", "ㅕ", "ㅛ", "ㅠ", "ㅒ", "ㅖ"] as const;
const STAGE_COMPLEX_FINAL = ["ㄳ", "ㄵ", "ㄶ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅄ"] as const;
const DEFAULT_POSITION_STAGES: PositionStage[] = [
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

const createEmptyPositionStageMap = (): Record<PositionStage, string[]> => ({
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

const normalizePositionStageMap = (
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

const createPositionSyllableFromStages = (
  stages: PositionStage[],
  excludedMap?: Record<PositionStage, string[]>
): string => {
  const pool = stages.length > 0 ? stages : DEFAULT_POSITION_STAGES;
  const stage = pick(pool);
  const excludedSet = new Set(excludedMap?.[stage] ?? []);
  if (excludedSet.size === 0) {
    return createPositionSyllable(stage);
  }
  for (let i = 0; i < 40; i++) {
    const next = createPositionSyllable(stage);
    if (!excludedSet.has(next)) return next;
  }
  return createPositionSyllable(stage);
};


export const useTypingStore = create<TypingState>()(
  persist(
    (set, get) => ({
      inputText: "",
      shuffledWords: [],
      sentences: [],
      randomLetters: [],
      currentWordIndex: 0,
      currentSentenceIndex: 0,
      currentLetterIndex: 0,
      typedWord: "",
      lastSentenceTyped: "",
      correctCount: 0,
      incorrectCount: 0,
      incorrectWords: [],
      totalCount: 0,
      progressCount: 0,
      mode: "words",
      positionEnabledStages: DEFAULT_POSITION_STAGES,
      positionStageExcludedChars: createEmptyPositionStageMap(),
      positionStageExcludeHistory: createEmptyPositionStageMap(),
      speechRate: cpsToRate(3),
      isSoundEnabled: true,
      isPracticing: false,

      // ????먯닔 珥덇린媛?
      currentWordStartTime: null,
      currentWordKeystrokes: 0,

      // ?쒖감 ?쒖떆 珥덇린媛?(蹂닿퀬移섎씪)
      sequentialText: "",
      displayedCharIndices: new Set<number>(),
      sequentialSpeed: 333, // 333ms per character (180??遺?湲곕낯媛?
      randomizedIndices: [],
      currentDisplayIndex: 0,

      updateInputText: (text) => set({ inputText: text }),
      updateTypedWord: (text) => set({ typedWord: text }),
      switchMode: (mode) => set({ mode }),
      setPositionEnabledStages: (positionEnabledStages) => set({ positionEnabledStages }),
      switchPositionStageImmediately: (stage) =>
        set((state) => {
          const nextStages: PositionStage[] = [stage];
          if (state.mode !== "position" || !state.isPracticing) {
            return { positionEnabledStages: nextStages };
          }

          const startIdx = Math.max(0, Math.min(state.currentWordIndex, Math.max(state.shuffledWords.length - 1, 0)));
          const remainingCount = Math.max(1, state.shuffledWords.length - startIdx);
          const nextTail = Array.from(
            { length: remainingCount },
            () => createPositionSyllableFromStages(nextStages, state.positionStageExcludedChars)
          );

          return {
            positionEnabledStages: nextStages,
            shuffledWords: [...state.shuffledWords.slice(0, startIdx), ...nextTail],
            typedWord: "",
            currentWordStartTime: null,
            currentWordKeystrokes: 0,
          };
        }),
      addPositionExcludedChar: (stage, char) =>
        set((state) => {
          const target = (char || "").trim();
          if (!target) return state;
          const currentStageExcluded = state.positionStageExcludedChars[stage] ?? [];
          const currentStageHistory = state.positionStageExcludeHistory[stage] ?? [];
          if (currentStageExcluded.includes(target)) return state;
          return {
            positionStageExcludedChars: {
              ...state.positionStageExcludedChars,
              [stage]: [...currentStageExcluded, target],
            },
            positionStageExcludeHistory: {
              ...state.positionStageExcludeHistory,
              [stage]: [...currentStageHistory, target],
            },
          };
        }),
      removePositionExcludedChar: (stage, char) =>
        set((state) => ({
          positionStageExcludedChars: {
            ...state.positionStageExcludedChars,
            [stage]: (state.positionStageExcludedChars[stage] ?? []).filter((v) => v !== char),
          },
        })),
      regeneratePositionQueueFromCurrent: () =>
        set((state) => {
          if (state.mode !== "position" || !state.isPracticing) return state;
          const keepUntil = Math.max(0, Math.min(state.currentWordIndex + 1, state.shuffledWords.length));
          const remainingCount = Math.max(0, state.shuffledWords.length - keepUntil);
          const nextTail = Array.from(
            { length: remainingCount },
            () => createPositionSyllableFromStages(state.positionEnabledStages, state.positionStageExcludedChars)
          );
          return {
            shuffledWords: [...state.shuffledWords.slice(0, keepUntil), ...nextTail],
          };
        }),
      injectPositionRecommendedWords: (recommendedWords) =>
        set((state) => {
          if (state.mode !== "position" || !state.isPracticing) return state;
          const baseWords = state.shuffledWords.slice(0, POSITION_BASE_QUESTION_COUNT);
          if (baseWords.length === 0) return state;
          const normalizedRecommended = recommendedWords.map(toSingleHangul).filter((v) => v.length === 1);
          const normalizedBaseWords = baseWords.map(toSingleHangul).filter((v) => v.length === 1);
          const fallbackPool = normalizedBaseWords.length > 0 ? normalizedBaseWords : normalizedRecommended;
          if (fallbackPool.length === 0) return state;
          const desiredTailCount = Math.max(
            POSITION_RECOMMENDED_MIN_COUNT,
            Math.min(POSITION_RECOMMENDED_MAX_COUNT, normalizedRecommended.length)
          );
          const tailWords = Array.from({ length: desiredTailCount }, (_, idx) =>
            normalizedRecommended[idx] || fallbackPool[idx % fallbackPool.length]
          );
          return {
            shuffledWords: [...baseWords, ...tailWords],
            totalCount: baseWords.length + tailWords.length,
          };
        }),
      changeSpeechRate: (rate) => set({ speechRate: rate }),
      toggleSound: () => set((state) => ({ isSoundEnabled: !state.isSoundEnabled })),
      startCurrentWordTracking: () => set({
        currentWordStartTime: Date.now()
      }),
      incrementCurrentWordKeystrokes: () => set((state) => ({
        currentWordKeystrokes: state.currentWordKeystrokes + 1
      })),
      resetCurrentWordTracking: () => set({
        currentWordStartTime: null,
        currentWordKeystrokes: 0
      }),

      // ?쒖감 ?쒖떆 ?≪뀡 援ы쁽
      addDisplayedCharIndex: (index) => set((state) => {
        const newSet = new Set(state.displayedCharIndices);
        newSet.add(index);
        return { displayedCharIndices: newSet };
      }),
      updateSequentialSpeed: (speed) => set({ sequentialSpeed: speed }),
      resetSequential: () => set({
        sequentialText: "",
        displayedCharIndices: new Set<number>(),
        randomizedIndices: [],
        currentDisplayIndex: 0,
      }),
      incrementDisplayIndex: () => set((state) => ({
        currentDisplayIndex: state.currentDisplayIndex + 1
      })),

      setSentences: (sentences) => set({ sentences }),
      addSentence: (sentence) => set((state) => ({
        sentences: [...state.sentences, sentence],
      })),
      setTotalCount: (count) => set({ totalCount: count }),

      resumeSentencePractice: (saved) => set({
        sentences: saved.sentences,
        currentSentenceIndex: saved.currentSentenceIndex,
        progressCount: saved.progressCount,
        correctCount: saved.correctCount,
        incorrectCount: saved.incorrectCount,
        incorrectWords: saved.incorrectWords,
        totalCount: saved.totalCount,
        isPracticing: true,
        typedWord: "",
        currentWordStartTime: null,
        currentWordKeystrokes: 0,
      }),

      restartSequentialPractice: () => {
        const state = get();
        // 湲곗〈 ?띿뒪?몃? ?좎??섎㈃???덈줈???쒕뜡 ?쒖꽌濡??ъ떆??
        // 湲?湲 紐⑤뱶: ?꾩뼱?곌린 ?좎?, 蹂닿퀬移섎씪 紐⑤뱶: ?꾩뼱?곌린 ?쒓굅
        const text = state.mode === "longtext"
          ? state.inputText
          : state.inputText.replace(/\s+/g, '');
        const indices = Array.from({ length: text.length }, (_, i) => i);
        const shuffledIndices = state.mode === "longtext"
          ? indices  // 湲?湲 紐⑤뱶: ?쒖꽌?濡?
          : [...indices].sort(() => Math.random() - 0.5);  // 蹂닿퀬移섎씪 紐⑤뱶: ?쒕뜡

        set({
          sequentialText: text,
          displayedCharIndices: new Set<number>(),
          randomizedIndices: shuffledIndices,
          currentDisplayIndex: 0,
          typedWord: "",
          currentWordStartTime: null,
          currentWordKeystrokes: 0,
        });
      },

      startPractice: (words) => {
        const state = get();

        if (state.mode === "sequential" || state.mode === "longtext") {
          // 蹂닿퀬移섎씪: ?꾩뼱?곌린 ?쒓굅, 湲?湲: ?꾩뼱?곌린 ?좎?
          const text = state.mode === "longtext"
            ? state.inputText
            : state.inputText.replace(/\s+/g, '');
          const indices = Array.from({ length: text.length }, (_, i) => i);
          const finalIndices = state.mode === "longtext"
            ? indices  // 湲?湲 紐⑤뱶: ?쒖꽌?濡?
            : [...indices].sort(() => Math.random() - 0.5);  // 蹂닿퀬移섎씪 紐⑤뱶: ?쒕뜡

          set({
            sequentialText: text,
            displayedCharIndices: new Set<number>(),
            randomizedIndices: finalIndices,
            currentDisplayIndex: 0,
            isPracticing: true,
            correctCount: 0,
            incorrectCount: 0,
            incorrectWords: [],
            totalCount: 0,
            progressCount: 0,
            currentWordStartTime: null,
            currentWordKeystrokes: 0,
          });
        } else {
          // 湲곗〈 紐⑤뱶??
          const allLetters = words.flatMap((word) => word.trim().split(""));
          const uniqueLetters = [...new Set(allLetters)];
          const shuffledLetters = [...uniqueLetters].sort(
            () => Math.random() - 0.5
          );
          const generatedPositionChars = Array.from(
            { length: POSITION_TOTAL_QUESTION_COUNT },
            () => createPositionSyllableFromStages(state.positionEnabledStages, state.positionStageExcludedChars)
          );
          const practiceWords = state.mode === "position"
            ? generatedPositionChars
            : [...words].sort(() => Math.random() - 0.5);

          set({
            shuffledWords: practiceWords,
            sentences: state.sentences,
            randomLetters: shuffledLetters,
            currentWordIndex: 0,
            currentSentenceIndex: 0,
            currentLetterIndex: 0,
            typedWord: "",
            correctCount: 0,
            incorrectCount: 0,
            incorrectWords: [],
            totalCount:
              state.mode === "position"
                ? POSITION_TOTAL_QUESTION_COUNT
                : state.mode === "random"
                ? shuffledLetters.length
                : practiceWords.length,
            progressCount: 0,
            isPracticing: true,
            currentWordStartTime: null,
            currentWordKeystrokes: 0,
          });
        }
      },

      stopPractice: () => {
        set({
          shuffledWords: [],
          randomLetters: [],
          currentWordIndex: 0,
          currentLetterIndex: 0,
          typedWord: "",
          correctCount: 0,
          incorrectCount: 0,
          incorrectWords: [],
          totalCount: 0,
          progressCount: 0,
          isPracticing: false,
          currentWordStartTime: null,
          currentWordKeystrokes: 0,
          sequentialText: "",
          displayedCharIndices: new Set<number>(),
          randomizedIndices: [],
          currentDisplayIndex: 0,
        });
      },

      removeIncorrectWord: (word: string, typed: string) =>
        set((state) => {
          const filtered = state.incorrectWords.filter(
            (item) => !(item.word === word && item.typed === typed)
          );
          return {
            incorrectWords: filtered,
            incorrectCount: filtered.length,
          };
        }),

      submitAnswer: (input) => {
        const {
          mode,
          shuffledWords,
          sentences,
          randomLetters,
          currentWordIndex,
          currentSentenceIndex,
          currentLetterIndex,
          positionEnabledStages,
        } = get();

        const trimmedInput = mode === "sentences"
          ? input.trim()
          : removeWhitespace(input);
        const target =
          (mode === "words" || mode === "position")
            ? removeWhitespace(shuffledWords[currentWordIndex] ?? "")
            : mode === "sentences"
            ? sentences[currentSentenceIndex].trim()
            : randomLetters[currentLetterIndex];

        const isCorrect = trimmedInput === target;

        set((state) => {
          const isLastItem = state.progressCount + 1 >= state.totalCount && state.totalCount > 0;
          let nextShuffledWords = state.shuffledWords;
          let nextWordIndex = state.currentWordIndex;
          let nextProgressCount = state.progressCount + 1;
          let nextTotalCount = state.totalCount;

          if (mode === "position") {
            if (isLastItem) {
              // 40媛?30+10)瑜?留덉튂硫?利됱떆 ?ㅼ쓬 ?ъ씠????30臾몄젣 + 異붿쿇 10 以鍮?濡??꾪솚
              nextWordIndex = 0;
              nextProgressCount = 0;
                nextTotalCount = POSITION_TOTAL_QUESTION_COUNT;
                nextShuffledWords = Array.from(
                  { length: POSITION_TOTAL_QUESTION_COUNT },
                  () => createPositionSyllableFromStages(positionEnabledStages, state.positionStageExcludedChars)
                );
            } else {
              nextWordIndex = state.currentWordIndex + 1;
            }
          } else if (mode === "words") {
            nextWordIndex = isLastItem
              ? state.currentWordIndex
              : (state.currentWordIndex + 1) % Math.max(state.shuffledWords.length, 1);
          }

          return {
            correctCount: isCorrect ? state.correctCount + 1 : state.correctCount,
            incorrectCount: !isCorrect
              ? state.incorrectCount + 1
              : state.incorrectCount,
            incorrectWords: !isCorrect
              ? [...state.incorrectWords, { word: target, typed: input.trim() }]
              : state.incorrectWords,
            shuffledWords: nextShuffledWords,
            currentWordIndex: mode === "words" || mode === "position" ? nextWordIndex : state.currentWordIndex,
            currentSentenceIndex:
              mode === "sentences"
                ? isLastItem ? state.currentSentenceIndex : (state.currentSentenceIndex + 1) % Math.max(state.sentences.length, 1)
                : state.currentSentenceIndex,
            currentLetterIndex:
              mode === "random"
                ? (state.currentLetterIndex + 1) % Math.max(state.randomLetters.length, 1)
                : state.currentLetterIndex,
            typedWord: "",
            lastSentenceTyped: mode === "sentences" ? input.trim() : state.lastSentenceTyped,
            progressCount: nextProgressCount,
            totalCount: nextTotalCount,
          };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      merge: (persistedState, currentState) => {
        const typed = persistedState as Partial<TypingState> | undefined;
        return {
          ...currentState,
          ...typed,
          positionStageExcludedChars: normalizePositionStageMap(typed?.positionStageExcludedChars),
          positionStageExcludeHistory: normalizePositionStageMap(typed?.positionStageExcludeHistory),
        };
      },
      partialize: (state) => ({
        inputText: state.inputText,
        mode: state.mode,
        positionEnabledStages: state.positionEnabledStages,
        positionStageExcludedChars: state.positionStageExcludedChars,
        positionStageExcludeHistory: state.positionStageExcludeHistory,
        speechRate: state.speechRate,
        isSoundEnabled: state.isSoundEnabled,
        sequentialSpeed: state.sequentialSpeed,
      }),
    }
  )
);

