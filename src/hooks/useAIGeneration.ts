import { useState, useRef } from "react";

export function useAIGeneration() {
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [aiModelName, setAiModelName] = useState("");
  const [sentenceStyle, setSentenceStyle] = useState("뉴스/일상 대화체");
  const aiModelNameRef = useRef("");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);

  // API 호출 횟수 추적 (태평양 시간 자정 = KST 17:00 리셋)
  const [apiCallCount, setApiCallCount] = useState(() => {
    const saved = localStorage.getItem("gemini_api_calls");
    if (saved) {
      const parsed = JSON.parse(saved);
      const now = new Date();
      const ptDate = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString().split("T")[0];
      if (parsed.date === ptDate) return parsed.count;
    }
    return 0;
  });
  const [apiCallModels, setApiCallModels] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("gemini_api_calls");
    if (saved) {
      const parsed = JSON.parse(saved);
      const now = new Date();
      const ptDate = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString().split("T")[0];
      if (parsed.date === ptDate) return parsed.models || {};
    }
    return {};
  });

  const incrementApiCallCount = () => {
    try {
      const modelName = aiModelNameRef.current;
      const now = new Date();
      const ptDate = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString().split("T")[0];
      let existing: { date?: string; count?: number; models?: Record<string, number> } = {};
      try {
        const saved = localStorage.getItem("gemini_api_calls");
        if (saved) existing = JSON.parse(saved);
      } catch { /* 파싱 실패 시 초기화 */ }
      const currentCount = (existing.date === ptDate && typeof existing.count === "number") ? existing.count : 0;
      const newCount = currentCount + 1;
      const models: Record<string, number> = (existing.date === ptDate && existing.models && typeof existing.models === "object") ? { ...existing.models } : {};
      if (modelName) {
        models[modelName] = (models[modelName] || 0) + 1;
      }
      const data = { date: ptDate, count: newCount, models };
      localStorage.setItem("gemini_api_calls", JSON.stringify(data));
      setApiCallCount(newCount);
      setApiCallModels({ ...models });
    } catch (e) {
      console.error("[incrementApiCallCount] error:", e);
    }
  };

  // API 에러 발생 시 카운트다운 시작
  const setGenerateErrorWithRetry = (error: string) => {
    setGenerateError(error);
    if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    const limitMatch = error.match(/limit:\s*(\d+)/);
    const limit = limitMatch ? parseInt(limitMatch[1]) : 0;
    if (limit >= 20) {
      setRetryCountdown(0);
      return;
    }
    const retryMatch = error.match(/retry in ([\d.]+)s/);
    if (retryMatch) {
      let seconds = Math.ceil(parseFloat(retryMatch[1]));
      setRetryCountdown(seconds);
      retryTimerRef.current = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
          if (retryTimerRef.current) clearInterval(retryTimerRef.current);
          retryTimerRef.current = null;
          setRetryCountdown(0);
          setGenerateError(null);
        } else {
          setRetryCountdown(seconds);
        }
      }, 1000);
    }
  };

  // API 에러 메시지를 한글로 변환
  const getErrorMessage = (error: string): string => {
    if (error.includes("429")) {
      const limitMatch = error.match(/limit:\s*(\d+)/);
      const limit = limitMatch ? parseInt(limitMatch[1]) : 0;
      if (limit >= 20) {
        return "일일 호출 한도 초과 (RPD 20회). 17:00 리셋까지 기다려주세요.";
      }
      if (retryCountdown > 0) {
        return `분당 호출 한도 초과 (RPM). ${retryCountdown}초 후 다시 시도하세요.`;
      }
      return "호출 한도 초과. 잠시 후 다시 시도하세요.";
    }
    if (error.includes("503")) {
      return "서버 과부하 상태입니다. 잠시 후 다시 시도하세요.";
    }
    if (error.includes("API 키")) return error;
    return `오류: ${error}`;
  };

  return {
    geminiApiKey,
    setGeminiApiKey,
    isGenerating,
    setIsGenerating,
    generatedCount,
    setGeneratedCount,
    aiModelName,
    setAiModelName,
    sentenceStyle,
    setSentenceStyle,
    aiModelNameRef,
    generateError,
    setGenerateError,
    retryCountdown,
    generateAbortRef,
    apiCallCount,
    apiCallModels,
    incrementApiCallCount,
    setGenerateErrorWithRetry,
    getErrorMessage,
  };
}
