import type { Dispatch, DragEventHandler, RefObject, SetStateAction } from "react";

type AbRepeat = {
  a: number | null;
  b: number | null;
};

type Props = {
  dropZoneRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  isDragging: boolean;
  videoSrc: string | null;
  videoLoop: boolean;
  videoPlaybackRate: number;
  videoVolume: number;
  currentVideoIndex: number;
  videoPlaylistLength: number;
  playlistLoop: boolean;
  abRepeat: AbRepeat;
  setCurrentVideoIndex: Dispatch<SetStateAction<number>>;
  onDragEnter: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
};

export default function RandomUploadPlayer({
  dropZoneRef,
  videoRef,
  isDragging,
  videoSrc,
  videoLoop,
  videoPlaybackRate,
  videoVolume,
  currentVideoIndex,
  videoPlaylistLength,
  playlistLoop,
  abRepeat,
  setCurrentVideoIndex,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: Props) {
  return (
    <div className="flex-1 flex gap-2" style={{ height: "75vh" }}>
      <div
        ref={dropZoneRef}
        className={`flex-1 border-2 rounded overflow-hidden bg-black relative ${isDragging ? "border-green-500 border-4" : "border-blue-500"}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-green-500 bg-opacity-50 z-10 flex items-center justify-center pointer-events-none">
            <span className="text-white text-2xl font-bold">여기에 영상/오디오 파일을 놓으세요</span>
          </div>
        )}
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain"
            style={{ height: "75vh" }}
            controls
            autoPlay
            loop={videoLoop}
            disablePictureInPicture
            controlsList="noplaybackrate"
            onLoadedMetadata={() => {
              if (!videoRef.current) return;
              videoRef.current.playbackRate = videoPlaybackRate;
              videoRef.current.volume = videoVolume;
              videoRef.current.loop = videoLoop;
              const savedTime = localStorage.getItem("videoCurrentTime");
              const savedIndex = localStorage.getItem("videoCurrentIndex");
              if (savedTime !== null && savedIndex !== null && parseInt(savedIndex, 10) === currentVideoIndex) {
                videoRef.current.currentTime = parseFloat(savedTime);
              }
            }}
            onTimeUpdate={() => {
              if (!videoRef.current || abRepeat.a === null || abRepeat.b === null) return;
              if (videoRef.current.currentTime >= abRepeat.b) {
                videoRef.current.currentTime = abRepeat.a;
              }
            }}
            onEnded={() => {
              if (videoLoop || videoPlaylistLength <= 1) return;
              if (currentVideoIndex < videoPlaylistLength - 1) {
                setCurrentVideoIndex((prev) => prev + 1);
              } else if (playlistLoop) {
                setCurrentVideoIndex(0);
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-900 gap-2">
            <span className="text-4xl">📁</span>
            <span>영상/오디오 파일을 드래그하거나 선택하세요</span>
            <span className="text-sm">(여러 파일 선택 가능)</span>
          </div>
        )}
      </div>
    </div>
  );
}
