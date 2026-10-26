import React from 'react';
import { Heart, Bookmark, Play, Trash2 } from 'lucide-react';
import { Anime, SavedItem } from '../../types';

interface LibrarySavedTabProps {
  type: 'favorites' | 'watchlist';
  items: SavedItem[];
  onSelectAnime: (anime: Anime) => void;
  onRemoveItem: (id: string | number) => void;
  convertToAnime: (item: SavedItem) => Anime;
}

export const LibrarySavedTab: React.FC<LibrarySavedTabProps> = ({
  type,
  items,
  onSelectAnime,
  onRemoveItem,
  convertToAnime,
}) => {
  const isFavorites = type === 'favorites';
  const Icon = isFavorites ? Heart : Bookmark;
  const title = isFavorites ? 'Anime Favorit' : 'Daftar Tonton';
  const emptyDesc = isFavorites
    ? 'Kamu belum menambahkan anime ke favorit. Tandai anime terbaikmu dengan ikon hati di pemutar atau detail anime!'
    : 'Daftar tonton kamu masih kosong. Simpan anime menarik untuk ditonton nanti di akhir pekan!';

  if (items.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl">
        <Icon className="w-12 h-12 mx-auto mb-3 text-neutral-600" />
        <h3 className="text-base font-bold text-white mb-1">Belum ada {title}</h3>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto">{emptyDesc}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((item) => {
        const animeObj = convertToAnime(item);
        const itemTitle = typeof item.title === 'string' ? item.title : item.title?.userPreferred || item.title?.romaji || 'Anime';

        return (
          <div
            key={item.id}
            className="group relative bg-card border border-white/5 hover:border-white/20 transition-all rounded-2xl overflow-hidden flex flex-col shadow-md"
          >
            {/* Poster with Play Overlay */}
            <div
              onClick={() => onSelectAnime(animeObj)}
              className="relative aspect-[3/4] overflow-hidden bg-neutral-900 cursor-pointer"
            >
              <img
                src={item.poster}
                alt={itemTitle}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </div>
              </div>
            </div>

            {/* Info and Remove Button */}
            <div className="p-3 flex-1 flex flex-col justify-between gap-2">
              <h4
                onClick={() => onSelectAnime(animeObj)}
                className="text-xs font-bold text-white line-clamp-2 hover:text-red-400 cursor-pointer transition-colors"
              >
                {itemTitle}
              </h4>

              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-[10px] text-neutral-400 truncate">
                  {item.episodes ? `${item.episodes} Ep` : 'Anime'}
                </span>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1 text-neutral-500 hover:text-red-400 rounded cursor-pointer transition-colors"
                  title={`Hapus dari ${title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
