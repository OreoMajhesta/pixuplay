import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  Tv,
  ExternalLink,
  RefreshCw,
  Settings,
  Check,
  Maximize,
  Minimize,
} from 'lucide-react';
import { StreamServer } from '../../types';

interface WatchVideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  loadingStream: boolean;
  currentServer: StreamServer | null;
  activeVideoUrl?: string;
  title: string;
  episode: number;
  initialIsPlaying: boolean;
  videoError: string | null;
  onClearVideoError: () => void;
  onRetryServer: () => void;
  onNextServer: () => void;
  hasAlternativeServer: boolean;
  nextServerName: string;
  onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onCanPlay: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onSeeked: () => void;
  onPlay: () => void;
  onPause: () => void;
  onError: () => void;
  getEmbedUrl: (server: StreamServer) => string;
  floatingEmojis: Array<{ id: string; emoji: string; x: number; scale?: number }>;
  availableQualities: Array<{ quality: string; label: string; url?: string }>;
  selectedQuality: string;
  onSelectQuality: (qualityKey: string, label: string) => void;
  qualityBadge: 'FHD' | 'HD' | 'SD' | null;
}

export const WatchVideoPlayer: React.FC<WatchVideoPlayerProps> = ({
  videoRef,
  loadingStream,
  currentServer,
  activeVideoUrl,
  title,
  episode,
  initialIsPlaying,
  videoError,
  onClearVideoError,
  onRetryServer,
  onNextServer,
  hasAlternativeServer,
  nextServerName,
  onLoadedMetadata,
  onCanPlay,
  onTimeUpdate,
  onSeeked,
  onPlay,
  onPause,
  onError,
  getEmbedUrl,
  floatingEmojis,
  availableQualities,
  selectedQuality,
  onSelectQuality,
  qualityBadge,
}) => {
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);

  const togglePlayPause = useCallback(() => {
    if (currentServer?.type === 'direct' && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    } else if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ type: 'PIXUPLAY_TOGGLE_PLAY' }, '*');
      } catch {}
    }
  }, [currentServer, videoRef]);

  const toggleFullscreen = useCallback(() => {
    const doc = document as any;
    const isFull = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    if (isFull) {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    } else {
      const container = playerContainerRef.current as any;
      if (!container) return;

      // iOS Safari video fallback if element fullscreen is not supported
      if (!container.requestFullscreen && !container.webkitRequestFullscreen) {
        if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
          (videoRef.current as any).webkitEnterFullscreen();
          return;
        }
      }

      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    }
  }, [videoRef]);

  // Sync fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      setIsFullscreen(
        !!(
          doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement
        )
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcut listener for 'f' / 'F' (fullscreen), 'Space' (play/pause), and message bridge from embed iframe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Don't trigger if typing in text inputs, textareas, selects, or contentEditable elements
      const target = (e.target as HTMLElement | null) || (document.activeElement as HTMLElement | null);
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          toggleFullscreen();
        }
      } else if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          togglePlayPause();
        }
      }
    };

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'PIXUPLAY_TOGGLE_FULLSCREEN') {
        toggleFullscreen();
      } else if (e.data?.type === 'PIXUPLAY_TOGGLE_PLAY') {
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('message', handleMessage);
    };
  }, [toggleFullscreen, togglePlayPause]);

  const handleMouseMove = () => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (videoRef.current && !videoRef.current.paused) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isQualityMenuOpen) {
          setIsControlsVisible(false);
        }
      }, 2800);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setIsQualityMenuOpen(false);
      }
    };
    if (isQualityMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isQualityMenuOpen]);

  return (
    <div
      ref={playerContainerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsControlsVisible(true)}
      onMouseLeave={() => {
        if (videoRef.current && !videoRef.current.paused && !isQualityMenuOpen) {
          setIsControlsVisible(false);
        }
      }}
      className={`relative w-full ${
        isFullscreen
          ? 'h-screen max-h-screen rounded-none border-0'
          : 'aspect-video rounded-2xl border border-white/5'
      } bg-black overflow-hidden shadow-2xl flex items-center justify-center group`}
    >
      {/* Floating Danmaku Emojis */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        {floatingEmojis.map((fe) => (
          <div
            key={fe.id}
            style={
              {
                left: `${fe.x}%`,
                fontSize: `${(fe.scale || 1) * 2.2}rem`,
              } as React.CSSProperties
            }
            className="absolute bottom-6 animate-float-emoji transform -translate-x-1/2 drop-shadow-xl filter"
          >
            {fe.emoji}
          </div>
        ))}
      </div>

      {/* In-Player Top Right Overlay Controls (Fullscreen & Quality Gear) */}
      {currentServer && !loadingStream && (
        <div
          className={`absolute top-3.5 right-3.5 z-30 flex items-center gap-1.5 transition-opacity duration-200 ${
            isControlsVisible || isQualityMenuOpen
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
          ref={qualityMenuRef}
        >
          {/* Fullscreen Toggle Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="p-1.5 w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/70 border border-white/10 rounded-full active:scale-95 transition-all cursor-pointer group/fs focus:outline-none"
            title={isFullscreen ? 'Keluar Layar Penuh (f)' : 'Layar Penuh (f)'}
            aria-label="Layar Penuh"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 text-white drop-shadow-md group-hover/fs:scale-110 transition-transform" />
            ) : (
              <Maximize className="w-4 h-4 text-white drop-shadow-md group-hover/fs:scale-110 transition-transform" />
            )}
          </button>

          {/* Quality Settings Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsQualityMenuOpen(!isQualityMenuOpen);
            }}
            className="relative p-1.5 w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/70 border border-white/10 rounded-full active:scale-95 transition-all cursor-pointer group/gear focus:outline-none"
            title="Setelan Kualitas Video"
            aria-label="Pengaturan Kualitas"
          >
            <Settings
              className={`w-4 h-4 text-white drop-shadow-md group-hover/gear:rotate-45 transition-all duration-300 ${
                isQualityMenuOpen ? 'rotate-45 text-red-400 opacity-100' : 'opacity-85 group-hover/gear:opacity-100'
              }`}
            />
            {qualityBadge && (
              <span className="absolute -top-1 -right-1 text-[7px] font-black bg-[#cc0000] text-white px-0.5 py-0 rounded-[2px] leading-none shadow-md tracking-tighter uppercase select-none pointer-events-none">
                {qualityBadge}
              </span>
            )}
          </button>

          {/* Quality Dropdown Menu */}
          {isQualityMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-10 right-0 w-52 bg-black/95 backdrop-blur-xl border border-neutral-700/80 rounded-2xl shadow-2xl z-50 p-2 animate-fade-in text-left"
            >
              <div className="px-3 py-2 text-[11px] font-bold text-neutral-300 border-b border-neutral-800/80 mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-white">
                  <Settings className="w-3.5 h-3.5 text-red-500" />
                  <span>Kualitas Video</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-normal">
                  Auto-save
                </span>
              </div>

              <div className="space-y-1 max-h-60 overflow-y-auto pr-0.5">
                {availableQualities.length > 0 ? (
                  availableQualities.map((qItem) => {
                    const isSelected = selectedQuality === qItem.quality;
                    return (
                      <button
                        key={qItem.quality}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectQuality(qItem.quality, qItem.label);
                          setIsQualityMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-red-600/20 text-red-400 border border-red-500/40 shadow-sm'
                            : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              isSelected ? 'bg-red-500 ring-2 ring-red-500/30' : 'bg-neutral-700'
                            }`}
                          />
                          <span className="truncate">{qItem.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-red-400 flex-shrink-0 ml-1.5" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-xs text-neutral-500">Auto (Default Server)</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Content Switcher */}
      {loadingStream ? (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="w-10 h-10 border-3 border-neutral-700 border-t-red-500 rounded-full animate-spin mb-3" />
          <p className="text-sm font-semibold text-white">Memuat streaming kualitas HD...</p>
          <p className="text-xs text-neutral-400 mt-1">Episode {episode} • Subtitle Indonesia</p>
        </div>
      ) : currentServer ? (
        currentServer.type === 'direct' ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              key={`direct-${activeVideoUrl}-${episode}`}
              src={activeVideoUrl}
              controls
              autoPlay={initialIsPlaying}
              playsInline
              onLoadedMetadata={onLoadedMetadata}
              onCanPlay={onCanPlay}
              onTimeUpdate={onTimeUpdate}
              onSeeked={onSeeked}
              onPlay={onPlay}
              onPause={onPause}
              onError={onError}
              className="w-full h-full object-contain"
            />
            {videoError && (
              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center z-30 animate-fade-in">
                <AlertCircle className="w-10 h-10 text-red-500 mb-2 animate-bounce" />
                <p className="text-sm font-bold text-white mb-1">{videoError}</p>
                <div className="flex items-center gap-2 mt-3">
                  {hasAlternativeServer && (
                    <button
                      onClick={onNextServer}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Coba Server Lain ({nextServerName})
                    </button>
                  )}
                  <button
                    onClick={onRetryServer}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Coba Lagi
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : currentServer.type === 'external' ? (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
            <Tv className="w-12 h-12 text-white mb-3" />
            <h3 className="text-base font-bold text-white mb-2">{currentServer.name}</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Tonton streaming resmi langsung melalui portal mitra penyedia.
            </p>
            <a
              href={currentServer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200"
            >
              Buka Pemutar <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            key={`embed-${currentServer.url}-${episode}`}
            src={(() => {
              const raw = getEmbedUrl(currentServer);
              return raw.includes('/api/pixuplay/embed-proxy')
                ? `${raw}${raw.includes('?') ? '&' : '?'}v=3`
                : raw;
            })()}
            title={`Pixuplay Cinema - ${title} Ep ${episode}`}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            className="w-full h-full border-0"
          />
        )
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm text-neutral-300 mb-3">Server pemutar belum merespons.</p>
          <button
            onClick={onRetryServer}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black font-bold text-xs rounded-xl cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Coba Server 1
          </button>
        </div>
      )}
    </div>
  );
};
