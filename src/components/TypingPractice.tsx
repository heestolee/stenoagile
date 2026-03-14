import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState, useMemo } from "react";
import { useTypingStore } from "../store/useTypingStore";
import type { PositionStage } from "../modes/position/types";
import { computePositionMetrics, computeStagePositionMetrics } from "../modes/position/metrics";
import { buildPositionRecommendedChars } from "../modes/position/recommendation";
import { usePositionSamples } from "../modes/position/hooks/usePositionSamples";
import { usePositionCycleToast } from "../modes/position/hooks/usePositionCycleToast";
import { buildPositionTransitionPair } from "../modes/position/utils/enterSubmit";
import { resolvePositionStageToggleAction } from "../modes/position/utils/stageToggle";
import { findBestSequentialResumePosition, startSequentialCountdown } from "../modes/sequential/utils/roundFlow";
import { resolveSequentialRoundCompleteAction } from "../modes/sequential/utils/enterFlow";
import { buildSequentialPauseMetrics } from "../modes/sequential/utils/pauseMetrics";
import { savedText1, savedText2 } from "../modes/words/presetTexts";
import { savedText5 } from "../modes/longtext/presetTexts";
import { POSITION_BASE_QUESTION_COUNT, POSITION_RECOMMENDED_MAX_COUNT } from "../modes/position/config";
import {
  POSITION_LEFT_ROWS,
  POSITION_OVERALL_SAMPLE_LIMIT,
  POSITION_RIGHT_ROWS,
  POSITION_SAMPLE_LIMIT,
  POSITION_STAGE_OPTIONS,
  POSITION_THUMB_ROW,
  POSITION_WEAK_LINK_HIGHLIGHT_LIMIT,
  getPositionKeyIdsForChar,
} from "../modes/position/typingConstants";
import { GEMINI_MODEL_OPTIONS, SENTENCE_STYLES } from "../modes/sentences/constants";
import { getRandomLongTextKeyword } from "../modes/longtext/constants/longTextKeywords";
import { generateLongTextStream } from "../modes/longtext/utils/generateLongTextAI";
import { getFullMarkedText, getMarkedText, analyzeScoring, type FullMarkedChar, type MarkedChar, type ScoringResult } from "../modes/common/utils/scoringAnalysis";
import { logResult, logSession } from "../modes/common/utils/sheetLogger";
import { generateSentencesStream } from "../modes/sentences/utils/generateSentencesAI";
import {
  pickSentenceModeResults,
  toSentenceReviewResumePayload,
} from "../modes/sentences/review";
import {
  type WordSentenceRoundCompleteResult,
} from "../modes/sentences/roundCompletion";
import {
  createSavedSentenceState,
  toSentenceResumePayload,
  type SavedSentenceState,
} from "../modes/sentences/state";
import {
  createSavedLongtextState,
  toLongtextResumePayload,
  type SavedLongtextState,
} from "../modes/longtext/state";
import { useVideoPlayer } from "../modes/common/hooks/useVideoPlayer";
import { useHeamiVoice } from "../modes/common/hooks/useHeamiVoice";
import { useGeneralEnterSubmit } from "../modes/common/hooks/useGeneralEnterSubmit";
import { useAIGeneration } from "../modes/sentences/hooks/useAIGeneration";
import { useWordSentenceRoundCompletion } from "../modes/sentences/hooks/useWordSentenceRoundCompletion";
import { useSentencePeriodicReview } from "../modes/sentences/hooks/useSentencePeriodicReview";
import { useSlotManager } from "../modes/common/hooks/useSlotManager";
import { useWordReview } from "../modes/words/hooks/useWordReview";
import { useWordProficiency } from "../modes/words/hooks/useWordProficiency";
import { useReviewFailedWords } from "../modes/words/hooks/useReviewFailedWords";
import { buildNextIncorrectWordsForReview, evaluateWordEnterSubmission } from "../modes/words/utils/enterSubmit";
import PracticeHeader from "../modes/common/components/PracticeHeader";
import ModeStatsFab from "../modes/common/components/ModeStatsFab";
import PracticeDrawer from "../modes/common/components/PracticeDrawer";
import PracticeMainArea from "../modes/common/components/PracticeMainArea";
import {
  GLOBAL_DETAIL_SETTINGS_KEY,
  getModeDetailSettingsKey,
  loadDetailSettings,
  saveDetailSettings,
} from "../modes/common/utils/detailSettings";
import { formatElapsedTime } from "../modes/common/utils/timeFormat";
import { buildTypingSpeedMetrics, countNonSpaceChars, countJamoKeystrokes } from "../modes/common/utils/typingMetrics";
import { shouldBlockEnterSubmission } from "../modes/common/utils/enterConstraints";
import { selectQuickStartSlot, splitPracticeWords } from "../modes/common/utils/quickStart";
import { finishPracticeAndOpenDrawer, haltOngoingPractice } from "../modes/common/utils/practiceLifecycle";
import { computeSessionStats, pickModeResults, toSessionLogPayload } from "../modes/common/utils/sessionStats";
import { createModeSwitchHandlers } from "../modes/common/utils/modeSwitch";
import {
  buildAutoSubmitTarget,
  isAutoSubmitMatch,
  normalizeNoSpace,
  shouldCountKeystroke,
} from "../modes/common/utils/inputBranching";
import LoginPage from "../auth/components/LoginPage";
import { useAuth } from "../auth/hooks/useAuth";

// 한국어 문장 유사도 판별 (바이그램 Jaccard)
function getSentenceBigrams(s: string): Set<string> {
  const normalized = s.replace(/\s+/g, "");
  const bigrams = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    bigrams.add(normalized.slice(i, i + 2));
  }
  return bigrams;
}

function computeJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function isSimilarSentence(candidate: string, pool: string[], threshold = 0.55): boolean {
  const candidateBigrams = getSentenceBigrams(candidate);
  return pool.some((s) => computeJaccard(candidateBigrams, getSentenceBigrams(s)) >= threshold);
}

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
    halfCorrectCount,
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
    lastSentenceTyped,
  } = useTypingStore();
  const removeIncorrectWord = useTypingStore((s) => s.removeIncorrectWord);
  const { user, signOut } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showModeStats, setShowModeStats] = useState(false);
  const isPositionMode = mode === "position";
  const isWordLikeMode = mode === "words" || mode === "position";

  const [showText, setShowText] = useState(true);
  const [practicingMode, setPracticingMode] = useState<string | null>(null); // 현재 연습 중인 모드 저장
  const [showPositionKeyboard, setShowPositionKeyboard] = useState(true);
  const [hoveredPositionKeyId, setHoveredPositionKeyId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState({ kpm: 0, cpm: 0, elapsedTime: 0 });
  const [allResults, setAllResults] = useState<{ kpm: number, cpm: number, elapsedTime: number, chars: string, mode?: string }[]>([]);
  const sequentialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    selectedSlot, setSelectedSlot, slotNames, favoriteSlots,
    todayCompletedRounds, slotCompletedRoundsNormal, slotCompletedRoundsBatch, modeCompletedRounds,
    practiceSlot, setPracticeSlot, setPendingIncrementSlot,
    incrementCompletedRounds, resetModeCompletedRounds, handleRenameSlot, toggleFavoriteSlot, handleSaveToSlot,
  } = useSlotManager(inputText, user);
  const [displayFontSize, setDisplayFontSize] = useState(20); // 위쪽 표시 영역 글자 크기
  const [inputFontSize, setInputFontSize] = useState(19.5); // 아래쪽 타이핑 입력 글자 크기
  const [rankFontSize, setRankFontSize] = useState(12); // 최고타/평균타 결과 글자 크기
  const [charsPerRead, setCharsPerRead] = useState(3); // 몇 글자마다 읽어줄지
  const [sequentialSpeechRate, setSequentialSpeechRate] = useState(1); // 보고치라 음성 속도 (1배속)
  const { speakText, clearAllTimeouts } = useHeamiVoice(isSoundEnabled, speechRate, sequentialSpeechRate);
  const [countdown, setCountdown] = useState<number | null>(null); // 카운트다운 상태
  const [, setRoundStartTime] = useState<number | null>(null); // 라운드 시작 시간
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRoundComplete, setIsRoundComplete] = useState(false); // 라운드 완료 상태 (결과 확인 중)
  const [isSentenceReview, setIsSentenceReview] = useState(false); // 문장모드 복습 중 여부
  const lastSentenceReviewAtRef = useRef(0); // 문장 복습이 트리거된 progressCount
  const [preReviewResults, setPreReviewResults] = useState<typeof allResults>([]); // 복습 전 최고타/평균타 보존용
  const [accumulatedKeystrokes, setAccumulatedKeystrokes] = useState(0); // 누적 타수
  const [accumulatedElapsedMs, setAccumulatedElapsedMs] = useState(0); // 누적 경과 시간
  const [displayElapsedTime, setDisplayElapsedTime] = useState(0); // 실시간 표시용 경과 시간
  const typingTextareaRef = useRef<HTMLTextAreaElement | null>(null); // 타이핑 칸 참조
  const wordInputRef = useRef<HTMLInputElement | null>(null); // 단어/문장 모드 입력 칸 참조
  const practiceInputRef = useRef<HTMLTextAreaElement | null>(null); // 연습 칸 참조
  const isAutoSubmittingRef = useRef(false); // 자동 제출 중복 방지
  const isComposingRef = useRef(false); // 한국어 IME 조합 중 여부
  const pendingCompositionEndRef = useRef(false); // 조합 완료 후 자동처리 체크 플래그
  const composingKeystrokesRef = useRef(0); // 조합 중 타수 카운트 (ref로 관리하여 리렌더 방지)
  const composingRAFRef = useRef<number | null>(null); // 조합 중 RAF 핸들 ID
  const elapsedTimerRef = useRef<HTMLSpanElement | null>(null); // 경과시간 DOM 직접 업데이트용

  // input을 직접 클리어하는 함수 (uncontrolled input용)
  const clearInputElement = () => {
    if (wordInputRef.current) wordInputRef.current.value = "";
    if (typingTextareaRef.current) typingTextareaRef.current.value = "";
  };
  const displayAreaRef = useRef<HTMLDivElement | null>(null); // 표시 영역 스크롤 참조

  // 매매치라 관련 상태
  const [isBatchMode, setIsBatchMode] = useState(false); // 매매치라 모드 활성화 여부
  const [batchSize, setBatchSize] = useState(5); // 한번에 표시할 글자 수
  const [batchStartIndex, setBatchStartIndex] = useState(0); // 현재 배치 시작 인덱스
  const [currentBatchChars, setCurrentBatchChars] = useState<string>(""); // 현재 배치에 표시된 글자들
  const [batchRandomFillCount, setBatchRandomFillCount] = useState(0); // 마지막 배치에서 랜덤으로 채운 글자 수

  // 복습 모드 관련 (시간 많이 걸린 5개 다시 연습)
  const [isReviewMode, setIsReviewMode] = useState(false); // 복습 모드 여부
  const [reviewBatches, setReviewBatches] = useState<string[]>([]); // 복습할 배치 목록
  const [reviewIndex, setReviewIndex] = useState(0); // 현재 복습 중인 인덱스
  const [isBatchReviewDone, setIsBatchReviewDone] = useState(false); // 배치복습 완료 여부

  // 단어모드 복습 자동처리 훅
  const {
    isReviewActive, reviewWords, currentReviewIndex, currentReviewTarget,
    reviewType, checkAndStartReview, startFailedReview, handleReviewSubmit, resetReview,
  } = useWordReview({ onRemoveIncorrectWord: removeIncorrectWord });

  // 단어 숙련도 관련 훅
  const {
    todayProficiencies, overallProficiencies, recordResult,
    refreshToday, refreshOverall, clearToday, clearOverall, mergeToOverall,
  } = useWordProficiency("words");
  const [showProficiencyPanel, setShowProficiencyPanel] = useState(false);
  const [longTextLength, setLongTextLength] = useState(300);
  const [sentenceReviewWindow, setSentenceReviewWindow] = useState(50);
  const [wordsPerSentence, setWordsPerSentence] = useState(2);
  const { reviewFailedWords, setReviewFailedWords } = useReviewFailedWords();

  const { positionSamples, setPositionSamples, overallPositionSamples, setOverallPositionSamples } = usePositionSamples();
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
  const stagePositionMetrics = useMemo(() => computeStagePositionMetrics(positionSamples, [...POSITION_STAGE_OPTIONS.map((v) => v.key), "mixed"]), [positionSamples]);
  const overallStagePositionMetrics = useMemo(() => computeStagePositionMetrics(overallPositionSamples, [...POSITION_STAGE_OPTIONS.map((v) => v.key), "mixed"]), [overallPositionSamples]);
  const recommendedWordsForPositionRound = useMemo(
    () =>
      buildPositionRecommendedChars({
        positionSamples,
        transitionByContext: positionMetrics.perTransitionByContext,
        dictionaryTexts: [savedText1, savedText2, savedText5],
        maxCount: POSITION_RECOMMENDED_MAX_COUNT,
      }),
    [positionSamples, positionMetrics.perTransitionByContext]
  );
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
  }, [isPositionMode, isPracticing, progressCount, recommendedWordsForPositionRound, injectPositionRecommendedWords]);
  const prevReviewActiveRef = useRef(false);
  const prevReviewTypeRef = useRef<string | null>(null);

  // 1차 복습 완료 시 실패단어 자동 연결 (1회씩)
  useEffect(() => {
    const wasActive = prevReviewActiveRef.current;
    const wasType = prevReviewTypeRef.current;
    prevReviewActiveRef.current = isReviewActive;
    prevReviewTypeRef.current = reviewType;

    // 1차 복습이 끝난 후 실패단어 있으면 2차 시작
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

  // 하이라이트용 상태 (아래칸 hover 시 위칸 해당 위치 표시)
  const [hoveredOrigIdx, setHoveredOrigIdx] = useState<number | null>(null);

  // 라운드 완료 후 채점용 텍스트
  const [practiceText, setPracticeText] = useState("");

  // 재개 위치 하이라이트 표시용
  const [showResumeHighlight, setShowResumeHighlight] = useState(false);
  const [resumePosition, setResumePosition] = useState(0);
  const positionCycleToast = usePositionCycleToast({
    isPositionMode,
    isPracticing,
    totalCount,
    progressCount,
    practiceSlot,
    incrementCompletedRounds,
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // 단어/문장 모드 라운드 완료 결과
  const [roundCompleteResult, setRoundCompleteResult] = useState<WordSentenceRoundCompleteResult | null>(null);

  // 이전 문장 기록 풀 (localStorage에서 복원, 최대 300개)
  const previousSentencesPoolRef = useRef<string[]>([]);
  if (previousSentencesPoolRef.current.length === 0) {
    try {
      const saved = localStorage.getItem("stenoagile-previous-sentences");
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed)) previousSentencesPoolRef.current = parsed;
      }
    } catch { /* ignore */ }
  }

  // AI 생성 관련 훅
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
  // 문장모드 상태 저장 (모드 전환 후 API 호출 없이 복원)
  const savedSentenceStateRef = useRef<SavedSentenceState | null>(null);
  const savedLongtextStateRef = useRef<SavedLongtextState | null>(null);
  // 긴글모드 랜덤 생성 전용 state
  const [isGeneratingLongText, setIsGeneratingLongText] = useState(false);
  const [generatingKeyword, setGeneratingKeyword] = useState("");
  const [generatedLongText, setGeneratedLongText] = useState("");
  const [longtextModelName, setLongtextModelName] = useState("");
  const [longtextGenerateError, setLongtextGenerateError] = useState<string | null>(null);
  const generateLongTextAbortRef = useRef<AbortController | null>(null);
  const [longtextStyle, setLongtextStyle] = useState("자유 문체");
  const [longtextUseRandom, setLongtextUseRandom] = useState(true);
  // 문장복습 직전 상태 저장 (복습 후 이전 위치로 복원)
  const preReviewSentenceStateRef = useRef<SavedSentenceState | null>(null);


  // 전역 상세설정 로드
  useEffect(() => {
    const settings = loadDetailSettings(GLOBAL_DETAIL_SETTINGS_KEY);
    if (settings) {
      if (settings.displayFontSize !== undefined) setDisplayFontSize(settings.displayFontSize);
      if (settings.inputFontSize !== undefined) setInputFontSize(settings.inputFontSize);
      if (settings.charsPerRead !== undefined) setCharsPerRead(settings.charsPerRead);
      if (settings.sequentialSpeechRate !== undefined) setSequentialSpeechRate(settings.sequentialSpeechRate);
      if (settings.batchSize !== undefined) setBatchSize(settings.batchSize);
      if (settings.rankFontSize !== undefined) setRankFontSize(settings.rankFontSize);
      if (settings.speechRate !== undefined) useTypingStore.getState().changeSpeechRate(settings.speechRate);
      if (settings.longTextLength !== undefined) setLongTextLength(settings.longTextLength);
      if (settings.sentenceReviewWindow !== undefined) setSentenceReviewWindow(settings.sentenceReviewWindow);
      if (settings.wordsPerSentence !== undefined) setWordsPerSentence(settings.wordsPerSentence);
    }
    // 모드별 상세설정 로드
    const modeKey = getModeDetailSettingsKey(mode);
    if (modeKey) {
      const modeSettings = loadDetailSettings(modeKey);
      if (modeSettings) {
        if (modeSettings.speechRate !== undefined) useTypingStore.getState().changeSpeechRate(modeSettings.speechRate);
        if (modeSettings.displayFontSize !== undefined) setDisplayFontSize(modeSettings.displayFontSize);
        if (modeSettings.rankFontSize !== undefined) setRankFontSize(modeSettings.rankFontSize);
        if (modeSettings.showText !== undefined) setShowText(modeSettings.showText);
        if (modeSettings.isSoundEnabled !== undefined && modeSettings.isSoundEnabled !== isSoundEnabled) toggleSound();
        if (modeSettings.showPositionKeyboard !== undefined) setShowPositionKeyboard(modeSettings.showPositionKeyboard);
        if (modeSettings.sentenceReviewWindow !== undefined) setSentenceReviewWindow(modeSettings.sentenceReviewWindow);
        if (modeSettings.wordsPerSentence !== undefined) setWordsPerSentence(modeSettings.wordsPerSentence);
      }
    }
  }, [mode, isSoundEnabled, toggleSound]);

  // 문장모드 마운트/언마운트 시 자동 재개
  useEffect(() => {
    if (isPracticing && mode === "sentences" && sentences.length > 0) {
      // persist된 문장모드 상태가 있으면 입력 필드에 포커스
      setTimeout(() => {
        wordInputRef.current?.focus();
      }, 100);
    }
  }, [isPracticing, mode, sentences.length]);


  // 단어/문장/자리 모드 라운드 완료 처리
  useWordSentenceRoundCompletion({
    mode,
    isPracticing,
    totalCount,
    progressCount,
    isReviewActive,
    isSentenceReview,
    allResults,
    correctCount,
    halfCorrectCount,
    incorrectCount,
    practiceSlot,
    preReviewSentenceStateRef,
    setIsSentenceReview,
    clearSentenceResults: () => clearSentenceResults(),
    createCurrentSentenceState: () => createCurrentSentenceState(),
    startSentenceReviewFlow: (reviewSentences, preReviewProgress) => startSentenceReviewFlow(reviewSentences, preReviewProgress),
    resumeSentencePractice,
    updateTypedWord,
    clearInputElement,
    clearLastSentenceTyped: () => useTypingStore.setState({ lastSentenceTyped: "" }),
    focusWordInputSoon: () => setTimeout(() => wordInputRef.current?.focus(), 50),
    setRoundCompleteResult,
    logSession,
    finishPracticeAndOpenDrawer: () =>
      finishPracticeAndOpenDrawer({
        stopPractice,
        resetReview,
        setPracticingMode,
        setIsDrawerOpen,
      }),
    incrementCompletedRounds,
  });

  // 문장모드 N개마다 복습타 5개 자동 시작
  useSentencePeriodicReview({
    mode,
    isPracticing,
    isSentenceReview,
    isReviewActive,
    progressCount,
    allResults,
    reviewWindow: sentenceReviewWindow,
    lastSentenceReviewAtRef,
    savePreReviewState: () => {
      preReviewSentenceStateRef.current = createCurrentSentenceState();
    },
    startSentenceReviewFlow: (reviewSentences) => startSentenceReviewFlow(reviewSentences),
  });

  const startCountdown = (onComplete: () => void) => {
    startSequentialCountdown({
      setCountdown,
      countdownTimerRef,
      onComplete,
    });
  };

  const resumeRound = () => {
    // 타이핑 10글자로 거슬러올라가 최선의 재개 위치 찾기
    const text = isBatchMode
      ? currentBatchChars
      : randomizedIndices.slice(0, currentDisplayIndex).map(index => sequentialText[index]).join('');

    const bestPos = findBestSequentialResumePosition(typedWord, text);
    setResumePosition(bestPos);
    setShowResumeHighlight(true);

    setIsRoundComplete(false);
    setPracticeText(""); // 채점 텍스트 초기화
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
  // completedSlot: 방금 완료한 슬롯 (카운트다운 이후에 increment)
  // wasBatchMode: 완료한 라운드가 매매치라 모드였는지
  // nextSlot: 다음에 연습할 슬롯 (미지정이면 현재 selectedSlot 유지)
  const startNextRound = (nextSlot?: number) => {
    // 드로어 닫기
    setIsDrawerOpen(false);
    // 연습 슬롯 설정 (nextSlot이 지정된 경우, 아니면 selectedSlot)
    const targetSlot = nextSlot ?? selectedSlot;
    setPracticeSlot(targetSlot);
    if (nextSlot !== undefined) {
      setSelectedSlot(nextSlot);
    }
    setPendingIncrementSlot(null);
    setIsRoundComplete(false);
    setAccumulatedKeystrokes(0);
    setAccumulatedElapsedMs(0);
    setDisplayElapsedTime(0);
    updateTypedWord(""); clearInputElement(); // 타이핑 칸 초기화
    setPracticeText(""); // 채점 텍스트 초기화
    setShowResumeHighlight(false); // 하이라이트 초기화
    resetBatchAndReviewState();
    // 타수/결과 초기화
    setLastResult({ kpm: 0, cpm: 0, elapsedTime: 0 });
    setAllResults([]);
    startCountdown(() => {
      setRoundStartTime(Date.now());
      restartSequentialPractice();
      // 타이핑 칸에 포커스
      setTimeout(() => {
        if (mode === "longtext") {
          wordInputRef.current?.focus();
        } else {
          typingTextareaRef.current?.focus();
        }
      }, 50);
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

  const handleCompositionStart = () => {
    isComposingRef.current = true;
    const input = wordInputRef.current ?? typingTextareaRef.current;
    if (input) {
      const len = input.value.length;
      const cursorPos = input.selectionStart ?? len;
      // 커서 바로 다음 글자가 공백인 경우만 커서를 끝으로 이동 (약어 공백 앞 케이스)
      // 일반 한국어 조합 중에는 커서가 조합 글자 위치에 있고 다음이 공백이 아님
      if (cursorPos < len && input.value[cursorPos] === " ") {
        input.setSelectionRange(len, len);
      }
    }
  };
  const handleCompositionEnd = (event: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    // 조합 완료 처리: 현재 입력값을 state에 동기화 (조합 중 onChange는 건너뛰었으므로)
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    updateTypedWord(value);
    pendingCompositionEndRef.current = true;
  };

    const flushPendingCompositionKeystrokes = () => {
    if (!pendingCompositionEndRef.current) return;

    pendingCompositionEndRef.current = false;
    const pending = composingKeystrokesRef.current;
    composingKeystrokesRef.current = 0;
    for (let i = 0; i < pending; i++) incrementCurrentWordKeystrokes();
  };

  const handleComposingInput = () => {
    if (!currentWordStartTime) {
      startCurrentWordTracking();
    }

    composingKeystrokesRef.current++;
    if (composingRAFRef.current !== null) return;

    composingRAFRef.current = requestAnimationFrame(() => {
      composingRAFRef.current = null;
      const latest = wordInputRef.current?.value ?? typingTextareaRef.current?.value ?? "";
      updateTypedWord(latest);
      tryAutoSubmit(latest);
    });
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;

    if (isAutoSubmittingRef.current) {
      clearInputElement();
      return;
    }

    if (isComposingRef.current) {
      handleComposingInput();
      return;
    }

    updateTypedWord(value);
    flushPendingCompositionKeystrokes();
    tryAutoSubmit(value);
  };
  const tryAutoSubmit = (value: string) => {
    const autoSubmitTarget = buildAutoSubmitTarget({
      isReviewActive,
      currentReviewTarget,
      mode,
      isPracticing,
      sentences,
      currentSentenceIndex,
      isWordLikeMode,
      shuffledWords,
      currentWordIndex,
    });

    const isMatch = isAutoSubmitMatch({
      value,
      target: autoSubmitTarget,
      isWordLikeMode,
      isReviewActive,
      isAutoSubmitting: isAutoSubmittingRef.current,
    });

    if (!isMatch || !autoSubmitTarget) return;

    isAutoSubmittingRef.current = true;
    const elapsedMs = (currentWordStartTime && currentWordKeystrokes > 0) ? Date.now() - currentWordStartTime : 0;
    const speedMetrics = buildTypingSpeedMetrics({
      elapsedMs,
      keystrokes: countJamoKeystrokes(value),
      charCount: countNonSpaceChars(value),
    });
    if (speedMetrics) {
      const { kpm, cpm, elapsedTime } = speedMetrics;
      setLastResult(speedMetrics);
      setAllResults(prev => [...prev, { kpm, cpm, elapsedTime, chars: autoSubmitTarget, mode }]);
      logResult({ mode, kpm, cpm, elapsedTime });
    }

    if (isReviewActive) {
      const reviewTarget = autoSubmitTarget;
      const reviewCorrect = handleReviewSubmit(value);
      recordResult(reviewTarget, reviewCorrect ? "correct" : "incorrect");
      if (!reviewCorrect && reviewType === "primary") {
        setReviewFailedWords(prev => [...prev, { word: reviewTarget, typed: value.trim() }]);
      }
      if (reviewCorrect && reviewType === "failed") {
        setReviewFailedWords(prev => prev.filter(item => item.word !== reviewTarget));
      }
      updateTypedWord("");
      clearInputElement();
    } else {
      const target = isWordLikeMode ? shuffledWords[currentWordIndex] : autoSubmitTarget;
      const targetClean = normalizeNoSpace(target);
      const inputClean = normalizeNoSpace(value);
      const isCorrect = isWordLikeMode
        ? inputClean.endsWith(targetClean) && targetClean.length > 0
        : value.trim() === autoSubmitTarget;

      submitAnswer(value);

      if (mode === "sentences" || mode === "longtext") {
        incrementCompletedRounds(practiceSlot, mode, 1);
        if (mode === "longtext" && progressCount + 1 >= totalCount && totalCount > 0) {
          setIsRoundComplete(true);
          setIsDrawerOpen(true);
          if (practiceSlot !== null) {
            incrementCompletedRounds(practiceSlot, mode);
          }
        }
      }

      if (isPositionMode) {
        const pair = buildPositionTransitionPair({ words: shuffledWords, currentIndex: currentWordIndex });
        recordPositionTransition(isCorrect, elapsedMs, pair.fromChar, pair.toChar, currentPositionSampleStage);
      }

      if (mode === "words") {
        const wordEval = evaluateWordEnterSubmission({ target: targetClean, typedWord: value });
        recordResult(
          wordEval.targetClean,
          wordEval.isExact ? "correct" : wordEval.isHalf ? "half" : "incorrect",
        );
        const nextProgress = progressCount + 1;
        checkAndStartReview(
          nextProgress,
          buildNextIncorrectWordsForReview({
            incorrectWords,
            isCorrect: wordEval.isExact,
            targetClean: wordEval.targetClean,
            typedWord: value,
          }),
          totalCount,
        );
      }
    }

    resetCurrentWordTracking();
    clearInputElement();
    setTimeout(() => { isAutoSubmittingRef.current = false; }, 50);
  };

  const handleEnterQuickStart = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isPracticing || typedWord.trim() !== "99") return false;

    event.preventDefault();
    const selection = selectQuickStartSlot({
      favoriteSlots: [...favoriteSlots],
      selectedSlot,
      loadSlotText: (slot) => localStorage.getItem(`slot_${slot}`),
    });
    if (!selection) return true;

    const { slot: randomSlot, text: savedText } = selection;
    updateInputText(savedText);
    updateTypedWord("");
    clearInputElement();
    setSelectedSlot(randomSlot);

    const words = splitPracticeWords(savedText);
    if (words.length === 0) return true;

    setPracticeSlot(randomSlot);
    setIsDrawerOpen(false);
    if (mode === "longtext") {
      setRoundStartTime(Date.now());
      startPractice(words);
      setTimeout(() => wordInputRef.current?.focus(), 50);
      return true;
    }

    if (mode === "sequential" || mode === "random") {
      startCountdown(() => {
        setRoundStartTime(Date.now());
        startPractice(words);
        setTimeout(() => typingTextareaRef.current?.focus(), 50);
      });
      return true;
    }

    startPractice(words);
    setTimeout(() => wordInputRef.current?.focus(), 50);
    return true;
  };

  const handleEnterSequentialRandom = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((mode !== "sequential" && mode !== "random") || !isPracticing) return false;

    event.preventDefault();

    if (isRoundComplete) {
      const action = resolveSequentialRoundCompleteAction({
        isBatchMode,
        isBatchReviewDone,
        isFullyComplete,
        typedWord,
      });

      if (action.kind === "resume") {
        resumeRound();
        return true;
      }

      if (action.kind === "next_with_slot") {
        const savedText = localStorage.getItem(`slot_${action.slot}`);
        if (savedText) {
          updateInputText(savedText);
        }
        setSelectedSlot(action.slot);
        startNextRound();
        return true;
      }

      startNextRound();
      return true;
    }

    const pendingIME = composingKeystrokesRef.current;
    composingKeystrokesRef.current = 0;
    const { totalKeystrokes, totalElapsedMs, speedMetrics } = buildSequentialPauseMetrics({
      typedWord,
      currentWordStartTime,
      currentWordKeystrokes,
      accumulatedKeystrokes,
      accumulatedElapsedMs,
      pendingImeKeystrokes: pendingIME,
    });
    if (speedMetrics) {
      const { kpm, cpm, elapsedTime } = speedMetrics;
      setLastResult(speedMetrics);
      setAllResults(prev => [...prev, { kpm, cpm, elapsedTime, chars: "", mode }]);
      logResult({ mode, kpm, cpm, elapsedTime });
    }

    setAccumulatedKeystrokes(totalKeystrokes);
    setAccumulatedElapsedMs(totalElapsedMs);
    resetCurrentWordTracking();
    setIsRoundComplete(true);
    return true;
  };
  const handleEnterGeneralSubmit = useGeneralEnterSubmit({
    typedWord,
    mode,
    sentences,
    currentSentenceIndex,
    shuffledWords,
    currentWordIndex,
    isPositionMode,
    currentPositionSampleStage,
    currentWordStartTime,
    currentWordKeystrokes,
    isReviewActive,
    currentReviewTarget,
    reviewType,
    progressCount,
    incorrectWords,
    totalCount,
    setLastResult,
    setAllResults,
    setReviewFailedWords,
    recordResult,
    handleReviewSubmit,
    recordPositionTransition,
    submitAnswer,
    checkAndStartReview,
    resetCurrentWordTracking,
    updateTypedWord,
    clearInputElement,
    logResult,
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const isIMEComposing = event.nativeEvent.isComposing || event.keyCode === 229;

    if (event.key === "Tab" && mode === "sentences") {
      event.preventDefault();
      practiceInputRef.current?.focus();
      return;
    }

    if (isPositionMode && isPracticing && event.key === " ") {
      event.preventDefault();
      if (!activeSingleStage) return;
      const currentChar = shuffledWords[currentWordIndex] ?? "";
      const toggleAction = resolvePositionStageToggleAction({
        currentChar,
        activeStageExcludedChars,
      });
      if (toggleAction === "none") return;
      if (toggleAction === "remove") {
        removePositionExcludedChar(activeSingleStage, currentChar);
      } else {
        addPositionExcludedChar(activeSingleStage, currentChar);
      }
      regeneratePositionQueueFromCurrent();
      return;
    }

    if (event.key === "Enter" && !isIMEComposing) {
      if (handleEnterQuickStart(event)) {
        return;
      }

      if (shouldBlockEnterSubmission({ mode, isPracticing, typedWord })) {
        event.preventDefault();
        return;
      }

      if (handleEnterSequentialRandom(event)) {
        return;
      }

      handleEnterGeneralSubmit();
      return;
    }

    // 유효한 입력 키만 카운트합니다.
    // 수식어 키(Ctrl, Alt, Meta), 화살표키, 기능키 등은 제외합니다.
    if (shouldCountKeystroke({
      key: event.key,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      isIMEComposing,
    })) {
      if ((mode === "sequential" || mode === "random") && isRoundComplete) {
        setIsRoundComplete(false);
      }

      // 첫 입력에서 타이머 시작 (공백/백스페이스키에는 반응하지 않도록)
      if (!currentWordStartTime) {
        if (event.key === " " || event.key === "Backspace" || event.key === "Delete") return;
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
    existingSentences?: string[],
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
        (sentence) => {
          // 빈 문자열 및 클라이언트 중복 필터
          if (!sentence || sentence.trim().length === 0) return;
          const pool = previousSentencesPoolRef.current;
          if (isSimilarSentence(sentence, pool)) return;
          totalGenerated++;
          setGeneratedCount(totalGenerated);
          pool.push(sentence);
          if (pool.length > 300) pool.splice(0, pool.length - 300);
          try { localStorage.setItem("stenoagile-previous-sentences", JSON.stringify(pool)); } catch { /* ignore */ }
          if (!started) {
            started = true;
            setSentences([sentence]);
            startPractice(words);
          } else {
            addSentence(sentence);
          }
        },
        async () => {
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
        previousSentencesPoolRef.current.length > 0 ? previousSentencesPoolRef.current : existingSentences,
        wordsPerSentence,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setGenerateErrorWithRetry(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      setIsDrawerOpen(true);
      setIsGenerating(false);
      generateAbortRef.current = null;
      if (totalGenerated > 0) setTotalCount(totalGenerated);
    }
  };

  const handleStartOrStopPractice = async () => {
    // 생성 중에 클릭하면 스트림을 중단하고 이미 생성된것만 사용 유지
    if (isGenerating) {
      generateAbortRef.current?.abort();
      generateAbortRef.current = null;
      setIsGenerating(false);
      if (generatedCount > 0) {
        setTotalCount(generatedCount);
      }
      return;
    }
    // 카운트다운 중이거나 연습 중이면 정지
    if (isPracticing || countdown !== null) {
      haltOngoingPractice({
        cancelSpeech: () => window.speechSynthesis.cancel(),
        clearVoiceTimeouts: clearAllTimeouts,
        clearCountdownTimer: () => {
          if (countdownTimerRef.current) {
            clearTimeout(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
        },
        resetCountdownState: () => setCountdown(null),
        resetRoundRuntimeState: () => {
          setRoundStartTime(null);
          setIsRoundComplete(false);
          setAccumulatedKeystrokes(0);
          setAccumulatedElapsedMs(0);
          setDisplayElapsedTime(0);
          resetCurrentWordTracking();
        },
        resetBatchAndReviewState,
        logSessionSummary: () => {
          const currentModeResults = pickModeResults(allResults, mode);
          const sessionLog = toSessionLogPayload({
            mode,
            results: currentModeResults,
            correctCount,
            incorrectCount,
          });
          if (sessionLog) logSession(sessionLog);
        },
        finishPracticeAndOpenDrawer: () =>
          finishPracticeAndOpenDrawer({
            stopPractice,
            resetReview,
            setPracticingMode,
            setIsDrawerOpen,
          }),
        focusInputAfterStop: () => {
          setTimeout(() => typingTextareaRef.current?.focus(), 50);
        },
      });
    } else {
      const parsedWords = inputText.trim().split("/").filter(Boolean);
      const words = isPositionMode ? (parsedWords.length > 0 ? parsedWords : ["자리"]) : parsedWords;
      if (words.length > 0) {
        // 결과 관련 상태 초기화
        setRoundCompleteResult(null);
        resetBatchAndReviewState();
        // 연습 슬롯 및 연습 모드/상태 설정
        setPracticeSlot(selectedSlot);
        setPracticingMode(mode);
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
          // 문장모드 저장된 상태가 있으면 API 호출 없이 바로 복원
          if (savedSentenceStateRef.current) {
            restoreSentenceState();
          } else {
            if (!geminiApiKey) {
              setGenerateError("문장 모드를 사용하려면 API 키를 입력하세요.");
              setIsDrawerOpen(true);
              return;
            }
            // 초기 시작: AI 스트림 생성 시작 (배치 없음)
            setIsSentenceReview(false);
            setSentences([]);
            setGenerateError(null);
            setIsGenerating(true);
            setGeneratedCount(0);
            setAiModelName("");
            const abortController = new AbortController();
            generateAbortRef.current = abortController;
            const sentenceWords = useRandomSentences ? [] : words;
            const targetCount = 2500;
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
      rankFontSize,
      speechRate,
      longTextLength,
      sentenceReviewWindow,
    };
    saveDetailSettings(GLOBAL_DETAIL_SETTINGS_KEY, settings);
    alert('상세설정이 기본값으로 저장되었습니다.');
  };

  const handleLoadPreset = (slot: number) => {
    // 연습 중이면 슬롯 변경 불가 (라운드 완료 상태에서는 변경, 문장모드는 항상 가능)
    if (mode !== "sentences" && ((isPracticing && !isRoundComplete) || countdown !== null)) {
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

    if (mode === "longtext") {
      // 긴글모드: 문장 단위 자동처리 없음, 화면 표시 불필요
      // 음성 출력만 처리
      if (isSoundEnabled && sentences[currentSentenceIndex]) {
        speakText(sentences[currentSentenceIndex]);
      }
      return;
    }

    if (mode === "sequential" || mode === "random") {
      // 라운드 완료 상태면 화면 표시 중단
      if (isRoundComplete) return;

      // 카운트다운 중이면 화면 표시 안 함 (첫 글자 표시전 준비 중)
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
          // 현재 배치의 글자들 구성
          const endIndex = Math.min(batchStartIndex + batchSize, randomizedIndices.length);
          const batchIndices = randomizedIndices.slice(batchStartIndex, endIndex);
          // 마지막 배치가 batchSize보다 부족한 경우 랜덤 글자로 채움
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
          updateTypedWord(""); clearInputElement(); // 새 배치 시작 시 타이핑 칸 초기화

          // 음성 읽기
          if (isSoundEnabled && batchChars) {
            speakText(batchChars, true);
          }
        }
        return;
      }

      // 보고치라/랜덤 모드: 타이머마다 한 글자씩 표시
      if (currentDisplayIndex < randomizedIndices.length) {
        sequentialTimerRef.current = setTimeout(() => {
          const nextCharIndex = randomizedIndices[currentDisplayIndex];
          addDisplayedCharIndex(nextCharIndex);

          incrementDisplayIndex();

          // 표시된 글자 수가 charsPerRead의 배수이거나 마지막 글자일 때 음성 읽기
          const newDisplayIndex = currentDisplayIndex + 1;
          if (isSoundEnabled && (newDisplayIndex % charsPerRead === 0 || newDisplayIndex === randomizedIndices.length)) {
            // 최근 N글자(또는 나머지 글자)을 묶어서 읽어줌
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
      // 단어 모드: 단어 읽기
      if (isWordLikeMode && shuffledWords.length > 0) {
        speakText(shuffledWords[currentWordIndex]);
      } else if (mode === "sentences" && sentences.length > 0) {
        speakText(sentences[currentSentenceIndex]);
      }
    }
  }, [isPracticing, mode, currentWordIndex, currentSentenceIndex, currentLetterIndex, speechRate, currentDisplayIndex, randomizedIndices, sequentialSpeed, isSoundEnabled, sequentialText, charsPerRead, isRoundComplete, isBatchMode, batchSize, batchStartIndex, currentBatchChars, isReviewMode, reviewBatches, reviewIndex, countdown, addDisplayedCharIndex, incrementDisplayIndex, isWordLikeMode, sentences, shuffledWords, speakText, updateTypedWord]);

  // 매매치라 모드: 타이핑 확인 후 다음 배치로 이동
  useEffect(() => {
    if (!isPracticing || !isBatchMode || isRoundComplete) return;
    if (currentBatchChars === "") return;

    // 공백 무시하고 비교 (IME 조합 중 중간에 발생하는 빈칸 처리)
    const typedClean = typedWord.replace(/\s+/g, '');
    const targetClean = currentBatchChars.replace(/\s+/g, '');

    if (typedClean.endsWith(targetClean) && targetClean.length > 0) {
      // 타수/결과 계산 (일시정지 포함된 누적시간 + IME 조합 중 이반영 타수 포함)
      const currentElapsedMs = currentWordStartTime ? Date.now() - currentWordStartTime : 0;
      const totalElapsedMs = accumulatedElapsedMs + currentElapsedMs;

      const speedMetrics = buildTypingSpeedMetrics({
        elapsedMs: totalElapsedMs,
        keystrokes: countJamoKeystrokes(typedClean),
        charCount: typedClean.length,
      });
      if (speedMetrics) {
        const { kpm, cpm, elapsedTime } = speedMetrics;
        setLastResult(speedMetrics);
        // 복습 모드가 아닌 경우에만 결과 저장 (복습 모드에서는 결과 안 씀)
        if (!isReviewMode) {
          setAllResults(prev => [...prev, { kpm, cpm, elapsedTime, chars: currentBatchChars, mode }]);
          // Google Sheets 로그
          logResult({ mode, kpm, cpm, elapsedTime, chars: currentBatchChars });
        }
      }
      // 외부 입력 방지 (글자 전환 후 새로운 입력/리렌더가 이미 있는 타이머를 캔슬하지 않도록)
      isAutoSubmittingRef.current = true;
      setTimeout(() => { isAutoSubmittingRef.current = false; }, 80);

      // 카운터 초기화
      composingKeystrokesRef.current = 0;
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
          // 복습 다음 배치
          setReviewIndex(nextReviewIndex);
          setCurrentBatchChars("");
          updateTypedWord(""); clearInputElement();
        }
        return;
      }

      // 정답\! 다음 배치로 이동
      const nextBatchStart = batchStartIndex + batchSize;

      if (nextBatchStart >= randomizedIndices.length) {
        // 모든 배치 완료 - 시간 많이 걸린 5개 복습 시작
        // allResults에서 시간 많이 걸린것부터 정렬 후 상위 5개 선택
        // 주의: 현재 배치의 결과가 아직 allResults에 반영 안 된 상태, prev를 사용
        setAllResults(prev => {
          const modeOnly = prev.filter(r => r.mode === mode);
          const sorted = [...modeOnly].sort((a, b) => b.elapsedTime - a.elapsedTime);
          const top5 = sorted.slice(0, 5).map(r => r.chars).filter(c => c.length > 0);
          if (top5.length > 0) {
            // setTimeout으로 상태 업데이트 분리 (React batching 이슈 회피)
            setTimeout(() => {
              setReviewBatches(top5);
              setReviewIndex(0);
              setIsReviewMode(true);
              setBatchRandomFillCount(0);
              setCurrentBatchChars("");
              updateTypedWord(""); clearInputElement();
            }, 0);
          } else {
            // 복습할 배치가 없으면 바로 라운드 완료
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
        updateTypedWord(""); clearInputElement();
      }
    }
  }, [typedWord, currentBatchChars, isPracticing, isBatchMode, batchStartIndex, batchSize, randomizedIndices.length, isRoundComplete, currentWordStartTime, currentWordKeystrokes, accumulatedKeystrokes, accumulatedElapsedMs, isReviewMode, reviewIndex, reviewBatches, mode, resetCurrentWordTracking, updateTypedWord]);

  // 연습 정지 시 결과 초기화
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

    let rafId: number;
    const tick = () => {
      if (currentWordStartTime) {
        const currentMs = Date.now() - currentWordStartTime;
        const totalMs = accumulatedElapsedMs + currentMs;
        // DOM 직접 업데이트 (React 리렌더 없이 타이머 표시)
        if (elapsedTimerRef.current) {
          elapsedTimerRef.current.textContent = `${formatElapsedTime(totalMs)}`;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [isPracticing, countdown, isRoundComplete, currentWordStartTime, accumulatedElapsedMs]);

  // 표시 영역 자동 스크롤 (새 글자가 추가될 때 아래로)
  useEffect(() => {
    if (displayAreaRef.current && isPracticing && !isRoundComplete) {
      displayAreaRef.current.scrollTop = displayAreaRef.current.scrollHeight;
    }
  }, [currentDisplayIndex, isPracticing, isRoundComplete]);


  // ESC 키로 연습 시작/정지
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
  }, [mode, isSoundEnabled, toggleSound]);

  // 현재 모드에서 사용할 결과만 필터링
  const modeResults = useMemo(() => pickModeResults(allResults, mode), [allResults, mode]);
  const sentenceDisplayResults = useMemo(
    () => (isSentenceReview && modeResults.length === 0 ? preReviewResults : modeResults),
    [isSentenceReview, modeResults, preReviewResults]
  );
  const positionStageSummary = useMemo(
    () =>
      positionEnabledStages.length === 1
        ? (POSITION_STAGE_OPTIONS.find((v) => v.key === positionEnabledStages[0])?.label ?? positionEnabledStages[0])
        : `${positionEnabledStages.length}단계 혼합`,
    [positionEnabledStages]
  );
  const sentenceProgressLabel = useMemo(() => {
    const effectiveTotal = totalCount > 0 ? totalCount : sentences.length;
    if (isPracticing) {
      if (isSentenceReview && preReviewSentenceStateRef.current) {
        const saved = preReviewSentenceStateRef.current;
        const savedTotal = saved.totalCount > 0 ? saved.totalCount : sentences.length;
        return `${saved.progressCount}/${savedTotal}(${progressCount}/${effectiveTotal})`;
      }
      return effectiveTotal > 0 ? `${progressCount}/${effectiveTotal}` : `${progressCount}`;
    }
    if (roundCompleteResult) {
      if (roundCompleteResult.reviewTotal != null) {
        return `${roundCompleteResult.total}/${roundCompleteResult.total}(${roundCompleteResult.reviewCorrect}/${roundCompleteResult.reviewTotal})`;
      }
      return `${roundCompleteResult.total}/${roundCompleteResult.total}`;
    }
    return effectiveTotal > 0 ? `${progressCount}/${effectiveTotal}` : `${progressCount}`;
  }, [isPracticing, isSentenceReview, preReviewSentenceStateRef, totalCount, sentences.length, progressCount, roundCompleteResult]);

  // 평균 결과 (JSX에서 여러 번 쓰일 수 있으므로 useMemo로 1회만 계산)
  const averageResult = useMemo(() => {
    const stats = computeSessionStats(modeResults);
    if (!stats) return { avgKpm: 0, avgCpm: 0, avgTime: 0 };
    return {
      avgKpm: stats.avgKpmRounded,
      avgCpm: stats.avgCpmRounded,
      avgTime: Math.round(stats.totalElapsedTime / stats.totalResults)
    };
  }, [modeResults]);

  // 화면에 표시될 글자
  const displayedText = useMemo((): string => {
    if (isBatchMode) {
      return currentBatchChars;
    }
    // 보고치라/랜덤 모드: 인덱스 순서대로 표시 (랜덤은 섞임, 보고치라는 순서)
    return randomizedIndices.slice(0, currentDisplayIndex).map(index => sequentialText[index]).join('');
  }, [isBatchMode, currentBatchChars, randomizedIndices, currentDisplayIndex, sequentialText]);

  // 타이핑과 원본텍스트 맞춤 계산 (타이핑의 10~1글자 역방향 매칭으로 찾기)
  const scoringOriginalText = useMemo((): string => {
    if (!isRoundComplete || typedWord.length === 0) return '';

    const displayedClean = displayedText.replace(/\s+/g, '');
    const typedClean = typedWord.replace(/\s+/g, '');

    if (typedClean.length === 0) return '';

    // 타이핑의 10~1글자로 역방향 위치 찾기
    for (let len = Math.min(10, typedClean.length); len >= 1; len--) {
      const lastChars = typedClean.slice(-len);

      // 역방향으로 부분문자열 검사
      for (let i = displayedClean.length - len; i >= 0; i--) {
        const window = displayedClean.slice(i, i + len);
        if (window === lastChars) {
          // 해당 위치까지의 원본을 반환
          return displayedClean.slice(0, i + len);
        }
      }
    }

    // 찾지 못하면 전체 원본 반환
    return displayedClean;
  }, [isRoundComplete, displayedText, typedWord]);

  // 전체 마킹 (일시정지/완료 시에만) - 타이핑과 원본텍스트 맞춤 기준
  const markedText = useMemo((): FullMarkedChar[] => {
    if ((mode !== "sequential" && mode !== "longtext") || !isRoundComplete || typedWord.length === 0) {
      return [];
    }
    return getFullMarkedText(scoringOriginalText, typedWord);
  }, [mode, isRoundComplete, scoringOriginalText, typedWord]);

  // 채점 결과 (일시정지/완료 시에만) - 타이핑과 원본텍스트 맞춤 기준
  const scoringResult = useMemo((): ScoringResult | null => {
    if ((mode !== "sequential" && mode !== "longtext") || !isRoundComplete || typedWord.length === 0) {
      return null;
    }
    return analyzeScoring(scoringOriginalText, typedWord);
  }, [mode, isRoundComplete, scoringOriginalText, typedWord]);

  // 원본 (위칸) 오류 마킹 (일시정지/완료 시에만) - 타이핑과 원본텍스트 맞춤 기준
  const markedOriginalText = useMemo((): MarkedChar[] => {
    if ((mode !== "sequential" && mode !== "longtext") || !isRoundComplete || !scoringResult) {
      return [];
    }
    return getMarkedText(scoringOriginalText, scoringResult);
  }, [mode, isRoundComplete, scoringOriginalText, scoringResult]);

  // 라운드가 진짜 완료됐는지 (타이핑의 10~1글자 위치 확인)
  const isFullyComplete = useMemo((): boolean => {
    if (!isRoundComplete) return false;

    // 매매치라 모드: 배치복습까지 완료해야 진정한 라운드 완료
    if (isBatchMode) {
      return isBatchReviewDone;
    }

    const displayedClean = displayedText.replace(/\s+/g, '');
    const typedClean = typedWord.replace(/\s+/g, '');

    // 최소 길이 체크 (원본의 50% 이상을 타이핑해야 함)
    if (typedClean.length < displayedClean.length * 0.5) return false;

    // 타이핑의 10~1글자 중 하나라도 일치하면 완료
    for (let len = Math.min(10, displayedClean.length); len >= 1; len--) {
      const originalEnd = displayedClean.slice(-len);
      const typedEnd = typedClean.slice(-len);
      if (originalEnd === typedEnd) {
        return true;
      }
    }
    return false;
  }, [isRoundComplete, displayedText, typedWord, isBatchMode, isBatchReviewDone]);

  // 라운드 완료 시 드로어 열기 + 완료 횟수 누적 저장
  useEffect(() => {
    if (isFullyComplete) {
      setIsDrawerOpen(true);
      if (practiceSlot !== null && (mode === "sequential" || mode === "longtext" || mode === "random")) {
        const modeKey = isBatchMode ? "batch" : mode;
        incrementCompletedRounds(practiceSlot, modeKey);
      }
    }
  }, [isFullyComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const createCurrentSentenceState = () =>
    createSavedSentenceState({
      sentences,
      generatedCount,
      currentSentenceIndex,
      progressCount,
      correctCount,
      incorrectCount,
      incorrectWords,
      totalCount,
    });

  // 문장모드 상태 저장 (다른 모드 전환 시)
  const saveSentenceState = () => {
    if (mode === "sentences" && sentences.length > 0) {
      savedSentenceStateRef.current = createCurrentSentenceState();
    }
  };

  // 긴글모드 상태 저장 (다른 모드 전환 시)
  const saveLongtextState = () => {
    if (mode === "longtext" && sentences.length > 0) {
      savedLongtextStateRef.current = createSavedLongtextState({
        sentences,
        currentSentenceIndex,
        progressCount,
        correctCount,
        incorrectCount,
        incorrectWords,
        totalCount,
        inputText,
      });
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

  // 모드 전환 시 정리 (모드 공통 연습 상태 초기화)
  const cleanupForModeSwitch = () => {
    setRoundCompleteResult(null);
    setLastResult({ kpm: 0, cpm: 0, elapsedTime: 0 });
    setAccumulatedKeystrokes(0);
    setAccumulatedElapsedMs(0);
    setDisplayElapsedTime(0);
    setIsSentenceReview(false);
    setPreReviewResults([]);
    setIsRoundComplete(false);
    stopPractice();
    setSentences([]);
    resetReview();
    resetBatchAndReviewState();
    setCountdown(null);
    if (isPracticing || countdown !== null) {
      setIsDrawerOpen(true);
    }
  };

  const startSentenceReviewFlow = (reviewSentences: string[], reviewStartProgress?: number) => {
    if (reviewStartProgress !== undefined) {
      lastSentenceReviewAtRef.current = reviewStartProgress;
    }
    setPreReviewResults(pickSentenceModeResults(allResults));
    stopPractice();
    resetReview();
    setIsSentenceReview(true);
    setRoundCompleteResult(null);
    setSentences(reviewSentences);
    resumeSentencePractice(toSentenceReviewResumePayload(reviewSentences));
    setIsDrawerOpen(false);
    setTimeout(() => wordInputRef.current?.focus(), 50);
  };

  // 문장모드 상태 복원 (문장모드로 돌아올 때)
  const restoreSentenceState = () => {
    const saved = savedSentenceStateRef.current;
    if (saved) {
      setGeneratedCount(saved.generatedCount);
      setPracticingMode("sentences");
      resumeSentencePractice(toSentenceResumePayload(saved));
    }
  };

  // 긴글모드 상태 복원 (긴글모드로 돌아올 때)
  const restoreLongtextState = () => {
    const saved = savedLongtextStateRef.current;
    if (saved) {
      updateInputText(saved.inputText);
      setPracticingMode("longtext");
      resumeSentencePractice(toLongtextResumePayload(saved));
    }
  };

  const {
    handleSwitchPosition,
    handleSwitchWords,
    handleSwitchSentences,
    handleSwitchLongtext,
    handleSwitchBatchSequential,
    handleSwitchSequential,
    handleSwitchRandom,
  } = createModeSwitchHandlers({
    mode,
    isBatchMode,
    saveSentenceState,
    saveLongtextState,
    cleanupForModeSwitch,
    switchMode,
    restoreSentenceState,
    restoreLongtextState,
    setIsBatchMode,
  });

  const saveSentenceDefaults = () => {
    saveDetailSettings("detailSettings_sentences", {
      speechRate, displayFontSize, rankFontSize, showText, isSoundEnabled, sentenceReviewWindow, wordsPerSentence,
    });
    alert("문장모드 상세설정이 기본값으로 저장되었습니다.");
  };

  const saveWordDefaults = () => {
    saveDetailSettings("detailSettings_words", {
      speechRate, displayFontSize, showText, isSoundEnabled,
    });
    alert("단어모드 상세설정이 기본값으로 저장되었습니다.");
  };

  const savePositionDefaults = () => {
    saveDetailSettings("detailSettings_position", {
      speechRate, displayFontSize, showText, isSoundEnabled, showPositionKeyboard,
    });
    alert("자리연습 상세설정이 기본값으로 저장되었습니다.");
  };

  const handleBatchSizeChange = (size: number) => {
    setBatchSize(size);
    if (isPracticing && isBatchMode && !isReviewMode) {
      setCurrentBatchChars("");
      updateTypedWord("");
      clearInputElement();
    }
  };

  const handleVideoPlaybackRateChange = (rate: number) => {
    setVideoPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleVideoVolumeChange = (vol: number) => {
    setVideoVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  };

  const handleSelectVideoFromDrawer = (index: number) => {
    setCurrentVideoIndex(index);
    setAbRepeat({ a: null, b: null });
  };

  const handleSpeechRateChange = (rate: number) => {
    useTypingStore.getState().changeSpeechRate(rate);
  };

  const toggleShowText = () => setShowText((prev) => !prev);

  const togglePositionKeyboard = () => setShowPositionKeyboard((prev) => !prev);

  const handleGeminiApiKeyChange = (apiKey: string) => {
    setGeminiApiKey(apiKey);
    localStorage.setItem("gemini_api_key", apiKey);
  };

  const resetSentencesForWordSentencePanel = () => {
    if (isGenerating) {
      generateAbortRef.current?.abort();
    }
    if (practicingMode === "sentences") {
      stopPractice();
      setPracticingMode(null);
    }
    setSentences([]);
    setGeneratedCount(0);
    setTotalCount(0);
    setCanGenerateMore(false);
    setGenerateError(null);
    setIsSentenceReview(false);
    setAllResults([]);
    setLastResult({ kpm: 0, cpm: 0, elapsedTime: 0 });
    updateTypedWord("");
    clearInputElement();
    setPracticeText("");
    savedSentenceStateRef.current = null;
    setTimeout(() => wordInputRef.current?.focus(), 0);
  };

  const handleStartSentenceReview = (parsedWords: string[]) => {
    setIsSentenceReview(true);
    setRoundCompleteResult(null);
    resetBatchAndReviewState();
    setPracticeSlot(selectedSlot);
    setIsDrawerOpen(false);
    startPractice(parsedWords);
    setTotalCount(sentences.length);
    setTimeout(() => wordInputRef.current?.focus(), 50);
  };

  const clearSentenceResults = () => {
    setAllResults((prev) => prev.filter((r) => r.mode !== "sentences"));
    setPreReviewResults([]);
  };

  const clearSentencePracticeText = () => {
    setPracticeText("");
    if (practiceInputRef.current) practiceInputRef.current.value = "";
  };

  const handleSentencePracticeTab: (e: KeyboardEvent<HTMLTextAreaElement>) => void = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      setPracticeText("");
      wordInputRef.current?.focus();
    }
  };

  const toggleProficiencyPanel = () => {
    const next = !showProficiencyPanel;
    setShowProficiencyPanel(next);
    if (next) {
      refreshToday();
      refreshOverall();
    }
  };

  const includeInOverallPosition = () => {
    setOverallPositionSamples((prev) => [...prev, ...positionSamples].slice(-POSITION_OVERALL_SAMPLE_LIMIT));
    setPositionSamples([]);
  };

  const handleRemoveExcludedPositionChar = (stage: PositionStage, char: string) => {
    removePositionExcludedChar(stage, char);
    regeneratePositionQueueFromCurrent();
  };

  const handleGenerateMoreFromControl = (
    words: string[],
    targetCount: number,
    alreadyGenerated: number,
    existingSentences: string[]
  ) => {
    generateMoreSentences(words, targetCount, alreadyGenerated, true, 2500, existingSentences);
  };

  const wordSentenceControlProps = {
    mode,
    practicingMode,
    isGenerating,
    generatedCount,
    isPracticing,
    todayCompletedRounds,
    generateError,
    generateErrorMessage: getErrorMessage(generateError ?? ""),
    showRawGenerateError: !!generateError && getErrorMessage(generateError) !== generateError,
    aiModelName,
    canGenerateMore,
    selectedModel,
    modelOptions: GEMINI_MODEL_OPTIONS,
    sentenceStyles: SENTENCE_STYLES,
    sentenceStyle,
    useRandomSentences,
    inputText,
    sentences,
    sentenceTargetCount: sentenceTargetCountRef.current,
    onStartOrStop: handleStartOrStopPractice,
    onResetSentences: resetSentencesForWordSentencePanel,
    onSelectModel: setSelectedModel,
    onGenerateMore: handleGenerateMoreFromControl,
    onSetUseRandomSentences: setUseRandomSentences,
    onSetSentenceStyle: setSentenceStyle,
    apiCallCount,
    apiCallModels,
  };

  const wordSentenceRoundResultProps = {
    mode,
    isPracticing,
    isSentenceReview,
    hasSentences: sentences.length > 0,
    inputText,
    selectedSlot,
    roundCompleteResult,
    onStartSentenceReview: handleStartSentenceReview,
  };

  // 긴글모드 랜덤 생성 핸들러
  const handleGenerateLongText = () => {
    if (isGeneratingLongText) {
      // 생성 중이면 중단
      generateLongTextAbortRef.current?.abort();
      generateLongTextAbortRef.current = null;
      setIsGeneratingLongText(false);
      setGeneratingKeyword("");
      return;
    }

    if (!geminiApiKey) {
      setLongtextGenerateError("API 키가 필요합니다. 설정에서 Gemini API 키를 입력하세요.");
      return;
    }

    let topicKeyword: string;
    let displayKeyword: string;

    if (longtextUseRandom) {
      // 랜덤 문장: 키워드 풀에서 랜덤 선택
      const { category, keyword } = getRandomLongTextKeyword();
      topicKeyword = keyword;
      displayKeyword = `${category} - ${keyword}`;
    } else {
      // 원문 단어: 입력칸의 텍스트를 주제로 사용
      const words = inputText.trim().split("/").filter(Boolean);
      if (words.length === 0) {
        setLongtextGenerateError("입력칸에 주제 단어를 입력하세요. (슬래시로 구분)");
        return;
      }
      topicKeyword = words.join(", ");
      displayKeyword = `원문: ${topicKeyword.slice(0, 30)}${topicKeyword.length > 30 ? "..." : ""}`;
    }

    setGeneratingKeyword(displayKeyword);
    setIsGeneratingLongText(true);
    setGeneratedLongText("");
    setLongtextGenerateError(null);
    setLongtextModelName("");

    const abortController = new AbortController();
    generateLongTextAbortRef.current = abortController;

    let accumulated = "";

    generateLongTextStream(
      topicKeyword,
      longTextLength,
      geminiApiKey,
      longtextStyle,
      (chunk) => {
        accumulated += chunk;
        setGeneratedLongText(accumulated);
      },
      (totalLength) => {
        setIsGeneratingLongText(false);
        setGeneratingKeyword("");
        generateLongTextAbortRef.current = null;
        // 생성된 텍스트를 입력칸에 세팅
        updateInputText(accumulated);
        incrementApiCallCount();
        console.log(`[긴글 생성 완료] ${totalLength}자, 키워드: ${displayKeyword}`);
      },
      (error) => {
        setIsGeneratingLongText(false);
        setGeneratingKeyword("");
        generateLongTextAbortRef.current = null;
        setLongtextGenerateError(getErrorMessage(error));
      },
      (model) => {
        aiModelNameRef.current = model;
        setLongtextModelName(model);
      },
      abortController.signal,
      selectedModel,
    ).catch((err) => {
      if ((err as Error).name === "AbortError") return;
      setIsGeneratingLongText(false);
      setGeneratingKeyword("");
      generateLongTextAbortRef.current = null;
      setLongtextGenerateError(getErrorMessage(String(err)));
    });
  };

  const sequentialLongtextPracticeControlProps = {
    mode: mode as "sequential" | "longtext",
    practicingMode,
    countdown,
    onTogglePractice: handleStartOrStopPractice,
    isPracticing,
    isRoundComplete,
    isFullyComplete,
    practiceSlot,
    slotNames,
    lastResult,
    modeResultsLength: modeResults.length,
    averageResult,
    isBatchMode,
    slotCompletedRoundsBatch,
    slotCompletedRoundsNormal,
    progressCount,
    totalCount,
    isReviewMode,
    reviewIndex,
    reviewBatchesLength: reviewBatches.length,
    batchStartIndex,
    batchSize,
    randomizedIndicesLength: randomizedIndices.length,
    currentDisplayIndex,
    elapsedTimeLabel: mode === "longtext" ? formatElapsedTime(displayElapsedTime) : formatElapsedTime(lastResult.elapsedTime),
    // 긴글모드 랜덤 생성 props
    isGeneratingLongText,
    generatingKeyword,
    generatedLongText,
    longtextModelName,
    longtextGenerateError,
    onGenerateLongText: handleGenerateLongText,
    onClearLongtextError: () => setLongtextGenerateError(null),
    // 모델 선택 + 호출횟수
    selectedModel,
    onSelectModel: setSelectedModel,
    modelOptions: GEMINI_MODEL_OPTIONS,
    apiCallCount,
    apiCallModels,
    // 문체 + 원문/랜덤 선택
    longtextStyle,
    onSetLongtextStyle: setLongtextStyle,
    longtextUseRandom,
    onSetLongtextUseRandom: setLongtextUseRandom,
    sentenceStyles: SENTENCE_STYLES,
  };

  const wordSentencePracticeStatusProps = {
    mode,
    isPracticing,
    isSentenceReview,
    progressCount,
    totalCount,
    lastResult,
    modeResultsLength: modeResults.length,
    averageResult,
    elapsedTimerRef,
    preReviewProgress: preReviewSentenceStateRef.current?.progressCount ?? 0,
    preReviewTotal: preReviewSentenceStateRef.current?.totalCount ?? 0,
    displayElapsedTimeLabel: formatElapsedTime(displayElapsedTime),
  };

  const practiceHeaderProps = {
    mode,
    isBatchMode,
    onPosition: handleSwitchPosition,
    onWords: handleSwitchWords,
    onSentences: handleSwitchSentences,
    onLongtext: handleSwitchLongtext,
    onBatchSequential: handleSwitchBatchSequential,
    onSequential: handleSwitchSequential,
    onRandom: handleSwitchRandom,
    isLoggedIn: !!user,
    userEmail: user?.email,
    onLogout: signOut,
    onLogin: () => setShowLoginModal(true),
  };

  const practiceDrawerProps = {
    isDrawerOpen,
    setIsDrawerOpen,
    mode,
    isPositionMode,
    isWordLikeMode,
    selectedSlot,
    slotNames,
    favoriteSlots,
    handleLoadPreset,
    toggleFavoriteSlot,
    handleRenameSlot,
    speechRate,
    displayFontSize,
    rankFontSize,
    showText,
    isSoundEnabled,
    showPositionKeyboard,
    geminiApiKey,
    onSaveSentenceDefaults: saveSentenceDefaults,
    onSaveWordDefaults: saveWordDefaults,
    onSavePositionDefaults: savePositionDefaults,
    onSpeechRateChange: handleSpeechRateChange,
    onDisplayFontSizeChange: setDisplayFontSize,
    onRankFontSizeChange: setRankFontSize,
    onToggleShowText: toggleShowText,
    onToggleSound: toggleSound,
    onTogglePositionKeyboard: togglePositionKeyboard,
    onGeminiApiKeyChange: handleGeminiApiKeyChange,
    sentenceReviewWindow,
    onSentenceReviewWindowChange: setSentenceReviewWindow,
    wordsPerSentence,
    onWordsPerSentenceChange: setWordsPerSentence,
    useRandomSentences,
    sequentialSpeed,
    sequentialSpeechRate,
    inputFontSize,
    charsPerRead,
    longTextLength,
    batchSize,
    isBatchMode,
    onSaveDetailSettings: handleSaveDetailSettings,
    onSequentialSpeedChange: updateSequentialSpeed,
    onSequentialSpeechRateChange: setSequentialSpeechRate,
    onInputFontSizeChange: setInputFontSize,
    onCharsPerReadChange: setCharsPerRead,
    onLongTextLengthChange: setLongTextLength,
    onBatchSizeChange: handleBatchSizeChange,
    videoPlaybackRate,
    videoVolume,
    videoPlaylist,
    currentVideoIndex,
    onRandomInputFontSizeChange: setInputFontSize,
    onPlaybackRateChange: handleVideoPlaybackRateChange,
    onVolumeChange: handleVideoVolumeChange,
    onSelectVideo: handleSelectVideoFromDrawer,
    removeVideoFromPlaylist,
    inputText,
    updateInputText,
    handleSaveToSlot,
    handleTextareaChange,
    handleTextareaDrop,
  };

  const modeStatsFabProps = {
    showModeStats,
    todayCompletedRounds,
    modeCompletedRounds,
    onToggle: () => setShowModeStats((prev) => !prev),
    onResetMode: resetModeCompletedRounds,
    user,
  };

  const practiceTopPanelsProps = {
    mode,
    wordSentenceControlProps,
    wordSentenceRoundResultProps,
    sequentialLongtextPracticeControlProps,
    wordSentencePracticeStatusProps,
  };

  const longtextModePanelProps = {
    showText,
    mode,
    practicingMode,
    displayAreaRef,
    wordInputRef,
    practiceInputRef,
    countdown,
    practiceSlot,
    slotNames,
    isPracticing,
    displayFontSize,
    lastSentenceTyped,
    sentences,
    isRoundComplete,
    currentSentenceIndex,
    typedWord,
    isComposing: isComposingRef.current,
    correctCount,
    incorrectCount,
    totalCount,
    onStartNextRound: startNextRound,
    onInputChange: handleInputChange,
    onInputKeyDown: handleKeyDown,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    practiceText,
    onPracticeTextChange: setPracticeText,
    modeResults,
    rankFontSize,
    onResetResults: () => {
      setAllResults((prev) => prev.filter((r) => r.mode !== "longtext"));
    },
  };

  const sequentialPracticePanelProps = {
    showText,
    mode,
    displayAreaRef,
    countdown,
    practiceSlot,
    slotNames,
    slotCompletedRoundsNormal,
    slotCompletedRoundsBatch,
    isRoundComplete,
    markedOriginalText,
    hoveredOrigIdx,
    setHoveredOrigIdx,
    displayFontSize,
    displayedText,
    showResumeHighlight,
    resumePosition,
    isBatchMode,
    batchRandomFillCount,
    scoringResult,
    markedText,
    inputFontSize,
    typingTextareaRef,
    handleInputChange,
    setShowResumeHighlight,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
    isFullyComplete,
    isBatchReviewDone,
    practiceText,
    setPracticeText,
    favoriteSlots,
    selectedSlot,
    updateInputText,
    startNextRound,
    resumeRound,
  };

  const randomModePanelProps = {
    mode,
    videoSourceTab,
    setVideoSourceTab,
    youtubeUrl,
    setYoutubeUrl,
    handleYoutubeUrlSubmit,
    videoPlaylistLength: videoPlaylist.length,
    skipSeconds,
    setSkipSeconds,
    videoLoop,
    setVideoLoop,
    playlistLoop,
    setPlaylistLoop,
    abRepeat,
    setAbRepeat,
    playPreviousVideo,
    playNextVideo,
    clearPlaylist,
    videoRef,
    dropZoneRef,
    isDragging,
    videoSrc,
    videoPlaybackRate,
    videoVolume,
    currentVideoIndex,
    setCurrentVideoIndex,
    onDragEnter: handleDragEnter,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    youtubeVideoId,
    inputFontSize,
    onChangeText: updateTypedWord,
    onKeyDown: handleKeyDown,
  };

  const commonPracticeTextPanelProps = {
    showText,
    mode,
    isPositionMode,
    isPracticing,
    positionEnabledStages,
    setPositionEnabledStages,
    switchPositionStageImmediately,
    activeSingleStage,
    positionStageOptions: POSITION_STAGE_OPTIONS,
    currentWordIndex,
    shuffledWords,
    displayFontSize,
    showPositionKeyboard,
    hoveredPositionKeyId,
    setHoveredPositionKeyId,
    hoveredTransitionKeyIds,
    positionPerKeyMap,
    positionLeftRows: POSITION_LEFT_ROWS,
    positionRightRows: POSITION_RIGHT_ROWS,
    positionThumbRow: POSITION_THUMB_ROW,
    isReviewActive,
    currentSentenceIndex,
    sentences,
    lastSentenceTyped,
    reviewType,
    currentReviewIndex,
    reviewWordsLength: reviewWords.length,
    currentReviewTarget,
    typedWord,
    isComposing: isComposingRef.current,
    wordInputRef,
    isSentenceReview,
    onInputChange: handleInputChange,
    onInputKeyDown: handleKeyDown,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
  };

  const sentenceModePanelProps = {
    mode,
    isPracticing,
    correctCount,
    incorrectCount,
    roundCompleteResult,
    progressLabel: sentenceProgressLabel,
    isSentenceReview,
    practiceText,
    setPracticeText,
    practiceInputRef,
    rankFontSize,
    results: sentenceDisplayResults,
    onClearSentenceResults: clearSentenceResults,
    onClearPracticeText: clearSentencePracticeText,
    onPracticeTab: handleSentencePracticeTab,
  };

  const practiceFooterPanelsProps = {
    positionCycleToast,
    mode,
    currentWordIndex,
    isReviewActive,
    currentReviewIndex,
    wordInputRef,
    onInputChange: handleInputChange,
    onInputKeyDown: handleKeyDown,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    correctCount,
    halfCorrectCount,
    incorrectCount,
    progressCount,
    totalCount,
    isPositionMode,
    isPracticing,
    positionEnabledStages,
    positionStageSummary,
    activeSingleStage,
    reviewType,
    reviewWordsLength: reviewWords.length,
    showProficiencyPanel,
    onToggleProficiency: toggleProficiencyPanel,
    todayProficiencies,
    overallProficiencies,
    onRefreshToday: refreshToday,
    onRefreshOverall: refreshOverall,
    onClearTodayWord: clearToday,
    onClearOverallWord: clearOverall,
    onMergeToOverallWord: mergeToOverall,
    onCloseWordProficiency: () => setShowProficiencyPanel(false),
    hoveredPositionKeyId,
    stagePositionMetrics,
    positionMetrics,
    overallStagePositionMetrics,
    overallPositionMetrics,
    overallPositionSampleCount: overallPositionSamples.length,
    activeStageExcludedChars,
    onClearTodayPosition: () => setPositionSamples([]),
    onIncludeInOverallPosition: includeInOverallPosition,
    onClearOverallPosition: () => setOverallPositionSamples([]),
    onRemoveExcludedChar: handleRemoveExcludedPositionChar,
  };

  return (
    <div className="p-4 w-full">
      <PracticeHeader {...practiceHeaderProps} />

      <div className="flex flex-row gap-0">
        <PracticeDrawer {...practiceDrawerProps} />

        <PracticeMainArea
          practiceTopPanelsProps={practiceTopPanelsProps}
          longtextModePanelProps={longtextModePanelProps}
          sequentialPracticePanelProps={sequentialPracticePanelProps}
          randomModePanelProps={randomModePanelProps}
          commonPracticeTextPanelProps={commonPracticeTextPanelProps}
          sentenceModePanelProps={sentenceModePanelProps}
          practiceFooterPanelsProps={practiceFooterPanelsProps}
        />
      </div>
      {showLoginModal && (
        <LoginPage onClose={() => setShowLoginModal(false)} />
      )}
      <ModeStatsFab {...modeStatsFabProps} />
    </div>
  );
}




