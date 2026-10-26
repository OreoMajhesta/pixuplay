import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Users,
  PictureInPicture,
  Minimize2,
  Film,
  Radio,
  Sparkles,
} from 'lucide-react';
import {
  Anime,
  StreamServer,
  StreamData,
  CommentItem,
  SavedItem,
  UserProfile,
} from '../types';
import {
  getAnimeTitle,
  getAnimePoster,
  getAnimeDetail,
  getStreamData,
  getInteractions,
  toggleLike,
  postComment,
  deleteComment,
  getOrCreateUserId,
} from '../api';
import {
  createNobarRoom,
  getNobarRoom,
  NobarClient,
  NobarRoomInfo,
  NobarChatMsg,
  NobarSyncEvent,
} from '../nobarSync';
import { sendWatchHeartbeat } from '../services/authService';
import { NobarRoomPanel } from '../components/NobarRoomPanel';
import { GENSHIN_REGIONS } from '../components/watch/WatchGenshinConfig';
import { WatchServerSelector } from '../components/watch/WatchServerSelector';
import { WatchMetadata } from '../components/watch/WatchMetadata';
import { WatchEpisodeList } from '../components/watch/WatchEpisodeList';
import { WatchDiscussion } from '../components/watch/WatchDiscussion';
import { WatchVideoPlayer } from '../components/watch/WatchVideoPlayer';

interface WatchPageProps {
  anime: Anime;
  episode: number;
  initialNobarRoomId?: string | null;
  initialResumeTime?: number;
  initialIsPlaying?: boolean;
  watchlist: SavedItem[];
  favorites: SavedItem[];
  allAnimeList?: Anime[];
  currentUser?: UserProfile | null;
  onOpenLogin?: () => void;
  onSelectEpisode: (ep: number) => void;
  onSelectAnime: (anime: Anime, isNobarSync?: boolean) => void;
  onToggleWatchlist: (anime: Anime) => void;
  onToggleFavorite: (anime: Anime) => void;
  onSaveHistory: (anime: Anime, ep: number, currentTime?: number, duration?: number) => void;
  onMinimize: (curTime?: number, isPlaying?: boolean) => void;
  onBackToHome: () => void;
  onNobarRoomChange?: (roomId: string | null) => void;
  onServerChange?: (server: StreamServer | null) => void;
  onPlaybackSync?: (curTime: number, isPlaying: boolean) => void;
}

