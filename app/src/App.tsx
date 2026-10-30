import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { DetailModal } from './components/DetailModal';
import { FloatingMiniPlayer } from './components/FloatingMiniPlayer';
import { SearchModal } from './components/SearchModal';
import { PageSkeleton } from './components/common/PageSkeleton';

const HomePage = React.lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const SchedulePage = React.lazy(() => import('./pages/SchedulePage').then((m) => ({ default: m.SchedulePage })));
const CatalogPage = React.lazy(() => import('./pages/CatalogPage').then((m) => ({ default: m.CatalogPage })));
const LibraryPage = React.lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const WatchPage = React.lazy(() => import('./pages/WatchPage').then((m) => ({ default: m.WatchPage })));
import { ContentWarningModal, checkIsSensitiveContent } from './components/ContentWarningModal';
import { DonateModal } from './components/DonateModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { WelcomeModal } from './components/WelcomeModal';
import { Anime, HistoryItem, SavedItem, StreamServer, UserProfile } from './types';
import {
  loginWithGoogleCredential,
  fetchCurrentUserData,
  syncUserDataToCloud,
  logoutUser,
  getStoredUser,
} from './services/authService';
import {
  getTrendingAnime,
  getOngoingAnime,
  getCompletedAnime,
  getShounenAnime,
  getIsekaiAnime,
  getClassicsAnime,
  getAnimeTitle,
  getAnimePoster,
  getAnimeDetail,
} from './api';
import { getNobarRoom } from './nobarSync';
import logoNav from './assets/logo_nav.svg';

