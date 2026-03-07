import type { Dispatch, DragEventHandler, KeyboardEvent, RefObject, SetStateAction } from "react";
import RandomSourceControls from "./RandomSourceControls";
import RandomPlaybackControls from "./RandomPlaybackControls";
import RandomUploadPlayer from "./RandomUploadPlayer";
import RandomYoutubePlayer from "./RandomYoutubePlayer";
import RandomTypingArea from "./RandomTypingArea";

type AbRepeat = {
  a: number | null;
  b: number | null;
};

type Props = {
  videoSourceTab: "upload" | "youtube";
  setVideoSourceTab: Dispatch<SetStateAction<"upload" | "youtube">>;
  youtubeUrl: string;
  setYoutubeUrl: Dispatch<SetStateAction<string>>;
  handleYoutubeUrlSubmit: () => void;
  videoPlaylistLength: number;
  skipSeconds: number;
  setSkipSeconds: Dispatch<SetStateAction<number>>;
  videoLoop: boolean;
  setVideoLoop: Dispatch<SetStateAction<boolean>>;
  playlistLoop: boolean;
  setPlaylistLoop: Dispatch<SetStateAction<boolean>>;
  abRepeat: AbRepeat;
  setAbRepeat: Dispatch<SetStateAction<AbRepeat>>;
  playPreviousVideo: () => void;
  playNextVideo: () => void;
  clearPlaylist: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  dropZoneRef: RefObject<HTMLDivElement | null>;
  isDragging: boolean;
  videoSrc: string | null;
  videoPlaybackRate: number;
  videoVolume: number;
  currentVideoIndex: number;
  setCurrentVideoIndex: Dispatch<SetStateAction<number>>;
  onDragEnter: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  youtubeVideoId: string | null;
  inputFontSize: number;
  onChangeText: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};

export default function RandomPracticePanel({
  videoSourceTab,
  setVideoSourceTab,
  youtubeUrl,
  setYoutubeUrl,
  handleYoutubeUrlSubmit,
  videoPlaylistLength,
  skipSeconds,
  setSkipSeconds,
  videoLoop,
  setVideoLoop,
  playlistLoop,
  setPlaylistLoop,
  abRepeat,
  setAbRepeat,
  playPreviousVideo,
  playNextVideo,
  clearPlaylist,
  videoRef,
  dropZoneRef,
  isDragging,
  videoSrc,
  videoPlaybackRate,
  videoVolume,
  currentVideoIndex,
  setCurrentVideoIndex,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  youtubeVideoId,
  inputFontSize,
  onChangeText,
  onKeyDown,
}: Props) {
  return (
    <div className="flex-1 flex flex-col gap-2">
      <RandomSourceControls
        videoSourceTab={videoSourceTab}
        setVideoSourceTab={setVideoSourceTab}
        youtubeUrl={youtubeUrl}
        setYoutubeUrl={setYoutubeUrl}
        handleYoutubeUrlSubmit={handleYoutubeUrlSubmit}
      />

      {videoSourceTab === "upload" && (
        <RandomPlaybackControls
          videoPlaylistLength={videoPlaylistLength}
          skipSeconds={skipSeconds}
          onSkipSecondsChange={setSkipSeconds}
          videoLoop={videoLoop}
          playlistLoop={playlistLoop}
          abRepeat={abRepeat}
          onPrev={playPreviousVideo}
          onBackward={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - skipSeconds);
            }
          }}
          onTogglePlayPause={() => {
            if (videoRef.current) {
              if (videoRef.current.paused) {
                videoRef.current.play();
              } else {
                videoRef.current.pause();
              }
            }
          }}
          onForward={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + skipSeconds);
            }
          }}
          onNext={playNextVideo}
          onToggleVideoLoop={() => {
            setVideoLoop(!videoLoop);
            if (videoRef.current) {
              videoRef.current.loop = !videoLoop;
            }
          }}
          onTogglePlaylistLoop={() => setPlaylistLoop(!playlistLoop)}
          onToggleAbRepeat={() => {
            if (videoRef.current) {
              if (abRepeat.a === null) {
                setAbRepeat({ a: videoRef.current.currentTime, b: null });
              } else if (abRepeat.b === null) {
                setAbRepeat({ ...abRepeat, b: videoRef.current.currentTime });
              } else {
                setAbRepeat({ a: null, b: null });
              }
            }
          }}
          onTogglePip={() => {
            if (videoRef.current && document.pictureInPictureEnabled) {
              if (document.pictureInPictureElement) {
                document.exitPictureInPicture();
              } else {
                videoRef.current.requestPictureInPicture();
              }
            }
          }}
          onToggleFullscreen={() => {
            if (videoRef.current) {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                videoRef.current.requestFullscreen();
              }
            }
          }}
          onClearPlaylist={clearPlaylist}
        />
      )}

      {videoSourceTab === "upload" && (
        <RandomUploadPlayer
          dropZoneRef={dropZoneRef}
          videoRef={videoRef}
          isDragging={isDragging}
          videoSrc={videoSrc}
          videoLoop={videoLoop}
          videoPlaybackRate={videoPlaybackRate}
          videoVolume={videoVolume}
          currentVideoIndex={currentVideoIndex}
          videoPlaylistLength={videoPlaylistLength}
          playlistLoop={playlistLoop}
          abRepeat={abRepeat}
          setCurrentVideoIndex={setCurrentVideoIndex}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      )}

      {videoSourceTab === "youtube" && <RandomYoutubePlayer youtubeVideoId={youtubeVideoId} />}

      <RandomTypingArea inputFontSize={inputFontSize} onChangeText={onChangeText} onKeyDown={onKeyDown} />
    </div>
  );
}
