import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEY } from "../constants";
import { cpsToRate } from "../utils/speechUtils";
import type { Mode } from "../types/mode";
import { splitLongTextSentences } from "../modes/longtext/utils/splitLongTextSentences";
import { removeWhitespace, toSingleHangul } from "../modes/position/utils/textNormalize";
import {
  POSITION_BASE_QUESTION_COUNT,
  POSITION_RECOMMENDED_MAX_COUNT,
  POSITION_RECOMMENDED_MIN_COUNT,
  POSITION_TOTAL_QUESTION_COUNT,
} from "../modes/position/config";
import {
  createEmptyPositionStageMap,
  createPositionSyllableFromStages,
  DEFAULT_POSITION_STAGES,
  normalizePositionStageMap,
} from "../modes/position/syllables";
import type { PositionStage } from "../modes/position/types";
import type { IncorrectEntry } from "../modes/words/types";

export type { Mode } from "../types/mode";
export type { PositionDifficulty, PositionStage } from "../modes/position/types";

export type { IncorrectEntry } from "../modes/words/types";

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
  halfCorrectCount: number;
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

  // 타이핑 횟수 추적 (현재 단어 기준)
  currentWordStartTime: number | null;
  currentWordKeystrokes: number;

  // 순차 표시 모드 (보고치라)
  sequentialText: string;
  displayedCharIndices: Set<number>; // 이미 표시된 글자의 인덱스들
  sequentialSpeed: number; // ms per character
  randomizedIndices: number[]; // 랜덤 순서로 표시할 글자의 인덱스
  currentDisplayIndex: number; // 현재까지 표시된 글자 개수

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

  // 순차 표시 액션
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
      halfCorrectCount: 0,
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

      // 타이핑 횟수 초기값
      currentWordStartTime: null,
      currentWordKeystrokes: 0,

      // 순차 표시 초기값 (보고치라)
      sequentialText: "",
      displayedCharIndices: new Set<number>(),
      sequentialSpeed: 333, // 333ms per character (180타 기본값)
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

      // 순차 표시 액션 구현
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
        if (state.mode === "longtext") {
          // 긴글모드: 문장 단위로 분리
          const finalSentences = splitLongTextSentences(state.inputText);

          set({
            sentences: finalSentences,
            currentSentenceIndex: 0,
            typedWord: "",
            lastSentenceTyped: "",
            correctCount: 0,
            incorrectCount: 0,
            incorrectWords: [],
            totalCount: finalSentences.length,
            progressCount: 0,
            currentWordStartTime: null,
            currentWordKeystrokes: 0,
          });
        } else {
          // 보고치라: 텍스트 글자 기반 랜덤 인덱스 생성
          const text = state.inputText.replace(/\s+/g, '');
          const indices = Array.from({ length: text.length }, (_, i) => i);
          const shuffledIndices = [...indices].sort(() => Math.random() - 0.5);

          set({
            sequentialText: text,
            displayedCharIndices: new Set<number>(),
            randomizedIndices: shuffledIndices,
            currentDisplayIndex: 0,
            typedWord: "",
            currentWordStartTime: null,
            currentWordKeystrokes: 0,
          });
        }
      },

      startPractice: (words) => {
        const state = get();

        if (state.mode === "sequential" || state.mode === "longtext") {
          if (state.mode === "longtext") {
            // 긴글모드: 문장 단위로 분리하여 sentences에 저장
            const finalSentences = splitLongTextSentences(state.inputText);

            set({
              sentences: finalSentences,
              currentSentenceIndex: 0,
              isPracticing: true,
              correctCount: 0,
              halfCorrectCount: 0,
              incorrectCount: 0,
              incorrectWords: [],
              totalCount: finalSentences.length,
              progressCount: 0,
              currentWordStartTime: null,
              currentWordKeystrokes: 0,
              typedWord: "",
              lastSentenceTyped: "",
            });
          } else {
            // 보고치라: 랜덤 순서로 인덱스 생성
            const text = state.inputText.replace(/\s+/g, '');
            const indices = Array.from({ length: text.length }, (_, i) => i);
            const finalIndices = [...indices].sort(() => Math.random() - 0.5);

            set({
              sequentialText: text,
              displayedCharIndices: new Set<number>(),
              randomizedIndices: finalIndices,
              currentDisplayIndex: 0,
              isPracticing: true,
              correctCount: 0,
              halfCorrectCount: 0,
              incorrectCount: 0,
              incorrectWords: [],
              totalCount: 0,
              progressCount: 0,
              currentWordStartTime: null,
              currentWordKeystrokes: 0,
            });
          }
        } else {
          // 기존 모드
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
            halfCorrectCount: 0,
            incorrectCount: 0,
            incorrectWords: [],
            totalCount:
              state.mode === "position"
                ? POSITION_TOTAL_QUESTION_COUNT
                : state.mode === "random"
                ? shuffledLetters.length
                : state.mode === "sentences"
                ? 0  // 문장 모드: 생성 완료 후 setTotalCount로 설정
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
          halfCorrectCount: 0,
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

        const trimmedInput = (mode === "sentences" || mode === "longtext")
          ? input.trim()
          : removeWhitespace(input);
        const target =
          (mode === "words" || mode === "position")
            ? removeWhitespace(shuffledWords[currentWordIndex] ?? "")
            : (mode === "sentences" || mode === "longtext")
            ? (sentences[currentSentenceIndex] ?? "").trim()
            : randomLetters[currentLetterIndex];

        // 단어 매칭: 3단계 비교 (일치/반칙/불일치)
        const isExactMatch = trimmedInput === target;
        const isEndsWith = !isExactMatch && trimmedInput.endsWith(target) && target.length > 0;
        const isCorrect = isExactMatch || isEndsWith;

        set((state) => {
          const isLastItem = state.progressCount + 1 >= state.totalCount && state.totalCount > 0;
          let nextShuffledWords = state.shuffledWords;
          let nextWordIndex = state.currentWordIndex;
          let nextProgressCount = state.progressCount + 1;
          let nextTotalCount = state.totalCount;

          if (mode === "position") {
            if (isLastItem) {
              // 40문제(30+10)를 마치면 즉시 다음 사이클 시작: 30문제 + 추천 10 준비하여 반환
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

          // 단어 매칭: 반칙(endsWith로 일치)은 incorrectWords에 추가 (틀린 것 취급)
          const isHalf = mode === "words" && isEndsWith;
          const isIncorrect = !isCorrect;

          return {
            correctCount: isExactMatch ? state.correctCount + 1 : state.correctCount,
            halfCorrectCount: isHalf ? state.halfCorrectCount + 1 : state.halfCorrectCount,
            incorrectCount: isIncorrect
              ? state.incorrectCount + 1
              : state.incorrectCount,
            incorrectWords: (isHalf || isIncorrect)
              ? [...state.incorrectWords, { word: target, typed: input.trim(), resultType: (isHalf ? "half" : "incorrect") as "half" | "incorrect" }]
              : state.incorrectWords,
            shuffledWords: nextShuffledWords,
            currentWordIndex: mode === "words" || mode === "position" ? nextWordIndex : state.currentWordIndex,
            currentSentenceIndex:
              (mode === "sentences" || mode === "longtext")
                ? isLastItem ? state.currentSentenceIndex : Math.min(state.currentSentenceIndex + 1, Math.max(state.sentences.length - 1, 0))
                : state.currentSentenceIndex,
            currentLetterIndex:
              mode === "random"
                ? (state.currentLetterIndex + 1) % Math.max(state.randomLetters.length, 1)
                : state.currentLetterIndex,
            typedWord: "",
            lastSentenceTyped: (mode === "sentences" || mode === "longtext") ? input.trim() : state.lastSentenceTyped,
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
        sentences: state.sentences,
        currentSentenceIndex: state.currentSentenceIndex,
        // 문장모드 진행 상태 persist (새로고침 후 자동 재개됨)
        progressCount: state.mode === "sentences" ? state.progressCount : undefined,
        correctCount: state.mode === "sentences" ? state.correctCount : undefined,
        incorrectCount: state.mode === "sentences" ? state.incorrectCount : undefined,
        incorrectWords: state.mode === "sentences" ? state.incorrectWords : undefined,
        totalCount: state.mode === "sentences" ? state.totalCount : undefined,
        isPracticing: state.mode === "sentences" ? state.isPracticing : undefined,
      }),
    }
  )
);



