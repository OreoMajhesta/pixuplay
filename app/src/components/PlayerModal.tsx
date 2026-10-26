import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  Tv,
  Heart,
  Bookmark,
  Share2,
  ExternalLink,
  RefreshCw,
  Users,
  Crown,
  Radio,
  Send,
  SkipBack,
  SkipForward,
  MessageSquare,
  Trash2,
  CornerDownRight,
} from 'lucide-react';
import { Anime, StreamServer, StreamData, CommentItem } from '../types';
import {
  getAnimeTitle,
  getStreamData,
  getInteractions,
  postComment,
  toggleLike,
  deleteComment,
  getOrCreateGuestName,
  getOrCreateUserId,
} from '../api';
import {
  NobarClient,
  NobarRoomInfo,
  NobarChatMsg,
  NobarSyncEvent,
  createNobarRoom,
  getNobarRoom,
} from '../nobarSync';
import { NobarRoomPanel } from './NobarRoomPanel';

interface PlayerModalProps {
  anime: Anime | null;
  episode: number;
  isOpen: boolean;
  onClose: () => void;
  onMinimize: (currentTime?: number) => void;
  onSelectEpisode: (ep: number) => void;
  onServerChange: (srv: StreamServer | null) => void;
  isFavorite: boolean;
  onToggleFavorite: (anime: Anime) => void;
  onSaveHistory: (anime: Anime, ep: number, currentTime?: number, duration?: number) => void;
  initialResumeTime?: number;
  initialNobarRoomId?: string | null;
  onNobarRoomChange?: (roomId: string | null) => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  anime,
  episode,
  isOpen,
  onClose,
  onMinimize,
  onSelectEpisode,
  onServerChange,
  isFavorite,
  onToggleFavorite,
  onSaveHistory,
  initialResumeTime = 0,
  initialNobarRoomId,
  onNobarRoomChange,
}) => {
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [activeServerIdx, setActiveServerIdx] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isTheater, setIsTheater] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [likes, setLikes] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [isLiking, setIsLiking] = useState<boolean>(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState<boolean>(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<{ id: number | string; parentId?: number | string | null; user: string } | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Nobar (Watch Party) States
  const [isNobarOpen, setIsNobarOpen] = useState<boolean>(false);
  const [nobarRoom, setNobarRoom] = useState<NobarRoomInfo | null>(null);
  const [nobarRole, setNobarRole] = useState<'host' | 'guest' | null>(null);
  const [nobarConnected, setNobarConnected] = useState<boolean>(false);
  const [nobarChat, setNobarChat] = useState<NobarChatMsg[]>([]);
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: number; emoji: string; x: number }>>([]);
  const [syncStatusText, setSyncStatusText] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const nobarClientRef = useRef<NobarClient | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const hasAppliedInitialSeekRef = useRef<boolean>(false);

  // Resume notification handler
  useEffect(() => {
    hasAppliedInitialSeekRef.current = false;
    lastSavedTimeRef.current = initialResumeTime || 0;
    if (initialResumeTime && initialResumeTime > 5) {
      const m = Math.floor(initialResumeTime / 60);
      const s = Math.floor(initialResumeTime % 60);
      setResumeNotice(`Melanjutkan episode dari ${m}:${s < 10 ? '0' : ''}${s}`);
      const t = setTimeout(() => setResumeNotice(null), 4000);
      return () => clearTimeout(t);
    } else {
      setResumeNotice(null);
    }
  }, [anime?.id, episode, initialResumeTime]);

  // Fetch Stream Data
  useEffect(() => {
    if (!anime || !isOpen) return;

    let isMounted = true;
    setLoading(true);
    setActiveServerIdx(0);

    const title = getAnimeTitle(anime);
    const fetchStream = async () => {
      const data = await getStreamData(anime.animeId || anime.id, episode, title);
      if (isMounted) {
        setStreamData(data);
        const initialServer = data?.servers?.[0] || null;
        onServerChange(initialServer);
        setLoading(false);
        // Save initial history entry with current resume time
        onSaveHistory(anime, episode, initialResumeTime || 0, 1440);
      }
    };

    fetchStream();
    return () => {
      isMounted = false;
    };
  }, [anime, episode, isOpen]);

  // Connect to Nobar if initialNobarRoomId was provided via URL
  useEffect(() => {
    if (!initialNobarRoomId || !isOpen) return;

    if (nobarRoom?.id === initialNobarRoomId && nobarRole) {
      return;
    }

    let isMounted = true;
    const connectToInitialRoom = async () => {
      const room = await getNobarRoom(initialNobarRoomId);
      if (isMounted && room) {
        let isHost = false;
        try {
          const savedHostId = localStorage.getItem(`pixuplay_nobar_host_${room.id}`);
          if (savedHostId && savedHostId === room.hostId) {
            isHost = true;
          }
        } catch {}

        if (nobarRole === 'host') {
          isHost = true;
        }

        const role: 'host' | 'guest' = isHost ? 'host' : 'guest';
        const savedName =
          localStorage.getItem(`pixuplay_nobar_hostname_${room.id}`) ||
          getOrCreateGuestName();

        setNobarRoom(room);
        setNobarRole(role);
        setNobarChat(room.chat || []);
        setIsNobarOpen(true);
        startNobarClient(room.id, role, savedName);
      }
    };

    connectToInitialRoom();
    return () => {
      isMounted = false;
    };
  }, [initialNobarRoomId, isOpen, nobarRoom?.id, nobarRole]);

  // Sync server change with parent
  const handleServerSelect = (idx: number) => {
    setActiveServerIdx(idx);
    const srv = streamData?.servers?.[idx] || null;
    onServerChange(srv);
  };

  // Dynamic fetch interactions (Likes & Comments from SQLite WAL)
  useEffect(() => {
    if (!anime || !isOpen) return;

    let isMounted = true;
    setIsCommentsLoading(true);

    const animeKey = anime.animeId || anime.id;
    getInteractions(animeKey, episode)
      .then((res) => {
        if (isMounted && res) {
          setLikes(res.likesCount);
          setHasLiked(res.hasLiked);
          setComments(res.comments || []);
          setIsCommentsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('[PlayerModal] Failed to load interactions:', err);
        if (isMounted) setIsCommentsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [anime?.id, anime?.animeId, episode, isOpen]);

  const handleToggleLike = async () => {
    if (!anime || isLiking) return;
    setIsLiking(true);

    // Optimistic toggle
    const nextHasLiked = !hasLiked;
    const nextLikesCount = nextHasLiked ? likes + 1 : Math.max(0, likes - 1);
    setHasLiked(nextHasLiked);
    setLikes(nextLikesCount);

    const animeKey = anime.animeId || anime.id;
    const res = await toggleLike(animeKey, episode);
    if (res) {
      setHasLiked(res.hasLiked);
      setLikes(res.likesCount);
    }
    setIsLiking(false);
  };

  const currentUserId = useMemo(() => getOrCreateUserId(), []);

  const totalCommentsCount = useMemo(() => {
    return comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
  }, [comments]);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !anime || isSubmittingComment) return;

    const text = newComment.trim();
    setIsSubmittingComment(true);

    const savedNickname = getOrCreateGuestName();
    let savedAvatar = '';
    try {
      savedAvatar = localStorage.getItem('pixuplay_avatar') || '';
    } catch {}

    const targetParentId = replyingTo ? (replyingTo.parentId || replyingTo.id) : null;
    const targetReplyUser = replyingTo ? replyingTo.user : null;

    const tempComment: CommentItem = {
      id: `temp_${Date.now()}`,
      userId: currentUserId,
      parentId: targetParentId ? Number(targetParentId) : null,
      replyToUser: targetReplyUser,
      user: savedNickname,
      avatar: savedAvatar,
      text: text,
      time: 'Baru saja',
      replies: [],
    };

    if (targetParentId) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === targetParentId
            ? { ...c, replies: [...(c.replies || []), tempComment] }
            : c
        )
      );
    } else {
      setComments((prev) => [tempComment, ...prev]);
    }

    setNewComment('');
    setReplyingTo(null);

    const animeKey = anime.animeId || anime.id;
    const created = await postComment(
      animeKey,
      episode,
      savedNickname,
      savedAvatar,
      text,
      targetParentId ? Number(targetParentId) : null,
      targetReplyUser
    );

    if (created) {
      if (targetParentId) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === targetParentId
              ? {
                  ...c,
                  replies: (c.replies || []).map((r) =>
                    r.id === tempComment.id ? created : r
                  ),
                }
              : c
          )
        );
      } else {
        setComments((prev) =>
          prev.map((c) => (c.id === tempComment.id ? created : c))
        );
      }
    }
    setIsSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: number | string) => {
    if (!window.confirm('Yakin ingin menghapus komentar ini?')) return;
    const ok = await deleteComment(commentId);
    if (ok) {
      setComments((prev) =>
        prev
          .filter((c) => c.id !== commentId)
          .map((c) => ({
            ...c,
            replies: (c.replies || []).filter((r) => r.id !== commentId),
          }))
      );
    }
  };

  const handleStartReply = (item: CommentItem, parentId?: number | string | null) => {
    setReplyingTo({
      id: item.id || 0,
      parentId: parentId || item.parentId || item.id,
      user: item.user,
    });
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 50);
  };

  // Real episode list calculation & Max Episode boundary protection (always sorted ascending)
  const episodeNumbers = useMemo(() => {
    if (!anime) return [1];
    if (anime.episodeList && anime.episodeList.length > 0) {
      const nums = anime.episodeList.map((ep, idx) => {
        const num = parseInt(String(ep.title).replace(/[^0-9]/g, ''), 10);
        return isNaN(num) ? idx + 1 : num;
      });
      const unique = Array.from(new Set(nums));
      unique.sort((a, b) => a - b);
      return unique;
    }
    const total = Math.min(Math.max(Number(anime.episodes) || 12, 1), 48);
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [anime]);

  const maxEpisode = useMemo(() => {
    if (episodeNumbers.length > 0) {
      return Math.max(...episodeNumbers);
    }
    const epNum = parseInt(String(anime?.episodes).replace(/[^0-9]/g, ''), 10);
    return !isNaN(epNum) && epNum > 0 ? epNum : 1;
  }, [episodeNumbers, anime?.episodes]);

  // Boundary check: auto-correct episode if it exceeds max available
  useEffect(() => {
    if (maxEpisode && episode > maxEpisode) {
      onSelectEpisode(maxEpisode);
    }
  }, [maxEpisode, episode, onSelectEpisode]);

  // ============================================================
  // NOBAR REALTIME SYNC HANDLERS
  // ============================================================
  const triggerReactionAnimation = (emoji: string) => {
    const id = Date.now() + Math.random();
    const x = Math.floor(Math.random() * 80) + 10;
    setFloatingEmojis((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 2000);
  };

  const startNobarClient = (roomId: string, role: 'host' | 'guest', userName: string) => {
    nobarClientRef.current?.destroy();

    const client = new NobarClient(roomId, role, userName);

    client.onStatusChange = (connected) => {
      setNobarConnected(connected);
      if (connected) {
        setSyncStatusText(role === 'host' ? 'Host Aktif' : 'Tersinkron dengan Host');
      } else {
        setSyncStatusText('Menghubungkan ulang...');
      }
    };

    client.onChat = (msg) => {
      setNobarChat((prev) => [...prev, msg]);
    };

    client.onReaction = (emoji) => {
      triggerReactionAnimation(emoji);
    };

    client.onSync = (ev: NobarSyncEvent) => {
      if (role === 'guest' && videoRef.current) {
        const drift = Math.abs(videoRef.current.currentTime - ev.currentTime);
        if (drift > 1.5) {
          videoRef.current.currentTime = ev.currentTime;
        }
        if (ev.isPlaying && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        } else if (!ev.isPlaying && !videoRef.current.paused) {
          videoRef.current.pause();
        }

        if (ev.episode && ev.episode !== episode) {
          onSelectEpisode(ev.episode);
        }
      }
    };

    nobarClientRef.current = client;
  };

  const handleCreateNobarRoom = async (name: string) => {
    if (!anime) return;
    const res = await createNobarRoom(
      anime.animeId || anime.id,
      getAnimeTitle(anime),
      episode,
      streamData?.servers?.[activeServerIdx]?.url || '',
      name || 'Host'
    );

    if (res && res.room) {
      const room = res.room;
      try {
        localStorage.setItem(`pixuplay_nobar_host_${room.id}`, res.hostId);
        localStorage.setItem(`pixuplay_nobar_hostname_${room.id}`, name || 'Host');
      } catch {}

      setNobarRoom(room);
      setNobarRole('host');
      setNobarChat(room.chat || []);
      setIsNobarOpen(true);
      if (onNobarRoomChange) onNobarRoomChange(room.id);
      startNobarClient(room.id, 'host', name || 'Host');
    }
  };

  const handleLeaveNobarRoom = () => {
    nobarClientRef.current?.destroy();
    setNobarRoom(null);
    setNobarRole(null);
    setNobarConnected(false);
    setNobarChat([]);
    setIsNobarOpen(false);
    if (onNobarRoomChange) onNobarRoomChange(null);
  };

  const handleSendNobarMessage = (text: string) => {
    nobarClientRef.current?.sendChat(text);
  };

  const handleSendNobarReaction = (emoji: string) => {
    nobarClientRef.current?.sendReaction(emoji);
    triggerReactionAnimation(emoji);
  };

  // Video Event Handlers & Progress Tracking
  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (initialResumeTime && initialResumeTime > 0 && !hasAppliedInitialSeekRef.current) {
      hasAppliedInitialSeekRef.current = true;
      try {
        video.currentTime = initialResumeTime;
      } catch (err) {
        console.warn('Could not seek to initial resume time', err);
      }
    }
  };

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const cur = Math.floor(video.currentTime);
    const dur = Math.floor(video.duration);
    if (dur > 0 && Math.abs(cur - lastSavedTimeRef.current) >= 4) {
      lastSavedTimeRef.current = cur;
      if (anime) {
        onSaveHistory(anime, episode, cur, dur);
      }
    }
  };

  const handleVideoPlay = () => {
    if (nobarRole === 'host' && videoRef.current && nobarClientRef.current) {
      nobarClientRef.current.sendSync(
        videoRef.current.currentTime,
        true,
        episode,
        streamData?.servers?.[activeServerIdx]?.url
      );
    }
  };

  const handleVideoPause = () => {
    if (nobarRole === 'host' && videoRef.current && nobarClientRef.current) {
      nobarClientRef.current.sendSync(
        videoRef.current.currentTime,
        false,
        episode,
        streamData?.servers?.[activeServerIdx]?.url
      );
    }
    if (videoRef.current && anime) {
      const cur = Math.floor(videoRef.current.currentTime);
      const dur = Math.floor(videoRef.current.duration);
      if (dur > 0) {
        lastSavedTimeRef.current = cur;
        onSaveHistory(anime, episode, cur, dur);
      }
    }
  };

  const handleVideoSeeked = () => {
    if (nobarRole === 'host' && videoRef.current && nobarClientRef.current) {
      nobarClientRef.current.sendSync(
        videoRef.current.currentTime,
        !videoRef.current.paused,
        episode,
        streamData?.servers?.[activeServerIdx]?.url
      );
    }
    if (videoRef.current && anime) {
      const cur = Math.floor(videoRef.current.currentTime);
      const dur = Math.floor(videoRef.current.duration);
      if (dur > 0) {
        lastSavedTimeRef.current = cur;
        onSaveHistory(anime, episode, cur, dur);
      }
    }
  };

  // Embed iframe progress tracker fallback
  useEffect(() => {
    if (!isOpen || !anime || !streamData) return;
    const currentServer = streamData?.servers?.[activeServerIdx];
    if (!currentServer || currentServer.type === 'direct') return;

    let elapsedSeconds = initialResumeTime || 0;
    const estDuration = 1440; // 24 minutes standard episode

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        elapsedSeconds += 5;
        lastSavedTimeRef.current = elapsedSeconds;
        onSaveHistory(anime, episode, elapsedSeconds, estDuration);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [isOpen, anime, episode, streamData, activeServerIdx, initialResumeTime]);

  // Host Periodic Sync Heartbeat (Every 2 seconds)
  useEffect(() => {
    if (nobarRole !== 'host' || !nobarRoom) return;

    const interval = setInterval(() => {
      if (videoRef.current && nobarClientRef.current && !videoRef.current.paused) {
        nobarClientRef.current.sendSync(
          videoRef.current.currentTime,
          true,
          episode,
          streamData?.servers?.[activeServerIdx]?.url
        );
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [nobarRole, nobarRoom, episode, activeServerIdx, streamData]);

  // Clean up Nobar client on unmount
  useEffect(() => {
    return () => {
      nobarClientRef.current?.destroy();
    };
  }, []);

  // Minimize with current playback time preservation
  const handleMinimizeClick = () => {
    let curTime = 0;
    if (videoRef.current && !isNaN(videoRef.current.currentTime)) {
      curTime = Math.floor(videoRef.current.currentTime);
      const dur = Math.floor(videoRef.current.duration) || 1440;
      if (anime) onSaveHistory(anime, episode, curTime, dur);
    } else {
      curTime = lastSavedTimeRef.current || initialResumeTime || 0;
    }
    onMinimize(curTime);
  };

  if (!isOpen || !anime) return null;

  const title = getAnimeTitle(anime);
  const currentServer = streamData?.servers?.[activeServerIdx] || null;

  const getEmbedUrl = (srv: StreamServer) => {
    if (srv.url.includes('desustream.net') && !srv.url.includes('/api/pixuplay/embed-proxy')) {
      return `/api/pixuplay/embed-proxy?url=${encodeURIComponent(srv.url)}`;
    }
    return srv.url;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md animate-fade-in overflow-hidden">
      <div
        className={`relative w-full ${
          isMaximized
            ? 'fixed inset-0 w-full h-full max-w-none max-h-none rounded-none z-50'
            : `${isNobarOpen || isTheater ? 'max-w-7xl' : 'max-w-5xl'} max-h-[92vh] rounded-none md:rounded-xl`
        } bg-card border border-subtle overflow-hidden shadow-2xl flex flex-col transition-all duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topbar Controls */}
        <div className="flex items-center justify-between px-4 py-3 bg-black border-b border-subtle flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base sm:text-lg font-black text-white truncate max-w-sm sm:max-w-md">
              {title}
            </h2>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onSelectEpisode(Math.max(1, episode - 1))}
                disabled={episode <= 1}
                className={`p-1 rounded text-muted hover:text-white hover:bg-surface transition-colors cursor-pointer ${
                  episode <= 1 ? 'opacity-30 cursor-not-allowed text-neutral-600' : ''
                }`}
                title={episode <= 1 ? 'Sudah episode pertama' : 'Episode Sebelumnya'}
                aria-label="Previous episode"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-black px-2 py-0.5 bg-white text-black rounded-xs flex-shrink-0">
                Episode {episode}
              </span>
              <button
                onClick={() => onSelectEpisode(Math.min(maxEpisode, episode + 1))}
                disabled={maxEpisode !== undefined && episode >= maxEpisode}
                className={`p-1 rounded text-muted hover:text-white hover:bg-surface transition-colors cursor-pointer ${
                  maxEpisode !== undefined && episode >= maxEpisode
                    ? 'opacity-30 cursor-not-allowed text-neutral-600'
                    : ''
                }`}
                title={
                  maxEpisode !== undefined && episode >= maxEpisode
                    ? `Episode terakhir (${maxEpisode})`
                    : 'Episode Selanjutnya'
                }
                aria-label="Next episode"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Nobar Active Pill in Topbar */}
            {nobarRoom && (
              <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-900 border border-white/30 text-[11px] font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {nobarRole === 'host' ? '👑 Host Nobar' : '👥 Peserta Nobar'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* NOBAR (WATCH PARTY) BUTTON */}
            <button
              onClick={() => setIsNobarOpen(!isNobarOpen)}
              className={`p-2 rounded-md border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                isNobarOpen || nobarRoom
                  ? 'bg-white text-black border-white shadow'
                  : 'text-neutral-300 hover:text-white hover:bg-surface border-transparent hover:border-subtle'
              }`}
              title="Fitur Nonton Bareng (Nobar) Realtime"
              aria-label="Watch party button"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">
                {nobarRoom ? 'Nobar Aktif' : 'Nonton Bareng'}
              </span>
              {nobarRoom && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
            </button>

            {/* MINIMIZE BUTTON (TO FLOATING MINI PLAYER) */}
            <button
              onClick={handleMinimizeClick}
              className="p-2 rounded-md text-muted hover:text-white hover:bg-surface border border-transparent hover:border-subtle transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Minimize ke sudut layar (Floating PiP)"
              aria-label="Minimize player"
            >
              <Minimize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Minimize</span>
            </button>

            {/* MAXIMIZE / RESTORE BUTTON */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className={`p-2 rounded-md border transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                isMaximized
                  ? 'bg-white text-black border-white font-bold'
                  : 'text-muted hover:text-white hover:bg-surface border-transparent hover:border-subtle'
              }`}
              title={isMaximized ? 'Kembalikan Ukuran Normal' : 'Perbesar Layar Penuh (Maximize)'}
              aria-label={isMaximized ? 'Restore player' : 'Maximize player'}
            >
              <Maximize2 className="w-4 h-4" />
              <span className="hidden sm:inline">{isMaximized ? 'Pulihkan' : 'Maximize'}</span>
            </button>

            {/* THEATER MODE BUTTON */}
            {!isMaximized && (
              <button
                onClick={() => setIsTheater(!isTheater)}
                className={`p-2 rounded-md border transition-all cursor-pointer ${
                  isTheater
                    ? 'bg-neutral-800 text-white border-white/40'
                    : 'text-muted hover:text-white hover:bg-surface border-transparent hover:border-subtle'
                }`}
                title="Mode Teater Lebar"
              >
                <Tv className="w-4 h-4" />
              </button>
            )}

            {/* CLOSE BUTTON */}
            <button
              onClick={onClose}
              className="p-2 rounded-md text-muted hover:text-white hover:bg-surface border border-transparent hover:border-subtle transition-all cursor-pointer"
              title="Tutup Pemutar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Player + Side Nobar Layout */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Video & Media Controls */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Video Screen */}
            <div
              className={`relative w-full ${
                isMaximized
                  ? 'flex-1 min-h-0'
                  : 'aspect-video max-h-[46vh] sm:max-h-[52vh]'
              } bg-black flex items-center justify-center overflow-hidden flex-shrink-0`}
            >
              {/* Resume Playback Notice */}
              {resumeNotice && (
                <div className="absolute top-4 left-4 z-40 flex items-center gap-2 px-3.5 py-1.5 bg-black/90 border border-white/30 text-white text-xs font-bold rounded-lg shadow-2xl backdrop-blur-md animate-fade-in pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span>{resumeNotice}</span>
                </div>
              )}

              {/* Nobar Active Floating Banner Overlay */}
              {nobarRoom && (
                <div className="absolute top-3 left-3 right-3 z-30 pointer-events-none flex items-center justify-between">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-black/85 backdrop-blur-md border border-white/20 rounded-md text-xs font-bold text-white shadow-xl">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    {nobarRole === 'host' ? (
                      <span className="flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5 fill-white" />
                        Host • Penonton lain tersinkron dengan waktu Anda
                      </span>
                    ) : (
                      <span>
                        Peserta Nobar • Mengikuti waktu Host ({nobarRoom.hostName})
                      </span>
                    )}
                  </div>

                  {syncStatusText && (
                    <span className="px-2.5 py-1 bg-black/85 border border-white/10 rounded text-[11px] font-mono text-neutral-300">
                      {syncStatusText}
                    </span>
                  )}
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-10 h-10 border-3 border-neutral-700 border-t-white rounded-full animate-spin mb-3" />
                  <p className="text-sm font-semibold text-white">Menghubungkan ke server streaming Otakudesu...</p>
                  <p className="text-xs text-muted mt-1">Mengambil tautan Sub Indo bebas blokir</p>
                </div>
              ) : currentServer ? (
                currentServer.type === 'direct' ? (
                  // Native HTML5 Direct MP4 Video Player with Nobar Sync Hooks
                  <video
                    ref={videoRef}
                    src={currentServer.url}
                    controls
                    autoPlay
                    playsInline
                    onLoadedMetadata={handleVideoLoadedMetadata}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    onSeeked={handleVideoSeeked}
                    className="w-full h-full object-contain"
                  />
                ) : currentServer.type === 'external' ? (
                  // External Fallback Portal Card
                  <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
                    <Tv className="w-12 h-12 text-white mb-3" />
                    <h3 className="text-base font-bold text-white mb-2">{currentServer.name}</h3>
                    <p className="text-xs text-muted mb-4">
                      Tonton streaming kualitas Full HD Sub Indo langsung di penyedia.
                    </p>
                    <div className="flex gap-2">
                      <a
                        href={currentServer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-bold text-xs rounded-md hover:bg-neutral-200"
                      >
                        Buka di Tab Baru <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleServerSelect(0)}
                        className="px-4 py-2.5 bg-surface border border-subtle text-white font-semibold text-xs rounded-md hover:border-white"
                      >
                        Server 1 ↺
                      </button>
                    </div>
                  </div>
                ) : (
                  // Proxied Web Embed Player (CSP frame-ancestors completely bypassed via proxy)
                  <iframe
                    src={getEmbedUrl(currentServer)}
                    title={`Pixuplay Cinema - ${title} Ep ${episode}`}
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    className="w-full h-full border-0"
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-sm text-neutral-300 mb-3">Server tidak merespons.</p>
                  <button
                    onClick={() => handleServerSelect(0)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black font-bold text-xs rounded-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang Server
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable Details Area Below Video (Server selection, episode list, comments) */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* Sub Indo Status Bar (Moved cleanly outside video to never block video timeline slider) */}
              {currentServer && currentServer.type !== 'external' && (
                <div className="flex items-center justify-between px-4 py-2 bg-neutral-950 border-b border-subtle text-xs text-muted">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black px-1.5 py-0.5 bg-white text-black rounded-xs">
                      SUB INDO
                    </span>
                    <span className="truncate max-w-[200px] sm:max-w-md text-white font-semibold text-[11px]">
                      {currentServer.name}
                    </span>
                  </div>
                  <a
                    href={currentServer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-white border border-subtle px-2 py-0.5 rounded transition-colors"
                  >
                    Buka di Tab Baru <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Server Selection Bar */}
              <div className="px-4 py-2.5 bg-surface border-b border-subtle flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-xs font-bold text-muted uppercase flex-shrink-0">
                  Server:
                </span>
                <div className="flex items-center gap-1.5 flex-nowrap">
                  {(streamData?.servers || []).map((srv, idx) => {
                    const displayName = srv.region
                      ? `Server ${srv.region} (${srv.maxQualityLabel || 'Maks 720p HD'})`
                      : srv.name;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleServerSelect(idx)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                          activeServerIdx === idx
                            ? 'bg-white text-black font-bold'
                            : 'bg-card border border-subtle text-muted hover:text-white hover:border-white'
                        }`}
                      >
                        {displayName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Episode Selector Strip */}
              <div className="p-4 bg-card border-b border-subtle">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Daftar Episode ({episodeNumbers.length})
                  </span>
                  {nobarRole === 'guest' && (
                    <span className="text-[11px] text-muted">
                      Episode dikontrol oleh Host Nobar
                    </span>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {episodeNumbers.map((ep) => (
                    <button
                      key={ep}
                      onClick={() => {
                        onSelectEpisode(ep);
                        if (nobarRole === 'host' && nobarClientRef.current) {
                          nobarClientRef.current.sendSync(0, true, ep);
                        }
                      }}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        ep === episode
                          ? 'bg-white text-black shadow'
                          : 'bg-surface border border-subtle text-muted hover:text-white hover:border-white'
                      }`}
                    >
                      Ep {ep}
                    </button>
                  ))}
                </div>
              </div>

              {/* Social Actions & Comments Section */}
              <div className="p-4 sm:p-6 bg-card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-subtle">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleLike}
                      disabled={isLiking}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        hasLiked
                          ? 'bg-white text-black border-white shadow-sm'
                          : 'bg-surface border-subtle text-white hover:border-white'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 transition-transform active:scale-125 ${hasLiked ? 'fill-rose-500 text-rose-500' : 'text-neutral-400'}`} />
                      <span>{likes} {hasLiked ? 'Disukai' : 'Suka'}</span>
                    </button>

                    <button
                      onClick={() => onToggleFavorite(anime)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        isFavorite
                          ? 'bg-white text-black border-white font-bold'
                          : 'bg-surface border-subtle text-white hover:border-white'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isFavorite ? 'fill-black' : ''}`} />
                      <span>{isFavorite ? 'Tersimpan' : 'Simpan'}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(window.location.href);
                          alert('Tautan disalin ke papan klip!');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-subtle hover:border-white rounded-md text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Bagikan</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-muted flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{totalCommentsCount} Komentar</span>
                  </div>
                </div>

                {/* Replying Banner */}
                {replyingTo && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-surface border border-subtle rounded-md text-xs text-neutral-300 animate-fade-in">
                    <span className="flex items-center gap-1.5 truncate">
                      <CornerDownRight className="w-3.5 h-3.5 text-white" />
                      Membalas ke <strong className="text-white font-mono font-bold">@{replyingTo.user}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="text-neutral-400 hover:text-white text-xs px-1 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}

                {/* Comment Form */}
                <form onSubmit={handleSendComment} className="flex gap-2">
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={
                      replyingTo
                        ? `Tulis balasan untuk @${replyingTo.user}...`
                        : "Tulis tanggapan atau komentar episode ini..."
                    }
                    disabled={isSubmittingComment}
                    className="flex-1 bg-surface border border-subtle focus:border-white px-3 py-2 rounded-md text-xs text-white placeholder-muted outline-none transition-colors disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !newComment.trim()}
                    className="px-4 py-2 bg-white text-black font-bold text-xs rounded-md hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" /> {isSubmittingComment ? 'Mengirim...' : replyingTo ? 'Balas' : 'Kirim'}
                  </button>
                </form>

                {/* Comments List */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {isCommentsLoading ? (
                    <div className="py-6 text-center text-xs text-muted">Memuat komentar episode...</div>
                  ) : comments.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted border border-dashed border-subtle/60 rounded-md">
                      Belum ada komentar untuk episode ini. Jadilah yang pertama berkomentar!
                    </div>
                  ) : (
                    comments.map((c, i) => {
                      const isMyComment = c.userId === currentUserId;
                      return (
                        <div key={c.id || i} className="p-3 bg-surface rounded-md border border-subtle space-y-2">
                          <div className="flex gap-2.5 items-start">
                            {c.avatar ? (
                              <img
                                src={c.avatar}
                                alt={c.user}
                                className="w-7 h-7 rounded-full object-cover border border-subtle flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : null}
                            {!c.avatar && (
                              <div className="w-7 h-7 rounded-full bg-white text-black font-black text-xs flex items-center justify-center flex-shrink-0 font-mono">
                                {(c.user || 'G')[0].toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-[11px] mb-0.5">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="font-bold text-white font-mono truncate max-w-[150px] sm:max-w-xs">{c.user}</span>
                                  {isMyComment && (
                                    <span className="px-1 py-0.2 text-[9px] bg-neutral-800 text-neutral-300 rounded font-mono">Anda</span>
                                  )}
                                </div>
                                <span className="text-muted text-[10px]">{c.time}</span>
                              </div>
                              <p className="text-xs text-neutral-300 break-words">{c.text}</p>

                              {/* Comment Actions (Reply / Delete) */}
                              <div className="flex items-center gap-3 mt-1.5 pt-1 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleStartReply(c)}
                                  className="text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <CornerDownRight className="w-3 h-3" /> Balas
                                </button>
                                {isMyComment && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(c.id!)}
                                    className="text-neutral-400 hover:text-red-400 flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" /> Hapus
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Nested Replies */}
                          {c.replies && c.replies.length > 0 && (
                            <div className="pl-4 sm:pl-6 border-l-2 border-subtle/80 space-y-2 mt-2 pt-1">
                              {c.replies.map((r, rIdx) => {
                                const isMyReply = r.userId === currentUserId;
                                return (
                                  <div key={r.id || rIdx} className="flex gap-2 items-start bg-black/30 p-2 rounded border border-subtle/40">
                                    {r.avatar ? (
                                      <img
                                        src={r.avatar}
                                        alt={r.user}
                                        className="w-5 h-5 rounded-full object-cover border border-subtle flex-shrink-0"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-neutral-800 text-white font-mono font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                        {(r.user || 'G')[0].toUpperCase()}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                                        <div className="flex items-center gap-1.5 truncate">
                                          <span className="font-bold text-white font-mono truncate">{r.user}</span>
                                          {isMyReply && (
                                            <span className="px-1 py-0.2 text-[8px] bg-neutral-800 text-neutral-300 rounded font-mono">Anda</span>
                                          )}
                                        </div>
                                        <span className="text-muted text-[9px]">{r.time}</span>
                                      </div>
                                      <p className="text-xs text-neutral-300 break-words">
                                        {r.replyToUser && (
                                          <span className="text-neutral-400 font-mono font-semibold mr-1.5">@{r.replyToUser}</span>
                                        )}
                                        {r.text}
                                      </p>
                                      <div className="flex items-center gap-3 mt-1 text-[10px]">
                                        <button
                                          type="button"
                                          onClick={() => handleStartReply(r, c.id)}
                                          className="text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <CornerDownRight className="w-2.5 h-2.5" /> Balas
                                        </button>
                                        {isMyReply && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteComment(r.id!)}
                                            className="text-neutral-400 hover:text-red-400 flex items-center gap-1 cursor-pointer transition-colors"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" /> Hapus
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Nobar (Watch Party) Room Panel */}
          {isNobarOpen && (
            <div className="w-full lg:w-88 border-t lg:border-t-0 lg:border-l border-subtle bg-black/50 p-4 flex flex-col justify-between animate-fade-in flex-shrink-0">
              <NobarRoomPanel
                room={nobarRoom}
                role={nobarRole}
                isConnected={nobarConnected}
                chatMessages={nobarChat}
                onSendMessage={handleSendNobarMessage}
                onSendReaction={handleSendNobarReaction}
                onCreateRoom={handleCreateNobarRoom}
                onLeaveRoom={handleLeaveNobarRoom}
                floatingEmojis={floatingEmojis}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
