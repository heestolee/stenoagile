import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

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

  // JSON 배열 시작 "[" 찾기
  const arrStart = text.indexOf("[");
  if (arrStart === -1) return { sentences: [], remaining: text };
  text = text.slice(arrStart + 1);

  // "문장" 패턴을 반복 추출
  while (true) {
    // 다음 문자열 시작 찾기
    const quoteStart = text.indexOf('"');
    if (quoteStart === -1) break;

    // 닫는 따옴표 찾기 (이스케이프 처리)
    let i = quoteStart + 1;
    let found = false;
    while (i < text.length) {
      if (text[i] === '\\') {
        i += 2; // 이스케이프 문자 건너뛰기
        continue;
      }
      if (text[i] === '"') {
        found = true;
        break;
      }
      i++;
    }

    if (!found) break; // 아직 닫는 따옴표가 안 옴

    const sentence = text.slice(quoteStart + 1, i).replace(/\\"/g, '"').replace(/\\n/g, '\n');
    sentences.push(sentence);
    text = text.slice(i + 1);

    // 다음 쉼표 또는 ] 건너뛰기
    const nextComma = text.indexOf(",");
    const nextBracket = text.indexOf("]");
    if (nextBracket !== -1 && (nextComma === -1 || nextBracket < nextComma)) {
      // 배열 끝
      break;
    }
    if (nextComma !== -1) {
      text = text.slice(nextComma + 1);
    }
  }

  return { sentences, remaining: text };
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
            const { words, count, apiKey } = JSON.parse(body) as {
              words: string[];
              count: number;
              apiKey: string;
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

            const prompt = `다음 단어/표현들 중에서 랜덤으로 선택하여 자연스러운 한국어 문장을 ${count}개 만들어주세요.
각 문장은 20~50자 사이로, 실제 뉴스나 일상 대화에서 나올 법한 자연스러운 문장이어야 합니다.
단어/표현 목록에는 명사뿐 아니라 동사, 형용사, 부사, 목적어구, 보어구 등 다양한 품사와 표현이 포함될 수 있습니다.
각 단어/표현을 문맥에 맞게 자연스럽게 활용하세요. 조사나 어미를 적절히 변형해도 됩니다.
단어/표현 목록: ${words.join(", ")}
JSON 배열로만 응답하세요: ["문장1", "문장2", ...]`;

            const requestBody = JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }],
                },
              ],
              generationConfig: {
                maxOutputTokens: 65536,
                thinkingConfig: {
                  thinkingBudget: 0,
                },
              },
            });

            const https = await import("https");
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

            // SSE 헤더 설정
            res.writeHead(200, {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            });

            const apiReq = https.request(
              url,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(requestBody),
                },
              },
              (apiRes) => {
                if (apiRes.statusCode !== 200) {
                  let errData = "";
                  apiRes.on("data", (chunk: Buffer) => { errData += chunk.toString(); });
                  apiRes.on("end", () => {
                    let errorDetail = errData;
                    try {
                      const errBody = JSON.parse(errData) as { error?: { message?: string } };
                      errorDetail = errBody.error?.message || errData;
                    } catch { /* keep raw */ }
                    res.write(`data: ${JSON.stringify({ error: `Gemini API 오류 (${apiRes.statusCode}): ${errorDetail}` })}\n\n`);
                    res.end();
                  });
                  return;
                }

                let accumulated = "";
                let sentSoFar = 0;

                apiRes.on("data", (chunk: Buffer) => {
                  const chunkStr = chunk.toString();
                  // SSE 형식에서 data: 라인 추출
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
                      // 파싱 실패 시 무시 (불완전한 청크)
                    }
                  }

                  // 누적 텍스트에서 새 문장 추출 (count 제한)
                  const { sentences } = extractSentences(accumulated);
                  const limit = Math.min(sentences.length, count);
                  for (let i = sentSoFar; i < limit; i++) {
                    res.write(`data: ${JSON.stringify({ sentence: sentences[i], index: i })}\n\n`);
                  }
                  sentSoFar = sentences.length;
                });

                apiRes.on("end", () => {
                  // 최종 파싱 (남은 문장 처리, count 제한)
                  const { sentences } = extractSentences(accumulated);
                  const limit = Math.min(sentences.length, count);
                  for (let i = sentSoFar; i < limit; i++) {
                    res.write(`data: ${JSON.stringify({ sentence: sentences[i], index: i })}\n\n`);
                  }
                  res.write(`data: ${JSON.stringify({ done: true, total: limit })}\n\n`);
                  res.end();
                });
              }
            );

            apiReq.on("error", (err) => {
              res.write(`data: ${JSON.stringify({ error: `서버 오류: ${String(err)}` })}\n\n`);
              res.end();
            });

            apiReq.write(requestBody);
            apiReq.end();
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
