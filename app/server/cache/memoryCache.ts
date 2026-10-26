import { CACHE_TTL_SHORT, CACHE_TTL_MEDIUM, CACHE_TTL_LONG } from "../config/env";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const CACHE = {
  ongoing: null as any[] | null,
  ongoingTime: 0,
  completed: null as any[] | null,
  completedTime: 0,
  schedule: null as any[] | null,
  scheduleTime: 0,
  az: null as any[] | null,
  azTime: 0,
  trending: null as any[] | null,
  trendingTime: 0,

  search: new Map<string, CacheEntry<any[]>>(),
  detail: new Map<string, CacheEntry<any>>(),
  episodes: new Map<string, CacheEntry<any[]>>(),
  stream: new Map<string, CacheEntry<any>>(),
  extractedMp4: new Map<string, string>(),
  genres: new Map<string, CacheEntry<any[]>>(),
};

// Periodic garbage collection for memory maps
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of CACHE.search.entries()) {
    if (now - item.timestamp > CACHE_TTL_SHORT) CACHE.search.delete(key);
  }
  for (const [key, item] of CACHE.stream.entries()) {
    if (now - item.timestamp > CACHE_TTL_MEDIUM) CACHE.stream.delete(key);
  }
  for (const [key, item] of CACHE.detail.entries()) {
    if (now - item.timestamp > CACHE_TTL_LONG) CACHE.detail.delete(key);
  }
}, 5 * 60 * 1000);

export function normalizeAnime(a: any, source: string = "otakudesu", defaultStatus?: string) {
  const animeId = a.animeId || a.slug || a.id || "";
  const title = a.title || "Anime";
  const poster =
    a.poster ||
    a.coverImage?.extraLarge ||
    "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80";
  const episodes = parseInt(String(a.episodes || a.episodeCount || "12").replace(/[^0-9]/g, ""), 10) || 12;

  let synopsis = "";
  if (Array.isArray(a.synopsis?.paragraphList) && a.synopsis.paragraphList.length > 0) {
    synopsis = a.synopsis.paragraphList.join("\n\n").trim();
  } else if (typeof a.description === "string" && a.description.trim()) {
    synopsis = a.description.trim();
  }

  let genres: string[] = [];
  if (Array.isArray(a.genreList)) {
    genres = a.genreList.map((g: any) => (typeof g === "object" ? g.title || g.genreId : String(g))).filter(Boolean);
  } else if (Array.isArray(a.genres)) {
    genres = a.genres.map((g: any) => (typeof g === "object" ? g.title || g.genreId : String(g))).filter(Boolean);
  } else if (animeId && CACHE.detail.has(animeId)) {
    genres = CACHE.detail.get(animeId)?.data?.genres || [];
  }

  const isOngoing =
    defaultStatus === "RELEASING" ||
    (a.status || "").toLowerCase().includes("ongoing") ||
    Boolean(a.releaseDay) ||
    Boolean(a.latestReleaseDate);

  return {
    id: animeId,
    animeId: animeId,
    title: {
      romaji: typeof title === "string" ? title : title.romaji || title.english || "Anime",
      english: typeof title === "string" ? title : title.english || title.romaji || "Anime",
      userPreferred: typeof title === "string" ? title : title.userPreferred || title.english || "Anime",
      native: typeof a.japanese === "string" ? a.japanese : (typeof title === "object" ? title.native : title) || "Anime",
    },
    coverImage: {
      extraLarge: poster,
      large: poster,
      medium: poster,
    },
    bannerImage: a.bannerImage || poster,
    description: synopsis || "",
    episodes: episodes,
    averageScore: a.score ? Math.round(parseFloat(String(a.score).replace(/[^0-9.]/g, "")) * 10) : (a.averageScore || 88),
    genres: genres,
    status: isOngoing ? "RELEASING" : "FINISHED",
    countryOfOrigin: "JP",
    latestReleaseDate: a.latestReleaseDate || a.releasedOn || "",
    releaseDay: a.releaseDay || "",
    source: source,
  };
}
