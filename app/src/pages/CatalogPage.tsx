import React, { useState, useMemo, useEffect } from 'react';
import { Film, Filter, Search, Sparkles, Loader2 } from 'lucide-react';
import { Anime } from '../types';
import { AnimeCard } from '../components/AnimeCard';
import { getAnimeTitle, getAnimeByGenre } from '../api';
import { useDebounce } from '../hooks/useDebounce';

interface CatalogPageProps {
  animeList: Anime[];
  onSelectAnime: (anime: Anime) => void;
  onQuickPlay: (anime: Anime, ep?: number) => void;
  initialStatus?: string;
  initialGenre?: string;
  initialSortBy?: string;
}

const GENRE_MAP: Record<string, string> = {
  'Action': 'action',
  'Adventure': 'adventure',
  'Comedy': 'comedy',
  'Drama': 'drama',
  'Fantasy': 'fantasy',
  'Isekai': 'isekai',
  'Romance': 'romance',
  'Sci-Fi': 'sci-fi',
  'Shounen': 'shounen',
  'Supernatural': 'supernatural',
  'Mystery': 'mystery',
  'Slice of Life': 'slice-of-life',
  'Sports': 'sports',
  'Horror': 'horror',
};

const GENRES = [
  'Semua Genre',
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Isekai',
  'Romance',
  'Sci-Fi',
  'Shounen',
  'Supernatural',
  'Mystery',
  'Slice of Life',
  'Sports',
  'Horror',
];

const STATUS_FILTERS = [
  { label: 'Semua Status', value: 'all' },
  { label: 'Sedang Tayang (Ongoing)', value: 'ongoing' },
  { label: 'Sudah Tamat (Completed)', value: 'completed' },
];

const SORT_OPTIONS = [
  { label: 'Paling Populer', value: 'popular' },
  { label: 'Skor Tertinggi', value: 'score' },
  { label: 'Judul (A - Z)', value: 'az' },
];

export const CatalogPage: React.FC<CatalogPageProps> = ({
  animeList,
  onSelectAnime,
  onQuickPlay,
  initialStatus = 'all',
  initialGenre = 'Semua Genre',
  initialSortBy = 'popular',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedGenre, setSelectedGenre] = useState(initialGenre);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [sortBy, setSortBy] = useState(initialSortBy);

  useEffect(() => {
    if (initialStatus) setSelectedStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (initialGenre) setSelectedGenre(initialGenre);
  }, [initialGenre]);

  useEffect(() => {
    if (initialSortBy) setSortBy(initialSortBy);
  }, [initialSortBy]);

  // Cache anime per genre (each contains 60 anime)
  const [genreAnimeCache, setGenreAnimeCache] = useState<Record<string, Anime[]>>({});
  const [loadingGenre, setLoadingGenre] = useState<boolean>(false);

  // Fetch 60 anime dynamically when a genre is selected
  useEffect(() => {
    if (selectedGenre === 'Semua Genre') return;
    const genreId = GENRE_MAP[selectedGenre];
    if (!genreId) return;

    if (genreAnimeCache[selectedGenre]) return; // Use cached data

    let isMounted = true;
    setLoadingGenre(true);

    getAnimeByGenre(genreId)
      .then((data) => {
        if (!isMounted) return;
        setGenreAnimeCache((prev) => ({ ...prev, [selectedGenre]: data }));
        setLoadingGenre(false);
      })
      .catch((err) => {
        console.error('Error fetching genre anime:', err);
        if (isMounted) setLoadingGenre(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedGenre, genreAnimeCache]);

  // Determine active base anime list
  const activeList = useMemo(() => {
    if (selectedGenre === 'Semua Genre') {
      return animeList;
    }
    return genreAnimeCache[selectedGenre] || [];
  }, [selectedGenre, animeList, genreAnimeCache]);

  const filteredAnime = useMemo(() => {
    let result = [...activeList];

    // Search query filter
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter((a) => {
        const title = getAnimeTitle(a).toLowerCase();
        return title.includes(q);
      });
    }

    // Status filter
    if (selectedStatus === 'ongoing') {
      result = result.filter((a) =>
        (a.status || '').toLowerCase().includes('releasing') ||
        (a.status || '').toLowerCase().includes('ongoing')
      );
    } else if (selectedStatus === 'completed') {
      result = result.filter((a) =>
        (a.status || '').toLowerCase().includes('finished') ||
        (a.status || '').toLowerCase().includes('completed')
      );
    }

    // Sort
    if (sortBy === 'score') {
      result.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
    } else if (sortBy === 'az') {
      result.sort((a, b) => getAnimeTitle(a).localeCompare(getAnimeTitle(b)));
    }

    return result;
  }, [activeList, debouncedSearchQuery, selectedStatus, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Catalog Header */}
      <div className="border-b border-subtle pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-white mb-2">
            <Film className="w-6 h-6" />
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Katalog Anime Lengkap</h1>
          </div>
          <p className="text-sm text-muted">
            Jelajahi koleksi 60+ serial anime per genre subtitle Indonesia resmi berdasarkan status tayang dan genre favoritmu.
          </p>
        </div>

        {/* Live Filter Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul di katalog..."
            className="w-full pl-10 pr-4 py-2 bg-card border border-subtle focus:border-white rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Dropdown */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-card border border-subtle rounded-md px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-white cursor-pointer"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Sort Dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-card border border-subtle rounded-md px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-white cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <span className="text-xs text-muted ml-auto font-medium flex items-center gap-1.5">
          {loadingGenre ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              <span>Memuat 60 anime {selectedGenre}...</span>
            </>
          ) : (
            <>
              Ditemukan <strong className="text-white">{filteredAnime.length}</strong> anime
              {selectedGenre !== 'Semua Genre' && (
                <span className="text-[11px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded">
                  60 Judul Genre {selectedGenre}
                </span>
              )}
            </>
          )}
        </span>
      </div>

      {/* Genre Pills (Sub-tab Genre) */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
          Pilihan Genre (Minimal 60 Anime Per Genre):
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
          {GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => {
                setSelectedGenre(genre);
                setSelectedStatus('all');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-all cursor-pointer ${
                selectedGenre === genre
                  ? 'bg-white text-black shadow-md'
                  : 'bg-card text-neutral-300 hover:text-white hover:bg-neutral-800 border border-subtle'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Anime Grid with Skeleton Loader */}
      {loadingGenre ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="aspect-[3/4] bg-surface rounded-xl border border-subtle"></div>
              <div className="h-4 bg-surface rounded w-3/4"></div>
              <div className="h-3 bg-surface rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredAnime.length === 0 ? (
        <div className="text-center py-20 text-muted bg-card border border-subtle rounded-2xl">
          <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-semibold text-white">Tidak ada anime yang cocok</p>
          <p className="text-xs text-muted mt-1">Coba ganti kata kunci atau reset filter genre.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {filteredAnime.map((anime) => (
            <AnimeCard
              key={anime.animeId || anime.id}
              anime={anime}
              onSelect={onSelectAnime}
              onQuickPlay={(a) => onQuickPlay(a, 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
