import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { HistoryItem, SavedItem, UserProfile } from '../types';
import { getOrCreateGuestName } from '../api';
import {
  updateUserAvatar,
  updateUserDisplayName,
  fetchCurrentUserData,
  getStoredUser,
} from '../services/authService';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileLevelCard } from '../components/profile/ProfileLevelCard';
import { ProfileCloudSync } from '../components/profile/ProfileCloudSync';
import { ProfileAvatarModal } from '../components/profile/ProfileAvatarModal';
import { ProfileSettingsSection } from '../components/profile/ProfileSettingsSection';

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
  const [showAvatarPicker, setShowAvatarPicker] = useState<boolean>(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (initialUser) setCurrentUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    if (currentUser?.avatar) {
      setCurrentAvatar(currentUser.avatar);
    } else {
      setCurrentAvatar(localStorage.getItem('pixuplay_avatar') || '');
    }
    if (currentUser?.name) {
      setNickname(currentUser.name);
    } else {
      setNickname(getOrCreateGuestName());
    }
  }, [currentUser]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchCurrentUserData();
      if (res && res.user) {
        setCurrentUser(res.user);
        if (res.user.avatar) setCurrentAvatar(res.user.avatar);
        if (res.user.name) setNickname(res.user.name);
      } else {
        setCurrentUser(getStoredUser());
      }
      if (onRefreshUser) await onRefreshUser();
    } catch (e) {
      console.warn('Gagal memuat profil terbaru', e);
    } finally {
      setIsRefreshing(false);
    }
  };

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

  // Google Identity Services setup
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
    setShowAvatarPicker(false);
  };

  const handleSaveDisplayName = async (trimmed: string) => {
    const res = await updateUserDisplayName(trimmed);
    if (res.success && res.user) {
      setNickname(res.user.name);
      setClearedMsg('Nama tampilan berhasil diperbarui!');
      setTimeout(() => setClearedMsg(null), 3000);
      return true;
    }
    return false;
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      <ProfileHeader
        currentUser={currentUser}
        currentAvatar={currentAvatar}
        nickname={nickname}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onLogout={handleLogoutClick}
        onOpenAvatarPicker={() => {
          if (!currentUser) {
            setLoginError('Masuk dengan akun Google terlebih dahulu untuk mengubah foto profil.');
            return;
          }
          setShowAvatarPicker(!showAvatarPicker);
        }}
        onCopyTagId={(tagId) => {
          navigator.clipboard.writeText(`#${tagId}`);
          setClearedMsg(`Tag ID #${tagId} disalin ke clipboard!`);
          setTimeout(() => setClearedMsg(null), 2500);
        }}
      />

      <ProfileLevelCard
        currentUser={currentUser}
        onPromptLogin={() => {
          if (googleBtnRef.current) {
            googleBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          try {
            window.google?.accounts?.id?.prompt();
          } catch {}
        }}
      />

      {clearedMsg && (
        <div className="flex items-center gap-2 p-3 bg-white text-black font-bold text-xs rounded-xl animate-fade-in shadow">
          <CheckCircle2 className="w-4 h-4" />
          <span>{clearedMsg}</span>
        </div>
      )}

      {loginError && (
        <div className="flex items-center gap-2 p-3 bg-red-950 border border-red-500/50 text-red-200 font-bold text-xs rounded-xl animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{loginError}</span>
        </div>
      )}

      <ProfileCloudSync
        currentUser={currentUser}
        googleBtnRef={googleBtnRef}
        isLoggingIn={isLoggingIn}
      />

      <ProfileAvatarModal
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        currentUser={currentUser}
        currentAvatar={currentAvatar}
        onSelectAvatar={handleSelectAvatar}
        onError={(err) => setLoginError(err)}
      />

      <ProfileSettingsSection
        currentUser={currentUser}
        nickname={nickname}
        history={history}
        favorites={favorites}
        watchlist={watchlist}
        watchTimeFormatted={watchTimeFormatted}
        onSaveDisplayName={handleSaveDisplayName}
        onClearHistory={handleClearHistory}
        onResetAllData={handleResetData}
      />
    </div>
  );
};
