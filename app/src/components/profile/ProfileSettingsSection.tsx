import React, { useState } from 'react';
import {
  Clock,
  Heart,
  Film,
  Hourglass,
  Settings,
  Trash2,
  Edit3,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { HistoryItem, SavedItem, UserProfile } from '../../types';
import saweriaLogo from '../../assets/saweria.svg';
import kofiLogo from '../../assets/kofi_symbol.svg';

interface ProfileSettingsSectionProps {
  currentUser: UserProfile | null;
  nickname: string;
  history: HistoryItem[];
  favorites: SavedItem[];
  watchlist: SavedItem[];
  watchTimeFormatted: string;
  onSaveDisplayName: (name: string) => Promise<boolean>;
  onClearHistory: () => void;
  onResetAllData: () => void;
}

export const ProfileSettingsSection: React.FC<ProfileSettingsSectionProps> = ({
  currentUser,
  nickname,
  history,
  favorites,
  watchlist,
  watchTimeFormatted,
  onSaveDisplayName,
  onClearHistory,
  onResetAllData,
}) => {
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState<boolean>(false);

  const handleStartEditName = () => {
    setNameInput(currentUser?.name || nickname);
    setNameError(null);
    setIsEditingName(true);
  };

  const handleSubmitName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError('Nama tampilan tidak boleh kosong');
      return;
    }
    if (trimmed.length < 2) {
      setNameError('Nama minimal 2 karakter');
      return;
    }
    if (trimmed.length > 30) {
      setNameError('Nama maksimal 30 karakter');
      return;
    }

    setIsSavingName(true);
    setNameError(null);
    const ok = await onSaveDisplayName(trimmed);
    setIsSavingName(false);
    if (ok) {
      setIsEditingName(false);
    } else {
      setNameError('Gagal mengubah nama tampilan');
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Counter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-white/5 p-4 rounded-2xl text-center">
          <Clock className="w-5 h-5 mx-auto mb-2 text-white" />
          <div className="text-xl sm:text-2xl font-black text-white">{history.length}</div>
          <div className="text-[11px] text-neutral-400">Episode Ditonton</div>
        </div>
        <div className="bg-card border border-white/5 p-4 rounded-2xl text-center">
          <Heart className="w-5 h-5 mx-auto mb-2 text-white" />
          <div className="text-xl sm:text-2xl font-black text-white">{favorites.length}</div>
          <div className="text-[11px] text-neutral-400">Favorit Disimpan</div>
        </div>
        <div className="bg-card border border-white/5 p-4 rounded-2xl text-center">
          <Film className="w-5 h-5 mx-auto mb-2 text-white" />
          <div className="text-xl sm:text-2xl font-black text-white">{watchlist.length}</div>
          <div className="text-[11px] text-neutral-400">Daftar Tonton</div>
        </div>
        <div className="bg-card border border-white/5 p-4 rounded-2xl text-center">
          <Hourglass className="w-5 h-5 mx-auto mb-2 text-amber-400" />
          <div className="text-xl sm:text-2xl font-black text-white">{watchTimeFormatted}</div>
          <div className="text-[11px] text-neutral-400">Waktu Tonton</div>
        </div>
      </div>

      {/* Support & Donation Section */}
      <div className="bg-card border border-white/5 hover:border-white/20 transition-colors rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Dukung PixuPlay (Donasi Server)</h2>
              <p className="text-xs text-neutral-400">Bantu kami menjaga website tetap cepat, aktif, dan minim gangguan.</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          Web ini sepenuhnya berjalan berkat dukungan mandiri dan komunitas. Jika kamu suka dan ingin membantu kami terus berkembang, donasi kecil dari kamu akan sangat berarti untuk biaya server dan pemeliharaan web.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <a
            href="https://saweria.co/Pixuplay"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 bg-surface hover:bg-neutral-800 border border-white/5 hover:border-amber-400 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface border border-white/5 flex items-center justify-center p-1.5 flex-shrink-0 overflow-hidden">
                <img src={saweriaLogo} alt="Saweria" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-amber-300 flex items-center gap-1.5">
                  Saweria <ExternalLink className="w-3 h-3" />
                </div>
                <div className="text-[11px] text-neutral-400">QRIS, GoPay, OVO, Dana</div>
              </div>
            </div>
            <span className="text-xs font-semibold text-white bg-neutral-800 group-hover:bg-amber-400 group-hover:text-black px-2.5 py-1 rounded-lg transition-colors">
              Donasi
            </span>
          </a>

          <a
            href="https://ko-fi.com/pixuplay"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 bg-surface hover:bg-neutral-800 border border-white/5 hover:border-blue-400 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface border border-white/5 flex items-center justify-center p-1.5 flex-shrink-0 overflow-hidden">
                <img src={kofiLogo} alt="Ko-fi" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-blue-300 flex items-center gap-1.5">
                  Ko-fi <ExternalLink className="w-3 h-3" />
                </div>
                <div className="text-[11px] text-neutral-400">PayPal, Kartu Debit / Kredit</div>
              </div>
            </div>
            <span className="text-xs font-semibold text-white bg-neutral-800 group-hover:bg-blue-400 group-hover:text-black px-2.5 py-1 rounded-lg transition-colors">
              Dukung
            </span>
          </a>
        </div>
      </div>

      {/* Settings & Privacy Management */}
      <div className="bg-card border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-white/5 pb-4">
          <Settings className="w-5 h-5 text-white" />
          <h2 className="text-base font-bold text-white">Pengaturan Akun & Preferensi</h2>
        </div>

        <div className="space-y-4">
          {/* Display Name Editing */}
          <div className="py-3 border-b border-white/5 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Nama Tampilan</h3>
                  {currentUser ? (
                    <span className="px-1.5 py-0.5 bg-blue-900/60 text-blue-300 text-[10px] font-mono rounded border border-blue-700">
                      Akun Google
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] font-mono rounded border border-neutral-700">
                      Akun Tamu (Guest)
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {currentUser
                    ? 'Nama tampilan unik Anda untuk live chat nobar dan diskusi komentar. Tersimpan di database.'
                    : 'Masuk dengan akun Google untuk mengubah dan mengunci nama unik Anda.'}
                </p>
              </div>

              {!isEditingName ? (
                <div className="flex items-center gap-2">
                  <div className="bg-surface border border-white/5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-white select-all">
                    {currentUser?.name || nickname}
                  </div>
                  {currentUser ? (
                    <button
                      type="button"
                      onClick={handleStartEditName}
                      className="px-3 py-1.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Ubah</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-neutral-400" /> Terkunci
                    </span>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmitName} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setNameError(null);
                    }}
                    placeholder="Nama tampilan baru..."
                    maxLength={30}
                    autoFocus
                    className="bg-black border border-neutral-600 focus:border-white px-3 py-1.5 rounded-xl text-xs font-bold text-white placeholder-neutral-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingName}
                    className="px-3.5 py-1.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {isSavingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Simpan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setNameError(null);
                    }}
                    disabled={isSavingName}
                    className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                </form>
              )}
            </div>

            {nameError && (
              <div className="p-2.5 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span>{nameError}</span>
              </div>
            )}
          </div>

          {/* Action 1: Clear History */}
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <div>
              <h3 className="text-sm font-bold text-white">Hapus Riwayat Tontonan</h3>
              <p className="text-xs text-neutral-400">
                Menghapus seluruh riwayat episode dan progress durasi tontonan.
              </p>
            </div>
            <button
              onClick={onClearHistory}
              disabled={history.length === 0}
              className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-700 hover:border-white text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Riwayat
            </button>
          </div>

          {/* Action 2: Reset All Data */}
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <div>
              <h3 className="text-sm font-bold text-white">Reset Semua Data</h3>
              <p className="text-xs text-neutral-400">
                Mengosongkan riwayat tontonan, favorit, dan daftar tonton sekaligus.
              </p>
            </div>
            <button
              onClick={onResetAllData}
              className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-white text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset Semua
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
