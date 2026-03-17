import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

// Gemini 무료 모델 목록 (성능 좋은 순서, RPD 소진 시 다음 모델로 자동 폴백)
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

// 누적 텍스트에서 완성된 문장을 하나씩 추출 — 구두점 기반 파서
// 문장 끝 구두점(.!?。)을 기준으로 분리, 긴 문장은 쉼표로 추가 분리
function extractSentences(accumulated: string, minLen = 15, maxLen = 60): { sentences: string[]; remaining: string } {
  const sentences: string[] = [];
  const pattern = /[^.!?。…\n]+[.!?。…]+/g;

  let lastEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(accumulated)) !== null) {
    const raw = match[0].trim().replace(/\s+([.!?,;:·…])/g, '$1');
    const isMeta = /중략|생략|형식\s*유지|\.{3}\s*\(/.test(raw);
    if (isMeta) {
      lastEnd = match.index + match[0].length;
      continue;
    }
    // maxLen 초과 문장은 쉼표 기준으로 추가 분리
    if (raw.length > maxLen) {
      const parts = raw.split(/,\s*/);
      let buf = "";
      for (const part of parts) {
        const candidate = buf ? buf + ", " + part : part;
        if (candidate.length > maxLen && buf.length >= minLen) {
          sentences.push(buf);
          buf = part;
        } else {
          buf = candidate;
        }
      }
      if (buf.length >= minLen) sentences.push(buf);
    } else if (raw.length >= minLen) {
      sentences.push(raw);
    }
    lastEnd = match.index + match[0].length;
  }

  return { sentences, remaining: accumulated.slice(lastEnd) };
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
            const { words, apiKey, style, preferredModel, wordsPerSentence, sentenceMinLength, sentenceMaxLength } = JSON.parse(body) as {
              words: string[];
              count?: number;
              apiKey: string;
              style?: string;
              preferredModel?: string;
              wordsPerSentence?: number;
              sentenceMinLength?: number;
              sentenceMaxLength?: number;
            };

            const minLen = sentenceMinLength ?? 15;
            const maxLen = sentenceMaxLength ?? 60;

            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "API 키가 필요합니다." }));
              return;
            }

            const isRandomMode = !words || words.length === 0;

            const styleInstruction = style === "랜덤 대화체"
              ? "각 문장마다 뉴스/일상, 비즈니스 공문, 학술/논문, 소설/문학, 법률/계약, 의료/건강, IT/기술, 스포츠 중계, 요리/레시피, 여행/관광 등 다양한 대화체를 섞어서. 문장 뒤에 대화체 종류를 표시하지 마세요"
              : `자연스러운 ${style || "뉴스/일상 대화체"}로`;

            const perSentence = wordsPerSentence ?? 2;
            const wordInstruction = isRandomMode
              ? "자유로운 주제로 최대한 다양한 단어와 표현을 사용하여"
              : `단어 풀: ${words.join(", ")}\n매 문장마다 위 단어 중 ${perSentence}개를 다르게 골라 자연스럽게 활용하여 (매 문장마다 다른 조합을 선택할 것)`;

            const https = await import("https");

            let succeeded = false;
            let headersSent = false;

            // preferredModel이 지정되면 해당 모델부터 시작
            let startIndex = lastSuccessModelIndex;
            if (preferredModel && preferredModel !== "auto") {
              const preferredIdx = GEMINI_MODELS.findIndex(m => m.id === preferredModel);
              if (preferredIdx !== -1) startIndex = preferredIdx;
            }

            for (let mi = startIndex; mi < GEMINI_MODELS.length; mi++) {
              const model = GEMINI_MODELS[mi];

              // 모델의 maxOutput 토큰 기준으로 목표 글자수 계산
              // 한국어 1토큰 ≈ 2.8자, 85% 여유 적용
              const targetChars = Math.floor(model.maxOutput * 2.8 * 0.85).toLocaleString("ko-KR");

              const prompt = `다양한 주제로 한국어 글을 ${targetChars}자 이상 작성하세요.
${wordInstruction}
문체: ${styleInstruction}.

규칙:
- 정치, 경제, 사회, 문화, 과학, 스포츠, 일상, 법률, 의료, 환경 등 다양한 분야를 넘나들며 작성하세요.
- 문장 구조를 다양하게: 평서문, 의문문, 감탄문, 명령문, 조건문 등을 섞으세요.
- 각 문장은 ${minLen}~${maxLen}자 내외로 작성하세요.
- 반드시 ${targetChars}자를 채울 때까지 멈추지 마세요.

절대 금지:
- 제목, 소제목, 번호, 목록 기호 등 형식 요소
- "(중략)", "(생략)" 등 축약 표시
- 메타 주석이나 설명

순수 텍스트로만 응답하세요.`;

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

                    const { sentences } = extractSentences(accumulated, minLen, maxLen);
                    for (let i = sentSoFar; i < sentences.length; i++) {
                      res.write(`data: ${JSON.stringify({ sentence: sentences[i], index: i })}\n\n`);
                    }
                    sentSoFar = sentences.length;
                  });

                  apiRes.on("end", () => {
                    // 마지막 줄 — 줄바꿈 없이 끝난 경우 남은 텍스트도 처리
                    const { sentences } = extractSentences(accumulated + "\n", minLen, maxLen);
                    for (let i = sentSoFar; i < sentences.length; i++) {
                      res.write(`data: ${JSON.stringify({ sentence: sentences[i], index: i })}\n\n`);
                    }
                    res.write(`data: ${JSON.stringify({ done: true, total: sentences.length, model: result.model })}\n\n`);
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

      // 긴글모드 랜덤 생성 엔드포인트
      server.middlewares.use(
        "/api/generate-longtext",
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
            const { keyword, length, apiKey, style, preferredModel } = JSON.parse(body) as {
              keyword: string;
              length: number;
              apiKey: string;
              style?: string;
              preferredModel?: string;
            };

            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "API 키가 필요합니다." }));
              return;
            }

            // 문체: 클라이언트에서 지정하지 않거나 "자유 문체"이면 랜덤 선택
            const fallbackStyles = ["뉴스 기사", "논설문", "보도자료", "연설문", "판결문", "회의록"];
            const resolvedStyle = (!style || style === "자유 문체")
              ? fallbackStyles[Math.floor(Math.random() * fallbackStyles.length)]
              : style.replace(/문체$/, "").replace(/체$/, "").trim();

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

            const https = await import("https");

            let succeeded = false;
            let headersSent = false;

            // preferredModel이 지정되면 해당 모델부터 시작
            let startIndex = lastSuccessModelIndex;
            if (preferredModel && preferredModel !== "auto") {
              const preferredIdx = GEMINI_MODELS.findIndex(m => m.id === preferredModel);
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
                          // 긴글모드: extractSentences 불필요, 청크 그대로 전달
                          res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
                        }
                      } catch {
                        // 파싱 실패 시 무시
                      }
                    }
                  });

                  apiRes.on("end", () => {
                    res.write(`data: ${JSON.stringify({ done: true, totalLength: accumulated.length })}\n\n`);
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
