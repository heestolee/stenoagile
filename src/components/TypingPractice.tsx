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
    updateInputText,
    updateTypedWord,
    switchMode,
    changeSpeechRate,
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
  } = useTypingStore();

  const [heamiVoice, setHeamiVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [showText, setShowText] = useState(true);
  const timeoutIds = useRef<number[]>([]);
  const [lastResult, setLastResult] = useState({ kpm: 0, cpm: 0 });

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

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    clearAllTimeouts();

    // 텍스트를 통째로 재생 (Web Speech API가 자연스럽게 처리)
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    utterance.pitch = 1.2;
    utterance.volume = 1.0;
    if (heamiVoice) {
      utterance.voice = heamiVoice;
    }

    requestAnimationFrame(() => {
      window.speechSynthesis.speak(utterance);
    });
  };

  const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) =>
    updateInputText(event.target.value);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    updateTypedWord(event.target.value);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      // 엔터를 칠 때 최종 결과 계산
      if (currentWordStartTime && currentWordKeystrokes > 0) {
        const elapsedMs = Date.now() - currentWordStartTime;
        const elapsedMinutes = elapsedMs / 1000 / 60;

        if (elapsedMinutes > 0) {
          const kpm = Math.round(currentWordKeystrokes / elapsedMinutes);
          const charCount = typedWord.trim().replace(/\s+/g, '').length;
          const cpm = Math.round(charCount / elapsedMinutes);
          setLastResult({ kpm, cpm });
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
    if (isPracticing) {
      window.speechSynthesis.cancel();
      clearAllTimeouts();
      stopPractice();
    } else {
      const words = inputText.trim().split("/").filter(Boolean);
      if (words.length > 0) {
        startPractice(words);
      }
    }
  };

  const handleLoadPreset = (slot: number) => {
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
        break;
    }
  };

  useEffect(() => {
    if (!isPracticing) return;

    if (mode === "words" && shuffledWords.length > 0) {
      speakText(shuffledWords[currentWordIndex]);
    } else if (mode === "sentences" && sentences.length > 0) {
      speakText(sentences[currentSentenceIndex]);
    } else if (mode === "random" && randomLetters.length > 0) {
      speakText(randomLetters[currentLetterIndex]);
    }
  }, [isPracticing, mode, currentWordIndex, currentSentenceIndex, currentLetterIndex, speechRate]);

  // 연습 종료 시 결과 초기화
  useEffect(() => {
    if (!isPracticing) {
      setLastResult({ kpm: 0, cpm: 0 });
    }
  }, [isPracticing]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">StenoAgile</h1>

      <div className="flex flex-col lg:flex-row gap-24">
        <div className="flex-1 space-y-4">
          <div className="flex gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                onClick={() => handleLoadPreset(num)}
              >
                {num}
              </button>
            ))}
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
          </div>
          <textarea
            className="w-full p-2 border rounded"
            rows={25}
            placeholder="연습할 단어들을 입력하세요 (/로 구분)"
            value={inputText}
            onChange={handleTextareaChange}
          />
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
        </div>
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
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
              <div className="flex items-center space-x-4 text-sm font-medium">
                <span className="text-green-600">타수: {lastResult.kpm}/분</span>
                <span className="text-purple-600">자수: {lastResult.cpm}/분</span>
              </div>
            )}
          </div>

          {showText && (
            <p className="text-lg font-semibold">
              {mode === "words"
                ? shuffledWords[currentWordIndex]
                : mode === "sentences"
                ? sentences[currentSentenceIndex]
                : randomLetters[currentLetterIndex] ?? ""}
            </p>
          )}

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
        </div>
      </div>
    </div>
  );
}
