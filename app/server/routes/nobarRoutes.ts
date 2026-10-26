import { NOBAR_ROOMS, NobarRoom, cleanupExpiredRooms } from "../websocket/nobarWebSocket";
import { jsonResponse, parseJsonBody, isRateLimited } from "../security/rateLimiter";
import { sanitizeSlug, sanitizeText, sanitizeSafeUrl } from "../security/crypto";

export async function handleNobarRoutes(
  req: Request,
  url: URL,
  clientIp: string,
  serverGetter: () => any
): Promise<Response | null> {
  const { pathname } = url;
  const server = serverGetter();

  // 1. Create Watch Party Room
  if (pathname === "/api/pixuplay/nobar/create" && req.method === "POST") {
    if (isRateLimited(`nobar_create_${clientIp}`, 10, 60000)) {
      return jsonResponse({ status: false, message: "Terlalu banyak permintaan pembuatan room. Tunggu 1 menit." }, 429);
    }

    const { data: body, error: bodyError } = await parseJsonBody(req, 16384);
    if (bodyError || !body) {
      return jsonResponse({ status: false, message: bodyError || "Request body tidak valid" }, 400);
    }

    // Memory safeguard: purge old rooms if count exceeds limit
    if (NOBAR_ROOMS.size >= 500) {
      cleanupExpiredRooms();
      if (NOBAR_ROOMS.size >= 500) {
        const keys = Array.from(NOBAR_ROOMS.keys()).slice(0, 50);
        for (const k of keys) NOBAR_ROOMS.delete(k);
      }
    }

    const roomId = `nobar-${Math.random().toString(36).substring(2, 8)}`;
    const hostId = `host-${Math.random().toString(36).substring(2, 8)}`;
    const hostName = sanitizeText(body.hostName || "Host", 30) || "Host";
    const animeTitle = sanitizeText(body.animeTitle || "Anime", 150) || "Anime";
    const episode = Math.max(1, Math.min(5000, parseInt(String(body.episode || "1"), 10) || 1));
    const animeId = sanitizeSlug(body.animeId || "", 100);
    const serverType = body.serverType === "embed" ? "embed" : "direct";
    const serverUrl = typeof body.serverUrl === "string" ? body.serverUrl.trim().slice(0, 1000) : "";

    const newRoom: NobarRoom = {
      id: roomId,
      animeId,
      animeTitle,
      episode,
      serverUrl,
      serverType,
      hostId,
      hostName,
      currentTime: 0,
      isPlaying: true,
      lastUpdate: Date.now(),
      chat: [
        {
          sender: "Sistem",
          text: `Room Nobar berhasil dibuat oleh ${hostName}. Bagikan link ke teman untuk menonton bersama secara realtime!`,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ],
    };

    NOBAR_ROOMS.set(roomId, newRoom);

    return jsonResponse({
      status: true,
      roomId,
      hostId,
      room: newRoom,
    });
  }

  // 2. Room State & Sub-actions (Sync, Disband, Chat)
  if (pathname.startsWith("/api/pixuplay/nobar/room/")) {
    const parts = pathname.replace("/api/pixuplay/nobar/room/", "").split("/");
    const rawRoomId = parts[0] || "";
    const roomId = sanitizeSlug(rawRoomId, 64);
    const subAction = parts[1];
    const room = NOBAR_ROOMS.get(roomId);

    if (!room) {
      return jsonResponse({ status: false, message: "Room Nobar tidak ditemukan atau telah berakhir" }, 404);
    }

    // Sync endpoint (HTTP fallback)
    if (subAction === "sync" && req.method === "POST") {
      const { data: body, error: bodyError } = await parseJsonBody(req, 16384);
      if (bodyError || !body) {
        return jsonResponse({ status: false, message: bodyError || "Data tidak valid" }, 400);
      }

      if (typeof body.currentTime === "number" && !isNaN(body.currentTime) && body.currentTime >= 0) {
        room.currentTime = body.currentTime;
      }
      if (typeof body.isPlaying === "boolean") {
        room.isPlaying = body.isPlaying;
      }
      if (body.episode) {
        room.episode = Math.max(1, Math.min(5000, parseInt(String(body.episode), 10) || room.episode));
      }
      if (typeof body.serverUrl === "string") {
        room.serverUrl = body.serverUrl.trim().slice(0, 1000);
      }
      if (typeof body.animeId === "string" && body.animeId.trim()) {
        room.animeId = sanitizeSlug(body.animeId, 100);
      }
      if (typeof body.animeTitle === "string" && body.animeTitle.trim()) {
        room.animeTitle = sanitizeText(body.animeTitle, 150);
      }
      room.lastUpdate = Date.now();

      if (server) {
        server.publish(
          roomId,
          JSON.stringify({
            type: "sync",
            currentTime: room.currentTime,
            isPlaying: room.isPlaying,
            episode: room.episode,
            serverUrl: room.serverUrl,
            animeId: room.animeId,
            animeTitle: room.animeTitle,
            hostName: room.hostName,
            timestamp: room.lastUpdate,
          })
        );
      }

      return jsonResponse({ status: true, room });
    }

    // Disband room endpoint (by host)
    if (subAction === "disband" && req.method === "POST") {
      if (server) {
        server.publish(
          roomId,
          JSON.stringify({
            type: "room_disbanded",
            message: "Room nobar telah dibubarkan oleh host.",
          })
        );
      }
      NOBAR_ROOMS.delete(roomId);
      return jsonResponse({ status: true, message: "Room berhasil dibubarkan" });
    }

    // Chat endpoint (HTTP fallback)
    if (subAction === "chat" && req.method === "POST") {
      if (isRateLimited(`nobar_chat_${clientIp}`, 30, 60000)) {
        return jsonResponse({ status: false, message: "Pesan dikirim terlalu cepat." }, 429);
      }

      const { data: body, error: bodyError } = await parseJsonBody(req, 8192);
      if (bodyError || !body) {
        return jsonResponse({ status: false, message: bodyError || "Data tidak valid" }, 400);
      }

      const cleanText = sanitizeText(body.text, 300);
      if (!cleanText) {
        return jsonResponse({ status: false, message: "Pesan tidak boleh kosong" }, 400);
      }

      const chatItem = {
        sender: sanitizeText(body.sender || "Penonton", 30) || "Penonton",
        avatar: sanitizeSafeUrl(body.avatar) || null,
        text: cleanText,
        isHost: !!body.isHost,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      };
      room.chat = [...(room.chat || []).slice(-50), chatItem];

      if (server) {
        server.publish(
          roomId,
          JSON.stringify({
            type: "chat",
            ...chatItem,
          })
        );
      }

      return jsonResponse({ status: true, chat: room.chat });
    }

    // Get Room State (GET)
    const elapsed = room.isPlaying ? (Date.now() - room.lastUpdate) / 1000 : 0;
    return jsonResponse({
      status: true,
      room: {
        ...room,
        currentTime: room.currentTime + elapsed,
      },
    });
  }

  return null;
}
