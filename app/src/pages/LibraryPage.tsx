import React, { useState, useMemo } from 'react';
import {
  Bookmark,
  Clock,
  Heart,
  Trash2,
} from 'lucide-react';
import { Anime, HistoryItem, SavedItem } from '../types';
import { formatTitle } from '../api';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { LibraryHistoryTab } from '../components/library/LibraryHistoryTab';
import { LibrarySavedTab } from '../components/library/LibrarySavedTab';

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
      const sortedEpisodes = [...group.episodes].sort((a, b) => b.ep - a.ep);
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
  }, [history, allAnimeList]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-white/5 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
            Perpustakaan Saya
          </h1>
          <p className="text-sm text-neutral-400">
            Kelola riwayat tontonan anime dengan progress pemutaran, daftar favorit, dan tonton nanti.
          </p>
        </div>

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
              className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-red-500 hover:text-red-400 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Semua Riwayat
            </button>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${
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

      {/* Tab Contents */}
      {activeSubTab === 'history' && (
        <LibraryHistoryTab
          history={history}
          groupedHistory={groupedHistory}
          historyViewMode={historyViewMode}
          setHistoryViewMode={setHistoryViewMode}
          expandedAnimeId={expandedAnimeId}
          setExpandedAnimeId={setExpandedAnimeId}
          onPlayEpisode={onPlayEpisode}
          onSelectAnime={onSelectAnime}
          onRequestDeleteEpisode={(id, ep, itemTitle) => {
            setDeleteModal({
              isOpen: true,
              title: 'Hapus Episode dari Riwayat',
              message: 'Apakah Anda yakin ingin menghapus episode ini dari riwayat tontonan?',
              itemTitle,
              onConfirm: () => onRemoveHistoryItem(id, ep),
            });
          }}
          onRequestDeleteAnime={(id, itemTitle) => {
            setDeleteModal({
              isOpen: true,
              title: 'Hapus Riwayat Anime',
              message: 'Apakah Anda yakin ingin menghapus seluruh riwayat episode untuk anime ini?',
              itemTitle,
              onConfirm: () => {
                if (onRemoveAnimeHistory) {
                  onRemoveAnimeHistory(id);
                } else {
                  history.filter((h) => String(h.animeId || h.id) === String(id)).forEach((h) => onRemoveHistoryItem(id, h.ep));
                }
              },
            });
          }}
          formatSeconds={formatSeconds}
        />
      )}

      {activeSubTab === 'favorites' && (
        <LibrarySavedTab
          type="favorites"
          items={favorites}
          onSelectAnime={onSelectAnime}
          onRemoveItem={(id) => onRemoveFavorite(id)}
          convertToAnime={convertToAnime}
        />
      )}

      {activeSubTab === 'watchlist' && (
        <LibrarySavedTab
          type="watchlist"
          items={watchlist}
          onSelectAnime={onSelectAnime}
          onRemoveItem={(id) => onRemoveWatchlist(id)}
          convertToAnime={convertToAnime}
        />
      )}

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.title}
        message={deleteModal.message}
        itemTitle={deleteModal.itemTitle}
        onConfirm={() => {
          deleteModal.onConfirm();
          setDeleteModal((prev) => ({ ...prev, isOpen: false }));
        }}
        onClose={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
