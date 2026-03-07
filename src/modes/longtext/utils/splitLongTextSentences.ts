export function splitLongTextSentences(rawText: string): string[] {
  const sentenceSplit = rawText
    .split(/(?<=[.!?．。])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentenceSplit.length <= 1 && rawText.includes("\n")) {
    return rawText
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return sentenceSplit;
}
