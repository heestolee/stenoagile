# 스테노사우루스 (Stenoagile) - Claude Code 작업 규칙

## 프로젝트 개요
- 속기 타이핑 연습 웹앱 (React + TypeScript + Vite)
- 개발 서버: `npx vite --port 5173`

## 핵심 원칙 (Boris Cherny 방법론 적용)

### 1. 스스로 확인하라
- 작업 완료 후 반드시 자체 검증을 수행할 것
- 간단한 작업: 코드가 문법적으로 맞는지, 기존 로직과 충돌 없는지 직접 확인
- 복잡한 작업: 변경된 파일을 다시 읽어서 의도대로 반영됐는지 검증
- "완료했습니다"라고 하기 전에 반드시 결과물을 재확인할 것
- 확인 없이 완료 선언 금지

### 2. 계획 먼저 세우기 (절대 규칙)
- **모든 작업은 반드시 플랜을 먼저 짜서 유저에게 보여줄 것**
- 유저가 추가사항을 넣을 수 있도록 기다릴 것
- **유저가 "시작해"라고 명시적으로 허락하기 전까지 절대 코드 수정/작업 시작 금지**
- 코드 수정 전에: 현재 코드 분석 → 문제점 파악 → 계획 출력 → 유저 승인 → 실행
- 설계 없이 바로 코딩 금지
- 막힐 때도 계획 모드로 돌아가서 재정리

### 3. 복리 학습
- 실수가 발생하면 MEMORY.md에 기록하여 같은 실수 반복 방지
- 패턴이 확인되면 즉시 메모에 반영
- 잘못된 메모는 발견 즉시 수정/삭제

## 작업 규칙

### 모드 격리 (절대 규칙)
- **유저가 언급한 모드에서만 작업할 것** — 다른 모드에 영향 주는 변경 절대 금지
- 모드 구조:
  - 보고치라: `mode="sequential"`, `isBatchMode=false`
  - 매매치라: `mode="sequential"`, `isBatchMode=true`
  - 긴글: `mode="longtext"`
  - 랜덤: `mode="random"`

### Git 규칙
- **절대 main에 직접 푸시하지 말 것** — 반드시 브랜치 만들어서 PR로 올리기
- 커밋 전에 변경사항 다시 확인
- 의도하지 않은 파일이 포함되지 않았는지 검증

### 코드 품질
- 변경 전 기존 코드를 반드시 먼저 읽을 것
- 수정 후 해당 파일을 다시 읽어서 올바르게 반영됐는지 확인
- 한 번에 너무 많은 변경을 하지 말 것 — 작은 단위로 나눠서 진행
- 기존 패턴과 컨벤션을 따를 것

### 매매치라 완료 조건
- `isBatchReviewDone` 플래그로 제어 (복습 5/5 완료 시에만 true)
- 배치 진행 중(1/n~n/n) + 복습 중(1/5~4/5) → 재개
- 복습 5/5 완료 → 다음 라운드

## 다음 작업: 긴글모드 Gemini 랜덤 생성

### 개요
긴글모드에서 "랜덤 생성" 버튼 → 랜덤 키워드 선택 → Gemini API로 긴글 생성 → 연습
문장모드의 Gemini 생성 방식(모델 폴백, SSE 스트리밍, AbortController, 에러 처리)을 그대로 적용

### 이전 작업 완료 (삭제됨)
- RSS/위키백과/수집스크립트 관련 코드 전부 삭제 완료
- `scripts/`, `src/constants/longTexts.ts`, `src/utils/customLongTexts.ts` 삭제됨
- TypingPractice.tsx에서 랜덤긴글 관련 state/UI/import 전부 삭제됨
- `longTextLength` 설정만 유지됨

### 1. 서버 (`src/server/claudePlugin.ts`)
- `/api/generate-longtext` 엔드포인트 추가
- 기존 `tryGeminiModel` + 모델 폴백 루프 재활용
- 요청: `{ keyword, length, apiKey, preferredModel }`
- 프롬프트: "{keyword}" 주제로 {length}자 내외 한국어 글 (뉴스/논설문/보도자료/연설문/판결문/회의록 중 랜덤 문체)
- 응답 SSE: `{"chunk":"텍스트"}` → `{"done":true,"totalLength":N}`
- `extractSentences()` 불필요 (순수 텍스트), 청크 그대로 전달
- `thinkingBudget: 0` (속도 우선)

### 2. 클라이언트 유틸 (`src/utils/generateLongTextAI.ts`)
- 새 파일, `generateSentencesStream`과 같은 구조
- `generateLongTextStream(keyword, length, apiKey, onChunk, onDone, onError, onModel, signal, preferredModel)`
- `/api/generate-longtext` POST → SSE 파싱

### 3. 키워드 풀 (`src/constants/longTextKeywords.ts`)
- 새 파일, 카테고리별 키워드 배열
- 12개 카테고리 (정치/경제/사회/과학IT/문화/법률/의료/환경/국제/스포츠/역사/교육)
- 카테고리당 8~15개, 총 100~150개

### 4. UI (`src/components/TypingPractice.tsx`)
- state 추가: `isGeneratingLongText`, `generatingKeyword`, `generatedLongText`, `generateLongTextAbortRef`
- "연습 시작" 옆에 "랜덤 생성" 버튼 (긴글모드만)
- 클릭 → 랜덤 키워드 → Gemini API → 텍스트를 입력칸에 세팅
- 생성 중: "생성 중... (키워드)" + 클릭하면 중단 (AbortController)
- 에러: `useAIGeneration`의 `getErrorMessage`/`setGenerateErrorWithRetry` 재활용
- 모델 표시: `[gemini-3-flash]` 작은 텍스트
- `longTextLength`를 생성 길이로 전달

### 문장모드에서 가져올 패턴
- 모델 폴백 (7개 모델 순차 시도)
- SSE 스트리밍 (청크 단위 UI 갱신)
- AbortController (생성 중 중단)
- 에러 처리 (한글 에러 + RPM 카운트다운)
- API 호출 카운트 (incrementApiCallCount)
- 모델 선택 UI (auto/gemini-3-flash/...)
- thinking 비활성화 (thinkingBudget: 0)

### 파일 변경 목록
| 파일 | 작업 |
|------|------|
| `src/server/claudePlugin.ts` | `/api/generate-longtext` 엔드포인트 추가 |
| `src/utils/generateLongTextAI.ts` | 새 파일 — API 호출 + SSE 파싱 |
| `src/constants/longTextKeywords.ts` | 새 파일 — 키워드 풀 |
| `src/components/TypingPractice.tsx` | state 4개 + 랜덤 생성 버튼 + 로딩/에러 UI |

### 영향 범위
- 긴글모드(`mode === "longtext"`) 안에서만 동작, 다른 모드 영향 없음

---

## 자체 검증 체크리스트
작업 완료 전 반드시 확인:
1. 변경한 파일을 다시 읽어서 의도대로 수정됐는지 확인
2. 다른 모드에 영향을 주는 변경이 없는지 확인
3. TypeScript 타입 오류가 없는지 확인
4. 기존 기능이 깨지지 않았는지 확인
