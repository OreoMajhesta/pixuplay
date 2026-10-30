import React, { useState, useRef } from 'react';
import { ArrowLeft, Search, Play, Clock, ChevronLeft, ChevronRight, X, Layers } from 'lucide-react';
import { Anime, HistoryItem } from '../types';
import { formatTitle, formatWatchTime } from '../api';
import { HeroSpotlight } from '../components/HeroSpotlight';
import { AnimeRow } from '../components/AnimeRow';
import { AnimeCard } from '../components/AnimeCard';

interface HomePageProps {
  trending: Anime[];
  ongoing: Anime[];
  completed: Anime[];
  shounen?: Anime[];
  isekai?: Anime[];
  classics?: Anime[];
  history?: HistoryItem[];
  allAnimeList?: Anime[];
  onSelectAnime: (anime: Anime) => void;
  onQuickPlay: (anime: Anime, ep?: number, resumeTime?: number) => void;
  onToggleWatchlist: (anime: Anime) => void;
  onRemoveAnimeHistory?: (id: string | number) => void;
  watchlist: Array<{ id: string | number; animeId?: string }>;
  onNavigateTab: (tab: string, filter?: { status?: string; genre?: string; sortBy?: string }) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  trending,
  ongoing,
  completed,
  shounen,
  isekai,
  classics,
  history = [],
  allAnimeList = [],
  onSelectAnime,
  onQuickPlay,
  onToggleWatchlist,
  onRemoveAnimeHistory,
  watchlist,
  onNavigateTab,
}) => {
  const [viewAllSection, setViewAllSection] = useState<{
    title: string;
    items: Anime[];
    badge?: string;
    showRank?: boolean;
    description?: string;
  } | null>(null);

  const [searchFilter, setSearchFilter] = useState('');
  const historyRowRef = useRef<HTMLDivElement>(null);

  const scrollHistoryRow = (direction: 'left' | 'right') => {
    if (historyRowRef.current) {
      const scrollAmount = historyRowRef.current.clientWidth * 0.75;
      historyRowRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Group history by Anime so each watched anime shows its latest watched episode and minute on Beranda
  const continueWatchingItems = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        title: string;
        poster: string;
        latestItem: HistoryItem;
        episodeCount: number;
        animeObj: Anime;
        progressPercent: number;
      }
    >();

    for (const item of history) {
      const key = String(item.animeId || item.id);
      if (!map.has(key)) {
        const titleStr = formatTitle(item.title);
        const matched = allAnimeList.find((a) => String(a.animeId || a.id) === key);
        const animeObj: Anime = matched
          ? {
              ...matched,
              coverImage: matched.coverImage || { extraLarge: item.poster, large: item.poster },
            }
          : {
              id: item.id,
              animeId: key,
              title: { english: titleStr, romaji: titleStr },
              coverImage: { extraLarge: item.poster, large: item.poster },
              genres: item.genres,
              description: item.description,
              episodes: item.totalEpisodes,
            };

        const dur = item.duration && item.duration > 0 ? item.duration : 1440;
        const percent =
          item.progressPercent ??
          (item.currentTime && item.currentTime > 0
            ? Math.min(100, Math.round((item.currentTime / dur) * 100))
            : 10);

        map.set(key, {
          id: key,
          title: titleStr,
          poster: item.poster,
          latestItem: item,
          episodeCount: 1,
          animeObj,
          progressPercent: percent,
        });
      } else {
        map.get(key)!.episodeCount += 1;
      }
    }

    return Array.from(map.values()).slice(0, 15);
  }, [history, allAnimeList]);

  const heroAnime = trending[0] || null;
  const isHeroWatchlisted = heroAnime
    ? watchlist.some((x) => (x.id || x.animeId) === (heroAnime.id || heroAnime.animeId))
    : false;

  // Top 1 - 20 Hot & Trending Anime (Top Blockbusters & Action Hits)
  const topTrending = trending.slice(0, 20);

  // Recently updated today (newest release entries from ongoing)
  const recentlyUpdated = ongoing.slice(0, 15);

  // Sedang Tayang (Ongoing) - Offset by 6 so it displays different ongoing series and doesn't mirror "Baru Saja Update"
  const ongoingDisplay = React.useMemo(() => {
    if (ongoing.length <= 15) return ongoing;
    return [...ongoing.slice(6), ...ongoing.slice(0, 6)];
  }, [ongoing]);

  // If "Lihat Semua" is active, render the full collection grid view
  if (viewAllSection) {
    const displayedItems = viewAllSection.items.filter((a) => {
      if (!searchFilter.trim()) return true;
      const titleStr = typeof a.title === 'string'
        ? a.title
        : a.title?.romaji || a.title?.english || a.title?.userPreferred || '';
      return titleStr.toLowerCase().includes(searchFilter.toLowerCase().trim());
    });

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
        {/* Top Header & Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-subtle pb-6">
          <div className="space-y-1.5">
            <button
              onClick={() => {
                setViewAllSection(null);
                setSearchFilter('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 text-xs font-bold text-neutral-300 hover:text-white transition-colors py-1.5 px-3 rounded-lg bg-surface hover:bg-neutral-800 border border-subtle cursor-pointer mb-1 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Beranda
            </button>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              {viewAllSection.title}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400">
              {viewAllSection.description || `Menampilkan koleksi lengkap ${viewAllSection.items.length} anime berkualitas Full HD.`}
            </p>
          </div>

          {/* Quick Search inside collection */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Cari judul di koleksi ini..."
              className="w-full pl-9 pr-3 py-2 bg-card border border-subtle focus:border-white rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Ditemukan <strong className="text-white">{displayedItems.length}</strong> anime
          </span>
          <button
            onClick={() => {
              setViewAllSection(null);
              onNavigateTab('katalog');
            }}
            className="text-amber-400 hover:underline font-semibold cursor-pointer"
          >
            Lihat Katalog A-Z Lengkap (1.900+ Judul) →
          </button>
        </div>

        {/* Anime Grid */}
        {displayedItems.length === 0 ? (
          <div className="text-center py-20 text-muted bg-card border border-subtle rounded-2xl">
            <p className="text-base font-semibold text-white">Tidak ada anime yang cocok</p>
            <p className="text-xs text-muted mt-1">Coba gunakan kata kunci pencarian yang lain.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {displayedItems.map((anime, index) => (
              <AnimeCard
                key={anime.animeId || anime.id}
                anime={anime}
                rank={viewAllSection.showRank ? index + 1 : undefined}
                history={history}
                onSelect={onSelectAnime}
                onQuickPlay={(a, ep, resumeTime) => onQuickPlay(a, ep ?? 1, resumeTime)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Hero Spotlight */}
      <HeroSpotlight
        anime={heroAnime}
        onPlay={(a) => onQuickPlay(a, 1)}
        onOpenDetail={onSelectAnime}
        onToggleWatchlist={onToggleWatchlist}
        isWatchlisted={isHeroWatchlisted}
      />

      {/* Main Anime Rows */}
      <div className="space-y-4">
        {/* 1.5 Lanjutkan Menonton (Riwayat Tontonan User di Beranda) */}
        {continueWatchingItems.length > 0 && (
          <section className="py-4">
            <div className="flex items-center justify-between mb-3 px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-500" />
                <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight">
                  Lanjutkan Menonton
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-600/20 border border-red-500/40 text-red-400">
                  {continueWatchingItems.length} Anime
                </span>
              </div>
              <button
                onClick={() => onNavigateTab('library')}
                className="text-xs font-semibold text-muted hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              >
                Lihat Semua Riwayat ›
              </button>
            </div>

            <div className="relative group/hrow">
              <button
                onClick={() => scrollHistoryRow('left')}
                className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 border border-subtle text-white items-center justify-center opacity-0 group-hover/hrow:opacity-100 transition-opacity hover:bg-white hover:text-black shadow-xl cursor-pointer"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div
                ref={historyRowRef}
                className="flex gap-4 overflow-x-auto px-4 sm:px-6 lg:px-8 no-scrollbar scroll-smooth"
              >
                {continueWatchingItems.map((group) => {
                  const latest = group.latestItem;
                  const hasTime = Boolean(latest.currentTime && latest.currentTime > 0);
                  const dur = latest.duration && latest.duration > 0 ? latest.duration : 1440;

                  return (
                    <div
                      key={group.id}
                      onClick={() => onQuickPlay(group.animeObj, latest.ep, latest.currentTime || 0)}
                      className="flex-shrink-0 w-60 sm:w-68 bg-card border border-subtle hover:border-red-500/70 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-2xl cursor-pointer group/hcard flex flex-col"
                    >
                      {/* Thumbnail with Episode & Minute Overlay */}
                      <div className="relative h-36 w-full bg-black overflow-hidden">
                        <img
                          src={group.poster}
                          alt={group.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/hcard:scale-105 filter brightness-85"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                        {/* Center Play Icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-11 h-11 rounded-full bg-red-600/95 text-white flex items-center justify-center shadow-lg transform scale-95 group-hover/hcard:scale-110 transition-transform">
                            <Play className="w-5 h-5 fill-white ml-0.5" />
                          </div>
                        </div>

                        {/* Top Left: Episode Badge */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span className="text-[10px] font-black px-2 py-0.5 bg-red-600 text-white rounded shadow">
                            EPISODE {latest.ep}
                          </span>
                        </div>

                        {/* Top Right: Remove from History */}
                        {onRemoveAnimeHistory && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveAnimeHistory(group.id);
                            }}
                            className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-neutral-400 hover:text-white hover:bg-red-600 transition-colors cursor-pointer"
                            title="Hapus dari riwayat"
                            aria-label="Hapus dari riwayat"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Bottom Left & Right: Minute Info */}
                        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-bold text-white">
                          <span className="flex items-center gap-1 bg-black/75 px-2 py-0.5 rounded border border-white/10">
                            <Clock className="w-3 h-3 text-red-400" />
                            <span>
                              {hasTime
                                ? `Menit ${formatWatchTime(latest.currentTime)} / ${formatWatchTime(dur)}`
                                : `Episode ${latest.ep}`}
                            </span>
                          </span>
                          <span className="text-[10px] text-red-400 bg-black/75 px-1.5 py-0.5 rounded">
                            {group.progressPercent}%
                          </span>
                        </div>

                        {/* Bottom Progress Bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800">
                          <div
                            className="h-full bg-red-500 transition-all"
                            style={{ width: `${Math.max(8, group.progressPercent)}%` }}
                          />
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-3 flex flex-col gap-1.5 flex-1 justify-between">
                        <div>
                          <h3
                            className="text-xs sm:text-sm font-bold text-white truncate group-hover/hcard:text-red-400 transition-colors"
                            title={group.title}
                          >
                            {group.title}
                          </h3>
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            Terakhir: <strong className="text-neutral-200">Ep {latest.ep}</strong>
                            {hasTime ? ` • Menit ${formatWatchTime(latest.currentTime)}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onQuickPlay(group.animeObj, latest.ep, latest.currentTime || 0);
                            }}
                            className="flex-1 py-1.5 px-2.5 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            <span>Lanjut Ep {latest.ep}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAnime(group.animeObj);
                            }}
                            className="py-1.5 px-2.5 bg-neutral-900 hover:bg-neutral-800 border border-subtle text-neutral-300 hover:text-white text-[11px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            title="Lihat daftar episode & detail"
                          >
                            <Layers className="w-3 h-3" />
                            <span>Episode</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => scrollHistoryRow('right')}
                className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 border border-subtle text-white items-center justify-center opacity-0 group-hover/hrow:opacity-100 transition-opacity hover:bg-white hover:text-black shadow-xl cursor-pointer"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {/* 2. Hot Anime / Anime Sedang Tren (Top 1 - 20) */}
        <AnimeRow
          title="🔥 Hot Anime"
          items={topTrending}
          showRank={true}
          history={history}
          onSelectAnime={onSelectAnime}
          onQuickPlay={(a, ep, resumeTime) => onQuickPlay(a, ep ?? 1, resumeTime)}
          onSeeAll={() => {
            setViewAllSection({
              title: '🔥 Hot Anime',
              items: topTrending,
              showRank: true,
              description: 'Daftar serial anime ongoing terpopuler diurutkan berdasarkan rating tertinggi musim ini.',
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {/* 3. Baru Saja Update Hari Ini */}
        <AnimeRow
          title="Baru Saja Update Hari Ini"
          items={recentlyUpdated}
          history={history}
          onSelectAnime={onSelectAnime}
          onQuickPlay={(a, ep, resumeTime) => onQuickPlay(a, ep ?? 1, resumeTime)}
          onSeeAll={() => {
            setViewAllSection({
              title: 'Baru Saja Update Hari Ini',
              items: ongoing,
              showRank: false,
              description: 'Daftar serial anime yang baru saja merilis episode terbarunya hari ini.',
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {/* 4. Sedang Tayang (Ongoing) */}
        <AnimeRow
          title="Sedang Tayang (Ongoing)"
          items={ongoingDisplay}
          history={history}
          onSelectAnime={onSelectAnime}
          onQuickPlay={(a, ep, resumeTime) => onQuickPlay(a, ep ?? 1, resumeTime)}
          onSeeAll={() => {
            setViewAllSection({
              title: 'Serial Anime Sedang Tayang (Ongoing)',
              items: ongoing,
              showRank: false,
              description: 'Daftar seluruh anime musim ini yang saat ini sedang dalam status penayangan aktif.',
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {/* 5. Baru Saja Tamat (Completed) */}
        <AnimeRow
          title="Baru Saja Tamat (Completed)"
          items={completed}
          history={history}
          onSelectAnime={onSelectAnime}
          onQuickPlay={(a, ep, resumeTime) => onQuickPlay(a, ep ?? 1, resumeTime)}
          onSeeAll={() => {
            setViewAllSection({
              title: 'Anime Baru Saja Tamat (Completed)',
              items: completed,
              showRank: false,
              description: 'Koleksi serial anime yang telah menyelesaikan seluruh penayangannya.',
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {/* 6. Shounen & Action */}
        {shounen && shounen.length > 0 && (
          <AnimeRow
            title="Anime Aksi & Shounen Populer"
            items={shounen}
            history={history}
            onSelectAnime={onSelectAnime}
            onQuickPlay={(a, ep, resumeTime) => onQuickPlay(a, ep ?? 1, resumeTime)}
            onSeeAll={() => {
              setViewAllSection({
                title: 'Anime Aksi & Shounen Populer',
                items: shounen,
                showRank: false,
                description: 'Koleksi anime penuh aksi pertarungan, petualangan seru, dan aksi epik.',
              });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* 7. Isekai & Fantasy */}
        {isekai && isekai.length > 0 && (
          <AnimeRow
            title="Anime Isekai & Fantasi Pilihan"
            items={isekai}
            history={history}
            onSelectAnime={onSelectAnime}
            onQuickPlay={(a, ep, resumeTime) => onQuickPlay(a, ep ?? 1, resumeTime)}
            onSeeAll={() => {
              setViewAllSection({
                title: 'Anime Isekai & Fantasi Pilihan',
                items: isekai,
                showRank: false,
                description: 'Koleksi anime reinkarnasi ke dunia lain dengan kekuatan sihir dan petualangan.',
              });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </div>
    </div>
  );
};
