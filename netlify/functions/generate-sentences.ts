// Netlify Function: /api/generate-sentences
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

// 누적 텍스트에서 완성된 문장을 하나씩 추출
function extractSentences(accumulated: string): { sentences: string[]; remaining: string } {
  const sentences: string[] = [];
  let text = accumulated;

  const arrStart = text.indexOf("[");
  if (arrStart === -1) return { sentences: [], remaining: text };
  text = text.slice(arrStart + 1);

  while (true) {
    const quoteStart = text.indexOf('"');
    if (quoteStart === -1) break;

    let i = quoteStart + 1;
    let found = false;
    while (i < text.length) {
      if (text[i] === "\\") {
        i += 2;
        continue;
      }
      if (text[i] === '"') {
        found = true;
        break;
      }
      i++;
    }

    if (!found) break;

    const raw = text
      .slice(quoteStart + 1, i)
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n");
    const sentence = raw
      .replace(/^\d+\.\s*/, "")
      .replace(/\s+([.!?,;:·…])/g, "$1");
    const isMeta = /중략|생략|형식\s*유지|\.{3}\s*\(/.test(sentence);
    if (sentence.trim().length > 0 && !isMeta) sentences.push(sentence);
    text = text.slice(i + 1);

    const nextComma = text.indexOf(",");
    const nextBracket = text.indexOf("]");
    if (nextBracket !== -1 && (nextComma === -1 || nextBracket < nextComma)) {
      break;
    }
    if (nextComma !== -1) {
      text = text.slice(nextComma + 1);
    }
  }

  return { sentences, remaining: text };
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
    count: number;
    apiKey: string;
    style?: string;
    preferredModel?: string;
    previousSentences?: string[];
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
    count,
    apiKey,
    style,
    preferredModel,
    previousSentences,
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

  let avoidInstruction = "";
  if (previousSentences && previousSentences.length > 0) {
    const recentSentences = previousSentences.slice(-100);
    avoidInstruction = `\n\n[절대 무시하지 마세요 - 중복 방지 목록]\n아래는 이전에 생성된 ${recentSentences.length}개의 문장입니다. 이 목록이 아무리 길어도 반드시 전부 확인하고, 아래 문장과 비슷한 문장, 같은 주제, 같은 문장 구조, 같은 단어 조합을 절대 반복하지 마세요. 완전히 새로운 주제, 새로운 구조, 새로운 어휘로 작성하세요:\n${recentSentences.map((s) => `- ${s}`).join("\n")}`;
  }

  const prompt = `정확히 ${count}개의 한국어 문장을 생성하세요.
${wordInstruction}
각 문장 20~50자, ${styleInstruction}.

다양성 규칙 (매우 중요):
- 문장 구조를 매번 바꾸세요: 평서문, 의문문, 감탄문, 명령문, 인용문, 조건문 등을 섞으세요.
- 주어-서술어 패턴을 반복하지 마세요. 주어 생략, 도치, 피동/사동, 접속문, 부사구 시작 등 다양한 구조를 사용하세요.
- 같은 어미(-습니다, -했다, -한다 등)가 연속으로 반복되지 않게 하세요.
- 문장의 분위기와 톤도 다양하게: 설명, 묘사, 감정, 사실 전달, 비유, 대화 등을 섞으세요.
- 같은 단어나 표현이 반복되지 않도록 하세요.
- 이 배치 안에서도 문장끼리 비슷하면 안 됩니다. 각 문장은 앞에 나온 문장과 주제·구조·어휘가 모두 달라야 합니다.
- 문장의 첫 어절과 마지막 서술어가 다른 문장과 겹치지 않게 하세요.${avoidInstruction}

절대 금지 (위반 시 실패):
- "...", "(중략)", "(생략)", "(형식 유지)", "(이하 생략)" 등 어떤 생략/축약 표시도 쓰지 마세요.
- 중간에 멈추거나 요약하거나 건너뛰지 마세요.
- 메타 주석이나 설명을 문장 안에 넣지 마세요.

중요: 각 문장 앞에 번호를 붙여서 진행 상황을 추적하세요.
형식: ["1. 문장내용", "2. 문장내용", ..., "${count}. 문장내용"]
반드시 1번부터 ${count}번까지 실제 문장 ${count}개를 전부 작성하세요. ${count}번이 될 때까지 절대 멈추지 마세요.
JSON 배열로만 응답하세요.`;

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
              const limit = Math.min(sentences.length, count);
              for (let i = sentSoFar; i < limit; i++) {
                await writeSSE({ sentence: sentences[i], index: i });
              }
              sentSoFar = sentences.length;
            }

            // 스트림 종료 후 최종 확인
            const { sentences } = extractSentences(accumulated);
            const limit = Math.min(sentences.length, count);
            for (let i = sentSoFar; i < limit; i++) {
              await writeSSE({ sentence: sentences[i], index: i });
            }
            await writeSSE({ done: true, total: limit, model: result.model });
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
