import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

// Gemini 무료 모델 목록 (성능 좋은 순서, RPD 소진 시 다음 모델로 자동 폴백)
const GEMINI_MODELS = [
  { id: "gemini-3-flash-preview", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash-preview-09-2025", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash-lite", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.5-flash-lite-preview-09-2025", supportsThinking: true, maxOutput: 65536 },
  { id: "gemini-2.0-flash", supportsThinking: false, maxOutput: 8192 },
  { id: "gemini-2.0-flash-lite", supportsThinking: false, maxOutput: 8192 },
];

// 마지막으로 성공한 모델 인덱스 기억
let lastSuccessModelIndex = 0;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

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
      if (text[i] === '\\') {
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

    const raw = text.slice(quoteStart + 1, i).replace(/\\"/g, '"').replace(/\\n/g, '\n');
    // 번호추적 프롬프트의 "1. ", "23. " 등 접두어 제거
    const sentence = raw.replace(/^\d+\.\s*/, '');
    sentences.push(sentence);
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
  | { status: "ok"; response: IncomingMessage; model: string }
  | { status: "rpm-limited" }
  | { status: "rpd-limited" }
  | { status: "overloaded" }
  | { status: "error"; code: number; message: string };

function tryGeminiModel(
  httpsModule: typeof import("https"),
  modelId: string,
  apiKey: string,
  requestBody: string,
): Promise<TryModelResult> {
  return new Promise((resolve) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const apiReq = httpsModule.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
        },
      },
      (apiRes) => {
        if (apiRes.statusCode === 404) {
          apiRes.resume();
          resolve({ status: "rpd-limited" });
          return;
        }
        if (apiRes.statusCode === 429) {
          // 429 응답 본문을 읽어서 RPM인지 RPD인지 구분
          let errData = "";
          apiRes.on("data", (chunk: Buffer) => { errData += chunk.toString(); });
          apiRes.on("end", () => {
            const isRpm = errData.includes("minute") || errData.includes("per_minute");
            resolve(isRpm ? { status: "rpm-limited" } : { status: "rpd-limited" });
          });
          return;
        }
        if (apiRes.statusCode === 503) {
          apiRes.resume();
          resolve({ status: "overloaded" });
          return;
        }
        if (apiRes.statusCode !== 200) {
          let errData = "";
          apiRes.on("data", (chunk: Buffer) => { errData += chunk.toString(); });
          apiRes.on("end", () => {
            let errorDetail = errData;
            try {
              const errBody = JSON.parse(errData) as { error?: { message?: string } };
              errorDetail = errBody.error?.message || errData;
            } catch { /* keep raw */ }
            resolve({ status: "error", code: apiRes.statusCode!, message: errorDetail });
          });
          return;
        }
        resolve({ status: "ok", response: apiRes, model: modelId });
      }
    );
    apiReq.on("error", (err) => {
      resolve({ status: "error", code: 0, message: String(err) });
    });
    apiReq.write(requestBody);
    apiReq.end();
  });
}

function writeSSEHeaders(res: ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
}

