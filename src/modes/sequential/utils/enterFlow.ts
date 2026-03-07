export type SequentialRoundCompleteAction =
  | { kind: "resume" }
  | { kind: "next" }
  | { kind: "next_with_slot"; slot: number };

type ResolveSequentialEnterActionParams = {
  isBatchMode: boolean;
  isBatchReviewDone: boolean;
  isFullyComplete: boolean;
  typedWord: string;
};

export function parseSlotNumberFromInput(
  input: string,
  min = 1,
  max = 20,
): number | null {
  const slot = parseInt(input.trim(), 10);
  if (!Number.isFinite(slot)) return null;
  if (slot < min || slot > max) return null;
  return slot;
}

export function resolveSequentialRoundCompleteAction(
  params: ResolveSequentialEnterActionParams,
): SequentialRoundCompleteAction {
  const { isBatchMode, isBatchReviewDone, isFullyComplete, typedWord } = params;

  if (isBatchMode) {
    if (!isBatchReviewDone) return { kind: "resume" };
    const slot = parseSlotNumberFromInput(typedWord);
    if (slot !== null) return { kind: "next_with_slot", slot };
    return { kind: "next" };
  }

  if (isFullyComplete) return { kind: "next" };
  return { kind: "resume" };
}
