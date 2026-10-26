import React, { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Anime } from '../types';
import { searchAnime } from '../api';
import { AnimeCard } from './AnimeCard';
import { useDebounce } from '../hooks/useDebounce';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAnime: (anime: Anime) => void;
  onQuickPlay: (anime: Anime) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectAnime,
  onQuickPlay,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 350);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }

    let isMounted = true;
    if (debouncedQuery.trim().length >= 2) {
      setLoading(true);
      searchAnime(debouncedQuery.trim()).then((data) => {
        if (isMounted) {
          setResults(data);
          setLoading(false);
        }
      });
    } else {
      setResults([]);
    }

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, isOpen]);

  // Handle ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md animate-fade-in">
      {/* Search Header Bar */}
      <div className="w-full max-w-5xl mx-auto px-4 py-4 flex items-center gap-3 border-b border-subtle">
        <Search className="w-5 h-5 text-muted flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ketik judul anime (contoh: One Piece, Jujutsu Kaisen, Bleach, Solo Leveling)..."
          autoFocus
          className="flex-1 bg-transparent text-white text-base md:text-lg outline-none placeholder-muted"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="p-1 text-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-md border border-subtle text-xs font-semibold text-white hover:border-white transition-colors cursor-pointer"
        >
          Tutup (ESC)
        </button>
      </div>

      {/* Search Results Area */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-white" />
            <p className="text-sm">Sedang mencari di database</p>
          </div>
        ) : query.trim().length >= 2 ? (
          results.length > 0 ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
                Ditemukan {results.length} Judul Anime
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {results.map((anime) => (
                  <AnimeCard
                    key={anime.id || anime.animeId}
                    anime={anime}
                    onSelect={(a) => {
                      onClose();
                      onSelectAnime(a);
                    }}
                    onQuickPlay={(a) => {
                      onClose();
                      onQuickPlay(a);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-muted">
              <p className="text-sm">Tidak ditemukan hasil untuk "{query}".</p>
              <p className="text-xs text-neutral-500 mt-1">Coba gunakan nama alternatif atau judul Jepang.</p>
            </div>
          )
        ) : (
          <div className="py-16 text-center text-muted">
            <p className="text-sm">Ketik minimal 2 karakter untuk memulai pencarian live.</p>
          </div>
        )}
      </div>
    </div>
  );
};
