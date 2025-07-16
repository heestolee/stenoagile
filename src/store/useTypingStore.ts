// src/store/useTypingStore.ts
import { create } from "zustand";

export type Mode = "words" | "sentences";

export interface IncorrectEntry {
  word: string;
  typed: string;
}

interface TypingState {
  inputText: string;
  shuffledWords: string[];
  sentences: string[];
  currentWordIndex: number;
  currentSentenceIndex: number;
  typedWord: string;
  correctCount: number;
  incorrectCount: number;
  incorrectWords: IncorrectEntry[];
  mode: Mode;
  speechRate: number;

  // 추상화된 액션
  updateInputText: (text: string) => void;
  updateTypedWord: (text: string) => void;
  switchMode: (mode: Mode) => void;
  changeSpeechRate: (rate: number) => void;

  startPractice: (words: string[]) => void;
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

export const useTypingStore = create<TypingState>((set, get) => ({
  inputText: "",
  shuffledWords: [],
  sentences: [],
  currentWordIndex: 0,
  currentSentenceIndex: 0,
  typedWord: "",
  correctCount: 0,
  incorrectCount: 0,
  incorrectWords: [],
  mode: "words",
  speechRate: 1,

  // 추상화된 setter
  updateInputText: (text) => set({ inputText: text }),
  updateTypedWord: (text) => set({ typedWord: text }),
  switchMode: (mode) => set({ mode }),
  changeSpeechRate: (rate) => set({ speechRate: rate }),

  // 연습 시작
  startPractice: (words) => {
    set({
      shuffledWords: [...words].sort(() => Math.random() - 0.5),
      sentences: generateSentences(words).sort(() => Math.random() - 0.5),
      currentWordIndex: 0,
      currentSentenceIndex: 0,
      typedWord: "",
      correctCount: 0,
      incorrectCount: 0,
      incorrectWords: [],
    });
  },

  // 제출 처리
  submitAnswer: (input) => {
    const {
      mode,
      shuffledWords,
      sentences,
      currentWordIndex,
      currentSentenceIndex,
    } = get();

    const trimmedInput = removeWhitespace(input);
    const target =
      mode === "words"
        ? removeWhitespace(shuffledWords[currentWordIndex])
        : removeWhitespace(sentences[currentSentenceIndex]);

    const isCorrect = trimmedInput === target;

    set((state) => ({
      correctCount: isCorrect ? state.correctCount + 1 : state.correctCount,
      incorrectCount: !isCorrect
        ? state.incorrectCount + 1
        : state.incorrectCount,
      incorrectWords: !isCorrect
        ? [
            ...state.incorrectWords,
            {
              word:
                mode === "words"
                  ? shuffledWords[currentWordIndex]
                  : sentences[currentSentenceIndex],
              typed: input.trim(),
            },
          ]
        : state.incorrectWords,
      currentWordIndex:
        mode === "words"
          ? (currentWordIndex + 1) % shuffledWords.length
          : currentWordIndex,
      currentSentenceIndex:
        mode === "sentences"
          ? (currentSentenceIndex + 1) % sentences.length
          : currentSentenceIndex,
      typedWord: "",
    }));
  },
}));
