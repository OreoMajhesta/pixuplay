import React, { useState, useMemo } from 'react';
import {
  Bookmark,
  Clock,
  Heart,
  Play,
  Trash2,
  X,
  Film,
  Layers,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { Anime, HistoryItem, SavedItem } from '../types';
import { formatTitle } from '../api';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

interface LibraryPageProps {
  history: HistoryItem[];
  favorites: SavedItem[];
  watchlist: SavedItem[];
  allAnimeList?: Anime[];
  onPlayEpisode: (anime: Anime, ep: number, resumeTime?: number) => void;
  onSelectAnime: (anime: Anime) => void;
  onRemoveHistoryItem: (id: string | number, ep: number) => void;
  onRemoveAnimeHistory?: (id: string | number) => void;
  onClearAllHistory: () => void;
  onRemoveFavorite: (id: string | number) => void;
  onRemoveWatchlist: (id: string | number) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  history,
  favorites,
  watchlist,
  allAnimeList = [],
  onPlayEpisode,
  onSelectAnime,
  onRemoveHistoryItem,
  onRemoveAnimeHistory,
  onClearAllHistory,
  onRemoveFavorite,
  onRemoveWatchlist,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'favorites' | 'watchlist'>('history');
  const [historyViewMode, setHistoryViewMode] = useState<'byAnime' | 'byEpisode'>('byAnime');
  const [expandedAnimeId, setExpandedAnimeId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemTitle?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const convertToAnime = (item: HistoryItem | SavedItem): Anime => {
    const titleStr = formatTitle(item.title);
    const key = String(item.animeId || item.id);
    const matched = allAnimeList.find((a) => String(a.animeId || a.id) === key);
    if (matched) {
      return {
        ...matched,
        coverImage: matched.coverImage || { extraLarge: item.poster, large: item.poster },
      };
    }
    return {
      id: item.id,
      animeId: item.animeId || String(item.id),
      title: { english: titleStr, romaji: titleStr },
      coverImage: { extraLarge: item.poster, large: item.poster },
      genres: item.genres,
      description: item.description,
      episodes: (item as HistoryItem).totalEpisodes || (item as SavedItem).episodes,
    };
  };

  const formatSeconds = (sec?: number) => {
    if (!sec || isNaN(sec) || sec <= 0) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Group history by Anime title/ID
  const groupedHistory = useMemo(() => {
    const map = new Map<string, {
      id: string;
      title: string;
      poster: string;
      genres?: string[];
      episodes: HistoryItem[];
    }>();

    for (const item of history) {
      const key = String(item.animeId || item.id);
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          title: formatTitle(item.title),
          poster: item.poster,
          genres: item.genres,
          episodes: [],
        });
      }
      map.get(key)!.episodes.push(item);
    }

    return Array.from(map.values()).map((group) => {
      // Sort episodes: latest watched first
      const sortedEpisodes = [...group.episodes].sort((a, b) => {
        // Fallback to ep number if timestamps match
        return b.ep - a.ep;
      });
      const latestItem = group.episodes[0] || sortedEpisodes[0];
      const matched = allAnimeList.find((a) => String(a.animeId || a.id) === group.id);
      const animeObj: Anime = matched
        ? {
            ...matched,
            coverImage: matched.coverImage || { extraLarge: group.poster, large: group.poster },
          }
        : {
            id: group.id,
            animeId: group.id,
            title: { english: group.title, romaji: group.title },
            coverImage: { extraLarge: group.poster, large: group.poster },
            genres: group.genres,
            description: latestItem?.description,
            episodes: latestItem?.totalEpisodes,
          };

      const percent = latestItem?.progressPercent ?? (
        latestItem?.currentTime && latestItem?.duration
          ? Math.min(100, Math.round((latestItem.currentTime / latestItem.duration) * 100))
          : 0
      );

      return {
        ...group,
        animeObj,
        sortedEpisodes,
        latestItem,
        progressPercent: percent,
      };
    });
  }, [history]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-subtle pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
            Perpustakaan Saya
          </h1>
          <p className="text-sm text-muted">
            Kelola riwayat tontonan anime dengan progress pemutaran, daftar favorit, dan tonton nanti.
          </p>
        </div>

        {/* Clear History Button */}
        {activeSubTab === 'history' && history.length > 0 && (
          <div>
            <button
              onClick={() => {
                setDeleteModal({
                  isOpen: true,
                  title: 'Hapus Semua Riwayat',
                  message: 'Apakah Anda yakin ingin menghapus seluruh riwayat tontonan anime? Tindakan ini tidak dapat dibatalkan.',
                  onConfirm: () => onClearAllHistory(),
                });
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-red-500 hover:text-red-400 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Semua Riwayat
            </button>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-subtle pb-2">
        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all cursor-pointer ${
            activeSubTab === 'history'
              ? 'bg-white text-black shadow'
              : 'text-neutral-400 hover:text-white hover:bg-surface'
          }`}
        >
          <Clock className="w-4 h-4" />
          Riwayat Nonton
          <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
            {history.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('favorites')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all cursor-pointer ${
            activeSubTab === 'favorites'
              ? 'bg-white text-black shadow'
              : 'text-neutral-400 hover:text-white hover:bg-surface'
          }`}
        >
          <Heart className="w-4 h-4" />
          Favorit
          <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
            {favorites.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('watchlist')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all cursor-pointer ${
            activeSubTab === 'watchlist'
              ? 'bg-white text-black shadow'
              : 'text-neutral-400 hover:text-white hover:bg-surface'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          Daftar Tonton
          <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
            {watchlist.length}
          </span>
        </button>
      </div>

      {/* SubTab Content: Riwayat Nonton */}
      {activeSubTab === 'history' && (
        <div className="space-y-6">
          {history.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-subtle rounded-xl">
              <Clock className="w-12 h-12 mx-auto mb-3 text-neutral-600" />
              <h3 className="text-base font-bold text-white mb-1">Belum ada riwayat tontonan</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Anime yang kamu tonton akan otomatis tersimpan lengkap dengan progress durasi menit tontonan.
              </p>
            </div>
          ) : (
            <>
              {/* Dual View Mode Segmented Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-subtle p-2 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setHistoryViewMode('byAnime')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      historyViewMode === 'byAnime'
                        ? 'bg-white text-black shadow'
                        : 'text-neutral-400 hover:text-white hover:bg-surface'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Per Judul Anime
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-neutral-800 text-neutral-300">
                      {groupedHistory.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setHistoryViewMode('byEpisode')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      historyViewMode === 'byEpisode'
                        ? 'bg-white text-black shadow'
                        : 'text-neutral-400 hover:text-white hover:bg-surface'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    Per Episode
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-neutral-800 text-neutral-300">
                      {history.length}
                    </span>
                  </button>
                </div>

                <div className="text-[11px] text-muted px-2">
                  {historyViewMode === 'byAnime'
                    ? `Menampilkan ${groupedHistory.length} judul anime yang telah ditonton`
                    : `Menampilkan ${history.length} episode riwayat tontonan`}
                </div>
              </div>

              {/* VIEW 1: Per Judul Anime (Grouped) */}
              {historyViewMode === 'byAnime' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {groupedHistory.map((group) => {
                    const isExpanded = expandedAnimeId === group.id;
                    const latestEp = group.latestItem?.ep || 1;
                    const latestResumeTime = group.latestItem?.currentTime || 0;
                    const latestDuration = group.latestItem?.duration || 1440;
                    const isCompleted = group.progressPercent >= 90;

                    return (
                      <div
                        key={group.id}
                        className="bg-card border border-subtle hover:border-white/40 rounded-xl overflow-hidden transition-all duration-200 flex flex-col justify-between"
                      >
                        {/* Top: Poster & Info Card */}
                        <div className="p-4 flex gap-4">
                          {/* 2:3 Vertical Anime Poster */}
                          <div
                            onClick={() => onSelectAnime(group.animeObj)}
                            className="relative w-24 sm:w-28 aspect-[2/3] bg-black rounded-lg overflow-hidden flex-shrink-0 cursor-pointer group/poster shadow-md"
                          >
                            <img
                              src={group.poster}
                              alt={group.title}
                              className="w-full h-full object-cover group-hover/poster:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 flex items-center justify-center transition-opacity">
                              <Play className="w-6 h-6 text-white fill-current" />
                            </div>
                            <span className="absolute bottom-1.5 left-1.5 right-1.5 text-center text-[10px] font-black px-1.5 py-0.5 bg-black/90 text-white rounded truncate border border-white/10">
                              {group.episodes.length} Ep Ditonton
                            </span>
                          </div>

                          {/* Right: Info and Latest Progress */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <h3
                                onClick={() => onSelectAnime(group.animeObj)}
                                className="text-sm font-bold text-white hover:underline truncate cursor-pointer"
                                title={group.title}
                              >
                                {group.title}
                              </h3>

                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <span className="px-2 py-0.5 bg-neutral-900 border border-white/20 text-white text-[11px] font-black rounded">
                                  Ep {latestEp}
                                </span>
                                <span className="text-[11px] text-muted truncate">
                                  {group.latestItem?.watchedAt}
                                </span>
                              </div>
                            </div>

                            {/* Playback Progress Bar */}
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                                <span className="text-muted">
                                  {formatSeconds(latestResumeTime)} / {formatSeconds(latestDuration)}
                                </span>
                                <span className={`font-bold ${isCompleted ? 'text-green-400' : 'text-white'}`}>
                                  {isCompleted ? 'Selesai' : `${group.progressPercent}%`}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    isCompleted ? 'bg-green-500' : 'bg-white'
                                  }`}
                                  style={{ width: `${Math.max(4, group.progressPercent)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card Bottom Controls */}
                        <div className="px-4 py-3 bg-surface/50 border-t border-subtle flex items-center gap-2">
                          {/* Play / Resume Button */}
                          <button
                            onClick={() => onPlayEpisode(group.animeObj, latestEp, latestResumeTime)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white text-black text-xs font-bold rounded hover:bg-neutral-200 transition-colors cursor-pointer shadow"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            {isCompleted ? `Tonton Ulang Ep ${latestEp}` : `Lanjut Ep ${latestEp}`}
                          </button>

                          {/* Expand Episodes Toggle */}
                          <button
                            onClick={() => setExpandedAnimeId(isExpanded ? null : group.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded border border-subtle cursor-pointer transition-colors"
                            title="Lihat semua episode yang sudah ditonton"
                          >
                            <span>{group.episodes.length} Ep</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                            )}
                          </button>

                          {/* Delete Entire Anime History */}
                          {onRemoveAnimeHistory && (
                            <button
                              onClick={() => {
                                setDeleteModal({
                                  isOpen: true,
                                  title: 'Hapus Riwayat Anime',
                                  message: 'Hapus seluruh daftar episode yang ditonton untuk anime ini dari riwayat?',
                                  itemTitle: group.title,
                                  onConfirm: () => onRemoveAnimeHistory(group.id),
                                });
                              }}
                              className="p-1.5 bg-neutral-900 hover:bg-red-950 hover:text-red-400 text-neutral-400 rounded border border-subtle cursor-pointer transition-colors"
                              title="Hapus riwayat anime ini"
                              aria-label="Hapus riwayat anime ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Expanded Drawer: All Watched Episodes for this Anime */}
                        {isExpanded && (
                          <div className="p-3 bg-neutral-950 border-t border-subtle space-y-2 animate-fade-in">
                            <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-1">
                              Daftar Episode Ditonton:
                            </p>
                            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                              {group.sortedEpisodes.map((epItem) => {
                                const epPercent = epItem.progressPercent ?? (
                                  epItem.currentTime && epItem.duration
                                    ? Math.min(100, Math.round((epItem.currentTime / epItem.duration) * 100))
                                    : 0
                                );
                                const epFinished = epPercent >= 90;

                                return (
                                  <div
                                    key={`${epItem.id}-${epItem.ep}`}
                                    className="flex items-center justify-between p-2 rounded-lg bg-surface border border-subtle hover:border-white/30 text-xs transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-black text-white px-2 py-0.5 bg-neutral-800 rounded text-[11px]">
                                        Ep {epItem.ep}
                                      </span>
                                      <div className="truncate">
                                        <div className="text-white font-medium text-[11px]">
                                          {formatSeconds(epItem.currentTime)} / {formatSeconds(epItem.duration || 1440)}
                                        </div>
                                        <span className="text-[10px] text-muted">
                                          {epFinished ? 'Selesai ditonton' : `${epPercent}% berjalan`}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <button
                                        onClick={() => onPlayEpisode(group.animeObj, epItem.ep, epItem.currentTime || 0)}
                                        className="p-1.5 bg-white text-black font-bold rounded hover:bg-neutral-200 transition-colors cursor-pointer"
                                        title={`Putar Episode ${epItem.ep}`}
                                      >
                                        <Play className="w-3 h-3 fill-current" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setDeleteModal({
                                            isOpen: true,
                                            title: 'Hapus Episode dari Riwayat',
                                            message: `Hapus Episode ${epItem.ep} dari riwayat tontonan?`,
                                            itemTitle: group.title,
                                            onConfirm: () => onRemoveHistoryItem(epItem.id, epItem.ep),
                                          });
                                        }}
                                        className="p-1.5 text-neutral-400 hover:text-red-400 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                                        title="Hapus episode ini dari riwayat"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* VIEW 2: Per Episode (Chronological List) */}
              {historyViewMode === 'byEpisode' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {history.map((item) => {
                    const animeObj = convertToAnime(item);
                    const epPercent = item.progressPercent ?? (
                      item.currentTime && item.duration
                        ? Math.min(100, Math.round((item.currentTime / item.duration) * 100))
                        : 0
                    );
                    const isCompleted = epPercent >= 90;

                    return (
                      <div
                        key={`${item.id}-${item.ep}`}
                        className="group relative bg-card border border-subtle hover:border-white/50 rounded-xl overflow-hidden transition-all duration-200 flex flex-col justify-between"
                      >
                        {/* Poster + Thumbnail Header */}
                        <div className="relative aspect-video bg-black overflow-hidden">
                          <img
                            src={item.poster}
                            alt={formatTitle(item.title)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 filter brightness-90"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                          {/* Episode Badge */}
                          <span className="absolute top-2 left-2 px-2 py-0.5 bg-white text-black text-xs font-black rounded-xs shadow">
                            Episode {item.ep}
                          </span>

                          {/* Delete this single history item */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModal({
                                isOpen: true,
                                title: 'Hapus Episode dari Riwayat',
                                message: `Hapus Episode ${item.ep} dari riwayat tontonan?`,
                                itemTitle: formatTitle(item.title),
                                onConfirm: () => onRemoveHistoryItem(item.id, item.ep),
                              });
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-red-600 hover:text-white text-neutral-300 rounded-full transition-colors cursor-pointer border border-subtle"
                            title="Hapus episode dari riwayat"
                            aria-label="Hapus dari riwayat"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Resume Play Overlay */}
                          <button
                            onClick={() => onPlayEpisode(animeObj, item.ep, item.currentTime || 0)}
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity cursor-pointer"
                          >
                            <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            </div>
                          </button>

                          {/* Bottom Edge Progress Bar */}
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                            <div
                              className={`h-full ${isCompleted ? 'bg-green-500' : 'bg-white'}`}
                              style={{ width: `${Math.max(3, epPercent)}%` }}
                            />
                          </div>
                        </div>

                        {/* Metadata & Actions */}
                        <div className="p-3.5 flex flex-col justify-between flex-1 gap-3">
                          <div>
                            <h4
                              onClick={() => onSelectAnime(animeObj)}
                              className="text-sm font-bold text-white group-hover:underline truncate cursor-pointer"
                              title={formatTitle(item.title)}
                            >
                              {formatTitle(item.title)}
                            </h4>

                            <div className="flex items-center justify-between text-[11px] font-mono mt-1 text-muted">
                              <span>
                                {formatSeconds(item.currentTime)} / {formatSeconds(item.duration || 1440)}
                              </span>
                              <span className={`font-bold ${isCompleted ? 'text-green-400' : 'text-neutral-300'}`}>
                                {isCompleted ? 'Selesai' : `${epPercent}%`}
                              </span>
                            </div>

                            <p className="text-[10px] text-neutral-500 mt-1">
                              Ditonton {item.watchedAt}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-subtle">
                            <button
                              onClick={() => onPlayEpisode(animeObj, item.ep, item.currentTime || 0)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white text-black text-xs font-bold rounded hover:bg-neutral-200 transition-colors cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              {isCompleted ? `Putar Ulang Ep ${item.ep}` : `Lanjut Ep ${item.ep}`}
                            </button>
                            <button
                              onClick={() => onSelectAnime(animeObj)}
                              className="px-2.5 py-1.5 bg-surface text-neutral-300 hover:text-white text-xs font-semibold rounded border border-subtle cursor-pointer"
                            >
                              Detail
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Favorites Tab */}
      {activeSubTab === 'favorites' && (
        <div>
          {favorites.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-subtle rounded-xl">
              <Heart className="w-12 h-12 mx-auto mb-3 text-neutral-600" />
              <h3 className="text-base font-bold text-white mb-1">Belum ada anime favorit</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Tandai anime favoritmu agar mudah ditemukan kembali di halaman ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {favorites.map((item) => {
                const animeObj = convertToAnime(item);
                return (
                  <div
                    key={item.id}
                    className="group relative bg-card border border-subtle hover:border-white/50 rounded-xl overflow-hidden transition-all duration-200 flex flex-col justify-between"
                  >
                    <div
                      onClick={() => onSelectAnime(animeObj)}
                      className="relative aspect-[3/4] bg-black overflow-hidden cursor-pointer"
                    >
                      <img
                        src={item.poster}
                        alt={formatTitle(item.title)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModal({
                            isOpen: true,
                            title: 'Hapus dari Favorit',
                            message: 'Hapus anime ini dari daftar favorit kamu?',
                            itemTitle: formatTitle(item.title),
                            onConfirm: () => onRemoveFavorite(item.id),
                          });
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-red-600 hover:text-white text-neutral-300 rounded-full transition-colors cursor-pointer border border-subtle"
                        title="Hapus dari favorit"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="p-3">
                      <h4
                        onClick={() => onSelectAnime(animeObj)}
                        className="text-xs font-bold text-white group-hover:underline truncate cursor-pointer"
                        title={formatTitle(item.title)}
                      >
                        {formatTitle(item.title)}
                      </h4>
                      <button
                        onClick={() => onPlayEpisode(animeObj, 1)}
                        className="w-full mt-2 py-1 bg-surface hover:bg-white hover:text-black border border-subtle text-white text-[11px] font-bold rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Tonton
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Watchlist Tab */}
      {activeSubTab === 'watchlist' && (
        <div>
          {watchlist.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-subtle rounded-xl">
              <Bookmark className="w-12 h-12 mx-auto mb-3 text-neutral-600" />
              <h3 className="text-base font-bold text-white mb-1">Daftar tonton kosong</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Tambahkan anime yang ingin kamu tonton nanti ke dalam daftar tonton.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {watchlist.map((item) => {
                const animeObj = convertToAnime(item);
                return (
                  <div
                    key={item.id}
                    className="group relative bg-card border border-subtle hover:border-white/50 rounded-xl overflow-hidden transition-all duration-200 flex flex-col justify-between"
                  >
                    <div
                      onClick={() => onSelectAnime(animeObj)}
                      className="relative aspect-[3/4] bg-black overflow-hidden cursor-pointer"
                    >
                      <img
                        src={item.poster}
                        alt={formatTitle(item.title)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModal({
                            isOpen: true,
                            title: 'Hapus dari Daftar Tonton',
                            message: 'Hapus anime ini dari daftar tonton kamu?',
                            itemTitle: formatTitle(item.title),
                            onConfirm: () => onRemoveWatchlist(item.id),
                          });
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-red-600 hover:text-white text-neutral-300 rounded-full transition-colors cursor-pointer border border-subtle"
                        title="Hapus dari daftar tonton"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="p-3">
                      <h4
                        onClick={() => onSelectAnime(animeObj)}
                        className="text-xs font-bold text-white group-hover:underline truncate cursor-pointer"
                        title={formatTitle(item.title)}
                      >
                        {formatTitle(item.title)}
                      </h4>
                      <button
                        onClick={() => onPlayEpisode(animeObj, 1)}
                        className="w-full mt-2 py-1 bg-surface hover:bg-white hover:text-black border border-subtle text-white text-[11px] font-bold rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Mulai Ep 1
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.title}
        message={deleteModal.message}
        itemTitle={deleteModal.itemTitle}
        onConfirm={deleteModal.onConfirm}
        onClose={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
