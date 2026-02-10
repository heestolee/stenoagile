export async function generateSentencesAI(
  words: string[],
  count: number,
  apiKey: string
): Promise<string[]> {
  const response = await fetch("/api/generate-sentences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words, count, apiKey }),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error: string; details?: string };
    throw new Error(error.error || "문장 생성에 실패했습니다.");
  }

  const data = (await response.json()) as { sentences: string[] };
  return data.sentences;
}
