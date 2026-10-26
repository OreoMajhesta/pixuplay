import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Play } from 'lucide-react';
import { ScheduleDay, ScheduleItem, Anime } from '../types';
import { getSchedule, getAnimeDetail } from '../api';

interface SchedulePageProps {
  onSelectAnime: (anime: Anime) => void;
  onQuickPlay: (anime: Anime, ep?: number) => void;
}

const DAYS = ['Semua Hari', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const ScheduleAnimeCard: React.FC<{
  item: ScheduleItem;
  dayTitle: string;
  onSelect: (anime: Anime) => void;
  onPlay: (anime: Anime) => void;
}> = ({ item, dayTitle, onSelect, onPlay }) => {
  const [poster, setPoster] = useState<string>((item as any).poster || '');

  useEffect(() => {
    if (!poster && item.animeId) {
      let isCancelled = false;
      getAnimeDetail(item.animeId)
        .then((detail) => {
          if (!isCancelled && detail?.coverImage?.extraLarge) {
            setPoster(detail.coverImage.extraLarge);
          }
        })
        .catch(() => {});
      return () => {
        isCancelled = true;
      };
    }
  }, [item.animeId, poster]);

  const animeObj: Anime = {
    id: item.animeId,
    animeId: item.animeId,
    title: { english: item.title, romaji: item.title },
    coverImage: {
      extraLarge: poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80',
    },
    status: 'Ongoing',
    releaseDay: dayTitle,
  };

  return (
    <div
      onClick={() => onSelect(animeObj)}
      className="group/sch relative bg-card border border-subtle hover:border-white/60 rounded-xl p-3 transition-all duration-200 flex items-center gap-3.5 hover:-translate-y-0.5 hover:shadow-xl cursor-pointer"
    >
      {/* Anime Thumbnail Image (3:4 ratio) */}
      <div className="relative w-16 h-20 sm:w-18 sm:h-24 aspect-[3/4] rounded-lg overflow-hidden bg-black/60 border border-white/10 flex-shrink-0">
        <img
          src={poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80'}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover/sch:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <span className="absolute bottom-1 right-1 text-[9px] font-black px-1 rounded bg-black/80 text-amber-400 border border-white/10">
          SUB INDO
        </span>
      </div>

      {/* Info & Title */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-0.5">
          Rilis {dayTitle}
        </span>
        <h3 className="text-sm font-bold text-white group-hover/sch:underline truncate mb-1" title={item.title}>
          {item.title}
        </h3>
        <div className="flex items-center gap-2 text-[11px] text-neutral-400">
          <Clock className="w-3 h-3 text-neutral-400" />
          <span>Penayangan Rutin</span>
        </div>
      </div>

      {/* Quick Play Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlay(animeObj);
        }}
        className="p-2.5 bg-white/10 group-hover/sch:bg-white group-hover/sch:text-black text-white rounded-lg border border-white/20 transition-all cursor-pointer flex-shrink-0 shadow"
        title={`Tonton ${item.title}`}
        aria-label={`Tonton ${item.title}`}
      >
        <Play className="w-4 h-4 fill-current ml-0.5" />
      </button>
    </div>
  );
};

export const SchedulePage: React.FC<SchedulePageProps> = ({ onSelectAnime, onQuickPlay }) => {
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<string>('Semua Hari');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      const data = await getSchedule();
      if (isMounted) {
        setSchedule(data || []);
        setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSchedule = selectedDay === 'Semua Hari'
    ? schedule
    : schedule.filter((d) => d.title.toLowerCase().includes(selectedDay.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-subtle pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-white mb-2">
            <Calendar className="w-6 h-6" />
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Jadwal Rilis Anime</h1>
          </div>
          <p className="text-sm text-neutral-300">
            Jadwal penayangan episode anime Sub Indo terbaru setiap hari dengan sampul resmi.
          </p>
        </div>

        {/* Day Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-all cursor-pointer ${
                selectedDay === day
                  ? 'bg-white text-black'
                  : 'bg-surface text-neutral-300 hover:text-white hover:bg-neutral-800 border border-subtle'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-10 h-10 border-3 border-neutral-700 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-sm text-neutral-400">Memuat jadwal rilis...</p>
        </div>
      ) : filteredSchedule.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Tidak ada jadwal rilis yang ditemukan untuk hari ini.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {filteredSchedule.map((dayGroup) => (
            <div key={dayGroup.title} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                <h2 className="text-xl font-black text-white">{dayGroup.title}</h2>
                <span className="text-xs text-neutral-400 font-normal ml-2">
                  ({dayGroup.animeList.length} Judul)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {dayGroup.animeList.map((item) => (
                  <ScheduleAnimeCard
                    key={item.animeId || item.title}
                    item={item}
                    dayTitle={dayGroup.title}
                    onSelect={onSelectAnime}
                    onPlay={(a) => onQuickPlay(a, 1)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
