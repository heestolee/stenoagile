import type { PositionStage } from "../types";

type PositionKeyDef = { id: string; label: string };
type PositionStageOption = { key: PositionStage; label: string; numLabel: string; btnLabel: string };
type PositionKeyMetric = { avgMs: number };

type Props = {
  isPracticing: boolean;
  positionEnabledStages: PositionStage[];
  setPositionEnabledStages: (stages: PositionStage[]) => void;
  switchPositionStageImmediately: (stage: PositionStage) => void;
  activeSingleStage: PositionStage | null;
  positionStageOptions: PositionStageOption[];
  currentWordIndex: number;
  shuffledWords: string[];
  displayFontSize: number;
  showPositionKeyboard: boolean;
  hoveredPositionKeyId: string | null;
  setHoveredPositionKeyId: (id: string | null) => void;
  hoveredTransitionKeyIds: Set<string>;
  positionPerKeyMap: Map<string, PositionKeyMetric>;
  positionLeftRows: PositionKeyDef[][];
  positionRightRows: PositionKeyDef[][];
  positionThumbRow: PositionKeyDef[];
};

const keyItemClass = (
  hoveredPositionKeyId: string | null,
  hoveredTransitionKeyIds: Set<string>,
  keyId: string
) =>
  `h-14 rounded-xl border flex flex-col items-center justify-center bg-white border-gray-300 cursor-pointer transition-all duration-150 ${
    hoveredPositionKeyId === keyId
      ? "bg-gray-900 text-white border-black ring-4 ring-gray-300 shadow-lg scale-105"
      : hoveredTransitionKeyIds.has(keyId)
        ? "bg-rose-500 text-white border-rose-700 ring-2 ring-rose-200 shadow"
        : "text-gray-800"
  }`;

export default function PositionPracticePanel({
  isPracticing,
  positionEnabledStages,
  setPositionEnabledStages,
  switchPositionStageImmediately,
  activeSingleStage,
  positionStageOptions,
  currentWordIndex,
  shuffledWords,
  displayFontSize,
  showPositionKeyboard,
  hoveredPositionKeyId,
  setHoveredPositionKeyId,
  hoveredTransitionKeyIds,
  positionPerKeyMap,
  positionLeftRows,
  positionRightRows,
  positionThumbRow,
}: Props) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-gradient-to-b from-amber-50 to-amber-100 p-4">
      <div className="mb-2 flex justify-start">
        <button
          onClick={() => {
            const allStageKeys = positionStageOptions.map((s) => s.key);
            const isAllSelected = allStageKeys.every((k) => positionEnabledStages.includes(k));
            setPositionEnabledStages(isAllSelected ? [positionStageOptions[0].key] : allStageKeys);
          }}
          className="px-2 py-1 rounded border text-xs bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        >
          단계 전체선택
        </button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!activeSingleStage && <span className="text-[11px] text-gray-500">단계 1개 선택 시 사용 가능</span>}
      </div>
      <div className="grid grid-cols-5 md:grid-cols-10 gap-1 mb-4 max-w-[920px] mx-auto">
        {positionStageOptions.map(({ key, label, numLabel, btnLabel }) => {
          const enabled = positionEnabledStages.includes(key);
          return (
            <button
              key={key}
              onClick={() => {
                if (isPracticing) {
                  switchPositionStageImmediately(key);
                  return;
                }
                if (enabled && positionEnabledStages.length === 1) return;
                setPositionEnabledStages(
                  enabled ? positionEnabledStages.filter((k) => k !== key) : [...positionEnabledStages, key]
                );
              }}
              className={`h-9 rounded border text-[10px] leading-tight font-semibold text-center ${
                enabled ? "bg-emerald-600 text-white border-emerald-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              title={label}
            >
              <div>{numLabel}</div>
              <div>{btnLabel}</div>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-10 gap-1.5 max-w-[920px] mx-auto mb-4">
        {Array.from({ length: 30 }, (_, offset) => offset).map((offset) => {
          const pageStart = Math.floor(currentWordIndex / 30) * 30;
          const idx = pageStart + offset;
          const char = idx >= 0 && idx < shuffledWords.length ? shuffledWords[idx] : "-";
          const isCurrent = idx === currentWordIndex;
          return (
            <div
              key={`position-line-${offset}`}
              className={`h-9 rounded-lg border flex items-center justify-center font-semibold ${
                isCurrent ? "bg-rose-100 border-rose-300 text-rose-700" : "bg-white/80 border-amber-200 text-gray-500"
              }`}
              style={{ fontSize: `${Math.max(18, Math.round(displayFontSize))}px` }}
            >
              {char}
            </div>
          );
        })}
      </div>
      {showPositionKeyboard && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[700px] mx-auto">
            {[positionLeftRows, positionRightRows].map((rows, sideIdx) => (
              <div key={`position-side-${sideIdx}`} className="rounded-2xl bg-white/70 border border-amber-200 p-3">
                {rows.map((row, rowIdx) => (
                  <div key={`position-side-${sideIdx}-row-${rowIdx}`} className="grid grid-cols-5 gap-2 mb-2 last:mb-0">
                    {row.map((keyDef, colIdx) => (
                      <div
                        key={`position-key-${sideIdx}-${rowIdx}-${colIdx}`}
                        className={keyItemClass(hoveredPositionKeyId, hoveredTransitionKeyIds, keyDef.id)}
                        onMouseEnter={() => setHoveredPositionKeyId(keyDef.id)}
                        onMouseLeave={() => setHoveredPositionKeyId(null)}
                      >
                        <div className="text-lg font-semibold leading-none" style={{ color: "#000000", textShadow: "none" }}>
                          {keyDef.label}
                        </div>
                        <div className="text-[10px] leading-tight mt-1 text-black" style={{ textShadow: "none" }}>
                          {(() => {
                            const m = positionPerKeyMap.get(keyDef.id);
                            return m != null ? `${m.avgMs}ms` : "-";
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="max-w-[360px] mx-auto mt-4 rounded-2xl bg-white/70 border border-amber-200 p-3">
            <div className="grid grid-cols-6 gap-2">
              {positionThumbRow.map((keyDef, idx) => (
                <div
                  key={`position-thumb-${idx}`}
                  className={keyItemClass(hoveredPositionKeyId, hoveredTransitionKeyIds, keyDef.id)}
                  onMouseEnter={() => setHoveredPositionKeyId(keyDef.id)}
                  onMouseLeave={() => setHoveredPositionKeyId(null)}
                >
                  <div className="text-lg font-semibold leading-none" style={{ color: "#000000", textShadow: "none" }}>
                    {keyDef.label}
                  </div>
                  <div className="text-[10px] leading-tight mt-1 text-black" style={{ textShadow: "none" }}>
                    {(() => {
                      const m = positionPerKeyMap.get(keyDef.id);
                      return m != null ? `${m.avgMs}ms` : "-";
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
