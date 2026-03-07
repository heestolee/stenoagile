type Props = {
  videoSourceTab: "upload" | "youtube";
  setVideoSourceTab: (tab: "upload" | "youtube") => void;
  youtubeUrl: string;
  setYoutubeUrl: (url: string) => void;
  handleYoutubeUrlSubmit: () => void;
};

export default function RandomSourceControls({
  videoSourceTab,
  setVideoSourceTab,
  youtubeUrl,
  setYoutubeUrl,
  handleYoutubeUrlSubmit,
}: Props) {
  return (
    <>
      <div className="flex gap-2">
        <button
          className={`px-4 py-2 rounded font-medium ${videoSourceTab === "upload" ? "bg-blue-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
          onClick={() => setVideoSourceTab("upload")}
        >
          파일 업로드
        </button>
        <button
          className={`px-4 py-2 rounded font-medium ${videoSourceTab === "youtube" ? "bg-red-500 text-white" : "bg-gray-200 hover:bg-gray-300"}`}
          onClick={() => setVideoSourceTab("youtube")}
        >
          YouTube 링크
        </button>
      </div>

      {videoSourceTab === "youtube" && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="YouTube URL을 입력하세요 (예: https://youtube.com/watch?v=...)"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleYoutubeUrlSubmit();
            }}
            className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={handleYoutubeUrlSubmit}
          >
            재생
          </button>
        </div>
      )}
    </>
  );
}
