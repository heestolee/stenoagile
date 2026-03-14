// Netlify Function: /api/generate-sentences
// Vite 개발 서버의 claudePlugin.ts 핸들러를 Web Fetch API 기반으로 변환

// gemini-2.0-flash, gemini-2.0-flash-lite는 2026년 3월 3일 은퇴 → 제거
const GEMINI_MODELS = [
  { id: "gemini-3-flash-preview", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-3.1-flash-lite-preview", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-pro", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash-preview-09-2025", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash-lite", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash-lite-preview-09-2025", supportsThinking: true, maxOutput: 65536 },
];

// 누적 텍스트에서 완성된 문장을 하나씩 추출 — 구두점 기반 파서
// 문장 끝 구두점(.!?。)을 기준으로 분리, 긴 문장은 쉼표로 추가 분리
function extractSentences(accumulated: string): { sentences: string[]; remaining: string } {
  const sentences: string[] = [];
  const pattern = /[^.!?。…\n]+[.!?。…]+/g;

  let lastEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(accumulated)) !== null) {
    const raw = match[0].trim().replace(/\s+([.!?,;:·…])/g, "$1");
    const isMeta = /중략|생략|형식\s*유지|\.{3}\s*\(/.test(raw);
    if (isMeta) {
      lastEnd = match.index + match[0].length;
      continue;
    }
    // 60자 초과 문장은 쉼표 기준으로 추가 분리
    if (raw.length > 60) {
      const parts = raw.split(/,\s*/);
      let buf = "";
      for (const part of parts) {
        const candidate = buf ? buf + ", " + part : part;
        if (candidate.length > 60 && buf.length >= 15) {
          sentences.push(buf);
          buf = part;
        } else {
          buf = candidate;
        }
      }
      if (buf.length >= 15) sentences.push(buf);
    } else if (raw.length >= 15) {
      sentences.push(raw);
    }
    lastEnd = match.index + match[0].length;
  }

  return { sentences, remaining: accumulated.slice(lastEnd) };
}

type TryModelResult =
  | { status: "ok"; response: Response; model: string }
  | { status: "rpm-limited" }
  | { status: "rpd-limited" }
  | { status: "overloaded" }
  | { status: "error"; code: number; message: string };

