import { getInteractions, toggleLike, addComment, deleteComment } from "../services/interactionService";
import { jsonResponse, parseJsonBody, isRateLimited } from "../security/rateLimiter";
import { getSessionUser } from "../services/authService";
import { sanitizeSlug } from "../security/crypto";

export async function handleInteractionRoutes(req: Request, url: URL, clientIp: string): Promise<Response | null> {
  const { pathname } = url;

  // 1. Get interactions (Likes & Threaded comments)
  if (pathname === "/api/pixuplay/interactions" && req.method === "GET") {
    const animeId = url.searchParams.get("animeId") || "";
    const ep = parseInt(url.searchParams.get("episode") || "1", 10) || 1;
    const userId = url.searchParams.get("userId") || undefined;

    if (!animeId) {
      return jsonResponse({ status: false, message: "animeId diperlukan" }, 400);
    }

    const data = getInteractions(animeId, ep, userId);
    return jsonResponse(data);
  }

  // 2. Toggle Like
  if (pathname === "/api/pixuplay/likes" && req.method === "POST") {
    if (isRateLimited(`like_${clientIp}`, 30, 60000)) {
      return jsonResponse({ status: false, message: "Terlalu banyak permintaan suka. Tunggu sebentar." }, 429);
    }

    const { data: body, error: bodyError } = await parseJsonBody(req, 4096);
    if (bodyError || !body) {
      return jsonResponse({ status: false, message: bodyError || "Data tidak valid" }, 400);
    }

    const animeId = sanitizeSlug(body.animeId || "");
    const episode = parseInt(String(body.episode || "1"), 10) || 1;
    const user = getSessionUser(req);
    const userId = user?.id || sanitizeSlug(body.userId || "");

    if (!animeId || !userId) {
      return jsonResponse({ status: false, message: "animeId dan userId diperlukan" }, 400);
    }

    const result = toggleLike(animeId, episode, userId);
    return jsonResponse(result);
  }

  // 3. Post Comment
  if (pathname === "/api/pixuplay/comments" && req.method === "POST") {
    if (isRateLimited(`comment_${clientIp}`, 12, 60000)) {
      return jsonResponse({ status: false, message: "Komentar terlalu cepat. Silakan tunggu 1 menit." }, 429, {
        "Retry-After": "60",
      });
    }

    const { data: body, error: bodyError } = await parseJsonBody(req, 32768);
    if (bodyError || !body) {
      return jsonResponse({ status: false, message: bodyError || "Data komentar tidak valid" }, 400);
    }

    const animeId = sanitizeSlug(body.animeId || "");
    const episode = parseInt(String(body.episode || "1"), 10) || 1;
    const user = getSessionUser(req);

    const userId = user?.id || sanitizeSlug(body.userId || "") || `guest_${clientIp.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
    const userName = user?.name || body.userName || "Guest";
    const userAvatar = user?.avatar || body.userAvatar || "";
    const text = String(body.text || "").trim();
    const parentId = body.parentId ? parseInt(String(body.parentId), 10) : undefined;
    const replyToUser = body.replyToUser ? String(body.replyToUser) : undefined;

    if (!animeId || !text) {
      return jsonResponse({ status: false, message: "animeId dan teks komentar diperlukan" }, 400);
    }

    const result = addComment(animeId, episode, userId, userName, userAvatar, text, parentId, replyToUser);
    return jsonResponse(result, result.status ? 200 : 400);
  }

  // 4. Delete Comment
  if (pathname === "/api/pixuplay/comments" && req.method === "DELETE") {
    const user = getSessionUser(req);
    if (!user) {
      return jsonResponse({ status: false, message: "Login diperlukan untuk menghapus komentar" }, 401);
    }

    const { data: body } = await parseJsonBody(req, 2048);
    const commentId = parseInt(String(body?.commentId || url.searchParams.get("id")), 10);
    if (!commentId) {
      return jsonResponse({ status: false, message: "ID komentar tidak valid" }, 400);
    }

    const success = deleteComment(commentId, user.id);
    if (!success) {
      return jsonResponse({ status: false, message: "Komentar tidak ditemukan atau Anda bukan pemilik komentar ini" }, 403);
    }

    return jsonResponse({ status: true, message: "Komentar berhasil dihapus" });
  }

  return null;
}
