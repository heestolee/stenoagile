/**
 * Google Sheets 로깅 유틸리티
 * Apps Script를 통해 연습 결과를 Google Sheets에 기록합니다.
 */

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyQpKH86KREoS8nYsIJ09fjKagyOZkL-56iXB4Hs8lUEUaqBAHp9tdh6YMUwDDP_Vom/exec";

// 모드 이름 변환
const MODE_LABELS: Record<string, string> = {
  words: "단어",
  sentences: "문장",
  random: "랜덤",
  sequential: "매매치라",
  longtext: "긴글",
  position: "자리",
};

// 세션 ID 생성 (앱 시작 후 1회)
let currentSessionId: string | null = null;

export const getSessionId = (): string => {
  if (!currentSessionId) {
    currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  return currentSessionId;
};

export const resetSessionId = (): void => {
  currentSessionId = null;
};

// 타임스탬프 생성 (한국 시간)
const getTimestamp = (): string => {
  return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
};

// 데이터 전송 함수
const sendToSheet = async (data: Record<string, unknown>): Promise<void> => {
  try {
    // no-cors 모드에서는 Content-Type: application/json 사용이 제한될 수 있어
    // body에 문자열 JSON을 넣어 전송합니다.
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(data),
    });
  } catch (error) {
    // 로깅 실패가 연습 흐름을 막지 않도록 경고만 출력
    console.warn("Sheet logging failed:", error);
  }
};

// 개별 결과 로깅
export interface ResultData {
  mode: string;
  kpm: number;
  cpm: number;
  elapsedTime: number;
  chars?: string;
}

export const logResult = async (result: ResultData): Promise<void> => {
  const data = {
    type: "result",
    sessionId: getSessionId(),
    timestamp: getTimestamp(),
    mode: MODE_LABELS[result.mode] || result.mode,
    kpm: result.kpm,
    cpm: result.cpm,
    elapsedTime: Math.round(result.elapsedTime),
    chars: result.chars || "",
  };

  await sendToSheet(data);
};

// 세션 통계 로깅
export interface SessionData {
  mode: string;
  totalResults: number;
  avgKpm: number;
  avgCpm: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  totalElapsedTime: number;
}

export const logSession = async (session: SessionData): Promise<void> => {
  const data = {
    type: "session",
    sessionId: getSessionId(),
    timestamp: getTimestamp(),
    mode: MODE_LABELS[session.mode] || session.mode,
    totalResults: session.totalResults,
    avgKpm: Math.round(session.avgKpm),
    avgCpm: Math.round(session.avgCpm),
    correctCount: session.correctCount,
    incorrectCount: session.incorrectCount,
    accuracy: session.accuracy.toFixed(1),
    totalElapsedTime: Math.round(session.totalElapsedTime),
  };

  await sendToSheet(data);
};
