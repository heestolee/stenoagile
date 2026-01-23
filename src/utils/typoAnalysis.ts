// 오타 패턴 분석 유틸리티 (앞글자 컨텍스트 포함)

export interface TypoEntry {
  position: number;       // 틀린 위치
  expected: string;       // 정답 글자
  actual: string;         // 입력한 글자
  context: string;        // 앞 10글자 컨텍스트
}

export interface ContextPattern {
  context: string;        // 앞글자 컨텍스트
  expected: string;       // 정답
  actual: string;         // 오타
  count: number;          // 횟수
}

export interface TypoAnalysis {
  // 글자별 오류 횟수
  charErrors: Map<string, number>;
  // 혼동 패턴 (정답 → 오타)
  confusionMap: Map<string, Map<string, number>>;
  // 컨텍스트 패턴 (앞글자들 + 정답 → 오타)
  contextPatterns: ContextPattern[];
  // 총 오류 수
  totalErrors: number;
}

// 오타 분석
export function analyzeTypos(typos: TypoEntry[]): TypoAnalysis {
  const charErrors = new Map<string, number>();
  const confusionMap = new Map<string, Map<string, number>>();
  const contextMap = new Map<string, ContextPattern>();

  for (const typo of typos) {
    // 글자별 오류
    charErrors.set(typo.expected, (charErrors.get(typo.expected) || 0) + 1);

    // 혼동 패턴
    if (!confusionMap.has(typo.expected)) {
      confusionMap.set(typo.expected, new Map());
    }
    const confusions = confusionMap.get(typo.expected)!;
    confusions.set(typo.actual, (confusions.get(typo.actual) || 0) + 1);

    // 컨텍스트 패턴 (앞 1~10글자 각각에 대해)
    for (let len = 1; len <= Math.min(10, typo.context.length); len++) {
      const ctx = typo.context.slice(-len); // 마지막 len글자
      const key = `${ctx}|${typo.expected}|${typo.actual}`;

      if (contextMap.has(key)) {
        contextMap.get(key)!.count++;
      } else {
        contextMap.set(key, {
          context: ctx,
          expected: typo.expected,
          actual: typo.actual,
          count: 1,
        });
      }
    }
  }

  // 컨텍스트 패턴 정렬 (횟수 내림차순, 컨텍스트 길이 내림차순)
  const contextPatterns = Array.from(contextMap.values())
    .filter(p => p.count >= 2) // 2회 이상만
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.context.length - a.context.length;
    });

  return {
    charErrors,
    confusionMap,
    contextPatterns,
    totalErrors: typos.length,
  };
}

// 취약 패턴 기반 연습문 생성
export function generateWeakPatternPractice(
  analysis: TypoAnalysis,
  originalText: string,
  repeatCount: number = 3
): string {
  const practiceChunks: string[] = [];

  // 1. 컨텍스트 패턴에서 취약 부분 추출 (앞글자 + 정답 포함 구간)
  const contextPatterns = Array.from(analysis.contextPatterns)
    .filter(p => p.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  for (const pattern of contextPatterns) {
    // 원문에서 해당 패턴이 나오는 위치 찾기
    const searchStr = pattern.context + pattern.expected;
    let idx = originalText.indexOf(searchStr);

    while (idx !== -1) {
      // 앞뒤로 5글자씩 더 포함 (총 10글자 + 패턴)
      const start = Math.max(0, idx - 5);
      const end = Math.min(originalText.length, idx + searchStr.length + 5);
      const chunk = originalText.slice(start, end);

      if (chunk.length >= 3 && !practiceChunks.includes(chunk)) {
        practiceChunks.push(chunk);
      }

      idx = originalText.indexOf(searchStr, idx + 1);
    }
  }

  // 2. 자주 틀리는 글자가 포함된 구간 추출
  const charErrors = Array.from(analysis.charErrors.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  for (const [char] of charErrors) {
    let idx = originalText.indexOf(char);
    let found = 0;

    while (idx !== -1 && found < 3) {
      const start = Math.max(0, idx - 8);
      const end = Math.min(originalText.length, idx + 8);
      const chunk = originalText.slice(start, end);

      if (chunk.length >= 5 && !practiceChunks.some(c => c.includes(chunk) || chunk.includes(c))) {
        practiceChunks.push(chunk);
        found++;
      }

      idx = originalText.indexOf(char, idx + 1);
    }
  }

  if (practiceChunks.length === 0) {
    return "";
  }

  // 3. 반복 연습문 생성
  const result: string[] = [];
  for (let i = 0; i < repeatCount; i++) {
    result.push(...practiceChunks);
  }

  return result.join(" ");
}

// 상위 패턴 추출
export function getTopPatterns(analysis: TypoAnalysis, limit: number = 10) {
  const sortMap = (map: Map<string, number>) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

  // 혼동 패턴
  const confusions: { from: string; to: string; count: number }[] = [];
  analysis.confusionMap.forEach((toMap, from) => {
    toMap.forEach((count, to) => {
      confusions.push({ from, to, count });
    });
  });
  confusions.sort((a, b) => b.count - a.count);

  // 컨텍스트 패턴 중복 제거 (같은 패턴이면 긴 컨텍스트만)
  const seenPatterns = new Set<string>();
  const uniqueContextPatterns: ContextPattern[] = [];

  for (const p of analysis.contextPatterns) {
    const patternKey = `${p.expected}→${p.actual}`;
    // 이미 더 긴 컨텍스트로 등록된 패턴은 건너뜀
    let dominated = false;
    for (const existing of uniqueContextPatterns) {
      if (existing.expected === p.expected &&
          existing.actual === p.actual &&
          existing.context.endsWith(p.context)) {
        dominated = true;
        break;
      }
    }
    if (!dominated && !seenPatterns.has(`${p.context}|${patternKey}`)) {
      seenPatterns.add(`${p.context}|${patternKey}`);
      uniqueContextPatterns.push(p);
    }
  }

  return {
    topCharErrors: sortMap(analysis.charErrors),
    topConfusions: confusions.slice(0, limit),
    topContextPatterns: uniqueContextPatterns.slice(0, limit),
    totalErrors: analysis.totalErrors,
  };
}
