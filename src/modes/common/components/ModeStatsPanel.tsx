type ModeStatsKey = "sequential" | "batch" | "longtext" | "words" | "sentences" | "position";

const MODE_LABELS: Array<[ModeStatsKey, string]> = [
  ["sequential", "보고치라"],
  ["batch", "매매치라"],
  ["longtext", "긴글"],
  ["words", "단어"],
  ["sentences", "문장"],
  ["position", "자리"],
];

type Props = {
  showModeStats: boolean;
  todayCompletedRounds: number;
  modeCompletedRounds: Record<string, number>;
  setShowModeStats: (updater: (prev: boolean) => boolean) => void;
  resetModeCompletedRounds: (key: ModeStatsKey) => void;
};

export default function ModeStatsPanel({
  showModeStats,
  todayCompletedRounds,
  modeCompletedRounds,
  setShowModeStats,
  resetModeCompletedRounds,
}: Props) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-end gap-2">
      <div>
        {showModeStats && (
          <div className="mb-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-sm min-w-[150px]">
            <div className="font-semibold text-gray-700 mb-2 border-b pb-1">오늘의 완료 현황</div>
            {MODE_LABELS.map(([key, label]) => (
              <div key={key} className="flex justify-between items-center py-0.5 gap-3">
                <span className="text-gray-600">{label}</span>
                <span className="flex items-center gap-1">
                  <span className="font-semibold text-gray-800">
                    {modeCompletedRounds[key] || 0}
                    {key === "words" ? "단어" : key === "sentences" ? "문장" : "회"}
                  </span>
                  <button
                    onClick={() => resetModeCompletedRounds(key)}
                    className="text-red-400 hover:text-red-600 text-xs ml-1"
                    title={`${label} 초기화`}
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowModeStats((prev) => !prev)}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg text-lg"
          title="모드별 완료 현황"
        >
          {todayCompletedRounds}
        </button>
      </div>
    </div>
  );
}
