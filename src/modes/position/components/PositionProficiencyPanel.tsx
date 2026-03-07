import type { PositionStage } from "../types";
import {
  POSITION_KEY_LABEL,
  POSITION_OVERALL_SAMPLE_LIMIT,
  POSITION_STAGE_OPTIONS,
  getPositionGroupColorClass,
  getPositionRoleColorClass,
} from "../constants";
import type { PositionMetrics } from "../metrics";

type StageMetric = {
  stage: PositionStage | "mixed";
  avgMs: number;
  fastRate: number;
  count: number;
};

type Props = {
  hoveredPositionKeyId: string | null;
  stagePositionMetrics: StageMetric[];
  positionMetrics: PositionMetrics;
  overallStagePositionMetrics: StageMetric[];
  overallPositionMetrics: PositionMetrics;
  overallPositionSampleCount: number;
  activeSingleStage: PositionStage | null;
  activeStageExcludedChars: string[];
  onClearToday: () => void;
  onIncludeInOverall: () => void;
  onClearOverall: () => void;
  onRemoveExcludedChar: (stage: PositionStage, char: string) => void;
};

export default function PositionProficiencyPanel({
  hoveredPositionKeyId,
  stagePositionMetrics,
  positionMetrics,
  overallStagePositionMetrics,
  overallPositionMetrics,
  overallPositionSampleCount,
  activeSingleStage,
  activeStageExcludedChars,
  onClearToday,
  onIncludeInOverall,
  onClearOverall,
  onRemoveExcludedChar,
}: Props) {
  return (
    <div className="mt-2">
      <div className="border rounded p-4 bg-white space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">오늘의 숙련도</h3>
          <button
            onClick={onClearToday}
            className="text-xs px-3 py-1.5 rounded border text-red-600 border-red-300 hover:bg-red-50"
          >
            초기화
          </button>
          <button
            onClick={onIncludeInOverall}
            className="text-xs px-3 py-1.5 rounded border text-indigo-600 border-indigo-300 hover:bg-indigo-50"
            title={`전체 숙련도는 최근 ${POSITION_OVERALL_SAMPLE_LIMIT}개까지만 보관합니다.`}
          >
            전체에 포함
          </button>
        </div>
        {hoveredPositionKeyId && (
          <div className="text-xs text-amber-700">
            선택 키: <span className="font-semibold">{POSITION_KEY_LABEL[hoveredPositionKeyId] || hoveredPositionKeyId}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded border ${getPositionRoleColorClass("initial")}`}>초성 (왼손)</span>
          <span className={`px-2 py-0.5 rounded border ${getPositionRoleColorClass("vowel_left_thumb")}`}>중성 (양엄지)</span>
          <span className={`px-2 py-0.5 rounded border ${getPositionRoleColorClass("final")}`}>종성 (오른손)</span>
        </div>
        <div className="text-xs text-gray-600">
          위 키 배열에서 키를 hover하면 느린 전환 키가 노란색으로 강조됩니다.
        </div>
        <div className="grid grid-cols-3 gap-3 items-start">
          <div className="space-y-3">
            <div className="border rounded bg-gray-50 p-2">
              <div className="text-sm font-semibold mb-1">단계별 숙련도</div>
              {stagePositionMetrics.length === 0 ? (
                <div className="text-xs text-gray-500">데이터 없음</div>
              ) : (
                <div className="space-y-1">
                  {stagePositionMetrics.map((row) => (
                    <div key={`stage-position-metric-${row.stage}`} className="text-xs flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {row.stage === "mixed"
                          ? "복합선택"
                          : (POSITION_STAGE_OPTIONS.find((v) => v.key === row.stage)?.label ?? row.stage)}
                      </span>
                      <span className="text-gray-600">{row.avgMs}ms | 빠른 {row.fastRate}% | {row.count}회</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold mb-1">동시 조합별 약점</div>
              <div className="max-h-80 overflow-y-auto border rounded">
                {positionMetrics.perTransitionByContext.length === 0 ? (
                  <div className="p-2 text-xs text-gray-400">데이터 없음</div>
                ) : (
                  positionMetrics.perTransitionByContext.slice(0, 80).map((row) => (
                    <div
                      key={row.id}
                      className={`px-2 py-1 text-xs border-b last:border-b-0 transition ${
                        !hoveredPositionKeyId
                          ? ""
                          : (row.fromKeys.includes(hoveredPositionKeyId) || row.toKeys.includes(hoveredPositionKeyId))
                            ? "bg-amber-100"
                            : "opacity-40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded border ${getPositionGroupColorClass(row.group)}`}>{row.fromUnit}</span>
                          <span className="text-gray-400">→</span>
                          <span className={`px-1.5 py-0.5 rounded border ${getPositionGroupColorClass(row.group)}`}>{row.toUnit}</span>
                        </span>
                        <span className="text-gray-600 flex items-center gap-1">
                          {row.stability === "unstable" && <span className="px-1 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700 border border-amber-300">불안정</span>}
                          {row.stability === "stable_slow" && <span className="px-1 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 border border-blue-300">느림</span>}
                          평균 {row.avgMs}ms ±{row.stdDev} | 빠른 {row.fastRate}% | {row.count}회
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        글자: {row.fromChar || "-"} → {row.toChar || "-"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-sm font-semibold">전체 숙련도</div>
              <span className="text-xs text-gray-500">{overallPositionSampleCount}개</span>
              <button
                onClick={onClearOverall}
                className="text-xs px-2 py-0.5 rounded border text-red-600 border-red-300 hover:bg-red-50"
              >
                초기화
              </button>
            </div>
            <div className="border rounded bg-gray-50 p-2">
              <div className="text-sm font-semibold mb-1">단계별 숙련도</div>
              {overallStagePositionMetrics.length === 0 ? (
                <div className="text-xs text-gray-500">데이터 없음</div>
              ) : (
                <div className="space-y-1">
                  {overallStagePositionMetrics.map((row) => (
                    <div key={`overall-stage-position-metric-${row.stage}`} className="text-xs flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {row.stage === "mixed"
                          ? "복합선택"
                          : (POSITION_STAGE_OPTIONS.find((v) => v.key === row.stage)?.label ?? row.stage)}
                      </span>
                      <span className="text-gray-600">{row.avgMs}ms | 빠른 {row.fastRate}% | {row.count}회</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold mb-1">동시 조합별 약점</div>
              <div className="max-h-80 overflow-y-auto border rounded">
                {overallPositionMetrics.perTransitionByContext.length === 0 ? (
                  <div className="p-2 text-xs text-gray-400">데이터 없음</div>
                ) : (
                  overallPositionMetrics.perTransitionByContext.slice(0, 80).map((row) => (
                    <div
                      key={row.id}
                      className="px-2 py-1 text-xs border-b last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded border ${getPositionGroupColorClass(row.group)}`}>{row.fromUnit}</span>
                          <span className="text-gray-400">→</span>
                          <span className={`px-1.5 py-0.5 rounded border ${getPositionGroupColorClass(row.group)}`}>{row.toUnit}</span>
                        </span>
                        <span className="text-gray-600 flex items-center gap-1">
                          {row.stability === "unstable" && <span className="px-1 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700 border border-amber-300">불안정</span>}
                          {row.stability === "stable_slow" && <span className="px-1 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 border border-blue-300">느림</span>}
                          평균 {row.avgMs}ms ±{row.stdDev} | 빠른 {row.fastRate}% | {row.count}회
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        글자: {row.fromChar || "-"} → {row.toChar || "-"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div>
            <div className="border rounded bg-gray-50 p-2">
              <div className="text-sm font-semibold mb-1">제외목록</div>
              {activeSingleStage ? (
                <>
                  <div className="text-xs text-gray-600 mb-1">
                    현재 단계: {POSITION_STAGE_OPTIONS.find((v) => v.key === activeSingleStage)?.label ?? activeSingleStage}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {activeStageExcludedChars.length > 0 ? (
                      activeStageExcludedChars.map((char) => (
                        <button
                          key={`excluded-panel-char-${activeSingleStage}-${char}`}
                          onClick={() => onRemoveExcludedChar(activeSingleStage, char)}
                          className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm"
                          title="클릭하면 제외 해제"
                        >
                          {char}
                        </button>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">현재 단계 제외 글자 없음</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">단계 1개를 선택하면 해당 단계 제외목록이 표시됩니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

