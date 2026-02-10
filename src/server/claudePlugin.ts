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

export function claudePlugin(): Plugin {
  return {
    name: "claude-api-proxy",
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
              model: "claude-haiku-4-5-20251001",
              max_tokens: 2048,
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
            });

            // Use dynamic import for https module
            const https = await import("https");

            const apiResponse = await new Promise<{ status: number; body: string }>((resolve, reject) => {
              const apiReq = https.request(
                "https://api.anthropic.com/v1/messages",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                    "Content-Length": Buffer.byteLength(requestBody),
                  },
                },
                (apiRes) => {
                  let data = "";
                  apiRes.on("data", (chunk: Buffer) => {
                    data += chunk.toString();
                  });
                  apiRes.on("end", () => {
                    resolve({ status: apiRes.statusCode || 500, body: data });
                  });
                }
              );
              apiReq.on("error", reject);
              apiReq.write(requestBody);
              apiReq.end();
            });

            if (apiResponse.status !== 200) {
              res.statusCode = apiResponse.status;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: `Claude API 오류: ${apiResponse.status}`,
                  details: apiResponse.body,
                })
              );
              return;
            }

            const data = JSON.parse(apiResponse.body) as {
              content: { type: string; text: string }[];
            };
            const text = data.content[0]?.text || "[]";

            // JSON 배열 파싱
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({ error: "AI 응답에서 문장을 파싱할 수 없습니다." })
              );
              return;
            }

            const sentences = JSON.parse(jsonMatch[0]) as string[];

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ sentences }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
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
