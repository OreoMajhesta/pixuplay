import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Anime } from '../types';
import { AnimeCard } from './AnimeCard';

interface AnimeRowProps {
  title: string;
  items: Anime[];
  onSelectAnime: (anime: Anime) => void;
  onQuickPlay: (anime: Anime) => void;
  onSeeAll?: () => void;
  showRank?: boolean;
}

export const AnimeRow: React.FC<AnimeRowProps> = ({
  title,
  items,
  onSelectAnime,
  onQuickPlay,
  onSeeAll,
  showRank = false,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const scrollAmount = rowRef.current.clientWidth * 0.75;
      rowRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="py-4">
      <div className="flex items-center justify-between mb-3 px-4 sm:px-6 lg:px-8">
        <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight">
          {title}
        </h2>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="text-xs font-semibold text-muted hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
          >
            Lihat Semua ›
          </button>
        )}
      </div>

      {/* Row Carousel Wrap */}
      <div className="relative group/row">
        {/* Left Arrow Button */}
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 border border-subtle text-white items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-white hover:text-black shadow-xl cursor-pointer"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Scrollable Container */}
        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto px-4 sm:px-6 lg:px-8 no-scrollbar scroll-smooth"
        >
          {items.map((anime, idx) => (
            <div
              key={anime.id || anime.animeId}
              className="flex-shrink-0 w-36 sm:w-44 md:w-52"
            >
              <AnimeCard
                anime={anime}
                rank={showRank ? idx + 1 : undefined}
                onSelect={onSelectAnime}
                onQuickPlay={onQuickPlay}
              />
            </div>
          ))}
        </div>

        {/* Right Arrow Button */}
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 border border-subtle text-white items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-white hover:text-black shadow-xl cursor-pointer"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
};
