import crypto from "crypto";
import { db } from "../db/connection";
import { GOOGLE_CLIENT_ID } from "../config/env";
import {
  hashSensitive,
  encryptSensitive,
  decryptSensitive,
  maskEmail,
  calculateLevelData,
  sanitizeText,
  sanitizeSafeUrl,
  LevelInfo,
} from "../security/crypto";

export interface SessionUser {
  id: string;
  email: string;
  maskedEmail: string;
  name: string;
  avatar: string;
  tagId: number;
  watchTimeSeconds: number;
  exp: number;
  level: number;
  currentLevelExp: number;
  nextLevelExp: number;
  progressPercent: number;
}

export function getSessionUser(req: Request): SessionUser | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const session = db
      .query(`
      SELECT s.token, s.expires_at, u.id, u.email, u.email_encrypted, u.name, u.avatar, u.tag_id, u.watch_time_seconds, u.exp, u.level
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `)
      .get(token) as any;
    if (!session) return null;

    let realEmail = session.email;
    if (session.email_encrypted) {
      realEmail = decryptSensitive(session.email_encrypted);
    }
    const levelInfo: LevelInfo = calculateLevelData(session.exp || 0);

    return {
      id: session.id,
      email: realEmail,
      maskedEmail: maskEmail(realEmail),
      name: session.name,
      avatar: session.avatar,
      tagId: session.tag_id || 1,
      watchTimeSeconds: session.watch_time_seconds || 0,
      exp: session.exp || 0,
      level: levelInfo.level,
      currentLevelExp: levelInfo.currentLevelExp,
      nextLevelExp: levelInfo.nextLevelExp,
      progressPercent: levelInfo.progressPercent,
    };
  } catch {
    return null;
  }
}

export async function loginWithGoogle(credential: string): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
  try {
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!googleRes.ok) {
      return { success: false, error: "Kredensial Google tidak valid atau kedaluwarsa", status: 401 };
    }

    const payload: any = await googleRes.json();
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      return { success: false, error: "ID Klien aplikasi tidak sesuai", status: 403 };
    }

    const googleId = String(payload.sub || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const name = sanitizeText(String(payload.name || email.split("@")[0] || "Pengguna Pixuplay"), 50);
    const avatar = String(payload.picture || "").trim();

    if (!googleId || !email) {
      return { success: false, error: "Data profil Google tidak lengkap", status: 400 };
    }

    const eHash = hashSensitive(email);
    const eEnc = encryptSensitive(email);
    const masked = maskEmail(email);
    const isSupport = email === "pixuplay.support@gmail.com";

    const existingUser = db
      .query("SELECT * FROM users WHERE google_id = ? OR email_hash = ?")
      .get(googleId, eHash) as any;

    let userId = existingUser ? existingUser.id : `usr_${crypto.randomUUID().replace(/-/g, "").substring(0, 16)}`;
    let finalName = existingUser ? existingUser.name : name;
    let tagId = existingUser?.tag_id;

    if (!existingUser) {
      if (isSupport) {
        tagId = 1;
      } else {
        const maxTagRow = db.query("SELECT MAX(tag_id) as maxTag FROM users").get() as any;
        tagId = Math.max(1, maxTagRow?.maxTag || 1) + 1;
      }

      const nameTaken = db.query("SELECT id FROM users WHERE LOWER(name) = LOWER(?)").get(finalName);
      if (nameTaken) {
        finalName = `${finalName} #${tagId}`;
      }

      db.query(`
        INSERT INTO users (id, google_id, email, email_hash, email_encrypted, name, avatar, tag_id, watch_time_seconds, exp, level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1)
      `).run(userId, googleId, masked, eHash, eEnc, finalName, avatar, tagId);
    } else {
      if (!tagId) {
        tagId = isSupport ? 1 : Math.max(1, (db.query("SELECT MAX(tag_id) as maxTag FROM users").get() as any)?.maxTag || 1) + 1;
      }
      db.query(`
        UPDATE users SET
          email = ?,
          email_hash = ?,
          email_encrypted = ?,
          tag_id = ?,
          avatar = ?,
          last_login = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(masked, eHash, eEnc, tagId, existingUser.avatar || avatar, userId);
    }

    // Generate session token (valid for 30 days)
    const sessionToken = `pxs_${crypto.randomBytes(32).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.query(`
      INSERT INTO user_sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(sessionToken, userId, expiresAt);

    // Fetch updated user record
    const userRow = db.query("SELECT * FROM users WHERE id = ?").get(userId) as any;
    const levelInfo = calculateLevelData(userRow.exp || 0);

    return {
      success: true,
      data: {
        token: sessionToken,
        expiresAt,
        user: {
          id: userRow.id,
          name: userRow.name,
          email: email,
          maskedEmail: masked,
          avatar: userRow.avatar,
          tagId: userRow.tag_id,
          watchTimeSeconds: userRow.watch_time_seconds || 0,
          exp: userRow.exp || 0,
          level: levelInfo.level,
          currentLevelExp: levelInfo.currentLevelExp,
          nextLevelExp: levelInfo.nextLevelExp,
          progressPercent: levelInfo.progressPercent,
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal memproses login Google", status: 500 };
  }
}

export function logoutUser(token: string): void {
  try {
    db.query("DELETE FROM user_sessions WHERE token = ?").run(token);
  } catch {}
}

export function updateProfile(
  userId: string,
  name?: string,
  avatar?: string
): { success: boolean; error?: string; user?: any } {
  const user = db.query("SELECT * FROM users WHERE id = ?").get(userId) as any;
  if (!user) return { success: false, error: "Pengguna tidak ditemukan" };

  let updatedName = user.name;
  if (name && typeof name === "string") {
    const cleanName = sanitizeText(name, 30);
    if (cleanName.length >= 2) {
      const isTaken = db
        .query("SELECT id FROM users WHERE LOWER(name) = LOWER(?) AND id != ?")
        .get(cleanName, userId);
      if (isTaken) {
        return { success: false, error: "Nama pengguna sudah digunakan akun lain" };
      }
      updatedName = cleanName;
    }
  }

  let updatedAvatar = user.avatar;
  if (avatar && typeof avatar === "string") {
    const safeAvatar = sanitizeSafeUrl(avatar);
    if (safeAvatar) {
      updatedAvatar = safeAvatar;
    }
  }

  db.query(`
    UPDATE users SET
      name = ?,
      avatar = ?
    WHERE id = ?
  `).run(updatedName, updatedAvatar, userId);

  const updatedUser = db.query("SELECT * FROM users WHERE id = ?").get(userId) as any;
  const levelInfo = calculateLevelData(updatedUser.exp || 0);

  return {
    success: true,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      avatar: updatedUser.avatar,
      tagId: updatedUser.tag_id,
      watchTimeSeconds: updatedUser.watch_time_seconds || 0,
      exp: updatedUser.exp || 0,
      level: levelInfo.level,
      currentLevelExp: levelInfo.currentLevelExp,
      nextLevelExp: levelInfo.nextLevelExp,
      progressPercent: levelInfo.progressPercent,
    },
  };
}

export function deleteAccount(userId: string): boolean {
  try {
    db.query("DELETE FROM users WHERE id = ?").run(userId);
    return true;
  } catch {
    return false;
  }
}
