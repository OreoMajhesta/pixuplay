import React, { useEffect, useState, useMemo } from 'react';
import { X, Play, Heart, Bookmark, Check, Film, Info, Layers, ChevronRight, Clock, RotateCcw } from 'lucide-react';
import { Anime, HistoryItem } from '../types';
import { getAnimeDetail, getAnimeTitle, getAnimePoster, formatWatchTime, getAnimeHistoryItems } from '../api';

interface DetailModalProps {
  anime: Anime | null;
  history?: HistoryItem[];
  onClose: () => void;
  onPlayEpisode: (anime: Anime, ep: number, resumeTime?: number) => void;
  isFavorite: boolean;
  isWatchlist: boolean;
  onToggleFavorite: (anime: Anime) => void;
  onToggleWatchlist: (anime: Anime) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  anime,
  history = [],
  onClose,
  onPlayEpisode,
  isFavorite,
  isWatchlist,
  onToggleFavorite,
  onToggleWatchlist,
}) => {
  const [enrichedAnime, setEnrichedAnime] = useState<Anime | null>(anime);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'episodes' | 'synopsis'>('episodes');
  const [episodeRangeIdx, setEpisodeRangeIdx] = useState<number>(0);

  const current = enrichedAnime || anime;

  const animeHistory = useMemo(
    () => getAnimeHistoryItems(current, history),
    [current, history]
  );

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

  useEffect(() => {
    if (!anime) return;
    setEnrichedAnime(anime);
    setActiveTab('episodes');
    const matched = getAnimeHistoryItems(anime, history);
    const latestEp = matched[0]?.ep || 1;
    setEpisodeRangeIdx(Math.max(0, Math.floor((latestEp - 1) / 25)));

    // Fetch full enriched detail & episode list
    let isMounted = true;
    const fetchDetail = async () => {
      setLoading(true);
      const data = await getAnimeDetail(anime.animeId || anime.id);
      if (isMounted && data) {
        setEnrichedAnime(data);
      }
      if (isMounted) setLoading(false);
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [anime]);

  if (!anime || !current) return null;

  const title = getAnimeTitle(current);
  const poster = getAnimePoster(current);
  const banner = current.bannerImage || poster;
  const statusText = (current.status || '').toLowerCase().includes('releasing') ? 'Sedang Tayang' : 'Tamat';
  const cleanDesc = (current.description || 'Sinopsis tidak tersedia.').replace(/<[^>]*>?/gm, '');

  // Calculate episode buttons (always sorted ascending: Ep 1, Ep 2, Ep 3...)
  let episodeNumbers: number[] = [];
  if (current.episodeList && current.episodeList.length > 0) {
    const nums = current.episodeList.map((ep, idx) => {
      const num = parseInt(String(ep.title).replace(/[^0-9]/g, ''), 10);
      return isNaN(num) ? idx + 1 : num;
    });
    const unique = Array.from(new Set(nums));
    unique.sort((a, b) => a - b);
    episodeNumbers = unique;
  } else {
    const total = Math.min(Math.max(Number(current.episodes) || 12, 1), 48);
    episodeNumbers = Array.from({ length: total }, (_, i) => i + 1);
  }

  // Batching for anime with many episodes (e.g. 25+ episodes)
  const pageSize = 25;
  const totalRanges = Math.ceil(episodeNumbers.length / pageSize);
  const displayedEpisodes =
    episodeNumbers.length > 25
      ? episodeNumbers.slice(episodeRangeIdx * pageSize, (episodeRangeIdx + 1) * pageSize)
      : episodeNumbers;

  const latestHasTime = Boolean(latestWatched?.currentTime && latestWatched.currentTime > 0);
  const latestDuration = latestWatched?.duration && latestWatched.duration > 0 ? latestWatched.duration : 1440;
  const latestPercent = latestWatched
    ? latestWatched.progressPercent ??
      (latestHasTime ? Math.min(100, Math.round(((latestWatched.currentTime || 0) / latestDuration) * 100)) : 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-3xl max-h-[92vh] bg-[#121212] border border-neutral-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/75 border border-neutral-700 text-white hover:bg-white hover:text-black transition-colors cursor-pointer shadow-lg"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Scroll Content with visible custom scrollbar */}
        <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600 scrollbar-track-transparent">
          {/* Banner Hero Header */}
          <div className="relative h-56 sm:h-64 w-full bg-black overflow-hidden">
            <img
              src={banner}
              alt={title}
              className="w-full h-full object-cover filter brightness-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent" />

            {/* Header Content Info */}
            <div className="absolute bottom-4 left-4 right-4 flex gap-4 items-end">
              <img
                src={poster}
                alt={title}
                className="w-20 sm:w-26 aspect-[3/4] object-cover rounded-xl border border-neutral-700 shadow-2xl hidden sm:block flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-red-600 text-white rounded">
                    SUB INDO
                  </span>
                  <span className="text-xs text-neutral-300 font-medium">
                    • {statusText}
                  </span>
                  <span className="text-xs text-neutral-300 font-medium">
                    • Total {episodeNumbers.length} Episode
                  </span>
                  {current.averageScore && (
                    <span className="text-xs text-amber-400 font-bold">
                      ★ {(current.averageScore / 10).toFixed(1)}
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white truncate">
                  {title}
                </h2>
                {current.title?.native && (
                  <p className="text-xs text-neutral-400 truncate font-medium">
                    {current.title.native}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 space-y-5">
            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {latestWatched ? (
                <>
                  <button
                    onClick={() => onPlayEpisode(current, latestWatched.ep, latestWatched.currentTime || 0)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white font-extrabold text-xs sm:text-sm rounded-xl hover:bg-red-500 transition-all shadow-lg shadow-red-950/50 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>
                      Lanjut Ep {latestWatched.ep}
                      {latestHasTime ? ` (${formatWatchTime(latestWatched.currentTime)})` : ''}
                    </span>
                  </button>
                  {(latestWatched.ep > 1 || (latestWatched.currentTime || 0) > 10) && (
                    <button
                      onClick={() => onPlayEpisode(current, 1, 0)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white text-black font-bold text-xs sm:text-sm rounded-xl hover:bg-neutral-200 transition-all shadow cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Mulai Ep 1</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => onPlayEpisode(current, 1, 0)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-extrabold text-xs sm:text-sm rounded-xl hover:bg-neutral-200 transition-all shadow-lg hover:shadow-xl cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Putar Episode 1</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('episodes')}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'episodes'
                    ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/40'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Pilih Episode ({episodeNumbers.length})</span>
              </button>

              <button
                onClick={() => onToggleFavorite(current)}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  isFavorite
                    ? 'bg-white text-black border-white'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-black' : ''}`} />
                <span>{isFavorite ? 'Favorit' : 'Tambah Favorit'}</span>
              </button>

              <button
                onClick={() => onToggleWatchlist(current)}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  isWatchlist
                    ? 'bg-white text-black border-white'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500'
                }`}
              >
                {isWatchlist ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                <span>{isWatchlist ? 'Di Watchlist' : 'Tambah Watchlist'}</span>
              </button>
            </div>

            {/* Navigation Tabs (Episode vs Sinopsis) */}
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-1">
              <button
                onClick={() => setActiveTab('episodes')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'episodes'
                    ? 'border-red-500 text-white shadow-sm'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Film className="w-4 h-4 text-red-500" />
                <span>Daftar Episode ({episodeNumbers.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('synopsis')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'synopsis'
                    ? 'border-red-500 text-white shadow-sm'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Info className="w-4 h-4 text-neutral-400" />
                <span>Sinopsis & Detail</span>
              </button>
            </div>

            {/* TAB 1: Episode Selector Grid (DEFAULT & HIGHLY VISIBLE) */}
            {activeTab === 'episodes' && (
              <div className="space-y-4 animate-fade-in">
                {/* Watch History Progress Banner inside DetailModal */}
                {latestWatched && (
                  <div className="bg-gradient-to-r from-red-950/40 via-neutral-900/90 to-neutral-900/80 border border-red-500/40 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-lg">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black uppercase tracking-wider">
                          <Clock className="w-3 h-3" />
                          Riwayat Tontonan Kamu
                        </span>
                        <span className="text-[11px] text-neutral-300 font-semibold">
                          • {watchedMap.size} dari {episodeNumbers.length} Episode Ditonton
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                        <span className="font-black text-white">
                          Terakhir: Episode {latestWatched.ep}
                        </span>
                        <span className="text-neutral-400">•</span>
                        <span className="font-bold text-red-400">
                          {latestHasTime
                            ? `Menit ${formatWatchTime(latestWatched.currentTime)} / ${formatWatchTime(latestDuration)} (${latestPercent}%)`
                            : 'Sudah dibuka / ditonton'}
                        </span>
                        {latestWatched.watchedAt && (
                          <>
                            <span className="text-neutral-500 hidden sm:inline">•</span>
                            <span className="text-[11px] text-neutral-400 hidden sm:inline">
                              {latestWatched.watchedAt}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full max-w-md bg-black/70 rounded-full h-1.5 overflow-hidden border border-white/10">
                        <div
                          className="bg-red-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.max(6, latestPercent || 10)}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => onPlayEpisode(current, latestWatched.ep, latestWatched.currentTime || 0)}
                      className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>
                        Lanjut Ep {latestWatched.ep}
                        {latestHasTime ? ` • ${formatWatchTime(latestWatched.currentTime)}` : ''}
                      </span>
                    </button>
                  </div>
                )}

                {/* 2-Line Synopsis Teaser with Quick Link */}
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3.5 flex items-start justify-between gap-3 text-xs text-neutral-300">
                  <p className="line-clamp-2 leading-relaxed flex-1">
                    {cleanDesc}
                  </p>
                  <button
                    onClick={() => setActiveTab('synopsis')}
                    className="flex-shrink-0 text-red-400 hover:text-red-300 font-bold flex items-center gap-0.5 cursor-pointer text-xs transition-colors"
                  >
                    <span>Sinopsis Lengkap</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Batch Range Tabs if anime has > 25 episodes */}
                {totalRanges > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    <span className="text-xs font-bold text-neutral-400 mr-1 flex-shrink-0">Pilih Batch:</span>
                    {Array.from({ length: totalRanges }, (_, idx) => {
                      const start = idx * pageSize + 1;
                      const end = Math.min((idx + 1) * pageSize, episodeNumbers.length);
                      return (
                        <button
                          key={idx}
                          onClick={() => setEpisodeRangeIdx(idx)}
                          className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            episodeRangeIdx === idx
                              ? 'bg-red-600 text-white shadow-md'
                              : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white'
                          }`}
                        >
                          {start} - {end}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Episode Picker Grid */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
                    <span>Klik nomor episode untuk langsung menonton:</span>
                    {loading && <span className="animate-pulse text-red-400">Sinkronisasi episode...</span>}
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                    {displayedEpisodes.map((ep) => {
                      const watchedItem = watchedMap.get(ep);
                      const isLatest = latestWatched?.ep === ep;
                      const hasTime = Boolean(watchedItem?.currentTime && watchedItem.currentTime > 0);
                      const dur = watchedItem?.duration && watchedItem.duration > 0 ? watchedItem.duration : 1440;
                      const epPercent = watchedItem
                        ? watchedItem.progressPercent ??
                          (hasTime ? Math.min(100, Math.round(((watchedItem.currentTime || 0) / dur) * 100)) : 10)
                        : 0;

                      return (
                        <button
                          key={ep}
                          onClick={() => onPlayEpisode(current, ep, watchedItem?.currentTime || 0)}
                          className={`relative overflow-hidden py-2.5 px-2 border text-xs font-bold rounded-xl transition-all text-center cursor-pointer shadow-sm hover:shadow-md hover:scale-105 flex flex-col items-center justify-center ${
                            isLatest
                              ? 'bg-red-950/60 hover:bg-red-600 border-red-500 text-white ring-1 ring-red-500/60'
                              : watchedItem
                              ? 'bg-neutral-900 hover:bg-red-600 border-red-500/40 hover:border-red-500 text-white'
                              : 'bg-neutral-900/90 hover:bg-red-600 hover:text-white border-neutral-800 hover:border-red-500 text-white'
                          }`}
                          title={
                            watchedItem
                              ? `Episode ${ep} • Ditonton${hasTime ? ` sampai menit ${formatWatchTime(watchedItem.currentTime)}` : ''}`
                              : `Putar Episode ${ep}`
                          }
                        >
                          {isLatest && (
                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 bg-red-600 text-white rounded-full mb-0.5">
                              Terakhir
                            </span>
                          )}
                          <span>Ep {ep}</span>
                          {watchedItem && (
                            <span className="text-[10px] font-semibold text-red-400 group-hover:text-white leading-tight mt-0.5">
                              {hasTime ? formatWatchTime(watchedItem.currentTime) : 'Ditonton'}
                            </span>
                          )}
                          {watchedItem && epPercent > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                              <div
                                className="h-full bg-red-500"
                                style={{ width: `${Math.max(10, epPercent)}%` }}
                              />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Full Synopsis & Details */}
            {activeTab === 'synopsis' && (
              <div className="space-y-5 animate-fade-in">
                {/* Full Uncut Synopsis */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Sinopsis Lengkap
                  </h3>
                  <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-line">
                    {cleanDesc}
                  </p>
                </div>

                {/* Genres */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Genre
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(current.genres || ['Action', 'Fantasy']).map((g: any, idx: number) => {
                      const genreName = typeof g === 'object' && g !== null ? (g.title || g.genreId || 'Genre') : String(g);
                      return (
                        <span
                          key={`${genreName}-${idx}`}
                          className="text-xs px-2.5 py-1 bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-lg font-medium"
                        >
                          {genreName}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Anime Metadata Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-neutral-400">Status</span>
                    <p className="text-xs font-bold text-white">{statusText}</p>
                  </div>
                  <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-neutral-400">Total Episode</span>
                    <p className="text-xs font-bold text-white">{episodeNumbers.length} Episode</p>
                  </div>
                  {current.averageScore && (
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                      <span className="text-[10px] uppercase font-bold text-neutral-400">Rating</span>
                      <p className="text-xs font-bold text-amber-400">★ {(current.averageScore / 10).toFixed(1)} / 10</p>
                    </div>
                  )}
                  {current.releaseDay && (
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
                      <span className="text-[10px] uppercase font-bold text-neutral-400">Jadwal Rilis</span>
                      <p className="text-xs font-bold text-white">{current.releaseDay}</p>
                    </div>
                  )}
                </div>

                {/* Switch back to Episodes CTA */}
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('episodes')}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-red-950/40"
                  >
                    <Film className="w-4 h-4 text-white" />
                    <span>Buka Daftar Episode ({episodeNumbers.length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