export const App: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<string>('beranda');

  // Anime categories data
  const [trending, setTrending] = useState<Anime[]>([]);
  const [ongoing, setOngoing] = useState<Anime[]>([]);
  const [completed, setCompleted] = useState<Anime[]>([]);
  const [shounen, setShounen] = useState<Anime[]>([]);
  const [isekai, setIsekai] = useState<Anime[]>([]);
  const [classics, setClassics] = useState<Anime[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Filter state for Catalog navigation from "Lihat Semua"
  const [catalogFilter, setCatalogFilter] = useState<{
    status?: string;
    genre?: string;
    sortBy?: string;
  }>({});

  // Redirect unknown pathnames to home "/" (Fixes Request 5)
  useEffect(() => {
    if (
      window.location.pathname &&
      window.location.pathname !== '/' &&
      window.location.pathname !== '' &&
      window.location.pathname !== '/privacy' &&
      window.location.pathname !== '/terms' &&
      window.location.pathname !== '/privacy.html' &&
      window.location.pathname !== '/terms.html'
    ) {
      const search = window.location.search || '';
      window.history.replaceState({}, '', '/' + search);
      setActiveTab('beranda');
    }

    const handlePopState = () => {
      if (window.location.pathname && window.location.pathname !== '/' && window.location.pathname !== '') {
        const search = window.location.search || '';
        window.history.replaceState({}, '', '/' + search);
        setActiveTab('beranda');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigateTab = (
    tab: string,
    filter?: { status?: string; genre?: string; sortBy?: string }
  ) => {
    if (filter) {
      setCatalogFilter(filter);
    }
    // If currently watching on full page, minimize to PiP when user clicks a navbar tab
    if (playingAnime && !isMinimized) {
      setIsMinimized(true);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Modals & Player State
  const [selectedDetailAnime, setSelectedDetailAnime] = useState<Anime | null>(null);
  const [playingAnime, setPlayingAnime] = useState<Anime | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<number>(1);
  const [currentStreamServer, setCurrentStreamServer] = useState<StreamServer | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [activeNobarRoomId, setActiveNobarRoomId] = useState<string | null>(null);
  const [initialResumeTime, setInitialResumeTime] = useState<number>(0);
  const [playbackIsPlaying, setPlaybackIsPlaying] = useState<boolean>(true);
  const [isDonateOpen, setIsDonateOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('pixuplay_donate_modal_dismissed');
    } catch {
      return true;
    }
  });

  // Nobar room switch confirmation (Fixes Bug 2)
  const [nobarSwitchConfirm, setNobarSwitchConfirm] = useState<{
    isOpen: boolean;
    targetAnime?: Anime;
    targetEpisode?: number;
    targetResumeTime?: number;
  }>({ isOpen: false });

  // Sensitive content warning state (Ecchi / Gore)
  const [warningState, setWarningState] = useState<{
    anime: Anime;
    episode: number;
    genres: string[];
    resumeTime?: number;
  } | null>(null);

  // Safe helper to sanitize stored items from legacy or corrupted data
  const sanitizeList = (raw: any): any[] => {
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item: any) => {
        let titleStr = 'Anime';
        if (typeof item.title === 'string') {
          titleStr = item.title;
        } else if (typeof item.title === 'object' && item.title !== null) {
          titleStr = item.title.english || item.title.romaji || item.title.userPreferred || item.title.native || 'Anime';
        }
        return {
          ...item,
          title: titleStr,
        };
      });
    } catch {
      return [];
    }
  };

  // Helper for isolated storage keys (Guest vs Logged-In User)
  const getStorageKey = (type: 'history' | 'favorites' | 'watchlist', user: UserProfile | null) => {
    if (user?.id) {
      return `pixuplay_user_${user.id}_${type}`;
    }
    return `pixuplay_guest_${type}`;
  };

  const loadListFromStorage = (type: 'history' | 'favorites' | 'watchlist', user: UserProfile | null) => {
    try {
      const key = getStorageKey(type, user);
      let raw = localStorage.getItem(key);
      // Legacy fallback: if guest key is empty, check legacy pixuplay_${type}
      if (!raw && !user) {
        raw = localStorage.getItem(`pixuplay_${type}`);
      }
      return sanitizeList(raw);
    } catch {
      return [];
    }
  };

  // Google OAuth User Profile & Cloud Synchronization
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUser());

  // Storage states initialized with isolation per current context (user vs guest)
  const [history, setHistory] = useState<HistoryItem[]>(() => loadListFromStorage('history', getStoredUser()));
  const [favorites, setFavorites] = useState<SavedItem[]>(() => loadListFromStorage('favorites', getStoredUser()));
  const [watchlist, setWatchlist] = useState<SavedItem[]>(() => loadListFromStorage('watchlist', getStoredUser()));

  // Active refs for synchronous unload and tab close access
  const playingAnimeRef = useRef<Anime | null>(playingAnime);
  const playingEpisodeRef = useRef<number>(playingEpisode);
  const initialResumeTimeRef = useRef<number>(initialResumeTime);
  const currentUserRef = useRef<UserProfile | null>(currentUser);
  const historyRef = useRef<HistoryItem[]>(history);
  const favoritesRef = useRef<SavedItem[]>(favorites);
  const watchlistRef = useRef<SavedItem[]>(watchlist);

  useEffect(() => { playingAnimeRef.current = playingAnime; }, [playingAnime]);
  useEffect(() => { playingEpisodeRef.current = playingEpisode; }, [playingEpisode]);
  useEffect(() => { initialResumeTimeRef.current = initialResumeTime; }, [initialResumeTime]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { favoritesRef.current = favorites; }, [favorites]);
  useEffect(() => { watchlistRef.current = watchlist; }, [watchlist]);

  // First-time onboarding modal state: only open if user has no session AND hasn't made a choice yet
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(() => {
    try {
      const hasToken = !!localStorage.getItem('pixuplay_auth_token');
      const hasChoice = !!localStorage.getItem('pixuplay_onboarding_choice');
      return !hasToken && !hasChoice;
    } catch {
      return false;
    }
  });

  const handleDismissWelcomeModal = (choice: 'google' | 'guest') => {
    setShowWelcomeModal(false);
    try {
      localStorage.setItem('pixuplay_onboarding_choice', choice);
    } catch {}
  };

  // Sync state changes to context-isolated storage
  useEffect(() => {
    try {
      const key = getStorageKey('history', currentUser);
      localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to save history to storage', e);
    }
  }, [history, currentUser]);

  useEffect(() => {
    try {
      const key = getStorageKey('favorites', currentUser);
      localStorage.setItem(key, JSON.stringify(favorites));
    } catch (e) {
      console.warn('Failed to save favorites to storage', e);
    }
  }, [favorites, currentUser]);

  useEffect(() => {
    try {
      const key = getStorageKey('watchlist', currentUser);
      localStorage.setItem(key, JSON.stringify(watchlist));
    } catch (e) {
      console.warn('Failed to save watchlist to storage', e);
    }
  }, [watchlist, currentUser]);

  // Check backend session and hydrate synced cloud data on mount
  useEffect(() => {
    let isMounted = true;
    fetchCurrentUserData().then((result) => {
      if (!isMounted) return;
      if (result) {
        setCurrentUser(result.user);
        if (result.syncedData.history.length > 0) {
          setHistory(result.syncedData.history);
        }
        if (result.syncedData.favorites.length > 0) {
          setFavorites(result.syncedData.favorites);
        }
        if (result.syncedData.watchlist.length > 0) {
          setWatchlist(result.syncedData.watchlist);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time listener for auth changes, avatar changes, and watch heartbeat EXP / Level updates
  useEffect(() => {
    const handleAuthChange = () => {
      const u = getStoredUser();
      setCurrentUser(u);
    };
    window.addEventListener('pixuplay_auth_changed', handleAuthChange);
    window.addEventListener('pixuplay_avatar_changed', handleAuthChange);
    window.addEventListener('pixuplay_watch_time_updated', handleAuthChange);
    return () => {
      window.removeEventListener('pixuplay_auth_changed', handleAuthChange);
      window.removeEventListener('pixuplay_avatar_changed', handleAuthChange);
      window.removeEventListener('pixuplay_watch_time_updated', handleAuthChange);
    };
  }, []);

  // Automatically fetch fresh user level and profile settings from API when switching to profile tab
  useEffect(() => {
    if (activeTab === 'profil') {
      fetchCurrentUserData().then((result) => {
        if (result && result.user) {
          setCurrentUser(result.user);
        }
      });
    }
  }, [activeTab]);

  // Debounced cloud synchronization when logged in
  const syncTimerRef = useRef<any>(null);
  useEffect(() => {
    if (!currentUser) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncUserDataToCloud({ history, favorites, watchlist });
    }, 2000);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [currentUser, history, favorites, watchlist]);

  // Synchronous unload / tab close listener to save live watch progress
  useEffect(() => {
    const handleWindowUnload = () => {
      const anime = playingAnimeRef.current;
      const ep = playingEpisodeRef.current;
      const resume = initialResumeTimeRef.current;
      if (anime && ep !== undefined) {
        handleSaveHistory(anime, ep, resume, 1440);
      }
      if (currentUserRef.current && historyRef.current.length > 0) {
        syncUserDataToCloud({
          history: historyRef.current,
          favorites: favoritesRef.current,
          watchlist: watchlistRef.current,
        });
      }
    };

    window.addEventListener('beforeunload', handleWindowUnload);
    window.addEventListener('pagehide', handleWindowUnload);
    return () => {
      window.removeEventListener('beforeunload', handleWindowUnload);
      window.removeEventListener('pagehide', handleWindowUnload);
    };
  }, []);

  const handleGoogleLogin = async (credential: string) => {
    // Isolated login - guest data is NOT sent/merged to cloud, preventing duplicate account exploits
    const res = await loginWithGoogleCredential(credential);
    setCurrentUser(res.user);
    if (res.syncedData) {
      setHistory(res.syncedData.history || []);
      setFavorites(res.syncedData.favorites || []);
      setWatchlist(res.syncedData.watchlist || []);
    }
    handleDismissWelcomeModal('google');
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    // Restore isolated guest data (not user data)
    setHistory(loadListFromStorage('history', null));
    setFavorites(loadListFromStorage('favorites', null));
    setWatchlist(loadListFromStorage('watchlist', null));
  };

  // Initial load of anime data
  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      setLoadingData(true);
      try {
        const [trend, ongo, comp, shou, isek, clas] = await Promise.all([
          getTrendingAnime(),
          getOngoingAnime(),
          getCompletedAnime(),
          getShounenAnime(),
          getIsekaiAnime(),
          getClassicsAnime(),
        ]);
        if (isMounted) {
          setTrending(trend);
          setOngoing(ongo);
          setCompleted(comp);
          setShounen(shou);
          setIsekai(isek);
          setClassics(clas);
          setLoadingData(false);
        }
      } catch (err) {
        console.error('Error loading anime rows:', err);
        if (isMounted) setLoadingData(false);
      }
    };
    loadAll();
    return () => {
      isMounted = false;
    };
  }, []);

  // Combined anime catalog list
  const catalogList: Anime[] = React.useMemo(() => {
    const map = new Map<string, Anime>();
    [...trending, ...ongoing, ...completed, ...shounen, ...isekai, ...classics].forEach((a) => {
      const key = String(a.animeId || a.id);
      if (!map.has(key)) map.set(key, a);
    });
    return Array.from(map.values());
  }, [trending, ongoing, completed, shounen, isekai, classics]);

  // Auto-connect to Nobar room if ?nobar=roomId is present in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nobarParam = params.get('nobar');
    if (!nobarParam) return;

    setActiveNobarRoomId(nobarParam);
    (async () => {
      const room = await getNobarRoom(nobarParam);
      if (room) {
        let animeObj: Anime | null = null;
        if (room.animeId) {
          animeObj = await getAnimeDetail(room.animeId);
        }
        if (!animeObj) {
          animeObj = {
            id: room.animeId || 'nobar-anime',
            animeId: room.animeId,
            title: { english: room.animeTitle, romaji: room.animeTitle },
            coverImage: {
              extraLarge: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80',
            },
          };
        }
        handlePlayEpisode(animeObj, room.episode || 1);
      }
    })();
  }, []);

  const getMaxEpisode = (anime: Anime | null): number => {
    if (!anime) return 1;
    if (anime.episodeList && anime.episodeList.length > 0) {
      const numbers = anime.episodeList
        .map((ep, idx) => {
          const num = parseInt(String(ep.title).replace(/[^0-9]/g, ''), 10);
          return isNaN(num) ? idx + 1 : num;
        })
        .filter((n) => !isNaN(n));
      if (numbers.length > 0) {
        return Math.max(...numbers);
      }
      return anime.episodeList.length;
    }
    const epNum = parseInt(String(anime.episodes).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(epNum) && epNum > 0) {
      return epNum;
    }
    return 1;
  };

  const actuallyPlayEpisode = (
    anime: Anime,
    ep: number = 1,
    resumeTime: number = 0,
    isNobarSync: boolean = false
  ) => {
    const maxEp = getMaxEpisode(anime);
    const validEp = Math.min(Math.max(1, ep), maxEp);

    const isHost = activeNobarRoomId
      ? !!localStorage.getItem(`pixuplay_nobar_host_${activeNobarRoomId}`)
      : false;

    // Safeguard for Bug 2: if a GUEST switches to a different anime voluntarily (not via nobar sync), disconnect from room.
    // If the HOST switches anime OR guest is synced by host, retain activeNobarRoomId!
    if (
      activeNobarRoomId &&
      !isHost &&
      !isNobarSync &&
      playingAnime &&
      String(playingAnime.animeId || playingAnime.id) !== String(anime.animeId || anime.id)
    ) {
      handleNobarRoomChange(null);
    }

    const animeKey = String(anime.animeId || anime.id);
    const existingEpHistory = historyRef.current.find(
      (h) => String(h.animeId || h.id) === animeKey && h.ep === validEp
    );
    const effectiveResumeTime =
      resumeTime > 0 ? resumeTime : existingEpHistory?.currentTime || 0;

    setPlayingAnime(anime);
    setPlayingEpisode(validEp);
    setInitialResumeTime(effectiveResumeTime);
    initialResumeTimeRef.current = effectiveResumeTime;
    setPlaybackIsPlaying(true);
    setIsPlayerOpen(true);
    setIsMinimized(false);
    // Record immediately in watch history so episode & timestamp are up to date
    handleSaveHistory(
      anime,
      validEp,
      effectiveResumeTime > 0 ? effectiveResumeTime : undefined,
      existingEpHistory?.duration || 1440
    );
    // Automatically close detail modal when playback starts
    setSelectedDetailAnime(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Player Control Functions with Ecchi / Gore 18+ Warning Check
  const handlePlayEpisode = async (anime: Anime, ep: number = 1, resumeTime: number = 0) => {
    const isDifferentAnime =
      playingAnime &&
      String(playingAnime.animeId || playingAnime.id) !== String(anime.animeId || anime.id);

    const isHost = activeNobarRoomId
      ? !!localStorage.getItem(`pixuplay_nobar_host_${activeNobarRoomId}`)
      : false;

    // If currently in an active Nobar room as a GUEST and attempting to play another anime, confirm leaving room
    if (activeNobarRoomId && isDifferentAnime && !isHost) {
      setNobarSwitchConfirm({
        isOpen: true,
        targetAnime: anime,
        targetEpisode: ep,
        targetResumeTime: resumeTime,
      });
      return;
    }

    const animeId = anime.id || anime.animeId;
    const sessionKey = `pixuplay_warning_accepted_${animeId}`;
    const alreadyAccepted = sessionStorage.getItem(sessionKey);

    if (alreadyAccepted) {
      actuallyPlayEpisode(anime, ep, resumeTime);
      return;
    }

    let check = checkIsSensitiveContent(anime);

    // If anime.genres is empty or missing (summary card), fetch full detail to accurately verify genres
    if (!check.isSensitive && animeId && (!anime.genres || anime.genres.length === 0)) {
      try {
        const detail = await getAnimeDetail(animeId);
        if (detail) {
          check = checkIsSensitiveContent(detail);
        }
      } catch {}
    }

    if (check.isSensitive) {
      setWarningState({
        anime,
        episode: ep,
        genres: check.genres,
        resumeTime,
      });
      return;
    }

    actuallyPlayEpisode(anime, ep, resumeTime);
  };

  const handleConfirmSwitchAnimeNobar = () => {
    if (!nobarSwitchConfirm.targetAnime) return;
    const targetAnime = nobarSwitchConfirm.targetAnime;
    const targetEp = nobarSwitchConfirm.targetEpisode || 1;
    const targetResume = nobarSwitchConfirm.targetResumeTime || 0;
    handleNobarRoomChange(null);
    setNobarSwitchConfirm({ isOpen: false });
    actuallyPlayEpisode(targetAnime, targetEp, targetResume);
  };

  const handleConfirmWarning = () => {
    if (!warningState) return;
    const animeId = warningState.anime.id || warningState.anime.animeId;
    sessionStorage.setItem(`pixuplay_warning_accepted_${animeId}`, 'true');
    actuallyPlayEpisode(warningState.anime, warningState.episode, warningState.resumeTime || 0);
    setWarningState(null);
  };

  const handlePlaybackSync = (curTime: number, isPlaying: boolean) => {
    initialResumeTimeRef.current = curTime;
    setInitialResumeTime(curTime);
    setPlaybackIsPlaying(isPlaying);
  };

  const handleMinimizePlayer = (curTime?: number, isPlaying?: boolean) => {
    if (curTime !== undefined) {
      setInitialResumeTime(curTime);
    }
    if (isPlaying !== undefined) {
      setPlaybackIsPlaying(isPlaying);
    }
    setIsPlayerOpen(false);
    setIsMinimized(true);
  };

  const handleMaximizePlayer = (curTime?: number, isPlaying?: boolean) => {
    if (curTime !== undefined) {
      setInitialResumeTime(curTime);
    }
    if (isPlaying !== undefined) {
      setPlaybackIsPlaying(isPlaying);
    }
    setIsMinimized(false);
    setIsPlayerOpen(true);
  };

  const handleNobarRoomChange = (roomId: string | null) => {
    setActiveNobarRoomId(roomId);
    try {
      const url = new URL(window.location.href);
      if (roomId) {
        url.searchParams.set('nobar', roomId);
      } else {
        url.searchParams.delete('nobar');
      }
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.warn('Could not update url params', e);
    }
  };

  const handleClosePlayer = () => {
    if (playingAnimeRef.current && playingEpisodeRef.current !== undefined) {
      const curTime = initialResumeTimeRef.current || 0;
      handleSaveHistory(playingAnimeRef.current, playingEpisodeRef.current, curTime, 1440);
    }
    setIsPlayerOpen(false);
    setIsMinimized(false);
    setPlayingAnime(null);
    setCurrentStreamServer(null);
    handleNobarRoomChange(null);
  };

  const handleNextEpisode = () => {
    const maxEp = getMaxEpisode(playingAnime);
    if (playingEpisode >= maxEp) return;
    setPlayingEpisode((prev) => Math.min(maxEp, prev + 1));
    setInitialResumeTime(0);
  };

  const handlePrevEpisode = () => {
    if (playingEpisode <= 1) return;
    setPlayingEpisode((prev) => Math.max(1, prev - 1));
    setInitialResumeTime(0);
  };

  // Watch History Handlers with Playback Progress Tracking
  const handleSaveHistory = (
    anime: Anime,
    ep: number,
    currentTime?: number,
    duration?: number
  ) => {
    const id = anime.animeId || anime.id;
    const title = getAnimeTitle(anime);
    const poster = getAnimePoster(anime);
    const now = new Date();
    const timeStr = now.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const progressPercent =
      currentTime !== undefined && duration && duration > 0
        ? Math.min(100, Math.round((currentTime / duration) * 100))
        : undefined;

    setHistory((prev) => {
      const existing = prev.find((x) => String(x.id) === String(id) && x.ep === ep);
      const finalCurrentTime =
        currentTime !== undefined && currentTime > 0
          ? currentTime
          : existing?.currentTime !== undefined && existing.currentTime > 0
          ? existing.currentTime
          : currentTime;
      const finalDuration =
        duration !== undefined && duration > 0 && (duration !== 1440 || !existing?.duration)
          ? duration
          : existing?.duration || duration || 1440;
      const finalProgressPercent =
        finalCurrentTime !== undefined && finalCurrentTime > 0 && finalDuration && finalDuration > 0
          ? Math.min(100, Math.round((finalCurrentTime / finalDuration) * 100))
          : progressPercent !== undefined
          ? progressPercent
          : existing?.progressPercent;

      const newItem: HistoryItem = {
        id,
        animeId: String(id),
        title,
        poster,
        ep,
        watchedAt: timeStr,
        genres: anime.genres,
        currentTime: finalCurrentTime,
        duration: finalDuration,
        progressPercent: finalProgressPercent,
        totalEpisodes: anime.episodes,
        description: anime.description,
      };

      const filtered = prev.filter((x) => !(String(x.id) === String(id) && x.ep === ep));
      const nextList = [newItem, ...filtered].slice(0, 100); // Keep max 100 items

      // Synchronously write to localStorage immediately!
      try {
        const key = getStorageKey('history', currentUserRef.current);
        localStorage.setItem(key, JSON.stringify(nextList));
      } catch (e) {
        console.warn('Failed to write history synchronously to storage', e);
      }
      historyRef.current = nextList;
      return nextList;
    });

    if (currentUserRef.current) {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        syncUserDataToCloud({
          history: historyRef.current,
          favorites: favoritesRef.current,
          watchlist: watchlistRef.current,
        });
      }, 1500);
    }
  };

  const handleRemoveHistoryItem = (id: string | number, ep: number) => {
    setHistory((prev) => prev.filter((x) => !(String(x.id) === String(id) && x.ep === ep)));
  };

  const handleRemoveAnimeHistory = (id: string | number) => {
    setHistory((prev) =>
      prev.filter((x) => String(x.id) !== String(id) && String(x.animeId) !== String(id))
    );
  };

  const handleClearAllHistory = () => {
    setHistory([]);
    try {
      const key = getStorageKey('history', currentUser);
      localStorage.removeItem(key);
      localStorage.removeItem('pixuplay_history');
    } catch {}
  };

  // Favorites Handlers
  const isAnimeFavorite = (anime: Anime | null) => {
    if (!anime) return false;
    const id = String(anime.animeId || anime.id);
    return favorites.some((f) => String(f.id) === id || String(f.animeId) === id);
  };

  const handleToggleFavorite = (anime: Anime) => {
    const id = anime.animeId || anime.id;
    const strId = String(id);
    if (isAnimeFavorite(anime)) {
      setFavorites((prev) => prev.filter((f) => String(f.id) !== strId && String(f.animeId) !== strId));
    } else {
      const item: SavedItem = {
        id,
        animeId: strId,
        title: getAnimeTitle(anime),
        poster: getAnimePoster(anime),
        episodes: anime.episodes,
        score: anime.averageScore,
        genres: anime.genres,
        description: anime.description,
      };
      setFavorites((prev) => [item, ...prev]);
    }
  };

  const handleRemoveFavorite = (id: string | number) => {
    setFavorites((prev) => prev.filter((f) => String(f.id) !== String(id) && String(f.animeId) !== String(id)));
  };

  // Watchlist Handlers
  const isAnimeWatchlist = (anime: Anime | null) => {
    if (!anime) return false;
    const id = String(anime.animeId || anime.id);
    return watchlist.some((w) => String(w.id) === id || String(w.animeId) === id);
  };

  const handleToggleWatchlist = (anime: Anime) => {
    const id = anime.animeId || anime.id;
    const strId = String(id);
    if (isAnimeWatchlist(anime)) {
      setWatchlist((prev) => prev.filter((w) => String(w.id) !== strId && String(w.animeId) !== strId));
    } else {
      const item: SavedItem = {
        id,
        animeId: strId,
        title: getAnimeTitle(anime),
        poster: getAnimePoster(anime),
        episodes: anime.episodes,
        score: anime.averageScore,
        genres: anime.genres,
        description: anime.description,
      };
      setWatchlist((prev) => [item, ...prev]);
    }
  };

  const handleRemoveWatchlist = (id: string | number) => {
    setWatchlist((prev) => prev.filter((w) => String(w.id) !== String(id) && String(w.animeId) !== String(id)));
  };

  const handleResetAllData = () => {
    setHistory([]);
    setFavorites([]);
    setWatchlist([]);
    localStorage.clear();
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Top Monochrome Navigation Bar */}
      <Navbar
        activeTab={playingAnime && !isMinimized ? 'watch' : activeTab}
        onSelectTab={handleNavigateTab}
        onOpenSearch={() => setIsSearchOpen(true)}
        watchlistCount={watchlist.length}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Page Content */}
      <main className="flex-1">
        <React.Suspense fallback={<PageSkeleton />}>
          {playingAnime && !isMinimized ? (
            <WatchPage
              key={`watch-${playingAnime.animeId || playingAnime.id}-${playingEpisode}`}
              anime={playingAnime}
              episode={playingEpisode}
              initialResumeTime={initialResumeTime}
              initialIsPlaying={playbackIsPlaying}
              initialNobarRoomId={activeNobarRoomId}
              history={history}
              watchlist={watchlist}
              favorites={favorites}
              allAnimeList={catalogList}
              currentUser={currentUser}
              onOpenLogin={() => {
                handleClosePlayer();
                handleNavigateTab('profil');
              }}
              onBackToHome={handleClosePlayer}
              onMinimize={handleMinimizePlayer}
              onSelectEpisode={(ep, resumeTime) => {
                if (playingAnimeRef.current && playingEpisodeRef.current !== undefined) {
                  handleSaveHistory(
                    playingAnimeRef.current,
                    playingEpisodeRef.current,
                    initialResumeTimeRef.current || 0,
                    1440
                  );
                }
                const animeKey = String(playingAnime.animeId || playingAnime.id);
                const existingEp = historyRef.current.find(
                  (h) => String(h.animeId || h.id) === animeKey && h.ep === ep
                );
                const nextResume = resumeTime !== undefined ? resumeTime : existingEp?.currentTime || 0;
                setPlayingEpisode(ep);
                setInitialResumeTime(nextResume);
                initialResumeTimeRef.current = nextResume;
              }}
              onServerChange={setCurrentStreamServer}
              onToggleFavorite={handleToggleFavorite}
              onToggleWatchlist={handleToggleWatchlist}
              onSaveHistory={handleSaveHistory}
              onNobarRoomChange={handleNobarRoomChange}
              onPlaybackSync={handlePlaybackSync}
              onSelectAnime={(related, isNobarSync) => {
                if (isNobarSync) {
                  actuallyPlayEpisode(related, 1, 0, true);
                } else {
                  handlePlayEpisode(related, 1);
                }
              }}
            />
          ) : (
            <>
              {activeTab === 'beranda' && (
                <HomePage
                  trending={trending}
                  ongoing={ongoing}
                  completed={completed}
                  shounen={shounen}
                  isekai={isekai}
                  classics={classics}
                  history={history}
                  allAnimeList={catalogList}
                  onSelectAnime={setSelectedDetailAnime}
                  onQuickPlay={handlePlayEpisode}
                  onToggleWatchlist={handleToggleWatchlist}
                  onRemoveAnimeHistory={handleRemoveAnimeHistory}
                  watchlist={watchlist}
                  onNavigateTab={handleNavigateTab}
                />
              )}

              {activeTab === 'jadwal' && (
                <SchedulePage
                  onSelectAnime={setSelectedDetailAnime}
                  onQuickPlay={handlePlayEpisode}
                />
              )}

              {activeTab === 'katalog' && (
                <CatalogPage
                  animeList={catalogList}
                  history={history}
                  onSelectAnime={setSelectedDetailAnime}
                  onQuickPlay={handlePlayEpisode}
                  initialStatus={catalogFilter.status}
                  initialGenre={catalogFilter.genre}
                  initialSortBy={catalogFilter.sortBy}
                />
              )}

              {activeTab === 'library' && (
                <LibraryPage
                  history={history}
                  favorites={favorites}
                  watchlist={watchlist}
                  allAnimeList={catalogList}
                  onPlayEpisode={handlePlayEpisode}
                  onSelectAnime={setSelectedDetailAnime}
                  onRemoveHistoryItem={handleRemoveHistoryItem}
                  onRemoveAnimeHistory={handleRemoveAnimeHistory}
                  onClearAllHistory={handleClearAllHistory}
                  onRemoveFavorite={handleRemoveFavorite}
                  onRemoveWatchlist={handleRemoveWatchlist}
                />
              )}

              {activeTab === 'profil' && (
                <ProfilePage
                  currentUser={currentUser}
                  history={history}
                  favorites={favorites}
                  watchlist={watchlist}
                  onClearHistory={handleClearAllHistory}
                  onResetAllData={handleResetAllData}
                  onGoogleLogin={handleGoogleLogin}
                  onLogout={handleLogout}
                  onRefreshUser={async () => {
                    const res = await fetchCurrentUserData();
                    if (res?.user) setCurrentUser(res.user);
                  }}
                />
              )}
            </>
          )}
        </React.Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t border-subtle bg-black py-8 px-4 text-xs text-muted">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logoNav} alt="PIXUPLAY" className="h-6 w-auto object-contain" />
            <span>—</span>
            <span>Streaming Anime Sub Indo</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <button onClick={() => handleNavigateTab('beranda')} className="hover:text-white cursor-pointer">
              Beranda
            </button>
            <button onClick={() => handleNavigateTab('jadwal')} className="hover:text-white cursor-pointer">
              Jadwal
            </button>
            <button onClick={() => handleNavigateTab('katalog')} className="hover:text-white cursor-pointer">
              Katalog
            </button>
            <button onClick={() => handleNavigateTab('library')} className="hover:text-white cursor-pointer">
              Riwayat
            </button>
            <a href="/privacy" className="hover:text-white cursor-pointer text-zinc-400">
              Kebijakan Privasi
            </a>
            <a href="/terms" className="hover:text-white cursor-pointer text-zinc-400">
              Syarat & Ketentuan
            </a>
            <button onClick={() => setIsDonateOpen(true)} className="text-amber-400 hover:text-white cursor-pointer font-bold">
              Donasi
            </button>
          </div>
        </div>
      </footer>

      {/* Anime Detail Modal */}
      <DetailModal
        anime={selectedDetailAnime}
        history={history}
        onClose={() => setSelectedDetailAnime(null)}
        onPlayEpisode={handlePlayEpisode}
        isFavorite={isAnimeFavorite(selectedDetailAnime)}
        isWatchlist={isAnimeWatchlist(selectedDetailAnime)}
        onToggleFavorite={handleToggleFavorite}
        onToggleWatchlist={handleToggleWatchlist}
      />

      {/* Floating Mini Player (Picture-in-Picture Docked at Bottom-Right) */}
      {isMinimized && playingAnime && (
        <FloatingMiniPlayer
          anime={playingAnime}
          episode={playingEpisode}
          server={currentStreamServer}
          initialTime={initialResumeTime}
          initialIsPlaying={playbackIsPlaying}
          maxEpisode={getMaxEpisode(playingAnime)}
          onServerChange={setCurrentStreamServer}
          onSaveHistory={handleSaveHistory}
          onPlaybackSync={handlePlaybackSync}
          onMaximize={handleMaximizePlayer}
          onClose={handleClosePlayer}
          onNextEpisode={handleNextEpisode}
          onPrevEpisode={handlePrevEpisode}
        />
      )}

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        history={history}
        onClose={() => setIsSearchOpen(false)}
        onSelectAnime={(anime) => {
          setIsSearchOpen(false);
          setSelectedDetailAnime(anime);
        }}
        onQuickPlay={(anime, ep, resumeTime) => {
          setIsSearchOpen(false);
          handlePlayEpisode(anime, ep ?? 1, resumeTime ?? 0);
        }}
      />

      {/* 18+ Sensitive Content Warning Modal (Ecchi / Gore) */}
      <ContentWarningModal
        isOpen={warningState !== null}
        anime={warningState?.anime || null}
        episodeNumber={warningState?.episode || 1}
        detectedGenres={warningState?.genres || []}
        onConfirm={handleConfirmWarning}
        onCancel={() => setWarningState(null)}
      />

      {/* Nobar Exit Confirmation Modal when playing another anime (Fixes Bug 2) */}
      <ConfirmDeleteModal
        isOpen={nobarSwitchConfirm.isOpen}
        title="Keluar dari Room Nobar?"
        message="Anda saat ini sedang terhubung ke sesi nobar bersama penonton lain. Menonton anime lain akan memutuskan sesi nobar ini."
        itemTitle={nobarSwitchConfirm.targetAnime ? getAnimeTitle(nobarSwitchConfirm.targetAnime) : undefined}
        confirmLabel="Keluar & Tonton"
        cancelLabel="Tetap di Nobar"
        isDestructive={false}
        onConfirm={handleConfirmSwitchAnimeNobar}
        onClose={() => setNobarSwitchConfirm({ isOpen: false })}
      />

      {/* Initial Welcome & Support Donation Popup */}
      <DonateModal
        isOpen={isDonateOpen}
        onClose={() => setIsDonateOpen(false)}
      />

      {/* First-time Onboarding Modal (Choice between Google Login and Guest Mode) */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => handleDismissWelcomeModal('guest')}
        onSelectGuest={() => handleDismissWelcomeModal('guest')}
        onGoogleLoginSuccess={async (credential) => {
          await handleGoogleLogin(credential);
          handleDismissWelcomeModal('google');
        }}
      />
    </div>
  );
};

export default App;
