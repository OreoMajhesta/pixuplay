import { sanitizeSlug, sanitizeText, sanitizeSafeUrl } from "../security/crypto";

export interface NobarWebSocketData {
  roomId: string;
  name: string;
  avatar: string;
  role: string;
}

export interface NobarRoom {
  id: string;
  animeId: string;
  animeTitle: string;
  episode: number;
  serverUrl: string;
  serverType: string;
  hostId: string;
  hostName: string;
  currentTime: number;
  isPlaying: boolean;
  lastUpdate: number;
  chat: Array<{ sender: string; text: string; time: string; isHost?: boolean }>;
}

export const NOBAR_ROOMS = new Map<string, NobarRoom>();

// Clean up expired rooms older than 24 hours
export function cleanupExpiredRooms() {
  const now = Date.now();
  const EXPIRY_MS = 24 * 60 * 60 * 1000;
  for (const [id, room] of NOBAR_ROOMS.entries()) {
    if (now - room.lastUpdate > EXPIRY_MS) {
      NOBAR_ROOMS.delete(id);
    }
  }
}
setInterval(cleanupExpiredRooms, 30 * 60 * 1000);

export function createNobarWebSocketHandlers(serverGetter: () => any) {
  return {
    open(ws: any) {
      const server = serverGetter();
      const d = ws.data as any;
      ws.subscribe(d.roomId);
      const room = NOBAR_ROOMS.get(d.roomId);
      if (room) {
        const elapsed = room.isPlaying ? (Date.now() - room.lastUpdate) / 1000 : 0;
        ws.send(
          JSON.stringify({
            type: "room_state",
            room: {
              ...room,
              currentTime: room.currentTime + elapsed,
            },
          })
        );
      }
      if (server) {
        server.publish(
          d.roomId,
          JSON.stringify({
            type: "user_joined",
            name: d.name,
            role: d.role,
            time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          })
        );
      }
    },

    message(ws: any, rawMsg: any) {
      try {
        const server = serverGetter();
        const msg = JSON.parse(String(rawMsg));
        const d = ws.data as any;
        const rawRoomId = msg.roomId || d.roomId;
        const roomId = sanitizeSlug(rawRoomId, 64);
        const room = NOBAR_ROOMS.get(roomId);

        if (msg.type === "sync") {
          if (room) {
            if (typeof msg.currentTime === "number" && !isNaN(msg.currentTime) && msg.currentTime >= 0) {
              room.currentTime = msg.currentTime;
            }
            if (typeof msg.isPlaying === "boolean") {
              room.isPlaying = msg.isPlaying;
            }
            if (msg.episode) {
              room.episode = Math.max(1, Math.min(5000, parseInt(String(msg.episode), 10) || room.episode));
            }
            if (typeof msg.serverUrl === "string") {
              room.serverUrl = msg.serverUrl.trim().slice(0, 1000);
            }
            if (typeof msg.animeId === "string" && msg.animeId.trim()) {
              room.animeId = sanitizeSlug(msg.animeId, 100);
            }
            if (typeof msg.animeTitle === "string" && msg.animeTitle.trim()) {
              room.animeTitle = sanitizeText(msg.animeTitle, 150);
            }
            room.lastUpdate = Date.now();
          }
          ws.publish(
            roomId,
            JSON.stringify({
              type: "sync",
              currentTime: typeof msg.currentTime === "number" ? msg.currentTime : room?.currentTime || 0,
              isPlaying: typeof msg.isPlaying === "boolean" ? msg.isPlaying : room?.isPlaying || true,
              episode: msg.episode || room?.episode || 1,
              serverUrl: msg.serverUrl || room?.serverUrl || "",
              animeId: msg.animeId || room?.animeId || "",
              animeTitle: msg.animeTitle || room?.animeTitle || "",
              hostName: d.name,
              timestamp: Date.now(),
            })
          );
        } else if (msg.type === "disband") {
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
        } else if (msg.type === "chat") {
          const cleanText = sanitizeText(msg.text, 300);
          if (cleanText) {
            const chatItem = {
              sender: sanitizeText(d.name || msg.sender || "Penonton", 30) || "Penonton",
              avatar: sanitizeSafeUrl(msg.avatar || d.avatar) || null,
              text: cleanText,
              isHost: d.role === "host",
              time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
            };
            if (room) {
              room.chat = [...(room.chat || []).slice(-50), chatItem];
            }
            if (server) {
              server.publish(
                roomId,
                JSON.stringify({
                  type: "chat",
                  ...chatItem,
                })
              );
            }
          }
        } else if (msg.type === "reaction") {
          const emoji = sanitizeText(msg.emoji, 10);
          if (emoji && server) {
            server.publish(
              roomId,
              JSON.stringify({
                type: "reaction",
                emoji: emoji,
                sender: d.name,
              })
            );
          }
        }
      } catch (err) {
        console.warn("WS message parse error:", err);
      }
    },

    close(ws: any) {
      const server = serverGetter();
      const d = ws.data as any;
      ws.unsubscribe(d.roomId);
      if (server) {
        server.publish(
          d.roomId,
          JSON.stringify({
            type: "user_left",
            name: d.name,
          })
        );
      }
    },
  };
}
