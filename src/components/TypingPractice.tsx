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
  const [practicingMode, setPracticingMode] = useState<string | null>(null); // ���� ������ ��� ����
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
  } = useSlotManager(inputText);
  const [displayFontSize, setDisplayFontSize] = useState(20); // ���� ǥ�� ���� ���� ũ��
  const [inputFontSize, setInputFontSize] = useState(19.5); // �Ʒ��� Ÿ���� ���� ���� ũ��
  const [rankFontSize, setRankFontSize] = useState(12); // �ְ�Ÿ/����Ÿ ���� ���� ũ��
  const [charsPerRead, setCharsPerRead] = useState(3); // �� ���ھ� ������
  const [sequentialSpeechRate, setSequentialSpeechRate] = useState(1); // ����ġ�� ���� �ӵ� (1���)
  const { speakText, clearAllTimeouts } = useHeamiVoice(isSoundEnabled, speechRate, sequentialSpeechRate);
  const [countdown, setCountdown] = useState<number | null>(null); // ī��Ʈ�ٿ� ����
  const [, setRoundStartTime] = useState<number | null>(null); // ���� ���� �ð�
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRoundComplete, setIsRoundComplete] = useState(false); // ���� �Ϸ� ���� (��� Ȯ�� ���)
  const [isSentenceReview, setIsSentenceReview] = useState(false); // ������ ���� �� ����
  const lastSentenceReviewAtRef = useRef(0); // ������ ���� Ʈ���ŵ� progressCount
  const [preReviewResults, setPreReviewResults] = useState<typeof allResults>([]); // ���� �� �ְ�Ÿ/����Ÿ ������
  const [accumulatedKeystrokes, setAccumulatedKeystrokes] = useState(0); // ���� Ÿ��
  const [accumulatedElapsedMs, setAccumulatedElapsedMs] = useState(0); // ���� ��� �ð�
  const [displayElapsedTime, setDisplayElapsedTime] = useState(0); // �ǽð� ǥ�ÿ� ��� �ð�
  const typingTextareaRef = useRef<HTMLTextAreaElement | null>(null); // Ÿ���� ĭ ����
  const wordInputRef = useRef<HTMLInputElement | null>(null); // �ܾ�/���� ��� �Է� ĭ ����
  const practiceInputRef = useRef<HTMLTextAreaElement | null>(null); // ���� ĭ ����
  const isAutoSubmittingRef = useRef(false); // �ڵ� ���� �ߺ� ����
  const isComposingRef = useRef(false); // �ѱ� IME ���� �� ����
  const pendingCompositionEndRef = useRef(false); // ���� �Ϸ� �� �ڵ����� ��üũ �÷���
  const composingKeystrokesRef = useRef(0); // ���� �� Ÿ�� ī��Ʈ (ref�� �����Ͽ� ������ ����)
  const composingRAFRef = useRef<number | null>(null); // ���� �� RAF ��ٿ ID
  const elapsedTimerRef = useRef<HTMLSpanElement | null>(null); // ����ð� DOM ���� ������Ʈ��

  // input�� ���� Ŭ�����ϴ� ���� (uncontrolled input��)
  const clearInputElement = () => {
    if (wordInputRef.current) wordInputRef.current.value = "";
    if (typingTextareaRef.current) typingTextareaRef.current.value = "";
  };
  const displayAreaRef = useRef<HTMLDivElement | null>(null); // ���� ǥ�� ���� ����

  // �Ÿ�ġ�� ��� ����
  const [isBatchMode, setIsBatchMode] = useState(false); // �Ÿ�ġ�� ��� Ȱ��ȭ ����
  const [batchSize, setBatchSize] = useState(5); // �ѹ��� ������ ���� ��
  const [batchStartIndex, setBatchStartIndex] = useState(0); // ���� ��ġ ���� �ε���
  const [currentBatchChars, setCurrentBatchChars] = useState<string>(""); // ���� ��ġ�� ǥ�õ� ���ڵ�
  const [batchRandomFillCount, setBatchRandomFillCount] = useState(0); // ������ ��ġ���� �������� ä�� ���� ��

  // ���� ��� ���� (�ð� ���� �ɸ� 5�� �ٽ� ����)
  const [isReviewMode, setIsReviewMode] = useState(false); // ���� ��� ����
  const [reviewBatches, setReviewBatches] = useState<string[]>([]); // ������ ��ġ ���
  const [reviewIndex, setReviewIndex] = useState(0); // ���� ���� ���� �ε���
  const [isBatchReviewDone, setIsBatchReviewDone] = useState(false); // �������� ������ ��������

  // �ܾ��� ���� �ڵ����� ��
  const {
    isReviewActive, reviewWords, currentReviewIndex, currentReviewTarget,
    reviewType, checkAndStartReview, startFailedReview, handleReviewSubmit, resetReview,
  } = useWordReview({ onRemoveIncorrectWord: removeIncorrectWord });

  // �ܾ� ���õ� ���� ��
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

  // 1�� ���� ������ �����Ʈ �ڵ� ���� (1ȸ��)
  useEffect(() => {
    const wasActive = prevReviewActiveRef.current;
    const wasType = prevReviewTypeRef.current;
    prevReviewActiveRef.current = isReviewActive;
    prevReviewTypeRef.current = reviewType;

    // 1�� ������ ��� ������ ���� 2�� ����
    if (wasActive && !isReviewActive && wasType === "primary" && reviewFailedWords.length > 0) {
      startFailedReview(reviewFailedWords);
    }
  }, [isReviewActive, reviewType, reviewFailedWords, startFailedReview]);

  // ���� �÷��̾� ��
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

  // ���̶���Ʈ�� ���� (�Ʒ�ĭ hover �� ��ĭ �ش� ��ġ ǥ��)
  const [hoveredOrigIdx, setHoveredOrigIdx] = useState<number | null>(null);

  // ���� �Ϸ� �� ������ �ؽ�Ʈ
  const [practiceText, setPracticeText] = useState("");

  // �簳 ���� ���̶���Ʈ ǥ�ÿ�
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

  // �ܾ�/���� ��� ���� �Ϸ� ���
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

  // AI ���� ���� ��
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
  // ������ ���� ���� (��� ��ȯ �� API ȣ�� ����)
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
  // ������ ���� �� ���� ���� (���� �� ���� ��ġ�� ����)
  const preReviewSentenceStateRef = useRef<SavedSentenceState | null>(null);


  // ����� �󼼼��� ����
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
    // ��庰 �󼼼��� �ε�
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

  // ������ ���ΰ�ħ �� �ڵ� �簳
  useEffect(() => {
    if (isPracticing && mode === "sentences" && sentences.length > 0) {
      // persist�� ������ ���� ? �Է� �ʵ忡 ��Ŀ��
      setTimeout(() => {
        wordInputRef.current?.focus();
      }, 100);
    }
  }, [isPracticing, mode, sentences.length]);


  // �ܾ�/����/�ڸ� ��� ���� �Ϸ� ����
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

  // ������ 20������ ����Ÿ 5�� �ڵ� ����
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
    // ������ 10���ڷ� �������� ���� ������ ��ġ ã��
    const text = isBatchMode
      ? currentBatchChars
      : randomizedIndices.slice(0, currentDisplayIndex).map(index => sequentialText[index]).join('');

    const bestPos = findBestSequentialResumePosition(typedWord, text);
    setResumePosition(bestPos);
    setShowResumeHighlight(true);

    setIsRoundComplete(false);
    setPracticeText(""); // ���� �ؽ�Ʈ �ʱ�ȭ
    // Ÿ���� ĭ�� ��Ŀ���ϰ� Ŀ���� ������ �̵�
    setTimeout(() => {
      const textarea = typingTextareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, 50);
  };

  // ���� ���� ���� (ī��Ʈ�ٿ� ����)
  // completedSlot: ��� �Ϸ��� ���� (ī��Ʈ�ٿ� ���� �� increment)
  // wasBatchMode: �Ϸ��� ���尡 �Ÿ�ġ�� ��忴����
  // nextSlot: ������ ������ ���� (�������� ������ selectedSlot ���)
  const startNextRound = (nextSlot?: number) => {
    // ��ξ� �ݱ�
    setIsDrawerOpen(false);
    // ���� ���� ���� (nextSlot�� ������ ���, ������ selectedSlot)
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
    updateTypedWord(""); clearInputElement(); // Ÿ���� ĭ �ʱ�ȭ
    setPracticeText(""); // ���� �ؽ�Ʈ �ʱ�ȭ
    setShowResumeHighlight(false); // ���̶���Ʈ �ʱ�ȭ
    resetBatchAndReviewState();
    // Ÿ��/�ڼ� �ʱ�ȭ
    setLastResult({ kpm: 0, cpm: 0, elapsedTime: 0 });
    setAllResults([]);
    startCountdown(() => {
      setRoundStartTime(Date.now());
      restartSequentialPractice();
      // Ÿ���� ĭ�� ��Ŀ��
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
    // �ؽ�Ʈ �巡��&��� ó��
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

  const handleCompositionStart = () => { isComposingRef.current = true; };
  const handleCompositionEnd = (event: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    // ���� �Ϸ� ����: ���� �Է°��� state�� ����ȭ (���� �� ������ ��ŵ�����Ƿ�)
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
    if (isAutoSubmittingRef.current) {
      clearInputElement();
      return;
    }

    const value = event.target.value;

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

    // ���� ���� �Է� Ű�� ī��Ʈ�մϴ�.
    // ������ Ű(Ctrl, Alt, Meta), ����Ű, ���Ű ���� �����մϴ�.
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

      // ù �Է¿��� Ÿ�̸� ���� (����/����Ű�� ���� ��ȣ���� ����)
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
          // 클라이언트 중복 필터: 이전에 나온 문장과 동일하면 스킵
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
      setGenerateErrorWithRetry(err instanceof Error ? err.message : "���� ������ �����߽��ϴ�.");
      setIsDrawerOpen(true);
      setIsGenerating(false);
      generateAbortRef.current = null;
      if (totalGenerated > 0) setTotalCount(totalGenerated);
    }
  };

  const handleStartOrStopPractice = async () => {
    // ���� �߿� Ŭ���ϸ� ������ �����ϰ� ���� �������� ��� ����
    if (isGenerating) {
      generateAbortRef.current?.abort();
      generateAbortRef.current = null;
      setIsGenerating(false);
      if (generatedCount > 0) {
        setTotalCount(generatedCount);
      }
      return;
    }
    // ī��Ʈ�ٿ� ���̰ų� ���� ���̸� ����
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
      const words = isPositionMode ? (parsedWords.length > 0 ? parsedWords : ["�ڸ�"]) : parsedWords;
      if (words.length > 0) {
        // ���� ���� ��� �ʱ�ȭ
        setRoundCompleteResult(null);
        resetBatchAndReviewState();
        // ���� ���� �� ���� ����/��� ����
        setPracticeSlot(selectedSlot);
        setPracticingMode(mode);
        // ��ξ� �ݱ�
        setIsDrawerOpen(false);
        if (mode === "longtext" || mode === "sequential" || mode === "random") {
          // ����ġ��/���� ���: ī��Ʈ�ٿ� �� ����
          startCountdown(() => {
            setRoundStartTime(Date.now());
            startPractice(words);
            // Ÿ���� ĭ�� ��Ŀ��
            setTimeout(() => typingTextareaRef.current?.focus(), 50);
          });
        } else if (mode === "sentences") {
          // ����� ������ ������ API ȣ�� ���� �ٷ� ���
          if (savedSentenceStateRef.current) {
            restoreSentenceState();
          } else {
            if (!geminiApiKey) {
              setGenerateError("���� ��带 ����Ϸ��� API Ű�� �Է��ϼ���.");
              setIsDrawerOpen(true);
              return;
            }
            // ���� ���: AI ���� ��Ʈ���� ���� (��ġ ����)
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
          // �ܾ� ���
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
    // ���� ���� ���� ���� ���� �Ұ� (���� �Ϸ� ���¿����� ���, ������� �׻� ���)
    if (mode !== "sentences" && ((isPracticing && !isRoundComplete) || countdown !== null)) {
      return;
    }
    setSelectedSlot(slot);
    const saved = localStorage.getItem(`slot_${slot}`);

    if (saved) {
      updateInputText(saved);
    } else {
      // �⺻�� ���
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
      // ��۸��: ���� ���� �ڵ����� ���, ���� ǥ�� ���ʿ�
      // ���� ����� ó��
      if (isSoundEnabled && sentences[currentSentenceIndex]) {
        speakText(sentences[currentSentenceIndex]);
      }
      return;
    }

    if (mode === "sequential" || mode === "random") {
      // ���� �Ϸ� ���¸� ���� ǥ�� ����
      if (isRoundComplete) return;

      // ī��Ʈ�ٿ� ���̸� ���� ǥ�� �� �� (�� ���� ������ �غ� ��)
      if (countdown !== null) return;

      // �Ÿ�ġ�� ���: batchSize��ŭ �ѹ��� ǥ��
      if (isBatchMode) {
        // ���� ����� ���
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
          // ���� ��ġ�� ���ڵ� ���
          const endIndex = Math.min(batchStartIndex + batchSize, randomizedIndices.length);
          const batchIndices = randomizedIndices.slice(batchStartIndex, endIndex);
          // ������ ��ġ�� batchSize���� ������ ���� ���ڷ� ä��
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
          updateTypedWord(""); clearInputElement(); // �� ��ġ ���� �� Ÿ���� ĭ ����

          // �Ҹ� ���
          if (isSoundEnabled && batchChars) {
            speakText(batchChars, true);
          }
        }
        return;
      }

      // ����ġ��/���� ���: ���� ������ �� ���ھ� ǥ��
      if (currentDisplayIndex < randomizedIndices.length) {
        sequentialTimerRef.current = setTimeout(() => {
          const nextCharIndex = randomizedIndices[currentDisplayIndex];
          addDisplayedCharIndex(nextCharIndex);

          incrementDisplayIndex();

          // ������ ���� ������ �Ǵ� ������ ������ �� �Ҹ� ���
          const newDisplayIndex = currentDisplayIndex + 1;
          if (isSoundEnabled && (newDisplayIndex % charsPerRead === 0 || newDisplayIndex === randomizedIndices.length)) {
            // ������ N����(�Ǵ� ���� ����)�� ��Ƽ� �о���
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
      // ���� ���: ���� ���
      if (isWordLikeMode && shuffledWords.length > 0) {
        speakText(shuffledWords[currentWordIndex]);
      } else if (mode === "sentences" && sentences.length > 0) {
        speakText(sentences[currentSentenceIndex]);
      }
    }
  }, [isPracticing, mode, currentWordIndex, currentSentenceIndex, currentLetterIndex, speechRate, currentDisplayIndex, randomizedIndices, sequentialSpeed, isSoundEnabled, sequentialText, charsPerRead, isRoundComplete, isBatchMode, batchSize, batchStartIndex, currentBatchChars, isReviewMode, reviewBatches, reviewIndex, countdown, addDisplayedCharIndex, incrementDisplayIndex, isWordLikeMode, sentences, shuffledWords, speakText, updateTypedWord]);

  // �Ÿ�ġ�� ���: Ÿ���� Ȯ�� �� ���� ��ġ�� �̵�
  useEffect(() => {
    if (!isPracticing || !isBatchMode || isRoundComplete) return;
    if (currentBatchChars === "") return;

    // ���� �����ϰ� �� (�������� ���þ ��Ȯ�� ������ ����)
    const typedClean = typedWord.replace(/\s+/g, '');
    const targetClean = currentBatchChars.replace(/\s+/g, '');

    if (typedClean.endsWith(targetClean) && targetClean.length > 0) {
      // Ÿ��/�ڼ� ��� (�Ͻ����� ������ + IME ���� �� �̹ݿ� Ÿ�� ����)
      const currentElapsedMs = currentWordStartTime ? Date.now() - currentWordStartTime : 0;
      const totalKeystrokes = accumulatedKeystrokes + currentWordKeystrokes + composingKeystrokesRef.current;
      const totalElapsedMs = accumulatedElapsedMs + currentElapsedMs;

      const speedMetrics = buildTypingSpeedMetrics({
        elapsedMs: totalElapsedMs,
        keystrokes: countJamoKeystrokes(typedClean),
        charCount: typedClean.length,
      });
      if (speedMetrics) {
        const { kpm, cpm, elapsedTime } = speedMetrics;
        setLastResult(speedMetrics);
        // ���� ��尡 �ƴ� ���� ��� ���� (���� ��忡���� ���� �� ��)
        if (!isReviewMode) {
          setAllResults(prev => [...prev, { kpm, cpm, elapsedTime, chars: currentBatchChars, mode }]);
          // Google Sheets �α�
          logResult({ mode, kpm, cpm, elapsedTime, chars: currentBatchChars });
        }
      }
      // �ܿ� �Է� ���� (��� ġȯ �� ���� ����/���Ⱑ ���� ���� Ÿ�̸Ӹ� �������� �ʵ���)
      isAutoSubmittingRef.current = true;
      setTimeout(() => { isAutoSubmittingRef.current = false; }, 80);

      // ������ �ʱ�ȭ
      composingKeystrokesRef.current = 0;
      setAccumulatedKeystrokes(0);
      setAccumulatedElapsedMs(0);
      resetCurrentWordTracking();

      // ���� ����� ���
      if (isReviewMode) {
        const nextReviewIndex = reviewIndex + 1;
        if (nextReviewIndex >= reviewBatches.length) {
          // ���� �Ϸ� - ��¥ ���� �Ϸ�
          setIsReviewMode(false);
          setReviewBatches([]);
          setReviewIndex(0);
          setIsBatchReviewDone(true);
          setIsRoundComplete(true);
          setIsDrawerOpen(true);
        } else {
          // ���� ���� ��ġ
          setReviewIndex(nextReviewIndex);
          setCurrentBatchChars("");
          updateTypedWord(""); clearInputElement();
        }
        return;
      }

      // ����! ���� ��ġ�� �̵�
      const nextBatchStart = batchStartIndex + batchSize;

      if (nextBatchStart >= randomizedIndices.length) {
        // ��� ���� �Ϸ� - �ð� ���� �ɸ� 5�� ���� ����
        // allResults���� �ð� ���� �������� ���� �� ���� 5�� ����
        // ����: ��� ������ ����� ���� allResults�� �ݿ� �� ��, prev�� ����
        setAllResults(prev => {
          const modeOnly = prev.filter(r => r.mode === mode);
          const sorted = [...modeOnly].sort((a, b) => b.elapsedTime - a.elapsedTime);
          const top5 = sorted.slice(0, 5).map(r => r.chars).filter(c => c.length > 0);
          if (top5.length > 0) {
            // setTimeout���� ���� ������Ʈ �и� (React batching �̽� ����)
            setTimeout(() => {
              setReviewBatches(top5);
              setReviewIndex(0);
              setIsReviewMode(true);
              setBatchRandomFillCount(0);
              setCurrentBatchChars("");
              updateTypedWord(""); clearInputElement();
            }, 0);
          } else {
            // ����� ������ �ٷ� ���� �Ϸ�
            setTimeout(() => {
              setIsRoundComplete(true);
              setIsDrawerOpen(true);
            }, 0);
          }
          return prev;
        });
      } else {
        // ���� ��ġ �غ�
        setBatchStartIndex(nextBatchStart);
        setCurrentBatchChars("");
        updateTypedWord(""); clearInputElement();
      }
    }
  }, [typedWord, currentBatchChars, isPracticing, isBatchMode, batchStartIndex, batchSize, randomizedIndices.length, isRoundComplete, currentWordStartTime, currentWordKeystrokes, accumulatedKeystrokes, accumulatedElapsedMs, isReviewMode, reviewIndex, reviewBatches, mode, resetCurrentWordTracking, updateTypedWord]);

  // ���� ���� �� ��� �ʱ�ȭ
  useEffect(() => {
    if (!isPracticing && countdown === null) {
      setLastResult({ kpm: 0, cpm: 0, elapsedTime: 0 });
      setAllResults([]);
    }
  }, [isPracticing, countdown]);

  // �ǽð� ��� �ð� ������Ʈ
  useEffect(() => {
    if (!isPracticing || countdown !== null || isRoundComplete) {
      return;
    }

    let rafId: number;
    const tick = () => {
      if (currentWordStartTime) {
        const currentMs = Date.now() - currentWordStartTime;
        const totalMs = accumulatedElapsedMs + currentMs;
        // DOM ���� ������Ʈ (React ������ ���� Ÿ�̸� ǥ��)
        if (elapsedTimerRef.current) {
          elapsedTimerRef.current.textContent = `${formatElapsedTime(totalMs)}`;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [isPracticing, countdown, isRoundComplete, currentWordStartTime, accumulatedElapsedMs]);

  // ���� ǥ�� ���� �ڵ� ��ũ�� (�� ���ڰ� ���� �� �Ʒ���)
  useEffect(() => {
    if (displayAreaRef.current && isPracticing && !isRoundComplete) {
      displayAreaRef.current.scrollTop = displayAreaRef.current.scrollHeight;
    }
  }, [currentDisplayIndex, isPracticing, isRoundComplete]);


  // ESC Ű�� ���� ����/����
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

  // ���� ����� ����� ���͸�
  const modeResults = useMemo(() => pickModeResults(allResults, mode), [allResults, mode]);
  const sentenceDisplayResults = useMemo(
    () => (isSentenceReview && modeResults.length === 0 ? preReviewResults : modeResults),
    [isSentenceReview, modeResults, preReviewResults]
  );
  const positionStageSummary = useMemo(
    () =>
      positionEnabledStages.length === 1
        ? (POSITION_STAGE_OPTIONS.find((v) => v.key === positionEnabledStages[0])?.label ?? positionEnabledStages[0])
        : `${positionEnabledStages.length}�ܰ� ȥ��`,
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

  // ��� ��� (JSX���� ���� �� �����ǹǷ� useMemo�� 1ȸ�� ���)
  const averageResult = useMemo(() => {
    const stats = computeSessionStats(modeResults);
    if (!stats) return { avgKpm: 0, avgCpm: 0, avgTime: 0 };
    return {
      avgKpm: stats.avgKpmRounded,
      avgCpm: stats.avgCpmRounded,
      avgTime: Math.round(stats.totalElapsedTime / stats.totalResults)
    };
  }, [modeResults]);

  // ��ĭ�� ǥ�õ� ����
  const displayedText = useMemo((): string => {
    if (isBatchMode) {
      return currentBatchChars;
    }
    // ����ġ��/��� ���: �ε��� ������� ǥ�� (����� ����, ����ġ��� ����)
    return randomizedIndices.slice(0, currentDisplayIndex).map(index => sequentialText[index]).join('');
  }, [isBatchMode, currentBatchChars, randomizedIndices, currentDisplayIndex, sequentialText]);

  // Ÿ������ ��ġ������ ���� (������ 10~1���� ��Ī���� ã��)
  const scoringOriginalText = useMemo((): string => {
    if (!isRoundComplete || typedWord.length === 0) return '';

    const displayedClean = displayedText.replace(/\s+/g, '');
    const typedClean = typedWord.replace(/\s+/g, '');

    if (typedClean.length === 0) return '';

    // ������ 10~1���ڷ� �������� ��ġ ã��
    for (let len = Math.min(10, typedClean.length); len >= 1; len--) {
      const lastChars = typedClean.slice(-len);

      // �������� �ڿ������� �˻�
      for (let i = displayedClean.length - len; i >= 0; i--) {
        const window = displayedClean.slice(i, i + len);
        if (window === lastChars) {
          // �ش� ��ġ������ ���� ��ȯ
          return displayedClean.slice(0, i + len);
        }
      }
    }

    // ã�� ���ϸ� ��ü ���� ��ȯ
    return displayedClean;
  }, [isRoundComplete, displayedText, typedWord]);

  // ���� ��ŷ (�Ͻ�����/�Ϸ� �ÿ���) - Ÿ������ ��ġ������ ��
  const markedText = useMemo((): FullMarkedChar[] => {
    if ((mode !== "sequential" && mode !== "longtext") || !isRoundComplete || typedWord.length === 0) {
      return [];
    }
    return getFullMarkedText(scoringOriginalText, typedWord);
  }, [mode, isRoundComplete, scoringOriginalText, typedWord]);

  // ä�� ��� (�Ͻ�����/�Ϸ� �ÿ���) - Ÿ������ ��ġ������ ��
  const scoringResult = useMemo((): ScoringResult | null => {
    if ((mode !== "sequential" && mode !== "longtext") || !isRoundComplete || typedWord.length === 0) {
      return null;
    }
    return analyzeScoring(scoringOriginalText, typedWord);
  }, [mode, isRoundComplete, scoringOriginalText, typedWord]);

  // ��ĭ (����) ���� ��ŷ (�Ͻ�����/�Ϸ� �ÿ���) - Ÿ������ ��ġ������ ��
  const markedOriginalText = useMemo((): MarkedChar[] => {
    if ((mode !== "sequential" && mode !== "longtext") || !isRoundComplete || !scoringResult) {
      return [];
    }
    return getMarkedText(scoringOriginalText, scoringResult);
  }, [mode, isRoundComplete, scoringOriginalText, scoringResult]);

  // ���尡 ��¥ �Ϸ����� (������ 10~1���� ��ġ Ȯ��)
  const isFullyComplete = useMemo((): boolean => {
    if (!isRoundComplete) return false;

    // �Ÿ�ġ�� ���: �������� ������ ������ ���� ���� ����
    if (isBatchMode) {
      return isBatchReviewDone;
    }

    const displayedClean = displayedText.replace(/\s+/g, '');
    const typedClean = typedWord.replace(/\s+/g, '');

    // �ּ� ���� üũ (������ 50% �̻��� �ľ� ��)
    if (typedClean.length < displayedClean.length * 0.5) return false;

    // ������ 10~1���� �� �ϳ��� ��ġ�ϸ� �Ϸ�
    for (let len = Math.min(10, displayedClean.length); len >= 1; len--) {
      const originalEnd = displayedClean.slice(-len);
      const typedEnd = typedClean.slice(-len);
      if (originalEnd === typedEnd) {
        return true;
      }
    }
    return false;
  }, [isRoundComplete, displayedText, typedWord, isBatchMode, isBatchReviewDone]);

  // ���� �Ϸ� �� ��ξ� ���� + �Ϸ� Ƚ�� ��� ����
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

  // ������ ���� ���� (�ٸ� ���� ��ȯ ��)
  const saveSentenceState = () => {
    if (mode === "sentences" && sentences.length > 0) {
      savedSentenceStateRef.current = createCurrentSentenceState();
    }
  };

  // ��۸�� ���� ���� (�ٸ� ���� ��ȯ ��)
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


  // ��ġ/���� ���� �ʱ�ȭ
  const resetBatchAndReviewState = () => {
    setBatchStartIndex(0);
    setCurrentBatchChars("");
    setIsReviewMode(false);
    setReviewBatches([]);
    setReviewIndex(0);
    setIsBatchReviewDone(false);
  };

  // ��� ��ȯ �� ���� (��� ��庰 ���� ���� �ʱ�ȭ)
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

  // ������ ���� ���� (������� ���ƿ� ��)
  const restoreSentenceState = () => {
    const saved = savedSentenceStateRef.current;
    if (saved) {
      setGeneratedCount(saved.generatedCount);
      setPracticingMode("sentences");
      resumeSentencePractice(toSentenceResumePayload(saved));
    }
  };

  // ��۸�� ���� ���� (��۸��� ���ƿ� ��)
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




