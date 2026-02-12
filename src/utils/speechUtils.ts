/**
 * Web Speech API의 rate와 CPS(Characters Per Second) 간 변환 유틸리티
 */

/**
 * Web Speech API rate=1일 때의 기준 글자수
 * 실제 음성 재생 속도 측정 결과: rate=1.0일 때 약 9글자/초
 */
export const BASE_CPS = 9;

/**
 * CPS(Characters Per Second)를 Web Speech API rate로 변환
 * @param cps - 초당 글자 수 (1~5 권장)
 * @returns Web Speech API rate 값
 */
export const cpsToRate = (cps: number): number => {
  if (cps <= 0) return 0.1; // 최소값
  return cps / BASE_CPS;
};

