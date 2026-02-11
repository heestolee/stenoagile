export async function generateSentencesStream(
  words: string[],
  count: number,
  apiKey: string,
  onSentence: (sentence: string, index: number) => void,
  onDone: (total: number) => void,
  onError: (error: string) => void,
): Promise<void> {
  const response = await fetch("/api/generate-sentences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words, count, apiKey }),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error: string };
    throw new Error(error.error || `문장 생성 실패 (${response.status})`);
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
          sentence?: string;
          index?: number;
          done?: boolean;
          total?: number;
          error?: string;
        };
        if (data.error) {
          onError(data.error);
          return;
        }
        if (data.sentence !== undefined && data.index !== undefined) {
          onSentence(data.sentence, data.index);
        }
        if (data.done && data.total !== undefined) {
          onDone(data.total);
        }
      } catch {
        // 파싱 실패 무시
      }
    }
  }
}
