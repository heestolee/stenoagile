type ResultItem = {
  kpm: number;
  cpm: number;
  chars: string;
  mode?: string;
};

type Props = {
  results: ResultItem[];
  rankFontSize: number;
  onReset: () => void;
};

export default function LongtextRankingPanel({ results, rankFontSize, onReset }: Props) {
  const longtextResults = results.filter((r) => r.mode === "longtext");
  const sorted = [...longtextResults].sort((a, b) => b.kpm - a.kpm);
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();

  return (
    <div className="grid grid-cols-1 gap-2 text-sm">
      <button className="ml-auto px-3 py-1 text-xs font-semibold text-red-500 bg-red-50 border border-red-300 rounded hover:bg-red-100 active:bg-red-200 transition-colors" onClick={onReset}>
        초기화
      </button>
      <div className="border rounded p-3 bg-blue-50">
        <div className="font-bold text-blue-600 mb-1 text-base">최고타</div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="py-0.5">
            {top5[i] ? (
              <div className="flex items-baseline gap-2">
                <span className="text-gray-700 whitespace-nowrap"><span className="font-semibold">{top5[i].kpm}</span><span className="text-gray-500">타</span> <span className="font-semibold">{top5[i].cpm}</span><span className="text-gray-500">자</span></span>
                <span className="text-gray-400 break-all" style={{ fontSize: `${rankFontSize}px` }}>{top5[i].chars}</span>
              </div>
            ) : <span className="text-gray-300">-</span>}
          </div>
        ))}
      </div>
      <div className="border rounded p-3 bg-rose-50">
        <div className="font-bold text-rose-600 mb-1 text-base">최저타</div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="py-0.5">
            {bottom5[i] ? (
              <div className="flex items-baseline gap-2">
                <span className="text-gray-700 whitespace-nowrap"><span className="font-semibold">{bottom5[i].kpm}</span><span className="text-gray-500">타</span> <span className="font-semibold">{bottom5[i].cpm}</span><span className="text-gray-500">자</span></span>
                <span className="text-gray-400 break-all" style={{ fontSize: `${rankFontSize}px` }}>{bottom5[i].chars}</span>
              </div>
            ) : <span className="text-gray-300">-</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