export function claudePlugin(): Plugin {
  return {
    name: "gemini-api-proxy",
    configureServer(server) {
      server.middlewares.use(
        "/api/generate-sentences",
        async (
          req: IncomingMessage,
          res: ServerResponse,
        ) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }

          const body = await readBody(req);

          try {
            const { words, count, apiKey, style } = JSON.parse(body) as {
              words: string[];
              count: number;
              apiKey: string;
              style?: string;
            };

            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "API 키가 필요합니다." }));
              return;
            }

            if (!words || words.length === 0) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "단어 목록이 필요합니다." }));
              return;
            }

            const styleInstruction = style === "랜덤 대화체"
              ? "각 문장마다 뉴스/일상, 비즈니스 공문, 학술/논문, 소설/문학, 법률/계약, 의료/건강, IT/기술, 스포츠 중계, 요리/레시피, 여행/관광 등 다양한 대화체를 섞어서. 문장 뒤에 대화체 종류를 표시하지 마세요"
              : `자연스러운 ${style || "뉴스/일상 대화체"}로`;

            const prompt = `정확히 ${count}개의 한국어 문장을 생성하세요.
단어 목록: ${words.join(", ")}
각 문장 20~50자, ${styleInstruction}.

중요: 각 문장 앞에 번호를 붙여서 진행 상황을 추적하세요.
형식: ["1. 문장내용", "2. 문장내용", ..., "${count}. 문장내용"]
${count}번까지 반드시 전부 작성하세요. 번호가 ${count}이 될 때까지 절대 멈추지 마세요.
JSON 배열로만 응답하세요.`;

            const https = await import("https");

            let succeeded = false;
            let headersSent = false;

            for (let mi = lastSuccessModelIndex; mi < GEMINI_MODELS.length; mi++) {
              const model = GEMINI_MODELS[mi];
              const generationConfig: Record<string, unknown> = {
                maxOutputTokens: model.maxOutput,
              };
              if (model.supportsThinking) {
                generationConfig.thinkingConfig = { thinkingBudget: 0 };
              }

              const requestBody = JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig,
              });

              while (true) {
                const result = await tryGeminiModel(https, model.id, apiKey, requestBody);

                if (result.status === "rpm-limited") {
                  break; // 다음 모델로
                }

                if (result.status === "overloaded") {
                  break; // 다음 모델로
                }

                if (result.status === "rpd-limited") {
                  break; // 다음 모델로
                }

                if (result.status === "error") {
                  if (!headersSent) {
                    writeSSEHeaders(res);
                    headersSent = true;
                  }
                  res.write(`data: ${JSON.stringify({ error: `Gemini API 오류 (${result.code}): ${result.message}` })}\n\n`);
                  res.end();
                  succeeded = true;
                  break;
                }

                // 성공 — 이 모델 기억
                lastSuccessModelIndex = mi;
                const apiRes = result.response;

                if (!headersSent) {
                  writeSSEHeaders(res);
                  headersSent = true;
                }

                res.write(`data: ${JSON.stringify({ model: result.model })}\n\n`);

                let accumulated = "";
                let sentSoFar = 0;

                await new Promise<void>((streamResolve) => {
                  apiRes.on("data", (chunk: Buffer) => {
                    const chunkStr = chunk.toString();
                    const lines = chunkStr.split("\n");
                    for (const line of lines) {
                      if (!line.startsWith("data: ")) continue;
                      const jsonStr = line.slice(6);
                      try {
                        const parsed = JSON.parse(jsonStr) as {
                          candidates?: { content?: { parts?: { text?: string }[] } }[];
                        };
                        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                          accumulated += text;
                        }
                      } catch {
                        // 파싱 실패 시 무시
                      }
                    }

                    const { sentences } = extractSentences(accumulated);
                    const limit = Math.min(sentences.length, count);
                    for (let i = sentSoFar; i < limit; i++) {
                      res.write(`data: ${JSON.stringify({ sentence: sentences[i], index: i })}\n\n`);
                    }
                    sentSoFar = sentences.length;
                  });

                  apiRes.on("end", () => {
                    const { sentences } = extractSentences(accumulated);
                    const limit = Math.min(sentences.length, count);
                    for (let i = sentSoFar; i < limit; i++) {
                      res.write(`data: ${JSON.stringify({ sentence: sentences[i], index: i })}\n\n`);
                    }
                    res.write(`data: ${JSON.stringify({ done: true, total: limit, model: result.model })}\n\n`);
                    res.end();
                    streamResolve();
                  });

                  apiRes.on("error", () => {
                    res.end();
                    streamResolve();
                  });
                });

                succeeded = true;
                break;
              }

              if (succeeded) break;
            }

            if (!succeeded) {
              if (!headersSent) {
                writeSSEHeaders(res);
              }
              res.write(`data: ${JSON.stringify({ error: "모든 Gemini 모델의 일일 사용량이 초과되었습니다. 내일 다시 시도해주세요." })}\n\n`);
              res.end();
            }
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "서버 오류가 발생했습니다.",
                details: String(err),
              })
            );
          }
        }
      );
    },
  };
}
