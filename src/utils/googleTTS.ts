/**
 * Google Cloud Text-to-Speech API 유틸리티
 */

const API_KEY = import.meta.env.VITE_GOOGLE_CLOUD_TTS_API_KEY;
const API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

// 현재 재생 중인 오디오 추적
let currentAudio: HTMLAudioElement | null = null;

interface GoogleTTSOptions {
  text: string;
  rate?: number; // 0.25 ~ 4.0
  pitch?: number; // -20.0 ~ 20.0
}

/**
 * Google Cloud TTS API를 사용하여 음성 생성 및 재생
 */
export const speakWithGoogleTTS = async (
  options: GoogleTTSOptions
): Promise<void> => {
  if (!API_KEY || API_KEY === "YOUR_API_KEY") {
    console.error(
      "Google Cloud TTS API 키가 설정되지 않았습니다. .env.local 파일을 확인하세요."
    );
    throw new Error("API 키가 설정되지 않았습니다.");
  }

  const { text, rate = 1.0, pitch = 0.0 } = options;

  try {
    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: "ko-KR",
          name: "ko-KR-Wavenet-A", // 여성 목소리, WaveNet (무료 한도 있음)
          // 다른 옵션 (모두 무료 100만 글자/월):
          // "ko-KR-Wavenet-A" - 여성 (추천)
          // "ko-KR-Wavenet-B" - 남성
          // "ko-KR-Wavenet-C" - 남성
          // "ko-KR-Wavenet-D" - 여성
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: rate,
          pitch: pitch,
          volumeGainDb: 0.0,
          sampleRateHertz: 24000,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Google TTS API 오류:", error);
      throw new Error(`API 오류: ${error.error?.message || "알 수 없는 오류"}`);
    }

    const data = await response.json();
    const audioContent = data.audioContent;

    // Base64 오디오를 재생
    const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
    currentAudio = audio;

    await audio.play();

    // 재생이 끝나면 currentAudio 초기화
    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null;
      }
    };
  } catch (error) {
    console.error("Google Cloud TTS 오류:", error);
    throw error;
  }
};

/**
 * 현재 재생 중인 Google TTS 오디오 중단
 */
export const stopGoogleTTS = (): void => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
};

/**
 * CPS(Characters Per Second) 기반으로 Google TTS rate 계산
 * Google TTS의 speakingRate는 0.25 ~ 4.0 범위
 */
export const cpsToGoogleRate = (cps: number): number => {
  // 실험적 기준: rate=1.0일 때 약 4 CPS
  const BASE_CPS = 4;
  const rate = cps / BASE_CPS;

  // Google TTS rate 범위로 제한
  return Math.max(0.25, Math.min(4.0, rate));
};
