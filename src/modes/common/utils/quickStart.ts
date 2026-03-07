type SelectQuickStartSlotParams = {
  favoriteSlots: number[];
  selectedSlot: number | null;
  loadSlotText: (slot: number) => string | null;
  slotCount?: number;
  randomFn?: () => number;
};

export type QuickStartSelection = {
  slot: number;
  text: string;
};

export function splitPracticeWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

export function selectQuickStartSlot(params: SelectQuickStartSlotParams): QuickStartSelection | null {
  const {
    favoriteSlots,
    selectedSlot,
    loadSlotText,
    slotCount = 20,
    randomFn = Math.random,
  } = params;

  const targetSlots = favoriteSlots.length > 0
    ? favoriteSlots
    : Array.from({ length: slotCount }, (_, i) => i + 1);

  const candidates: QuickStartSelection[] = [];
  for (const slot of targetSlots) {
    if (slot === selectedSlot) continue;
    const text = loadSlotText(slot);
    if (text && text.trim().length > 0) {
      candidates.push({ slot, text });
    }
  }

  if (candidates.length === 0) return null;
  const pickIndex = Math.floor(randomFn() * candidates.length);
  return candidates[pickIndex] ?? null;
}
