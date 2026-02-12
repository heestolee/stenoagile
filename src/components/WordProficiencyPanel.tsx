import { useEffect, useState } from "react";
import type { WordProficiency } from "../utils/indexedDB";

type Level = "master" | "learning" | "weak" | "new";
type SortKey = "accuracy" | "attempts";
type Filter = "all" | "weak" | "learning" | "master";
type Tab = "today" | "overall";

function getLevel(p: WordProficiency): Level {
  const total = p.correctCount + p.incorrectCount;
  if (total === 0) return "new";
  const accuracy = p.correctCount / total;
  if (accuracy >= 0.9 && total >= 5) return "master";
  if (accuracy >= 0.6) return "learning";
  return "weak";
}

function getLevelLabel(level: Level): string {
  switch (level) {
    case "master": return "마스터";
    case "learning": return "학습중";
    case "weak": return "미숙";
    case "new": return "신규";
  }
}

function getLevelColor(level: Level): string {
  switch (level) {
    case "master": return "text-green-600";
    case "learning": return "text-yellow-600";
    case "weak": return "text-red-600";
    case "new": return "text-gray-400";
  }
}

function getLevelBg(level: Level): string {
  switch (level) {
    case "master": return "bg-green-50 border-green-200";
    case "learning": return "bg-yellow-50 border-yellow-200";
    case "weak": return "bg-red-50 border-red-200";
    case "new": return "bg-gray-50 border-gray-200";
  }
}

interface Props {
  todayProficiencies: WordProficiency[];
  overallProficiencies: WordProficiency[];
  onRefreshToday: () => void;
  onRefreshOverall: () => void;
  onClearToday: () => void;
  onClearOverall: () => void;
  onMergeToOverall: () => void;
  onClose: () => void;
}

function ProficiencyList({ data, sortKey, filter }: { data: WordProficiency[]; sortKey: SortKey; filter: Filter }) {
  const filtered = data.filter((p) => {
    if (filter === "all") return true;
    return getLevel(p) === filter;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "accuracy") {
      const totalA = a.correctCount + a.incorrectCount;
      const totalB = b.correctCount + b.incorrectCount;
      const accA = totalA > 0 ? a.correctCount / totalA : -1;
      const accB = totalB > 0 ? b.correctCount / totalB : -1;
      return accA - accB;
    }
    return (b.correctCount + b.incorrectCount) - (a.correctCount + a.incorrectCount);
  });

  if (sorted.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">데이터가 없습니다</p>;
  }

  return (
    <>
      {sorted.map((p) => {
        const level = getLevel(p);
        const total = p.correctCount + p.incorrectCount;
        const accuracy = total > 0 ? Math.round((p.correctCount / total) * 100) : 0;
        return (
          <div
            key={p.word}
            className={`flex items-center justify-between px-3 py-1.5 rounded border text-sm ${getLevelBg(level)}`}
          >
            <span className="font-medium truncate mr-2">{p.word}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-bold ${getLevelColor(level)}`}>
                {getLevelLabel(level)}
              </span>
              <span className="text-xs text-gray-500">
                {accuracy}% ({p.correctCount}/{total})
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function WordProficiencyPanel({
  todayProficiencies, overallProficiencies,
  onRefreshToday, onRefreshOverall,
  onClearToday, onClearOverall,
  onMergeToOverall, onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("today");
  const [sortKey, setSortKey] = useState<SortKey>("accuracy");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    onRefreshToday();
    onRefreshOverall();
  }, []);

  const currentData = tab === "today" ? todayProficiencies : overallProficiencies;

  const counts = {
    all: currentData.length,
    master: currentData.filter((p) => getLevel(p) === "master").length,
    learning: currentData.filter((p) => getLevel(p) === "learning").length,
    weak: currentData.filter((p) => getLevel(p) === "weak").length,
  };

  return (
    <div className="border rounded p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">단어 숙련도</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => { setTab("today"); setFilter("all"); }}
          className={`px-3 py-1.5 text-sm rounded-t border-b-2 font-medium ${
            tab === "today" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          오늘의 숙련도 ({todayProficiencies.length})
        </button>
        <button
          onClick={() => { setTab("overall"); setFilter("all"); onRefreshOverall(); }}
          className={`px-3 py-1.5 text-sm rounded-t border-b-2 font-medium ${
            tab === "overall" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          전체 숙련도 ({overallProficiencies.length})
        </button>
      </div>

      {/* 필터 버튼 */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {([
          ["all", `전체 (${counts.all})`],
          ["weak", `미숙 (${counts.weak})`],
          ["learning", `학습중 (${counts.learning})`],
          ["master", `마스터 (${counts.master})`],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-2 py-1 text-xs rounded border ${
              filter === key ? "bg-blue-500 text-white border-blue-500" : "bg-white border-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 정렬 */}
      <div className="flex gap-2 mb-3 items-center">
        <span className="text-xs text-gray-500">정렬:</span>
        <button
          onClick={() => setSortKey("accuracy")}
          className={`text-xs px-2 py-0.5 rounded ${sortKey === "accuracy" ? "bg-gray-200 font-bold" : ""}`}
        >
          정확도순
        </button>
        <button
          onClick={() => setSortKey("attempts")}
          className={`text-xs px-2 py-0.5 rounded ${sortKey === "attempts" ? "bg-gray-200 font-bold" : ""}`}
        >
          시도횟수순
        </button>
      </div>

      {/* 목록 */}
      <div className="max-h-[400px] overflow-y-auto space-y-1">
        <ProficiencyList data={currentData} sortKey={sortKey} filter={filter} />
      </div>

      {/* 하단 버튼 */}
      <div className="flex items-center justify-between mt-3">
        {tab === "today" ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (todayProficiencies.length === 0) return;
                if (window.confirm("오늘의 숙련도를 전체 숙련도에 포함시키겠습니까?\n포함 후 오늘의 숙련도는 초기화됩니다.")) {
                  onMergeToOverall();
                }
              }}
              className={`text-xs px-3 py-1.5 rounded border font-medium ${
                todayProficiencies.length > 0
                  ? "bg-green-500 text-white border-green-500 hover:bg-green-600"
                  : "bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed"
              }`}
            >
              전체 숙련도에 포함
            </button>
            <button
              onClick={() => {
                if (window.confirm("오늘의 숙련도를 초기화하시겠습니까?")) {
                  onClearToday();
                }
              }}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              초기화
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              if (window.confirm("전체 숙련도를 모두 삭제하시겠습니까?")) {
                onClearOverall();
              }
            }}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            전체 초기화
          </button>
        )}
      </div>
    </div>
  );
}
