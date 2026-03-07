import { generateSentencesStream } from "./utils/generateSentencesAI";

type GenerateSentenceBatchParams = {
  words: string[];
  targetCount: number;
  alreadyGenerated: number;
  batchSize: number;
  apiKey: string;
  style: string;
  selectedModel: string;
  previousSentences?: string[];
  signal: AbortSignal;
  onSentence: (sentence: string, index: number, totalGenerated: number) => void;
  onDone: (totalGenerated: number) => void | Promise<void>;
  onError: (error: string, totalGenerated: number) => void;
  onModel?: (model: string) => void;
};

export async function generateSentenceBatch({
  words,
  targetCount,
  alreadyGenerated,
  batchSize,
  apiKey,
  style,
  selectedModel,
  previousSentences,
  signal,
  onSentence,
  onDone,
  onError,
  onModel,
}: GenerateSentenceBatchParams): Promise<{ totalGenerated: number; skipped: boolean }> {
  let totalGenerated = alreadyGenerated;
  const remaining = targetCount - totalGenerated;

  if (remaining <= 0) {
    return { totalGenerated, skipped: true };
  }

  const batchCount = Math.min(batchSize, remaining);

  await generateSentencesStream(
    words,
    batchCount,
    apiKey,
    style,
    (sentence, index) => {
      totalGenerated += 1;
      onSentence(sentence, index, totalGenerated);
    },
    async () => {
      await onDone(totalGenerated);
    },
    (error) => onError(error, totalGenerated),
    onModel,
    signal,
    selectedModel,
    previousSentences,
  );

  return { totalGenerated, skipped: false };
}
