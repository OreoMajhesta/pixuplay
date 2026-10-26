import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Film,
  Clock,
  Heart,
  Trash2,
  CheckCircle2,
  Camera,
  Check,
  Settings,
  Lock,
  ExternalLink,
  LogOut,
  Cloud,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Upload,
  Copy,
  Edit3,
  Zap,
  Sparkles,
  Trophy,
  Hourglass,
  RefreshCw,
} from 'lucide-react';
import { HistoryItem, SavedItem, UserProfile } from '../types';
import { getOrCreateGuestName } from '../api';
import {
  updateUserAvatar,
  updateUserDisplayName,
  fetchCurrentUserData,
  getStoredUser,
} from '../services/authService';
import saweriaLogo from '../assets/saweria.svg';
import kofiLogo from '../assets/kofi_symbol.svg';

function getLevelProgress(exp: number) {
  let level = 1;
  let expForCurrentLevel = 0;
  while (true) {
    const expNeeded = level * 150;
    if (exp < expForCurrentLevel + expNeeded) {
      const currentLevelExp = exp - expForCurrentLevel;
      const nextLevelExp = expNeeded;
      const percent = Math.min(100, Math.floor((currentLevelExp / nextLevelExp) * 100));
      return {
        level,
        exp,
        currentLevelExp,
        nextLevelExp,
        progressPercent: percent,
      };
    }
    expForCurrentLevel += expNeeded;
    level++;
  }
}

interface ProfilePageProps {
  currentUser?: UserProfile | null;
  history: HistoryItem[];
  favorites: SavedItem[];
  watchlist: SavedItem[];
  onClearHistory: () => void;
  onResetAllData: () => void;
  onGoogleLogin?: (credential: string) => Promise<void>;
  onLogout?: () => Promise<void>;
  onRefreshUser?: () => Promise<void>;
}

const GoogleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

const AVATAR_PRESETS = [
  {
    id: 'anime-1',
    name: 'Shadow Hunter',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=160&auto=format&fit=crop&q=80',
  },
  {
    id: 'anime-2',
    name: 'Cyber Spirit',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=160&auto=format&fit=crop&q=80',
  },
  {
    id: 'anime-3',
    name: 'Neon Katana',
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=160&auto=format&fit=crop&q=80',
  },
  {
    id: 'anime-4',
    name: 'Astral Mage',
    url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=160&auto=format&fit=crop&q=80',
  },
  {
    id: 'anime-5',
    name: 'Mecha Pilot',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160&auto=format&fit=crop&q=80',
  },
];

