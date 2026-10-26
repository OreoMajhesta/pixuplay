import React from 'react';
import { Film } from 'lucide-react';

interface WatchEpisodeListProps {
  episode: number;
  maxEpisode: number;
  onSelectEpisode: (epNum: number) => void;
}

export const WatchEpisodeList: React.FC<WatchEpisodeListProps> = ({
  episode,
  maxEpisode,
  onSelectEpisode,
}) => {
  return (
    <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-red-500" />
          <h3 className="text-xs sm:text-sm font-bold text-white">
            Pilih Episode (Total {maxEpisode})
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <button
            disabled={episode <= 1}
            onClick={() => onSelectEpisode(Math.max(1, episode - 1))}
            className="p-1 px-2.5 rounded-lg bg-black border border-white/10 hover:border-neutral-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors text-neutral-300 hover:text-white"
            title="Episode Sebelumnya"
          >
            Sebelumnya
          </button>
          <button
            disabled={episode >= maxEpisode}
            onClick={() => onSelectEpisode(Math.min(maxEpisode, episode + 1))}
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
          return (
            <button
              key={epNum}
              onClick={() => onSelectEpisode(epNum)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-red-600 text-white shadow-lg shadow-red-950/40 ring-2 ring-red-500 scale-105'
                  : 'bg-black text-neutral-300 hover:text-white border border-white/10 hover:border-neutral-600'
              }`}
            >
              Ep {epNum}
            </button>
          );
        })}
      </div>
    </div>
  );
};
