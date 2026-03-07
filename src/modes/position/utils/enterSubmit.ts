export type PositionTransitionPair = {
  fromChar: string;
  toChar: string;
};

type BuildPositionTransitionPairParams = {
  words: string[];
  currentIndex: number;
};

export function buildPositionTransitionPair(
  params: BuildPositionTransitionPairParams,
): PositionTransitionPair {
  const { words, currentIndex } = params;
  return {
    fromChar: currentIndex > 0 ? words[currentIndex - 1] : "",
    toChar: words[currentIndex] || "",
  };
}
