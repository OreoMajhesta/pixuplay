import React, { useRef } from 'react';
import { Cloud, Clock, ShieldCheck, Loader2 } from 'lucide-react';
import { UserProfile } from '../../types';

export const GoogleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
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

interface ProfileCloudSyncProps {
  currentUser: UserProfile | null;
  googleBtnRef: React.RefObject<HTMLDivElement | null>;
  isLoggingIn: boolean;
}

export const ProfileCloudSync: React.FC<ProfileCloudSyncProps> = ({
  currentUser,
  googleBtnRef,
  isLoggingIn,
}) => {
  if (!currentUser) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-br from-card via-card to-neutral-900 border border-white/20 rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center p-2 shadow-inner">
              <GoogleIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Masuk dengan Google
                <span className="px-1.5 py-0.5 bg-white/10 text-[10px] text-neutral-300 rounded font-normal">
                  Cloud Sync
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Sinkronkan riwayat tontonan, menit episode, dan anime favorit di semua device.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-neutral-300 pt-1">
          <div className="flex items-start gap-2 bg-surface/50 border border-white/5 p-3 rounded-xl">
            <Cloud className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-white font-semibold">Riwayat Aman di Cloud</strong>
              <span>Tidak hilang walau ganti browser atau bersihkan cache.</span>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-surface/50 border border-white/5 p-3 rounded-xl">
            <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-white font-semibold">Lanjut Tonton Kapan Saja</strong>
              <span>Mulai nonton di PC, lanjutkan persis di menit yang sama di HP.</span>
            </div>
          </div>
          <div className="flex items-start gap-2 bg-surface/50 border border-white/5 p-3 rounded-xl">
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
            className="relative inline-flex items-center justify-between gap-4 px-5 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-700 hover:border-neutral-500 transition-all shadow-lg group cursor-pointer overflow-hidden min-w-[280px]"
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

            {/* Invisible Google GIS Button Overlay */}
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
    );
  }

  return (
    <div className="bg-card border border-emerald-500/30 rounded-2xl p-5 sm:p-6 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Sinkronisasi Cloud Aktif
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <p className="text-xs text-neutral-400">
              Terhubung sebagai <span className="text-neutral-200 font-semibold">{currentUser.email}</span>
            </p>
          </div>
        </div>
        <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
          Otomatis Tersinkron
        </span>
      </div>
      <p className="text-xs text-neutral-300">
        Setiap kamu menonton episode, menandai anime favorit, atau menyimpan daftar tonton, data langsung tersimpan secara aman di server Pixuplay.
      </p>
    </div>
  );
};
