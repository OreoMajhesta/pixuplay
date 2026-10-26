import React from 'react';
import { AlertTriangle, ShieldAlert, X, Play } from 'lucide-react';
import { Anime } from '../types';
import { getAnimeTitle } from '../api';

interface ContentWarningModalProps {
  isOpen: boolean;
  anime: Anime | null;
  episodeNumber?: number;
  detectedGenres: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Helper to detect if an anime contains sensitive genres like Ecchi, Gore, etc.
 */
export function checkIsSensitiveContent(anime?: Anime | null): { isSensitive: boolean; genres: string[] } {
  if (!anime) return { isSensitive: false, genres: [] };

  const genreList = Array.isArray(anime.genres) ? anime.genres : [];
  const sensitiveKeywords = ['ecchi', 'gore', '18+', 'hentai', 'horror', 'violence', 'erotica'];
  const detected: string[] = [];

  for (const g of genreList) {
    const gStr = typeof g === 'string' ? g : (g as any)?.title || '';
    const gLower = gStr.toLowerCase().trim();
    if (sensitiveKeywords.some((keyword) => gLower.includes(keyword))) {
      detected.push(gStr);
    }
  }

  return {
    isSensitive: detected.length > 0,
    genres: detected,
  };
}

export const ContentWarningModal: React.FC<ContentWarningModalProps> = ({
  isOpen,
  anime,
  episodeNumber = 1,
  detectedGenres,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !anime) return null;

  const title = getAnimeTitle(anime);
  const isGore = detectedGenres.some((g) => g.toLowerCase().includes('gore'));
  const isEcchi = detectedGenres.some((g) => g.toLowerCase().includes('ecchi'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-md bg-neutral-950 border border-red-500/40 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-red-950/50 overflow-hidden animate-scale-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-600/20 blur-3xl rounded-full pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon Badge */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 shadow-lg shadow-red-500/10">
            <ShieldAlert className="w-9 h-9 stroke-[2]" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wider mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Peringatan Konten 18+
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
            Konten Dewasa & Sensitif
          </h2>

          {/* Detected Genre Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            {detectedGenres.map((g, idx) => (
              <span
                key={`${g}-${idx}`}
                className="px-2.5 py-0.5 text-xs font-extrabold uppercase rounded bg-red-600/30 border border-red-500/50 text-red-300"
              >
                {g}
              </span>
            ))}
          </div>

          {/* Warning Description */}
          <p className="text-sm text-neutral-300 leading-relaxed mb-6">
            Anime <span className="font-bold text-white">"{title}"</span> mengandung unsur{' '}
            {isGore && isEcchi ? (
              <span className="text-red-400 font-semibold">kekerasan grafis (Gore) dan konten sensual (Ecchi)</span>
            ) : isGore ? (
              <span className="text-red-400 font-semibold">adegan kekerasan ekstrem & grafis (Gore)</span>
            ) : (
              <span className="text-red-400 font-semibold">adegan sensual & dewasa (Ecchi)</span>
            )}
            . Konten ini ditujukan hanya untuk penonton berusia <span className="text-white font-bold">18 tahun ke atas</span>.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              onClick={onCancel}
              className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-sm transition-all cursor-pointer text-center"
            >
              Batalkan
            </button>

            <button
              onClick={onConfirm}
              className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-sm transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              Lanjut Nonton (Ep {episodeNumber})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
