import React, { useState } from 'react';
import { Heart, Bookmark, Share2, Users, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Anime, SavedItem } from '../../types';

interface WatchMetadataProps {
  anime: Anime;
  detailedAnime: Anime;
  episode: number;
  maxEpisode: number;
  likes: number;
  hasLiked: boolean;
  onToggleLike: () => void;
  isWatchlist: boolean;
  onToggleWatchlist: (anime: Anime) => void;
  nobarRoom: any;
  onOpenNobar: () => void;
  mobileActiveTab: string;
}

export const WatchMetadata: React.FC<WatchMetadataProps> = ({
  anime,
  detailedAnime,
  episode,
  maxEpisode,
  likes,
  hasLiked,
  onToggleLike,
  isWatchlist,
  onToggleWatchlist,
  nobarRoom,
  onOpenNobar,
  mobileActiveTab,
}) => {
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState<boolean>(false);

  const title = detailedAnime.title?.userPreferred || detailedAnime.title?.romaji || detailedAnime.title?.english || (detailedAnime as any).name || 'Anime';

  const handleShare = async () => {
    try {
      const shareUrl = window.location.href;
      if (navigator.share) {
        await navigator.share({
          title: `Nonton ${title} Ep ${episode} Sub Indo - Pixuplay`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
      }
    } catch {
      // Ignore user cancellation
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Title & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">
            {title}
          </h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1 flex-wrap">
            <span className="px-2 py-0.5 bg-red-600/20 text-red-400 font-extrabold text-[11px] rounded-md border border-red-500/20">
              Episode {episode}
            </span>
            <span>•</span>
            <span>Total {maxEpisode} Episode</span>
            <span>•</span>
            <span>{anime.status === 'RELEASING' ? 'Ongoing' : 'Tamat'}</span>
          </div>
        </div>

        {/* Action Buttons: 2x2 grid on mobile, row on sm+ */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          {/* Like Button */}
          <button
            onClick={onToggleLike}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              hasLiked
                ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-950/50'
                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-white/10'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-white text-white' : ''}`} />
            <span>{likes}</span>
          </button>

          {/* Watchlist Button */}
          <button
            onClick={() => onToggleWatchlist(anime)}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              isWatchlist
                ? 'bg-white text-black border-white'
                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-white/10'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isWatchlist ? 'fill-black text-black' : ''}`} />
            <span>{isWatchlist ? 'Tersimpan' : 'Watchlist'}</span>
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all cursor-pointer border border-white/10 text-xs font-bold"
          >
            {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedShare ? 'Tersalin' : 'Bagikan'}</span>
          </button>

          {/* Nobar Watch Party Button */}
          <button
            onClick={onOpenNobar}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              nobarRoom
                ? 'bg-red-600 text-white border-red-500 shadow-lg'
                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-white/10'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{nobarRoom ? 'Live Chat' : 'Mulai Nobar'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Synopsis & Info Box */}
      <div className={`space-y-4 ${mobileActiveTab !== 'detail' ? 'hidden lg:block' : ''}`}>
        <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
            <span>Sinopsis & Informasi Anime</span>
            {detailedAnime.averageScore && (
              <span className="text-amber-400 font-mono">★ {detailedAnime.averageScore / 10} / 10</span>
            )}
          </div>

          <p
            className={`text-xs text-neutral-300 leading-relaxed ${
              !isSynopsisExpanded ? 'line-clamp-3' : ''
            }`}
          >
            {detailedAnime.description ||
              `Nonton streaming anime ${title} dengan subtitle Indonesia resmi dan terlengkap kualitas Full HD di Pixuplay.`}
          </p>

          {detailedAnime.description && detailedAnime.description.length > 180 && (
            <button
              onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)}
              className="text-[11px] font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              {isSynopsisExpanded ? (
                <>
                  Sembunyikan <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Baca Selengkapnya <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}

          {/* Genre Badges */}
          {detailedAnime.genres && detailedAnime.genres.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {detailedAnime.genres.map((g) => (
                <span
                  key={g}
                  className="px-2 py-0.5 bg-neutral-900 border border-white/5 text-[10px] text-neutral-300 rounded-md font-medium"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
