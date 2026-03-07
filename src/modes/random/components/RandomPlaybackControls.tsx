type AbRepeat = {
  a: number | null;
  b: number | null;
};

type Props = {
  videoPlaylistLength: number;
  skipSeconds: number;
  onSkipSecondsChange: (seconds: number) => void;
  videoLoop: boolean;
  playlistLoop: boolean;
  abRepeat: AbRepeat;
  onPrev: () => void;
  onBackward: () => void;
  onTogglePlayPause: () => void;
  onForward: () => void;
  onNext: () => void;
  onToggleVideoLoop: () => void;
  onTogglePlaylistLoop: () => void;
  onToggleAbRepeat: () => void;
  onTogglePip: () => void;
  onToggleFullscreen: () => void;
  onClearPlaylist: () => void;
};

export default function RandomPlaybackControls({
  videoPlaylistLength,
  skipSeconds,
  onSkipSecondsChange,
  videoLoop,
  playlistLoop,
  abRepeat,
  onPrev,
  onBackward,
  onTogglePlayPause,
  onForward,
  onNext,
  onToggleVideoLoop,
  onTogglePlaylistLoop,
  onToggleAbRepeat,
  onTogglePip,
  onToggleFullscreen,
  onClearPlaylist,
}: Props) {
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm" onClick={onPrev} disabled={videoPlaylistLength === 0}>
          이전
        </button>
        <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm" onClick={onBackward}>
          - {skipSeconds}초
        </button>
        <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm" onClick={onTogglePlayPause}>
          재생/정지
        </button>
        <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm" onClick={onForward}>
          + {skipSeconds}초
        </button>
        <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm" onClick={onNext} disabled={videoPlaylistLength === 0}>
          다음
        </button>
        <div className="flex items-center gap-1">
          <span className="text-sm">건너뛰기:</span>
          <input
            type="number"
            min={1}
            max={60}
            value={skipSeconds}
            onChange={(e) => onSkipSecondsChange(Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 5)))}
            className="w-12 px-1 py-1 border rounded text-sm"
          />
          <span className="text-sm">초</span>
        </div>
        <button
          className={`px-3 py-1 rounded text-sm ${videoLoop ? "bg-blue-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
          onClick={onToggleVideoLoop}
        >
          영상반복 {videoLoop ? "ON" : "OFF"}
        </button>
        <button
          className={`px-3 py-1 rounded text-sm ${playlistLoop ? "bg-purple-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
          onClick={onTogglePlaylistLoop}
        >
          목록반복 {playlistLoop ? "ON" : "OFF"}
        </button>
        <button
          className={`px-3 py-1 rounded text-sm ${abRepeat.a !== null ? "bg-green-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
          onClick={onToggleAbRepeat}
        >
          {abRepeat.a === null ? "A-B 시작" : abRepeat.b === null ? "B 지점" : "A-B 해제"}
        </button>
        {abRepeat.a !== null && (
          <span className="text-xs text-gray-600">A: {Math.floor(abRepeat.a)}초{abRepeat.b !== null && ` / B: ${Math.floor(abRepeat.b)}초`}</span>
        )}
        <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm" onClick={onTogglePip}>
          PIP
        </button>
        <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm" onClick={onToggleFullscreen}>
          전체화면
        </button>
        {videoPlaylistLength > 0 && (
          <button className="px-3 py-1 bg-red-400 text-white rounded hover:bg-red-500 text-sm" onClick={onClearPlaylist}>
            목록 삭제
          </button>
        )}
      </div>

      <div className="text-xs text-gray-500 flex flex-wrap gap-x-3">
        <span>Space: 재생/정지</span>
        <span>←/→: 건너뛰기</span>
        <span>↑/↓: 볼륨</span>
        <span>&lt;/&gt;: 속도</span>
        <span>B/N: 이전/다음</span>
        <span>L: 영상반복</span>
        <span>A: 구간반복</span>
        <span>M: 음소거</span>
        <span>F: 전체화면</span>
        <span>P: PIP</span>
        <span>Home/End: 처음/끝</span>
      </div>
    </>
  );
}
