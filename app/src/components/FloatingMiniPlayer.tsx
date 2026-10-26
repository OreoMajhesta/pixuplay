import React, { useRef, useEffect, useState } from 'react';
import {
  Maximize2,
  X,
  SkipForward,
  SkipBack,
  Settings,
  PictureInPicture,
  GripHorizontal,
} from 'lucide-react';
import { Anime, StreamServer } from '../types';
import { getAnimeTitle, getStreamData } from '../api';
import { sendWatchHeartbeat } from '../services/authService';

interface FloatingMiniPlayerProps {
  anime: Anime;
  episode: number;
  server: StreamServer | null;
  initialTime?: number;
  initialIsPlaying?: boolean;
  maxEpisode?: number;
  onServerChange?: (server: StreamServer | null) => void;
  onSaveHistory?: (anime: Anime, ep: number, currentTime?: number, duration?: number) => void;
  onPlaybackSync?: (curTime: number, isPlaying: boolean) => void;
  onMaximize: (curTime?: number, isPlaying?: boolean) => void;
  onClose: () => void;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
}

export const FloatingMiniPlayer: React.FC<FloatingMiniPlayerProps> = ({
  anime,
  episode,
  server,
  initialTime = 0,
  initialIsPlaying = true,
  maxEpisode,
  onServerChange,
  onSaveHistory,
  onPlaybackSync,
  onMaximize,
  onClose,
  onNextEpisode,
  onPrevEpisode,
}) => {
  const title = getAnimeTitle(anime);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSeekedRef = useRef<boolean>(false);
  const lastSavedTimeRef = useRef<number>(initialTime);
  const prevEpRef = useRef<number>(episode);
  const prevAnimeIdRef = useRef<string>(String(anime.animeId || anime.id));

  // Draggable position state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  // Native Picture-in-Picture State
  const [isPiPActive, setIsPiPActive] = useState<boolean>(false);

  const [activeServer, setActiveServer] = useState<StreamServer | null>(server);
  const [loadingStream, setLoadingStream] = useState<boolean>(!server);
  const [miniError, setMiniError] = useState<boolean>(false);

  // Sync prop server if provided and activeServer is not set
  useEffect(() => {
    if (server) {
      setActiveServer(server);
      setLoadingStream(false);
      setMiniError(false);
    }
  }, [server]);

  // When episode or anime changes after mount, fetch stream for new episode
  useEffect(() => {
    const animeKey = String(anime.animeId || anime.id);
    const isEpisodeChanged = prevEpRef.current !== episode || prevAnimeIdRef.current !== animeKey;

    if (!isEpisodeChanged && server) {
      return;
    }

    prevEpRef.current = episode;
    prevAnimeIdRef.current = animeKey;
    let isMounted = true;
    hasSeekedRef.current = false;
    setLoadingStream(true);

    const fetchEpisodeStream = async () => {
      try {
        const data = await getStreamData(anime.animeId || anime.id, episode, title);
        if (isMounted) {
          const newServer = data?.servers?.[0] || null;
          setActiveServer(newServer);
          if (onServerChange) {
            onServerChange(newServer);
          }
          setLoadingStream(false);
        }
      } catch (err) {
        if (isMounted) {
          setLoadingStream(false);
        }
      }
    };

    fetchEpisodeStream();

    return () => {
      isMounted = false;
    };
  }, [anime.id, anime.animeId, episode]);

  // Periodic watch heartbeat
  useEffect(() => {
    const animeIdStr = String(anime.animeId || anime.id);
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        sendWatchHeartbeat(15, animeIdStr, episode);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [anime.id, anime.animeId, episode]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      if (initialTime > 0 && !hasSeekedRef.current) {
        hasSeekedRef.current = true;
        try {
          videoRef.current.currentTime = initialTime;
        } catch (err) {
          console.warn('MiniPlayer seek failed', err);
        }
      }
      if (initialIsPlaying === false) {
        videoRef.current.pause();
      }
    }
  };

  const handleCanPlay = () => {
    if (initialIsPlaying === false && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  };

  const lastRecordedTimeRef = useRef<number>(initialTime || 0);

  const getCurrentPlaybackTime = (): number => {
    if (videoRef.current && !isNaN(videoRef.current.currentTime) && videoRef.current.currentTime > 0) {
      return Math.floor(videoRef.current.currentTime);
    }
    return lastSavedTimeRef.current || initialTime || 0;
  };

  const saveCurrentProgress = () => {
    const curTime = getCurrentPlaybackTime();
    const dur =
      videoRef.current && !isNaN(videoRef.current.duration) && videoRef.current.duration > 0
        ? Math.floor(videoRef.current.duration)
        : 1440;
    if (onSaveHistory) {
      onSaveHistory(anime, episode, curTime, dur);
    }
  };

  // Save progress on page unload / tab switch / visibility change / unmount
  useEffect(() => {
    const handleUnloadOrHide = () => {
      saveCurrentProgress();
    };

    window.addEventListener('beforeunload', handleUnloadOrHide);
    window.addEventListener('pagehide', handleUnloadOrHide);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentProgress();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleUnloadOrHide);
      window.removeEventListener('pagehide', handleUnloadOrHide);
      document.removeEventListener('visibilitychange', handleVisibility);
      saveCurrentProgress();
    };
  }, [anime.id, anime.animeId, episode]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    const cur = Math.floor(vid.currentTime);
    const dur = Math.floor(vid.duration);
    if (initialTime > 0 && !hasSeekedRef.current && cur === 0) {
      return;
    }
    lastSavedTimeRef.current = cur;
    onPlaybackSync?.(cur, !vid.paused);
    if (dur > 0 && Math.abs(cur - lastRecordedTimeRef.current) >= 4) {
      lastRecordedTimeRef.current = cur;
      onSaveHistory?.(anime, episode, cur, dur);
    }
  };

  // Listen for native PiP state events on video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnter = () => setIsPiPActive(true);
    const onLeave = () => setIsPiPActive(false);
    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, [activeServer]);

  // Picture-in-Picture Toggle
  const handleTogglePiP = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (err) {
      console.warn('Picture-in-Picture error:', err);
    }
  };

  // Drag handlers (Mouse & Touch)
  const handleDragStart = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initX: rect.left,
      initY: rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      const rect = containerRef.current.getBoundingClientRect();
      const newX = Math.max(10, Math.min(window.innerWidth - rect.width - 10, dragStartRef.current.initX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - rect.height - 10, dragStartRef.current.initY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const t = moveEvent.touches[0];
      const dx = t.clientX - dragStartRef.current.startX;
      const dy = t.clientY - dragStartRef.current.startY;
      const rect = containerRef.current.getBoundingClientRect();
      const newX = Math.max(10, Math.min(window.innerWidth - rect.width - 10, dragStartRef.current.initX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - rect.height - 10, dragStartRef.current.initY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handleMaximizeClick = () => {
    const isPlaying = videoRef.current ? !videoRef.current.paused : initialIsPlaying;
    onMaximize(getCurrentPlaybackTime(), isPlaying);
  };

  const handleCloseClick = () => {
    saveCurrentProgress();
    onClose();
  };

  const isNextDisabled = maxEpisode !== undefined && episode >= maxEpisode;
  const isPrevDisabled = episode <= 1;

  return (
    <div
      ref={containerRef}
      style={
        position
          ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' }
          : undefined
      }
      className={`${
        position ? 'fixed' : 'fixed bottom-4 right-4'
      } z-50 w-80 sm:w-96 bg-card border-2 border-white/40 rounded-xl overflow-hidden shadow-2xl animate-slide-up flex flex-col group select-none`}
    >
      {/* Mini Player Top Bar (Draggable Handle) */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="flex items-center justify-between px-3 py-2 bg-black/95 border-b border-subtle cursor-grab active:cursor-grabbing select-none"
        title="Tahan & geser untuk memindahkan posisi pemutar"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white flex-shrink-0 cursor-grab" />
          <span className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
          <p className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[160px]" title={title}>
            {title}
          </p>
          <span className="text-[10px] font-black px-1.5 py-0.2 bg-white text-black rounded-xs flex-shrink-0">
            Ep {episode}
          </span>
          {activeServer?.quality && (
            <span className="text-[9px] font-black px-1.5 py-0.2 bg-red-600 text-white rounded-xs flex-shrink-0 flex items-center gap-0.5">
              <Settings className="w-2.5 h-2.5 text-white" />
              <span>{activeServer.quality}</span>
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Picture-in-Picture Button (Over Word / Excel / Desktop Apps) */}
          {activeServer?.type === 'direct' && (
            <button
              onClick={handleTogglePiP}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isPiPActive
                  ? 'text-red-400 bg-red-950/50'
                  : 'text-neutral-400 hover:text-white hover:bg-surface'
              }`}
              title="Picture-in-Picture: Terapung di atas aplikasi lain"
              aria-label="Picture-in-Picture"
            >
              <PictureInPicture className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleMaximizeClick}
            className="p-1 rounded text-muted hover:text-white hover:bg-surface transition-colors cursor-pointer"
            title="Perbesar Layar Penuh (Maximize)"
            aria-label="Maximize player"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCloseClick}
            className="p-1 rounded text-muted hover:text-white hover:bg-surface transition-colors cursor-pointer"
            title="Tutup Pemutar"
            aria-label="Close player"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Screen 16:9 Aspect Ratio */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        {loadingStream ? (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin mb-2" />
            <p className="text-[11px] text-muted">Memuat Episode {episode}...</p>
          </div>
        ) : activeServer ? (
          activeServer.type === 'direct' ? (
            miniError ? (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <p className="text-xs text-red-400 font-semibold mb-1">Gagal memuat video</p>
                <button
                  onClick={() => {
                    setMiniError(false);
                    if (videoRef.current) {
                      videoRef.current.load();
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                  className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-[11px] cursor-pointer mt-1"
                >
                  Coba Lagi
                </button>
              </div>
            ) : (
              <video
                key={`mini-video-${anime.id}-${episode}-${activeServer.url}`}
                ref={videoRef}
                src={activeServer.url}
                controls
                autoPlay={initialIsPlaying}
                playsInline
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={handleCanPlay}
                onTimeUpdate={handleTimeUpdate}
                onError={() => setMiniError(true)}
                className="w-full h-full object-contain"
              />
            )
          ) : (
            <iframe
              key={`mini-iframe-${anime.id}-${episode}-${activeServer.url}`}
              src={activeServer.url}
              title={`Mini Player - ${title} Ep ${episode}`}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              className="w-full h-full border-0"
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin mb-2" />
            <p className="text-[11px] text-muted">Menghubungkan stream...</p>
          </div>
        )}
      </div>

      {/* Mini Player Bottom Controls */}
      <div className="px-3 py-1.5 bg-black/90 border-t border-subtle flex items-center justify-between text-[11px] text-muted">
        <span className="truncate max-w-[140px] text-[10px]">
          {activeServer?.label || activeServer?.name || 'Server Otomatis'}
        </span>

        <div className="flex items-center gap-2">
          {onPrevEpisode && (
            <button
              onClick={onPrevEpisode}
              disabled={isPrevDisabled}
              className={`p-1 transition-colors ${
                isPrevDisabled
                  ? 'opacity-25 cursor-not-allowed text-neutral-600'
                  : 'hover:text-white text-muted cursor-pointer'
              }`}
              title={isPrevDisabled ? 'Sudah episode pertama (Ep 1)' : 'Episode Sebelumnya'}
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
          )}

          {onNextEpisode && (
            <button
              onClick={onNextEpisode}
              disabled={isNextDisabled}
              className={`p-1 transition-colors ${
                isNextDisabled
                  ? 'opacity-25 cursor-not-allowed text-neutral-600'
                  : 'hover:text-white text-muted cursor-pointer'
              }`}
              title={
                isNextDisabled
                  ? `Episode terakhir rilis (Ep ${maxEpisode})`
                  : 'Episode Selanjutnya'
              }
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
