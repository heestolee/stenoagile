const HANGUL_SINGLE_CHAR = /^[가-힣]$/;

export const removeWhitespace = (text: string): string => text.replace(/\s+/g, "");

export const toSingleHangul = (text: string): string => {
  const compact = removeWhitespace(text ?? "");
  if (HANGUL_SINGLE_CHAR.test(compact)) return compact;
  const match = compact.match(/[가-힣]/);
  return match ? match[0] : "";
};
