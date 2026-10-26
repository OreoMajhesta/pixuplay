import React from 'react';
import { User, Camera, Lock, ShieldCheck, Copy, RefreshCw, LogOut } from 'lucide-react';
import { UserProfile } from '../../types';

interface ProfileHeaderProps {
  currentUser: UserProfile | null;
  currentAvatar: string;
  nickname: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onOpenAvatarPicker: () => void;
  onCopyTagId: (tagId: number | string) => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  currentUser,
  currentAvatar,
  nickname,
  isRefreshing,
  onRefresh,
  onLogout,
  onOpenAvatarPicker,
  onCopyTagId,
}) => {
  return (
    <div className="bg-card border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
      {/* Profile Avatar with Edit Overlay */}
      <div className="relative group/avatar">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-surface shadow-2xl flex-shrink-0 bg-neutral-900">
          {currentUser?.avatar || currentAvatar ? (
            <img
              src={currentUser?.avatar || currentAvatar}
              alt="Foto Profil"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-neutral-400">
              <User className="w-9 h-9 sm:w-11 sm:h-11" />
            </div>
          )}
        </div>
        <button
          onClick={onOpenAvatarPicker}
          className={`absolute bottom-0 right-0 p-1.5 rounded-full shadow-lg transition-transform cursor-pointer border-2 border-black ${
            currentUser
              ? 'bg-white text-black hover:scale-110'
              : 'bg-neutral-800 text-neutral-400 hover:scale-105'
          }`}
          title={currentUser ? 'Ganti Foto Profil' : 'Masuk Google untuk ganti foto profil'}
        >
          {currentUser ? <Camera className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="text-center sm:text-left flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
          <h1 className="text-2xl font-black text-white truncate max-w-xs sm:max-w-md">
            {currentUser?.name || nickname}
          </h1>
          {currentUser && currentUser.tagId !== undefined && (
            <button
              type="button"
              onClick={() => onCopyTagId(currentUser.tagId!)}
              className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-white text-neutral-200 text-xs font-mono font-black rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
              title="Klik untuk salin Tag ID akun Anda"
            >
              <span>#{currentUser.tagId}</span>
              <Copy className="w-3 h-3 text-neutral-400" />
            </button>
          )}
          {currentUser ? (
            <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-black rounded-md flex items-center gap-1 shadow-sm">
              <ShieldCheck className="w-3 h-3" /> GOOGLE SYNCED
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] font-black rounded-md flex items-center gap-1 border border-neutral-700">
              <User className="w-3 h-3" /> GUEST
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-400">
          {currentUser?.email ? (
            <span className="text-blue-400 font-medium">{currentUser.email}</span>
          ) : (
            'Akun Lokal Pixuplay • Pengaturan & Profil Pengguna'
          )}
        </p>
        <p className="text-xs text-neutral-400 mt-2 max-w-md">
          {currentUser
            ? 'Akun kamu terhubung dengan Google. Riwayat, episode terakhir, dan daftar favorit otomatis tersinkronisasi di cloud.'
            : 'Masuk dengan Google di bawah untuk mengubah foto profil, menulis komentar anime, dan mengaktifkan sinkronisasi cloud antar perangkat.'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2 self-center sm:self-start">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          title="Perbarui data level, EXP, dan pengaturan dari server"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-red-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Menyinkron...' : 'Segarkan'}</span>
        </button>

        {currentUser && (
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-red-500 text-neutral-300 hover:text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        )}
      </div>
    </div>
  );
};
