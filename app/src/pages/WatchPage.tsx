import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Heart,
  Bookmark,
  Share2,
  Users,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  Send,
  Trash2,
  Reply,
  Tv,
  Check,
  Film,
  Calendar,
  Minimize2,
  Radio,
  LogIn,
  Lock,
  X,
  Sliders,
  Settings,
  Server,
  Droplets,
  Flame,
  Leaf,
  Zap,
  Shield,
  Wind,
  PictureInPicture,
  AlertCircle,
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
  getOrCreateGuestName,
  getOrCreateUserId,
  formatTitle,
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
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

export interface GenshinRegionConfig {
  name: string;
  element: string;
  badgeBg: string;
  activeBorder: string;
  activeText: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const GENSHIN_REGIONS: GenshinRegionConfig[] = [
  { name: 'Fontaine', element: 'Hydro', badgeBg: 'bg-sky-500/10 border-sky-500/30 text-sky-400', activeBorder: 'border-sky-500 ring-2 ring-sky-500/30', activeText: 'text-sky-400', icon: Droplets },
  { name: 'Natlan', element: 'Pyro', badgeBg: 'bg-orange-500/10 border-orange-500/30 text-orange-400', activeBorder: 'border-orange-500 ring-2 ring-orange-500/30', activeText: 'text-orange-400', icon: Flame },
  { name: 'Sumeru', element: 'Dendro', badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/30', activeText: 'text-emerald-400', icon: Leaf },
  { name: 'Inazuma', element: 'Electro', badgeBg: 'bg-purple-500/10 border-purple-500/30 text-purple-400', activeBorder: 'border-purple-500 ring-2 ring-purple-500/30', activeText: 'text-purple-400', icon: Zap },
  { name: 'Liyue', element: 'Geo', badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', activeBorder: 'border-amber-500 ring-2 ring-amber-500/30', activeText: 'text-amber-400', icon: Shield },
  { name: 'Mondstadt', element: 'Anemo', badgeBg: 'bg-teal-500/10 border-teal-500/30 text-teal-400', activeBorder: 'border-teal-500 ring-2 ring-teal-500/30', activeText: 'text-teal-400', icon: Wind },
];

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
  // Detailed anime state that fetches full synopsis and episodeList if opened from history or minimal card
  const [detailedAnime, setDetailedAnime] = useState<Anime>(anime);

  useEffect(() => {
    setDetailedAnime(anime);
  }, [anime]);

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
              description:
                full.description && full.description.length > 0
                  ? full.description
                  : prev.description,
              episodeList:
                full.episodeList && full.episodeList.length > 0
                  ? full.episodeList
                  : prev.episodeList,
              episodes: full.episodes || prev.episodes,
              genres: full.genres && full.genres.length > 0 ? full.genres : prev.genres,
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
  const poster = getAnimePoster(detailedAnime);

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

  // Live refs to guarantee Nobar sync handlers always access current props without stale closures
  const animeRef = useRef(detailedAnime);
  const episodeRef = useRef(episode);
  const latestNobarSyncRef = useRef<NobarSyncEvent | null>(null);

  useEffect(() => {
    animeRef.current = detailedAnime;
    episodeRef.current = episode;
  });

  // Streaming State
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [activeServerIdx, setActiveServerIdx] = useState<number>(0);
  const [loadingStream, setLoadingStream] = useState<boolean>(true);

  // Quality settings state
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState<boolean>(false);
  const [qualityToast, setQualityToast] = useState<string | null>(null);
  const playerQualityMenuRef = useRef<HTMLDivElement>(null);
  const qualityToastTimeoutRef = useRef<any>(null);

  // Controls visibility & auto-fade (YouTube-like behavior)
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<any>(null);

  const handlePlayerMouseMove = () => {
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

  // Normalize servers to ensure Genshin Impact region names and clean Sub Indo labels
  const normalizedServers = React.useMemo(() => {
    const rawList = streamData?.servers || [];
    // Filter out unwanted mirror servers or ads (like vidhide, bstation, wetv if any)
    const cleanList = rawList.filter((s) => {
      const lower = `${s.name} ${s.label} ${s.url}`.toLowerCase();
      return !lower.includes('vidhide') && !lower.includes('bstation') && !lower.includes('wetv');
    });

    return cleanList.map((srv, idx) => {
      const regionData = GENSHIN_REGIONS[idx % GENSHIN_REGIONS.length];
      const regionName = srv.region || regionData.name;
      const maxQ = srv.maxQuality || srv.quality || '720p';
      const maxQText = maxQ.toLowerCase() === '1080p' ? '1080p FHD' : maxQ.toLowerCase() === '720p' ? '720p HD' : '480p SD';
      const cleanName = `Server ${regionName}`;
      const cleanLabel = `${regionName} • Maks ${maxQText}`;

      return {
        ...srv,
        name: cleanName,
        label: cleanLabel,
        region: regionName,
        maxQuality: maxQ,
        maxQualityLabel: `Maks ${maxQText}`,
      };
    });
  }, [streamData?.servers]);

  const currentServer = normalizedServers[activeServerIdx] || normalizedServers[0] || null;

  // Selected quality state for direct player (persisted in localStorage)
  const [selectedQuality, setSelectedQuality] = useState<string>(() => {
    try {
      return localStorage.getItem('pixuplay_preferred_quality') || '720p';
    } catch {
      return '720p';
    }
  });

  // Available qualities on the active server
  const availableQualities = React.useMemo(() => {
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

  // Current active quality item
  const activeQualityItem = React.useMemo(() => {
    if (availableQualities.length === 0) return null;
    return availableQualities.find((q) => q.quality === selectedQuality) || availableQualities[0];
  }, [availableQualities, selectedQuality]);

  // Video URL to play
  const activeVideoUrl = currentServer?.type === 'direct'
    ? (activeQualityItem?.url || currentServer.url)
    : currentServer?.url;

  const getQualityBadge = (server?: StreamServer | null): 'FHD' | 'HD' | 'SD' | null => {
    if (!server) return null;
    const q = (activeQualityItem?.quality || server.quality || server.maxQuality || '').toLowerCase();
    if (q.includes('1080')) return 'FHD';
    if (q.includes('720')) return 'HD';
    if (q.includes('480') || q.includes('360')) return 'SD';
    return 'HD';
  };

  // Video error handling & graceful automatic failover
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

  // Close quality menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (playerQualityMenuRef.current && !playerQualityMenuRef.current.contains(target)) {
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

  // Handle switching server from below the player
  const handleSelectServer = (idx: number) => {
    if (idx === activeServerIdx) return;
    const targetServer = normalizedServers[idx];
    if (!targetServer) return;

    if (videoRef.current) {
      const cur = Math.floor(videoRef.current.currentTime);
      if (cur > 0) {
        targetSeekTimeRef.current = cur;
        hasAppliedInitialSeekRef.current = false;
      }
    }

    setActiveServerIdx(idx);
    const regName = targetServer.region || `Server ${idx + 1}`;
    setQualityToast(`Server: ${regName}`);
    if (qualityToastTimeoutRef.current) clearTimeout(qualityToastTimeoutRef.current);
    qualityToastTimeoutRef.current = setTimeout(() => setQualityToast(null), 2500);
  };

  // Handle switching resolution from the in-player Gear icon
  const handleSelectQuality = (qualityKey: string, label: string) => {
    if (qualityKey === selectedQuality) {
      setIsQualityMenuOpen(false);
      return;
    }

    if (videoRef.current) {
      const cur = Math.floor(videoRef.current.currentTime);
      if (cur > 0) {
        targetSeekTimeRef.current = cur;
        hasAppliedInitialSeekRef.current = false;
      }
    }

    setSelectedQuality(qualityKey);
    try {
      localStorage.setItem('pixuplay_preferred_quality', qualityKey);
    } catch {}

    setQualityToast(`Kualitas: ${label}`);
    if (qualityToastTimeoutRef.current) clearTimeout(qualityToastTimeoutRef.current);
    qualityToastTimeoutRef.current = setTimeout(() => setQualityToast(null), 2500);

    setIsQualityMenuOpen(false);
  };

  // Picture-in-Picture Toggle (Over Word, Excel, Other Apps)
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

  // Sync active server to parent (for miniplayer)
  useEffect(() => {
    const s = normalizedServers[activeServerIdx] || null;
    onServerChange?.(s);
  }, [normalizedServers, activeServerIdx, onServerChange]);

  // Watchlist & Favorite state
  const isWatchlist = watchlist.some((x) => String(x.id) === String(detailedAnime.animeId || detailedAnime.id));
  const isFavorite = favorites.some((x) => String(x.id) === String(detailedAnime.animeId || detailedAnime.id));

  // Likes & Comments State (from SQLite)
  const [likes, setLikes] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [isLiking, setIsLiking] = useState<boolean>(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState<boolean>(true);
  const [commentText, setCommentText] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<{ id: number | string; parentId?: number | string | null; user: string } | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);

  // Custom Delete Modal State
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    commentId?: number | string;
    itemTitle?: string;
  }>({ isOpen: false });

  // Guest Episode Switch Nobar Confirmation (Issue 4)
  const [episodeSwitchNobarConfirm, setEpisodeSwitchNobarConfirm] = useState<{
    isOpen: boolean;
    targetEpisode?: number;
  }>({ isOpen: false });

  // Custom Nobar Disbanded Modal State (Issue 2)
  const [disbandNotice, setDisbandNotice] = useState<{
    isOpen: boolean;
    message: string;
  }>({ isOpen: false, message: '' });

  // Floating Emoji Danmaku Overlay (Over the Video Screen)
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: number; emoji: string; x: number; rot: number; scale?: number }>>([]);

  // Nobar Watch Party State
  const [nobarRoom, setNobarRoom] = useState<NobarRoomInfo | null>(null);
  const [nobarRole, setNobarRole] = useState<'host' | 'guest' | null>(null);
  const [nobarConnected, setNobarConnected] = useState<boolean>(false);
  const [nobarChat, setNobarChat] = useState<NobarChatMsg[]>([]);
  const [syncStatusText, setSyncStatusText] = useState<string>('');

  // Mobile / Desktop View Tabs
  const [mobileActiveTab, setMobileActiveTab] = useState<'chat' | 'comments' | 'detail'>('chat');
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'related'>('chat');
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState<boolean>(false);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  // Episode numbers calculation based on detailedAnime
  const maxEpisode = React.useMemo(() => {
    if (detailedAnime.episodeList && detailedAnime.episodeList.length > 0) {
      const nums = detailedAnime.episodeList
        .map((ep, idx) => {
          const num = parseInt(String(ep.title).replace(/[^0-9]/g, ''), 10);
          return isNaN(num) ? idx + 1 : num;
        })
        .filter((n) => !isNaN(n));
      if (nums.length > 0) return Math.max(...nums);
      return detailedAnime.episodeList.length;
    }
    const epNum = parseInt(String(detailedAnime.episodes).replace(/[^0-9]/g, ''), 10);
    return !isNaN(epNum) && epNum > 0 ? epNum : 1;
  }, [detailedAnime]);

  // Load Stream Data for episode
  useEffect(() => {
    let isMounted = true;
    setLoadingStream(true);
    hasAppliedInitialSeekRef.current = false;

    const fetchStream = async () => {
      try {
        const data = await getStreamData(anime.animeId || anime.id, episode, title);
        if (isMounted) {
          setStreamData(data);
          let initialIdx = 0;
          if (data?.servers && data.servers.length > 0) {
            try {
              const preferred = localStorage.getItem('pixuplay_preferred_quality');
              if (preferred) {
                const found = data.servers.findIndex(
                  (s) => s.quality === preferred || s.label?.toLowerCase().includes(preferred.toLowerCase())
                );
                if (found !== -1) initialIdx = found;
              }
            } catch {}
          }
          setActiveServerIdx(initialIdx);
          setLoadingStream(false);
        }
      } catch (err) {
        if (isMounted) setLoadingStream(false);
      }
    };

    fetchStream();
    return () => {
      isMounted = false;
    };
  }, [anime.id, anime.animeId, episode]);

  // Periodic watch heartbeat (accumulation of actual watch minutes & EXP progression)
  useEffect(() => {
    const animeIdStr = String(detailedAnime.animeId || detailedAnime.id);
    const interval = setInterval(() => {
      const isVideoPlaying = videoRef.current
        ? !videoRef.current.paused
        : (document.visibilityState === 'visible' && !loadingStream);
      if (isVideoPlaying) {
        const isRewatch = watchlist.some((item) => String(item.id) === animeIdStr);
        sendWatchHeartbeat(15, animeIdStr, episode, isRewatch);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [detailedAnime.animeId, detailedAnime.id, episode, watchlist, loadingStream]);

  // Auto-connect to Nobar if initialNobarRoomId is provided
  useEffect(() => {
    if (!initialNobarRoomId) return;
    let isMounted = true;

    const connectToRoom = async () => {
      const room = await getNobarRoom(initialNobarRoomId);
      if (isMounted && room) {
        let isHost = false;
        try {
          const savedHostId = localStorage.getItem(`pixuplay_nobar_host_${room.id}`);
          if (savedHostId && savedHostId === room.hostId) isHost = true;
        } catch { }

        const role: 'host' | 'guest' = isHost ? 'host' : 'guest';
        const savedName =
          currentUser?.name ||
          localStorage.getItem(`pixuplay_nobar_hostname_${room.id}`) ||
          localStorage.getItem('pixuplay_nickname') ||
          getOrCreateGuestName();

        setNobarRoom(room);
        setNobarRole(role);
        setNobarChat(room.chat || []);
        startNobarClient(room.id, role, savedName);
      }
    };

    connectToRoom();
    return () => {
      isMounted = false;
    };
  }, [initialNobarRoomId]);

  // Load Likes & Comments from SQLite
  useEffect(() => {
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
      .catch(() => {
        if (isMounted) setIsCommentsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [anime.id, anime.animeId, episode]);

  // ============================================================
  // FLOATING EMOJI DANMAKU SYSTEM (OVER VIDEO SCREEN)
  // ============================================================
  const triggerFloatingReaction = (emoji: string) => {
    // Generate 1 to 3 animated emojis with random trajectories
    const burstCount = Math.floor(Math.random() * 3) + 1;
    const newItems: Array<{ id: number; emoji: string; x: number; rot: number; scale: number }> = [];

    for (let i = 0; i < burstCount; i++) {
      const id = Date.now() + Math.random() * 10000 + i;
      // Spread across the video player (8% to 92%)
      const x = Math.floor(Math.random() * 84) + 8;
      const rot = Math.floor(Math.random() * 40) - 20;
      const scale = 0.9 + Math.random() * 0.45;
      newItems.push({ id, emoji, x, rot, scale });
    }

    setFloatingEmojis((prev) => [...prev.slice(-100), ...newItems]);

    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => !newItems.some((n) => n.id === item.id)));
    }, 2800);
  };

  // Periodic watch heartbeat (accumulate actual watch minutes)
  useEffect(() => {
    const timer = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.seeking) {
        const animeKey = String(detailedAnime.animeId || detailedAnime.id);
        sendWatchHeartbeat(15, animeKey, episode, false);
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [detailedAnime.id, detailedAnime.animeId, episode]);

  // Sync playback state on page unload, tab switch, minimize, or unmount
  useEffect(() => {
    const handleUnloadOrHide = () => {
      if (videoRef.current) {
        const cur = Math.floor(videoRef.current.currentTime);
        const isPlaying = !videoRef.current.paused;
        onPlaybackSync?.(cur, isPlaying);
        const dur = Math.floor(videoRef.current.duration || 1440);
        if (dur > 0) {
          onSaveHistory(detailedAnime, episode, cur, dur);
        }
      }
    };

    window.addEventListener('beforeunload', handleUnloadOrHide);
    window.addEventListener('pagehide', handleUnloadOrHide);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleUnloadOrHide();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleUnloadOrHide);
      window.removeEventListener('pagehide', handleUnloadOrHide);
      document.removeEventListener('visibilitychange', handleVisibility);
      handleUnloadOrHide();
    };
  }, [detailedAnime, episode, onPlaybackSync, onSaveHistory]);

  // ============================================================
  // NOBAR REALTIME ENGINE & HOST HEARTBEAT (FIXES BUG 1 & BUG 4)
  // ============================================================
  const startNobarClient = (roomId: string, role: 'host' | 'guest', userName: string) => {
    nobarClientRef.current?.destroy();

    const userAvatar = currentUser?.avatar || localStorage.getItem('pixuplay_avatar') || '';
    const client = new NobarClient(roomId, role, userName, userAvatar);

    client.onStatusChange = (connected) => {
      setNobarConnected(connected);
      setSyncStatusText(
        connected
          ? role === 'host'
            ? 'Host Aktif'
            : 'Tersinkron dengan Host'
          : 'Menghubungkan ulang...'
      );
    };

    client.onChat = (msg) => {
      setNobarChat((prev) => [...prev, msg]);
    };

    client.onReaction = (emoji) => {
      triggerFloatingReaction(emoji);
    };

    client.onSync = (ev: NobarSyncEvent) => {
      if (role === 'guest') {
        latestNobarSyncRef.current = ev;
        const curAnimeId = String(animeRef.current.animeId || animeRef.current.id);
        const curEp = episodeRef.current;

        // 1. Multi-Anime Sync: Host switched anime!
        if (ev.animeId && String(ev.animeId) !== curAnimeId) {
          const found = allAnimeList.find((a) => String(a.animeId || a.id) === String(ev.animeId));
          if (found) {
            onSelectAnime(found, true);
          } else {
            onSelectAnime({
              id: ev.animeId,
              animeId: ev.animeId,
              title: { english: ev.animeTitle || 'Anime', romaji: ev.animeTitle || 'Anime' },
              coverImage: {
                extraLarge: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80',
              },
            }, true);
          }
          return;
        }

        // 2. Sync Episode if host changed episode
        if (ev.episode && ev.episode !== curEp) {
          episodeRef.current = ev.episode;
          onSelectEpisode(ev.episode);
          return;
        }

        // 3. Sync Video Playback Time (Prevents Host Lag Desync)
        if (videoRef.current) {
          const drift = Math.abs(videoRef.current.currentTime - ev.currentTime);
          if (drift > 1.5) {
            try {
              videoRef.current.currentTime = ev.currentTime;
            } catch { }
          }
          if (ev.isPlaying && videoRef.current.paused) {
            videoRef.current.play().catch(() => { });
          } else if (!ev.isPlaying && !videoRef.current.paused) {
            videoRef.current.pause();
          }
        }
      }
    };

    client.onRoomDisbanded = (msg: string) => {
      handleLeaveNobarRoom(false);
      setDisbandNotice({
        isOpen: true,
        message: msg || 'Room nobar telah dibubarkan oleh host.',
      });
      setTimeout(() => {
        onBackToHome();
      }, 3500);
    };

    nobarClientRef.current = client;
  };

  // Host Periodic Sync Heartbeat: broadcasts every 3.5 seconds while playing
  useEffect(() => {
    if (nobarRole !== 'host') return;

    heartbeatTimerRef.current = setInterval(() => {
      if (videoRef.current && nobarClientRef.current) {
        nobarClientRef.current.sendSync(
          videoRef.current.currentTime,
          !videoRef.current.paused,
          episode,
          streamData?.servers?.[activeServerIdx]?.url,
          String(detailedAnime.animeId || detailedAnime.id),
          title
        );
      }
    }, 3500);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [nobarRole, episode, activeServerIdx, streamData, detailedAnime.animeId, detailedAnime.id, title]);

  const handleCreateNobarRoom = async (name: string) => {
    const finalName = name || currentUser?.name || localStorage.getItem('pixuplay_nickname') || 'Host';
    const res = await createNobarRoom(
      detailedAnime.animeId || detailedAnime.id,
      title,
      episode,
      streamData?.servers?.[activeServerIdx]?.url || '',
      finalName
    );

    if (res && res.room) {
      const room = res.room;
      try {
        localStorage.setItem(`pixuplay_nobar_host_${room.id}`, res.hostId);
        localStorage.setItem(`pixuplay_nobar_hostname_${room.id}`, finalName);
      } catch { }

      setNobarRoom(room);
      setNobarRole('host');
      setNobarChat(room.chat || []);
      setSidebarTab('chat');
      setMobileActiveTab('chat');
      if (onNobarRoomChange) onNobarRoomChange(room.id);
      startNobarClient(room.id, 'host', finalName);
    }
  };

  const handleLeaveNobarRoom = (shouldBroadcastDisband = true) => {
    if (nobarRole === 'host' && shouldBroadcastDisband) {
      nobarClientRef.current?.sendDisband();
    }
    nobarClientRef.current?.destroy();
    setNobarRoom(null);
    setNobarRole(null);
    setNobarConnected(false);
    setNobarChat([]);
    if (onNobarRoomChange) onNobarRoomChange(null);
    if (nobarRole === 'host') {
      onBackToHome();
    }
  };

  // Episode Selection Handler with Guest Nobar Warning (Issue 4)
  const handleSelectEpisode = (ep: number) => {
    if (ep === episode) return;
    if (nobarRole === 'guest') {
      setEpisodeSwitchNobarConfirm({
        isOpen: true,
        targetEpisode: ep,
      });
      return;
    }
    onSelectEpisode(ep);
    if (nobarRole === 'host' && nobarClientRef.current) {
      nobarClientRef.current.sendSync(
        0,
        true,
        ep,
        streamData?.servers?.[activeServerIdx]?.url,
        String(detailedAnime.animeId || detailedAnime.id),
        title
      );
    }
  };

  const handleConfirmGuestEpisodeSwitch = () => {
    if (!episodeSwitchNobarConfirm.targetEpisode) return;
    const targetEp = episodeSwitchNobarConfirm.targetEpisode;
    setEpisodeSwitchNobarConfirm({ isOpen: false });
    handleLeaveNobarRoom(false);
    onSelectEpisode(targetEp);
  };

  const handleSendNobarReaction = (emoji: string) => {
    nobarClientRef.current?.sendReaction(emoji);
    triggerFloatingReaction(emoji);
  };

  const handleSendNobarMessage = (text: string) => {
    const userAvatar = currentUser?.avatar || localStorage.getItem('pixuplay_avatar') || '';
    nobarClientRef.current?.sendChat(text, userAvatar);
  };

  // Video Events & Seek Synchronization
  const applyInitialSeek = (video: HTMLVideoElement) => {
    // In active Nobar room as guest: immediately align playback time and status to host
    if (nobarRole === 'guest' && latestNobarSyncRef.current) {
      const syncEv = latestNobarSyncRef.current;
      if (syncEv.currentTime > 0) {
        try {
          video.currentTime = syncEv.currentTime;
        } catch { }
      }
      if (syncEv.isPlaying) {
        video.play().catch(() => { });
      } else {
        video.pause();
      }
      return;
    }

    if (targetSeekTimeRef.current > 0 && !hasAppliedInitialSeekRef.current) {
      hasAppliedInitialSeekRef.current = true;
      try {
        video.currentTime = targetSeekTimeRef.current;
      } catch (err) {
        console.warn('Initial seek failed', err);
      }
    }
    if (initialIsPlaying === false) {
      video.pause();
    }
  };

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    applyInitialSeek(e.currentTarget);
  };

  const handleCanPlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    applyInitialSeek(video);

    if (nobarRole === 'guest' && latestNobarSyncRef.current) {
      const syncEv = latestNobarSyncRef.current;
      if (Math.abs(video.currentTime - syncEv.currentTime) > 1.5) {
        try {
          video.currentTime = syncEv.currentTime;
        } catch { }
      }
      if (syncEv.isPlaying && video.paused) {
        video.play().catch(() => { });
      }
    }
  };

  const handleVideoSeeked = () => {
    if (videoRef.current) {
      const cur = Math.floor(videoRef.current.currentTime);
      if (targetSeekTimeRef.current > 0) {
        hasAppliedInitialSeekRef.current = true;
      }
      onPlaybackSync?.(cur, !videoRef.current.paused);
    }
    if (nobarRole === 'host' && videoRef.current && nobarClientRef.current) {
      nobarClientRef.current.sendSync(
        videoRef.current.currentTime,
        !videoRef.current.paused,
        episode,
        streamData?.servers?.[activeServerIdx]?.url,
        String(detailedAnime.animeId || detailedAnime.id),
        title
      );
    }
  };

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const cur = Math.floor(video.currentTime);
    const dur = Math.floor(video.duration);

    // CRITICAL: If target seek is pending and currentTime is still 0, DO NOT report 0!
    if (targetSeekTimeRef.current > 0 && !hasAppliedInitialSeekRef.current && cur === 0) {
      return;
    }

    onPlaybackSync?.(cur, !video.paused);
    if (dur > 0 && Math.abs(cur - lastSavedTimeRef.current) >= 4) {
      lastSavedTimeRef.current = cur;
      onSaveHistory(detailedAnime, episode, cur, dur);
    }
  };

  const handleVideoPlay = () => {
    handlePlayerMouseMove();
    if (videoRef.current) {
      const cur = Math.floor(videoRef.current.currentTime);
      if (targetSeekTimeRef.current > 0 && !hasAppliedInitialSeekRef.current && cur === 0) {
        return;
      }
      onPlaybackSync?.(cur, true);
    }
    if (nobarRole === 'host' && videoRef.current && nobarClientRef.current) {
      nobarClientRef.current.sendSync(
        videoRef.current.currentTime,
        true,
        episode,
        streamData?.servers?.[activeServerIdx]?.url,
        String(detailedAnime.animeId || detailedAnime.id),
        title
      );
    }
  };

  const handleVideoPause = () => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (videoRef.current) {
      const cur = Math.floor(videoRef.current.currentTime);
      const dur = Math.floor(videoRef.current.duration);
      if (targetSeekTimeRef.current > 0 && !hasAppliedInitialSeekRef.current && cur === 0) {
        return;
      }
      onPlaybackSync?.(cur, false);
      if (dur > 0) onSaveHistory(detailedAnime, episode, cur, dur);
    }
    if (nobarRole === 'host' && videoRef.current && nobarClientRef.current) {
      nobarClientRef.current.sendSync(
        videoRef.current.currentTime,
        false,
        episode,
        streamData?.servers?.[activeServerIdx]?.url,
        String(detailedAnime.animeId || detailedAnime.id),
        title
      );
    }
  };

  // Like Toggle Handler
  const handleToggleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    const nextHasLiked = !hasLiked;
    setHasLiked(nextHasLiked);
    setLikes((prev) => (nextHasLiked ? prev + 1 : Math.max(0, prev - 1)));

    const animeKey = anime.animeId || anime.id;
    const res = await toggleLike(animeKey, episode);
    if (res) {
      setHasLiked(res.hasLiked);
      setLikes(res.likesCount);
    }
    setIsLiking(false);
  };

  // Comment Handlers
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    const textToSend = commentText.trim();
    const animeKey = detailedAnime.animeId || detailedAnime.id;
    const currentUserName = currentUser?.name || localStorage.getItem('pixuplay_nickname') || 'Pengguna';
    const currentUserAvatar =
      currentUser?.avatar ||
      localStorage.getItem('pixuplay_avatar') ||
      '';
    const currentUserId = currentUser?.id || getOrCreateUserId();

    const res = await postComment(
      animeKey,
      episode,
      currentUserName,
      currentUserAvatar,
      textToSend,
      null,
      null,
      currentUserId
    );

    if (res) {
      setComments((prev) => [res, ...prev]);
      setCommentText('');
    }
    setIsSubmittingComment(false);
  };

