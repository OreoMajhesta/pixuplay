import { db } from "./connection";
import { hashSensitive, encryptSensitive, decryptSensitive, maskEmail } from "../security/crypto";

export function initDatabase() {
  // 1. Comments table & indexes
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id TEXT NOT NULL,
      episode INTEGER NOT NULL DEFAULT 1,
      parent_id INTEGER DEFAULT NULL,
      reply_to_user TEXT DEFAULT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_avatar TEXT,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  try { db.run("ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL;"); } catch {}
  try { db.run("ALTER TABLE comments ADD COLUMN reply_to_user TEXT DEFAULT NULL;"); } catch {}
  db.run(`CREATE INDEX IF NOT EXISTS idx_comments_anime_ep ON comments (anime_id, episode);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);`);

  // 2. Likes table & indexes
  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id TEXT NOT NULL,
      episode INTEGER NOT NULL DEFAULT 1,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(anime_id, episode, user_id)
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_likes_anime_ep ON likes (anime_id, episode);`);

  // 3. Users table & indexes
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      email_hash TEXT,
      email_encrypted TEXT,
      name TEXT NOT NULL,
      avatar TEXT,
      tag_id INTEGER,
      watch_time_seconds INTEGER NOT NULL DEFAULT 0,
      exp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  try { db.run("ALTER TABLE users ADD COLUMN email_hash TEXT;"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN email_encrypted TEXT;"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN tag_id INTEGER;"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN watch_time_seconds INTEGER NOT NULL DEFAULT 0;"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN exp INTEGER NOT NULL DEFAULT 0;"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN level INTEGER NOT NULL DEFAULT 1;"); } catch {}
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users (email_hash);`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tag_id ON users (tag_id);`);

  // 4. User Sessions table & indexes
  db.run(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (token);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at);`);

  // 5. User Sync table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_sync (
      user_id TEXT PRIMARY KEY,
      history_json TEXT NOT NULL DEFAULT '[]',
      favorites_json TEXT NOT NULL DEFAULT '[]',
      watchlist_json TEXT NOT NULL DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Run data migrations
  try {
    const allExistingUsers = db.query("SELECT * FROM users").all() as any[];
    for (const u of allExistingUsers) {
      let plainEmail = u.email;
      if (u.email_encrypted) {
        plainEmail = decryptSensitive(u.email_encrypted);
      }
      const isSupport = plainEmail.toLowerCase() === "pixuplay.support@gmail.com";
      if (isSupport && u.tag_id !== 1) {
        db.query("UPDATE users SET tag_id = NULL WHERE tag_id = 1 AND id != ?").run(u.id);
        db.query("UPDATE users SET tag_id = 1 WHERE id = ?").run(u.id);
      }
      if (!u.email_hash || !u.email_encrypted) {
        const eHash = hashSensitive(plainEmail);
        const eEnc = encryptSensitive(plainEmail);
        const masked = maskEmail(plainEmail);
        db.query("UPDATE users SET email_hash = ?, email_encrypted = ?, email = ? WHERE id = ?").run(eHash, eEnc, masked, u.id);
      }
    }

    const unassigned = db.query("SELECT * FROM users WHERE tag_id IS NULL ORDER BY created_at ASC").all() as any[];
    let maxTagRow = db.query("SELECT MAX(tag_id) as maxTag FROM users").get() as any;
    let nextTagNum = Math.max(1, maxTagRow?.maxTag || 1) + 1;
    for (const u of unassigned) {
      db.query("UPDATE users SET tag_id = ? WHERE id = ?").run(nextTagNum++, u.id);
    }
  } catch (e) {
    console.warn("[Users DB Migration]", e);
  }
}
