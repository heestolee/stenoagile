// Netlify Function: /api/generate-longtext
// Vite 개발 서버의 claudePlugin.ts 핸들러를 Web Fetch API 기반으로 변환

const GEMINI_MODELS = [
  { id: "gemini-3-flash-preview", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash-preview-09-2025", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash-lite", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash-lite-preview-09-2025", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.0-flash", supportsThinking: false, maxOutput: 8192 },
  { id: "gemini-2.0-flash-lite", supportsThinking: false, maxOutput: 8192 },
];

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
    keyword: string;
    length: number;
    apiKey: string;
    style?: string;
    preferredModel?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "잘못된 요청 형식입니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { keyword, length, apiKey, style, preferredModel } = body;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API 키가 필요합니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const fallbackStyles = ["뉴스 기사", "논설문", "보도자료", "연설문", "판결문", "회의록"];
  const resolvedStyle =
    !style || style === "자유 문체"
      ? fallbackStyles[Math.floor(Math.random() * fallbackStyles.length)]
      : style
          .replace(/문체$/, "")
          .replace(/체$/, "")
          .trim();

  const prompt = `"${keyword}" 주제로 ${length}자 내외의 한국어 글을 작성하세요.

문체: ${resolvedStyle}
규칙:
- 자연스러운 한국어로 작성하세요.
- 문장과 문장 사이에 적절한 구두점을 사용하세요.
- 글의 흐름이 자연스럽고 논리적이어야 합니다.
- 다양한 문장 구조와 어휘를 사용하세요.
- ${length}자에 최대한 가깝게 작성하세요.
- JSON이나 배열 형식이 아닌, 순수 텍스트로만 응답하세요.
- 제목이나 부제목 없이 본문만 작성하세요.`;

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
        const generationConfig: Record<string, unknown> = {
          maxOutputTokens: model.maxOutput,
          temperature: 1.2,
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
                  if (text) {
                    accumulated += text;
                    // 긴글모드: extractSentences 불필요, 청크 그대로 전달
                    await writeSSE({ chunk: text });
                  }
                } catch {
                  /* 파싱 실패 시 무시 */
                }
              }
            }

            await writeSSE({ done: true, totalLength: accumulated.length });
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
