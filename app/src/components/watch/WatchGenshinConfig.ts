import React from 'react';
import { Droplets, Flame, Leaf, Zap, Shield, Wind } from 'lucide-react';

export interface GenshinRegionConfig {
  name: string;
  element: string;
  badgeBg: string;
  activeBorder: string;
  activeText: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const GENSHIN_REGIONS: GenshinRegionConfig[] = [
  { name: 'Fontaine', element: 'Hydro', badgeBg: 'bg-sky-500/10 border-sky-500/30 text-sky-400', activeBorder: 'border-sky-500 ring-2 ring-sky-500/30', activeText: 'text-sky-400', icon: Droplets },
  { name: 'Natlan', element: 'Pyro', badgeBg: 'bg-orange-500/10 border-orange-500/30 text-orange-400', activeBorder: 'border-orange-500 ring-2 ring-orange-500/30', activeText: 'text-orange-400', icon: Flame },
  { name: 'Sumeru', element: 'Dendro', badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/30', activeText: 'text-emerald-400', icon: Leaf },
  { name: 'Inazuma', element: 'Electro', badgeBg: 'bg-purple-500/10 border-purple-500/30 text-purple-400', activeBorder: 'border-purple-500 ring-2 ring-purple-500/30', activeText: 'text-purple-400', icon: Zap },
  { name: 'Liyue', element: 'Geo', badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', activeBorder: 'border-amber-500 ring-2 ring-amber-500/30', activeText: 'text-amber-400', icon: Shield },
  { name: 'Mondstadt', element: 'Anemo', badgeBg: 'bg-teal-500/10 border-teal-500/30 text-teal-400', activeBorder: 'border-teal-500 ring-2 ring-teal-500/30', activeText: 'text-teal-400', icon: Wind },
];
