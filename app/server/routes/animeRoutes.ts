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
import { sanitizeSlug, sanitizeText } from "../security/crypto";
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

  // 5. Shounen & Action Anime
  if (pathname === "/api/pixuplay/shounen") {
    const data = await getAnimeByGenre("shounen");
    return jsonResponse({ status: true, data: data.slice(0, 24) });
  }

  // 6. Isekai & Fantasy Anime
  if (pathname === "/api/pixuplay/isekai") {
    const data = await getAnimeByGenre("isekai");
    return jsonResponse({ status: true, data: data.slice(0, 24) });
  }

  // 7. Classics & Masterpiece Anime
  if (pathname === "/api/pixuplay/classics") {
    const completed = await getCompleted();
    return jsonResponse({ status: true, data: completed.slice(0, 20) });
  }

  // 8. Weekly Schedule
  if (pathname === "/api/pixuplay/schedule") {
    const data = await getSchedule();
    return jsonResponse({ status: true, data });
  }

  // 9. A-Z Catalog List
  if (pathname === "/api/pixuplay/az") {
    const data = await getAZList();
    return jsonResponse({ status: true, count: data.length, data });
  }

  // 10. Genre Anime (supports /api/pixuplay/genre/:id and /api/pixuplay/genres/:id)
  if (pathname.startsWith("/api/pixuplay/genre/") || pathname.startsWith("/api/pixuplay/genres/")) {
    const rawGenre = pathname.startsWith("/api/pixuplay/genre/")
      ? pathname.replace("/api/pixuplay/genre/", "")
      : pathname.replace("/api/pixuplay/genres/", "");
    const genreId = sanitizeSlug(rawGenre.split("?")[0].toLowerCase().trim());
    if (!genreId) {
      return jsonResponse({ status: false, message: "ID Genre diperlukan" }, 400);
    }
    const data = await getAnimeByGenre(genreId);
    return jsonResponse({ status: true, genre: genreId, count: data.length, data });
  }

  // 11. All Anime
  if (pathname === "/api/pixuplay/all") {
    const ongoing = await getOngoing();
    const completed = await getCompleted();
    const all = [...ongoing, ...completed];
    return jsonResponse({ status: true, count: all.length, data: all });
  }

  // 12. Search
  if (pathname === "/api/pixuplay/search") {
    const q = url.searchParams.get("q") || "";
    if (!q.trim()) {
      return jsonResponse({ status: true, count: 0, data: [] });
    }
    const data = await searchAnime(q);
    return jsonResponse({ status: true, query: q, count: data.length, data });
  }

  // 13. Anime Details
  if (pathname.startsWith("/api/pixuplay/detail/")) {
    const animeId = sanitizeSlug(pathname.replace("/api/pixuplay/detail/", "").split("?")[0].trim());
    if (!animeId) {
      return jsonResponse({ status: false, message: "animeId diperlukan" }, 400);
    }
    const details = await getAnimeDetails(animeId);
    if (!details) {
      return jsonResponse({ status: false, message: "Anime tidak ditemukan" }, 404);
    }
    return jsonResponse({ status: true, data: details });
  }

  // 14. Episode List (supports /api/pixuplay/episodes/:animeId and /api/pixuplay/episodes?animeId=...)
  if (pathname.startsWith("/api/pixuplay/episodes/") || pathname === "/api/pixuplay/episodes") {
    let animeId = "";
    if (pathname.startsWith("/api/pixuplay/episodes/")) {
      animeId = sanitizeSlug(pathname.replace("/api/pixuplay/episodes/", "").split("?")[0].trim());
    } else {
      animeId = sanitizeSlug(url.searchParams.get("animeId") || "");
    }

    if (!animeId) {
      return jsonResponse({ status: false, message: "animeId diperlukan" }, 400);
    }
    const details = await getAnimeDetails(animeId);
    return jsonResponse({
      status: true,
      animeId,
      episodes: details?.episodeList || [],
      data: details?.episodeList || [],
    });
  }

  // 15. Stream Resolver (supports /api/pixuplay/stream/:animeId/:episode and /api/pixuplay/stream?animeId=...&episode=...)
  if (pathname.startsWith("/api/pixuplay/stream/") || pathname === "/api/pixuplay/stream") {
    let animeId = "";
    let episode = 1;
    if (pathname.startsWith("/api/pixuplay/stream/")) {
      const parts = pathname.replace("/api/pixuplay/stream/", "").split("?")[0].split("/");
      animeId = sanitizeSlug(parts[0] || "");
      episode = Math.max(1, parseInt(parts[1] || "1", 10) || 1);
    } else {
      animeId = sanitizeSlug(url.searchParams.get("animeId") || "");
      episode = Math.max(1, parseInt(url.searchParams.get("episode") || "1", 10) || 1);
    }

    const rawTitle = url.searchParams.get("title") || "Anime";
    const title = sanitizeText(rawTitle, 150) || "Anime";

    if (!animeId && !title) {
      return jsonResponse({ status: false, message: "animeId atau title diperlukan" }, 400);
    }

    const streamData = await resolveStream(animeId, title, episode);
    return jsonResponse({
      status: true,
      animeId,
      data: streamData,
      ...streamData,
    });
  }

  return null;
}
