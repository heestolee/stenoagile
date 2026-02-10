import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEY } from "../constants";
import { cpsToRate } from "../utils/speechUtils";

export type Mode = "words" | "sentences" | "longtext" | "random" | "sequential";

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
  speechRate: number;
  isSoundEnabled: boolean;
  isPracticing: boolean;

  // 타수/자수 추적 (현재 단어 기준)
  currentWordStartTime: number | null;
  currentWordKeystrokes: number;

  // 순차 표시 모드 (보고치라)
  sequentialText: string;
  displayedCharIndices: Set<number>; // 이미 표시된 글자의 인덱스들
  sequentialSpeed: number; // ms per character
  randomizedIndices: number[]; // 랜덤 순서로 표시할 글자 인덱스
  currentDisplayIndex: number; // 현재까지 표시한 글자 개수

  updateInputText: (text: string) => void;
  updateTypedWord: (text: string) => void;
  switchMode: (mode: Mode) => void;
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

  setSentences: (sentences: string[]) => void;
  startPractice: (words: string[]) => void;
  stopPractice: () => void;
  submitAnswer: (input: string) => void;
}

const removeWhitespace = (text: string): string => text.replace(/\s+/g, "");

const generateSentences = (words: string[]): string[] => {
  return words.flatMap((word) => [
    `"${word}"이라는 표현을 연습해 봅시다.`,
    `다음 문장에서 "${word}"을 찾아보세요.`,
    `"${word}"은 다양한 문맥에서 사용됩니다.`,
    `선생님이 "${word}"을 칠판에 적었습니다.`,
    `시험 범위에 "${word}"이 포함되어 있습니다.`,
    `"${word}"을 정확하게 입력해 보세요.`,
    `오늘 배울 내용은 "${word}"입니다.`,
    `"${word}"을 활용한 문장을 만들어 보세요.`,
  ]);
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
      correctCount: 0,
      incorrectCount: 0,
      incorrectWords: [],
      totalCount: 0,
      progressCount: 0,
      mode: "words",
      speechRate: cpsToRate(3),
      isSoundEnabled: true,
      isPracticing: false,

      // 타수/자수 초기값
      currentWordStartTime: null,
      currentWordKeystrokes: 0,

      // 순차 표시 초기값 (보고치라)
      sequentialText: "",
      displayedCharIndices: new Set<number>(),
      sequentialSpeed: 333, // 333ms per character (180자/분 기본값)
      randomizedIndices: [],
      currentDisplayIndex: 0,

      updateInputText: (text) => set({ inputText: text }),
      updateTypedWord: (text) => set({ typedWord: text }),
      switchMode: (mode) => set({ mode }),
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

      restartSequentialPractice: () => {
        const state = get();
        // 기존 텍스트를 유지하면서 새로운 랜덤 순서로 재시작
        // 긴 글 모드: 띄어쓰기 유지, 보고치라 모드: 띄어쓰기 제거
        const text = state.mode === "longtext"
          ? state.inputText
          : state.inputText.replace(/\s+/g, '');
        const indices = Array.from({ length: text.length }, (_, i) => i);
        const shuffledIndices = state.mode === "longtext"
          ? indices  // 긴 글 모드: 순서대로
          : [...indices].sort(() => Math.random() - 0.5);  // 보고치라 모드: 랜덤

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
          // 보고치라: 띄어쓰기 제거, 긴 글: 띄어쓰기 유지
          const text = state.mode === "longtext"
            ? state.inputText
            : state.inputText.replace(/\s+/g, '');
          const indices = Array.from({ length: text.length }, (_, i) => i);
          const finalIndices = state.mode === "longtext"
            ? indices  // 긴 글 모드: 순서대로
            : [...indices].sort(() => Math.random() - 0.5);  // 보고치라 모드: 랜덤

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
          // 기존 모드들
          const allLetters = words.flatMap((word) => word.trim().split(""));
          const uniqueLetters = [...new Set(allLetters)];
          const shuffledLetters = [...uniqueLetters].sort(
            () => Math.random() - 0.5
          );

          // 문장 모드: AI 문장이 이미 setSentences로 주입되었으면 그것을 사용
          const currentSentences = state.sentences.length > 0
            ? state.sentences
            : generateSentences(words).sort(() => Math.random() - 0.5);

          set({
            shuffledWords: [...words].sort(() => Math.random() - 0.5),
            sentences: currentSentences,
            randomLetters: shuffledLetters,
            currentWordIndex: 0,
            currentSentenceIndex: 0,
            currentLetterIndex: 0,
            typedWord: "",
            correctCount: 0,
            incorrectCount: 0,
            incorrectWords: [],
            totalCount:
              state.mode === "sentences"
                ? currentSentences.length
                : state.mode === "random"
                ? shuffledLetters.length
                : words.length,
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
          sentences: [],
          randomLetters: [],
          currentWordIndex: 0,
          currentSentenceIndex: 0,
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
        } = get();

        const trimmedInput = removeWhitespace(input);
        const target =
          mode === "words"
            ? removeWhitespace(shuffledWords[currentWordIndex])
            : mode === "sentences"
            ? removeWhitespace(sentences[currentSentenceIndex])
            : randomLetters[currentLetterIndex];

        const isCorrect = trimmedInput === target;

        set((state) => ({
          correctCount: isCorrect ? state.correctCount + 1 : state.correctCount,
          incorrectCount: !isCorrect
            ? state.incorrectCount + 1
            : state.incorrectCount,
          incorrectWords: !isCorrect
            ? [...state.incorrectWords, { word: target, typed: input.trim() }]
            : state.incorrectWords,
          currentWordIndex:
            mode === "words"
              ? (currentWordIndex + 1) % shuffledWords.length
              : currentWordIndex,
          currentSentenceIndex:
            mode === "sentences"
              ? (currentSentenceIndex + 1) % sentences.length
              : currentSentenceIndex,
          currentLetterIndex:
            mode === "random"
              ? (currentLetterIndex + 1) % randomLetters.length
              : currentLetterIndex,
          typedWord: "",
          progressCount: state.progressCount + 1,
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        inputText: state.inputText,
        mode: state.mode,
        speechRate: state.speechRate,
        isSoundEnabled: state.isSoundEnabled,
        sequentialSpeed: state.sequentialSpeed,
      }),
    }
  )
);
