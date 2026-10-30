import React, { useMemo } from 'react';
import { Film, Clock } from 'lucide-react';
import { HistoryItem } from '../../types';
import { formatWatchTime } from '../../api';

interface WatchEpisodeListProps {
  episode: number;
  maxEpisode: number;
  animeHistory?: HistoryItem[];
  onSelectEpisode: (epNum: number, resumeTime?: number) => void;
}

export const WatchEpisodeList: React.FC<WatchEpisodeListProps> = ({
  episode,
  maxEpisode,
  animeHistory = [],
  onSelectEpisode,
}) => {
  const watchedMap = useMemo(() => {
    const map = new Map<number, HistoryItem>();
    for (const item of animeHistory) {
      if (!map.has(item.ep)) {
        map.set(item.ep, item);
      }
    }
    return map;
  }, [animeHistory]);

  const latestWatched = animeHistory[0] || null;

  return (
    <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Film className="w-4 h-4 text-red-500" />
          <h3 className="text-xs sm:text-sm font-bold text-white">
            Pilih Episode (Total {maxEpisode})
          </h3>
          {latestWatched && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/15 border border-red-500/30 text-[11px] font-semibold text-red-400">
              <Clock className="w-3 h-3" />
              <span>
                Riwayat: Ep {latestWatched.ep}
                {latestWatched.currentTime && latestWatched.currentTime > 0
                  ? ` • Menit ${formatWatchTime(latestWatched.currentTime)}`
                  : ''}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <button
            disabled={episode <= 1}
            onClick={() => {
              const prevEp = Math.max(1, episode - 1);
              const saved = watchedMap.get(prevEp);
              onSelectEpisode(prevEp, saved?.currentTime);
            }}
            className="p-1 px-2.5 rounded-lg bg-black border border-white/10 hover:border-neutral-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors text-neutral-300 hover:text-white"
            title="Episode Sebelumnya"
          >
            Sebelumnya
          </button>
          <button
            disabled={episode >= maxEpisode}
            onClick={() => {
              const nextEp = Math.min(maxEpisode, episode + 1);
              const saved = watchedMap.get(nextEp);
              onSelectEpisode(nextEp, saved?.currentTime);
            }}
            className="p-1 px-2.5 rounded-lg bg-black border border-white/10 hover:border-neutral-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors text-neutral-300 hover:text-white"
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
          const watchedItem = watchedMap.get(epNum);
          const hasTime = Boolean(watchedItem?.currentTime && watchedItem.currentTime > 0);
          const percent = watchedItem
            ? watchedItem.progressPercent ??
              (watchedItem.currentTime && watchedItem.duration
                ? Math.min(100, Math.round((watchedItem.currentTime / watchedItem.duration) * 100))
                : hasTime
                ? Math.min(100, Math.round(((watchedItem.currentTime || 0) / 1440) * 100))
                : 0)
            : 0;

          return (
            <button
              key={epNum}
              onClick={() => onSelectEpisode(epNum, watchedItem?.currentTime)}
              className={`relative overflow-hidden flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center min-w-[68px] ${
                isActive
                  ? 'bg-red-600 text-white shadow-lg shadow-red-950/40 ring-2 ring-red-500 scale-105'
                  : watchedItem
                  ? 'bg-neutral-900 text-white border border-red-500/40 hover:border-red-500'
                  : 'bg-black text-neutral-300 hover:text-white border border-white/10 hover:border-neutral-600'
              }`}
              title={
                watchedItem
                  ? `Pernah ditonton${hasTime ? ` sampai menit ${formatWatchTime(watchedItem.currentTime)}` : ''}`
                  : `Tonton Episode ${epNum}`
              }
            >
              <span>Ep {epNum}</span>
              {watchedItem && (
                <span
                  className={`text-[9px] font-medium leading-tight mt-0.5 ${
                    isActive ? 'text-white/90' : 'text-red-400'
                  }`}
                >
                  {hasTime ? formatWatchTime(watchedItem.currentTime) : 'Ditonton'}
                </span>
              )}
              {watchedItem && percent > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                  <div
                    className={`h-full ${isActive ? 'bg-white' : 'bg-red-500'}`}
                    style={{ width: `${Math.max(8, percent)}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
