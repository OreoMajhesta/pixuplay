import React from 'react';
import { Server, Check } from 'lucide-react';
import { StreamServer } from '../../types';
import { GENSHIN_REGIONS } from './WatchGenshinConfig';

interface WatchServerSelectorProps {
  servers: StreamServer[];
  activeServerIdx: number;
  onSelectServer: (idx: number) => void;
  currentServer: StreamServer | null;
}

export const WatchServerSelector: React.FC<WatchServerSelectorProps> = ({
  servers,
  activeServerIdx,
  onSelectServer,
  currentServer,
}) => {
  if (!servers || servers.length === 0) return null;

  return (
    <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-red-500" />
          <h3 className="text-xs sm:text-sm font-bold text-white">
            Pilih Server Pemutar
          </h3>
          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/20 uppercase tracking-wider">
            Sub Indo
          </span>
        </div>
        <div className="text-[11px] text-neutral-400 hidden sm:flex items-center gap-1.5">
          <span>Server Aktif:</span>
          <strong className="text-white font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            {currentServer?.name || 'Server Fontaine'}
          </strong>
        </div>
      </div>

      {/* Server Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {servers.map((srv, idx) => {
          const isSelected = activeServerIdx === idx;
          const regionMeta =
            GENSHIN_REGIONS.find((r) => r.name.toLowerCase() === (srv.region || '').toLowerCase()) ||
            GENSHIN_REGIONS[idx % GENSHIN_REGIONS.length];
          const IconComponent = regionMeta.icon;
          const maxQ = srv.maxQualityLabel || 'Maks 720p HD';

          return (
            <button
              key={idx}
              onClick={() => onSelectServer(idx)}
              className={`relative flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer group ${
                isSelected
                  ? `bg-neutral-900 ${regionMeta.activeBorder} shadow-lg shadow-black/40`
                  : 'bg-black/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`p-2 rounded-lg ${regionMeta.badgeBg} flex-shrink-0 transition-transform group-hover:scale-105`}
                >
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold truncate ${
                        isSelected ? 'text-white' : 'text-neutral-200 group-hover:text-white'
                      }`}
                    >
                      Server {srv.region || regionMeta.name}
                    </span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-medium truncate mt-0.5">
                    {maxQ}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                  Sub Indo
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-red-500 ml-0.5" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
