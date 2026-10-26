import { db } from "../db/connection";
import { calculateLevelData, sanitizeText } from "../security/crypto";

export function getUserSyncData(userId: string): { history: any[]; favorites: any[]; watchlist: any[] } {
  const syncRow = db.query("SELECT * FROM user_sync WHERE user_id = ?").get(userId) as any;
  let history: any[] = [];
  let favorites: any[] = [];
  let watchlist: any[] = [];

  if (syncRow) {
    try { history = JSON.parse(syncRow.history_json || "[]"); } catch {}
    try { favorites = JSON.parse(syncRow.favorites_json || "[]"); } catch {}
    try { watchlist = JSON.parse(syncRow.watchlist_json || "[]"); } catch {}
  }

  return { history, favorites, watchlist };
}

export function saveUserSyncData(
  userId: string,
  history?: any[],
  favorites?: any[],
  watchlist?: any[]
): { success: boolean; error?: string } {
  try {
    const current = getUserSyncData(userId);
    const newHistory = Array.isArray(history) ? history.slice(0, 500) : current.history;
    const newFavorites = Array.isArray(favorites) ? favorites.slice(0, 500) : current.favorites;
    const newWatchlist = Array.isArray(watchlist) ? watchlist.slice(0, 500) : current.watchlist;

    db.query(`
      INSERT INTO user_sync (user_id, history_json, favorites_json, watchlist_json, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        history_json = excluded.history_json,
        favorites_json = excluded.favorites_json,
        watchlist_json = excluded.watchlist_json,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, JSON.stringify(newHistory), JSON.stringify(newFavorites), JSON.stringify(newWatchlist));

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function recordWatchHeartbeat(
  userId: string,
  seconds: number,
  isRewatch: boolean = false
): { success: boolean; user?: any; error?: string } {
  try {
    const cleanSeconds = Math.max(1, Math.min(60, Number(seconds) || 15));
    const row = db.query("SELECT watch_time_seconds, exp FROM users WHERE id = ?").get(userId) as any;
    if (!row) return { success: false, error: "User tidak ditemukan" };

    const currentSec = Number(row?.watch_time_seconds) || 0;
    const currentExp = Number(row?.exp) || 0;

    const newSec = currentSec + cleanSeconds;
    const expGained = Math.round(cleanSeconds * (10 / 60)) + (isRewatch ? 25 : 0);
    const newExp = currentExp + expGained;

    const levelInfo = calculateLevelData(newExp);

    db.query("UPDATE users SET watch_time_seconds = ?, exp = ?, level = ? WHERE id = ?").run(
      newSec,
      newExp,
      levelInfo.level,
      userId
    );

    return {
      success: true,
      user: {
        watchTimeSeconds: newSec,
        exp: newExp,
        level: levelInfo.level,
        currentLevelExp: levelInfo.currentLevelExp,
        nextLevelExp: levelInfo.nextLevelExp,
        progressPercent: levelInfo.progressPercent,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function changeUserName(
  userId: string,
  rawName: string
): { success: boolean; name?: string; error?: string; status?: number } {
  const requestedName = sanitizeText(String(rawName || ""), 30).trim();
  if (requestedName.length < 2 || requestedName.length > 30) {
    return { success: false, error: "Nama tampilan harus terdiri dari 2 hingga 30 karakter.", status: 400 };
  }

  const duplicate = db
    .query("SELECT id FROM users WHERE LOWER(name) = LOWER(?) AND id != ?")
    .get(requestedName, userId);
  if (duplicate) {
    return {
      success: false,
      error: "Nama tampilan tersebut sudah digunakan oleh pengguna lain. Silakan pilih nama lain.",
      status: 409,
    };
  }

  db.query("UPDATE users SET name = ? WHERE id = ?").run(requestedName, userId);
  db.query("UPDATE comments SET user_name = ? WHERE user_id = ?").run(requestedName, userId);

  return { success: true, name: requestedName };
}

export function updateUserAvatar(userId: string, avatarUrl: string): { success: boolean; avatar?: string; error?: string } {
  try {
    db.query("UPDATE users SET avatar = ? WHERE id = ?").run(avatarUrl, userId);
    return { success: true, avatar: avatarUrl };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
