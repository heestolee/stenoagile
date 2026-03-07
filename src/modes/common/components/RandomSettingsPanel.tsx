type PlaylistItem = {
  name: string;
};

type RandomSettingsPanelProps = {
  inputFontSize: number;
  videoPlaybackRate: number;
  videoVolume: number;
  videoPlaylist: PlaylistItem[];
  currentVideoIndex: number;
  onInputFontSizeChange: (size: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onVolumeChange: (volume: number) => void;
  onSelectVideo: (index: number) => void;
  onRemoveVideo: (index: number) => void;
};

export default function RandomSettingsPanel({
  inputFontSize,
  videoPlaybackRate,
  videoVolume,
  videoPlaylist,
  currentVideoIndex,
  onInputFontSizeChange,
  onPlaybackRateChange,
  onVolumeChange,
  onSelectVideo,
  onRemoveVideo,
}: RandomSettingsPanelProps) {
  return (
    <>
      <div className="flex items-center gap-1 mt-1">
        <label className="text-xs">글자</label>
        <input
          type="number"
          min={12}
          max={48}
          step={0.1}
          value={inputFontSize}
          onChange={(e) => {
            const size = parseFloat(e.target.value);
            if (!isNaN(size) && size >= 12 && size <= 48) onInputFontSizeChange(size);
          }}
          className="w-12 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-1 mt-1">
        <label className="text-xs">속도</label>
        <input
          type="number"
          min={0.25}
          max={4}
          step={0.25}
          value={videoPlaybackRate}
          onChange={(e) => {
            const rate = parseFloat(e.target.value);
            if (!isNaN(rate) && rate >= 0.25 && rate <= 4) onPlaybackRateChange(rate);
          }}
          className="w-12 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-xs">x</span>
      </div>

      <div className="flex items-center gap-1 mt-1">
        <label className="text-xs">볼륨</label>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={Math.round(videoVolume * 100)}
          onChange={(e) => {
            const vol = Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) / 100;
            onVolumeChange(vol);
          }}
          className="w-12 px-1 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-xs">%</span>
      </div>

      {videoPlaylist.length > 0 && (
        <div className="mt-1 border border-gray-300 rounded bg-gray-50 overflow-hidden flex flex-col flex-1">
          <div className="bg-gray-200 px-1 py-0.5 text-xs font-semibold border-b">목록 ({videoPlaylist.length})</div>
          <div className="flex-1 overflow-y-auto">
            {videoPlaylist.map((video, index) => (
              <div
                key={index}
                className={`flex items-center gap-1 px-1 py-0.5 cursor-pointer hover:bg-gray-100 ${
                  index === currentVideoIndex ? "bg-blue-100 border-l-2 border-blue-500" : ""
                }`}
                onClick={() => onSelectVideo(index)}
              >
                <span className="text-xs text-gray-500 w-3">{index + 1}</span>
                <span className="flex-1 text-xs truncate" title={video.name}>{video.name}</span>
                <button
                  className="text-red-500 hover:text-red-700 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveVideo(index);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
