import React from 'react';
import { Lock, Zap, Sparkles } from 'lucide-react';
import { UserProfile } from '../../types';

export function getLevelProgress(exp: number) {
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

interface ProfileLevelCardProps {
  currentUser: UserProfile | null;
  onPromptLogin?: () => void;
}

export const ProfileLevelCard: React.FC<ProfileLevelCardProps> = ({
  currentUser,
  onPromptLogin,
}) => {
  if (!currentUser) {
    return (
      <div className="relative overflow-hidden bg-card border border-white/10 rounded-2xl p-5 shadow-lg space-y-3.5">
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
              <p className="text-[11px] text-neutral-400 mt-0.5 max-w-xl">
                Masuk dengan akun Google untuk mengaktifkan sistem Level, akumulasi EXP nonton anime, dan menyimpan pencapaian kamu secara permanen.
              </p>
            </div>
          </div>

          <button
            onClick={onPromptLogin}
            className="px-4 py-2 bg-white hover:bg-neutral-200 text-black text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 flex-shrink-0 shadow self-start sm:self-center"
          >
            <span>Masuk untuk Buka Level</span>
          </button>
        </div>

        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500/50" />
            <span>Nonton anime <strong>+10 EXP/menit</strong> • Rewatch episode <strong>+25 EXP bonus</strong></span>
          </div>
          <span className="text-[10px] text-neutral-500">Tersedia otomatis setelah login akun Google</span>
        </div>
      </div>
    );
  }

  const expTotal = currentUser.exp || 0;
  const levelData = getLevelProgress(expTotal);

  return (
    <div className="bg-card border border-white/10 rounded-2xl p-5 space-y-3.5 shadow-lg">
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
            <p className="text-[11px] text-neutral-400">
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

      <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Nonton anime <strong>+10 EXP/menit</strong> • Rewatch episode <strong>+25 EXP bonus</strong></span>
        </div>
        <span className="text-[10px] text-neutral-500">Diakumulasi otomatis saat pemutar aktif</span>
      </div>
    </div>
  );
};
