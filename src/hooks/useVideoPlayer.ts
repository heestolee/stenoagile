import { useState, useRef, useEffect, useCallback } from "react";
import { saveVideosToDB, loadVideosFromDB, clearVideosDB } from "../utils/indexedDB";

export function useVideoPlayer(mode: string) {
  const [videoPlaylist, setVideoPlaylist] = useState<{ name: string; url: string; data?: ArrayBuffer }[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [videoPlaybackRate, setVideoPlaybackRate] = useState(1);
  const [videoVolume, setVideoVolume] = useState(0.05);
  const [videoLoop, setVideoLoop] = useState(false);
  const [playlistLoop, setPlaylistLoop] = useState(false);
  const [abRepeat, setAbRepeat] = useState<{ a: number | null; b: number | null }>({ a: null, b: null });
  const [skipSeconds, setSkipSeconds] = useState(5);
  const [isDragging, setIsDragging] = useState(false);
  const [videoSourceTab, setVideoSourceTab] = useState<'upload' | 'youtube'>('upload');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);

  // 현재 재생 중인 영상 URL
  const videoSrc = videoPlaylist.length > 0 ? videoPlaylist[currentVideoIndex]?.url : null;

  // YouTube URL에서 video ID 추출
  const extractYoutubeVideoId = (url: string): string | null => {
    const pattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(pattern);
    return match ? match[1] : null;
  };

  // YouTube URL 입력 처리
  const handleYoutubeUrlSubmit = () => {
    const videoId = extractYoutubeVideoId(youtubeUrl);
    setYoutubeVideoId(videoId);
  };

  // IndexedDB에 재생목록 저장
  const savePlaylistToDB = useCallback(async (playlist: { name: string; url: string; data?: ArrayBuffer }[]) => {
    const dataToSave = playlist
      .filter(v => v.data)
      .map(v => ({ name: v.name, data: v.data! }));
    if (dataToSave.length > 0) {
      await saveVideosToDB(dataToSave);
    }
  }, []);

  // 재생목록에 영상/오디오 추가
  const addVideosToPlaylist = async (files: FileList | File[]) => {
    const mediaExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.mp3', '.wav', '.m4a', '.aac'];
    const existingNames = new Set(videoPlaylist.map(v => v.name));
    const validFiles = Array.from(files).filter(file => {
      if (existingNames.has(file.name)) return false;
      if (file.type.startsWith('video/') || file.type.startsWith('audio/')) return true;
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      return mediaExtensions.includes(ext);
    });

    const newVideos = await Promise.all(
      validFiles.map(async (file) => {
        const data = await file.arrayBuffer();
        const blob = new Blob([data], { type: file.type || 'video/mp4' });
        return {
          name: file.name,
          url: URL.createObjectURL(blob),
          data
        };
      })
    );

    if (newVideos.length > 0) {
      setVideoPlaylist(prev => {
        const wasEmpty = prev.length === 0;
        if (wasEmpty) {
          setCurrentVideoIndex(0);
        }
        const updated = [...prev, ...newVideos];
        savePlaylistToDB(updated);
        return updated;
      });
    }
  };

  // 재생목록에서 영상 제거
  const removeVideoFromPlaylist = (index: number) => {
    const video = videoPlaylist[index];
    if (video) {
      URL.revokeObjectURL(video.url);
    }
    setVideoPlaylist(prev => {
      const updated = prev.filter((_, i) => i !== index);
      savePlaylistToDB(updated);
      return updated;
    });
    if (index === currentVideoIndex) {
      setCurrentVideoIndex(Math.min(index, videoPlaylist.length - 2));
    } else if (index < currentVideoIndex) {
      setCurrentVideoIndex(prev => prev - 1);
    }
  };

  // 재생목록 전체 삭제
  const clearPlaylist = async () => {
    videoPlaylist.forEach(video => URL.revokeObjectURL(video.url));
    setVideoPlaylist([]);
    setCurrentVideoIndex(0);
    localStorage.removeItem('videoCurrentIndex');
    localStorage.removeItem('videoCurrentTime');
    await clearVideosDB();
  };

  // 이전 영상
  const playPreviousVideo = () => {
    if (videoPlaylist.length === 0) return;
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(prev => prev - 1);
    } else if (playlistLoop) {
      setCurrentVideoIndex(videoPlaylist.length - 1);
    }
  };

  // 다음 영상
  const playNextVideo = () => {
    if (videoPlaylist.length === 0) return;
    if (currentVideoIndex < videoPlaylist.length - 1) {
      setCurrentVideoIndex(prev => prev + 1);
    } else if (playlistLoop) {
      setCurrentVideoIndex(0);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = dropZoneRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        setIsDragging(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      addVideosToPlaylist(files);
    }
  };

  // 브라우저 기본 드래그 앤 드롭 동작 방지 (random 모드에서만)
  useEffect(() => {
    if (mode !== "random") return;

    const handleDocumentDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (dropZoneRef.current) {
        const rect = dropZoneRef.current.getBoundingClientRect();
        const isOverDropZone = e.clientX >= rect.left && e.clientX <= rect.right &&
                               e.clientY >= rect.top && e.clientY <= rect.bottom;
        setIsDragging(isOverDropZone);
      }
    };

    const handleDocumentDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (dropZoneRef.current && e.dataTransfer?.files) {
        const rect = dropZoneRef.current.getBoundingClientRect();
        const isOverDropZone = e.clientX >= rect.left && e.clientX <= rect.right &&
                               e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (isOverDropZone && e.dataTransfer.files.length > 0) {
          addVideosToPlaylist(e.dataTransfer.files);
        }
      }
    };

    const handleDocumentDragLeave = (e: DragEvent) => {
      if (e.clientX <= 0 || e.clientY <= 0 ||
          e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsDragging(false);
      }
    };

    document.addEventListener('dragover', handleDocumentDragOver);
    document.addEventListener('drop', handleDocumentDrop);
    document.addEventListener('dragleave', handleDocumentDragLeave);

    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver);
      document.removeEventListener('drop', handleDocumentDrop);
      document.removeEventListener('dragleave', handleDocumentDragLeave);
    };
  }, [mode]);

  // IndexedDB에서 재생목록 복원
  useEffect(() => {
    const restorePlaylist = async () => {
      try {
        const savedVideos = await loadVideosFromDB();
        if (savedVideos.length > 0) {
          const restoredPlaylist = savedVideos.map(v => {
            const blob = new Blob([v.data], { type: 'video/mp4' });
            return {
              name: v.name,
              url: URL.createObjectURL(blob),
              data: v.data
            };
          });
          setVideoPlaylist(restoredPlaylist);

          const savedIndex = localStorage.getItem('videoCurrentIndex');
          if (savedIndex !== null) {
            const idx = parseInt(savedIndex);
            if (idx >= 0 && idx < restoredPlaylist.length) {
              setCurrentVideoIndex(idx);
            }
          }
        }
      } catch (e) {
        console.error('재생목록 복원 실패:', e);
      }
    };
    restorePlaylist();
  }, []);

  // 재생 위치 주기적 저장
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        localStorage.setItem('videoCurrentTime', videoRef.current.currentTime.toString());
        localStorage.setItem('videoCurrentIndex', currentVideoIndex.toString());
      }
    }, 1000);

    return () => clearInterval(saveInterval);
  }, [currentVideoIndex]);

  // 동영상 단축키
  useEffect(() => {
    if (mode !== "random") return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
          break;
        case "arrowleft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - skipSeconds);
          break;
        case "arrowright":
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + skipSeconds);
          break;
        case "arrowup":
          e.preventDefault();
          { const newVolUp = Math.min(1, videoVolume + 0.1);
          setVideoVolume(newVolUp);
          video.volume = newVolUp; }
          break;
        case "arrowdown":
          e.preventDefault();
          { const newVolDown = Math.max(0, videoVolume - 0.1);
          setVideoVolume(newVolDown);
          video.volume = newVolDown; }
          break;
        case ",":
        case "<":
          e.preventDefault();
          { const newRateDown = Math.max(0.25, videoPlaybackRate - 0.25);
          setVideoPlaybackRate(newRateDown);
          video.playbackRate = newRateDown; }
          break;
        case ".":
        case ">":
          e.preventDefault();
          { const newRateUp = Math.min(4, videoPlaybackRate + 0.25);
          setVideoPlaybackRate(newRateUp);
          video.playbackRate = newRateUp; }
          break;
        case "l":
          e.preventDefault();
          setVideoLoop(!videoLoop);
          video.loop = !videoLoop;
          break;
        case "f":
          e.preventDefault();
          if (document.fullscreenElement) document.exitFullscreen();
          else video.requestFullscreen();
          break;
        case "p":
          e.preventDefault();
          if (document.pictureInPictureEnabled) {
            if (document.pictureInPictureElement) document.exitPictureInPicture();
            else video.requestPictureInPicture();
          }
          break;
        case "m":
          e.preventDefault();
          video.muted = !video.muted;
          break;
        case "home":
          e.preventDefault();
          video.currentTime = 0;
          break;
        case "end":
          e.preventDefault();
          video.currentTime = video.duration;
          break;
        case "a":
          e.preventDefault();
          if (abRepeat.a === null) {
            setAbRepeat({ a: video.currentTime, b: null });
          } else if (abRepeat.b === null) {
            setAbRepeat({ ...abRepeat, b: video.currentTime });
          } else {
            setAbRepeat({ a: null, b: null });
          }
          break;
        case "n":
          e.preventDefault();
          playNextVideo();
          break;
        case "b":
          e.preventDefault();
          playPreviousVideo();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, videoVolume, videoPlaybackRate, videoLoop, skipSeconds, abRepeat, videoPlaylist.length, currentVideoIndex, playlistLoop]);

  return {
    videoPlaylist,
    currentVideoIndex,
    setCurrentVideoIndex,
    videoPlaybackRate,
    setVideoPlaybackRate,
    videoVolume,
    setVideoVolume,
    videoLoop,
    setVideoLoop,
    playlistLoop,
    setPlaylistLoop,
    abRepeat,
    setAbRepeat,
    skipSeconds,
    setSkipSeconds,
    isDragging,
    videoSourceTab,
    setVideoSourceTab,
    youtubeUrl,
    setYoutubeUrl,
    youtubeVideoId,
    videoRef,
    dropZoneRef,
    videoSrc,
    handleYoutubeUrlSubmit,
    addVideosToPlaylist,
    removeVideoFromPlaylist,
    clearPlaylist,
    playPreviousVideo,
    playNextVideo,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