  const handleReplyComment = async (e: React.FormEvent, parentId: number | string, replyToUser: string) => {
    e.preventDefault();
    if (!replyText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    const textToSend = replyText.trim();
    const animeKey = detailedAnime.animeId || detailedAnime.id;
    const currentUserName = currentUser?.name || localStorage.getItem('pixuplay_nickname') || 'Pengguna';
    const currentUserAvatar =
      currentUser?.avatar ||
      localStorage.getItem('pixuplay_avatar') ||
      '';
    const currentUserId = currentUser?.id || getOrCreateUserId();

    const res = await postComment(
      animeKey,
      episode,
      currentUserName,
      currentUserAvatar,
      textToSend,
      Number(parentId),
      replyToUser,
      currentUserId
    );

    if (res) {
      const newComment = res;
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === Number(parentId)) {
            return { ...c, replies: [...(c.replies || []), newComment] };
          }
          return c;
        })
      );
      setReplyText('');
      setReplyingTo(null);
    }
    setIsSubmittingComment(false);
  };

  const handleOpenDeleteCommentModal = (commentId: number | string, textPreview?: string) => {
    setDeleteModalState({
      isOpen: true,
      commentId,
      itemTitle: textPreview ? textPreview.slice(0, 60) + '...' : undefined,
    });
  };

  const handleConfirmDeleteComment = async () => {
    if (!deleteModalState.commentId) return;
    const cid = deleteModalState.commentId;
    const currentUid = currentUser?.id || getOrCreateUserId();
    const ok = await deleteComment(cid, currentUid);
    if (ok) {
      setComments((prev) =>
        prev
          .filter((c) => c.id !== cid)
          .map((c) => ({
            ...c,
            replies: (c.replies || []).filter((r) => r.id !== cid),
          }))
      );
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/?watch=${encodeURIComponent(
      anime.animeId || anime.id
    )}&ep=${episode}`;
    navigator.clipboard.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const getEmbedUrl = (srv?: StreamServer | null) => {
    if (!srv) return '';
    return srv.url;
  };

  // Related anime list (first 10 from catalog)
  const relatedAnime = React.useMemo(() => {
    return allAnimeList
      .filter((a) => String(a.id || a.animeId) !== String(anime.id || anime.animeId))
      .slice(0, 8);
  }, [allAnimeList, anime]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-20 pb-16 px-3 sm:px-6 max-w-[1600px] mx-auto animate-fade-in">
      {/* Top Breadcrumb & Quick Actions */}
      <div className="flex items-center justify-between gap-3 mb-3 text-xs">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer border border-subtle"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali</span>
        </button>

        <div className="flex items-center gap-2">
          {nobarRoom && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600/10 border border-red-500/20 rounded-full text-red-400 font-bold text-[11px] animate-pulse">
              <Radio className="w-3 h-3" />
              <span>Nobar Aktif: {nobarRoom.id}</span>
            </div>
          )}

          {currentServer?.type === 'direct' && (
            <button
              onClick={handleTogglePiP}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer border border-subtle"
              title="Picture-in-Picture: Nonton mengambang di atas Word atau aplikasi desktop lain"
            >
              <PictureInPicture className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Terapung di App Lain</span>
            </button>
          )}

          <button
            onClick={() => {
              const cur = videoRef.current ? Math.floor(videoRef.current.currentTime) : initialResumeTime;
              const isPlaying = videoRef.current ? !videoRef.current.paused : true;
              onMinimize(cur, isPlaying);
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer border border-subtle"
            title="Kecilkan ke Mini Player"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mini Player</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout: YouTube Desktop (Left 70%, Right 30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Video Player & Main Details (8 Cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-4">
          {/* 16:9 Cinema Screen with Danmaku Floating Emojis */}
          <div
            onMouseMove={handlePlayerMouseMove}
            onMouseEnter={() => setIsControlsVisible(true)}
            onMouseLeave={() => {
              if (videoRef.current && !videoRef.current.paused && !isQualityMenuOpen) {
                setIsControlsVisible(false);
              }
            }}
            className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-subtle shadow-2xl flex items-center justify-center group"
          >
            {/* In-Player YouTube-style Gear Icon (Top Right Corner of Media Player Only) */}
            {normalizedServers && normalizedServers.length > 0 && !loadingStream && (
              <div
                className={`absolute top-3.5 right-3.5 z-30 transition-opacity duration-200 ${
                  isControlsVisible || isQualityMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                ref={playerQualityMenuRef}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsQualityMenuOpen(!isQualityMenuOpen);
                  }}
                  className="relative p-1.5 w-8 h-8 flex items-center justify-center bg-transparent hover:bg-black/40 rounded-full active:scale-95 transition-all cursor-pointer group/gear focus:outline-none"
                  title="Setelan Kualitas Video"
                  aria-label="Pengaturan Kualitas"
                >
                  <Settings
                    className={`w-5 h-5 text-white drop-shadow-md group-hover/gear:rotate-45 transition-all duration-300 ${
                      isQualityMenuOpen ? 'rotate-45 text-red-400 opacity-100' : 'opacity-85 group-hover/gear:opacity-100'
                    }`}
                  />
                  {/* Tiny YouTube-style HD/FHD/SD Badge on the top right corner of the gear */}
                  {getQualityBadge(currentServer) && (
                    <span className="absolute top-0 right-0 text-[7px] font-black bg-[#cc0000] text-white px-0.5 py-0 rounded-[2px] leading-none shadow-md tracking-tighter uppercase select-none pointer-events-none">
                      {getQualityBadge(currentServer)}
                    </span>
                  )}
                </button>

                {/* In-Player Quality Menu Dropdown (Opens Downwards from Top-Right) */}
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
                          const isSelected = activeQualityItem?.quality === qItem.quality;
                          const badge = qItem.quality.includes('1080')
                            ? 'FHD'
                            : qItem.quality.includes('720')
                            ? 'HD'
                            : 'SD';
                          return (
                            <button
                              key={qItem.quality}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectQuality(qItem.quality, qItem.label);
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
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-[9px] font-black bg-neutral-800 text-neutral-300 px-1 py-0.5 rounded">
                                  {badge}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-red-400 ml-0.5" />}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-3 py-2 text-xs text-neutral-400">
                          Kualitas otomatis (Auto)
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quality Changed Toast Overlay (positioned at top-left) */}
            {qualityToast && (
              <div className="absolute top-3.5 left-3.5 z-40 bg-black/90 backdrop-blur-md border border-neutral-700/80 px-3.5 py-1.5 rounded-full text-xs font-bold text-white shadow-xl flex items-center gap-2 pointer-events-none animate-fade-in">
                <Settings className="w-3.5 h-3.5 text-red-500 animate-spin" />
                <span>{qualityToast}</span>
              </div>
            )}
            {/* Danmaku Floating Emoji Reaction Overlay (Request 2) */}
            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden select-none">
              {floatingEmojis.map((fe) => (
                <div
                  key={fe.id}
                  style={
                    {
                      left: `${fe.x}%`,
                      '--rot': `${fe.rot}deg`,
                      fontSize: `${(fe.scale || 1) * 2.2}rem`,
                    } as React.CSSProperties
                  }
                  className="absolute bottom-6 animate-float-emoji transform -translate-x-1/2 drop-shadow-xl filter"
                >
                  {fe.emoji}
                </div>
              ))}
            </div>

            {/* Video Player Display */}
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
                    onLoadedMetadata={handleVideoLoadedMetadata}
                    onCanPlay={handleCanPlay}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onSeeked={handleVideoSeeked}
                    onPlay={handleVideoPlay}
                    onPause={handleVideoPause}
                    onError={handleVideoError}
                    className="w-full h-full object-contain"
                  />
                  {videoError && (
                    <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center z-30 animate-fade-in">
                      <AlertCircle className="w-10 h-10 text-red-500 mb-2 animate-bounce" />
                      <p className="text-sm font-bold text-white mb-1">{videoError}</p>
                      <div className="flex items-center gap-2 mt-3">
                        {normalizedServers.length > 1 && (
                          <button
                            onClick={() => {
                              const nextIdx = (activeServerIdx + 1) % normalizedServers.length;
                              setActiveServerIdx(nextIdx);
                              setVideoError(null);
                            }}
                            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Coba Server Lain ({normalizedServers[(activeServerIdx + 1) % normalizedServers.length]?.region || 'Alternatif'})
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setVideoError(null);
                            if (videoRef.current) {
                              videoRef.current.load();
                              videoRef.current.play().catch(() => {});
                            }
                          }}
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
                  key={`embed-${currentServer.url}-${episode}`}
                  src={getEmbedUrl(currentServer)}
                  title={`Pixuplay Cinema - ${title} Ep ${episode}`}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  className="w-full h-full border-0"
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <p className="text-sm text-neutral-300 mb-3">Server pemutar belum merespons.</p>
                <button
                  onClick={() => setActiveServerIdx(0)}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-black font-bold text-xs rounded-xl"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Coba Server 1
                </button>
              </div>
            )}
          </div>

          {/* Under-Video Information & Interactive Action Bar */}
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                  {title}
                </h1>
                <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1 flex-wrap">
                  <span className="px-2 py-0.5 bg-red-600/20 text-red-400 font-extrabold text-[11px] rounded-md border border-red-500/20">
                    Episode {episode}
                  </span>
                  <span>•</span>
                  <span>Total {maxEpisode} Episode</span>
                  <span>•</span>
                  <span>{anime.status === 'RELEASING' ? 'Ongoing' : 'Tamat'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Like Button */}
                <button
                  onClick={handleToggleLike}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${hasLiked
                      ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-950/50'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-subtle'
                    }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-white text-white' : ''}`} />
                  <span>{likes}</span>
                </button>

                {/* Watchlist Button */}
                <button
                  onClick={() => onToggleWatchlist(anime)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${isWatchlist
                      ? 'bg-white text-black border-white'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-subtle'
                    }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isWatchlist ? 'fill-black text-black' : ''}`} />
                  <span>{isWatchlist ? 'Tersimpan' : 'Watchlist'}</span>
                </button>

                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all cursor-pointer border border-subtle text-xs font-bold"
                >
                  {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedShare ? 'Tersalin' : 'Bagikan'}</span>
                </button>

                {/* Nobar Watch Party Button */}
                <button
                  onClick={() => {
                    setSidebarTab('chat');
                    setMobileActiveTab('chat');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${nobarRoom
                      ? 'bg-red-600 text-white border-red-500 shadow-lg'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-subtle'
                    }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{nobarRoom ? 'Live Chat' : 'Mulai Nobar'}</span>
                </button>
              </div>
            </div>

            {/* ======================================================= */}
            {/* PROMINENT SERVER PICKER SECTION (GENSHIN REGIONS • SUB INDO) */}
            {/* ======================================================= */}
            {normalizedServers && normalizedServers.length > 0 && !loadingStream && (
              <div className="bg-[#121212] border border-subtle rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-red-500" />
                    <h3 className="text-xs sm:text-sm font-bold text-white">
                      Pilih Server Pemutar
                    </h3>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/20 uppercase tracking-wider">
                      Sub Indo
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400 hidden sm:flex items-center gap-1.5">
                    <span>Server Aktif:</span>
                    <strong className="text-white font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                      {currentServer?.name || 'Server Fontaine'}
                    </strong>
                  </div>
                </div>

                {/* Server Grid Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {normalizedServers.map((srv, idx) => {
                    const isSelected = activeServerIdx === idx;
                    const regionMeta =
                      GENSHIN_REGIONS.find((r) => r.name.toLowerCase() === (srv.region || '').toLowerCase()) ||
                      GENSHIN_REGIONS[idx % GENSHIN_REGIONS.length];
                    const IconComponent = regionMeta.icon;
                    const maxQ = srv.maxQualityLabel || 'Maks 720p HD';

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectServer(idx)}
                        className={`relative flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer group ${
                          isSelected
                            ? `bg-neutral-900 ${regionMeta.activeBorder} shadow-lg shadow-black/40`
                            : 'bg-black/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-2 rounded-lg ${regionMeta.badgeBg} flex-shrink-0 transition-transform group-hover:scale-105`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-bold truncate ${
                                  isSelected ? 'text-white' : 'text-neutral-200 group-hover:text-white'
                                }`}
                              >
                                Server {srv.region || regionMeta.name}
                              </span>
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-medium truncate mt-0.5">
                              {maxQ}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                            Sub Indo
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-red-500 ml-0.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ======================================================= */}
            {/* PROMINENT EPISODE PICKER SECTION (SOLVES BUG 3) */}
            {/* ======================================================= */}
            <div className="bg-[#121212] border border-subtle rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-red-500" />
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Pilih Episode (Total {maxEpisode})
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <button
                    disabled={episode <= 1}
                    onClick={() => handleSelectEpisode(Math.max(1, episode - 1))}
                    className="p-1 rounded bg-black border border-subtle hover:border-neutral-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    title="Episode Sebelumnya"
                  >
                    Sebelumnya
                  </button>
                  <button
                    disabled={episode >= maxEpisode}
                    onClick={() => handleSelectEpisode(Math.min(maxEpisode, episode + 1))}
                    className="p-1 rounded bg-black border border-subtle hover:border-neutral-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    title="Episode Selanjutnya"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>

              {/* Fast Horizontal Episode Pill Carousel */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                {Array.from({ length: maxEpisode }, (_, i) => i + 1).map((epNum) => {
                  const isActive = epNum === episode;
                  return (
                    <button
                      key={epNum}
                      onClick={() => handleSelectEpisode(epNum)}
                      className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${isActive
                          ? 'bg-red-600 text-white shadow-lg shadow-red-950/40 ring-2 ring-red-500 scale-105'
                          : 'bg-black text-neutral-300 hover:text-white border border-subtle hover:border-neutral-600'
                        }`}
                    >
                      Ep {epNum}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile View Tab Switcher (Live Chat / Comments / Detail) */}
            <div className="lg:hidden flex items-center border-b border-subtle">
              <button
                onClick={() => setMobileActiveTab('chat')}
                className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-colors cursor-pointer flex items-center justify-center gap-1 ${mobileActiveTab === 'chat'
                    ? 'border-red-500 text-red-400'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
              >
                <Radio className="w-3 h-3" />
                Live Chat {nobarRoom && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
              </button>
              <button
                onClick={() => setMobileActiveTab('comments')}
                className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-colors cursor-pointer ${mobileActiveTab === 'comments'
                    ? 'border-white text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
              >
                Komentar ({comments.length})
              </button>
              <button
                onClick={() => setMobileActiveTab('detail')}
                className={`flex-1 py-3 text-xs font-bold border-b-2 text-center transition-colors cursor-pointer ${mobileActiveTab === 'detail'
                    ? 'border-white text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                  }`}
              >
                Detail
              </button>
            </div>

            {/* Collapsible Synopsis & Info (Visible always on Desktop, conditionally on Mobile) */}
            <div className={`space-y-4 ${mobileActiveTab !== 'detail' ? 'hidden lg:block' : ''}`}>
              <div className="bg-[#121212] border border-subtle rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
                  <span>Sinopsis & Informasi Anime</span>
                  {detailedAnime.averageScore && (
                    <span className="text-amber-400 font-mono">★ {detailedAnime.averageScore / 10} / 10</span>
                  )}
                </div>

                <p
                  className={`text-xs text-neutral-300 leading-relaxed ${!isSynopsisExpanded ? 'line-clamp-3' : ''
                    }`}
                >
                  {detailedAnime.description ||
                    `Nonton streaming anime ${title} dengan subtitle Indonesia resmi dan terlengkap kualitas Full HD di Pixuplay.`}
                </p>

                {detailedAnime.description && detailedAnime.description.length > 180 && (
                  <button
                    onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)}
                    className="text-[11px] font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {isSynopsisExpanded ? (
                      <>
                        Sembunyikan <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        Baca Selengkapnya <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}

                {/* Genre Badges */}
                {detailedAnime.genres && detailedAnime.genres.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {detailedAnime.genres.map((g) => (
                      <span
                        key={g}
                        className="px-2 py-0.5 bg-neutral-900 border border-subtle text-[10px] text-neutral-300 rounded-md font-medium"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Tab: Live Chat in Mobile */}
            <div className={`lg:hidden ${mobileActiveTab !== 'chat' ? 'hidden' : ''}`}>
              <NobarRoomPanel
                room={nobarRoom}
                role={nobarRole}
                isConnected={nobarConnected}
                chatMessages={nobarChat}
                onSendMessage={handleSendNobarMessage}
                onSendReaction={handleSendNobarReaction}
                onCreateRoom={handleCreateNobarRoom}
                onLeaveRoom={handleLeaveNobarRoom}
                defaultUserName={currentUser?.name}
              />
            </div>

            {/* ======================================================= */}
            {/* COMMENTS SECTION (Threaded + Custom Delete Modal) */}
            {/* ======================================================= */}
            <div
              className={`space-y-4 pt-2 ${mobileActiveTab !== 'comments' ? 'hidden lg:block' : ''
                }`}
            >
              <div className="bg-[#121212] border border-subtle rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-subtle pb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-white" />
                    <h3 className="text-sm font-bold text-white">
                      Komentar ({comments.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    {currentUser ? (
                      <span className="text-blue-400 font-semibold">{currentUser.name}</span>
                    ) : (
                      'Mode Tamu'
                    )}
                  </span>
                </div>

                {/* Input New Comment - Requires Login */}
                {!currentUser ? (
                  <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 border border-neutral-700 flex-shrink-0">
                        <Lock className="w-4 h-4 text-neutral-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Masuk untuk Berkomentar</h4>
                        <p className="text-[11px] text-muted">
                          Masuk dengan akun Google untuk berdiskusi dengan komunitas penonton Pixuplay.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenLogin && onOpenLogin()}
                      className="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shadow"
                    >
                      <LogIn className="w-3.5 h-3.5 text-blue-600" />
                      <span>Masuk dengan Google</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitComment} className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-neutral-700 flex-shrink-0 mt-0.5">
                        <img
                          src={
                            currentUser.avatar ||
                            'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=120&auto=format&fit=crop&q=80'
                          }
                          alt={currentUser.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder={`Tulis komentar sebagai ${currentUser.name}...`}
                          rows={2}
                          maxLength={500}
                          className="w-full px-3.5 py-2.5 bg-black border border-subtle focus:border-neutral-500 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none resize-none transition-colors"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-neutral-500">
                            {commentText.length}/500 karakter
                          </span>
                          <button
                            type="submit"
                            disabled={!commentText.trim() || isSubmittingComment}
                            className="px-4 py-1.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            <Send className="w-3 h-3" />
                            <span>Kirim Komentar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                )}

                {/* Comments List */}
                <div className="space-y-3 pt-2">
                  {isCommentsLoading ? (
                    <div className="py-6 text-center text-xs text-neutral-500">Memuat komentar...</div>
                  ) : comments.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-500">
                      Belum ada komentar untuk episode ini. Jadilah yang pertama berkomentar!
                    </div>
                  ) : (
                    comments.map((item) => {
                      const currentUid = currentUser?.id || getOrCreateUserId();
                      const isOwn = Boolean(
                        item.userId &&
                          (item.userId === currentUid ||
                            (currentUser?.id && String(item.userId) === String(currentUser.id)))
                      );
                      const isReplyingThis = replyingTo?.id === item.id;

                      return (
                        <div key={item.id} className="p-3 bg-black/60 rounded-xl border border-subtle space-y-2 transition-all">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {item.avatar ? (
                                <img
                                  src={item.avatar}
                                  alt={item.user}
                                  className="w-6 h-6 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-neutral-800 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                  {item.user.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="text-xs font-bold text-white">{item.user}</span>
                              <span className="text-[10px] text-neutral-500">{item.time}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  if (!currentUser && onOpenLogin) {
                                    onOpenLogin();
                                    return;
                                  }
                                  setReplyingTo({ id: item.id, user: item.user });
                                  setReplyText('');
                                }}
                                className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Reply className="w-3 h-3" /> Balas
                              </button>

                              {isOwn && (
                                <button
                                  onClick={() => handleOpenDeleteCommentModal(item.id, item.text)}
                                  className="text-[11px] text-neutral-500 hover:text-red-400 p-1 cursor-pointer transition-colors"
                                  title="Hapus Komentar"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-neutral-200 pl-8 leading-relaxed break-words">{item.text}</p>

                          {/* Threaded Replies */}
                          {item.replies && item.replies.length > 0 && (
                            <div className="pl-8 pt-2 space-y-2 border-l border-subtle ml-3 mt-2">
                              {item.replies.map((reply) => {
                                const isReplyOwn = Boolean(
                                  reply.userId &&
                                    (reply.userId === currentUid ||
                                      (currentUser?.id && String(reply.userId) === String(currentUser.id)))
                                );
                                return (
                                  <div key={reply.id} className="p-2.5 bg-neutral-900/60 rounded-lg space-y-1">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {reply.avatar ? (
                                          <img
                                            src={reply.avatar}
                                            alt={reply.user}
                                            className="w-5 h-5 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                                          />
                                        ) : (
                                          <div className="w-5 h-5 rounded-full bg-neutral-800 text-white font-bold text-[9px] flex items-center justify-center flex-shrink-0">
                                            {reply.user.charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                        <span className="text-[11px] font-bold text-white">{reply.user}</span>
                                        {reply.replyToUser && (
                                          <span className="text-[10px] text-neutral-400">
                                            ke @{reply.replyToUser}
                                          </span>
                                        )}
                                        <span className="text-[9px] text-neutral-500 ml-1">{reply.time}</span>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => {
                                            if (!currentUser && onOpenLogin) {
                                              onOpenLogin();
                                              return;
                                            }
                                            setReplyingTo({ id: item.id, user: reply.user });
                                            setReplyText('');
                                          }}
                                          className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                                        >
                                          <Reply className="w-2.5 h-2.5" /> Balas
                                        </button>
                                        {isReplyOwn && (
                                          <button
                                            onClick={() => handleOpenDeleteCommentModal(reply.id, reply.text)}
                                            className="text-[10px] text-neutral-500 hover:text-red-400 p-1 cursor-pointer"
                                            title="Hapus Balasan"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-xs text-neutral-200 pl-7 break-words">{reply.text}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Inline Reply Form Directly Below the Comment / Replies */}
                          {isReplyingThis && (
                            <form
                              onSubmit={(e) => handleReplyComment(e, item.id, replyingTo.user)}
                              className="mt-3 pl-8 pt-2 space-y-2 border-l-2 border-neutral-700 animate-fade-in"
                            >
                              <div className="flex items-center justify-between text-xs text-neutral-400">
                                <span>
                                  Membalas <span className="text-white font-semibold">@{replyingTo.user}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText('');
                                  }}
                                  className="text-[11px] text-neutral-500 hover:text-white px-2 py-0.5 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>

                              <div className="flex items-start gap-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden border border-neutral-700 flex-shrink-0 mt-1">
                                  <img
                                    src={
                                      currentUser?.avatar ||
                                      'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=120&auto=format&fit=crop&q=80'
                                    }
                                    alt={currentUser?.name || 'User'}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="flex-1 space-y-2">
                                  <textarea
                                    autoFocus
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder={`Tulis balasan untuk @${replyingTo.user}...`}
                                    rows={2}
                                    maxLength={500}
                                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 focus:border-white rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none resize-none transition-colors"
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyingTo(null);
                                        setReplyText('');
                                      }}
                                      className="px-3 py-1 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                                    >
                                      Batal
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={!replyText.trim() || isSubmittingComment}
                                      className="px-3.5 py-1 bg-white text-black font-bold text-xs rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shadow"
                                    >
                                      <Send className="w-3 h-3" />
                                      <span>Balas</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </form>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Desktop YouTube Sidebar (4 Cols) */}
        {/* ========================================================= */}
        <div className="hidden lg:flex lg:col-span-4 flex-col gap-4 sticky top-20">
          {/* Sidebar Tab Header */}
          <div className="flex items-center bg-[#141414] border border-subtle rounded-xl p-1 gap-1">
            <button
              onClick={() => setSidebarTab('chat')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${sidebarTab === 'chat'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
                }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Chat</span>
              {nobarRoom && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
            </button>

            <button
              onClick={() => setSidebarTab('related')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${sidebarTab === 'related'
                  ? 'bg-neutral-800 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
                }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Terkait</span>
            </button>
          </div>

          {/* Sidebar Content 1: YouTube Live Chat Nobar */}
          {sidebarTab === 'chat' && (
            <div className="h-[580px]">
              <NobarRoomPanel
                room={nobarRoom}
                role={nobarRole}
                isConnected={nobarConnected}
                chatMessages={nobarChat}
                onSendMessage={handleSendNobarMessage}
                onSendReaction={handleSendNobarReaction}
                onCreateRoom={handleCreateNobarRoom}
                onLeaveRoom={handleLeaveNobarRoom}
                defaultUserName={currentUser?.name}
              />
            </div>
          )}

          {/* Sidebar Content 3: Related Anime Cards */}
          {sidebarTab === 'related' && (
            <div className="bg-[#121212] border border-subtle rounded-2xl p-4 space-y-2.5 max-h-[580px] overflow-y-auto">
              <h4 className="text-xs font-bold text-neutral-400 mb-2">Rekomendasi Anime Lainnya</h4>
              <div className="space-y-2">
                {relatedAnime.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => onSelectAnime(rel)}
                    className="p-2 rounded-xl bg-black border border-subtle hover:border-neutral-600 flex items-center gap-3 transition-colors cursor-pointer group"
                  >
                    <img
                      src={getAnimePoster(rel)}
                      alt={getAnimeTitle(rel)}
                      className="w-12 h-16 object-cover rounded-lg flex-shrink-0 group-hover:scale-105 transition-transform"
                    />
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">
                        {getAnimeTitle(rel)}
                      </h5>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {rel.episodes ? `${rel.episodes} Ep` : 'HD'} • {rel.status === 'RELEASING' ? 'Ongoing' : 'Tamat'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reusable Custom Delete Confirmation Modal (Request 4) */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        title="Hapus Komentar?"
        message="Apakah Anda yakin ingin menghapus komentar ini? Komentar dan seluruh balasannya akan dihapus secara permanen."
        itemTitle={deleteModalState.itemTitle}
        confirmLabel="Hapus Komentar"
        onConfirm={handleConfirmDeleteComment}
        onClose={() => setDeleteModalState({ isOpen: false })}
      />

      {/* Guest Episode Switch Confirmation Modal (Issue 4) */}
      <ConfirmDeleteModal
        isOpen={episodeSwitchNobarConfirm.isOpen}
        title="Keluar dari Room Nobar?"
        message="Anda sedang berada dalam sesi nobar sebagai peserta. Mengganti episode sendiri akan mengeluarkan Anda dari room nobar host. Lanjutkan?"
        itemTitle={`Episode ${episodeSwitchNobarConfirm.targetEpisode}`}
        confirmLabel="Keluar & Putar"
        cancelLabel="Tetap di Nobar"
        isDestructive={false}
        onConfirm={handleConfirmGuestEpisodeSwitch}
        onClose={() => setEpisodeSwitchNobarConfirm({ isOpen: false })}
      />

      {/* Custom Nobar Disbanded Modal (Issue 2) */}
      {disbandNotice.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#141414] border border-neutral-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-500 flex items-center justify-center mx-auto shadow-lg shadow-red-950/50">
              <Radio className="w-7 h-7 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white">Room Nobar Telah Dibubarkan</h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {disbandNotice.message}
              </p>
              <p className="text-[11px] text-neutral-500 pt-1">
                Anda akan dialihkan kembali ke Beranda dalam beberapa detik...
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => onBackToHome()}
                className="w-full py-2.5 px-4 bg-white hover:bg-neutral-200 text-black font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md hover:shadow-lg"
              >
                Kembali ke Beranda Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
