import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEY } from "../constants";

export type Mode = "words" | "sentences" | "random";

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
  isPracticing: boolean;

  updateInputText: (text: string) => void;
  updateTypedWord: (text: string) => void;
  switchMode: (mode: Mode) => void;
  changeSpeechRate: (rate: number) => void;

  startPractice: (words: string[]) => void;
  stopPractice: () => void;
  submitAnswer: (input: string) => void;
}

const removeWhitespace = (text: string): string => text.replace(/\s+/g, "");

const generateSentences = (words: string[]): string[] => {
  return words.flatMap((word) => [
    `최근 ${word}와 관련된 연구가 활발히 이루어지고 있습니다.`,
    `문제를 분석할 때 ${word}의 개념을 적용해볼 수 있습니다.`,
    `이런 접근 방식은 특히 ${word}에서 자주 쓰입니다.`,
    `현대 사회에서 ${word}은 중요한 역할을 합니다.`,
    `우리는 ${word}를 학습하며, ${word}에 대해 더 깊이 이해하게 됩니다.`,
    `${word}는 시작이고, ${word}는 과정이며, ${word}는 결과입니다.`,
    `많은 기업들이 핵심 역량으로 삼고 있는 것이 ${word}입니다.`,
    `복잡해 보이지만 핵심은 언제나 ${word}입니다.`,
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
      speechRate: 1,
      isPracticing: false,

      updateInputText: (text) => set({ inputText: text }),
      updateTypedWord: (text) => set({ typedWord: text }),
      switchMode: (mode) => set({ mode }),
      changeSpeechRate: (rate) => set({ speechRate: rate }),

      startPractice: (words) => {
        const uniqueWords = [...new Set(words)];
        const randomLetters = uniqueWords.flatMap((word) => word.split(""));
        const shuffledLetters = [...randomLetters].sort(
          () => Math.random() - 0.5
        );

        set((state) => ({
          shuffledWords: [...words].sort(() => Math.random() - 0.5),
          sentences: generateSentences(words).sort(() => Math.random() - 0.5),
          randomLetters: shuffledLetters,
          currentWordIndex: 0,
          currentSentenceIndex: 0,
          currentLetterIndex: 0,
          typedWord: "",
          correctCount: 0,
          incorrectCount: 0,
          incorrectWords: [],
          totalCount:
            state.mode === "random" ? shuffledLetters.length : words.length,
          progressCount: 0,
          isPracticing: true,
        }));
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
          isPracticing: false,
        });
      },

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
        incorrectWords: state.incorrectWords,
        correctCount: state.correctCount,
        incorrectCount: state.incorrectCount,
        totalCount: state.totalCount,
        progressCount: state.progressCount,
        isPracticing: state.isPracticing,
        mode: state.mode,
        shuffledWords: state.shuffledWords,
        sentences: state.sentences,
        randomLetters: state.randomLetters,
        currentWordIndex: state.currentWordIndex,
        currentSentenceIndex: state.currentSentenceIndex,
        currentLetterIndex: state.currentLetterIndex,
      }),
    }
  )
);
