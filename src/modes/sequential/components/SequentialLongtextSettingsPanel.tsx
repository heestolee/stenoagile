import type { Mode } from "../../../types/mode";

type SequentialLongtextSettingsPanelProps = {
  mode: Mode;
  sequentialSpeed: number;
  sequentialSpeechRate: number;
  displayFontSize: number;
  inputFontSize: number;
  charsPerRead: number;
  longTextLength: number;
  batchSize: number;
  isBatchMode: boolean;
  showText: boolean;
  isSoundEnabled: boolean;
  onSaveDefaults: () => void;
  onSequentialSpeedChange: (msPerChar: number) => void;
  onSequentialSpeechRateChange: (rate: number) => void;
  onDisplayFontSizeChange: (size: number) => void;
  onInputFontSizeChange: (size: number) => void;
  onCharsPerReadChange: (count: number) => void;
  onLongTextLengthChange: (len: number) => void;
  onBatchSizeChange: (size: number) => void;
  onToggleShowText: () => void;
  onToggleSound: () => void;
};

export default function SequentialLongtextSettingsPanel({
  mode,
  sequentialSpeed,
  sequentialSpeechRate,
  displayFontSize,
  inputFontSize,
  charsPerRead,
  longTextLength,
  batchSize,
  isBatchMode,
  showText,
  isSoundEnabled,
  onSaveDefaults,
  onSequentialSpeedChange,
  onSequentialSpeechRateChange,
  onDisplayFontSizeChange,
  onInputFontSizeChange,
  onCharsPerReadChange,
  onLongTextLengthChange,
  onBatchSizeChange,
  onToggleShowText,
  onToggleSound,
}: SequentialLongtextSettingsPanelProps) {
  if (!(mode === "sequential" || mode === "longtext")) return null;

  return (
    <div className="space-y-2 border-t pt-2">
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold text-gray-600">상세 설정</div>
        <button className="px-2 py-0.5 rounded text-xs font-medium transition bg-gray-500 text-white hover:bg-gray-600" onClick={onSaveDefaults}>기본값 저장</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1">
          <label className="text-xs whitespace-nowrap">표시속도</label>
          <input type="number" min={30} max={600} step={10} value={Math.round(60000 / sequentialSpeed)} onChange={(e) => {
            const cpm = parseFloat(e.target.value);
            if (!isNaN(cpm) && cpm > 0) onSequentialSpeedChange(Math.round(60000 / cpm));
          }} className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" disabled={isBatchMode} />
          <span className="text-xs text-gray-500">자/분</span>
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs whitespace-nowrap">음성속도</label>
          <input type="number" min={0.1} max={10} step={0.1} value={sequentialSpeechRate.toFixed(1)} onChange={(e) => {
            const rate = parseFloat(e.target.value);
            if (!isNaN(rate) && rate >= 0.1 && rate <= 10) onSequentialSpeechRateChange(rate);
          }} className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <span className="text-xs text-gray-500">배속</span>
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs whitespace-nowrap">위 글자</label>
          <input type="number" min={12} max={48} step={0.1} value={displayFontSize} onChange={(e) => {
            const size = parseFloat(e.target.value);
            if (!isNaN(size) && size >= 12 && size <= 48) onDisplayFontSizeChange(size);
          }} className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <span className="text-xs text-gray-500">px</span>
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs whitespace-nowrap">아래 글자</label>
          <input type="number" min={12} max={48} step={0.1} value={inputFontSize} onChange={(e) => {
            const size = parseFloat(e.target.value);
            if (!isNaN(size) && size >= 12 && size <= 48) onInputFontSizeChange(size);
          }} className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <span className="text-xs text-gray-500">px</span>
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs whitespace-nowrap">읽기단위</label>
          <input type="number" min={1} max={50} step={1} value={charsPerRead} onChange={(e) => {
            const count = parseInt(e.target.value);
            if (!isNaN(count) && count >= 1 && count <= 50) onCharsPerReadChange(count);
          }} className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <span className="text-xs text-gray-500">자</span>
        </div>
        {mode === "longtext" && (
          <div className="flex items-center gap-1">
            <label className="text-xs whitespace-nowrap">긴글길이</label>
            <input type="number" min={100} max={2000} step={50} value={longTextLength} onChange={(e) => {
              const len = parseInt(e.target.value);
              if (!isNaN(len) && len >= 100 && len <= 2000) onLongTextLengthChange(len);
            }} className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <span className="text-xs text-gray-500">자</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <label className="text-xs whitespace-nowrap">매매 치라</label>
          <input type="number" min={1} max={100} step={1} value={batchSize} onChange={(e) => {
            const size = parseInt(e.target.value);
            if (!isNaN(size) && size >= 1 && size <= 100) onBatchSizeChange(size);
          }} className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" disabled={!isBatchMode} />
          <span className="text-xs text-gray-500">자</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button className={`px-2 py-1 rounded text-xs font-medium transition ${showText ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-300 text-gray-700 hover:bg-gray-400"}`} onClick={onToggleShowText}>글자 {showText ? "ON" : "OFF"}</button>
        <button className={`px-2 py-1 rounded text-xs font-medium transition ${isSoundEnabled ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-300 text-gray-700 hover:bg-gray-400"}`} onClick={onToggleSound}>소리 {isSoundEnabled ? "ON" : "OFF"}</button>
      </div>
    </div>
  );
}
