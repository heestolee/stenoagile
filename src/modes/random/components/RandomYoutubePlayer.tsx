type Props = {
  youtubeVideoId: string | null;
};

export default function RandomYoutubePlayer({ youtubeVideoId }: Props) {
  return (
    <div className="flex gap-2" style={{ height: "60vh" }}>
      <div className="flex-1 border-2 border-red-500 rounded overflow-hidden bg-black">
        {youtubeVideoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-900 gap-2">
            <span className="text-4xl">▶️</span>
            <span>YouTube URL을 입력하고 재생 버튼을 누르세요</span>
          </div>
        )}
      </div>
    </div>
  );
}
