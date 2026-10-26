import React, { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Anime } from '../types';
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
  onSelectAnime: (anime: Anime) => void;
  onQuickPlay: (anime: Anime, ep?: number) => void;
  onToggleWatchlist: (anime: Anime) => void;
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
  onSelectAnime,
  onQuickPlay,
  onToggleWatchlist,
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
                onSelect={onSelectAnime}
                onQuickPlay={(a) => onQuickPlay(a, 1)}
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
        {/* 2. Hot Anime / Anime Sedang Tren (Top 1 - 20) */}
        <AnimeRow
          title="🔥 Hot Anime"
          items={topTrending}
          showRank={true}
          onSelectAnime={onSelectAnime}
          onQuickPlay={(a) => onQuickPlay(a, 1)}
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
          onSelectAnime={onSelectAnime}
          onQuickPlay={(a) => onQuickPlay(a, 1)}
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
          onSelectAnime={onSelectAnime}
          onQuickPlay={(a) => onQuickPlay(a, 1)}
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
          onSelectAnime={onSelectAnime}
          onQuickPlay={(a) => onQuickPlay(a, 1)}
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
            onSelectAnime={onSelectAnime}
            onQuickPlay={(a) => onQuickPlay(a, 1)}
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
            onSelectAnime={onSelectAnime}
            onQuickPlay={(a) => onQuickPlay(a, 1)}
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
