import { HANGUL_CHAR, HANGUL_WORD_2_3, POSITION_RECOMMENDED_SOURCE_WORD_COUNT } from "./constants";
import type { PositionSample, PositionTransitionContextMetric } from "./metrics";

type BuildRecommendedCharsParams = {
  positionSamples: PositionSample[];
  transitionByContext: PositionTransitionContextMetric[];
  dictionaryTexts: string[];
  maxCount: number;
};

export function buildPositionRecommendedChars(params: BuildRecommendedCharsParams): string[] {
  const { positionSamples, transitionByContext, dictionaryTexts, maxCount } = params;

  const dictionaryCandidates = dictionaryTexts
    .flatMap((text) => text.split(/[\s/]+/))
    .map((v) => v.trim())
    .filter((v) => HANGUL_WORD_2_3.test(v));

  const observedWords = positionSamples
    .filter((s) => s.correct && s.fromChar && s.toChar)
    .map((s) => `${s.fromChar}${s.toChar}`)
    .filter((v) => HANGUL_WORD_2_3.test(v));

  const uniqueWords = [...new Set([...observedWords, ...dictionaryCandidates])];

  const weakTransitions = transitionByContext.filter((row) => row.stability !== "fast" && row.count >= 2);
  const unstableSet = new Set(
    weakTransitions.filter((row) => row.stability === "unstable").map((row) => `${row.fromChar}${row.toChar}`),
  );
  const stableSlowSet = new Set(
    weakTransitions.filter((row) => row.stability === "stable_slow").map((row) => `${row.fromChar}${row.toChar}`),
  );

  const scoreWord = (word: string): number => {
    let score = 0;
    for (let i = 0; i < word.length - 1; i++) {
      const pair = word[i] + word[i + 1];
      if (unstableSet.has(pair)) score += 2;
      else if (stableSlowSet.has(pair)) score += 1;
    }
    return score;
  };

  const scored = uniqueWords.map((word) => ({ word, score: scoreWord(word) }));
  scored.sort((a, b) => b.score - a.score);

  const pickedWords: string[] = [];
  for (const { word } of scored) {
    const prev = pickedWords[pickedWords.length - 1];
    const isChained = !!prev && prev[prev.length - 1] === word[0];
    if (!isChained) {
      pickedWords.push(word);
    }
    if (pickedWords.length >= POSITION_RECOMMENDED_SOURCE_WORD_COUNT) break;
  }

  if (pickedWords.length < POSITION_RECOMMENDED_SOURCE_WORD_COUNT) {
    for (const { word } of scored) {
      if (!pickedWords.includes(word)) {
        pickedWords.push(word);
      }
      if (pickedWords.length >= POSITION_RECOMMENDED_SOURCE_WORD_COUNT) break;
    }
  }

  const pickedChars = pickedWords.flatMap((word) => [...word].filter((ch) => HANGUL_CHAR.test(ch)));
  return pickedChars.slice(0, maxCount);
}
