type SlotGridProps = {
  selectedSlot: number | null;
  slotNames: Record<number, string>;
  favoriteSlots: Set<number>;
  onLoadPreset: (slot: number) => void;
  onToggleFavorite: (slot: number) => void;
  onRenameSlot: (slot: number) => void;
};

export default function SlotGrid({
  selectedSlot,
  slotNames,
  favoriteSlots,
  onLoadPreset,
  onToggleFavorite,
  onRenameSlot,
}: SlotGridProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => {
          const name = slotNames[num] || `${num}`;
          const len = name.length;
          const fontSize = len <= 3 ? "text-sm" : len <= 6 ? "text-xs" : "text-[10px]";
          return (
            <button
              key={num}
              className={`h-8 rounded relative overflow-hidden ${fontSize} leading-tight ${
                selectedSlot === num
                  ? "bg-blue-500 text-white"
                  : favoriteSlots.has(num)
                    ? "bg-yellow-100 hover:bg-yellow-200 ring-1 ring-yellow-400"
                    : "bg-gray-200 hover:bg-gray-300"
              }`}
              onClick={(e) => {
                if (e.shiftKey) {
                  onToggleFavorite(num);
                } else {
                  onLoadPreset(num);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onRenameSlot(num);
              }}
              title="클릭: 불러오기 | Shift+클릭: 즐겨찾기 | 우클릭: 이름 변경"
            >
              {favoriteSlots.has(num) && <span className="absolute -top-1 -right-1 text-xs">⭐</span>}
              <span className="block w-full text-center truncate px-1">{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
