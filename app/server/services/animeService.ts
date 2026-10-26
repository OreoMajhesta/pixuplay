import { WAJIK_API, SCRAPER_SOCKET, CACHE_TTL_SHORT, CACHE_TTL_MEDIUM, CACHE_TTL_LONG } from "../config/env";
import { CACHE, normalizeAnime } from "../cache/memoryCache";

export async function fetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  try {
    let fetchUrl = url;
    const fetchOptions: any = { signal: AbortSignal.timeout(timeoutMs) };

    if (
      url.includes("/otakudesu/") ||
      url.includes("/kuramanime/") ||
      url.includes("/oploverz/") ||
      url.includes("/samehadaku/")
    ) {
      // Re-route to internal embedded Unix socket
      fetchUrl = url.replace(/https?:\/\/[^\/]+/, "http://localhost");
      fetchOptions.unix = SCRAPER_SOCKET;
    }

    const res = await fetch(fetchUrl, fetchOptions);
    if (!res.ok) return null;
    return await res.json();
  } catch (err: any) {
    console.warn(`[Pixuplay API Fetch Error] ${url}: ${err.message}`);
    return null;
  }
}

// 1. Ongoing List
export async function getOngoing(): Promise<any[]> {
  const now = Date.now();
  if (CACHE.ongoing && now - CACHE.ongoingTime < CACHE_TTL_SHORT) {
    return CACHE.ongoing;
  }
  const json = await fetchJson(`${WAJIK_API}/otakudesu/ongoing?page=1`);
  const list = json?.data?.animeList || [];
  const normalized = list.map((item: any) => normalizeAnime(item, "otakudesu", "RELEASING"));
  if (normalized.length > 0) {
    CACHE.ongoing = normalized;
    CACHE.ongoingTime = now;
  }
  return CACHE.ongoing || [];
}

// 2. Completed List
export async function getCompleted(): Promise<any[]> {
  const now = Date.now();
  if (CACHE.completed && now - CACHE.completedTime < CACHE_TTL_MEDIUM) {
    return CACHE.completed;
  }
  const json = await fetchJson(`${WAJIK_API}/otakudesu/completed?page=1`);
  const list = json?.data?.animeList || [];
  const normalized = list.map((item: any) => normalizeAnime(item, "otakudesu", "FINISHED"));
  if (normalized.length > 0) {
    CACHE.completed = normalized;
    CACHE.completedTime = now;
  }
  return CACHE.completed || [];
}

// 3. Trending List
export async function getTrending(): Promise<any[]> {
  const now = Date.now();
  if (CACHE.trending && now - CACHE.trendingTime < CACHE_TTL_SHORT) {
    return CACHE.trending;
  }

  const ongoing = await getOngoing();
  if (!ongoing || ongoing.length === 0) return [];

  const withScores = await Promise.all(
    ongoing.map(async (item: any) => {
      const animeId = item.id || item.animeId;
      if (!animeId) return item;

      let rawScore: string | null = null;
      if (CACHE.detail.has(animeId)) {
        rawScore = CACHE.detail.get(animeId)?.data?.score || null;
      }

      if (!rawScore) {
        try {
          const detailRes = await fetchJson(`${WAJIK_API}/otakudesu/anime/${animeId}`, 3000);
          rawScore = detailRes?.data?.details?.score || null;
        } catch {}
      }

      const scoreNum = rawScore ? parseFloat(String(rawScore).replace(/[^0-9.]/g, "")) : 7.0;
      const averageScore = Math.round(scoreNum * 10);

      return {
        ...item,
        score: rawScore || String(scoreNum.toFixed(2)),
        averageScore: averageScore > 0 ? averageScore : item.averageScore || 70,
      };
    })
  );

  withScores.sort((a: any, b: any) => (b.averageScore || 0) - (a.averageScore || 0));

  CACHE.trending = withScores;
  CACHE.trendingTime = now;
  return CACHE.trending;
}

