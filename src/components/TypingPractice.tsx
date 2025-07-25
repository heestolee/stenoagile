import { type ChangeEvent, type KeyboardEvent, useEffect } from "react";
import { useTypingStore } from "../store/useTypingStore";
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
  } = useTypingStore();

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;

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
      submitAnswer(typedWord);
    }
  };

  const handleStartOrStopPractice = () => {
    if (isPracticing) {
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
    if (mode === "words" && shuffledWords.length > 0) {
      speakText(shuffledWords[currentWordIndex]);
    } else if (mode === "sentences" && sentences.length > 0) {
      speakText(sentences[currentSentenceIndex]);
    } else if (mode === "random" && randomLetters.length > 0) {
      speakText(randomLetters[currentLetterIndex]);
    }
  }, [mode, currentWordIndex, currentSentenceIndex, currentLetterIndex]);

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
          <div className="flex items-center space-x-4">
            <label className="font-medium whitespace-nowrap">읽기 속도:</label>
            <div className="flex space-x-2">
              {[0.25, 0.5, 1].map((rate) => (
                <button
                  key={rate}
                  className={`px-3 py-1 rounded border ${
                    speechRate === rate
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-gray-200 text-gray-700"
                  }`}
                  onClick={() => changeSpeechRate(rate)}
                >
                  {rate}배
                </button>
              ))}
            </div>
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
