import {
  getOngoing,
  getCompleted,
  getTrending,
  getSchedule,
  getAZList,
  getAnimeByGenre,
  searchAnime,
  getAnimeDetails,
} from "../services/animeService";
import { resolveStream } from "../services/streamService";
import { jsonResponse } from "../security/rateLimiter";
import { sanitizeSlug } from "../security/crypto";
import { PORT } from "../config/env";

export async function handleAnimeRoutes(req: Request, url: URL): Promise<Response | null> {
  const { pathname } = url;

  // 1. Health check
  if (pathname === "/api/pixuplay/health" || pathname === "/health") {
    return jsonResponse({
      status: "ok",
      app: "Pixuplay Anime Streaming",
      version: "3.5.0",
      port: PORT,
      mode: "Modular Architecture",
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Ongoing Anime
  if (pathname === "/api/pixuplay/ongoing") {
    const data = await getOngoing();
    return jsonResponse({ status: true, count: data.length, data });
  }

  // 3. Completed Anime
  if (pathname === "/api/pixuplay/completed") {
    const data = await getCompleted();
    return jsonResponse({ status: true, count: data.length, data });
  }

  // 4. Trending / Hot Anime
  if (pathname === "/api/pixuplay/trending") {
    const data = await getTrending();
    return jsonResponse({ status: true, count: data.length, data });
  }

  // 5. Weekly Schedule
  if (pathname === "/api/pixuplay/schedule") {
    const data = await getSchedule();
    return jsonResponse({ status: true, data });
  }

  // 6. A-Z Catalog List
  if (pathname === "/api/pixuplay/az") {
    const data = await getAZList();
    return jsonResponse({ status: true, count: data.length, data });
  }

  // 7. Genre Anime
  if (pathname.startsWith("/api/pixuplay/genres/")) {
    const genreId = sanitizeSlug(pathname.replace("/api/pixuplay/genres/", "").trim());
    if (!genreId) {
      return jsonResponse({ status: false, message: "ID Genre diperlukan" }, 400);
    }
    const data = await getAnimeByGenre(genreId);
    return jsonResponse({ status: true, genre: genreId, count: data.length, data });
  }

  // 8. Search
  if (pathname === "/api/pixuplay/search") {
    const q = url.searchParams.get("q") || "";
    if (!q.trim()) {
      return jsonResponse({ status: true, count: 0, data: [] });
    }
    const data = await searchAnime(q);
    return jsonResponse({ status: true, query: q, count: data.length, data });
  }

  // 9. Anime Details
  if (pathname.startsWith("/api/pixuplay/detail/")) {
    const animeId = sanitizeSlug(pathname.replace("/api/pixuplay/detail/", "").trim());
    if (!animeId) {
      return jsonResponse({ status: false, message: "animeId diperlukan" }, 400);
    }
    const details = await getAnimeDetails(animeId);
    if (!details) {
      return jsonResponse({ status: false, message: "Anime tidak ditemukan" }, 404);
    }
    return jsonResponse({ status: true, data: details });
  }

  // 10. Episodes
  if (pathname === "/api/pixuplay/episodes") {
    const animeId = sanitizeSlug(url.searchParams.get("animeId") || "");
    if (!animeId) {
      return jsonResponse({ status: false, message: "animeId diperlukan" }, 400);
    }
    const details = await getAnimeDetails(animeId);
    return jsonResponse({
      status: true,
      animeId,
      episodes: details?.episodeList || [],
    });
  }

  // 11. Stream Resolver (Fontaine, Sumeru, Natlan, Inazuma)
  if (pathname === "/api/pixuplay/stream") {
    const animeId = sanitizeSlug(url.searchParams.get("animeId") || "");
    const title = url.searchParams.get("title") || "";
    const episode = Math.max(1, parseInt(url.searchParams.get("episode") || "1", 10) || 1);

    if (!animeId && !title) {
      return jsonResponse({ status: false, message: "animeId atau title diperlukan" }, 400);
    }

    const streamData = await resolveStream(animeId, title, episode);
    return jsonResponse({ status: true, data: streamData });
  }

  return null;
}
