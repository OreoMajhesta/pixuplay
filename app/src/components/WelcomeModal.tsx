import React, { useEffect, useRef } from 'react';
import {
  Cloud,
  ShieldCheck,
  MessageSquare,
  Trophy,
  X,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import logoNav from '../assets/logo_nav.svg';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGuest: () => void;
  onGoogleLoginSuccess?: (credential: string) => Promise<void>;
}

const GoogleIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
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

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onSelectGuest,
  onGoogleLoginSuccess,
}) => {
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Initialize Google GIS overlay button inside modal
  useEffect(() => {
    if (!isOpen) return;

    const clientId =
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      '1042260047227-83if5kgps15jm4e8n6ebl5rb1iiu67sh.apps.googleusercontent.com';

    const renderButton = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response?.credential && onGoogleLoginSuccess) {
                try {
                  await onGoogleLoginSuccess(response.credential);
                  onClose();
                } catch (e) {
                  console.error('Login error in WelcomeModal:', e);
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
        } catch (err) {
          console.warn('Failed to render GIS in WelcomeModal', err);
        }
      }
    };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          renderButton();
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [isOpen, onGoogleLoginSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 animate-scale-in text-white overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-neutral-800/80 text-neutral-400 hover:text-white transition-colors cursor-pointer z-10"
          title="Tutup & Lanjut sebagai Tamu"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Logo */}
        <div className="text-center space-y-2 pt-1">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src={logoNav} alt="Pixuplay Logo" className="h-7 w-auto object-contain" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Selamat Datang di Pixuplay
          </h2>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
            Streaming anime kualitas Full HD dengan subtitle Indonesia terlengkap dan bebas iklan mengganggu.
          </p>
        </div>

        {/* Transparansi & Keuntungan Masuk dengan Google */}
        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-200 border-b border-neutral-800 pb-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Mengapa Kami Menyarankan Masuk dengan Google?</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <div className="flex items-start gap-2.5">
              <Cloud className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[11px] font-bold text-white">Cloud Sync Otomatis</strong>
                <span className="text-[10px] text-neutral-400 leading-tight block">
                  Riwayat & menit episode tersimpan di cloud. Lanjut tonton di HP atau PC tanpa hilang.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[11px] font-bold text-white">Resmi & Tanpa Password</strong>
                <span className="text-[10px] text-neutral-400 leading-tight block">
                  OAuth resmi Google. Pixuplay tidak pernah meminta atau menyimpan kata sandi Anda.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MessageSquare className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[11px] font-bold text-white">Bebas Komen & Nobar</strong>
                <span className="text-[10px] text-neutral-400 leading-tight block">
                  Tulis komentar di episode dan bergabung di room nobar dengan identitas profil asli.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Trophy className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[11px] font-bold text-white">Sistem Level & Badges</strong>
                <span className="text-[10px] text-neutral-400 leading-tight block">
                  Progres level akun dan lencana penonton tersimpan aman tanpa risiko hilang saat clear cache.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Choices */}
        <div className="space-y-2.5 pt-1">
          {/* Choice 1: Google Login (Primary / Recommended) */}
          <div className="relative w-full rounded-2xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-700 hover:border-neutral-500 transition-all shadow-xl group cursor-pointer overflow-hidden p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0">
                  <GoogleIcon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    Masuk dengan Google
                    <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-sm border border-blue-500/30">
                      Disarankan
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    Satu klik resmi tanpa registrasi manual
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>

            {/* Invisible Google GIS Overlay */}
            <div
              ref={googleBtnRef}
              className="absolute inset-0 z-20 overflow-hidden cursor-pointer flex items-center justify-center"
              style={{
                opacity: 0.001,
                transform: 'scale(1.3)',
                transformOrigin: 'center center',
                pointerEvents: 'auto',
              }}
              title="Masuk dengan Google"
            />
          </div>

          {/* Choice 2: Continue as Guest */}
          <button
            onClick={onSelectGuest}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-neutral-900/40 hover:bg-neutral-800/60 border border-neutral-800/80 hover:border-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-neutral-800/60 border border-neutral-700/60 flex items-center justify-center text-neutral-400 group-hover:text-neutral-200 flex-shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-neutral-200 group-hover:text-white">
                  Lanjutkan sebagai Tamu
                </div>
                <div className="text-[10px] text-neutral-500 truncate">
                  Mode lokal tanpa akun (fitur komentar & cloud sync dinonaktifkan)
                </div>
              </div>
            </div>
            <span className="text-[11px] text-neutral-400 group-hover:text-neutral-200 font-medium flex-shrink-0">
              Mulai Nonton &rarr;
            </span>
          </button>
        </div>

        {/* Footer Privacy Note */}
        <p className="text-[10px] text-neutral-500 text-center">
          Dengan melanjutkan, Anda menyetujui kenyamanan menonton tanpa iklan spam di Pixuplay.
        </p>
      </div>
    </div>
  );
};