export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser: initialUser = null,
  history,
  favorites,
  watchlist,
  onClearHistory,
  onResetAllData,
  onGoogleLogin,
  onLogout,
  onRefreshUser,
}) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => initialUser || getStoredUser());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [clearedMsg, setClearedMsg] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentAvatar, setCurrentAvatar] = useState<string>(() => {
    if (currentUser?.avatar) return currentUser.avatar;
    try {
      return localStorage.getItem('pixuplay_avatar') || '';
    } catch {
      return '';
    }
  });

  const [nickname, setNickname] = useState<string>(() => {
    if (currentUser?.name) return currentUser.name;
    return getOrCreateGuestName();
  });

  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [showAvatarPicker, setShowAvatarPicker] = useState<boolean>(false);

  // Sync state if initialUser prop changes
  useEffect(() => {
    if (initialUser) {
      setCurrentUser(initialUser);
    }
  }, [initialUser]);

  // Sync avatar and name if currentUser changes
  useEffect(() => {
    if (currentUser?.avatar) {
      setCurrentAvatar(currentUser.avatar);
    } else {
      const saved = localStorage.getItem('pixuplay_avatar');
      setCurrentAvatar(saved || '');
    }
    if (currentUser?.name) {
      setNickname(currentUser.name);
    } else {
      setNickname(getOrCreateGuestName());
    }
  }, [currentUser]);

  // Fetch fresh user data from API (Level, EXP, Watch Time, Settings)
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchCurrentUserData();
      if (res && res.user) {
        setCurrentUser(res.user);
        if (res.user.avatar) setCurrentAvatar(res.user.avatar);
        if (res.user.name) setNickname(res.user.name);
      } else {
        const u = getStoredUser();
        setCurrentUser(u);
      }
      if (onRefreshUser) {
        await onRefreshUser();
      }
    } catch (e) {
      console.warn('Gagal memuat profil terbaru', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Re-fetch API data on mount and listen to real-time events without page reload
  useEffect(() => {
    handleRefresh();

    const handleAuthChange = () => {
      const u = getStoredUser();
      setCurrentUser(u);
      if (u?.avatar) setCurrentAvatar(u.avatar);
      if (u?.name) setNickname(u.name);
    };

    window.addEventListener('pixuplay_auth_changed', handleAuthChange);
    window.addEventListener('pixuplay_watch_time_updated', handleAuthChange);
    window.addEventListener('pixuplay_avatar_changed', handleAuthChange);

    return () => {
      window.removeEventListener('pixuplay_auth_changed', handleAuthChange);
      window.removeEventListener('pixuplay_watch_time_updated', handleAuthChange);
      window.removeEventListener('pixuplay_avatar_changed', handleAuthChange);
    };
  }, []);

  // Initialize Google Identity Services button with dark theme and no white bleed
  useEffect(() => {
    if (currentUser || !onGoogleLogin) return;

    const clientId =
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      '1042260047227-83if5kgps15jm4e8n6ebl5rb1iiu67sh.apps.googleusercontent.com';

    const renderGoogleButton = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response?.credential) {
                setIsLoggingIn(true);
                setLoginError(null);
                try {
                  await onGoogleLogin(response.credential);
                  setClearedMsg('Berhasil masuk dengan akun Google!');
                  setTimeout(() => setClearedMsg(null), 4000);
                } catch (err: any) {
                  setLoginError(err?.message || 'Gagal masuk dengan Google');
                } finally {
                  setIsLoggingIn(false);
                }
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          googleBtnRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            locale: 'id',
            width: 320,
          });
        } catch (e) {
          console.warn('Failed to render Google button', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          renderGoogleButton();
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [currentUser, onGoogleLogin]);

  const handleSelectAvatar = async (url: string) => {
    if (!currentUser) {
      setLoginError('Masuk dengan Google terlebih dahulu untuk mengubah foto profil.');
      return;
    }
    setCurrentAvatar(url);
    try {
      localStorage.setItem('pixuplay_avatar', url);
      window.dispatchEvent(new Event('pixuplay_avatar_changed'));
      await updateUserAvatar(url);
    } catch {}
    setClearedMsg('Foto profil berhasil diperbarui!');
    setTimeout(() => setClearedMsg(null), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser) {
      setLoginError('Masuk dengan Google terlebih dahulu untuk mengunggah foto profil.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLoginError('File harus berupa gambar (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLoginError('Ukuran file maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawUrl = event.target?.result as string;
      if (!rawUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 240;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          handleSelectAvatar(rawUrl);
          return;
        }
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        const compressed = canvas.toDataURL('image/webp', 0.85);
        handleSelectAvatar(compressed);
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    handleSelectAvatar(customUrlInput.trim());
    setCustomUrlInput('');
  };

  const handleClearHistory = () => {
    if (window.confirm('Yakin ingin menghapus seluruh riwayat tontonan?')) {
      onClearHistory();
      setClearedMsg('Riwayat tontonan berhasil dihapus!');
      setTimeout(() => setClearedMsg(null), 3000);
    }
  };

  const handleResetData = () => {
    if (window.confirm('Yakin ingin mereset seluruh data (riwayat, favorit, daftar tonton)?')) {
      onResetAllData();
      setClearedMsg('Semua data berhasil direset.');
      setTimeout(() => setClearedMsg(null), 3000);
    }
  };

  const handleLogoutClick = async () => {
    if (window.confirm('Yakin ingin keluar dari akun Google? Semua data tersinkron aman di cloud, dan perangkat ini akan kembali ke mode tamu bersih.')) {
      if (onLogout) {
        await onLogout();
        setCurrentAvatar('');
        setClearedMsg('Berhasil keluar. Sesi tamu baru telah dibuat.');
        setTimeout(() => setClearedMsg(null), 3000);
      }
    }
  };

  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState<boolean>(false);

  const handleStartEditName = () => {
    setNameInput(currentUser?.name || nickname);
    setNameError(null);
    setIsEditingName(true);
  };

  const handleSaveDisplayName = async (e: React.FormEvent) => {
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
    const res = await updateUserDisplayName(trimmed);
    setIsSavingName(false);

    if (res.success && res.user) {
      setNickname(res.user.name);
      setIsEditingName(false);
      setClearedMsg('Nama tampilan berhasil diperbarui!');
      setTimeout(() => setClearedMsg(null), 3000);
    } else {
      setNameError(res.message || 'Gagal mengubah nama tampilan');
    }
  };

  const watchSeconds =
    currentUser?.watchTimeSeconds ??
    parseInt(localStorage.getItem('pixuplay_guest_watch_seconds') || '0', 10);
  const hours = Math.floor(watchSeconds / 3600);
  const mins = Math.floor((watchSeconds % 3600) / 60);
  let watchTimeFormatted = '0 Menit';
  if (hours > 0) {
    watchTimeFormatted = `${hours}j ${mins}m`;
  } else if (mins > 0) {
    watchTimeFormatted = `${mins} Menit`;
  } else if (watchSeconds > 0) {
    watchTimeFormatted = `${watchSeconds} Detik`;
  }

  const expTotal =
    currentUser?.exp ??
    parseInt(localStorage.getItem('pixuplay_guest_exp') || '0', 10);
  const levelData = getLevelProgress(expTotal);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Profile & Settings Header Card */}
      <div className="bg-card border border-subtle rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
        {/* Profile Avatar with Edit Overlay */}
        <div className="relative group/avatar">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-surface shadow-2xl flex-shrink-0 bg-neutral-900">
            {currentUser?.avatar || currentAvatar ? (
              <img
                src={currentUser?.avatar || currentAvatar}
                alt="Foto Profil"
                className="w-full h-full object-cover"
                onError={() => setCurrentAvatar('')}
              />
            ) : (
              <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-neutral-400">
                <User className="w-9 h-9 sm:w-11 sm:h-11" />
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (!currentUser) {
                setLoginError('Masuk dengan akun Google terlebih dahulu untuk mengubah foto profil.');
                return;
              }
              setShowAvatarPicker(!showAvatarPicker);
            }}
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
                onClick={() => {
                  navigator.clipboard.writeText(`#${currentUser.tagId}`);
                  setClearedMsg(`Tag ID #${currentUser.tagId} disalin ke clipboard!`);
                  setTimeout(() => setClearedMsg(null), 2500);
                }}
                className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-white text-neutral-200 text-xs font-mono font-black rounded flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                title="Klik untuk salin Tag ID akun Anda"
              >
                <span>#{currentUser.tagId}</span>
                <Copy className="w-3 h-3 text-neutral-400" />
              </button>
            )}
            {currentUser ? (
              <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-black rounded-xs flex items-center gap-1 shadow-sm">
                <ShieldCheck className="w-3 h-3" /> GOOGLE SYNCED
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-neutral-800 text-neutral-300 text-[10px] font-black rounded-xs flex items-center gap-1 border border-neutral-700">
                <User className="w-3 h-3" /> GUEST
              </span>
            )}
          </div>
          <p className="text-xs text-muted">
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
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Perbarui data level, EXP, dan pengaturan dari server"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Menyinkron...' : 'Segarkan Profil'}</span>
          </button>

          {currentUser && (
            <button
              onClick={handleLogoutClick}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-red-500 text-neutral-300 hover:text-red-400 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          )}
        </div>
      </div>

      {/* Gamification Level & EXP Progression Card (Locked for Guests) */}
      {!currentUser ? (
        <div className="relative overflow-hidden bg-card border border-subtle/80 rounded-xl p-5 shadow-lg space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 shadow-md flex-shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">Sistem Level & EXP</span>
                  <span className="px-2 py-0.5 bg-neutral-900 text-neutral-400 text-[10px] font-bold rounded border border-neutral-700 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-neutral-400" /> Terkunci (Mode Tamu)
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-0.5 max-w-xl">
                  Masuk dengan akun Google untuk mengaktifkan sistem Level, akumulasi EXP nonton anime, dan menyimpan pencapaian kamu secara permanen.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (googleBtnRef.current) {
                  googleBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                try {
                  window.google?.accounts?.id?.prompt();
                } catch {}
              }}
              className="px-4 py-2 bg-white hover:bg-neutral-200 text-black text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 flex-shrink-0 shadow self-start sm:self-center"
            >
              <GoogleIcon className="w-3.5 h-3.5" />
              <span>Masuk untuk Buka Level</span>
            </button>
          </div>

          {/* Locked Features Preview */}
          <div className="pt-2 border-t border-subtle/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500/50" />
              <span>Nonton anime <strong>+10 EXP/menit</strong> • Rewatch episode <strong>+25 EXP bonus</strong></span>
            </div>
            <span className="text-[10px] text-neutral-500">Tersedia otomatis setelah login akun Google</span>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-subtle rounded-xl p-5 space-y-3.5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-neutral-900 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-sm shadow-md">
                Lv.{levelData.level}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">Level {levelData.level}</span>
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded border border-amber-500/30 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" /> EXP
                  </span>
                </div>
                <p className="text-[11px] text-muted">
                  {levelData.exp.toLocaleString('id-ID')} Total EXP terkumpul
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs font-mono font-bold text-white">
                {levelData.currentLevelExp} / {levelData.nextLevelExp} EXP
              </div>
              <span className="text-[10px] text-neutral-400">
                {levelData.nextLevelExp - levelData.currentLevelExp} EXP menuju Level {levelData.level + 1}
              </span>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="space-y-1">
            <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300 rounded-full transition-all duration-700 ease-out shadow-sm"
                style={{ width: `${levelData.progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-neutral-500">
              <span>Level {levelData.level}</span>
              <span className="font-semibold text-neutral-400">{levelData.progressPercent}% Selesai</span>
              <span>Level {levelData.level + 1}</span>
            </div>
          </div>

          {/* How to earn EXP hint */}
          <div className="pt-2 border-t border-subtle/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Nonton anime <strong>+10 EXP/menit</strong> • Rewatch episode <strong>+25 EXP bonus</strong></span>
            </div>
            <span className="text-[10px] text-neutral-500">Diakumulasi otomatis saat pemutar aktif</span>
          </div>
        </div>
      )}

      {clearedMsg && (
        <div className="flex items-center gap-2 p-3 bg-white text-black font-bold text-xs rounded-lg animate-fade-in shadow">
          <CheckCircle2 className="w-4 h-4" />
          <span>{clearedMsg}</span>
        </div>
      )}

      {loginError && (
        <div className="flex items-center gap-2 p-3 bg-red-950 border border-red-500/50 text-red-200 font-bold text-xs rounded-lg animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{loginError}</span>
        </div>
      )}

      {/* Google Sign-in or Synced Card */}
      {!currentUser ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-card via-card to-neutral-900 border border-white/20 rounded-xl p-6 sm:p-7 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface border border-subtle flex items-center justify-center p-2 shadow-inner">
                <GoogleIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Masuk dengan Google
                  <span className="px-1.5 py-0.5 bg-white/10 text-[10px] text-neutral-300 rounded font-normal">
                    Cloud Sync
                  </span>
                </h2>
                <p className="text-xs text-muted">
                  Sinkronkan riwayat tontonan, menit episode, dan anime favorit di semua device.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-neutral-300 pt-1">
            <div className="flex items-start gap-2 bg-surface/50 border border-subtle/50 p-3 rounded-lg">
              <Cloud className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white font-semibold">Riwayat Aman di Cloud</strong>
                <span>Tidak hilang walau ganti browser atau bersihkan cache.</span>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-surface/50 border border-subtle/50 p-3 rounded-lg">
              <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white font-semibold">Lanjut Tonton Kapan Saja</strong>
                <span>Mulai nonton di PC, lanjutkan persis di menit yang sama di HP.</span>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-surface/50 border border-subtle/50 p-3 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white font-semibold">Satu Klik & Aman</strong>
                <span>Login resmi akun Google untuk avatar asli dan izin komentar.</span>
              </div>
            </div>
          </div>

          {/* Custom Google Sign-In Button with Invisible GIS Overlay */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <div
              className="relative inline-flex items-center justify-between gap-4 px-5 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-750 hover:border-neutral-500 transition-all shadow-lg group cursor-pointer overflow-hidden min-w-[280px]"
              onClick={() => {
                if (window.google?.accounts?.id) {
                  try {
                    window.google.accounts.id.prompt();
                  } catch {}
                }
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <GoogleIcon className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                    Masuk dengan Google
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    Sinkron riwayat & avatar
                  </span>
                </div>
              </div>

              {/* Invisible Google GIS Button Overlay (catches click for native popup) */}
              <div
                ref={googleBtnRef}
                className="absolute inset-0 z-20 overflow-hidden cursor-pointer flex items-center justify-center"
                style={{
                  opacity: 0.001,
                  transform: 'scale(1.25)',
                  transformOrigin: 'center center',
                  pointerEvents: 'auto',
                }}
                title="Masuk dengan Google"
              />
            </div>

            {isLoggingIn && (
              <div className="flex items-center gap-2 text-xs text-neutral-300">
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Memproses login & sinkronisasi data...</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-emerald-500/30 rounded-xl p-5 sm:p-6 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Cloud className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Sinkronisasi Cloud Aktif
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h3>
                <p className="text-xs text-muted">
                  Terhubung sebagai <span className="text-neutral-200 font-semibold">{currentUser.email}</span>
                </p>
              </div>
            </div>
            <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
              Otomatis Tersinkron
            </span>
          </div>
          <p className="text-xs text-neutral-300">
            Setiap kamu menonton episode, menandai anime favorit, atau menyimpan daftar tonton, data langsung tersimpan secara aman di server Pixuplay.
          </p>
        </div>
      )}

      {/* Interactive Avatar Picker & File Upload Drawer (Only when logged in) */}
      {showAvatarPicker && currentUser && (
        <div className="bg-card border border-white/30 rounded-xl p-5 space-y-4 animate-scale-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="w-4 h-4" /> Ganti Foto Profil Avatar
            </h3>
            <button
              onClick={() => setShowAvatarPicker(false)}
              className="text-xs text-neutral-400 hover:text-white cursor-pointer"
            >
              Tutup
            </button>
          </div>

          {/* Option 1: File Upload */}
          <div className="p-3.5 bg-neutral-900/80 border border-subtle rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-9 h-9 rounded-lg bg-surface border border-subtle flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Unggah Foto Sendiri</div>
                <div className="text-[11px] text-muted">Mendukung format JPG, PNG, atau WebP (Maks 5MB)</div>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white text-black font-bold text-xs rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              Pilih File
            </button>
          </div>

          {/* Option 2: Presets */}
          <div>
            <div className="text-xs font-semibold text-neutral-300 mb-2">Atau Pilih Avatar Karakter:</div>
            <div className="grid grid-cols-5 gap-3 sm:gap-4">
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = (currentUser?.avatar || currentAvatar) === preset.url;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectAvatar(preset.url)}
                    className={`relative group aspect-square rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-white ring-4 ring-white/40 scale-105'
                        : 'border-neutral-700 hover:border-white hover:scale-105'
                    }`}
                    title={preset.name}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Option 3: Custom Image URL */}
          <form onSubmit={handleApplyCustomUrl} className="flex gap-2 pt-2 border-t border-subtle">
            <input
              type="url"
              placeholder="Atau tempel URL gambar custom (https://...)"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              className="flex-1 bg-surface border border-subtle px-3 py-1.5 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-white text-black font-bold text-xs rounded-lg hover:bg-neutral-200 cursor-pointer"
            >
              Terapkan
            </button>
          </form>
        </div>
      )}

      {/* Stats Counter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-subtle p-4 rounded-xl text-center">
          <Clock className="w-5 h-5 mx-auto mb-2 text-white" />
          <div className="text-xl sm:text-2xl font-black text-white">{history.length}</div>
          <div className="text-[11px] text-muted">Episode Ditonton</div>
        </div>
        <div className="bg-card border border-subtle p-4 rounded-xl text-center">
          <Heart className="w-5 h-5 mx-auto mb-2 text-white" />
          <div className="text-xl sm:text-2xl font-black text-white">{favorites.length}</div>
          <div className="text-[11px] text-muted">Favorit Disimpan</div>
        </div>
        <div className="bg-card border border-subtle p-4 rounded-xl text-center">
          <Film className="w-5 h-5 mx-auto mb-2 text-white" />
          <div className="text-xl sm:text-2xl font-black text-white">{watchlist.length}</div>
          <div className="text-[11px] text-muted">Daftar Tonton</div>
        </div>
        <div className="bg-card border border-subtle p-4 rounded-xl text-center">
          <Hourglass className="w-5 h-5 mx-auto mb-2 text-amber-400" />
          <div className="text-xl sm:text-2xl font-black text-white">{watchTimeFormatted}</div>
          <div className="text-[11px] text-muted">Waktu Tonton</div>
        </div>
      </div>

      {/* Support & Donation Section */}
      <div className="bg-card border border-subtle hover:border-white/40 transition-colors rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-subtle pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Dukung PixuPlay (Donasi Server)</h2>
              <p className="text-xs text-muted">Bantu kami menjaga website tetap cepat, aktif, dan minim gangguan.</p>
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
            className="flex items-center justify-between p-3.5 bg-surface hover:bg-neutral-800 border border-subtle hover:border-amber-400 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface border border-subtle flex items-center justify-center p-1.5 flex-shrink-0 overflow-hidden">
                <img src={saweriaLogo} alt="Saweria" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-amber-300 flex items-center gap-1.5">
                  Saweria <ExternalLink className="w-3 h-3" />
                </div>
                <div className="text-[11px] text-muted">QRIS, GoPay, OVO, Dana</div>
              </div>
            </div>
            <span className="text-xs font-semibold text-white bg-neutral-800 group-hover:bg-amber-400 group-hover:text-black px-2.5 py-1 rounded transition-colors">
              Donasi
            </span>
          </a>

          <a
            href="https://ko-fi.com/pixuplay"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 bg-surface hover:bg-neutral-800 border border-subtle hover:border-blue-400 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface border border-subtle flex items-center justify-center p-1.5 flex-shrink-0 overflow-hidden">
                <img src={kofiLogo} alt="Ko-fi" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-blue-300 flex items-center gap-1.5">
                  Ko-fi <ExternalLink className="w-3 h-3" />
                </div>
                <div className="text-[11px] text-muted">PayPal, Kartu Debit / Kredit</div>
              </div>
            </div>
            <span className="text-xs font-semibold text-white bg-neutral-800 group-hover:bg-blue-400 group-hover:text-black px-2.5 py-1 rounded transition-colors">
              Dukung
            </span>
          </a>
        </div>
      </div>

      {/* Settings & Privacy Management */}
      <div className="bg-card border border-subtle rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-subtle pb-4">
          <Settings className="w-5 h-5 text-white" />
          <h2 className="text-base font-bold text-white">Pengaturan Akun & Preferensi</h2>
        </div>

        <div className="space-y-4">
          {/* Action 0: Display Name Editing */}
          <div className="py-3 border-b border-subtle/50 space-y-2">
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
                <p className="text-xs text-muted mt-0.5">
                  {currentUser
                    ? 'Nama tampilan unik Anda untuk live chat nobar dan diskusi komentar. Tersimpan di database.'
                    : 'Masuk dengan akun Google untuk mengubah dan mengunci nama unik Anda.'}
                </p>
              </div>

              {!isEditingName ? (
                <div className="flex items-center gap-2">
                  <div className="bg-surface border border-subtle px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-white select-all">
                    {currentUser?.name || nickname}
                  </div>
                  {currentUser ? (
                    <button
                      type="button"
                      onClick={handleStartEditName}
                      className="px-3 py-1.5 bg-white text-black font-bold text-xs rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Ubah</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-neutral-400" /> Terkunci
                    </span>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSaveDisplayName} className="flex flex-wrap items-center gap-2">
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
                    className="bg-black border border-neutral-600 focus:border-white px-3 py-1.5 rounded-lg text-xs font-bold text-white placeholder-neutral-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingName}
                    className="px-3.5 py-1.5 bg-white text-black font-bold text-xs rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
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
                    className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                </form>
              )}
            </div>

            {nameError && (
              <div className="p-2.5 bg-red-950/80 border border-red-500/50 rounded-lg text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span>{nameError}</span>
              </div>
            )}
          </div>

          {/* Action 1: Clear History */}
          <div className="flex items-center justify-between py-2 border-b border-subtle/50">
            <div>
              <h3 className="text-sm font-bold text-white">Hapus Riwayat Tontonan</h3>
              <p className="text-xs text-muted">
                Menghapus seluruh riwayat episode dan progress durasi tontonan.
              </p>
            </div>
            <button
              onClick={handleClearHistory}
              disabled={history.length === 0}
              className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-700 hover:border-white text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Riwayat
            </button>
          </div>

          {/* Action 2: Reset All Data */}
          <div className="flex items-center justify-between py-2 border-b border-subtle/50">
            <div>
              <h3 className="text-sm font-bold text-white">Reset Semua Data</h3>
              <p className="text-xs text-muted">
                Mengosongkan riwayat tontonan, favorit, dan daftar tonton sekaligus.
              </p>
            </div>
            <button
              onClick={handleResetData}
              className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-white text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset Semua
            </button>
          </div>

          {/* Feature Info */}
          <div className="flex items-center justify-between py-2">
            <div>
              <h3 className="text-sm font-bold text-white">Fitur Floating Mini Player (PiP)</h3>
              <p className="text-xs text-muted">
                Tombol minimize di pemutar memungkinkan kamu menonton video di sudut layar sambil menjelajah halaman lain.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-white text-black rounded">
              Aktif
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
