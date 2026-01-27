//테스트용 주석 추가
import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTypingStore } from "../store/useTypingStore";
import { rateToCps, cpsToRate, clampCps } from "../utils/speechUtils";
import { savedText1, savedText2, savedText5 } from "../constants";
import { getFullMarkedText, getMarkedText, analyzeScoring, type FullMarkedChar, type MarkedChar, type ScoringResult } from "../utils/scoringAnalysis";

// IndexedDB 헬퍼 함수들
const DB_NAME = 'StenoAgileDB';
const STORE_NAME = 'videos';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

const saveVideosToDB = async (files: { name: string; data: ArrayBuffer }[]) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  // 기존 데이터 삭제
  store.clear();

  // 새 데이터 저장
  files.forEach((file, index) => {
    store.add({ id: index, name: file.name, data: file.data });
  });

  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const loadVideosFromDB = async (): Promise<{ name: string; data: ArrayBuffer }[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result.map(r => ({ name: r.name, data: r.data })));
    request.onerror = () => reject(request.error);
  });
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
  } = useTypingStore();

  const [heamiVoice, setHeamiVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [showText, setShowText] = useState(true);
  const timeoutIds = useRef<number[]>([]);
  const [lastResult, setLastResult] = useState({ kpm: 0, cpm: 0, elapsedTime: 0 });
  const [allResults, setAllResults] = useState<{ kpm: number, cpm: number, elapsedTime: number }[]>([]);
  const sequentialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [slotNames, setSlotNames] = useState<{ [key: number]: string }>({});
  const [displayFontSize, setDisplayFontSize] = useState(20); // 위쪽 표시 영역 글자 크기
  const [inputFontSize, setInputFontSize] = useState(19.5); // 아래쪽 타이핑 영역 글자 크기
  const [charsPerRead, setCharsPerRead] = useState(3); // 몇 글자씩 읽을지
  const [sequentialSpeechRate, setSequentialSpeechRate] = useState(2.5); // 보교치기 음성 속도
  const [countdown, setCountdown] = useState<number | null>(null); // 카운트다운 상태
  const [, setRoundStartTime] = useState<number | null>(null); // 라운드 시작 시간
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRoundComplete, setIsRoundComplete] = useState(false); // 라운드 완료 상태 (결과 확인 대기)
  const [accumulatedKeystrokes, setAccumulatedKeystrokes] = useState(0); // 누적 타수
  const [accumulatedElapsedMs, setAccumulatedElapsedMs] = useState(0); // 누적 경과 시간
  const [displayElapsedTime, setDisplayElapsedTime] = useState(0); // 실시간 표시용 경과 시간
  const [videoPlaylist, setVideoPlaylist] = useState<{ name: string; url: string; data?: ArrayBuffer }[]>([]); // 재생목록
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0); // 현재 재생 중인 영상 인덱스
  const [videoPlaybackRate, setVideoPlaybackRate] = useState(1); // 동영상 재생 속도
  const [videoVolume, setVideoVolume] = useState(0.05); // 동영상 볼륨 (0~1)
  const [videoLoop, setVideoLoop] = useState(false); // 반복 재생
  const [playlistLoop, setPlaylistLoop] = useState(false); // 재생목록 반복
  const [abRepeat, setAbRepeat] = useState<{ a: number | null; b: number | null }>({ a: null, b: null }); // 구간 반복
  const [skipSeconds, setSkipSeconds] = useState(5); // 건너뛰기 초
  const [isDragging, setIsDragging] = useState(false); // 드래그 상태
  const videoRef = useRef<HTMLVideoElement | null>(null); // 비디오 요소 참조
  const dropZoneRef = useRef<HTMLDivElement | null>(null); // 드롭 존 참조
  const typingTextareaRef = useRef<HTMLTextAreaElement | null>(null); // 타이핑 칸 참조

  // 매매치라 모드 상태
  const [isBatchMode, setIsBatchMode] = useState(false); // 매매치라 모드 활성화 여부
  const [batchSize, setBatchSize] = useState(5); // 한번에 보여줄 글자 수
  const [batchStartIndex, setBatchStartIndex] = useState(0); // 현재 배치 시작 인덱스
  const [currentBatchChars, setCurrentBatchChars] = useState<string>(""); // 현재 배치에 표시된 글자들

  // YouTube 관련 상태
  const [videoSourceTab, setVideoSourceTab] = useState<'upload' | 'youtube'>('upload');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);

  // 하이라이트용 상태 (아래칸 hover 시 윗칸 해당 위치 표시)
  const [hoveredOrigIdx, setHoveredOrigIdx] = useState<number | null>(null);

  // 라운드 완료 후 연습용 텍스트
  const [practiceText, setPracticeText] = useState("");

  // 재개 직후 하이라이트 표시용
  const [showResumeHighlight, setShowResumeHighlight] = useState(false);
  const [resumePosition, setResumePosition] = useState(0);

  // 오늘 완료한 라운드 수
  const [todayCompletedRounds, setTodayCompletedRounds] = useState(0);
  // 슬롯별 완료한 라운드 수 (보교치라)
  const [slotCompletedRoundsNormal, setSlotCompletedRoundsNormal] = useState<Record<number, number>>({});
  // 슬롯별 완료한 라운드 수 (매매치라)
  const [slotCompletedRoundsBatch, setSlotCompletedRoundsBatch] = useState<Record<number, number>>({});
  // 연습 시작 시 슬롯 저장 (도중에 다른 슬롯 눌러도 표시 안 바뀌게)
  const [practiceSlot, setPracticeSlot] = useState<number | null>(null);
  // 카운트다운 중 표시할 방금 완료한 슬롯 (아직 increment 안 됨)
  const [pendingIncrementSlot, setPendingIncrementSlot] = useState<number | null>(null);

  // 드로어 열림/닫힘 상태
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // 현재 재생 중인 영상 URL
  const videoSrc = videoPlaylist.length > 0 ? videoPlaylist[currentVideoIndex]?.url : null;

  // YouTube URL에서 video ID 추출
  const extractYoutubeVideoId = (url: string): string | null => {
    const pattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(pattern);
    return match ? match[1] : null;
  };

  // YouTube URL 입력 처리
  const handleYoutubeUrlSubmit = () => {
    const videoId = extractYoutubeVideoId(youtubeUrl);
    setYoutubeVideoId(videoId);
  };

  // IndexedDB에 재생목록 저장
  const savePlaylistToDB = useCallback(async (playlist: { name: string; url: string; data?: ArrayBuffer }[]) => {
    const dataToSave = playlist
      .filter(v => v.data)
      .map(v => ({ name: v.name, data: v.data! }));
    if (dataToSave.length > 0) {
      await saveVideosToDB(dataToSave);
    }
  }, []);

  // 재생목록에 영상/오디오 추가
  const addVideosToPlaylist = async (files: FileList | File[]) => {
    const mediaExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.mp3', '.wav', '.m4a', '.aac'];
    const existingNames = new Set(videoPlaylist.map(v => v.name));
    const validFiles = Array.from(files).filter(file => {
      // 이미 있는 파일은 제외
      if (existingNames.has(file.name)) return false;
      if (file.type.startsWith('video/') || file.type.startsWith('audio/')) return true;
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      return mediaExtensions.includes(ext);
    });

    // 파일 데이터를 ArrayBuffer로 읽기
    const newVideos = await Promise.all(
      validFiles.map(async (file) => {
        const data = await file.arrayBuffer();
        const blob = new Blob([data], { type: file.type || 'video/mp4' });
        return {
          name: file.name,
          url: URL.createObjectURL(blob),
          data
        };
      })
    );

    if (newVideos.length > 0) {
      setVideoPlaylist(prev => {
        const wasEmpty = prev.length === 0;
        if (wasEmpty) {
          setCurrentVideoIndex(0);
        }
        const updated = [...prev, ...newVideos];
        // IndexedDB에 저장
        savePlaylistToDB(updated);
        return updated;
      });
    }
  };

  // 재생목록에서 영상 제거
  const removeVideoFromPlaylist = (index: number) => {
    const video = videoPlaylist[index];
    if (video) {
      URL.revokeObjectURL(video.url);
    }
    setVideoPlaylist(prev => {
      const updated = prev.filter((_, i) => i !== index);
      savePlaylistToDB(updated);
      return updated;
    });
    // 현재 재생 중인 영상이 삭제된 경우 처리
    if (index === currentVideoIndex) {
      setCurrentVideoIndex(Math.min(index, videoPlaylist.length - 2));
    } else if (index < currentVideoIndex) {
      setCurrentVideoIndex(prev => prev - 1);
    }
  };

  // 재생목록 전체 삭제
  const clearPlaylist = async () => {
    videoPlaylist.forEach(video => URL.revokeObjectURL(video.url));
    setVideoPlaylist([]);
    setCurrentVideoIndex(0);
    localStorage.removeItem('videoCurrentIndex');
    localStorage.removeItem('videoCurrentTime');
    // IndexedDB 비우기
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  };

  // 이전 영상
  const playPreviousVideo = () => {
    if (videoPlaylist.length === 0) return;
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(prev => prev - 1);
    } else if (playlistLoop) {
      setCurrentVideoIndex(videoPlaylist.length - 1);
    }
  };

  // 다음 영상
  const playNextVideo = () => {
    if (videoPlaylist.length === 0) return;
    if (currentVideoIndex < videoPlaylist.length - 1) {
      setCurrentVideoIndex(prev => prev + 1);
    } else if (playlistLoop) {
      setCurrentVideoIndex(0);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // relatedTarget이 드롭존 밖으로 나갔을 때만 드래그 상태 해제
    const rect = dropZoneRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        setIsDragging(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      addVideosToPlaylist(files);
    }
  };

  // 브라우저 기본 드래그 앤 드롭 동작 방지 및 파일 처리 (TEST 모드에서만)
  useEffect(() => {
    if (mode !== "random") return;

    const handleDocumentDragOver = (e: DragEvent) => {
      e.preventDefault();
      // 드롭 존 위에 있으면 드래그 상태 표시
      if (dropZoneRef.current) {
        const rect = dropZoneRef.current.getBoundingClientRect();
        const isOverDropZone = e.clientX >= rect.left && e.clientX <= rect.right &&
                               e.clientY >= rect.top && e.clientY <= rect.bottom;
        setIsDragging(isOverDropZone);
      }
    };

    const handleDocumentDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      // 드롭 존 위에서 드롭된 경우에만 파일 처리
      if (dropZoneRef.current && e.dataTransfer?.files) {
        const rect = dropZoneRef.current.getBoundingClientRect();
        const isOverDropZone = e.clientX >= rect.left && e.clientX <= rect.right &&
                               e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (isOverDropZone && e.dataTransfer.files.length > 0) {
          addVideosToPlaylist(e.dataTransfer.files);
        }
      }
    };

    const handleDocumentDragLeave = (e: DragEvent) => {
      // 문서 밖으로 나가면 드래그 상태 해제
      if (e.clientX <= 0 || e.clientY <= 0 ||
          e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsDragging(false);
      }
    };

    document.addEventListener('dragover', handleDocumentDragOver);
    document.addEventListener('drop', handleDocumentDrop);
    document.addEventListener('dragleave', handleDocumentDragLeave);

    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver);
      document.removeEventListener('drop', handleDocumentDrop);
      document.removeEventListener('dragleave', handleDocumentDragLeave);
    };
  }, [mode]);

  // 슬롯 이름 불러오기 및 현재 텍스트와 일치하는 슬롯 찾기
  useEffect(() => {
    const savedNames: { [key: number]: string } = {};
    for (let i = 1; i <= 20; i++) {
      const name = localStorage.getItem(`slot_${i}_name`);
      if (name) {
        savedNames[i] = name;
      }
    }
    setSlotNames(savedNames);

    // 현재 inputText와 일치하는 슬롯 찾기
    for (let i = 1; i <= 20; i++) {
      const slotContent = localStorage.getItem(`slot_${i}`);
      if (slotContent && slotContent === inputText) {
        setSelectedSlot(i);
        break;
      }
    }
  }, []);

  // IndexedDB에서 재생목록 복원
  useEffect(() => {
    const restorePlaylist = async () => {
      try {
        const savedVideos = await loadVideosFromDB();
        if (savedVideos.length > 0) {
          const restoredPlaylist = savedVideos.map(v => {
            const blob = new Blob([v.data], { type: 'video/mp4' });
            return {
              name: v.name,
              url: URL.createObjectURL(blob),
              data: v.data
            };
          });
          setVideoPlaylist(restoredPlaylist);

          // 저장된 인덱스 복원
          const savedIndex = localStorage.getItem('videoCurrentIndex');
          if (savedIndex !== null) {
            const idx = parseInt(savedIndex);
            if (idx >= 0 && idx < restoredPlaylist.length) {
              setCurrentVideoIndex(idx);
            }
          }
        }
      } catch (e) {
        console.error('재생목록 복원 실패:', e);
      }
    };
    restorePlaylist();
  }, []);

  // 재생 위치 주기적 저장
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        localStorage.setItem('videoCurrentTime', videoRef.current.currentTime.toString());
        localStorage.setItem('videoCurrentIndex', currentVideoIndex.toString());
      }
    }, 1000);

    return () => clearInterval(saveInterval);
  }, [currentVideoIndex]);

  // Microsoft Heami 음성 로드
  useEffect(() => {
    const loadHeami = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      const heami = availableVoices.find(voice =>
        voice.name.includes('Heami')
      );
      if (heami) {
        setHeamiVoice(heami);
      }
    };

    loadHeami();
    window.speechSynthesis.onvoiceschanged = loadHeami;
  }, []);

  // 오늘 완료한 라운드 수 불러오기
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const savedData = localStorage.getItem('completedRounds');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      if (parsed.date === today) {
        setTodayCompletedRounds(parsed.count || 0);
        setSlotCompletedRoundsNormal(parsed.normalSlotCounts || parsed.slotCounts || {});
        setSlotCompletedRoundsBatch(parsed.batchSlotCounts || {});
      } else {
        // 날짜가 바뀌면 초기화
        localStorage.setItem('completedRounds', JSON.stringify({ date: today, count: 0, normalSlotCounts: {}, batchSlotCounts: {} }));
        setTodayCompletedRounds(0);
        setSlotCompletedRoundsNormal({});
        setSlotCompletedRoundsBatch({});
      }
    } else {
      localStorage.setItem('completedRounds', JSON.stringify({ date: today, count: 0, normalSlotCounts: {}, batchSlotCounts: {} }));
    }
  }, []);

  // 라운드 완료 카운트 증가
  const incrementCompletedRounds = useCallback((slot: number | null, isBatch: boolean) => {
    setTodayCompletedRounds(prev => {
      const newCount = prev + 1;
      // localStorage는 useEffect에서 처리
      return newCount;
    });

    if (slot !== null) {
      if (isBatch) {
        setSlotCompletedRoundsBatch(prevSlots => {
          const newSlotCounts = { ...prevSlots };
          newSlotCounts[slot] = (newSlotCounts[slot] || 0) + 1;
          return newSlotCounts;
        });
      } else {
        setSlotCompletedRoundsNormal(prevSlots => {
          const newSlotCounts = { ...prevSlots };
          newSlotCounts[slot] = (newSlotCounts[slot] || 0) + 1;
          return newSlotCounts;
        });
      }
    }
  }, []);

  // localStorage에 완료 횟수 저장 (상태 변경 시)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (todayCompletedRounds > 0 || Object.keys(slotCompletedRoundsNormal).length > 0 || Object.keys(slotCompletedRoundsBatch).length > 0) {
      localStorage.setItem('completedRounds', JSON.stringify({
        date: today,
        count: todayCompletedRounds,
        normalSlotCounts: slotCompletedRoundsNormal,
        batchSlotCounts: slotCompletedRoundsBatch
      }));
    }
  }, [todayCompletedRounds, slotCompletedRoundsNormal, slotCompletedRoundsBatch]);

  const clearAllTimeouts = () => {
    timeoutIds.current.forEach(clearTimeout);
    timeoutIds.current = [];
  };

  // 경과 시간을 "분:초.밀리초" 형태로 포맷팅 (밀리초 단위 입력)
  const formatTime = (ms: number): string => {
    const totalSeconds = ms / 1000;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  };

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
  const startNextRound = (completedSlot?: number | null, wasBatchMode?: boolean) => {
    // 드로어 닫기
    setIsDrawerOpen(false);
    // 현재 선택된 슬롯으로 업데이트 (슬롯 변경 후 다음 라운드 시작 시)
    setPracticeSlot(selectedSlot);
    // 카운트다운 중 표시할 방금 완료한 슬롯 설정
    setPendingIncrementSlot(completedSlot ?? null);
    setIsRoundComplete(false);
    setAccumulatedKeystrokes(0);
    setAccumulatedElapsedMs(0);
    setDisplayElapsedTime(0);
    updateTypedWord(""); // 타이핑 칸 초기화
    setPracticeText(""); // 연습 텍스트 초기화
    setShowResumeHighlight(false); // 하이라이트 초기화
    // 매매치라 모드 초기화
    setBatchStartIndex(0);
    setCurrentBatchChars("");
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

  const speakText = (text: string, isSequential = false) => {
    // 소리가 꺼져있으면 재생하지 않음
    if (!isSoundEnabled) return;

    if (!isSequential) {
      // 기존 모드: 이전 음성 중단
      window.speechSynthesis.cancel();
      clearAllTimeouts();
    }

    // 텍스트를 통째로 재생 (Web Speech API가 자연스럽게 처리)
    const utterance = new SpeechSynthesisUtterance(text);
    // 보교치기 모드일 때는 자연스럽게 들리도록 적절한 속도로 재생
    utterance.rate = isSequential ? sequentialSpeechRate : speechRate;
    utterance.pitch = 1.2;
    utterance.volume = 1.0;
    if (heamiVoice) {
      utterance.voice = heamiVoice;
    }

    if (isSequential) {
      // 보교치기 모드: 즉시 재생 (딜레이 없음)
      window.speechSynthesis.speak(utterance);
    } else {
      requestAnimationFrame(() => {
        window.speechSynthesis.speak(utterance);
      });
    }
  };

  const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) =>
    updateInputText(event.target.value);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    updateTypedWord(event.target.value);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Enter") {
      // 보교치기/랜덤 모드에서는 다른 처리
      if ((mode === "sequential" || mode === "random") && isPracticing) {
        event.preventDefault();

        // 라운드 완료/일시정지 상태에서 엔터 처리
        if (isRoundComplete) {
          // 완전히 다 쳤으면 새 라운드, 아니면 재개
          const displayedClean = displayedText.replace(/\s+/g, '');
          const typedClean = typedWord.replace(/\s+/g, '');
          if (typedClean.length >= displayedClean.length) {
            startNextRound(practiceSlot, isBatchMode); // 카운트다운 후 완료 횟수 증가
          } else {
            resumeRound();
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
          setAllResults(prev => [...prev, { kpm, cpm, elapsedTime: totalElapsedMs }]);
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
          setAllResults(prev => [...prev, { kpm, cpm, elapsedTime: elapsedMs }]);
        }
      }

      submitAnswer(typedWord);
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
      // 보교치기/랜덤 모드에서 라운드 완료 상태일 때 타이핑 시작하면 자동으로 재개
      if ((mode === "sequential" || mode === "random") && isRoundComplete) {
        setIsRoundComplete(false);
      }

      // 첫 번째 키 입력 시 타이머 시작
      if (!currentWordStartTime) {
        startCurrentWordTracking();
      }
      incrementCurrentWordKeystrokes();
    }
  };

  const handleCpsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    if (inputValue === "") return;

    const cps = parseFloat(inputValue);
    if (isNaN(cps)) return;

    const clampedCps = clampCps(cps, 0, 10);
    changeSpeechRate(cpsToRate(clampedCps));
  };

  const handleStartOrStopPractice = () => {
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
      // 매매치라 모드 초기화
      setBatchStartIndex(0);
      setCurrentBatchChars("");
      stopPractice();
      // 드로어 열기
      setIsDrawerOpen(true);
    } else {
      const words = inputText.trim().split("/").filter(Boolean);
      if (words.length > 0) {
        // 매매치라 모드 초기화
        setBatchStartIndex(0);
        setCurrentBatchChars("");
        // 연습 시작 시 현재 슬롯 저장
        setPracticeSlot(selectedSlot);
        // 드로어 닫기
        setIsDrawerOpen(false);
        if (mode === "sequential" || mode === "random") {
          // 보교치기/랜덤 모드: 카운트다운 후 시작
          startCountdown(() => {
            setRoundStartTime(Date.now());
            startPractice(words);
            // 타이핑 칸에 포커스
            setTimeout(() => typingTextareaRef.current?.focus(), 50);
          });
        } else {
          startPractice(words);
        }
      }
    }
  };

  const handleRenameSlot = (slot: number) => {
    const currentName = slotNames[slot] || `${slot}`;
    const newName = prompt(`슬롯 ${slot}의 이름을 입력하세요:`, currentName);

    if (newName !== null && newName.trim() !== "") {
      localStorage.setItem(`slot_${slot}_name`, newName.trim());
      setSlotNames(prev => ({ ...prev, [slot]: newName.trim() }));
    }
  };

  const handleSaveToSlot = () => {
    if (selectedSlot === null) {
      alert("저장할 슬롯을 선택하세요");
      return;
    }
    localStorage.setItem(`slot_${selectedSlot}`, inputText);
    alert(`슬롯 ${selectedSlot}에 저장되었습니다`);
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

    if (mode === "sequential" || mode === "random") {
      // 라운드 완료 상태면 글자 표시 멈춤
      if (isRoundComplete) return;

      // 매매치라 모드: batchSize만큼 한번에 표시
      if (isBatchMode) {
        if (batchStartIndex < randomizedIndices.length && currentBatchChars === "") {
          // 현재 배치의 글자들 계산
          const endIndex = Math.min(batchStartIndex + batchSize, randomizedIndices.length);
          const batchChars = randomizedIndices
            .slice(batchStartIndex, endIndex)
            .map(idx => sequentialText[idx])
            .join('');
          setCurrentBatchChars(batchChars);

          // 소리 재생
          if (isSoundEnabled && batchChars) {
            speakText(batchChars, true);
          }
        }
        return;
      }

      // 보교치기/랜덤 모드: 랜덤 순서로 한 글자씩 표시
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
  }, [isPracticing, mode, currentWordIndex, currentSentenceIndex, currentLetterIndex, speechRate, currentDisplayIndex, randomizedIndices, sequentialSpeed, isSoundEnabled, sequentialText, charsPerRead, isRoundComplete, isBatchMode, batchSize, batchStartIndex, currentBatchChars]);

  // 매매치라 모드: 타이핑 확인 및 다음 배치로 이동
  useEffect(() => {
    if (!isPracticing || !isBatchMode || isRoundComplete) return;
    if (currentBatchChars === "") return;

    // 띄어쓰기 제거하고 비교 (마지막에 제시어가 정확히 나오면 정답)
    const typedClean = typedWord.replace(/\s+/g, '');
    const targetClean = currentBatchChars.replace(/\s+/g, '');

    if (typedClean.endsWith(targetClean) && targetClean.length > 0) {
      // 타수/자수 계산
      if (currentWordStartTime && currentWordKeystrokes > 0) {
        const elapsedMs = Date.now() - currentWordStartTime;

        // 0.1초(100ms) 이상 경과하면 계산
        if (elapsedMs >= 100) {
          const elapsedMinutes = elapsedMs / 1000 / 60;
          const kpm = Math.min(3000, Math.round(currentWordKeystrokes / elapsedMinutes));
          const charCount = typedClean.length;
          const cpm = Math.min(3000, Math.round(charCount / elapsedMinutes));
          setLastResult({ kpm, cpm, elapsedTime: elapsedMs });
          setAllResults(prev => [...prev, { kpm, cpm, elapsedTime: elapsedMs }]);
        }
      }
      resetCurrentWordTracking();

      // 정답! 다음 배치로 이동
      const nextBatchStart = batchStartIndex + batchSize;

      if (nextBatchStart >= randomizedIndices.length) {
        // 모든 글자 완료 - 한 사이클 끝
        setIsRoundComplete(true);
        setIsDrawerOpen(true); // 드로어 열기
      } else {
        // 다음 배치 준비
        setBatchStartIndex(nextBatchStart);
        setCurrentBatchChars("");
        updateTypedWord("");
      }
    }
  }, [typedWord, currentBatchChars, isPracticing, isBatchMode, batchStartIndex, batchSize, randomizedIndices.length, isRoundComplete, currentWordStartTime, currentWordKeystrokes]);

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

  // TEST 모드 동영상 단축키
  useEffect(() => {
    if (mode !== "random") return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // 타이핑 영역에서는 단축키 무시 (textarea, input)
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case " ": // 스페이스: 재생/일시정지
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
          break;
        case "arrowleft": // 왼쪽: 뒤로 건너뛰기
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - skipSeconds);
          break;
        case "arrowright": // 오른쪽: 앞으로 건너뛰기
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + skipSeconds);
          break;
        case "arrowup": // 위쪽: 볼륨 업
          e.preventDefault();
          const newVolUp = Math.min(1, videoVolume + 0.1);
          setVideoVolume(newVolUp);
          video.volume = newVolUp;
          break;
        case "arrowdown": // 아래쪽: 볼륨 다운
          e.preventDefault();
          const newVolDown = Math.max(0, videoVolume - 0.1);
          setVideoVolume(newVolDown);
          video.volume = newVolDown;
          break;
        case ",": // < : 속도 감소
        case "<":
          e.preventDefault();
          const newRateDown = Math.max(0.25, videoPlaybackRate - 0.25);
          setVideoPlaybackRate(newRateDown);
          video.playbackRate = newRateDown;
          break;
        case ".": // > : 속도 증가
        case ">":
          e.preventDefault();
          const newRateUp = Math.min(4, videoPlaybackRate + 0.25);
          setVideoPlaybackRate(newRateUp);
          video.playbackRate = newRateUp;
          break;
        case "l": // L: 반복 토글
          e.preventDefault();
          setVideoLoop(!videoLoop);
          video.loop = !videoLoop;
          break;
        case "f": // F: 전체화면
          e.preventDefault();
          if (document.fullscreenElement) document.exitFullscreen();
          else video.requestFullscreen();
          break;
        case "p": // P: PIP
          e.preventDefault();
          if (document.pictureInPictureEnabled) {
            if (document.pictureInPictureElement) document.exitPictureInPicture();
            else video.requestPictureInPicture();
          }
          break;
        case "m": // M: 음소거 토글
          e.preventDefault();
          video.muted = !video.muted;
          break;
        case "home": // Home: 처음으로
          e.preventDefault();
          video.currentTime = 0;
          break;
        case "end": // End: 끝으로
          e.preventDefault();
          video.currentTime = video.duration;
          break;
        case "a": // A: A-B 구간 설정
          e.preventDefault();
          if (abRepeat.a === null) {
            setAbRepeat({ a: video.currentTime, b: null });
          } else if (abRepeat.b === null) {
            setAbRepeat({ ...abRepeat, b: video.currentTime });
          } else {
            setAbRepeat({ a: null, b: null });
          }
          break;
        case "n": // N: 다음 영상
          e.preventDefault();
          playNextVideo();
          break;
        case "b": // B: 이전 영상
          e.preventDefault();
          playPreviousVideo();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, videoVolume, videoPlaybackRate, videoLoop, skipSeconds, abRepeat, videoPlaylist.length, currentVideoIndex, playlistLoop]);

  // 평균 계산
  const calculateAverage = () => {
    if (allResults.length === 0) return { avgKpm: 0, avgCpm: 0, avgTime: 0 };
    const totalKpm = allResults.reduce((sum, result) => sum + result.kpm, 0);
    const totalCpm = allResults.reduce((sum, result) => sum + result.cpm, 0);
    const totalTime = allResults.reduce((sum, result) => sum + result.elapsedTime, 0);
    return {
      avgKpm: Math.round(totalKpm / allResults.length),
      avgCpm: Math.round(totalCpm / allResults.length),
      avgTime: Math.round(totalTime / allResults.length)
    };
  };

  // 윗칸에 표시된 글자 (랜덤 순서로 나온 글자들)
  const displayedText = useMemo((): string => {
    if (isBatchMode) {
      return currentBatchChars;
    }
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
    if (mode !== "sequential" || !isRoundComplete || typedWord.length === 0) {
      return [];
    }
    return getFullMarkedText(scoringOriginalText, typedWord);
  }, [mode, isRoundComplete, scoringOriginalText, typedWord]);

  // 채점 결과 (일시정지/완료 시에만) - 타이핑한 위치까지만 비교
  const scoringResult = useMemo((): ScoringResult | null => {
    if (mode !== "sequential" || !isRoundComplete || typedWord.length === 0) {
      return null;
    }
    return analyzeScoring(scoringOriginalText, typedWord);
  }, [mode, isRoundComplete, scoringOriginalText, typedWord]);

  // 윗칸 (원문) 색상 마킹 (일시정지/완료 시에만) - 타이핑한 위치까지만 비교
  const markedOriginalText = useMemo((): MarkedChar[] => {
    if (mode !== "sequential" || !isRoundComplete || !scoringResult) {
      return [];
    }
    return getMarkedText(scoringOriginalText, scoringResult);
  }, [mode, isRoundComplete, scoringOriginalText, scoringResult]);

  // 라운드가 진짜 완료인지 (마지막 10~1글자 일치 확인)
  const isFullyComplete = useMemo((): boolean => {
    if (!isRoundComplete) return false;

    // 매매치라 모드에서 라운드 완료되면 항상 완료 처리 (모든 배치 완료 시에만 isRoundComplete가 true가 됨)
    if (isBatchMode && batchStartIndex + batchSize >= randomizedIndices.length) {
      return true;
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
  }, [isRoundComplete, displayedText, typedWord, isBatchMode, batchStartIndex, batchSize, randomizedIndices.length]);

  // 라운드 완료 시에만 드로어 열기 (일시정지 시에는 닫힌 상태 유지)
  useEffect(() => {
    if (isFullyComplete) {
      setIsDrawerOpen(true);
    }
  }, [isFullyComplete]);

  return (
    <div className="p-4 w-full">
      <h1 className="text-2xl font-bold mb-4 text-center">StenoAgile</h1>

      <div className="flex flex-row gap-0">
        {/* 드로어 */}
        <div className={`transition-all duration-300 overflow-hidden flex-shrink-0 ${isDrawerOpen ? "w-80" : "w-0"}`}>
          <div className="w-80 space-y-4 pr-4">
            {/* 모드 탭 (최상단) */}
            <div className="flex gap-2">
              <button
                className={`px-4 py-2 rounded ${
                  mode === "words" ? "bg-blue-500 text-white" : "bg-gray-300"
                }`}
                onClick={() => switchMode("words")}
              >
                단어
              </button>
              <button
                className={`px-4 py-2 rounded ${
                  mode === "sentences" ? "bg-blue-500 text-white" : "bg-gray-300"
                }`}
                onClick={() => switchMode("sentences")}
              >
                문장
              </button>
              <button
                className={`px-4 py-2 rounded ${
                  mode === "random" ? "bg-blue-500 text-white" : "bg-gray-300"
                }`}
                onClick={() => switchMode("random")}
              >
                듣고 치라
              </button>
              <button
                className={`px-4 py-2 rounded ${
                  mode === "sequential" && !isBatchMode ? "bg-blue-500 text-white" : "bg-gray-300"
                }`}
                onClick={() => {
                  switchMode("sequential");
                  setIsBatchMode(false);
                }}
              >
                보고 치라
              </button>
              <button
                className={`px-4 py-2 rounded ${
                  mode === "sequential" && isBatchMode ? "bg-blue-500 text-white" : "bg-gray-300"
                }`}
                onClick={() => {
                  switchMode("sequential");
                  setIsBatchMode(true);
                }}
              >
                매매 치라
              </button>
            </div>

            {/* 슬롯 버튼 (words/sentences 모드) */}
            {mode !== "random" && (
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      className={`px-2 py-1 rounded text-sm ${
                        selectedSlot === num
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 hover:bg-gray-300"
                      }`}
                      onClick={() => handleLoadPreset(num)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleRenameSlot(num);
                      }}
                      title="우클릭하여 이름 변경"
                    >
                      {slotNames[num] || num}
                    </button>
                  ))}
                </div>
                <button
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 w-full"
                  onClick={handleSaveToSlot}
                >
                  현재 문장 저장
                </button>
              </div>
            )}

            {/* sequential 모드 설정 */}
            {mode === "sequential" && (
              <div className="space-y-2 border-t pt-2">
                <div className="text-sm font-semibold text-gray-600">상세설정</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1">
                    <label className="text-xs whitespace-nowrap">표시속도</label>
                    <input
                      type="number"
                      min={0.5}
                      max={10}
                      step={0.1}
                      value={(1000 / sequentialSpeed).toFixed(1)}
                      onChange={(e) => {
                        const cps = parseFloat(e.target.value);
                        if (!isNaN(cps) && cps > 0) {
                          updateSequentialSpeed(Math.round(1000 / cps));
                        }
                      }}
                      className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={isBatchMode}
                    />
                    <span className="text-xs text-gray-500">자/초</span>
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
          {mode !== "random" && (
            <textarea
              className="w-full p-2 border rounded"
              rows={25}
              placeholder="연습할 단어들을 입력하세요 (/로 구분)"
              value={inputText}
              onChange={handleTextareaChange}
            />
          )}
            {/* 연습 시작/종료 버튼 */}
            {mode !== "sequential" && mode !== "random" && (
              <button
                className={`px-4 py-2 rounded font-semibold transition ${
                  isPracticing
                    ? "bg-gray-500 text-white hover:bg-gray-600"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
                onClick={handleStartOrStopPractice}
              >
                {isPracticing ? "연습 종료" : "연습 시작"}
              </button>
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
          {mode !== "sequential" && mode !== "random" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <label className="font-medium whitespace-nowrap">읽기 속도:</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={rateToCps(speechRate).toFixed(1)}
                      onChange={handleCpsChange}
                      onBlur={(e) => {
                        if (e.target.value === "") {
                          changeSpeechRate(cpsToRate(3));
                        }
                      }}
                      className="w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">글자/초</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <label className="font-medium whitespace-nowrap">소리:</label>
                  <button
                    className={`px-4 py-2 rounded font-medium transition ${
                      isSoundEnabled
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                    }`}
                    onClick={toggleSound}
                  >
                    {isSoundEnabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={0.1}
                value={rateToCps(speechRate)}
                onChange={(e) => {
                  const cps = parseFloat(e.target.value);
                  changeSpeechRate(cpsToRate(cps));
                }}
                className="w-full"
              />
            </div>
          )}

          {(mode === "sequential") && (
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
                          <span className="text-purple-600 font-semibold">
                            진행: {Math.min(batchStartIndex + batchSize, randomizedIndices.length)}/{randomizedIndices.length}
                          </span>
                          {lastResult.kpm > 0 && (
                            <>
                              <span className="text-blue-600 font-semibold">타수: {lastResult.kpm}/분</span>
                              <span className="text-green-600 font-semibold">자수: {lastResult.cpm}/분</span>
                            </>
                          )}
                          {allResults.length > 1 && (
                            <>
                              <span className="text-gray-600">평균 타수: {calculateAverage().avgKpm}/분</span>
                              <span className="text-gray-600">평균 자수: {calculateAverage().avgCpm}/분</span>
                            </>
                          )}
                        </>
                      )}
                      {!isBatchMode && allResults.length > 0 && (
                        <>
                          <span className="text-gray-600">평균 타수: {calculateAverage().avgKpm}/분</span>
                          <span className="text-gray-600">평균 자수: {calculateAverage().avgCpm}/분</span>
                        </>
                      )}
                      <span className="text-orange-600 font-semibold">시간: {formatTime(displayElapsedTime)}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {mode !== "sequential" && mode !== "random" && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="font-medium whitespace-nowrap">글자 표시:</label>
                <button
                  className={`px-4 py-2 rounded font-medium transition ${
                    showText
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                  }`}
                  onClick={() => setShowText(!showText)}
                >
                  {showText ? "ON" : "OFF"}
                </button>
              </div>

              {isPracticing && (
                <div className="flex flex-col items-end space-y-1">
                  <div className="flex items-center space-x-4 text-sm font-medium">
                    <span className="text-green-600">타수: {lastResult.kpm}/분</span>
                    <span className="text-purple-600">자수: {lastResult.cpm}/분</span>
                  </div>
                  {allResults.length > 0 && (
                    <div className="flex items-center space-x-4 text-xs text-gray-600">
                      <span>평균 타수: {calculateAverage().avgKpm}/분</span>
                      <span>평균 자수: {calculateAverage().avgCpm}/분</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showText && (mode === "sequential") && (
            <div className="flex-1 flex flex-col gap-4">
              <div className={`flex-1 p-4 border-2 border-blue-500 rounded bg-blue-50 overflow-hidden relative ${countdown !== null ? 'flex flex-col items-center justify-center' : ''}`}>
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
                    <div className="mt-6 text-base text-gray-600">
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
                            <div key={slot} className={`mr-4 ${slot === practiceSlot ? 'font-bold text-indigo-600' : ''}`}>
                              {slotNames[slot] || `슬롯 ${slot}`} : 보교 {normalRounds[slot] || 0}회 / 매매 {batchRounds[slot] || 0}회
                            </div>
                          ));
                      })()}
                    </div>
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
                          const text = isBatchMode
                            ? currentBatchChars
                            : randomizedIndices.slice(0, currentDisplayIndex).map(index =>
                                sequentialText[index]
                              ).join('');

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
                        if (isFullyComplete) {
                          startNextRound(practiceSlot, isBatchMode); // 카운트다운 후 완료 횟수 증가
                        } else {
                          resumeRound();
                        }
                      }
                    }}
                    lang="ko"
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
                      <span className="text-white text-2xl font-bold">여기에 영상 파일을 놓으세요</span>
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
                      <span>동영상 파일을 드래그하거나 선택하세요</span>
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

          {showText && mode !== "sequential" && mode !== "random" && (
            <div className="min-h-[200px] p-4 border rounded bg-gray-50">
              <p className="font-semibold whitespace-pre-wrap">
                {mode === "words"
                  ? shuffledWords[currentWordIndex]
                  : mode === "sentences"
                  ? sentences[currentSentenceIndex]
                  : ""}
              </p>
            </div>
          )}

          {mode !== "sequential" && mode !== "random" && (
            <>
              <input
                type="text"
                className="w-full p-2 border rounded"
                value={typedWord}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />

              <p className="text-sm font-medium">
                <span className="text-blue-600">정답: {correctCount}</span> |{" "}
                <span className="text-rose-600">오답: {incorrectCount}</span> |
                진행: {progressCount} / {totalCount}
              </p>

              <div>
                <h2 className="text-xl font-semibold mb-2">오답 노트</h2>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
