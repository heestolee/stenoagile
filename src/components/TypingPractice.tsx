//테스트용 주석 추가
import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState, useMemo } from "react";
import { useTypingStore } from "../store/useTypingStore";
import { savedText1, savedText2, savedText5 } from "../constants";
import { GEMINI_MODEL_NAMES, SENTENCE_STYLES } from "../constants/uiConstants";
import { getFullMarkedText, getMarkedText, analyzeScoring, type FullMarkedChar, type MarkedChar, type ScoringResult } from "../utils/scoringAnalysis";
import { logResult, logSession } from "../utils/sheetLogger";
import { generateSentencesStream } from "../utils/generateSentencesAI";
import { useVideoPlayer } from "../hooks/useVideoPlayer";
import { useHeamiVoice } from "../hooks/useHeamiVoice";
import { useAIGeneration } from "../hooks/useAIGeneration";
import { useSlotManager } from "../hooks/useSlotManager";
import { useWordReview } from "../hooks/useWordReview";
import { useWordProficiency } from "../hooks/useWordProficiency";
import WordProficiencyPanel from "./WordProficiencyPanel";

// 경과 시간을 "분:초.밀리초" 형태로 포맷팅 (밀리초 단위 입력)
const formatTime = (ms: number): string => {
  const totalSeconds = ms / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
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
    speechRate,
    isSoundEnabled,
    updateInputText,
    updateTypedWord,
    switchMode,
    changeSpeechRate,
    toggleSound,
    removeIncorrectWord,
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

  const [showText, setShowText] = useState(true);
  const [lastResult, setLastResult] = useState({ kpm: 0, cpm: 0, elapsedTime: 0 });
  const [allResults, setAllResults] = useState<{ kpm: number, cpm: number, elapsedTime: number, chars: string }[]>([]);
  const sequentialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    selectedSlot, setSelectedSlot, slotNames, favoriteSlots,
    todayCompletedRounds, slotCompletedRoundsNormal, slotCompletedRoundsBatch,
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
  } = useWordProficiency();
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
    sentenceStyle, setSentenceStyle, aiModelNameRef,
    generateError, setGenerateError, generateAbortRef,
    apiCallCount, apiCallModels, incrementApiCallCount,
    setGenerateErrorWithRetry, getErrorMessage,
  } = useAIGeneration();
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


  // 단어/문장 모드 라운드 완료 감지
  useEffect(() => {
    // 복습 중에는 라운드 완료 방지
    if (isReviewActive) return;
    if (
      (mode === "words" || mode === "sentences") &&
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
      incrementCompletedRounds(practiceSlot, false);
    }
  }, [progressCount, totalCount, mode, isPracticing, isReviewActive]);


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
  const startNextRound = (completedSlot?: number | null, wasBatchMode?: boolean, nextSlot?: number) => {
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
        incrementCompletedRounds(completedSlot, wasBatchMode ?? false);
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
          : mode === "words" && isPracticing && shuffledWords[currentWordIndex]
            ? shuffledWords[currentWordIndex].trim()
            : null;

    const isMatch = autoSubmitTarget && !isAutoSubmittingRef.current && (
      mode === "words" || isReviewActive
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
        const target = mode === "words" ? shuffledWords[currentWordIndex] : autoSubmitTarget;
        const targetClean = target.replace(/\s+/g, '');
        const inputClean = value.replace(/\s+/g, '');
        const isCorrect = mode === "words"
          ? inputClean.endsWith(targetClean) && targetClean.length > 0
          : value.trim() === autoSubmitTarget;
        submitAnswer(value);
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
                startNextRound(practiceSlot, true);
                return;
              }
              startNextRound(practiceSlot, true);
            } else {
              resumeRound();
            }
            return;
          }
          // 보고치라 모드
          if (mode === "sequential") {
            if (isFullyComplete) {
              startNextRound(practiceSlot, false);
            } else {
              resumeRound();
            }
            return;
          }
          // 긴글 모드
          if (mode === "longtext") {
            if (isFullyComplete) {
              startNextRound(practiceSlot, false);
            } else {
              resumeRound();
            }
            return;
          }
          // 랜덤 모드
          if (mode === "random") {
            if (isFullyComplete) {
              startNextRound(practiceSlot, false);
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
      if (currentWordStartTime && currentWordKeystrokes > 0) {
        const elapsedMs = Date.now() - currentWordStartTime;

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
      if (mode === "words") {
        const target = shuffledWords[currentWordIndex];
        const targetClean = target.replace(/\s+/g, '');
        const inputClean = typedWord.replace(/\s+/g, '');
        const isCorrect = inputClean.endsWith(targetClean) && targetClean.length > 0;
        recordResult(targetClean, isCorrect);
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
      const words = inputText.trim().split("/").filter(Boolean);
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
            setGenerateError(null);
            setIsGenerating(true);
            setGeneratedCount(0);
            setAiModelName("");
            const abortController = new AbortController();
            generateAbortRef.current = abortController;
            const targetCount = words.length;
            const BATCH_SIZE = 2500; // 번호추적 프롬프트로 1회 호출에 최대 2500개 안정 생성
            let totalGenerated = 0;
            let started = false;
            const generateBatch = async (): Promise<void> => {
              const remaining = targetCount - totalGenerated;
              if (remaining <= 0) {
                setIsGenerating(false);
                generateAbortRef.current = null;
                setTotalCount(totalGenerated);
                return;
              }

              const batchCount = Math.min(BATCH_SIZE, remaining);

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
                async (batchTotal) => {
                  if (totalGenerated < targetCount && batchTotal > 0) {
                    // 아직 남았으면 다음 배치 호출 (출력 토큰 한도로 인한 분할)
                    await generateBatch();
                  } else {
                    setIsGenerating(false);
                    generateAbortRef.current = null;
                    setTotalCount(totalGenerated);
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
              );
            };

            try {
              await generateBatch();
            } catch (err) {
              if (err instanceof DOMException && err.name === "AbortError") return;
              setGenerateErrorWithRetry(err instanceof Error ? err.message : "문장 생성에 실패했습니다.");
              setIsDrawerOpen(true);
              setIsGenerating(false);
              generateAbortRef.current = null;
              if (totalGenerated > 0) setTotalCount(totalGenerated);
            }
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
          const batchChars = randomizedIndices
            .slice(batchStartIndex, endIndex)
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
      if (mode === "words" && shuffledWords.length > 0) {
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
      </div>

      <div className="flex flex-row gap-0">
        {/* 드로어 */}
        <div className={`transition-all duration-300 overflow-hidden flex-shrink-0 ${isDrawerOpen ? "w-80" : "w-0"}`}>
          <div className="w-80 space-y-4 pr-4">
            {/* 슬롯 버튼 (words/sentences 모드) */}
            {mode !== "random" && (
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => {
                    const name = slotNames[num] || `${num}`;
                    const len = name.length;
                    const fontSize = len <= 2 ? 'text-sm' : len <= 4 ? 'text-xs' : 'text-[10px]';
                    return (
                    <button
                      key={num}
                      className={`px-1 py-1 rounded relative overflow-hidden ${fontSize} leading-tight ${
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
                      <span className="block w-full text-center break-all">{name}</span>
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
            {(mode === "words" || mode === "sentences") && (
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
                          changeSpeechRate(rate);
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
          {(mode === "words" || mode === "sentences") && inputText.trim() && (
            <p className="text-xs text-gray-500">
              단어 {inputText.trim().split("/").filter(Boolean).length}개
            </p>
          )}
          {mode !== "random" && (
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
                <div className="text-xs text-gray-500 mt-1">
                  ({generatedCount}/{inputText.trim().split("/").filter(Boolean).length}){aiModelName ? ` [${aiModelName}]` : ""}
                </div>
              )}
              {mode === "sentences" && !isPracticing && !isGenerating && (
                <div className="flex flex-wrap gap-1.5 mt-2">
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
              )}
            </div>
          )}

          {/* 단어/문장 모드 라운드 완료 결과 */}
          {roundCompleteResult && !isPracticing && (mode === "words" || mode === "sentences") && (
            <div className="p-4 border-2 border-green-500 rounded bg-green-50">
              <p className="text-lg font-bold text-green-700 mb-2">라운드 완료!</p>
              <div className="flex gap-4 text-sm">
                <span className="text-blue-600">정답: {roundCompleteResult.correct}</span>
                <span className="text-rose-600">오답: {roundCompleteResult.incorrect}</span>
                <span>총: {roundCompleteResult.total}문제</span>
                {roundCompleteResult.avgKpm > 0 && (
                  <span className="text-gray-600">평균 타수 {roundCompleteResult.avgKpm} / 자수 {roundCompleteResult.avgCpm}</span>
                )}
              </div>
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
                          {slotNames[practiceSlot] || `슬롯 ${practiceSlot}`} ({isBatchMode ? '매매치라' : '보교치라'}) : {((isBatchMode ? slotCompletedRoundsBatch[practiceSlot] : slotCompletedRoundsNormal[practiceSlot]) || 0) + 1}회 완료
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
                        // 보교치라 횟수
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
                        const slotNum = parseInt(practiceText.trim());
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
                            startNextRound(practiceSlot, isBatchMode, randomSlot);
                            return;
                          }
                        }
                        if (slotNum >= 1 && slotNum <= 20) {
                          const savedText = localStorage.getItem(`slot_${slotNum}`);
                          if (savedText) {
                            updateInputText(savedText);
                          }
                          startNextRound(practiceSlot, isBatchMode, slotNum);
                          return;
                        }
                        // 매매치라 모드: 복습 5/5 완료 전에는 무조건 재개
                        if (isBatchMode && !isBatchReviewDone) {
                          resumeRound();
                        } else if (isFullyComplete) {
                          startNextRound(practiceSlot, isBatchMode); // 카운트다운 후 완료 횟수 증가
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

              <p className="text-sm font-medium">
                <span className="text-blue-600">정답: {correctCount}</span> |{" "}
                <span className="text-rose-600">오답: {incorrectCount}</span> |
                진행: {progressCount} / {mode === "sentences" && generatedCount > 0 ? generatedCount : totalCount}
                {isReviewActive && mode === "words" && (
                  <> | <span className={`font-bold ${reviewType === "failed" ? "text-amber-700" : "text-orange-600"}`}>{reviewType === "failed" ? "2차복습" : "1차복습"}: {currentReviewIndex + 1}/{reviewWords.length}</span></>
                )}
              </p>

              {mode === "words" && (
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => { const next = !showProficiencyPanel; setShowProficiencyPanel(next); if (next) { refreshToday(); refreshOverall(); } }}
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

              <div className={`grid gap-4 ${mode === "words" ? "grid-cols-2" : "grid-cols-1"}`}>
                <div>
                  <h2 className="text-xl font-semibold mb-2">{mode === "words" ? "복습단어 (1차복습)" : "오답 노트"}</h2>
                  <div className="h-[500px] overflow-y-scroll border rounded p-2">
                    <ul className="space-y-1 text-sm">
                      {incorrectWords.map((item) => (
                        <li
                          key={`${item.word}-${item.typed}`}
                          className="text-rose-600 flex items-center gap-2"
                        >
                          <button
                            className="bg-stone-500 text-white rounded px-2 py-0.5 text-sm"
                            onClick={() => removeIncorrectWord(item.word, item.typed)}
                          >
                            &times;
                          </button>
                          {item.word} → {item.typed}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {mode === "words" && (
                  <div>
                    <h2 className="text-xl font-semibold mb-2 text-amber-700">오답노트 (2차복습)</h2>
                    <div className="h-[500px] overflow-y-scroll border border-amber-300 rounded p-2 bg-amber-50">
                      <ul className="space-y-1 text-sm">
                        {reviewFailedWords.map((item, i) => (
                          <li
                            key={`${item.word}-${item.typed}-${i}`}
                            className="text-amber-700 flex items-center gap-2"
                          >
                            <button
                              className="bg-amber-500 text-white rounded px-2 py-0.5 text-sm"
                              onClick={() => setReviewFailedWords(prev => prev.filter((_, idx) => idx !== i))}
                            >
                              &times;
                            </button>
                            {item.word} → {item.typed}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
