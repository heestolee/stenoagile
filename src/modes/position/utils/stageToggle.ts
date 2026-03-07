type ResolvePositionStageToggleParams = {
  currentChar: string;
  activeStageExcludedChars: string[];
};

export type PositionStageToggleAction = "add" | "remove" | "none";

export function resolvePositionStageToggleAction(
  params: ResolvePositionStageToggleParams,
): PositionStageToggleAction {
  const { currentChar, activeStageExcludedChars } = params;
  if (!currentChar) return "none";
  return activeStageExcludedChars.includes(currentChar) ? "remove" : "add";
}