export const WatchPage: React.FC<WatchPageProps> = ({
  anime,
  episode,
  initialNobarRoomId,
  initialResumeTime = 0,
  initialIsPlaying = true,
  watchlist,
  favorites,
  allAnimeList = [],
  currentUser = null,
  onOpenLogin,
  onSelectEpisode,
  onSelectAnime,
  onToggleWatchlist,
  onToggleFavorite,
  onSaveHistory,
  onMinimize,
  onBackToHome,
  onNobarRoomChange,
  onServerChange,
  onPlaybackSync,
}) => {
  const [detailedAnime, setDetailedAnime] = useState<Anime>(anime);

  useEffect(() => {
    setDetailedAnime(anime);
  }, [anime]);

  // Fetch full details if needed
  useEffect(() => {
    let isMounted = true;
    const animeKey = detailedAnime.animeId || detailedAnime.id;
    const desc = detailedAnime.description || '';
    const isGenericDesc =
      !desc ||
      desc.startsWith('Tonton streaming serial anime') ||
      desc.startsWith('Nonton streaming anime') ||
      desc.length < 80;
    const hasEpList = !!detailedAnime.episodeList && detailedAnime.episodeList.length > 0;
    const hasEpCount = !!detailedAnime.episodes && parseInt(String(detailedAnime.episodes)) > 1;

    if (animeKey && (isGenericDesc || (!hasEpList && !hasEpCount))) {
      getAnimeDetail(animeKey)
        .then((full) => {
          if (isMounted && full) {
            setDetailedAnime((prev) => ({
              ...prev,
              ...full,
              description: full.description || prev.description,
              episodeList: full.episodeList || prev.episodeList,
              episodes: full.episodes || prev.episodes,
              genres: full.genres || prev.genres,
            }));
          }
        })
        .catch(console.error);
    }
    return () => {
      isMounted = false;
    };
  }, [detailedAnime.animeId, detailedAnime.id, detailedAnime.description]);

  const title = getAnimeTitle(detailedAnime);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nobarClientRef = useRef<NobarClient | null>(null);
  const lastSavedTimeRef = useRef<number>(initialResumeTime || 0);
  const targetSeekTimeRef = useRef<number>(initialResumeTime || 0);
  const hasAppliedInitialSeekRef = useRef<boolean>(false);
  const heartbeatTimerRef = useRef<any>(null);

  useEffect(() => {
    if (initialResumeTime && initialResumeTime > 0) {
      targetSeekTimeRef.current = initialResumeTime;
      hasAppliedInitialSeekRef.current = false;
      lastSavedTimeRef.current = initialResumeTime;
    }
  }, [initialResumeTime, episode]);

  // Streaming State
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [activeServerIdx, setActiveServerIdx] = useState<number>(0);
  const [loadingStream, setLoadingStream] = useState<boolean>(true);

  // Quality state
  const [selectedQuality, setSelectedQuality] = useState<string>(() => {
    try {
      return localStorage.getItem('pixuplay_preferred_quality') || '720p';
    } catch {
      return '720p';
    }
  });

  // Normalize servers to Genshin regions
  const normalizedServers = useMemo(() => {
    const rawList = streamData?.servers || [];
    const cleanList = rawList.filter((s) => {
      const lower = `${s.name} ${s.label} ${s.url}`.toLowerCase();
      return !lower.includes('vidhide') && !lower.includes('bstation') && !lower.includes('wetv');
    });

    return cleanList.map((srv, idx) => {
      const regionData = GENSHIN_REGIONS[idx % GENSHIN_REGIONS.length];
      const regionName = srv.region || regionData.name;
      const maxQ = srv.maxQuality || srv.quality || '720p';
      const maxQText = maxQ.toLowerCase() === '1080p' ? '1080p FHD' : maxQ.toLowerCase() === '720p' ? '720p HD' : '480p SD';

      return {
        ...srv,
        name: `Server ${regionName}`,
        label: `${regionName} • Maks ${maxQText}`,
        region: regionName,
        maxQuality: maxQ,
        maxQualityLabel: `Maks ${maxQText}`,
      };
    });
  }, [streamData?.servers]);

  const currentServer = normalizedServers[activeServerIdx] || normalizedServers[0] || null;

  // Available qualities
  const availableQualities = useMemo(() => {
    if (!currentServer) return [];
    if (currentServer.qualities && currentServer.qualities.length > 0) {
      return currentServer.qualities;
    }
    const qStr = currentServer.quality || currentServer.maxQuality || '720p';
    const label = qStr.toLowerCase().includes('1080')
      ? '1080p Full HD'
      : qStr.toLowerCase().includes('720')
      ? '720p HD'
      : '480p SD';
    return [{ quality: qStr, label, url: currentServer.url }];
  }, [currentServer]);

  const activeQualityItem = useMemo(() => {
    if (availableQualities.length === 0) return null;
    return availableQualities.find((q) => q.quality === selectedQuality) || availableQualities[0];
  }, [availableQualities, selectedQuality]);

  const activeVideoUrl = currentServer?.type === 'direct'
    ? (activeQualityItem?.url || currentServer.url)
    : currentServer?.url;

  const qualityBadge = useMemo((): 'FHD' | 'HD' | 'SD' | null => {
    if (!currentServer) return null;
    const q = (activeQualityItem?.quality || currentServer.quality || currentServer.maxQuality || '').toLowerCase();
    if (q.includes('1080')) return 'FHD';
    if (q.includes('720')) return 'HD';
    if (q.includes('480') || q.includes('360')) return 'SD';
    return 'HD';
  }, [currentServer, activeQualityItem]);

  // Video error handling
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    setVideoError(null);
  }, [activeServerIdx, activeVideoUrl, episode]);

  const handleVideoError = () => {
    if (normalizedServers.length > 1) {
      const nextIdx = (activeServerIdx + 1) % normalizedServers.length;
      const nextServer = normalizedServers[nextIdx];
      setVideoError(`Video gagal dimuat di server saat ini. Mengalihkan ke ${nextServer?.name || 'server alternatif'}...`);
      setTimeout(() => {
        setActiveServerIdx(nextIdx);
        setVideoError(null);
      }, 1500);
    } else {
      setVideoError('Koneksi streaming video terputus atau format video tidak didukung browser.');
    }
  };

  // Sync server to miniplayer
  useEffect(() => {
    onServerChange?.(currentServer);
  }, [currentServer, onServerChange]);

  // Watchlist & Favorites check
  const isWatchlist = watchlist.some((x) => String(x.id) === String(detailedAnime.animeId || detailedAnime.id));
  const isFavorite = favorites.some((x) => String(x.id) === String(detailedAnime.animeId || detailedAnime.id));

  // Likes & Comments
  const [likes, setLikes] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [comments, setComments] = useState<CommentItem[]>([]);

  // Mobile Tabs & Sidebar
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'related'>('chat');
  const [mobileActiveTab, setMobileActiveTab] = useState<'chat' | 'comments' | 'detail'>('comments');

  // Nobar State
  const [nobarRoom, setNobarRoom] = useState<NobarRoomInfo | null>(null);
  const [nobarRole, setNobarRole] = useState<'host' | 'guest'>('guest');
  const [nobarConnected, setNobarConnected] = useState<boolean>(false);
  const [nobarChat, setNobarChat] = useState<NobarChatMsg[]>([]);
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: string; emoji: string; x: number; scale?: number }>>([]);

  // Fetch Stream Data
  useEffect(() => {
    let isMounted = true;
    setLoadingStream(true);
    const animeKey = detailedAnime.animeId || detailedAnime.id;

    getStreamData(animeKey, episode, title)
      .then((data) => {
        if (!isMounted) return;
        setStreamData(data);
        setActiveServerIdx(0);
        setLoadingStream(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load stream data:', err);
        setLoadingStream(false);
      });

    return () => {
      isMounted = false;
    };
  }, [detailedAnime.animeId, detailedAnime.id, episode, title]);

  // Fetch Interactions
  useEffect(() => {
    let isMounted = true;
    const animeKey = detailedAnime.animeId || detailedAnime.id;
    getInteractions(animeKey, episode).then((data) => {
      if (!isMounted || !data) return;
      setLikes(data.likesCount || 0);
      setHasLiked(Boolean(data.hasLiked));
      setComments(data.comments || []);
    });

    return () => {
      isMounted = false;
    };
  }, [detailedAnime.animeId, detailedAnime.id, episode]);

  // Watch Time Heartbeat for EXP
  useEffect(() => {
    heartbeatTimerRef.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        sendWatchHeartbeat(60, String(detailedAnime.animeId || detailedAnime.id), episode).catch(() => {});
      }
    }, 60000);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [detailedAnime.animeId, detailedAnime.id, episode]);

  // Max Episode calculation
  const maxEpisode = useMemo(() => {
    if (detailedAnime.episodeList && detailedAnime.episodeList.length > 0) {
      return detailedAnime.episodeList.length;
    }
    const epCount = parseInt(String(detailedAnime.episodes || '12'), 10);
    return isNaN(epCount) || epCount < 1 ? 12 : Math.max(epCount, episode);
  }, [detailedAnime.episodeList, detailedAnime.episodes, episode]);

  // Player handlers
  const handleCanPlay = () => {
    if (videoRef.current && targetSeekTimeRef.current > 0 && !hasAppliedInitialSeekRef.current) {
      videoRef.current.currentTime = targetSeekTimeRef.current;
      hasAppliedInitialSeekRef.current = true;
    }
  };

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (targetSeekTimeRef.current > 0 && !hasAppliedInitialSeekRef.current) {
      video.currentTime = targetSeekTimeRef.current;
      hasAppliedInitialSeekRef.current = true;
    }
  };

  const handleVideoSeeked = () => {
    if (videoRef.current) {
      const cur = Math.floor(videoRef.current.currentTime);
      onPlaybackSync?.(cur, !videoRef.current.paused);
      if (nobarRole === 'host' && nobarClientRef.current) {
        nobarClientRef.current.sendSync(
          videoRef.current.currentTime,
          !videoRef.current.paused,
          episode,
          currentServer?.url,
          String(detailedAnime.animeId || detailedAnime.id),
          title
        );
      }
    }
  };

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const cur = Math.floor(video.currentTime);
    const dur = Math.floor(video.duration);

    if (targetSeekTimeRef.current > 0 && !hasAppliedInitialSeekRef.current && cur === 0) return;

    onPlaybackSync?.(cur, !video.paused);
    if (dur > 0 && Math.abs(cur - lastSavedTimeRef.current) >= 4) {
      lastSavedTimeRef.current = cur;
      onSaveHistory(detailedAnime, episode, cur, dur);
    }
  };

  const handleVideoPlay = () => {
    if (videoRef.current) {
      const cur = Math.floor(videoRef.current.currentTime);
      onPlaybackSync?.(cur, true);
      if (nobarRole === 'host' && nobarClientRef.current) {
        nobarClientRef.current.sendSync(
          videoRef.current.currentTime,
          true,
          episode,
          currentServer?.url,
          String(detailedAnime.animeId || detailedAnime.id),
          title
        );
      }
    }
  };

  const handleVideoPause = () => {
    if (videoRef.current) {
      const cur = Math.floor(videoRef.current.currentTime);
      const dur = Math.floor(videoRef.current.duration);
      onPlaybackSync?.(cur, false);
      if (dur > 0) onSaveHistory(detailedAnime, episode, cur, dur);
      if (nobarRole === 'host' && nobarClientRef.current) {
        nobarClientRef.current.sendSync(
          videoRef.current.currentTime,
          false,
          episode,
          currentServer?.url,
          String(detailedAnime.animeId || detailedAnime.id),
          title
        );
      }
    }
  };

  // PiP handler
  const handleTogglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('Picture-in-Picture error:', err);
    }
  };

  // Like Toggle
  const handleToggleLike = async () => {
    const nextHasLiked = !hasLiked;
    setHasLiked(nextHasLiked);
    setLikes((prev) => (nextHasLiked ? prev + 1 : Math.max(0, prev - 1)));
    const res = await toggleLike(detailedAnime.animeId || detailedAnime.id, episode);
    if (res) {
      setHasLiked(res.hasLiked);
      setLikes(res.likesCount);
    }
  };

  // Submit Comment
  const handleSubmitComment = async (text: string) => {
    const currentUserName = currentUser?.name || localStorage.getItem('pixuplay_nickname') || 'Pengguna';
    const currentUserAvatar = currentUser?.avatar || localStorage.getItem('pixuplay_avatar') || '';
    const currentUserId = currentUser?.id || getOrCreateUserId();

    const res = await postComment(
      detailedAnime.animeId || detailedAnime.id,
      episode,
      currentUserName,
      currentUserAvatar,
      text,
      null,
      null,
      currentUserId
    );

    if (res) {
      setComments((prev) => [res, ...prev]);
      return true;
    }
    return false;
  };

  // Reply Comment
  const handleReplyComment = async (parentId: number | string, replyToUser: string, text: string) => {
    const currentUserName = currentUser?.name || localStorage.getItem('pixuplay_nickname') || 'Pengguna';
    const currentUserAvatar = currentUser?.avatar || localStorage.getItem('pixuplay_avatar') || '';
    const currentUserId = currentUser?.id || getOrCreateUserId();

    const res = await postComment(
      detailedAnime.animeId || detailedAnime.id,
      episode,
      currentUserName,
      currentUserAvatar,
      text,
      Number(parentId),
      replyToUser,
      currentUserId
    );

    if (res) {
      setComments((prev) =>
        prev.map((c) => (c.id === Number(parentId) ? { ...c, replies: [...(c.replies || []), res] } : c))
      );
      return true;
    }
    return false;
  };

  // Delete Comment
  const handleDeleteComment = async (commentId: number | string) => {
    const currentUid = currentUser?.id || getOrCreateUserId();
    const ok = await deleteComment(commentId, currentUid);
    if (ok) {
      setComments((prev) =>
        prev
          .filter((c) => c.id !== commentId)
          .map((c) => ({
            ...c,
            replies: (c.replies || []).filter((r) => r.id !== commentId),
          }))
      );
      return true;
    }
    return false;
  };

  const getEmbedUrl = (server: StreamServer) => {
    if (!server?.url) return '';
    return `/api/pixuplay/embed-proxy?url=${encodeURIComponent(server.url)}`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 space-y-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3 bg-[#121212] border border-white/5 rounded-2xl px-4 py-2.5">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs sm:text-sm font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Beranda</span>
        </button>

        <div className="flex items-center gap-2">
          {currentServer?.type === 'direct' && (
            <button
              onClick={handleTogglePiP}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer border border-white/10 text-xs font-semibold"
              title="Putar Video Terapung di Atas Aplikasi Lain"
            >
              <PictureInPicture className="w-3.5 h-3.5 text-red-500" />
              <span className="hidden sm:inline">PiP Terapung</span>
            </button>
          )}

          <button
            onClick={() => {
              const cur = videoRef.current ? Math.floor(videoRef.current.currentTime) : initialResumeTime;
              const isPlaying = videoRef.current ? !videoRef.current.paused : true;
              onMinimize(cur, isPlaying);
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer border border-white/10 text-xs font-semibold"
            title="Kecilkan ke Mini Player"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mini Player</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* Left Column (8 Cols): Video + Metadata + Servers + Episodes + Comments */}
        <div className="lg:col-span-8 space-y-4">
          <WatchVideoPlayer
            videoRef={videoRef}
            loadingStream={loadingStream}
            currentServer={currentServer}
            activeVideoUrl={activeVideoUrl}
            title={title}
            episode={episode}
            initialIsPlaying={initialIsPlaying}
            videoError={videoError}
            onClearVideoError={() => setVideoError(null)}
            onRetryServer={() => {
              setVideoError(null);
              if (videoRef.current) {
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
              }
            }}
            onNextServer={() => {
              const nextIdx = (activeServerIdx + 1) % normalizedServers.length;
              setActiveServerIdx(nextIdx);
              setVideoError(null);
            }}
            hasAlternativeServer={normalizedServers.length > 1}
            nextServerName={normalizedServers[(activeServerIdx + 1) % normalizedServers.length]?.region || 'Alternatif'}
            onLoadedMetadata={handleVideoLoadedMetadata}
            onCanPlay={handleCanPlay}
            onTimeUpdate={handleVideoTimeUpdate}
            onSeeked={handleVideoSeeked}
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onError={handleVideoError}
            getEmbedUrl={getEmbedUrl}
            floatingEmojis={floatingEmojis}
            availableQualities={availableQualities}
            selectedQuality={selectedQuality}
            onSelectQuality={(q, l) => {
              setSelectedQuality(q);
              try {
                localStorage.setItem('pixuplay_preferred_quality', q);
              } catch {}
            }}
            qualityBadge={qualityBadge}
          />

          <WatchMetadata
            anime={anime}
            detailedAnime={detailedAnime}
            episode={episode}
            maxEpisode={maxEpisode}
            likes={likes}
            hasLiked={hasLiked}
            onToggleLike={handleToggleLike}
            isWatchlist={isWatchlist}
            onToggleWatchlist={onToggleWatchlist}
            nobarRoom={nobarRoom}
            onOpenNobar={() => {
              setSidebarTab('chat');
              setMobileActiveTab('chat');
            }}
            mobileActiveTab={mobileActiveTab}
          />

          <WatchServerSelector
            servers={normalizedServers}
            activeServerIdx={activeServerIdx}
            onSelectServer={(idx) => {
              if (idx === activeServerIdx) return;
              if (videoRef.current) {
                const cur = Math.floor(videoRef.current.currentTime);
                if (cur > 0) {
                  targetSeekTimeRef.current = cur;
                  hasAppliedInitialSeekRef.current = false;
                }
              }
              setActiveServerIdx(idx);
            }}
            currentServer={currentServer}
          />

          <WatchEpisodeList
            episode={episode}
            maxEpisode={maxEpisode}
            onSelectEpisode={onSelectEpisode}
          />

          <WatchDiscussion
            comments={comments}
            currentUser={currentUser}
            onOpenLogin={onOpenLogin}
            onSubmitComment={handleSubmitComment}
            onReplyComment={handleReplyComment}
            onDeleteComment={handleDeleteComment}
            mobileActiveTab={mobileActiveTab}
          />
        </div>

        {/* Right Column (4 Cols): Live Chat Nobar & Related Sidebar */}
        <div className="hidden lg:flex lg:col-span-4 flex-col gap-4 sticky top-20">
          <div className="flex items-center bg-[#141414] border border-white/5 rounded-xl p-1 gap-1">
            <button
              onClick={() => setSidebarTab('chat')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sidebarTab === 'chat' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Chat</span>
              {nobarRoom && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
            </button>

            <button
              onClick={() => setSidebarTab('related')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                sidebarTab === 'related' ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Terkait</span>
            </button>
          </div>

          {sidebarTab === 'chat' && (
            <div className="h-[580px]">
              <NobarRoomPanel
                room={nobarRoom}
                role={nobarRole}
                isConnected={nobarConnected}
                chatMessages={nobarChat}
                onSendMessage={(txt) => {
                  if (nobarClientRef.current) nobarClientRef.current.sendChat(txt);
                }}
                onSendReaction={(em) => {
                  if (nobarClientRef.current) nobarClientRef.current.sendReaction(em);
                }}
                onCreateRoom={async (hostName) => {
                  const res = await createNobarRoom(
                    detailedAnime.animeId || detailedAnime.id,
                    title,
                    episode,
                    currentServer?.url || '',
                    currentUser?.name || hostName || 'Host'
                  );
                  if (res && res.room) {
                    setNobarRoom(res.room);
                    setNobarRole('host');
                    onNobarRoomChange?.(res.roomId);
                  }
                }}
                onLeaveRoom={() => {
                  if (nobarClientRef.current) nobarClientRef.current.destroy();
                  setNobarRoom(null);
                  onNobarRoomChange?.(null);
                }}
                defaultUserName={currentUser?.name}
              />
            </div>
          )}

          {sidebarTab === 'related' && (
            <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 space-y-3 max-h-[580px] overflow-y-auto">
              <h3 className="text-xs font-bold text-neutral-300">Anime Rekomendasi Terkait</h3>
              <div className="space-y-2">
                {allAnimeList.slice(0, 8).map((rel) => (
                  <div
                    key={rel.id || rel.animeId}
                    onClick={() => onSelectAnime(rel)}
                    className="flex items-center gap-3 p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-800 transition-colors cursor-pointer border border-white/5"
                  >
                    <img
                      src={getAnimePoster(rel)}
                      alt={getAnimeTitle(rel)}
                      className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{getAnimeTitle(rel)}</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        {rel.status === 'RELEASING' ? 'Ongoing' : 'Tamat'} • {rel.episodes || '?'} Ep
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
