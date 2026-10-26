import React, { useState } from 'react';
import { X, Heart, ExternalLink } from 'lucide-react';
import saweriaLogo from '../assets/saweria.svg';
import kofiLogo from '../assets/kofi_symbol.svg';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('pixuplay_donate_modal_dismissed', 'true');
      } catch {}
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-card border border-subtle hover:border-neutral-600 rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5 animate-scale-in text-white">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-full hover:bg-surface transition-colors cursor-pointer"
          aria-label="Tutup popup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Icon */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              Hai, Selamat Datang di PixuPlay! 👋
            </h2>
            <span className="text-[11px] text-muted font-medium">Dukungan Komunitas & Donasi Server</span>
          </div>
        </div>

        {/* Description Body with User-specified Copy */}
        <div className="space-y-3 text-xs sm:text-sm text-neutral-300 leading-relaxed bg-surface/60 p-4 rounded-xl border border-subtle/60">
          <p>
            Web ini sepenuhnya berjalan berkat dukungan mandiri. Jika kamu suka dan ingin membantu kami terus berkembang, donasi kecil dari kamu akan sangat berarti untuk biaya server dan pemeliharaan web.
          </p>
        </div>

        {/* Donation Action Buttons */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Pilihan Jalur Donasi:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Saweria */}
            <a
              href="https://saweria.co/Pixuplay"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3.5 bg-surface hover:bg-neutral-800 border border-subtle hover:border-amber-400/80 rounded-xl transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-surface border border-subtle flex items-center justify-center p-1.5 flex-shrink-0 overflow-hidden">
                  <img src={saweriaLogo} alt="Saweria" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-amber-300 flex items-center gap-1">
                    Saweria <ExternalLink className="w-3 h-3" />
                  </div>
                  <div className="text-[10px] text-muted">QRIS, GoPay, OVO, Dana</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-black bg-white group-hover:bg-amber-400 px-2 py-0.5 rounded transition-colors">
                Donasi
              </span>
            </a>

            {/* Ko-fi */}
            <a
              href="https://ko-fi.com/pixuplay"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3.5 bg-surface hover:bg-neutral-800 border border-subtle hover:border-blue-400/80 rounded-xl transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-surface border border-subtle flex items-center justify-center p-1.5 flex-shrink-0 overflow-hidden">
                  <img src={kofiLogo} alt="Ko-fi" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-blue-300 flex items-center gap-1">
                    Ko-fi <ExternalLink className="w-3 h-3" />
                  </div>
                  <div className="text-[10px] text-muted">PayPal, Debit / Kredit</div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-black bg-white group-hover:bg-blue-400 px-2 py-0.5 rounded transition-colors">
                Dukung
              </span>
            </a>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-subtle">
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded bg-surface border-subtle text-white focus:ring-0 cursor-pointer"
            />
            <span>Jangan tampilkan lagi</span>
          </label>

          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-5 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer shadow"
          >
            Mulai Nonton
          </button>
        </div>
      </div>
    </div>
  );
};