async function tryGeminiModel(
  modelId: string,
  apiKey: string,
  requestBody: string,
): Promise<TryModelResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    });

    if (response.status === 404) return { status: "rpd-limited" };
    if (response.status === 429) {
      const errData = await response.text();
      const isRpm = errData.includes("minute") || errData.includes("per_minute");
      return isRpm ? { status: "rpm-limited" } : { status: "rpd-limited" };
    }
    if (response.status === 503) return { status: "overloaded" };
    if (response.status !== 200) {
      const errData = await response.text();
      let errorDetail = errData;
      try {
        const errBody = JSON.parse(errData) as { error?: { message?: string } };
        errorDetail = errBody.error?.message ?? errData;
      } catch {
        /* keep raw */
      }
      return { status: "error", code: response.status, message: errorDetail };
    }

    return { status: "ok", response, model: modelId };
  } catch (err) {
    return { status: "error", code: 0, message: String(err) };
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: {
    words: string[];
    count?: number;
    apiKey: string;
    style?: string;
    preferredModel?: string;
    wordsPerSentence?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "잘못된 요청 형식입니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    words,
    apiKey,
    style,
    preferredModel,
    wordsPerSentence,
  } = body;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API 키가 필요합니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isRandomMode = !words || words.length === 0;

  const styleInstruction =
    style === "랜덤 대화체"
      ? "각 문장마다 뉴스/일상, 비즈니스 공문, 학술/논문, 소설/문학, 법률/계약, 의료/건강, IT/기술, 스포츠 중계, 요리/레시피, 여행/관광 등 다양한 대화체를 섞어서. 문장 뒤에 대화체 종류를 표시하지 마세요"
      : `자연스러운 ${style ?? "뉴스/일상 대화체"}로`;

  const perSentence = wordsPerSentence ?? 2;
  const wordInstruction = isRandomMode
    ? "자유로운 주제로 최대한 다양한 단어와 표현을 사용하여"
    : `단어 풀: ${words.join(", ")}\n매 문장마다 위 단어 중 ${perSentence}개를 다르게 골라 자연스럽게 활용하여 (매 문장마다 다른 조합을 선택할 것)`;

  // 프롬프트는 모델 루프 안에서 모델별 targetChars로 생성
  const buildPrompt = (targetChars: string) => `다양한 주제로 한국어 글을 ${targetChars}자 이상 작성하세요.
${wordInstruction}
문체: ${styleInstruction}.

규칙:
- 정치, 경제, 사회, 문화, 과학, 스포츠, 일상, 법률, 의료, 환경 등 다양한 분야를 넘나들며 작성하세요.
- 문장 구조를 다양하게: 평서문, 의문문, 감탄문, 명령문, 조건문 등을 섞으세요.
- 각 문장은 20~60자 내외로 작성하세요.
- 반드시 ${targetChars}자를 채울 때까지 멈추지 마세요.

절대 금지:
- 제목, 소제목, 번호, 목록 기호 등 형식 요소
- "(중략)", "(생략)" 등 축약 표시
- 메타 주석이나 설명

순수 텍스트로만 응답하세요.`;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  let writerClosed = false;

  const writeSSE = async (data: unknown): Promise<void> => {
    if (writerClosed) return;
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  const closeWriter = async (): Promise<void> => {
    if (writerClosed) return;
    writerClosed = true;
    await writer.close();
  };

  // 백그라운드에서 Gemini API 호출 및 스트리밍
  (async () => {
    try {
      let succeeded = false;

      // Netlify 서버리스 환경에서는 lastSuccessModelIndex가 유지되지 않으므로 0부터 시작
      let startIndex = 0;
      if (preferredModel && preferredModel !== "auto") {
        const preferredIdx = GEMINI_MODELS.findIndex((m) => m.id === preferredModel);
        if (preferredIdx !== -1) startIndex = preferredIdx;
      }

      for (let mi = startIndex; mi < GEMINI_MODELS.length; mi++) {
        const model = GEMINI_MODELS[mi];

        // 모델의 maxOutput 토큰 기준으로 목표 글자수 계산
        // 한국어 1토큰 ≈ 2.8자, 85% 여유 적용
        const targetChars = Math.floor(model.maxOutput * 2.8 * 0.85).toLocaleString("ko-KR");
        const prompt = buildPrompt(targetChars);

        const generationConfig: Record<string, unknown> = {
          maxOutputTokens: model.maxOutput,
          temperature: isRandomMode ? 1.5 : 1.4,
        };
        if (model.supportsThinking) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const requestBody = JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        });

        while (true) {
          const result = await tryGeminiModel(model.id, apiKey, requestBody);

          if (
            result.status === "rpm-limited" ||
            result.status === "overloaded" ||
            result.status === "rpd-limited"
          ) {
            break; // 다음 모델로
          }

          if (result.status === "error") {
            await writeSSE({
              error: `Gemini API 오류 (${result.code}): ${result.message}`,
            });
            await closeWriter();
            succeeded = true;
            break;
          }

          // 성공
          await writeSSE({ model: result.model });

          const responseBody = result.response.body;
          if (!responseBody) {
            await writeSSE({ error: "응답 스트림이 없습니다." });
            await closeWriter();
            succeeded = true;
            break;
          }

          const reader = responseBody.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let accumulated = "";
          let sentSoFar = 0;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                try {
                  const parsed = JSON.parse(line.slice(6)) as {
                    candidates?: {
                      content?: { parts?: { text?: string }[] };
                    }[];
                  };
                  const text =
                    parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) accumulated += text;
                } catch {
                  /* 파싱 실패 시 무시 */
                }
              }

              const { sentences } = extractSentences(accumulated);
              for (let i = sentSoFar; i < sentences.length; i++) {
                await writeSSE({ sentence: sentences[i], index: i });
              }
              sentSoFar = sentences.length;
            }

            // 스트림 종료 후 마지막 줄 처리 (줄바꿈 없이 끝난 경우 포함)
            const { sentences } = extractSentences(accumulated + "\n");
            for (let i = sentSoFar; i < sentences.length; i++) {
              await writeSSE({ sentence: sentences[i], index: i });
            }
            await writeSSE({ done: true, total: sentences.length, model: result.model });
          } finally {
            reader.releaseLock();
          }

          await closeWriter();
          succeeded = true;
          break;
        }

        if (succeeded) break;
      }

      if (!succeeded) {
        await writeSSE({
          error:
            "모든 Gemini 모델의 일일 사용량이 초과되었습니다. 내일 다시 시도해주세요.",
        });
        await closeWriter();
      }
    } catch (err) {
      try {
        await writeSSE({ error: String(err) });
        await closeWriter();
      } catch {
        /* already closed */
      }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
