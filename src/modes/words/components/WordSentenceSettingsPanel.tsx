import type { Mode } from "../../../types/mode";

type WordSentenceSettingsPanelProps = {
  mode: Mode;
  isWordLikeMode: boolean;
  isPositionMode: boolean;
  speechRate: number;
  displayFontSize: number;
  rankFontSize: number;
  showText: boolean;
  isSoundEnabled: boolean;
  showPositionKeyboard: boolean;
  geminiApiKey: string;
  apiCallCount: number;
  apiCallModels: Record<string, number>;
  generateError: string | null;
  geminiModelNames: readonly string[];
  onSaveSentenceDefaults: () => void;
  onSaveWordDefaults: () => void;
  onSavePositionDefaults: () => void;
  onSpeechRateChange: (rate: number) => void;
  onDisplayFontSizeChange: (size: number) => void;
  onRankFontSizeChange: (size: number) => void;
  onToggleShowText: () => void;
  onToggleSound: () => void;
  onTogglePositionKeyboard: () => void;
  onGeminiApiKeyChange: (apiKey: string) => void;
};

export default function WordSentenceSettingsPanel({
  mode,
  isWordLikeMode,
  isPositionMode,
  speechRate,
  displayFontSize,
  rankFontSize,
  showText,
  isSoundEnabled,
  showPositionKeyboard,
  geminiApiKey,
  apiCallCount,
  apiCallModels,
  generateError,
  geminiModelNames,
  onSaveSentenceDefaults,
  onSaveWordDefaults,
  onSavePositionDefaults,
  onSpeechRateChange,
  onDisplayFontSizeChange,
  onRankFontSizeChange,
  onToggleShowText,
  onToggleSound,
  onTogglePositionKeyboard,
  onGeminiApiKeyChange,
}: WordSentenceSettingsPanelProps) {
  if (!(isWordLikeMode || mode === "sentences")) return null;

  return (
    <div className="space-y-2 border-t pt-2">
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold text-gray-600">상세 설정</div>
        {mode === "sentences" && (
          <button className="px-2 py-0.5 rounded text-xs font-medium transition bg-gray-500 text-white hover:bg-gray-600" onClick={onSaveSentenceDefaults}>
            기본값 저장
          </button>
        )}
        {isWordLikeMode && !isPositionMode && (
          <button className="px-2 py-0.5 rounded text-xs font-medium transition bg-gray-500 text-white hover:bg-gray-600" onClick={onSaveWordDefaults}>
            기본값 저장
          </button>
        )}
        {isPositionMode && (
          <button className="px-2 py-0.5 rounded text-xs font-medium transition bg-gray-500 text-white hover:bg-gray-600" onClick={onSavePositionDefaults}>
            기본값 저장
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1">
          <label className="text-xs whitespace-nowrap">음성속도</label>
          <input type="number" min={0.1} max={10} step={0.1} value={speechRate.toFixed(1)} onChange={(e) => {
            const rate = parseFloat(e.target.value);
            if (!isNaN(rate) && rate >= 0.1 && rate <= 10) onSpeechRateChange(rate);
          }} className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <span className="text-xs text-gray-500">배속</span>
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs whitespace-nowrap">표시 글자</label>
          <input type="number" min={12} max={48} step={0.1} value={displayFontSize} onChange={(e) => {
            const size = parseFloat(e.target.value);
            if (!isNaN(size) && size >= 12 && size <= 48) onDisplayFontSizeChange(size);
          }} className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <span className="text-xs text-gray-500">px</span>
        </div>
        {mode === "sentences" && (
          <div className="flex items-center gap-1">
            <label className="text-xs whitespace-nowrap">순위 글자</label>
            <input type="number" min={8} max={32} step={0.5} value={rankFontSize} onChange={(e) => {
              const size = parseFloat(e.target.value);
              if (!isNaN(size) && size >= 8 && size <= 32) onRankFontSizeChange(size);
            }} className="w-14 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <span className="text-xs text-gray-500">px</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button className={`px-2 py-1 rounded text-xs font-medium transition ${showText ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-300 text-gray-700 hover:bg-gray-400"}`} onClick={onToggleShowText}>글자 {showText ? "ON" : "OFF"}</button>
        <button className={`px-2 py-1 rounded text-xs font-medium transition ${isSoundEnabled ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-300 text-gray-700 hover:bg-gray-400"}`} onClick={onToggleSound}>소리 {isSoundEnabled ? "ON" : "OFF"}</button>
        {isPositionMode && (
          <button className={`px-2 py-1 rounded text-xs font-medium transition ${showPositionKeyboard ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-300 text-gray-700 hover:bg-gray-400"}`} onClick={onTogglePositionKeyboard}>키보드 {showPositionKeyboard ? "ON" : "OFF"}</button>
        )}
      </div>

      {mode === "sentences" && (
        <>
          <div className="flex items-center gap-1">
            <label className="text-xs whitespace-nowrap">API 키</label>
            <input type="password" className="flex-1 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="AIza..." value={geminiApiKey} onChange={(e) => onGeminiApiKeyChange(e.target.value)} />
          </div>
          {!geminiApiKey && <p className="text-xs text-red-500">문장 모드를 사용하려면 API 키를 입력해 주세요.</p>}
          {geminiApiKey && (
            <div className="text-xs text-gray-500">
              <p>오늘 API 호출: {apiCallCount}회 (매일 17:00 리셋)</p>
              <div className="ml-2 mt-0.5 space-y-0">
                {geminiModelNames.map((model) => (
                  <p key={model} className={apiCallModels[model] ? "text-gray-700" : "text-gray-300"}>{model}: {apiCallModels[model] || 0}회</p>
                ))}
              </div>
            </div>
          )}
          {generateError && <p className="text-xs text-red-500">{generateError}</p>}
        </>
      )}
    </div>
  );
}
