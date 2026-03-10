import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";

type ModeStatsKey = "sequential" | "batch" | "longtext" | "words" | "sentences" | "position";

const MODE_STATS_LABELS: Array<[ModeStatsKey, string]> = [
  ["sequential", "보고치라"],
  ["batch", "매매치라"],
  ["longtext", "긴글"],
  ["words", "단어"],
  ["sentences", "문장"],
  ["position", "자리"],
];

type DailyCompletion = {
  date: string;
  total: number;
  mode_counts: Record<string, number>;
};

type ModeStatsFabProps = {
  showModeStats: boolean;
  todayCompletedRounds: number;
  modeCompletedRounds: Record<string, number>;
  onToggle: () => void;
  onResetMode: (key: ModeStatsKey) => void;
  user: User | null;
};

export default function ModeStatsFab({
  showModeStats,
  todayCompletedRounds,
  modeCompletedRounds,
  onToggle,
  onResetMode,
  user,
}: ModeStatsFabProps) {
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");
  const [history, setHistory] = useState<DailyCompletion[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (!showModeStats || activeTab !== "history") return;
    if (user) {
      // 로그인: Supabase에서 전체 기록 조회
      setIsLoadingHistory(true);
      supabase
        .from("daily_completions")
        .select("date, total, mode_counts")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .then(({ data }) => {
          setHistory((data as DailyCompletion[]) ?? []);
          setIsLoadingHistory(false);
        });
    } else {
      // 비로그인: localStorage에서 읽기
      try {
        const raw = localStorage.getItem("completedRoundsHistory");
        const history: DailyCompletion[] = raw ? (JSON.parse(raw) as DailyCompletion[]) : [];
        // completedRounds(오늘 데이터)도 병합
        const todayRaw = localStorage.getItem("completedRounds");
        if (todayRaw) {
          const today = JSON.parse(todayRaw) as { date: string; count: number; modeCounts?: Record<string, number> };
          if (today.date && today.count > 0) {
            const already = history.some((r) => r.date === today.date);
            if (!already) {
              history.unshift({ date: today.date, total: today.count, mode_counts: today.modeCounts ?? {} });
            }
          }
        }
        setHistory(history);
      } catch {
        setHistory([]);
      }
    }
  }, [showModeStats, activeTab, user]);

  // 월별 그룹핑
  const grouped = history.reduce<Record<string, DailyCompletion[]>>((acc, record) => {
    const [year, month] = record.date.split("-");
    const key = `${year}년 ${parseInt(month)}월`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(record);
    return acc;
  }, {});

  const formatDate = (dateStr: string) => {
    const [, month, day] = dateStr.split("-");
    return `${parseInt(month)}월 ${parseInt(day)}일`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="relative">
        {showModeStats && (
          <div className="absolute bottom-12 right-0 bg-white border border-gray-300 rounded-lg shadow-lg text-sm w-52">
            {/* 탭 */}
            <div className="flex border-b">
              <button
                className={`flex-1 py-1.5 text-xs font-medium transition ${activeTab === "today" ? "text-blue-600 border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-700"}`}
                onClick={() => setActiveTab("today")}
              >
                오늘
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-medium transition ${activeTab === "history" ? "text-blue-600 border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-700"}`}
                onClick={() => setActiveTab("history")}
              >
                기록
              </button>
            </div>

            {/* 오늘 탭 */}
            {activeTab === "today" && (
              <div className="p-3">
                <div className="font-semibold text-gray-700 mb-2 border-b pb-1">오늘의 완료 현황</div>
                {MODE_STATS_LABELS.map(([key, label]) => (
                  <div key={key} className="flex justify-between items-center py-0.5 gap-3">
                    <span className="text-gray-600">{label}</span>
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-gray-800">
                        {modeCompletedRounds[key] || 0}
                        {key === "words" ? "단어" : key === "sentences" ? "문장" : "회"}
                      </span>
                      <button
                        onClick={() => onResetMode(key)}
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

            {/* 기록 탭 */}
            {activeTab === "history" && (
              <div className="max-h-80 overflow-y-auto p-3">
                {isLoadingHistory && (
                  <p className="text-xs text-gray-500 text-center py-4">불러오는 중...</p>
                )}
                {!isLoadingHistory && history.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">기록이 없습니다.</p>
                )}
                {!isLoadingHistory && Object.entries(grouped).map(([monthLabel, records]) => (
                  <div key={monthLabel} className="mb-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">{monthLabel}</div>
                    {records.map((r) => (
                      <div key={r.date} className="mb-1.5 border-b pb-1.5 last:border-0">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">{formatDate(r.date)}</span>
                          <span className="text-gray-500 text-xs">총 {r.total}회</span>
                        </div>
                        <div className="flex flex-wrap gap-x-2 mt-0.5">
                          {MODE_STATS_LABELS.filter(([k]) => (r.mode_counts[k] || 0) > 0).map(([k, label]) => (
                            <span key={k} className="text-xs text-gray-500">
                              {label} {r.mode_counts[k]}{k === "words" ? "단어" : k === "sentences" ? "문장" : "회"}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          onClick={onToggle}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg text-lg"
          title="모드별 완료 현황"
        >
          {todayCompletedRounds}
        </button>
      </div>
    </div>
  );
}
