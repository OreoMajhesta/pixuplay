import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Home,
  Calendar,
  BookOpen,
  Bookmark,
  Menu,
  X,
  ShieldCheck,
  LogIn,
  Settings,
  LogOut,
  User,
} from 'lucide-react';
import logoNav from '../assets/logo_nav.svg';
import { UserProfile } from '../types';
import { getOrCreateGuestName } from '../api';

interface NavbarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSearch: () => void;
  watchlistCount?: number;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
  onGoogleLogin?: (credential: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSearch,
  watchlistCount = 0,
  currentUser = null,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Avatar state synced with localStorage or currentUser
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    if (currentUser?.avatar) return currentUser.avatar;
    try {
      return localStorage.getItem('pixuplay_avatar') || '';
    } catch {
      return '';
    }
  });

  const guestName = React.useMemo(() => getOrCreateGuestName(), []);

  useEffect(() => {
    if (currentUser?.avatar) {
      setAvatarUrl(currentUser.avatar);
    } else {
      const saved = localStorage.getItem('pixuplay_avatar');
      setAvatarUrl(saved || '');
    }
  }, [currentUser]);

  useEffect(() => {
    const handleAvatarChange = () => {
      try {
        const saved = localStorage.getItem('pixuplay_avatar');
        setAvatarUrl(saved || '');
      } catch {}
    };
    window.addEventListener('pixuplay_avatar_changed', handleAvatarChange);
    return () => window.removeEventListener('pixuplay_avatar_changed', handleAvatarChange);
  }, []);

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  // Main navigation items
  const navItems = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'jadwal', label: 'Jadwal Rilis', icon: Calendar },
    { id: 'katalog', label: 'Katalog A-Z', icon: BookOpen },
    { id: 'library', label: 'Perpustakaan', icon: Bookmark, badge: watchlistCount },
  ];

  const handleNavClick = (id: string) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-black/95 backdrop-blur-md border-b border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand Logo & Desktop Nav */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => handleNavClick('beranda')}
              className="flex items-center group text-left cursor-pointer py-1"
            >
              <img
                src={logoNav}
                alt="PIXUPLAY"
                className="h-9 sm:h-10 w-auto max-w-[150px] sm:max-w-[200px] aspect-[27/9] object-contain transition-transform group-hover:scale-105"
              />
            </button>

            {/* Desktop Nav Items */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-white text-black font-semibold shadow'
                        : 'text-muted hover:text-white hover:bg-surface'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.badge && item.badge > 0 ? (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isActive ? 'bg-black text-white' : 'bg-subtle text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right: Search, Profile Photo Avatar Popover, and Mobile Menu Trigger */}
          <div className="flex items-center gap-3">
            {/* Search Trigger */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-subtle text-muted text-sm hover:border-white hover:text-white transition-all cursor-pointer w-36 sm:w-56"
            >
              <Search className="w-4 h-4 text-muted" />
              <span className="truncate text-xs sm:text-sm">Cari anime...</span>
              <kbd className="hidden sm:inline-block ml-auto text-[10px] text-muted border border-border px-1.5 py-0.5 rounded">
                ESC
              </kbd>
            </button>

            {/* Profile Avatar with Dropdown Popover */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={`relative w-9 h-9 rounded-full overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 group ${
                  isProfileMenuOpen || activeTab === 'profil'
                    ? 'border-white ring-2 ring-white/60 scale-105 shadow-lg shadow-white/20'
                    : currentUser
                    ? 'border-blue-500 hover:border-white hover:scale-105'
                    : 'border-neutral-700 hover:border-white hover:scale-105'
                }`}
                title={
                  currentUser
                    ? `${currentUser.name} (${currentUser.email})`
                    : 'Akun Tamu • Klik untuk masuk atau pengaturan'
                }
                aria-label="Profil & Menu Pengguna"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Foto Profil"
                    className="w-full h-full object-cover group-hover:brightness-110 transition-transform group-hover:scale-110"
                    onError={() => setAvatarUrl('')}
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-neutral-400">
                    <User className="w-4 h-4" />
                  </div>
                )}
                {currentUser && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-black" />
                )}
              </button>

              {/* Profile Dropdown Popover Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2.5 w-64 bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 rounded-2xl p-3 shadow-2xl z-50 animate-scale-in">
                  {/* User / Guest Info Header */}
                  {!currentUser ? (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80 mb-2">
                      <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 border border-neutral-700 flex-shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{guestName}</div>
                        <span className="text-[10px] text-muted flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" /> Mode Tamu
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80 mb-2">
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-500/60 flex-shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-white font-bold">
                            {currentUser.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                          {currentUser.name}
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate">{currentUser.email}</div>
                      </div>
                    </div>
                  )}

                  {/* Options */}
                  <div className="space-y-1">
                    {!currentUser ? (
                      <>
                        <button
                          onClick={() => handleNavClick('profil')}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-white/5 hover:bg-white text-left hover:text-black transition-all group cursor-pointer"
                        >
                          <LogIn className="w-4 h-4 text-blue-400 group-hover:text-black transition-colors" />
                          <div className="flex-1 min-w-0">
                            <div>Masuk dengan Google</div>
                            <div className="text-[10px] font-normal text-muted group-hover:text-neutral-700">
                              Simpan & sinkron riwayat
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => handleNavClick('profil')}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors text-left cursor-pointer"
                        >
                          <Settings className="w-4 h-4 text-neutral-400" />
                          <span>Pengaturan & Profil</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleNavClick('profil')}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-800 transition-colors text-left cursor-pointer"
                        >
                          <Settings className="w-4 h-4 text-neutral-400" />
                          <div className="flex-1 min-w-0">
                            <div>Pengaturan Akun</div>
                            <div className="text-[10px] text-muted">Ganti avatar & preferensi</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            if (onLogout) onLogout();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-red-400" />
                          <span>Keluar dari Akun</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md bg-surface text-white border border-subtle hover:bg-card"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col bg-black/95 backdrop-blur-lg">
          <div className="flex items-center justify-between px-4 h-16 border-b border-subtle">
            <div className="flex items-center">
              <img
                src={logoNav}
                alt="PIXUPLAY"
                className="h-8 sm:h-9 w-auto max-w-[150px] aspect-[27/9] object-contain"
              />
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-white hover:bg-surface rounded-md"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-black font-bold'
                      : 'text-muted hover:text-white hover:bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-subtle text-white font-bold">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}

            {/* Mobile Profile & Settings Link with Avatar */}
            <div className="pt-4 mt-4 border-t border-subtle">
              <button
                onClick={() => handleNavClick('profil')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                  activeTab === 'profil'
                    ? 'bg-white text-black font-bold'
                    : 'text-muted hover:text-white hover:bg-surface'
                }`}
              >
                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Foto Profil" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-neutral-400">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  {currentUser && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-black" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate flex items-center gap-1.5">
                    {currentUser ? currentUser.name : 'Profil & Pengaturan'}
                    {currentUser && <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <div className="text-[11px] text-muted truncate">
                    {currentUser ? currentUser.email : 'Masuk Google untuk Cloud Sync'}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
