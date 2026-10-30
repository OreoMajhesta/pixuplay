import React from 'react';
import { Play, Clock } from 'lucide-react';
import { Anime, HistoryItem } from '../types';
import { getAnimeTitle, getAnimePoster, formatWatchTime, getAnimeHistoryItems } from '../api';

interface AnimeCardProps {
  anime: Anime;
  onSelect: (anime: Anime) => void;
  onQuickPlay: (anime: Anime, ep?: number, resumeTime?: number) => void;
  rank?: number;
  history?: HistoryItem[];
  historyItem?: HistoryItem | null;
}

export const AnimeCard = React.memo<AnimeCardProps>(({
  anime,
  onSelect,
  onQuickPlay,
  rank,
  history,
  historyItem,
}) => {
  const title = getAnimeTitle(anime);
  const poster = getAnimePoster(anime);

  const latestHistory = React.useMemo(() => {
    if (historyItem) return historyItem;
    if (!history || history.length === 0) return null;
    const matched = getAnimeHistoryItems(anime, history);
    return matched[0] || null;
  }, [anime, history, historyItem]);

  const hasWatchedTime = Boolean(latestHistory?.currentTime && latestHistory.currentTime > 0);
  const watchDuration = latestHistory?.duration && latestHistory.duration > 0 ? latestHistory.duration : 1440;
  const watchPercent = latestHistory
    ? latestHistory.progressPercent ??
      (hasWatchedTime ? Math.min(100, Math.round(((latestHistory.currentTime || 0) / watchDuration) * 100)) : 10)
    : 0;

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
          width="240"
          height="320"
          className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
        />

        {/* Hover Quick Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (latestHistory) {
                onQuickPlay(anime, latestHistory.ep, latestHistory.currentTime || 0);
              } else {
                onQuickPlay(anime, 1, 0);
              }
            }}
            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center transform scale-90 group-hover/card:scale-100 transition-transform shadow-lg cursor-pointer"
            title={
              latestHistory
                ? `Lanjut Episode ${latestHistory.ep}${hasWatchedTime ? ` (${formatWatchTime(latestHistory.currentTime)})` : ''}`
                : 'Putar Sekarang'
            }
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

        {latestHistory && (
          <div className="absolute bottom-2.5 left-2 max-w-[65%]">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-red-600/95 text-white rounded-xs shadow truncate">
              <Clock className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">
                Ep {latestHistory.ep}
                {hasWatchedTime ? ` • ${formatWatchTime(latestHistory.currentTime)}` : ''}
              </span>
            </span>
          </div>
        )}

        <div className="absolute bottom-2.5 right-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 border border-subtle rounded-xs ${
            isOngoing ? 'bg-black/90 text-amber-400' : 'bg-black/90 text-white'
          }`}>
            {epBadgeText}
          </span>
        </div>

        {/* Watch Progress Bar at bottom of poster */}
        {latestHistory && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/80">
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${Math.max(8, watchPercent)}%` }}
            />
          </div>
        )}
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
          {latestHistory
            ? `Terakhir: Ep ${latestHistory.ep}${hasWatchedTime ? ` • Menit ${formatWatchTime(latestHistory.currentTime)}` : ''}`
            : genres}
        </p>
      </div>
    </article>
  );
});

AnimeCard.displayName = 'AnimeCard';
