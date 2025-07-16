import {
  useState,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";

type Mode = "words" | "sentences";

interface IncorrectEntry {
  word: string;
  typed: string;
}

export default function TypingPractice() {
  const [inputText, setInputText] = useState("");
  const [shuffledWords, setShuffledWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [typedWord, setTypedWord] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [incorrectWords, setIncorrectWords] = useState<IncorrectEntry[]>([]);
  const [mode, setMode] = useState<Mode>("words");
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [speechRate, setSpeechRate] = useState(1);

  const removeWhitespace = (text: string): string => text.replace(/\s+/g, "");

  const generateSentences = (words: string[]): string[] => {
    if (words.length === 0) return ["연습할 단어를 입력하세요."];
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

  const speakText = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  };

  const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTypedWord(event.target.value);
  };

  const handleWordInput = () => {
    const target = removeWhitespace(shuffledWords[currentWordIndex]);
    const input = removeWhitespace(typedWord);

    if (input === target) {
      setCorrectCount((prev) => prev + 1);
    } else {
      setIncorrectCount((prev) => prev + 1);
      setIncorrectWords((prev) => [
        ...prev,
        { word: shuffledWords[currentWordIndex], typed: typedWord.trim() },
      ]);
    }

    setCurrentWordIndex((prev) => (prev + 1) % shuffledWords.length);
  };

  const handleSentenceInput = () => {
    const target = removeWhitespace(sentences[currentSentenceIndex]);
    const input = removeWhitespace(typedWord);

    if (input === target) {
      setCorrectCount((prev) => prev + 1);
    } else {
      setIncorrectCount((prev) => prev + 1);
      setIncorrectWords((prev) => [
        ...prev,
        { word: sentences[currentSentenceIndex], typed: typedWord.trim() },
      ]);
    }

    setCurrentSentenceIndex((prev) => (prev + 1) % sentences.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;

    if (mode === "words") {
      handleWordInput();
    } else {
      handleSentenceInput();
    }

    setTypedWord("");
  };

  const startPractice = () => {
    const words = inputText.trim().split("/").filter(Boolean);
    if (words.length === 0) return;

    setShuffledWords([...words].sort(() => Math.random() - 0.5));
    setSentences(generateSentences(words).sort(() => Math.random() - 0.5));
    setCurrentWordIndex(0);
    setCurrentSentenceIndex(0);
    setTypedWord("");
    setCorrectCount(0);
    setIncorrectCount(0);
    setIncorrectWords([]);
  };

  useEffect(() => {
    if (mode === "words" && shuffledWords.length > 0) {
      speakText(shuffledWords[currentWordIndex]);
    } else if (mode === "sentences" && sentences.length > 0) {
      speakText(sentences[currentSentenceIndex]);
    }
  }, [currentWordIndex, currentSentenceIndex, mode]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">
        타자 연습 프로그램
      </h1>

      <div className="flex flex-col lg:flex-row gap-24">
        <div className="flex-1 space-y-4">
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded ${
                mode === "words" ? "bg-blue-500 text-white" : "bg-gray-300"
              }`}
              onClick={() => setMode("words")}
            >
              단어 연습
            </button>
            <button
              className={`px-4 py-2 rounded ${
                mode === "sentences" ? "bg-blue-500 text-white" : "bg-gray-300"
              }`}
              onClick={() => setMode("sentences")}
            >
              문장 연습
            </button>
          </div>

          <textarea
            className="w-full p-2 border rounded"
            rows={30}
            placeholder="연습할 단어들을 입력하세요 (/로 구분)"
            value={inputText}
            onChange={handleTextareaChange}
          />

          <button
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={startPractice}
          >
            연습 시작
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
                  onClick={() => setSpeechRate(rate)}
                >
                  {rate}배
                </button>
              ))}
            </div>
          </div>

          <p className="text-lg font-semibold">
            {mode === "words"
              ? shuffledWords[currentWordIndex]
              : sentences[currentSentenceIndex]}
          </p>

          <input
            type="text"
            className="w-full p-2 border rounded"
            value={typedWord}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />

          <p>
            정답: {correctCount} | 오답: {incorrectCount}
          </p>

          <div>
            <h2 className="text-xl font-semibold">오답 노트</h2>
            <ul>
              {incorrectWords.map((item) => (
                <li key={`${item.word}-${item.typed}`} className="text-red-500">
                  {item.word} → {item.typed}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
