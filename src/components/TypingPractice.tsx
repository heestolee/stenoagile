import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useTypingStore } from "../store/useTypingStore";
import { rateToCps, cpsToRate, clampCps } from "../utils/speechUtils";
import { savedText1, savedText2, savedText5 } from "../constants";

export default function TypingPractice() {
  const {
    inputText,
    shuffledWords,
    randomLetters,
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

  // 슬롯 이름 불러오기
  useEffect(() => {
    const savedNames: { [key: number]: string } = {};
    for (let i = 1; i <= 20; i++) {
      const name = localStorage.getItem(`slot_${i}_name`);
      if (name) {
        savedNames[i] = name;
      }
    }
    setSlotNames(savedNames);
  }, []);

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

  const clearAllTimeouts = () => {
    timeoutIds.current.forEach(clearTimeout);
    timeoutIds.current = [];
  };

  // 경과 시간을 "분:초" 형태로 포맷팅
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // 다음 라운드 시작 (카운트다운 포함)
  const startNextRound = () => {
    setIsRoundComplete(false);
    setAccumulatedKeystrokes(0);
    setAccumulatedElapsedMs(0);
    setDisplayElapsedTime(0);
    updateTypedWord(""); // 타이핑 칸 초기화
    startCountdown(() => {
      setRoundStartTime(Date.now());
      restartSequentialPractice();
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
      // 보교치기 모드에서는 다른 처리
      if (mode === "sequential" && isPracticing) {
        event.preventDefault();

        // 라운드 완료 상태에서 엔터 누르면 다음 라운드 시작
        if (isRoundComplete) {
          startNextRound();
          return;
        }

        // 결과 계산 (누적 값 포함)
        const currentElapsedMs = currentWordStartTime ? Date.now() - currentWordStartTime : 0;
        const totalKeystrokes = accumulatedKeystrokes + currentWordKeystrokes;
        const totalElapsedMs = accumulatedElapsedMs + currentElapsedMs;
        const totalElapsedMinutes = totalElapsedMs / 1000 / 60;
        const elapsedSeconds = Math.round(totalElapsedMs / 1000);

        if (totalElapsedMinutes > 0 && totalKeystrokes > 0) {
          const kpm = Math.round(totalKeystrokes / totalElapsedMinutes);
          const charCount = typedWord.trim().replace(/\s+/g, '').length;
          const cpm = Math.round(charCount / totalElapsedMinutes);
          setLastResult({ kpm, cpm, elapsedTime: elapsedSeconds });
          setAllResults(prev => [...prev, { kpm, cpm, elapsedTime: elapsedSeconds }]);
        }

        // 누적 값 업데이트
        setAccumulatedKeystrokes(totalKeystrokes);
        setAccumulatedElapsedMs(totalElapsedMs);
        resetCurrentWordTracking();
        // 첫 번째 엔터: 결과만 보여주고 대기 (라운드 완료 상태로 전환)
        setIsRoundComplete(true);
        return;
      }

      // 기존 모드에서의 엔터 처리
      if (currentWordStartTime && currentWordKeystrokes > 0) {
        const elapsedMs = Date.now() - currentWordStartTime;
        const elapsedMinutes = elapsedMs / 1000 / 60;

        if (elapsedMinutes > 0) {
          const kpm = Math.round(currentWordKeystrokes / elapsedMinutes);
          const charCount = typedWord.trim().replace(/\s+/g, '').length;
          const cpm = Math.round(charCount / elapsedMinutes);
          setLastResult({ kpm, cpm, elapsedTime: 0 });
          setAllResults(prev => [...prev, { kpm, cpm, elapsedTime: 0 }]);
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
      // 보교치기 모드에서 라운드 완료 상태일 때 타이핑 시작하면 자동으로 재개
      if (mode === "sequential" && isRoundComplete) {
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
      stopPractice();
    } else {
      const words = inputText.trim().split("/").filter(Boolean);
      if (words.length > 0) {
        if (mode === "sequential") {
          // 보교치기 모드: 카운트다운 후 시작
          startCountdown(() => {
            setRoundStartTime(Date.now());
            startPractice(words);
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

    if (mode === "sequential") {
      // 라운드 완료 상태면 글자 표시 멈춤
      if (isRoundComplete) return;

      // 보교치기 모드: 랜덤 순서로 한 글자씩 표시
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
      } else if (mode === "random" && randomLetters.length > 0) {
        speakText(randomLetters[currentLetterIndex]);
      }
    }
  }, [isPracticing, mode, currentWordIndex, currentSentenceIndex, currentLetterIndex, speechRate, currentDisplayIndex, randomizedIndices, sequentialSpeed, isSoundEnabled, sequentialText, charsPerRead, isRoundComplete]);

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
        setDisplayElapsedTime(Math.round(totalMs / 1000));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPracticing, countdown, isRoundComplete, currentWordStartTime, accumulatedElapsedMs]);

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

  return (
    <div className="p-4 w-full">
      <h1 className="text-2xl font-bold mb-4 text-center">StenoAgile</h1>

      <div className={`flex ${mode === "sequential" ? "flex-row gap-4" : "flex-col lg:flex-row gap-24"}`}>
        <div className={mode === "sequential" ? "w-64 space-y-4" : "flex-1 space-y-4"}>
          <div className="space-y-2 mb-2">
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  className={`px-3 py-1 rounded text-sm ${
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
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded ${
                mode === "words" ? "bg-blue-500 text-white" : "bg-gray-300"
              }`}
              onClick={() => switchMode("words")}
            >
              단어 연습
            </button>
            <button
              className={`px-4 py-2 rounded ${
                mode === "sentences" ? "bg-blue-500 text-white" : "bg-gray-300"
              }`}
              onClick={() => switchMode("sentences")}
            >
              문장 연습
            </button>
            <button
              className={`px-4 py-2 rounded ${
                mode === "random" ? "bg-blue-500 text-white" : "bg-gray-300"
              }`}
              onClick={() => switchMode("random")}
            >
              랜덤 연습
            </button>
            <button
              className={`px-4 py-2 rounded ${
                mode === "sequential" ? "bg-blue-500 text-white" : "bg-gray-300"
              }`}
              onClick={() => switchMode("sequential")}
            >
              보교치기
            </button>
          </div>
          <textarea
            className="w-full p-2 border rounded"
            rows={25}
            placeholder="연습할 단어들을 입력하세요 (/로 구분)"
            value={inputText}
            onChange={handleTextareaChange}
          />
          {mode !== "sequential" && (
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
        <div className={mode === "sequential" ? "flex-1 flex flex-col gap-4" : "flex-1 space-y-4"}>
          {mode !== "sequential" && (
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

          {mode === "sequential" && (
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <label className="font-medium whitespace-nowrap">표시 속도:</label>
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
                    className="w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">글자/초</span>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="font-medium whitespace-nowrap">음성 속도:</label>
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
                    className="w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">배속</span>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="font-medium whitespace-nowrap">위 글자:</label>
                  <input
                    type="number"
                    min={12}
                    max={48}
                    step={0.5}
                    value={displayFontSize}
                    onChange={(e) => {
                      const size = parseFloat(e.target.value);
                      if (!isNaN(size) && size >= 12 && size <= 48) {
                        setDisplayFontSize(size);
                      }
                    }}
                    className="w-16 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">px</span>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="font-medium whitespace-nowrap">아래 글자:</label>
                  <input
                    type="number"
                    min={12}
                    max={48}
                    step={0.5}
                    value={inputFontSize}
                    onChange={(e) => {
                      const size = parseFloat(e.target.value);
                      if (!isNaN(size) && size >= 12 && size <= 48) {
                        setInputFontSize(size);
                      }
                    }}
                    className="w-16 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">px</span>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="font-medium whitespace-nowrap">읽기 단위:</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={0.5}
                    value={charsPerRead}
                    onChange={(e) => {
                      const count = parseInt(e.target.value);
                      if (!isNaN(count) && count >= 1 && count <= 50) {
                        setCharsPerRead(count);
                      }
                    }}
                    className="w-16 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">자</span>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="font-medium whitespace-nowrap">글자 표시:</label>
                  <button
                    className={`px-4 py-1 rounded font-medium transition ${
                      showText
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                    }`}
                    onClick={() => setShowText(!showText)}
                  >
                    {showText ? "ON" : "OFF"}
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="font-medium whitespace-nowrap">소리:</label>
                  <button
                    className={`px-4 py-1 rounded font-medium transition ${
                      isSoundEnabled
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-300 text-gray-700 hover:bg-gray-400"
                    }`}
                    onClick={toggleSound}
                  >
                    {isSoundEnabled ? "ON" : "OFF"}
                  </button>
                </div>

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
                      <span className="text-green-600 font-bold">라운드 완료!</span>
                      <span className="text-blue-600 font-semibold">타수: {lastResult.kpm}/분</span>
                      <span className="text-purple-600 font-semibold">자수: {lastResult.cpm}/분</span>
                      <span className="text-orange-600 font-semibold">시간: {formatTime(lastResult.elapsedTime)}</span>
                      <span className="text-gray-500">(엔터를 눌러 다시 시작)</span>
                    </>
                  ) : (
                    <>
                      {allResults.length > 0 && (
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

          {mode !== "sequential" && (
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

          {showText && mode === "sequential" && (
            <div className="flex-1 flex flex-col gap-4">
              <div className={`flex-1 p-4 border-2 border-blue-500 rounded bg-blue-50 overflow-hidden ${countdown !== null ? 'flex items-center justify-center' : ''}`}>
                {countdown !== null ? (
                  <p className="text-8xl font-bold text-blue-600 animate-pulse">
                    {countdown}
                  </p>
                ) : (
                  <p
                    className="font-semibold whitespace-pre-wrap w-full"
                    style={{ fontSize: `${displayFontSize}px`, lineHeight: 1.5 }}
                  >
                    {randomizedIndices.slice(0, currentDisplayIndex).map(index =>
                      sequentialText[index]
                    ).join('')}
                  </p>
                )}
              </div>
              <div className="flex-1 border-2 border-green-500 rounded bg-green-50 p-4">
                <textarea
                  className="w-full h-full p-4 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ fontSize: `${inputFontSize}px`, lineHeight: 1.5 }}
                  placeholder="여기에 타이핑하세요"
                  value={typedWord}
                  onChange={(e) => updateTypedWord(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
          )}

          {showText && mode !== "sequential" && (
            <div className="min-h-[200px] p-4 border rounded bg-gray-50">
              <p className="font-semibold whitespace-pre-wrap">
                {mode === "words"
                  ? shuffledWords[currentWordIndex]
                  : mode === "sentences"
                  ? sentences[currentSentenceIndex]
                  : randomLetters[currentLetterIndex] ?? ""}
              </p>
            </div>
          )}

          {mode !== "sequential" && (
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
