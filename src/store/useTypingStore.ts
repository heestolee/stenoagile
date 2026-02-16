import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEY } from "../constants";
import { cpsToRate } from "../utils/speechUtils";

export type Mode = "words" | "position" | "sentences" | "longtext" | "random" | "sequential";
export type PositionDifficulty = "beginner" | "intermediate" | "advanced" | "random";

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
  positionDifficulty: PositionDifficulty;
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
  setPositionDifficulty: (difficulty: PositionDifficulty) => void;
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

const randomInt = (max: number): number => Math.floor(Math.random() * max);
const pick = <T>(arr: readonly T[]): T => arr[randomInt(arr.length)];

const BEGINNER_SYLLABLES = [
  "가", "나", "다", "라", "마", "바", "사", "아", "자", "차", "카", "타", "파", "하",
  "거", "너", "더", "러", "머", "버", "서", "어", "저", "처", "커", "터", "퍼", "허",
  "고", "노", "도", "로", "모", "보", "소", "오", "조", "초", "코", "토", "포", "호",
  "구", "누", "두", "루", "무", "부", "수", "우", "주", "추", "쿠", "투", "푸", "후",
] as const;

const INTERMEDIATE_SYLLABLES = [
  "개", "내", "대", "래", "매", "배", "새", "애", "재", "채", "태", "패", "해",
  "게", "네", "데", "레", "메", "베", "세", "에", "제", "체", "테", "페", "헤",
  "기", "니", "디", "리", "미", "비", "시", "이", "지", "치", "키", "티", "피", "히",
  "관", "전", "문", "학", "국", "민", "정", "보", "기", "술", "경", "제", "사", "회",
] as const;

const ADVANCED_SYLLABLES = [
  "읽", "넓", "삶", "앉", "않", "값", "몫", "젊", "짊", "싫",
  "권", "혁", "률", "념", "량", "형", "확", "획", "결", "렬",
  "왕", "왜", "외", "워", "웨", "위", "의", "얘", "예", "얽",
  "락", "력", "령", "룡", "률", "융", "괄", "괜", "괌", "괏",
] as const;

const createPositionSyllable = (difficulty: PositionDifficulty): string => {
  if (difficulty === "random") {
    const mixed = pick<Exclude<PositionDifficulty, "random">>(["beginner", "intermediate", "advanced"]);
    return createPositionSyllable(mixed);
  }
  if (difficulty === "beginner") {
    return pick(BEGINNER_SYLLABLES);
  }
  if (difficulty === "intermediate") {
    return pick(INTERMEDIATE_SYLLABLES);
  }
  return pick(ADVANCED_SYLLABLES);
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
      positionDifficulty: "random",
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
      setPositionDifficulty: (positionDifficulty) => set({ positionDifficulty }),
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
          const generatedPositionChars = Array.from(
            { length: Math.max(words.length, 60) },
            () => createPositionSyllable(state.positionDifficulty)
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
                ? 0
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
          positionDifficulty,
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

          if (mode === "position") {
            nextWordIndex = state.currentWordIndex + 1;
            if (nextWordIndex + 30 >= nextShuffledWords.length) {
              const appendCount = 60;
              const extra = Array.from(
                { length: appendCount },
                () => createPositionSyllable(positionDifficulty)
              );
              nextShuffledWords = [...nextShuffledWords, ...extra];
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
            progressCount: state.progressCount + 1,
          };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        inputText: state.inputText,
        mode: state.mode,
        positionDifficulty: state.positionDifficulty,
        speechRate: state.speechRate,
        isSoundEnabled: state.isSoundEnabled,
        sequentialSpeed: state.sequentialSpeed,
      }),
    }
  )
);