// 4. Schedule
export async function getSchedule(): Promise<any[]> {
  const now = Date.now();
  if (CACHE.schedule && now - CACHE.scheduleTime < CACHE_TTL_LONG) {
    return CACHE.schedule;
  }
  const json = await fetchJson(`${WAJIK_API}/otakudesu/schedule`);
  const list = json?.data?.scheduleList || [];

  const ongoing = await getOngoing();
  const posterMap = new Map<string, string>();
  for (const item of ongoing) {
    if (item.id && item.coverImage?.extraLarge) {
      posterMap.set(item.id, item.coverImage.extraLarge);
    }
  }

  const enriched = list.map((day: any) => {
    const animeWithPosters = (day.animeList || []).map((anime: any) => {
      let poster = posterMap.get(anime.animeId);
      if (!poster && CACHE.detail.has(anime.animeId)) {
        poster = CACHE.detail.get(anime.animeId)?.data?.coverImage?.extraLarge;
      }
      return {
        ...anime,
        poster: poster || null,
      };
    });
    return {
      ...day,
      animeList: animeWithPosters,
    };
  });

  if (enriched.length > 0) {
    CACHE.schedule = enriched;
    CACHE.scheduleTime = now;
  }
  return CACHE.schedule || [];
}

// 5. A-Z List
export async function getAZList(): Promise<any[]> {
  const now = Date.now();
  if (CACHE.az && now - CACHE.azTime < CACHE_TTL_LONG) {
    return CACHE.az;
  }
  const json = await fetchJson(`${WAJIK_API}/otakudesu/anime`);
  const list = json?.data?.list || [];
  if (list.length > 0) {
    CACHE.az = list;
    CACHE.azTime = now;
  }
  return CACHE.az || [];
}

// 6. By Genre
export async function getAnimeByGenre(genreId: string): Promise<any[]> {
  const cleanId = genreId.toLowerCase().trim();
  const now = Date.now();
  const cached = CACHE.genres.get(cleanId);
  if (cached && now - cached.timestamp < CACHE_TTL_LONG) {
    return cached.data;
  }

  const pages = [1, 2, 3, 4];
  const promises = pages.map((p) =>
    fetchJson(`${WAJIK_API}/otakudesu/genre/${cleanId}?page=${p}`, 8000).then(
      (res) => res?.data?.animeList || []
    )
  );

  const rawLists = await Promise.all(promises);
  const allRaw = rawLists.flat();

  const seen = new Set<string>();
  const normalized: any[] = [];
  for (const item of allRaw) {
    const key = item.animeId || item.otakudesuUrl || item.title;
    if (key && !seen.has(key)) {
      seen.add(key);
      normalized.push(normalizeAnime(item, "otakudesu"));
    }
  }

  if (normalized.length > 0) {
    CACHE.genres.set(cleanId, { data: normalized, timestamp: now });
  }

  return normalized;
}

// 7. Multi-Search
export async function searchAnime(query: string): Promise<any[]> {
  const qClean = query.trim().toLowerCase();
  if (!qClean) return [];

  const cached = CACHE.search.get(qClean);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MEDIUM) {
    return cached.data;
  }

  const results: any[] = [];
  const seenIds = new Set<string>();

  const otakuJson = await fetchJson(`${WAJIK_API}/otakudesu/search?q=${encodeURIComponent(query)}`);
  const otakuList = otakuJson?.data?.animeList || [];
  for (const item of otakuList) {
    if (!seenIds.has(item.animeId)) {
      seenIds.add(item.animeId);
      results.push(normalizeAnime(item, "otakudesu"));
    }
  }

  const opJson = await fetchJson(`${WAJIK_API}/oploverz/search?q=${encodeURIComponent(query)}`);
  const opList = opJson?.data?.animeList || [];
  for (const item of opList) {
    const slug = item.slug || item.href?.replace(/.*\/anime\//, "").replace(/\/$/, "");
    if (slug && !seenIds.has(slug)) {
      seenIds.add(slug);
      results.push({
        id: slug,
        animeId: slug,
        title: {
          english: item.title,
          romaji: item.title,
          userPreferred: item.title,
          native: item.title,
        },
        coverImage: { extraLarge: item.poster, large: item.poster },
        bannerImage: item.poster,
        description: "Streaming anime subtitle Indonesia.",
        episodes: 12,
        averageScore: 90,
        genres: ["Action", "Adventure"],
        status: (item.status || "").toLowerCase().includes("ongoing") ? "RELEASING" : "FINISHED",
        countryOfOrigin: "JP",
        source: "oploverz",
      });
    }
  }

  CACHE.search.set(qClean, { data: results, timestamp: Date.now() });
  return results;
}

