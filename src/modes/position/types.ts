export type PositionDifficulty =
  | "initial_mid"
  | "final_mid"
  | "initial_bottom"
  | "final_bottom"
  | "initial_top"
  | "final_top"
  | "double_consonant"
  | "compound_vowel_1"
  | "compound_vowel_2"
  | "complex_final"
  | "random";

export type PositionStage = Exclude<PositionDifficulty, "random">;
