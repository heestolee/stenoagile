type ShouldBlockEnterSubmissionParams = {
  mode: string;
  isPracticing: boolean;
  typedWord: string;
  minLength?: number;
};

export function shouldBlockEnterSubmission(
  params: ShouldBlockEnterSubmissionParams,
): boolean {
  const { mode, isPracticing, typedWord, minLength = 5 } = params;
  if (!isPracticing) return false;
  if (mode !== "sentences" && mode !== "longtext") return false;
  return typedWord.trim().length < minLength;
}