// 8. Rich synopsis from AniList
export async function fetchAniListInfo(titleOrSlug: string): Promise<{ synopsis?: string; banner?: string; cover?: string } | null> {
  try {
    const cleanQ = titleOrSlug
      .replace(/-sub-indo/gi, "")
      .replace(/-/g, " ")
      .replace(/\s+Season\s+(\d+)/gi, " $1")
      .trim();
    const gql = `query ($search: String) {
      Media(search: $search, type: ANIME) {
        description(asHtml: false)
        bannerImage
        coverImage { extraLarge }
      }
    }`;
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: gql, variables: { search: cleanQ } }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const media = json?.data?.Media;
    if (!media) return null;
    return {
      synopsis: media.description?.replace(/<[^>]*>?/gm, "").trim(),
      banner: media.bannerImage,
      cover: media.coverImage?.extraLarge,
    };
  } catch {
    return null;
  }
}

// 9. Anime Details
export async function getAnimeDetails(animeId: string): Promise<any | null> {
  const cached = CACHE.detail.get(animeId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MEDIUM) {
    return cached.data;
  }

  const otakuRes = await fetchJson(`${WAJIK_API}/otakudesu/anime/${animeId}`);
  if (otakuRes?.data?.details) {
    const details = otakuRes.data.details;
    let synopsis = (details.synopsis?.paragraphList || [])
      .filter((p: string) => p && p.trim().length > 10)
      .join("\n\n")
      .trim();
    let banner = details.poster;

    if (!synopsis || synopsis.length < 20) {
      const anilistInfo = await fetchAniListInfo(details.title || animeId);
      if (anilistInfo) {
        if (anilistInfo.synopsis) synopsis = anilistInfo.synopsis;
        if (anilistInfo.banner) banner = anilistInfo.banner;
      }
    }

    if (!synopsis) {
      synopsis = `Sinopsis untuk serial anime ${details.title || "ini"} sedang dalam proses pembaruan. Anda dapat langsung menonton seluruh episode dengan subtitle Indonesia di Pixuplay.`;
    }

    const normalized = {
      ...normalizeAnime({ ...details, animeId, bannerImage: banner }, "otakudesu"),
      description: synopsis,
      bannerImage: banner,
      episodeList: (details.episodeList || [])
        .filter((ep: any) => !ep.episodeId?.includes("pembatas"))
        .map((ep: any) => ({
          title: ep.title,
          episodeId: ep.episodeId,
          url: ep.otakudesuUrl,
        }))
        .sort((a: any, b: any) => {
          const numA = parseInt(String(a.title).replace(/[^0-9]/g, ""), 10) || 0;
          const numB = parseInt(String(b.title).replace(/[^0-9]/g, ""), 10) || 0;
          return numA - numB;
        }),
    };
    CACHE.detail.set(animeId, { data: normalized, timestamp: Date.now() });
    return normalized;
  }

  const opRes = await fetchJson(`${WAJIK_API}/oploverz/anime/${animeId}`);
  if (opRes?.data?.details) {
    const details = opRes.data.details;
    const normalized = {
      id: animeId,
      animeId: animeId,
      title: {
        english: details.title,
        romaji: details.title,
        userPreferred: details.title,
        native: details.title,
      },
      coverImage: { extraLarge: details.poster, large: details.poster },
      bannerImage: details.poster,
      description: details.synopsis?.paragraphList?.join("\n\n") || "",
      episodes: details.episodeList?.length || 12,
      averageScore: details.rating ? Math.round(parseFloat(details.rating) * 10) : 88,
      genres: details.genres || ["Action"],
      status: (details.status || "").toLowerCase().includes("ongoing") ? "RELEASING" : "FINISHED",
      countryOfOrigin: "JP",
      episodeList: (details.episodeList || []).map((ep: any) => ({
        title: ep.episode || ep.title,
        episodeId: ep.href?.replace(/.*\/anime\//, "").replace("https://oploverz.am/", "").replace(/\/$/, ""),
        url: ep.href,
      })),
      source: "oploverz",
    };
    CACHE.detail.set(animeId, { data: normalized, timestamp: Date.now() });
    return normalized;
  }

  return null;
}
