import React, { useState, useEffect } from 'react';
import { Play, Info, Bookmark, Check, Star, Film, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
import { Anime } from '../types';
import { getAnimeTitle, getAnimePoster, getAnimeDetail } from '../api';
import { checkIsSensitiveContent } from './ContentWarningModal';

interface HeroSpotlightProps {
  anime?: Anime | null;
  onPlay: (anime: Anime, ep?: number) => void;
  onOpenDetail: (anime: Anime) => void;
  onToggleWatchlist: (anime: Anime) => void;
  isWatchlisted: boolean;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({
  anime,
  onPlay,
  onOpenDetail,
  onToggleWatchlist,
  isWatchlisted,
}) => {
  const [detailedAnime, setDetailedAnime] = useState<Anime | null>(null);

  // Automatically fetch detailed anime data (to get accurate genres like Psychological, Seinen, real synopsis, etc.)
  useEffect(() => {
    const animeId = anime?.id ?? anime?.animeId;
    if (!animeId) return;
    let isCancelled = false;

    // Fetch full details to enrich genres and synopsis
    getAnimeDetail(animeId)
      .then((fullData) => {
        if (!isCancelled && fullData) {
          setDetailedAnime(fullData);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [anime?.id, anime?.animeId]);

  if (!anime) {
    return (
      <div className="relative w-full h-[460px] md:h-[520px] bg-neutral-950 animate-pulse flex items-center justify-center border-b border-subtle">
        <div className="text-neutral-400 text-sm font-medium">Memuat anime pilihan...</div>
      </div>
    );
  }

  // Use detailed data if available, fallback to initial anime summary
  const currentAnime = detailedAnime || anime;
  const title = getAnimeTitle(currentAnime);
  const poster = getAnimePoster(currentAnime);
  const banner = currentAnime.bannerImage || poster;

  // Real Japanese / Native Title
  const nativeTitle = currentAnime.title?.native && currentAnime.title.native !== title
    ? currentAnime.title.native
    : null;

  // Real Synopsis
  const rawDesc = currentAnime.description || anime.description || '';
  const desc = (
    rawDesc && !rawDesc.includes('sedang dalam proses')
      ? rawDesc
      : 'Streaming episode terbaru dengan subtitle Indonesia kualitas Full HD terlengkap, server super cepat, dan fitur nonton bareng di Pixuplay.'
  ).replace(/<[^>]*>?/gm, '');

  // Real Score
  const scoreFormatted = currentAnime.averageScore
    ? (currentAnime.averageScore > 10 ? (currentAnime.averageScore / 10).toFixed(1) : currentAnime.averageScore.toFixed(1))
    : '8.8';

  // Real Clean Genres (e.g. Psychological, Seinen)
  const rawGenres = Array.isArray(currentAnime.genres) && currentAnime.genres.length > 0
    ? currentAnime.genres
    : (Array.isArray(anime.genres) ? anime.genres : []);
  
  const genresList: string[] = rawGenres.map((g: any) =>
    typeof g === 'object' && g !== null ? g.title || g.genreId : String(g)
  ).filter(Boolean);

  const displayGenres = genresList.length > 0 ? genresList : ['Anime'];

  // Check Sensitive Content (Ecchi / Gore)
  const { isSensitive, genres: sensitiveGenres } = checkIsSensitiveContent(currentAnime);

  return (
    <section className="relative w-full min-h-[480px] md:min-h-[540px] lg:min-h-[580px] flex items-center overflow-hidden border-b border-white/10 bg-black">
      {/* 1. Cinematic Background Layer with Artwork Visuals */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Right-aligned large backdrop image (Visible anime artwork, avoiding empty black void) */}
        <div
          className="absolute -right-10 md:right-0 top-0 bottom-0 w-full md:w-3/4 lg:w-2/3 bg-cover bg-center filter brightness-[0.45] contrast-105 scale-105 transition-all duration-1000"
          style={{ backgroundImage: `url('${banner}')` }}
        />
        {/* Ambient colored blur behind */}
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-30 scale-125 pointer-events-none"
          style={{ backgroundImage: `url('${banner}')` }}
        />
        {/* Smooth Left-to-Right & Bottom-to-Top Dark Gradients for Text Legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 md:via-black/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      {/* 2. Main Content Grid */}
      <div className="relative max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex items-center justify-between gap-8 lg:gap-12 z-10">
        
        {/* Left Column: Full Anime Information & Controls */}
        <div className="flex-1 max-w-2xl lg:max-w-3xl">
          
          {/* Top Badges & Tags Row */}
          <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase tracking-wider bg-white text-black rounded-md shadow-md">
              <TrendingUp className="w-3.5 h-3.5 text-black stroke-[3]" />
              TOP TREN MINGGU INI
            </span>

            <span className="px-2.5 py-1 text-xs font-bold bg-white/15 border border-white/25 text-white rounded-md backdrop-blur-md">
              SUB INDO
            </span>

            {/* 18+ Warning Badge if Ecchi or Gore */}
            {isSensitive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-black bg-red-600/30 border border-red-500/50 text-red-300 rounded-md backdrop-blur-md animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                18+ ({sensitiveGenres.join(', ')})
              </span>
            )}

            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white/10 border border-white/20 text-white rounded-md">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {scoreFormatted}
            </span>

            {currentAnime.episodes && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white/10 border border-white/20 text-white rounded-md">
                <Film className="w-3.5 h-3.5 text-white" />
                {currentAnime.episodes} Ep
              </span>
            )}

            {currentAnime.latestReleaseDate && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white/10 border border-white/20 text-white rounded-md">
                <Calendar className="w-3.5 h-3.5 text-white" />
                Update: {currentAnime.latestReleaseDate}
              </span>
            )}
          </div>

          {/* Anime Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-2 drop-shadow-xl">
            {title}
          </h1>

          {/* Japanese Native Title & Alternative Info */}
          {nativeTitle && (
            <div className="text-sm sm:text-base text-neutral-300 font-medium mb-3 tracking-wide flex items-center gap-2">
              <span className="text-neutral-300">{nativeTitle}</span>
              {currentAnime.releaseDay && (
                <>
                  <span className="text-white/30">•</span>
                  <span className="text-neutral-400 text-xs">Jadwal Rilis: {currentAnime.releaseDay}</span>
                </>
              )}
            </div>
          )}

          {/* Genre Tag Pills (e.g. Psychological, Seinen) */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4">
            {displayGenres.map((genre, idx) => (
              <span
                key={`${genre}-${idx}`}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full text-xs font-semibold backdrop-blur-md transition-colors"
              >
                {genre}
              </span>
            ))}
            <span className="px-3 py-1 bg-neutral-900 border border-neutral-700 text-neutral-300 rounded-full text-xs font-medium">
              {currentAnime.status === 'RELEASING' ? 'Sedang Tayang' : 'Tamat'}
            </span>
          </div>

          {/* Synopsis (Guaranteed Bright Off-White Color for 100% Readability) */}
          <p
            className="text-sm sm:text-base md:text-lg leading-relaxed max-w-2xl line-clamp-3 sm:line-clamp-4 mb-6 font-normal"
            style={{ color: '#E4E4E7' }}
          >
            {desc}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => onPlay(currentAnime, 1)}
              className="flex items-center gap-2 px-6 sm:px-7 py-3 bg-white text-black font-extrabold text-sm sm:text-base rounded-xl hover:bg-neutral-200 active:scale-95 transition-all shadow-xl shadow-white/15 cursor-pointer"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-black" />
              Putar Episode 1
            </button>

            <button
              onClick={() => onOpenDetail(currentAnime)}
              className="flex items-center gap-2 px-5 py-3 bg-white/10 border border-white/30 text-white font-semibold text-sm sm:text-base rounded-xl hover:bg-white/20 hover:border-white active:scale-95 transition-all cursor-pointer backdrop-blur-md"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              Detail
            </button>

            <button
              onClick={() => onToggleWatchlist(currentAnime)}
              className={`p-3 border rounded-xl transition-all cursor-pointer active:scale-95 ${
                isWatchlisted
                  ? 'bg-white text-black border-white shadow-lg'
                  : 'bg-white/10 text-white border-white/30 hover:border-white hover:bg-white/20 backdrop-blur-md'
              }`}
              title={isWatchlisted ? 'Hapus dari Watchlist' : 'Tambah ke Watchlist'}
              aria-label="Bookmark"
            >
              {isWatchlisted ? (
                <Check className="w-5 h-5 text-black stroke-[3]" />
              ) : (
                <Bookmark className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Right Column: High-Res Dedicated Poster Card in True 2:3 Aspect Ratio (Desktop) */}
        <div className="hidden md:block flex-shrink-0">
          <div
            onClick={() => onOpenDetail(currentAnime)}
            className="group relative w-60 lg:w-72 xl:w-80 aspect-[2/3] rounded-2xl overflow-hidden border border-white/25 shadow-2xl shadow-black ring-1 ring-white/15 cursor-pointer hover:border-white/60 hover:ring-white/30 transition-all duration-300"
          >
            {/* Poster Image in Exact 2:3 Aspect Ratio */}
            <img
              src={poster}
              alt={title}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
              loading="eager"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

            {/* Corner Quality Badge */}
            <div className="absolute top-3 right-3 px-2.5 py-0.5 bg-black/80 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold uppercase rounded-md tracking-wider">
              HD 720P
            </div>

            {/* Sensitive Badge on Poster if Ecchi / Gore */}
            {isSensitive && (
              <div className="absolute top-3 left-3 px-2 py-0.5 bg-red-600/90 backdrop-blur-md text-white text-[10px] font-black uppercase rounded-md tracking-wider shadow">
                18+
              </div>
            )}

            {/* Hover Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
              <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
                <Play className="w-7 h-7 fill-black ml-0.5" />
              </div>
            </div>

            {/* Bottom Card Title Banner */}
            <div className="absolute bottom-3 inset-x-3 text-center py-2 px-3 bg-black/80 backdrop-blur-md border border-white/15 rounded-xl text-xs font-bold text-white truncate shadow-lg">
              {title}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
