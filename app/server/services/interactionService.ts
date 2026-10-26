import { db } from "../db/connection";
import { sanitizeSlug, sanitizeText, sanitizeSafeUrl } from "../security/crypto";

export function formatRelativeTime(dateString: string): string {
  try {
    const cleanDate =
      dateString.includes("T") || dateString.includes("Z")
        ? dateString
        : dateString.replace(" ", "T") + "Z";
    const past = new Date(cleanDate).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - past) / 1000));
    if (diffSec < 45) return "Baru saja";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} hari lalu`;
    return new Date(past).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Baru saja";
  }
}

export function getInteractions(
  rawAnimeId: string,
  rawEpisode: number,
  rawUserId?: string
): {
  status: boolean;
  animeId: string;
  episode: number;
  likesCount: number;
  hasLiked: boolean;
  comments: any[];
} {
  const animeId = sanitizeSlug(rawAnimeId || "", 100);
  const ep = Math.max(1, Math.min(5000, rawEpisode || 1));
  const userId = sanitizeSlug(rawUserId || "", 64);

  const likeRow = db
    .query("SELECT COUNT(*) as count FROM likes WHERE anime_id = ? AND episode = ?")
    .get(animeId, ep) as { count: number } | null;
  const likesCount = likeRow?.count || 0;

  let hasLiked = false;
  if (userId) {
    const userLike = db
      .query("SELECT id FROM likes WHERE anime_id = ? AND episode = ? AND user_id = ? LIMIT 1")
      .get(animeId, ep, userId);
    hasLiked = !!userLike;
  }

  const allRows = db
    .query(
      "SELECT id, anime_id, episode, parent_id, reply_to_user, user_id, user_name, user_avatar, text, created_at FROM comments WHERE anime_id = ? AND episode = ? ORDER BY id ASC LIMIT 300"
    )
    .all(animeId, ep) as any[];

  const commentMap = new Map<number, any>();
  const topLevelComments: any[] = [];

  for (const r of allRows) {
    const item = {
      id: r.id,
      userId: r.user_id,
      parentId: r.parent_id || null,
      replyToUser: r.reply_to_user || null,
      user: r.user_name || "Guest",
      avatar: r.user_avatar || "",
      text: r.text || "",
      createdAt: r.created_at,
      time: formatRelativeTime(r.created_at),
      replies: [],
    };
    commentMap.set(r.id, item);
  }

  for (const r of allRows) {
    const item = commentMap.get(r.id);
    if (r.parent_id && commentMap.has(r.parent_id)) {
      commentMap.get(r.parent_id).replies.push(item);
    } else {
      topLevelComments.push(item);
    }
  }

  topLevelComments.reverse();

  return {
    status: true,
    animeId,
    episode: ep,
    likesCount,
    hasLiked,
    comments: topLevelComments,
  };
}

export function toggleLike(
  rawAnimeId: string,
  rawEpisode: number,
  rawUserId: string
): { status: boolean; hasLiked: boolean; likesCount: number; message: string } {
  const animeId = sanitizeSlug(rawAnimeId || "", 100);
  const episode = Math.max(1, Math.min(5000, rawEpisode || 1));
  const userId = sanitizeSlug(rawUserId || "", 64);

  const existing = db
    .query("SELECT id FROM likes WHERE anime_id = ? AND episode = ? AND user_id = ? LIMIT 1")
    .get(animeId, episode, userId);

  let hasLiked = false;
  if (existing) {
    db.query("DELETE FROM likes WHERE anime_id = ? AND episode = ? AND user_id = ?").run(animeId, episode, userId);
    hasLiked = false;
  } else {
    db.query("INSERT INTO likes (anime_id, episode, user_id) VALUES (?, ?, ?)").run(animeId, episode, userId);
    hasLiked = true;
  }

  const likeRow = db
    .query("SELECT COUNT(*) as count FROM likes WHERE anime_id = ? AND episode = ?")
    .get(animeId, episode) as { count: number } | null;
  const likesCount = likeRow?.count || 0;

  return {
    status: true,
    hasLiked,
    likesCount,
    message: hasLiked ? "Disukai" : "Batal suka",
  };
}

export function addComment(
  rawAnimeId: string,
  rawEpisode: number,
  rawUserId: string,
  rawUserName: string,
  rawUserAvatar: string,
  rawText: string,
  parentId?: number,
  replyToUser?: string
): { status: boolean; comment?: any; error?: string } {
  const animeId = sanitizeSlug(rawAnimeId || "", 100);
  const episode = Math.max(1, Math.min(5000, rawEpisode || 1));
  const userId = sanitizeSlug(rawUserId || "", 64);
  const userName = sanitizeText(rawUserName || "Guest", 50);
  const userAvatar = sanitizeSafeUrl(rawUserAvatar || "");
  const text = sanitizeText(rawText || "", 800);

  if (!text) {
    return { status: false, error: "Isi komentar tidak boleh kosong" };
  }

  let validParentId: number | null = null;
  let validReplyTo: string | null = null;
  if (parentId) {
    const parentRow = db
      .query("SELECT id, user_name FROM comments WHERE id = ? AND anime_id = ?")
      .get(parentId, animeId) as any;
    if (parentRow) {
      validParentId = parentRow.id;
      validReplyTo = sanitizeText(replyToUser || parentRow.user_name || "", 50);
    }
  }

  const result = db
    .query(`
    INSERT INTO comments (anime_id, episode, parent_id, reply_to_user, user_id, user_name, user_avatar, text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .run(animeId, episode, validParentId, validReplyTo, userId, userName, userAvatar, text);

  const newId = Number(result.lastInsertRowid);
  const comment = {
    id: newId,
    userId,
    parentId: validParentId,
    replyToUser: validReplyTo,
    user: userName,
    avatar: userAvatar,
    text,
    createdAt: new Date().toISOString(),
    time: "Baru saja",
    replies: [],
  };

  return { status: true, comment };
}

export function deleteComment(commentId: number, userId: string, authUserId?: string): boolean {
  try {
    const row = db.query("SELECT id, user_id FROM comments WHERE id = ?").get(commentId) as any;
    if (!row) return false;
    const isOwner =
      (userId && String(row.user_id) === String(userId)) ||
      (authUserId && String(row.user_id) === String(authUserId));
    if (!isOwner) return false;

    db.query("DELETE FROM comments WHERE id = ? OR parent_id = ?").run(commentId, commentId);
    return true;
  } catch {
    return false;
  }
}
