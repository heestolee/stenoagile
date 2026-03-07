// 긴글모드 전용 Gemini API 스트리밍 유틸
// 문장모드의 generateSentencesStream과 같은 구조, 긴글모드 독립

export async function generateLongTextStream(
  keyword: string,
  length: number,
  apiKey: string,
  style: string,
  onChunk: (text: string) => void,
  onDone: (totalLength: number) => void,
  onError: (error: string) => void,
  onModel?: (model: string) => void,
  signal?: AbortSignal,
  preferredModel?: string,
): Promise<void> {
  const response = await fetch("/api/generate-longtext", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, length, apiKey, style, preferredModel }),
    signal,
  });

  if (!response.ok) {
    const error = (await response.json()) as { error: string };
    throw new Error(error.error || `긴글 생성 실패 (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("스트리밍을 지원하지 않습니다.");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE 이벤트 파싱
    const events = buffer.split("\n\n");
    buffer = events.pop() || ""; // 마지막 불완전한 이벤트는 버퍼에 유지

    for (const event of events) {
      const dataLine = event.trim();
      if (!dataLine.startsWith("data: ")) continue;
      const jsonStr = dataLine.slice(6);
      try {
        const data = JSON.parse(jsonStr) as {
          chunk?: string;
          done?: boolean;
          totalLength?: number;
          error?: string;
          model?: string;
        };
        if (data.error) {
          onError(data.error);
          return;
        }
        if (data.model && onModel) {
          onModel(data.model);
        }
        if (data.chunk !== undefined) {
          onChunk(data.chunk);
        }
        if (data.done && data.totalLength !== undefined) {
          onDone(data.totalLength);
        }
      } catch {
        // 파싱 실패 무시
      }
    }
  }
}
