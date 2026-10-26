import React from 'react';
import { Play } from 'lucide-react';
import { Anime } from '../types';
import { getAnimeTitle, getAnimePoster } from '../api';

interface AnimeCardProps {
  anime: Anime;
  onSelect: (anime: Anime) => void;
  onQuickPlay: (anime: Anime) => void;
  rank?: number;
}

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  onSelect,
  onQuickPlay,
  rank,
}) => {
  const title = getAnimeTitle(anime);
  const poster = getAnimePoster(anime);

  // Accurate Ongoing vs Finished check
  const isOngoing = anime.status === 'RELEASING' ||
    Boolean(anime.releaseDay) ||
    Boolean(anime.latestReleaseDate) ||
    (typeof anime.status === 'string' && anime.status.toLowerCase().includes('ongoing'));

  const statusLabel = isOngoing ? 'Ongoing' : 'Tamat';
  const epBadgeText = isOngoing
    ? (anime.episodes ? `Ep ${anime.episodes}` : 'Ongoing')
    : (anime.episodes ? `${anime.episodes} Ep` : 'Full Ep');

  const genres = (anime.genres || [])
    .slice(0, 2)
    .map((g: any) => (typeof g === 'object' && g !== null ? g.title || g.genreId || 'Anime' : String(g)))
    .join(' • ') || 'Sub Indo';

  return (
    <article
      onClick={() => onSelect(anime)}
      className="group/card relative flex flex-col bg-card border border-subtle rounded-md overflow-hidden transition-all duration-200 hover:border-white hover:shadow-2xl cursor-pointer"
    >
      {/* Thumbnail Wrap */}
      <div className="relative aspect-[3/4] w-full bg-black overflow-hidden">
        <img
          src={poster}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
        />

        {/* Hover Quick Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickPlay(anime);
            }}
            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center transform scale-90 group-hover/card:scale-100 transition-transform shadow-lg cursor-pointer"
            title="Putar Sekarang"
            aria-label="Putar"
          >
            <Play className="w-5 h-5 fill-black ml-0.5" />
          </button>
        </div>

        {/* Badges on poster */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {rank !== undefined ? (
            <span className="text-[10px] font-black px-1.5 py-0.5 bg-amber-400 text-black rounded-xs shadow font-mono">
              #{rank} TOP
            </span>
          ) : (
            <span className="text-[10px] font-black px-1.5 py-0.5 bg-black/80 text-white border border-subtle rounded-xs">
              SUB INDO
            </span>
          )}
        </div>

        <div className="absolute bottom-2 right-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 border border-subtle rounded-xs ${
            isOngoing ? 'bg-black/90 text-amber-400' : 'bg-black/90 text-white'
          }`}>
            {epBadgeText}
          </span>
        </div>
      </div>

      {/* Card Info */}
      <div className="p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className={`font-bold ${isOngoing ? 'text-amber-400' : 'text-neutral-300'}`}>
            {statusLabel}
          </span>
          <span className="text-neutral-400 font-medium border border-subtle px-1 rounded text-[10px]">
            FULL HD
          </span>
        </div>

        <h3 className="text-sm font-bold text-white truncate group-hover/card:underline" title={title}>
          {title}
        </h3>

        <p className="text-[11px] text-neutral-300 truncate font-medium">
          {genres}
        </p>
      </div>
    </article>
  );
};
