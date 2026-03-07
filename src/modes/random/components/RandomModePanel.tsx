import type { Dispatch, DragEventHandler, KeyboardEvent, RefObject, SetStateAction } from "react";
import RandomPracticePanel from "./RandomPracticePanel";

type AbRepeat = {
  a: number | null;
  b: number | null;
};

type Props = {
  mode: string;
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

export default function RandomModePanel(props: Props) {
  if (props.mode !== "random") return null;
  return <RandomPracticePanel {...props} />;
}
