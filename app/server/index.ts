import Bun, { serve } from "bun";
import fs from "fs";
import { PORT, SCRAPER_SOCKET } from "./config/env";
import { initDatabase } from "./db/schema";
import { getClientIp, globalSecurityHeaders, jsonResponse } from "./security/rateLimiter";
import { handleAnimeRoutes } from "./routes/animeRoutes";
import { handleAuthRoutes } from "./routes/authRoutes";
import { handleInteractionRoutes } from "./routes/interactionRoutes";
import { handleNobarRoutes } from "./routes/nobarRoutes";
import { handleEmbedProxy } from "./routes/embedProxyRoute";
import { handleStaticFile } from "./routes/staticRoutes";
import { createNobarWebSocketHandlers, NOBAR_ROOMS, NobarRoom, NobarWebSocketData } from "./websocket/nobarWebSocket";
import { sanitizeSlug, sanitizeText, sanitizeSafeUrl } from "./security/crypto";

// 1. Initialize SQLite Database & Indexes
initDatabase();

// 2. Start Embedded Scraper via Unix Domain Socket
if (fs.existsSync(SCRAPER_SOCKET)) {
  try { fs.unlinkSync(SCRAPER_SOCKET); } catch {}
}

let scraperServer: any = null;
try {
  const scraperApp = (await import("../../anime-api/dist/index.js")).default;
  scraperServer = scraperApp.listen(SCRAPER_SOCKET, () => {
    console.log(`[Pixuplay Server] 🔌 Embedded anime scraper active on socket: ${SCRAPER_SOCKET}`);
  });
} catch (err: any) {
  console.warn(`[Pixuplay Server] Embedded scraper initialization error:`, err?.message || err);
}

function cleanupScraperSocket() {
  if (scraperServer) {
    try { scraperServer.close(); } catch {}
  }
  try { fs.unlinkSync(SCRAPER_SOCKET); } catch {}
}
process.on("exit", cleanupScraperSocket);
process.on("SIGINT", () => { cleanupScraperSocket(); process.exit(0); });
process.on("SIGTERM", () => { cleanupScraperSocket(); process.exit(0); });

let serverInstance: any = null;

// 3. Start Unified Server
serverInstance = serve<NobarWebSocketData>({
  port: PORT,
  async fetch(req, srv) {
    const url = new URL(req.url);
    const { pathname } = url;
    const clientIp = getClientIp(req, srv);

    // Handle CORS preflight for all endpoints
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          ...globalSecurityHeaders,
        },
      });
    }

    // WebSocket Upgrade for Nobar Watch Party
    if (pathname === "/ws/nobar" || pathname === "/ws") {
      const roomId = sanitizeSlug(url.searchParams.get("roomId") || "global", 64);
      const name = sanitizeText(url.searchParams.get("name") || "Penonton", 30);
      const avatar = sanitizeSafeUrl(url.searchParams.get("avatar") || "");
      const role = url.searchParams.get("role") === "host" ? "host" : "viewer";

      const upgraded = srv.upgrade(req, {
        data: { roomId, name, avatar, role },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Embed proxy route
    if (pathname === "/api/pixuplay/embed-proxy") {
      return await handleEmbedProxy(req, clientIp);
    }

    // Anime catalog and scraper routes
    const animeRes = await handleAnimeRoutes(req, url);
    if (animeRes) return animeRes;

    // Comments & Likes interactions
    const interactionRes = await handleInteractionRoutes(req, url, clientIp);
    if (interactionRes) return interactionRes;

    // Authentication & User cloud sync
    const authRes = await handleAuthRoutes(req, url, clientIp);
    if (authRes) return authRes;

    // Nobar Watch Party HTTP endpoints
    const nobarRes = await handleNobarRoutes(req, url, clientIp, () => serverInstance);
    if (nobarRes) return nobarRes;

    // Safeguard for API routes: NEVER let /api/* fall through to SPA HTML
    if (pathname.startsWith("/api/")) {
      return jsonResponse({ status: false, message: "Endpoint API tidak ditemukan" }, 404);
    }

    // Static assets & SPA fallback
    return await handleStaticFile(pathname);
  },

  websocket: createNobarWebSocketHandlers(() => serverInstance),
});

console.log(`[Pixuplay Server] 🚀 Pixuplay Backend is live at http://localhost:${PORT}`);
console.log(`[Pixuplay Server] 📡 Clean Modular Architecture (Port ${PORT})`);

export default serverInstance;
