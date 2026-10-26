import React from 'react';
import {
  Clock,
  Play,
  Trash2,
  ChevronDown,
  ChevronUp,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { Anime, HistoryItem } from '../../types';
import { formatTitle } from '../../api';

interface GroupedHistoryItem {
  id: string;
  title: string;
  poster: string;
  genres?: string[];
  episodes: HistoryItem[];
  animeObj: Anime;
  sortedEpisodes: HistoryItem[];
  latestItem: HistoryItem;
  progressPercent: number;
}

interface LibraryHistoryTabProps {
  history: HistoryItem[];
  groupedHistory: GroupedHistoryItem[];
  historyViewMode: 'byAnime' | 'byEpisode';
  setHistoryViewMode: (mode: 'byAnime' | 'byEpisode') => void;
  expandedAnimeId: string | null;
  setExpandedAnimeId: React.Dispatch<React.SetStateAction<string | null>>;
  onPlayEpisode: (anime: Anime, ep: number, resumeTime?: number) => void;
  onSelectAnime: (anime: Anime) => void;
  onRequestDeleteEpisode: (id: string | number, ep: number, title: string) => void;
  onRequestDeleteAnime: (id: string | number, title: string) => void;
  formatSeconds: (sec?: number) => string;
}

export const LibraryHistoryTab: React.FC<LibraryHistoryTabProps> = ({
  history,
  groupedHistory,
  historyViewMode,
  setHistoryViewMode,
  expandedAnimeId,
  setExpandedAnimeId,
  onPlayEpisode,
  onSelectAnime,
  onRequestDeleteEpisode,
  onRequestDeleteAnime,
  formatSeconds,
}) => {
  if (history.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl">
        <Clock className="w-12 h-12 mx-auto mb-3 text-neutral-600" />
        <h3 className="text-base font-bold text-white mb-1">Belum ada riwayat tontonan</h3>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto">
          Anime yang kamu tonton akan otomatis tersimpan lengkap dengan progress durasi menit tontonan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-neutral-900 border border-white/10 p-1 rounded-xl">
          <button
            onClick={() => setHistoryViewMode('byAnime')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              historyViewMode === 'byAnime'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Kelompokkan per Anime ({groupedHistory.length})</span>
          </button>
          <button
            onClick={() => setHistoryViewMode('byEpisode')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              historyViewMode === 'byEpisode'
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Semua Episode ({history.length})</span>
          </button>
        </div>
      </div>

      {/* View Mode 1: Grouped By Anime */}
      {historyViewMode === 'byAnime' && (
        <div className="space-y-4">
          {groupedHistory.map((group) => {
            const isExpanded = expandedAnimeId === group.id;
            const latest = group.latestItem;

            return (
              <div
                key={group.id}
                className="bg-card border border-white/5 hover:border-white/20 transition-all rounded-2xl overflow-hidden shadow-md"
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div
                    onClick={() => onSelectAnime(group.animeObj)}
                    className="flex items-center gap-4 cursor-pointer group/title flex-1 min-w-0"
                  >
                    <div className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-xl overflow-hidden flex-shrink-0 bg-neutral-900 border border-white/10">
                      <img
                        src={group.poster}
                        alt={group.title}
                        className="w-full h-full object-cover group-hover/title:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
                        <span className="text-[10px] font-bold text-white bg-black/60 px-1 rounded">
                          Ep {latest.ep}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover/title:text-red-400 transition-colors truncate">
                        {group.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-neutral-400">
                        <span className="text-red-400 font-bold">Terakhir: Ep {latest.ep}</span>
                        <span>•</span>
                        <span>{group.episodes.length} Episode Ditonton</span>
                        {latest.currentTime && latest.duration && (
                          <>
                            <span>•</span>
                            <span>
                              {formatSeconds(latest.currentTime)} / {formatSeconds(latest.duration)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full max-w-xs mt-3 bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-neutral-800">
                        <div
                          className="bg-red-600 h-full rounded-full transition-all"
                          style={{ width: `${group.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                    <button
                      onClick={() => onPlayEpisode(group.animeObj, latest.ep, latest.currentTime)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all shadow cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Lanjut Ep {latest.ep}</span>
                    </button>

                    <button
                      onClick={() => setExpandedAnimeId(isExpanded ? null : group.id)}
                      className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                      title={isExpanded ? 'Tutup Daftar Episode' : 'Lihat Semua Episode'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => onRequestDeleteAnime(group.id, group.title)}
                      className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-white/10 transition-colors cursor-pointer"
                      title="Hapus Seluruh Riwayat Anime Ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Accordion: All Watched Episodes */}
                {isExpanded && (
                  <div className="bg-black/40 border-t border-white/5 p-4 sm:p-5 space-y-2">
                    <h4 className="text-xs font-bold text-neutral-400 mb-2">Semua Episode yang Ditonton:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {group.sortedEpisodes.map((epItem) => (
                        <div
                          key={epItem.ep}
                          className="flex items-center justify-between p-2.5 bg-neutral-900/60 rounded-xl border border-white/5 hover:border-white/20 transition-all"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-neutral-800 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {epItem.ep}
                            </span>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white truncate block">
                                Episode {epItem.ep}
                              </span>
                              {epItem.currentTime && epItem.duration && (
                                <span className="text-[10px] text-neutral-400">
                                  {formatSeconds(epItem.currentTime)} / {formatSeconds(epItem.duration)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onPlayEpisode(group.animeObj, epItem.ep, epItem.currentTime)}
                              className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg cursor-pointer"
                              title="Tonton Episode Ini"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                onRequestDeleteEpisode(group.id, epItem.ep, `${group.title} Ep ${epItem.ep}`)
                              }
                              className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg cursor-pointer"
                              title="Hapus Episode Ini"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* View Mode 2: Flat List of All Episodes */}
      {historyViewMode === 'byEpisode' && (
        <div className="space-y-3">
          {history.map((item, idx) => {
            const titleStr = formatTitle(item.title);
            return (
              <div
                key={`${item.id || item.animeId}-${item.ep}-${idx}`}
                className="bg-card border border-white/5 hover:border-white/20 transition-all rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.poster}
                    alt={titleStr}
                    className="w-12 h-16 object-cover rounded-xl flex-shrink-0 bg-neutral-900 border border-white/10"
                  />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{titleStr}</h4>
                    <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                      <span className="text-red-400 font-bold">Episode {item.ep}</span>
                      {item.currentTime && item.duration && (
                        <>
                          <span>•</span>
                          <span>
                            {formatSeconds(item.currentTime)} / {formatSeconds(item.duration)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onPlayEpisode(item as any, item.ep, item.currentTime)}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Putar</span>
                  </button>
                  <button
                    onClick={() =>
                      onRequestDeleteEpisode(item.animeId || item.id, item.ep, `${titleStr} Ep ${item.ep}`)
                    }
                    className="p-1.5 text-neutral-400 hover:text-red-400 rounded-lg cursor-pointer"
                    title="Hapus dari Riwayat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
