// 정밀 채점 분석 (탈자/첨자/오자 구분)

export interface ScoringResult {
  totalChars: number;      // 전체 글자 수 (원문)
  deletions: number;       // 탈자 (빠뜨린 글자)
  insertions: number;      // 첨자 (잘못 추가한 글자)
  substitutions: number;   // 오자 (틀리게 친 글자)
  correct: number;         // 맞은 글자
  accuracy: number;        // 정확도 (%)

  // 상세 분석용
  deletionChars: { char: string; position: number }[];      // 탈자 목록
  insertionChars: { char: string; position: number }[];     // 첨자 목록
  substitutionChars: { expected: string; actual: string; position: number }[]; // 오자 목록

  // 원문에 마킹용 (각 원문 글자의 상태)
  charStates: ('correct' | 'deletion' | 'substitution')[];
}

// LCS (Longest Common Subsequence) 기반 diff 알고리즘
function computeLCS(original: string, typed: string): number[][] {
  const m = original.length;
  const n = typed.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (original[i - 1] === typed[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

// LCS 역추적으로 diff 생성
function backtrackLCS(
  dp: number[][],
  original: string,
  typed: string
): { type: 'match' | 'delete' | 'insert' | 'substitute'; origIdx?: number; typedIdx?: number }[] {
  const result: { type: 'match' | 'delete' | 'insert' | 'substitute'; origIdx?: number; typedIdx?: number }[] = [];
  let i = original.length;
  let j = typed.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === typed[j - 1]) {
      result.unshift({ type: 'match', origIdx: i - 1, typedIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'insert', typedIdx: j - 1 });
      j--;
    } else {
      result.unshift({ type: 'delete', origIdx: i - 1 });
      i--;
    }
  }

  return result;
}

// 정밀 채점 분석
export function analyzeScoring(original: string, typed: string): ScoringResult {
  // 공백 제거 버전으로 분석
  const origClean = original.replace(/\s+/g, '');
  const typedClean = typed.replace(/\s+/g, '');

  const dp = computeLCS(origClean, typedClean);
  const diff = backtrackLCS(dp, origClean, typedClean);

  const deletionChars: { char: string; position: number }[] = [];
  const insertionChars: { char: string; position: number }[] = [];
  const substitutionChars: { expected: string; actual: string; position: number }[] = [];
  const charStates: ('correct' | 'deletion' | 'substitution')[] = Array(origClean.length).fill('correct');

  let correct = 0;

  // 연속된 delete + insert를 substitute로 변환
  for (let k = 0; k < diff.length; k++) {
    const curr = diff[k];

    if (curr.type === 'match') {
      correct++;
    } else if (curr.type === 'delete') {
      // 다음이 insert면 substitute로 처리
      if (k + 1 < diff.length && diff[k + 1].type === 'insert') {
        const next = diff[k + 1];
        substitutionChars.push({
          expected: origClean[curr.origIdx!],
          actual: typedClean[next.typedIdx!],
          position: curr.origIdx!,
        });
        charStates[curr.origIdx!] = 'substitution';
        k++; // skip next
      } else {
        deletionChars.push({
          char: origClean[curr.origIdx!],
          position: curr.origIdx!,
        });
        charStates[curr.origIdx!] = 'deletion';
      }
    } else if (curr.type === 'insert') {
      insertionChars.push({
        char: typedClean[curr.typedIdx!],
        position: curr.typedIdx!,
      });
    }
  }

  const totalChars = origClean.length;
  const deletions = deletionChars.length;
  const insertions = insertionChars.length;
  const substitutions = substitutionChars.length;

  // 정확도 계산 (맞은 글자 / (전체 글자 + 첨자))
  // 첨자도 오류로 간주하여 정확도에 반영
  const accuracy = (totalChars + insertions) > 0 ? (correct / (totalChars + insertions)) * 100 : 0;

  return {
    totalChars,
    deletions,
    insertions,
    substitutions,
    correct,
    accuracy: Math.round(accuracy * 100) / 100,
    deletionChars,
    insertionChars,
    substitutionChars,
    charStates,
  };
}

// 원문에 색상 마킹된 HTML 생성 (React용 데이터)
export interface MarkedChar {
  char: string;
  state: 'correct' | 'deletion' | 'substitution';
  wrongChar?: string; // 오자일 경우 실제 입력한 글자
}

export function getMarkedText(original: string, result: ScoringResult): MarkedChar[] {
  const origClean = original.replace(/\s+/g, '');
  const marked: MarkedChar[] = [];

  // substitution 위치에서 실제 입력한 글자 찾기
  const subMap = new Map<number, string>();
  for (const sub of result.substitutionChars) {
    subMap.set(sub.position, sub.actual);
  }

  for (let i = 0; i < origClean.length; i++) {
    marked.push({
      char: origClean[i],
      state: result.charStates[i],
      wrongChar: subMap.get(i),
    });
  }

  return marked;
}

// 입력 텍스트에 색상 마킹 (React용 데이터)
export interface TypedMarkedChar {
  char: string;
  state: 'correct' | 'insertion' | 'substitution';
  expectedChar?: string; // 오자일 경우 원래 있어야 할 글자
}

export function getMarkedTypedText(original: string, typed: string): TypedMarkedChar[] {
  const origClean = original.replace(/\s+/g, '');
  const typedClean = typed.replace(/\s+/g, '');

  const dp = computeLCS(origClean, typedClean);
  const diff = backtrackLCS(dp, origClean, typedClean);

  const typedStates: ('correct' | 'insertion' | 'substitution')[] = Array(typedClean.length).fill('correct');
  const expectedMap = new Map<number, string>();

  // diff를 순회하면서 입력 텍스트의 상태 결정
  for (let k = 0; k < diff.length; k++) {
    const curr = diff[k];

    if (curr.type === 'delete') {
      // 다음이 insert면 substitute
      if (k + 1 < diff.length && diff[k + 1].type === 'insert') {
        const next = diff[k + 1];
        typedStates[next.typedIdx!] = 'substitution';
        expectedMap.set(next.typedIdx!, origClean[curr.origIdx!]);
        k++;
      }
    } else if (curr.type === 'insert') {
      typedStates[curr.typedIdx!] = 'insertion';
    }
  }

  const marked: TypedMarkedChar[] = [];
  for (let i = 0; i < typedClean.length; i++) {
    marked.push({
      char: typedClean[i],
      state: typedStates[i],
      expectedChar: expectedMap.get(i),
    });
  }

  return marked;
}

// 탈자 포함 마킹 (아래칸에 탈자도 표시)
export interface FullMarkedChar {
  char: string;
  state: 'correct' | 'insertion' | 'substitution' | 'deletion';
  expectedChar?: string; // 오자일 경우 원래 있어야 할 글자
  origIdx?: number; // 원문에서의 인덱스 (하이라이트용)
}

export function getFullMarkedText(original: string, typed: string): FullMarkedChar[] {
  const origClean = original.replace(/\s+/g, '');
  const typedClean = typed.replace(/\s+/g, '');

  const dp = computeLCS(origClean, typedClean);
  const diff = backtrackLCS(dp, origClean, typedClean);

  const marked: FullMarkedChar[] = [];

  for (let k = 0; k < diff.length; k++) {
    const curr = diff[k];

    if (curr.type === 'match') {
      marked.push({
        char: typedClean[curr.typedIdx!],
        state: 'correct',
        origIdx: curr.origIdx,
      });
    } else if (curr.type === 'delete') {
      // 다음이 insert면 substitute
      if (k + 1 < diff.length && diff[k + 1].type === 'insert') {
        const next = diff[k + 1];
        marked.push({
          char: typedClean[next.typedIdx!],
          state: 'substitution',
          expectedChar: origClean[curr.origIdx!],
          origIdx: curr.origIdx,
        });
        k++;
      } else {
        // 탈자: 원문의 글자를 빨간색으로 표시
        marked.push({
          char: origClean[curr.origIdx!],
          state: 'deletion',
          origIdx: curr.origIdx,
        });
      }
    } else if (curr.type === 'insert') {
      marked.push({
        char: typedClean[curr.typedIdx!],
        state: 'insertion',
        // 첨자는 원문에 대응하는 위치가 없음
      });
    }
  }

  return marked;
}
