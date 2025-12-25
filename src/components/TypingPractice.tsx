import { type ChangeEvent, type KeyboardEvent, useEffect, useState } from "react";
import { useTypingStore } from "../store/useTypingStore";
import { savedText1, savedText2, savedText5 } from "../constants";
import { rateToCps, cpsToRate, clampCps } from "../utils/speechUtils";

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
  } = useTypingStore();

  const [heamiVoice, setHeamiVoice] = useState<SpeechSynthesisVoice | null>(null);

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

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();

    // 문장인 경우 단어별로 쪼개서 pause와 함께 재생
    const words = text.split(/\s+/).filter(Boolean);

    if (words.length > 1) {
      // 여러 단어인 경우: 각 단어를 개별 재생하고 사이에 pause
      let delay = 0;
      words.forEach((word) => {
        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(word);
          utterance.rate = speechRate;
          utterance.pitch = 1.2; // 음높이를 높여 더 명확하게 (1.1 → 1.2)
          utterance.volume = 1.0; // 볼륨 최대
          if (heamiVoice) {
            utterance.voice = heamiVoice;
          }

          window.speechSynthesis.speak(utterance);
        }, delay);

        // 각 단어의 예상 재생 시간 + pause (500ms로 증가)
        const wordDuration = (word.length / rateToCps(speechRate)) * 1000;
        delay += wordDuration + 500; // 300ms → 500ms로 증가
      });
    } else {
      // 단일 단어나 글자인 경우: 그냥 재생
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speechRate;
      utterance.pitch = 1.2; // 1.1 → 1.2
      utterance.volume = 1.0;
      if (heamiVoice) {
        utterance.voice = heamiVoice;
      }

      requestAnimationFrame(() => {
        window.speechSynthesis.speak(utterance);
      });
    }
  };

  const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) =>
    updateInputText(event.target.value);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    updateTypedWord(event.target.value);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      submitAnswer(typedWord);
    }
  };

  const handleCpsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    if (inputValue === "") return;

    const cps = parseFloat(inputValue);
    if (isNaN(cps)) return;

    const clampedCps = clampCps(cps, 0, 5);
    changeSpeechRate(cpsToRate(clampedCps));
  };

  const handleStartOrStopPractice = () => {
    if (isPracticing) {
      window.speechSynthesis.cancel();
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
  }, [isPracticing, mode, currentWordIndex, currentSentenceIndex, currentLetterIndex]);

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
                  max={5}
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
              max={5}
              step={0.1}
              value={rateToCps(speechRate)}
              onChange={(e) => {
                const cps = parseFloat(e.target.value);
                changeSpeechRate(cpsToRate(cps));
              }}
              className="w-full"
            />
          </div>

          <p className="text-lg font-semibold">
            {mode === "words"
              ? shuffledWords[currentWordIndex]
              : mode === "sentences"
              ? sentences[currentSentenceIndex]
              : randomLetters[currentLetterIndex] ?? ""}
          </p>

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
