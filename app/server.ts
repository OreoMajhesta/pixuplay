import Bun, { serve } from "bun";
import { join } from "path";
import fs from "fs";
import { Database } from "bun:sqlite";
import crypto from "crypto";

const PORT = parseInt(process.env.PORT || "15006", 10);
const BASE_DIR = import.meta.dir;
const WAJIK_API = `http://localhost:${PORT}`; // Unified under Pixuplay backend (Port 15006)

// ============================================================
// SECURITY HELPERS: HASH & SALT + AES-256-GCM FOR SENSITIVE DATA
// ============================================================
const APP_SALT = process.env.APP_SALT || "pixuplay_master_salt_key_2026_x89f";
const CIPHER_KEY = crypto.createHash("sha256").update(process.env.APP_CIPHER_SECRET || "pixuplay_cipher_secret_32bytes_key!").digest();

function hashSensitive(val: string): string {
  return crypto.createHmac("sha256", APP_SALT).update(String(val).toLowerCase().trim()).digest("hex");
}

function encryptSensitive(text: string): string {
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", CIPHER_KEY, iv);
    const enc = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64");
  } catch {
    return text;
  }
}

function decryptSensitive(ciphertext: string): string {
  try {
    const buf = Buffer.from(ciphertext, "base64");
    if (buf.length < 28) return ciphertext;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", CIPHER_KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final("utf8");
  } catch {
    return ciphertext;
  }
}

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

export function calculateLevelData(exp: number) {
  let level = 1;
  let expForCurrentLevel = 0;
  while (true) {
    const expNeeded = level * 150;
    if (exp < expForCurrentLevel + expNeeded) {
      const currentLevelExp = exp - expForCurrentLevel;
      const nextLevelExp = expNeeded;
      const percent = Math.min(100, Math.floor((currentLevelExp / nextLevelExp) * 100));
      return {
        level,
        exp,
        currentLevelExp,
        nextLevelExp,
        progressPercent: percent,
      };
    }
    expForCurrentLevel += expNeeded;
    level++;
  }
}

// ============================================================
// SQLITE DATABASE (DYNAMIC COMMENTS & LIKES IN WAL MODE)
// ============================================================
const DB_PATH = join(BASE_DIR, "pixuplay.db");
const db = new Database(DB_PATH, { create: true });
db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA synchronous = NORMAL;");
db.run("PRAGMA busy_timeout = 5000;");

// Initialize tables
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
try {
  db.run("ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL;");
} catch {}
try {
  db.run("ALTER TABLE comments ADD COLUMN reply_to_user TEXT DEFAULT NULL;");
} catch {}
db.run(`CREATE INDEX IF NOT EXISTS idx_comments_anime_ep ON comments (anime_id, episode);`);
db.run(`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);`);

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

// Users & Cloud Sync Tables
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

// Data Migration & Normalization for Existing Users
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

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "1042260047227-83if5kgps15jm4e8n6ebl5rb1iiu67sh.apps.googleusercontent.com";

function getSessionUser(req: Request): any | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const session = db.query(`
      SELECT s.token, s.expires_at, u.id, u.email, u.email_encrypted, u.name, u.avatar, u.tag_id, u.watch_time_seconds, u.exp, u.level
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `).get(token) as any;
    if (!session) return null;
    let realEmail = session.email;
    if (session.email_encrypted) {
      realEmail = decryptSensitive(session.email_encrypted);
    }
    const levelInfo = calculateLevelData(session.exp || 0);
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

function mergeLists(cloudList: any[], localList: any[], key: string = "id"): any[] {
  const map = new Map<string, any>();
  for (const item of (Array.isArray(cloudList) ? cloudList : [])) {
    if (item) {
      const k = String(item[key] || item.id || "");
      if (k) map.set(k, item);
    }
  }
  for (const item of (Array.isArray(localList) ? localList : [])) {
    if (item) {
      const k = String(item[key] || item.id || "");
      if (!k) continue;
      const existing = map.get(k);
      if (!existing) {
        map.set(k, item);
      } else {
        const localTime = new Date(item.watchedAt || item.timestamp || item.updatedAt || 0).getTime();
        const cloudTime = new Date(existing.watchedAt || existing.timestamp || existing.updatedAt || 0).getTime();
        if (localTime >= cloudTime) {
          map.set(k, { ...existing, ...item });
        }
      }
    }
  }
  return Array.from(map.values());
}

console.log(`[Pixuplay Database] SQLite connected (${DB_PATH}) with WAL mode enabled.`);

function formatRelativeTime(dateString: string): string {
  try {
    const cleanDate = dateString.includes("T") || dateString.includes("Z") ? dateString : dateString.replace(" ", "T") + "Z";
    const past = new Date(cleanDate).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - past) / 1000));
    if (diffSec < 45) return "Baru saja";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} hari lalu`;
    return new Date(past).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "Baru saja";
  }
}

// Embedded Scraper via Unix Domain Socket (No extra TCP port / Port 3001 eliminated)
const SCRAPER_SOCKET = "/tmp/pixuplay_scraper.sock";
if (fs.existsSync(SCRAPER_SOCKET)) {
  try {
    fs.unlinkSync(SCRAPER_SOCKET);
  } catch {}
}

let scraperServer: any = null;
try {
  const scraperApp = (await import("../anime-api/dist/index.js")).default;
  scraperServer = scraperApp.listen(SCRAPER_SOCKET, () => {
    console.log(`[Pixuplay Server] Embedded anime scraper active on socket: ${SCRAPER_SOCKET}`);
  });
} catch (err: any) {
  console.warn(`[Pixuplay Server] Embedded scraper initialization error:`, err?.message || err);
}

function cleanupScraperSocket() {
  try {
    if (fs.existsSync(SCRAPER_SOCKET)) fs.unlinkSync(SCRAPER_SOCKET);
  } catch {}
}
process.on("exit", cleanupScraperSocket);
process.on("SIGINT", () => {
  cleanupScraperSocket();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanupScraperSocket();
  process.exit(0);
});

console.log(`[Pixuplay Server] Starting on http://0.0.0.0:${PORT}...`);
console.log(`[Pixuplay Server] Unified All-in-One Backend (API, WebSocket Nobar, Anime Scrapers)`);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
};

// ============================================================
// IN-MEMORY CACHE (HIGH PERFORMANCE & INSTANT RESPONSES)
// ============================================================
const CACHE = {
  ongoing: null as any[] | null,
  ongoingTime: 0,
  completed: null as any[] | null,
  completedTime: 0,
  schedule: null as any[] | null,
  scheduleTime: 0,
  az: null as any[] | null,
  azTime: 0,
  donghua: null as any[] | null,
  donghuaTime: 0,
  search: new Map<string, { data: any[]; timestamp: number }>(),
  detail: new Map<string, { data: any; timestamp: number }>(),
  episodes: new Map<string, { data: any[]; timestamp: number }>(),
  stream: new Map<string, { data: any; timestamp: number }>(),
  extractedMp4: new Map<string, string>(),
  genres: new Map<string, { data: any[]; timestamp: number }>(),
  trending: null as any[] | null,
  trendingTime: 0,
};

const CACHE_TTL_SHORT = 60 * 1000;       // 1 min
const CACHE_TTL_MEDIUM = 5 * 60 * 1000;  // 5 mins
const CACHE_TTL_LONG = 30 * 60 * 1000;   // 30 mins

// Helper to normalize anime object consistently across the app
function normalizeAnime(a: any, source: string = "otakudesu", defaultStatus?: string) {
  const animeId = a.animeId || a.slug || a.id || "";
  const title = a.title || "Anime";
  const poster = a.poster || a.coverImage?.extraLarge || "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80";
  const episodes = parseInt(String(a.episodes || a.episodeCount || "12").replace(/[^0-9]/g, ""), 10) || 12;

  let synopsis = "";
  if (Array.isArray(a.synopsis?.paragraphList) && a.synopsis.paragraphList.length > 0) {
    synopsis = a.synopsis.paragraphList.join("\n\n").trim();
  } else if (typeof a.description === "string" && a.description.trim()) {
    synopsis = a.description.trim();
  }

  // Ensure genre list contains clean strings
  let genres: string[] = [];
  if (Array.isArray(a.genreList)) {
    genres = a.genreList.map((g: any) => (typeof g === "object" ? g.title || g.genreId : String(g))).filter(Boolean);
  } else if (Array.isArray(a.genres)) {
    genres = a.genres.map((g: any) => (typeof g === "object" ? g.title || g.genreId : String(g))).filter(Boolean);
  } else if (animeId && CACHE.detail.has(animeId)) {
    genres = CACHE.detail.get(animeId)?.data?.genres || [];
  }

  const isOngoing = defaultStatus === "RELEASING" ||
    (a.status || "").toLowerCase().includes("ongoing") ||
    Boolean(a.releaseDay) ||
    Boolean(a.latestReleaseDate);

  return {
    id: animeId,
    animeId: animeId,
    title: {
      romaji: typeof title === "string" ? title : title.romaji || title.english || "Anime",
      english: typeof title === "string" ? title : title.english || title.romaji || "Anime",
      userPreferred: typeof title === "string" ? title : title.userPreferred || title.english || "Anime",
      native: typeof a.japanese === "string" ? a.japanese : (typeof title === "object" ? title.native : title) || "Anime",
    },
    coverImage: {
      extraLarge: poster,
      large: poster,
      medium: poster,
    },
    bannerImage: a.bannerImage || poster,
    description: synopsis || "",
    episodes: episodes,
    averageScore: a.score ? Math.round(parseFloat(String(a.score).replace(/[^0-9.]/g, "")) * 10) : (a.averageScore || 88),
    genres: genres,
    status: isOngoing ? "RELEASING" : "FINISHED",
    countryOfOrigin: "JP",
    latestReleaseDate: a.latestReleaseDate || a.releasedOn || "",
    releaseDay: a.releaseDay || "",
    source: source,
  };
}

// ============================================================
// WAJIK API CALLERS
// ============================================================

async function fetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  try {
    let fetchUrl = url;
    const fetchOptions: any = { signal: AbortSignal.timeout(timeoutMs) };

    if (
      url.includes("/otakudesu/") ||
      url.includes("/kuramanime/") ||
      url.includes("/oploverz/") ||
      url.includes("/samehadaku/")
    ) {
      // Re-route to internal embedded Unix socket
      fetchUrl = url.replace(/https?:\/\/[^\/]+/, "http://localhost");
      fetchOptions.unix = SCRAPER_SOCKET;
    }

    const res = await fetch(fetchUrl, fetchOptions);
    if (!res.ok) return null;
    return await res.json();
  } catch (err: any) {
    console.warn(`[Pixuplay API Fetch Error] ${url}: ${err.message}`);
    return null;
  }
}

// ============================================================
// STREAM EXTRACTION & BYPASS HELPERS
// ============================================================

/**
 * Extract direct MP4 URL from Desustream / Odcloud HTML pages
 */
function extractMp4FromHtml(html: string): string | null {
  // Helper to validate that URL is a real accessible stream and not IP-locked googlevideo
  const isUsable = (u: string) => {
    if (!u) return false;
    const lower = u.toLowerCase();
    return !lower.includes("googlevideo.com") && !lower.includes("analytics") && !lower.includes("beacon");
  };

  // Pattern 1: const videoURL = "..."
  let m = html.match(/const\s+videoURL\s*=\s*["']([^"']+)["']/);
  if (m && isUsable(m[1])) return m[1];

  // Pattern 2: file:"..." or file: "..."
  m = html.match(/file\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/);
  if (m && isUsable(m[1])) return m[1];

  // Pattern 3: <source src="..."
  m = html.match(/<source\s+src=["']([^"']+)["']/);
  if (m) {
    const candidate = m[1].replace(/&amp;/g, "&");
    if (isUsable(candidate)) return candidate;
  }

  // Pattern 4: any direct .mp4 URL (excluding googlevideo and trackers)
  const allMp4s = html.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/g);
  if (allMp4s) {
    for (const raw of allMp4s) {
      const clean = raw.replace(/["']/g, "").replace(/&amp;/g, "&");
      if (isUsable(clean)) return clean;
    }
  }

  return null;
}

async function extractDirectStream(desustreamUrl: string): Promise<string | null> {
  if (CACHE.extractedMp4.has(desustreamUrl)) {
    return CACHE.extractedMp4.get(desustreamUrl)!;
  }

  try {
    const res = await fetch(desustreamUrl, {
      headers: {
        "Referer": "https://otakudesu.blog/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const mp4Url = extractMp4FromHtml(html);
    if (mp4Url) {
      CACHE.extractedMp4.set(desustreamUrl, mp4Url);
      return mp4Url;
    }
  } catch {}
  return null;
}

/**
 * Check alternate resolutions for direct odcloud MP4 (1080p, 720p, 480p, 360p)
 */
async function checkOdcloudResolutions(baseMp4Url: string): Promise<Array<{ quality: string; url: string }>> {
  const m = baseMp4Url.match(/(.*[_\-\. ])(1080p|720p|480p|360p)(.*)/i);
  if (!m) return [];

  const prefix = m[1];
  const currentQ = m[2].toLowerCase();
  const suffix = m[3];

  const otherQualities = ["1080p", "720p", "480p", "360p"].filter(q => q !== currentQ);
  const found: Array<{ quality: string; url: string }> = [];

  await Promise.all(
    otherQualities.map(async (q) => {
      const candidateUrl = `${prefix}${q}${suffix}`;
      try {
        const res = await fetch(candidateUrl, {
          method: "HEAD",
          headers: {
            "Referer": "https://otakudesu.blog/",
            "User-Agent": "Mozilla/5.0",
          },
          signal: AbortSignal.timeout(1800),
        });
        if (res.ok) {
          found.push({ quality: q, url: candidateUrl });
        }
      } catch {}
    })
  );

  return found;
}

// 1. Ongoing List
async function getOngoing(): Promise<any[]> {
  const now = Date.now();
  if (CACHE.ongoing && now - CACHE.ongoingTime < CACHE_TTL_SHORT) {
    return CACHE.ongoing;
  }
  const json = await fetchJson(`${WAJIK_API}/otakudesu/ongoing?page=1`);
  const list = json?.data?.animeList || [];
  const normalized = list.map((item: any) => normalizeAnime(item, "otakudesu", "RELEASING"));
  if (normalized.length > 0) {
    CACHE.ongoing = normalized;
    CACHE.ongoingTime = now;
  }
  return CACHE.ongoing || [];
}

// 2. Completed List
async function getCompleted(): Promise<any[]> {
  const now = Date.now();
  if (CACHE.completed && now - CACHE.completedTime < CACHE_TTL_MEDIUM) {
    return CACHE.completed;
  }
  const json = await fetchJson(`${WAJIK_API}/otakudesu/completed?page=1`);
  const list = json?.data?.animeList || [];
  const normalized = list.map((item: any) => normalizeAnime(item, "otakudesu", "FINISHED"));
  if (normalized.length > 0) {
    CACHE.completed = normalized;
    CACHE.completedTime = now;
  }
  return CACHE.completed || [];
}

// 2.5 Trending / Hot Anime List (Ongoing anime sorted by rating/score)
async function getTrending(): Promise<any[]> {
  const now = Date.now();
  if (CACHE.trending && now - CACHE.trendingTime < CACHE_TTL_SHORT) {
    return CACHE.trending;
  }

  const ongoing = await getOngoing();
  if (!ongoing || ongoing.length === 0) return [];

  // Fetch rating scores for ongoing anime in parallel
  const withScores = await Promise.all(
    ongoing.map(async (item: any) => {
      const animeId = item.id || item.animeId;
      if (!animeId) return item;

      let rawScore: string | null = null;
      if (CACHE.detail.has(animeId)) {
        rawScore = CACHE.detail.get(animeId)?.data?.score || null;
      }

      if (!rawScore) {
        try {
          const detailRes = await fetchJson(`${WAJIK_API}/otakudesu/anime/${animeId}`, 3000);
          rawScore = detailRes?.data?.details?.score || null;
        } catch {}
      }

      const scoreNum = rawScore ? parseFloat(String(rawScore).replace(/[^0-9.]/g, "")) : 7.0;
      const averageScore = Math.round(scoreNum * 10);

      return {
        ...item,
        score: rawScore || String(scoreNum.toFixed(2)),
        averageScore: averageScore > 0 ? averageScore : (item.averageScore || 70),
      };
    })
  );

  // Sort ongoing anime descending by rating
  withScores.sort((a: any, b: any) => (b.averageScore || 0) - (a.averageScore || 0));

  CACHE.trending = withScores;
  CACHE.trendingTime = now;
  return CACHE.trending;
}

// 3. Weekly Schedule
async function getSchedule(): Promise<any[]> {
  const now = Date.now();
  if (CACHE.schedule && now - CACHE.scheduleTime < CACHE_TTL_LONG) {
    return CACHE.schedule;
  }
  const json = await fetchJson(`${WAJIK_API}/otakudesu/schedule`);
  const list = json?.data?.scheduleList || [];
  
  // Build poster lookup from ongoing and details
  const ongoing = await getOngoing();
  const posterMap = new Map<string, string>();
  for (const item of ongoing) {
    if (item.id && item.coverImage?.extraLarge) {
      posterMap.set(item.id, item.coverImage.extraLarge);
    }
  }

  // Enrich schedule items with poster images
  const enriched = list.map((day: any) => {
    const animeWithPosters = (day.animeList || []).map((anime: any) => {
      let poster = posterMap.get(anime.animeId);
      if (!poster && CACHE.detail.has(anime.animeId)) {
        poster = CACHE.detail.get(anime.animeId)?.data?.coverImage?.extraLarge;
      }
      return {
        ...anime,
        poster: poster || null,
      };
    });
    return {
      ...day,
      animeList: animeWithPosters,
    };
  });

  if (enriched.length > 0) {
    CACHE.schedule = enriched;
    CACHE.scheduleTime = now;
  }
  return CACHE.schedule || [];
}

// 4. A-Z Catalog List
async function getAZList(): Promise<any[]> {
  const now = Date.now();
  if (CACHE.az && now - CACHE.azTime < CACHE_TTL_LONG) {
    return CACHE.az;
  }
  const json = await fetchJson(`${WAJIK_API}/otakudesu/anime`);
  const list = json?.data?.list || [];
  if (list.length > 0) {
    CACHE.az = list;
    CACHE.azTime = now;
  }
  return CACHE.az || [];
}

// 4.5 Genre Anime List (at least 60 anime per genre)
async function getAnimeByGenre(genreId: string): Promise<any[]> {
  const cleanId = genreId.toLowerCase().trim();
  const now = Date.now();
  const cached = CACHE.genres.get(cleanId);
  if (cached && now - cached.timestamp < CACHE_TTL_LONG) {
    return cached.data;
  }

  // Fetch 4 pages in parallel (15 items/page = 60 items)
  const pages = [1, 2, 3, 4];
  const promises = pages.map((p) =>
    fetchJson(`${WAJIK_API}/otakudesu/genre/${cleanId}?page=${p}`, 8000).then(
      (res) => res?.data?.animeList || []
    )
  );

  const rawLists = await Promise.all(promises);
  const allRaw = rawLists.flat();

  // Deduplicate and normalize
  const seen = new Set<string>();
  const normalized: any[] = [];
  for (const item of allRaw) {
    const key = item.animeId || item.otakudesuUrl || item.title;
    if (key && !seen.has(key)) {
      seen.add(key);
      normalized.push(normalizeAnime(item, "otakudesu"));
    }
  }

  if (normalized.length > 0) {
    CACHE.genres.set(cleanId, { data: normalized, timestamp: now });
  }

  return normalized;
}

// 5. Donghua List (Real Donghua from Kuramanime)
const DONGHUA_TITLES = [
  "Battle Through the Heavens",
  "Soul Land",
  "Swallowed Star",
  "Wanmei Shijie",
  "A Will Eternal",
  "Renegade Immortal",
  "Throne of Seal",
  "Shrouding the Heavens",
  "Wu Dong Qian Kun",
  "Against the Gods",
  "Martial Master",
  "Tales of Demons and Gods",
  "Stellar Transformation",
  "Lord Xue Ying",
];

async function getDonghua(): Promise<any[]> {
  const now = Date.now();
  if (CACHE.donghua && now - CACHE.donghuaTime < CACHE_TTL_LONG) {
    return CACHE.donghua;
  }

  const results: any[] = [];
  for (const title of DONGHUA_TITLES) {
    try {
      const json = await fetchJson(`${WAJIK_API}/kuramanime/anime?search=${encodeURIComponent(title)}`, 4000);
      const first = json?.data?.animeList?.[0];
      if (first) {
        results.push({
          id: first.animeSlug,
          animeId: first.animeSlug,
          kuramaId: first.animeId,
          kuramaSlug: first.animeSlug,
          title: {
            english: first.title,
            romaji: first.title,
            userPreferred: first.title,
            native: first.title,
          },
          coverImage: {
            extraLarge: first.poster,
            large: first.poster,
            medium: first.poster,
          },
          bannerImage: first.poster,
          description: `Streaming resmi serial donghua ${first.title} dengan kualitas Full HD dan subtitle bahasa Indonesia.`,
          episodes: 52,
          averageScore: first.highlight ? Math.round(parseFloat(first.highlight) * 10) : 92,
          genres: ["Action", "Cultivation", "Fantasy", "Donghua"],
          status: "RELEASING",
          countryOfOrigin: "CN",
          source: "kuramanime",
        });
      }
    } catch {}
  }

  if (results.length > 0) {
    CACHE.donghua = results;
    CACHE.donghuaTime = now;
  }
  return CACHE.donghua || [];
}

// 6. Multi-Search across Otakudesu & Oploverz
async function searchAnime(query: string): Promise<any[]> {
  const qClean = query.trim().toLowerCase();
  if (!qClean) return [];

  const cached = CACHE.search.get(qClean);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MEDIUM) {
    return cached.data;
  }

  const results: any[] = [];
  const seenIds = new Set<string>();

  // Otakudesu search
  const otakuJson = await fetchJson(`${WAJIK_API}/otakudesu/search?q=${encodeURIComponent(query)}`);
  const otakuList = otakuJson?.data?.animeList || [];
  for (const item of otakuList) {
    if (!seenIds.has(item.animeId)) {
      seenIds.add(item.animeId);
      results.push(normalizeAnime(item, "otakudesu"));
    }
  }

  // Oploverz search (great for Solo Leveling, etc.)
  const opJson = await fetchJson(`${WAJIK_API}/oploverz/search?q=${encodeURIComponent(query)}`);
  const opList = opJson?.data?.animeList || [];
  for (const item of opList) {
    const slug = item.slug || item.href?.replace(/.*\/anime\//, "").replace(/\/$/, "");
    if (slug && !seenIds.has(slug)) {
      seenIds.add(slug);
      results.push({
        id: slug,
        animeId: slug,
        title: {
          english: item.title,
          romaji: item.title,
          userPreferred: item.title,
          native: item.title,
        },
        coverImage: { extraLarge: item.poster, large: item.poster },
        bannerImage: item.poster,
        description: "Streaming anime subtitle Indonesia resmi.",
        episodes: 12,
        averageScore: 90,
        genres: ["Action", "Adventure"],
        status: (item.status || "").toLowerCase().includes("ongoing") ? "RELEASING" : "FINISHED",
        countryOfOrigin: "JP",
        source: "oploverz",
      });
    }
  }

  // Kuramanime search (great for Donghua)
  const kuramaJson = await fetchJson(`${WAJIK_API}/kuramanime/anime?search=${encodeURIComponent(query)}`);
  const kuramaList = kuramaJson?.data?.animeList || [];
  for (const item of kuramaList) {
    if (!seenIds.has(item.animeSlug)) {
      seenIds.add(item.animeSlug);
      results.push({
        id: item.animeSlug,
        animeId: item.animeSlug,
        title: {
          english: item.title,
          romaji: item.title,
          userPreferred: item.title,
          native: item.title,
        },
        coverImage: { extraLarge: item.poster, large: item.poster },
        bannerImage: item.poster,
        description: "Streaming anime subtitle Indonesia.",
        episodes: 12,
        averageScore: item.highlight ? Math.round(parseFloat(item.highlight) * 10) : 85,
        genres: ["Action", "Animation"],
        status: "RELEASING",
        countryOfOrigin: item.type === "Donghua" ? "CN" : "JP",
        source: "kuramanime",
      });
    }
  }

  CACHE.search.set(qClean, { data: results, timestamp: Date.now() });
  return results;
}

// Helper to fetch rich and accurate synopsis & banner from AniList
async function fetchAniListInfo(titleOrSlug: string): Promise<{ synopsis?: string; banner?: string; cover?: string } | null> {
  try {
    const cleanQ = titleOrSlug
      .replace(/-sub-indo/gi, "")
      .replace(/-/g, " ")
      .replace(/\s+Season\s+(\d+)/gi, " $1")
      .trim();
    const gql = `query ($search: String) {
      Media(search: $search, type: ANIME) {
        description(asHtml: false)
        bannerImage
        coverImage { extraLarge }
      }
    }`;
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: gql, variables: { search: cleanQ } }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const media = json?.data?.Media;
    if (!media) return null;
    return {
      synopsis: media.description?.replace(/<[^>]*>?/gm, "").trim(),
      banner: media.bannerImage,
      cover: media.coverImage?.extraLarge,
    };
  } catch {
    return null;
  }
}

// 7. Anime Details by slug
async function getAnimeDetails(animeId: string): Promise<any | null> {
  const cached = CACHE.detail.get(animeId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MEDIUM) {
    return cached.data;
  }

  // 1. Try Otakudesu
  const otakuRes = await fetchJson(`${WAJIK_API}/otakudesu/anime/${animeId}`);
  if (otakuRes?.data?.details) {
    const details = otakuRes.data.details;
    let synopsis = (details.synopsis?.paragraphList || [])
      .filter((p: string) => p && p.trim().length > 10)
      .join("\n\n")
      .trim();
    let banner = details.poster;

    // If synopsis is missing or empty on Otakudesu, enrich with AniList
    if (!synopsis || synopsis.length < 20) {
      const anilistInfo = await fetchAniListInfo(details.title || animeId);
      if (anilistInfo) {
        if (anilistInfo.synopsis) synopsis = anilistInfo.synopsis;
        if (anilistInfo.banner) banner = anilistInfo.banner;
      }
    }

    if (!synopsis) {
      synopsis = `Sinopsis untuk serial anime ${details.title || "ini"} sedang dalam proses pembaruan. Anda dapat langsung menonton seluruh episode dengan subtitle Indonesia resmi di Pixuplay.`;
    }

    const normalized = {
      ...normalizeAnime({ ...details, animeId, bannerImage: banner }, "otakudesu"),
      description: synopsis,
      bannerImage: banner,
      episodeList: (details.episodeList || [])
        .filter((ep: any) => !ep.episodeId?.includes("pembatas"))
        .map((ep: any) => ({
          title: ep.title,
          episodeId: ep.episodeId,
          url: ep.otakudesuUrl,
        }))
        .sort((a: any, b: any) => {
          const numA = parseInt(String(a.title).replace(/[^0-9]/g, ""), 10) || 0;
          const numB = parseInt(String(b.title).replace(/[^0-9]/g, ""), 10) || 0;
          return numA - numB;
        }),
    };
    CACHE.detail.set(animeId, { data: normalized, timestamp: Date.now() });
    return normalized;
  }

  // 2. Try Oploverz
  const opRes = await fetchJson(`${WAJIK_API}/oploverz/anime/${animeId}`);
  if (opRes?.data?.details) {
    const details = opRes.data.details;
    const normalized = {
      id: animeId,
      animeId: animeId,
      title: {
        english: details.title,
        romaji: details.title,
        userPreferred: details.title,
        native: details.title,
      },
      coverImage: { extraLarge: details.poster, large: details.poster },
      bannerImage: details.poster,
      description: details.synopsis?.paragraphList?.join("\n\n") || "",
      episodes: details.episodeList?.length || 12,
      averageScore: details.rating ? Math.round(parseFloat(details.rating) * 10) : 88,
      genres: details.genres || ["Action"],
      status: (details.status || "").toLowerCase().includes("ongoing") ? "RELEASING" : "FINISHED",
      countryOfOrigin: "JP",
      episodeList: (details.episodeList || []).map((ep: any) => ({
        title: ep.episode || ep.title,
        episodeId: ep.href?.replace(/.*\/anime\//, "").replace("https://oploverz.am/", "").replace(/\/$/, ""),
        url: ep.href,
      })),
      source: "oploverz",
    };
    CACHE.detail.set(animeId, { data: normalized, timestamp: Date.now() });
    return normalized;
  }

  return null;
}

// 8. Stream Resolver (OTAKUDESU + OPLOVERZ MULTI-MIRROR SERVERS & CSP-FREE PROXIES)
async function resolveStream(
  animeIdOrSlug: string,
  title: string,
  epNum: number
): Promise<{
  title: string;
  episode: number;
  servers: Array<{
    name: string;
    label: string;
    region?: string;
    quality?: string;
    maxQuality?: string;
    maxQualityLabel?: string;
    type: string;
    url: string;
    qualities?: Array<{ quality: string; label: string; url: string }>;
  }>;
}> {
  const cacheKey = `${animeIdOrSlug}_${epNum}`;
  const cached = CACHE.stream.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_SHORT) {
    return cached.data;
  }

  const servers: Array<{
    name: string;
    label: string;
    region?: string;
    quality?: string;
    maxQuality?: string;
    maxQualityLabel?: string;
    type: string;
    url: string;
    qualities?: Array<{ quality: string; label: string; url: string }>;
  }> = [];
  const cleanTitle = decodeURIComponent(title || "Anime").trim();

  try {
    // 1. Find the Otakudesu anime slug
    let otakuSlug: string | null = null;
    if (animeIdOrSlug && isNaN(Number(animeIdOrSlug))) {
      otakuSlug = animeIdOrSlug;
    } else {
      // Search by title
      const sJson = await fetchJson(`${WAJIK_API}/otakudesu/search?q=${encodeURIComponent(cleanTitle)}`);
      const sList = sJson?.data?.animeList || [];
      if (sList.length > 0) otakuSlug = sList[0].animeId;
    }

    // 2. Fetch Otakudesu episodes and match target episode
    if (otakuSlug) {
      const epJson = await fetchJson(`${WAJIK_API}/otakudesu/anime/${otakuSlug}`);
      const rawEpisodes: any[] = epJson?.data?.details?.episodeList || [];
      const validEpisodes = rawEpisodes.filter((ep: any) => !ep.episodeId?.includes("pembatas"));

      if (validEpisodes.length > 0) {
        // Match episode by title or episode number
        let targetEp = validEpisodes.find((ep: any) => {
          const num = parseInt(String(ep.title).replace(/[^0-9]/g, ""), 10);
          return num === epNum || String(ep.title).trim() === String(epNum);
        });

        // Fallback: match by episode slug pattern
        if (!targetEp) {
          targetEp = validEpisodes.find((ep: any) =>
            ep.episodeId?.toLowerCase().includes(`-episode-${epNum}-`) ||
            ep.episodeId?.toLowerCase().endsWith(`-episode-${epNum}`)
          );
        }

        // Fallback: if ep requested out of range or not found, use closest episode
        if (!targetEp) {
          targetEp = validEpisodes[validEpisodes.length - 1]; // First episode (oldest)
        }

        if (targetEp?.episodeId) {
          // Fetch episode streaming data
          const sRes = await fetchJson(`${WAJIK_API}/otakudesu/episode/${targetEp.episodeId}`);
          const details = sRes?.data?.details;
          const directStreams: Array<{ quality: string; url: string }> = [];

          // 1. Primary direct MP4 extraction from defaultStreamingUrl
          if (details?.defaultStreamingUrl) {
            const directMp4 = await extractDirectStream(details.defaultStreamingUrl);
            if (directMp4) {
              const qMatch = directMp4.match(/(1080p|720p|480p|360p)/i);
              const detectedQ = qMatch ? qMatch[1].toLowerCase() : "720p";
              directStreams.push({ quality: detectedQ, url: directMp4 });

              // Check if alternate resolutions exist on odcloud (1080p, 480p, 360p)
              const altResolutions = await checkOdcloudResolutions(directMp4);
              for (const alt of altResolutions) {
                if (!directStreams.some(s => s.url === alt.url || s.quality === alt.quality)) {
                  directStreams.push(alt);
                }
              }
            }
          }

          // 2. Check qualityList for official direct streams and mirror servers
          const qualityList = details?.server?.qualityList || [];
          const eligibleServers: Array<{ qStr: string; srvName: string; serverId: string }> = [];
          let bestEmbedUrl: string | null = null;
          let vidhideUrl: string | null = null;

          for (const q of qualityList) {
            const qMatch = (q.title || "").match(/(1080p|720p|480p|360p)/i);
            const qStr = qMatch ? qMatch[1].toLowerCase() : "720p";

            for (const srv of q.serverList || []) {
              const srvName = (srv.title || "").toLowerCase();
              if (
                srvName.includes("odstream") ||
                srvName.includes("odcdn") ||
                srvName.includes("ondesu") ||
                srvName.includes("arcg")
              ) {
                if (srv.serverId) {
                  eligibleServers.push({ qStr, srvName, serverId: srv.serverId });
                }
              } else if (srvName.includes("vidhide") && srv.serverId && !vidhideUrl) {
                eligibleServers.push({ qStr: "720p", srvName: "vidhide", serverId: srv.serverId });
              }
            }
          }

          // Fetch eligible mirror servers in parallel
          await Promise.all(
            eligibleServers.map(async (srv) => {
              try {
                const srvRes = await fetchJson(`${WAJIK_API}/otakudesu/server/${srv.serverId}`, 3000);
                const rawUrl = srvRes?.data?.details?.url;
                if (!rawUrl) return;

                if (srv.srvName.includes("vidhide")) {
                  vidhideUrl = rawUrl;
                  return;
                }

                if (!bestEmbedUrl && (rawUrl.includes("dstream") || rawUrl.includes("desustream"))) {
                  bestEmbedUrl = rawUrl;
                }

                const mp4 = await extractDirectStream(rawUrl);
                if (mp4 && !directStreams.some((s) => s.url === mp4 || s.quality === srv.qStr)) {
                  directStreams.push({ quality: srv.qStr, url: mp4 });
                }
              } catch {}
            })
          );

          // Sort direct streams by quality descending (1080p -> 720p -> 480p -> 360p)
          const qualityRank: Record<string, number> = { "1080p": 1, "720p": 2, "480p": 3, "360p": 4 };
          directStreams.sort((a, b) => (qualityRank[a.quality] || 9) - (qualityRank[b.quality] || 9));

          const labelMap: Record<string, string> = {
            "1080p": "1080p Full HD",
            "720p": "720p HD",
            "480p": "480p SD",
            "360p": "360p Hemat",
          };

          // 1. Server Fontaine (Direct Native Stream • Multi-Quality)
          if (directStreams.length > 0) {
            const best = directStreams[0];
            const maxQ = best.quality;
            const maxQText = maxQ === "1080p" ? "1080p Full HD" : maxQ === "720p" ? "720p HD" : "480p SD";

            servers.push({
              name: `Server Fontaine (Maks ${maxQText} • Sub Indo)`,
              label: `Fontaine • Maks ${maxQText}`,
              region: "Fontaine",
              quality: best.quality,
              maxQuality: maxQ,
              maxQualityLabel: `Maks ${maxQText}`,
              type: "direct",
              url: best.url,
              qualities: directStreams.map((s) => ({
                quality: s.quality,
                label: labelMap[s.quality] || s.quality.toUpperCase(),
                url: s.url,
              })),
            });
          }

          // 2. Server Natlan (CSP-Free Proxied Web Player • Sub Indo)
          let targetNatlanUrl = bestEmbedUrl || details?.defaultStreamingUrl;
          if (details?.defaultStreamingUrl?.includes("otakuwatch7") && (bestEmbedUrl || vidhideUrl)) {
            targetNatlanUrl = bestEmbedUrl || vidhideUrl;
          }

          if (targetNatlanUrl) {
            servers.push({
              name: "Server Natlan (Maks 720p HD • Sub Indo)",
              label: "Natlan • Maks 720p HD",
              region: "Natlan",
              quality: "720p",
              maxQuality: "720p",
              maxQualityLabel: "Maks 720p HD",
              type: "embed",
              url: `/api/pixuplay/embed-proxy?url=${encodeURIComponent(targetNatlanUrl)}`,
              qualities: [
                {
                  quality: "720p",
                  label: "720p HD (Auto)",
                  url: `/api/pixuplay/embed-proxy?url=${encodeURIComponent(targetNatlanUrl)}`,
                },
              ],
            });
          }

          // 3. Server Inazuma (Alternative Vidhide Mirror Player)
          if (vidhideUrl && !servers.some((s) => s.url === vidhideUrl)) {
            servers.push({
              name: "Server Inazuma (Maks 720p HD • Sub Indo)",
              label: "Inazuma • Maks 720p HD",
              region: "Inazuma",
              quality: "720p",
              maxQuality: "720p",
              maxQualityLabel: "Maks 720p HD",
              type: "embed",
              url: vidhideUrl,
              qualities: [{ quality: "720p", label: "720p HD", url: vidhideUrl }],
            });
          }
        }
      }
    }

    // 3. Server Sumeru: If Otakudesu returned nothing or for additional Sub Indo source, try Oploverz
    if (servers.length < 2) {
      try {
        const opSearch = await fetchJson(`${WAJIK_API}/oploverz/search?q=${encodeURIComponent(cleanTitle)}`, 3000);
        const opList = opSearch?.data?.animeList || [];
        if (opList.length > 0) {
          const opSlug = opList[0].slug || opList[0].href?.replace(/.*\/anime\//, "").replace(/\/$/, "");
          if (opSlug) {
            const opAnime = await fetchJson(`${WAJIK_API}/oploverz/anime/${opSlug}`, 3000);
            const opEps = opAnime?.data?.details?.episodeList || [];
            const targetOp =
              opEps.find((ep: any) => {
                const num = parseInt(String(ep.episode).replace(/[^0-9]/g, ""), 10);
                return num === epNum || String(ep.episode).trim() === String(epNum);
              }) || opEps[opEps.length - 1];

            if (targetOp?.href) {
              const epSlug = targetOp.href.replace("https://oploverz.am/", "").replace(/\/$/, "");
              const opEpRes = await fetchJson(`${WAJIK_API}/oploverz/episode/${epSlug}`, 3000);
              const streamUrl = opEpRes?.data?.details?.streamingUrl;
              if (streamUrl && !servers.some((s) => s.url === streamUrl)) {
                servers.push({
                  name: "Server Sumeru (Maks 720p HD • Sub Indo)",
                  label: "Sumeru • Maks 720p HD",
                  region: "Sumeru",
                  quality: "720p",
                  maxQuality: "720p",
                  maxQualityLabel: "Maks 720p HD",
                  type: "embed",
                  url: streamUrl,
                  qualities: [{ quality: "720p", label: "720p HD", url: streamUrl }],
                });
              }
            }
          }
        }
      } catch {}
    }

    // 4. Fallback portal if no stream server was resolved
    if (servers.length === 0) {
      servers.push({
        name: "Server Fontaine (Maks 720p HD • Sub Indo)",
        label: "Fontaine • Maks 720p HD",
        region: "Fontaine",
        quality: "720p",
        maxQuality: "720p",
        maxQualityLabel: "Maks 720p HD",
        type: "external",
        url: `https://otakudesu.blog/?s=${encodeURIComponent(cleanTitle)}`,
      });
    }
  } catch (err: any) {
    console.error(`[Pixuplay Resolver Error] ${cleanTitle} Ep ${epNum}:`, err.message);
  }

  const result = {
    title: `${cleanTitle} Episode ${epNum} Sub Indo`,
    episode: epNum,
    servers,
  };

  CACHE.stream.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

// ============================================================
// NOBAR (WATCH PARTY) REAL-TIME SYNC SYSTEM
// ============================================================
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

const NOBAR_ROOMS = new Map<string, NobarRoom>();

// ============================================================
// SECURITY HARDENING UTILITIES (V1.0.0 TESTING & PRODUCTION)
// ============================================================
const globalSecurityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// In-Memory Rate Limiter (Protection against flood/spam/DoS)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimits = new Map<string, RateLimitEntry>();

function isRateLimited(key: string, limit: number, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

// Clean up stale rate limits every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    if (now > entry.resetAt) {
      rateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Client IP resolver
function getClientIp(req: Request, srv: any): string {
  const xForwarded = req.headers.get("x-forwarded-for");
  if (xForwarded) {
    const first = xForwarded.split(",")[0].trim();
    if (first) return first;
  }
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  try {
    const srvIp = srv.requestIP(req)?.address;
    if (srvIp) return srvIp;
  } catch {}
  return "127.0.0.1";
}

// Safe payload JSON parser with strict max size
async function parseJsonBody(req: Request, maxBytes = 65536): Promise<{ data?: any; error?: string }> {
  const cl = req.headers.get("content-length");
  if (cl && parseInt(cl, 10) > maxBytes) {
    return { error: "Payload terlalu besar (Maksimal 64KB)" };
  }

  try {
    const text = await req.text();
    if (text.length > maxBytes) {
      return { error: "Payload terlalu besar (Maksimal 64KB)" };
    }
    return { data: JSON.parse(text) };
  } catch {
    return { error: "Format request body JSON tidak valid" };
  }
}

// Input Sanitizers
function sanitizeText(input: unknown, maxLen = 500): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/<[^>]*>?/gm, "")
    .trim()
    .slice(0, maxLen);
}

function sanitizeSafeUrl(input: unknown): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/assets/") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed.slice(0, 500);
  }
  return "";
}

function sanitizeSlug(input: unknown, maxLen = 100): string {
  if (typeof input !== "string") return "";
  return input.trim().replace(/[^a-zA-Z0-9_\-\.]/g, "").slice(0, maxLen);
}

// SSRF Protection: validate external proxy URLs
function isSafeProxyUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    // Only standard HTTP/HTTPS ports allowed
    if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
      return false;
    }

    const host = parsed.hostname.toLowerCase().trim();
    if (!host) return false;

    // Disallow loopback / internal hostnames
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.endsWith(".lan") ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host === "[::1]"
    ) {
      return false;
    }

    // Disallow pure numeric representations of IP
    if (/^\d+$/.test(host) || /^0x[0-9a-fA-F]+$/.test(host)) {
      return false;
    }

    // Disallow IPv6 bracketed hosts
    if (host.startsWith("[") || host.includes(":")) {
      return false;
    }

    // Check IPv4 private and restricted ranges
    const ipv4Regex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
    const ipMatch = host.match(ipv4Regex);
    if (ipMatch) {
      const p1 = parseInt(ipMatch[1], 10);
      const p2 = parseInt(ipMatch[2], 10);
      const p3 = parseInt(ipMatch[3], 10);
      const p4 = parseInt(ipMatch[4], 10);
      if (p1 > 255 || p2 > 255 || p3 > 255 || p4 > 255) return false;

      // 0.0.0.0/8
      if (p1 === 0) return false;
      // 10.0.0.0/8 (Private)
      if (p1 === 10) return false;
      // 127.0.0.0/8 (Loopback)
      if (p1 === 127) return false;
      // 169.254.0.0/16 (Link-local / Cloud metadata)
      if (p1 === 169 && p2 === 254) return false;
      // 172.16.0.0/12 (Private)
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return false;
      // 192.168.0.0/16 (Private)
      if (p1 === 192 && p2 === 168) return false;
      // 100.64.0.0/10 (Carrier-grade NAT)
      if (p1 === 100 && p2 >= 64 && p2 <= 127) return false;
      // 224.0.0.0+ (Multicast / Reserved)
      if (p1 >= 224) return false;
    }

    // Host must have at least one dot separating domain and TLD
    if (!host.includes(".")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Clean up expired watch party rooms (older than 24h)
function cleanupExpiredRooms() {
  const now = Date.now();
  const EXPIRY_MS = 24 * 60 * 60 * 1000;
  for (const [id, room] of NOBAR_ROOMS.entries()) {
    if (now - room.lastUpdate > EXPIRY_MS) {
      NOBAR_ROOMS.delete(id);
    }
  }
}
setInterval(cleanupExpiredRooms, 30 * 60 * 1000);

// ============================================================
// SERVER SETUP & ROUTING
// ============================================================
const server = serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req: Request, srv: any) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const clientIp = getClientIp(req, srv);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: { ...corsHeaders, ...globalSecurityHeaders } });
    }

    // Global Rate Limit (240 requests/min per IP)
    if (isRateLimited(`global_${clientIp}`, 240, 60000)) {
      return new Response(JSON.stringify({ status: false, message: "Terlalu banyak permintaan. Silakan tunggu 1 menit." }), {
        status: 429,
        headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // 0. WebSocket Upgrade for Watch Party (Nobar)
    if (pathname === "/ws/nobar") {
      const roomId = sanitizeSlug(url.searchParams.get("roomId") || "global", 64);
      const userId = sanitizeSlug(url.searchParams.get("userId") || Math.random().toString(36).substring(2, 8), 64);
      const role = url.searchParams.get("role") === "host" ? "host" : "guest";
      const name = sanitizeText(decodeURIComponent(url.searchParams.get("name") || "Penonton"), 30);
      const rawAvatar = url.searchParams.get("avatar") ? decodeURIComponent(url.searchParams.get("avatar")!) : "";
      const avatar = sanitizeSafeUrl(rawAvatar) || "";

      const upgraded = srv.upgrade(req, {
        data: { roomId, userId, role, name, avatar },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Health check
    if (pathname === "/api/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          app: "Pixuplay Anime Streaming",
          version: "3.4.0",
          port: PORT,
          mode: "2-Port Architecture (20006 Frontend, 15006 Backend)",
          backendUrl: `http://localhost:${PORT}`,
          scraper: "Embedded in-process (Port 3001 eliminated)",
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Direct Scraper API passthrough (Otakudesu, Kuramanime, Oploverz, Samehadaku)
    if (
      pathname.startsWith("/otakudesu") ||
      pathname.startsWith("/kuramanime") ||
      pathname.startsWith("/oploverz") ||
      pathname.startsWith("/samehadaku")
    ) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      if (isRateLimited(`scraper_${clientIp}`, 180, 60000)) {
        return new Response(JSON.stringify({ error: "Terlalu banyak permintaan scraper, silakan tunggu sebentar." }), {
          status: 429,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json", "Retry-After": "60" },
        });
      }

      try {
        const scraperRes = await (fetch as any)(`http://localhost${pathname}${url.search}`, {
          method: req.method,
          headers: req.headers,
          unix: SCRAPER_SOCKET,
        });
        return new Response(scraperRes.body, {
          status: scraperRes.status,
          headers: {
            ...corsHeaders,
            ...globalSecurityHeaders,
            "Content-Type": scraperRes.headers.get("Content-Type") || "application/json",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 502,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ============================================================
    // CSP-FREE EMBED PROXY (WITH STRICT SSRF & ORIGIN ISOLATION)
    // ============================================================
    if (pathname === "/api/pixuplay/embed-proxy") {
      if (isRateLimited(`embed_${clientIp}`, 60, 60000)) {
        return new Response("Terlalu banyak permintaan embed proxy. Silakan tunggu 1 menit.", {
          status: 429,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Retry-After": "60" },
        });
      }

      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) {
        return new Response("Missing url param", {
          status: 400,
          headers: { ...corsHeaders, ...globalSecurityHeaders },
        });
      }

      // Airtight SSRF Validation: block localhost, private IPs, cloud metadata
      if (!isSafeProxyUrl(targetUrl)) {
        return new Response("URL tidak diizinkan atau terdeteksi tidak aman", {
          status: 403,
          headers: { ...corsHeaders, ...globalSecurityHeaders },
        });
      }

      try {
        const res = await fetch(targetUrl, {
          headers: {
            "Referer": "https://otakudesu.blog/",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(8000),
        });

        let html = await res.text();
        const origin = new URL(targetUrl).origin;

        // 1. Strip Cloudflare RUM & analytics beacon scripts to eliminate cross-origin CORS errors
        html = html.replace(/<script[^>]*cloudflareinsights[^>]*>[\s\S]*?<\/script>/gi, "");
        html = html.replace(/<script[^>]*beacon\.min\.js[^>]*>[\s\S]*?<\/script>/gi, "");
        html = html.replace(/<script[^>]*data-cf-beacon[^>]*>[\s\S]*?<\/script>/gi, "");
        html = html.replace(/<script[^>]*cdn-cgi\/rum[^>]*>[\s\S]*?<\/script>/gi, "");

        // 2. Client-side XHR & Fetch telemetry interceptor stub
        const rumInterceptor = `<script>
(function(){
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u) {
    if (typeof u === "string" && u.indexOf("/cdn-cgi/rum") !== -1) {
      this.send = function() {};
      return;
    }
    return origOpen.apply(this, arguments);
  };
  if (window.fetch) {
    var origFetch = window.fetch;
    window.fetch = function(u, p) {
      if (typeof u === "string" && u.indexOf("/cdn-cgi/rum") !== -1) {
        return Promise.resolve(new Response(""));
      }
      return origFetch.apply(this, arguments);
    };
  }
})();
</script>`;

        if (html.includes("<head>")) {
          html = html.replace("<head>", `<head><base href="${origin}/">${rumInterceptor}`);
        } else {
          html = `<base href="${origin}/">${rumInterceptor}` + html;
        }

        // Return proxied HTML without sandboxed CSP so video players execute without sandbox restrictions
        return new Response(html, {
          status: 200,
          headers: {
            ...corsHeaders,
            ...globalSecurityHeaders,
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (err: any) {
        return new Response(`Embed proxy error: ${err.message}`, {
          status: 502,
          headers: { ...corsHeaders, ...globalSecurityHeaders },
        });
      }
    }

    // ============================================================
    // API ROUTES (POWERED BY WAJIK-ANIME-API)
    // ============================================================

    // 1. Ongoing Anime
    if (pathname === "/api/pixuplay/ongoing") {
      const data = await getOngoing();
      return new Response(JSON.stringify({ status: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Completed Anime
    if (pathname === "/api/pixuplay/completed") {
      const data = await getCompleted();
      return new Response(JSON.stringify({ status: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Trending / Hot Anime (Ongoing anime sorted by rating)
    if (pathname === "/api/pixuplay/trending") {
      const data = await getTrending();
      return new Response(JSON.stringify({ status: true, data: data.slice(0, 24) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Donghua (Chinese Animation)
    if (pathname === "/api/pixuplay/donghua") {
      const data = await getDonghua();
      return new Response(JSON.stringify({ status: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Shounen & Action Anime
    if (pathname === "/api/pixuplay/shounen") {
      const data = await getAnimeByGenre("shounen");
      return new Response(
        JSON.stringify({ status: true, data: data.slice(0, 24) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Isekai & Fantasy Anime
    if (pathname === "/api/pixuplay/isekai") {
      const data = await getAnimeByGenre("isekai");
      return new Response(
        JSON.stringify({ status: true, data: data.slice(0, 24) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Masterpiece & Classics (Completed Top Rated)
    if (pathname === "/api/pixuplay/classics") {
      const completed = await getCompleted();
      return new Response(
        JSON.stringify({ status: true, data: completed.slice(0, 20) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Weekly Schedule (Senin - Minggu)
    if (pathname === "/api/pixuplay/schedule") {
      const schedule = await getSchedule();
      return new Response(JSON.stringify({ status: true, data: schedule }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. A-Z Catalog
    if (pathname === "/api/pixuplay/az") {
      const az = await getAZList();
      return new Response(JSON.stringify({ status: true, data: az }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9.5 Genre Catalog (60 anime per genre)
    if (pathname.startsWith("/api/pixuplay/genre/")) {
      const genreId = pathname.replace("/api/pixuplay/genre/", "").split("?")[0].toLowerCase().trim();
      const list = await getAnimeByGenre(genreId);
      return new Response(JSON.stringify({ status: true, data: list }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. All Anime (Combined initial cache)
    if (pathname === "/api/pixuplay/all") {
      const ongoing = await getOngoing();
      const completed = await getCompleted();
      const donghua = await getDonghua();
      const all = [...ongoing, ...completed, ...donghua];
      return new Response(JSON.stringify({ status: true, data: all }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 11. Search
    if (pathname === "/api/pixuplay/search") {
      const q = url.searchParams.get("q") || "";
      const results = await searchAnime(q);
      return new Response(JSON.stringify({ status: true, data: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 12. Anime Detail
    if (pathname.startsWith("/api/pixuplay/detail/")) {
      const animeId = pathname.replace("/api/pixuplay/detail/", "");
      const details = await getAnimeDetails(animeId);
      if (details) {
        return new Response(JSON.stringify({ status: true, data: details }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ status: false, message: "Anime not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 13. Episode List
    if (pathname.startsWith("/api/pixuplay/episodes/")) {
      const animeId = pathname.replace("/api/pixuplay/episodes/", "");
      const details = await getAnimeDetails(animeId);
      return new Response(
        JSON.stringify({ status: true, data: details?.episodeList || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 14. ★ STREAM RESOLVER (Multi-Source Real Player with Direct MP4 & Proxy Embed)
    if (pathname.startsWith("/api/pixuplay/stream/")) {
      const parts = pathname.replace("/api/pixuplay/stream/", "").split("?")[0].split("/");
      const animeIdRaw = parts[0];
      const epStr = parts[1] || "1";
      const epNum = parseInt(epStr, 10) || 1;
      const rawTitle = url.searchParams.get("title") || "Anime";

      const streamData = await resolveStream(animeIdRaw, rawTitle, epNum);

      return new Response(
        JSON.stringify({
          status: true,
          animeId: animeIdRaw,
          ...streamData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 15. ★ NOBAR (WATCH PARTY) API ENDPOINTS
    if (pathname === "/api/pixuplay/nobar/create" && req.method === "POST") {
      if (isRateLimited(`nobar_create_${clientIp}`, 10, 60000)) {
        return new Response(JSON.stringify({ status: false, message: "Terlalu banyak permintaan pembuatan room. Tunggu 1 menit." }), {
          status: 429,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json", "Retry-After": "60" },
        });
      }

      const { data: body, error: bodyError } = await parseJsonBody(req, 16384);
      if (bodyError || !body) {
        return new Response(JSON.stringify({ status: false, message: bodyError || "Request body tidak valid" }), {
          status: 400,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      // Memory safeguard: purge old rooms if count exceeds limit
      if (NOBAR_ROOMS.size >= 500) {
        cleanupExpiredRooms();
        if (NOBAR_ROOMS.size >= 500) {
          // Remove oldest rooms
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

      return new Response(
        JSON.stringify({
          status: true,
          roomId,
          hostId,
          room: newRoom,
        }),
        { headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pathname.startsWith("/api/pixuplay/nobar/room/")) {
      const parts = pathname.replace("/api/pixuplay/nobar/room/", "").split("/");
      const rawRoomId = parts[0] || "";
      const roomId = sanitizeSlug(rawRoomId, 64);
      const subAction = parts[1]; // undefined or 'sync' or 'chat'
      const room = NOBAR_ROOMS.get(roomId);

      if (!room) {
        return new Response(
          JSON.stringify({ status: false, message: "Room Nobar tidak ditemukan atau telah berakhir" }),
          { status: 404, headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" } }
        );
      }

      // Sync endpoint (HTTP fallback)
      if (subAction === "sync" && req.method === "POST") {
        const { data: body, error: bodyError } = await parseJsonBody(req, 16384);
        if (bodyError || !body) {
          return new Response(JSON.stringify({ status: false, message: bodyError || "Data tidak valid" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
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

        // Broadcast to WebSocket clients in this room
        server.publish(roomId, JSON.stringify({
          type: "sync",
          currentTime: room.currentTime,
          isPlaying: room.isPlaying,
          episode: room.episode,
          serverUrl: room.serverUrl,
          animeId: room.animeId,
          animeTitle: room.animeTitle,
          hostName: room.hostName,
          timestamp: room.lastUpdate,
        }));

        return new Response(JSON.stringify({ status: true, room }), {
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      // Disband room endpoint (by host)
      if (subAction === "disband" && req.method === "POST") {
        server.publish(roomId, JSON.stringify({
          type: "room_disbanded",
          message: "Room nobar telah dibubarkan oleh host.",
        }));
        NOBAR_ROOMS.delete(roomId);
        return new Response(JSON.stringify({ status: true, message: "Room berhasil dibubarkan" }), {
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      // Chat endpoint (HTTP fallback)
      if (subAction === "chat" && req.method === "POST") {
        if (isRateLimited(`nobar_chat_${clientIp}`, 30, 60000)) {
          return new Response(JSON.stringify({ status: false, message: "Pesan dikirim terlalu cepat." }), {
            status: 429,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: body, error: bodyError } = await parseJsonBody(req, 8192);
        if (bodyError || !body) {
          return new Response(JSON.stringify({ status: false, message: bodyError || "Data tidak valid" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const cleanText = sanitizeText(body.text, 300);
        if (!cleanText) {
          return new Response(JSON.stringify({ status: false, message: "Pesan tidak boleh kosong" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const chatItem = {
          sender: sanitizeText(body.sender || "Penonton", 30) || "Penonton",
          avatar: sanitizeSafeUrl(body.avatar) || null,
          text: cleanText,
          isHost: !!body.isHost,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        };
        room.chat = [...(room.chat || []).slice(-50), chatItem];

        server.publish(roomId, JSON.stringify({
          type: "chat",
          ...chatItem,
        }));

        return new Response(JSON.stringify({ status: true, chat: room.chat }), {
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      // Get Room State
      const elapsed = room.isPlaying ? (Date.now() - room.lastUpdate) / 1000 : 0;
      return new Response(
        JSON.stringify({
          status: true,
          room: {
            ...room,
            currentTime: room.currentTime + elapsed,
          },
        }),
        { headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // 16. ★ DYNAMIC COMMENTS & LIKES API (SQLITE WAL)
    // ============================================================
    // Get Likes and Comments for specific anime & episode
    if (pathname === "/api/pixuplay/interactions" && req.method === "GET") {
      const animeId = sanitizeSlug(url.searchParams.get("animeId") || "", 100);
      const ep = Math.max(1, Math.min(5000, parseInt(url.searchParams.get("episode") || "1", 10) || 1));
      const userId = sanitizeSlug(url.searchParams.get("userId") || "", 64);

      if (!animeId) {
        return new Response(JSON.stringify({ status: false, message: "animeId diperlukan" }), {
          status: 400,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      // Count likes for this anime & episode
      const likeRow = db.query(
        "SELECT COUNT(*) as count FROM likes WHERE anime_id = ? AND episode = ?"
      ).get(animeId, ep) as { count: number } | null;
      const likesCount = likeRow?.count || 0;

      // Check if this user has liked
      let hasLiked = false;
      if (userId) {
        const userLike = db.query(
          "SELECT id FROM likes WHERE anime_id = ? AND episode = ? AND user_id = ? LIMIT 1"
        ).get(animeId, ep, userId);
        hasLiked = !!userLike;
      }

      // Retrieve comments with threaded replies (limited to 300 to prevent DoS)
      const allRows = db.query(
        "SELECT id, anime_id, episode, parent_id, reply_to_user, user_id, user_name, user_avatar, text, created_at FROM comments WHERE anime_id = ? AND episode = ? ORDER BY id ASC LIMIT 300"
      ).all(animeId, ep) as any[];

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

      return new Response(
        JSON.stringify({
          status: true,
          animeId,
          episode: ep,
          likesCount,
          hasLiked,
          comments: topLevelComments,
        }),
        { headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" } }
      );
    }

    // Post new comment or reply (with rate limiting & validation)
    if (pathname === "/api/pixuplay/comments" && req.method === "POST") {
      if (isRateLimited(`comment_${clientIp}`, 12, 60000)) {
        return new Response(JSON.stringify({ status: false, message: "Komentar terlalu cepat. Silakan tunggu 1 menit." }), {
          status: 429,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json", "Retry-After": "60" },
        });
      }

      try {
        const { data: body, error: bodyError } = await parseJsonBody(req, 32768);
        if (bodyError || !body) {
          return new Response(JSON.stringify({ status: false, message: bodyError || "Data komentar tidak valid" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const animeId = sanitizeSlug(body.animeId || "", 100);
        const episode = Math.max(1, Math.min(5000, parseInt(String(body.episode || "1"), 10) || 1));
        const parentId = body.parentId ? parseInt(String(body.parentId), 10) : null;
        const replyToUser = body.replyToUser ? sanitizeText(body.replyToUser, 40) : null;
        const userId = sanitizeSlug(body.userId || "", 64) || `guest_${Math.random().toString(36).slice(2, 10)}`;
        const userName = sanitizeText(body.userName || "Guest", 40) || "Guest";
        const userAvatar = sanitizeSafeUrl(body.userAvatar);
        const text = sanitizeText(body.text, 500);

        if (!animeId) {
          return new Response(JSON.stringify({ status: false, message: "animeId diperlukan" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        if (!text) {
          return new Response(JSON.stringify({ status: false, message: "Teks komentar tidak boleh kosong" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        // If parentId provided, verify parent exists
        if (parentId) {
          const parentRow = db.query("SELECT id FROM comments WHERE id = ? AND anime_id = ? AND episode = ?").get(parentId, animeId, episode);
          if (!parentRow) {
            return new Response(JSON.stringify({ status: false, message: "Komentar induk tidak ditemukan" }), {
              status: 400,
              headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
            });
          }
        }

        const insertStmt = db.prepare(
          "INSERT INTO comments (anime_id, episode, parent_id, reply_to_user, user_id, user_name, user_avatar, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at"
        );
        const result = insertStmt.get(animeId, episode, parentId, replyToUser, userId, userName, userAvatar, text) as { id: number; created_at: string };

        const newComment = {
          id: result.id,
          userId: userId,
          parentId: parentId,
          replyToUser: replyToUser,
          user: userName,
          avatar: userAvatar,
          text: text,
          createdAt: result.created_at,
          time: "Baru saja",
          replies: [],
        };

        return new Response(
          JSON.stringify({
            status: true,
            comment: newComment,
          }),
          { headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ status: false, message: err.message }), {
          status: 500,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Delete comment (own comment only, strictly verified)
    if (pathname === "/api/pixuplay/comments/delete" && req.method === "POST") {
      if (isRateLimited(`comment_del_${clientIp}`, 20, 60000)) {
        return new Response(JSON.stringify({ status: false, message: "Terlalu banyak permintaan penghapusan." }), {
          status: 429,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const { data: body, error: bodyError } = await parseJsonBody(req, 8192);
        if (bodyError || !body) {
          return new Response(JSON.stringify({ status: false, message: bodyError || "Data tidak valid" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const commentId = parseInt(String(body.commentId || "0"), 10);
        const userId = sanitizeSlug(body.userId || "", 64);

        if (!commentId || !userId) {
          return new Response(JSON.stringify({ status: false, message: "commentId dan userId diperlukan" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const comment = db.query("SELECT id, user_id FROM comments WHERE id = ?").get(commentId) as { id: number; user_id: string } | null;
        if (!comment) {
          return new Response(JSON.stringify({ status: false, message: "Komentar tidak ditemukan" }), {
            status: 404,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const sessionUser = getSessionUser(req);
        const isAuthorized = comment.user_id === userId || (sessionUser && (sessionUser.id === comment.user_id || sessionUser.name === (comment as any).user_name));

        if (!isAuthorized) {
          return new Response(JSON.stringify({ status: false, message: "Anda hanya dapat menghapus komentar milik Anda sendiri" }), {
            status: 403,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        // Delete comment and its replies safely
        db.query("DELETE FROM comments WHERE id = ? OR parent_id = ?").run(commentId, commentId);

        return new Response(JSON.stringify({ status: true, message: "Komentar berhasil dihapus", commentId }), {
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ status: false, message: err.message }), {
          status: 500,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Toggle like (with rate limiting & validation)
    if (pathname === "/api/pixuplay/likes/toggle" && req.method === "POST") {
      if (isRateLimited(`like_${clientIp}`, 40, 60000)) {
        return new Response(JSON.stringify({ status: false, message: "Terlalu banyak permintaan suka. Tunggu beberapa saat." }), {
          status: 429,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const { data: body, error: bodyError } = await parseJsonBody(req, 8192);
        if (bodyError || !body) {
          return new Response(JSON.stringify({ status: false, message: bodyError || "Data tidak valid" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const animeId = sanitizeSlug(body.animeId || "", 100);
        const episode = Math.max(1, Math.min(5000, parseInt(String(body.episode || "1"), 10) || 1));
        const userId = sanitizeSlug(body.userId || "", 64);

        if (!animeId || !userId) {
          return new Response(JSON.stringify({ status: false, message: "animeId dan userId diperlukan" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const existing = db.query(
          "SELECT id FROM likes WHERE anime_id = ? AND episode = ? AND user_id = ?"
        ).get(animeId, episode, userId);

        let hasLiked = false;
        if (existing) {
          db.query(
            "DELETE FROM likes WHERE anime_id = ? AND episode = ? AND user_id = ?"
          ).run(animeId, episode, userId);
          hasLiked = false;
        } else {
          db.query(
            "INSERT OR IGNORE INTO likes (anime_id, episode, user_id) VALUES (?, ?, ?)"
          ).run(animeId, episode, userId);
          hasLiked = true;
        }

        const countRow = db.query(
          "SELECT COUNT(*) as count FROM likes WHERE anime_id = ? AND episode = ?"
        ).get(animeId, episode) as { count: number } | null;

        return new Response(
          JSON.stringify({
            status: true,
            animeId,
            episode,
            hasLiked,
            likesCount: countRow?.count || 0,
          }),
          { headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ status: false, message: err.message }), {
          status: 500,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ============================================================
    // GOOGLE OAUTH 2.0 & CLOUD SYNC ENDPOINTS
    // ============================================================

    // 1. Google OAuth Token Verification & Login
    if (pathname === "/api/pixuplay/auth/google" && req.method === "POST") {
      if (isRateLimited(`auth_${clientIp}`, 30, 60000)) {
        return new Response(JSON.stringify({ status: false, message: "Terlalu banyak percobaan masuk. Tunggu 1 menit." }), {
          status: 429,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const { data: body, error: bodyError } = await parseJsonBody(req, 1048576);
        if (bodyError || !body || !body.credential) {
          return new Response(JSON.stringify({ status: false, message: "Token kredensial Google diperlukan" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const credential = String(body.credential).trim();
        // Verify Google ID token via Google OAuth2 tokeninfo endpoint
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (!googleRes.ok) {
          const errText = await googleRes.text().catch(() => "");
          console.warn("[Google Auth] Token verification failed:", googleRes.status, errText);
          return new Response(JSON.stringify({ status: false, message: "Kredensial Google tidak valid atau kedaluwarsa" }), {
            status: 401,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const payload: any = await googleRes.json();
        if (payload.aud !== GOOGLE_CLIENT_ID) {
          console.warn(`[Google Auth] Client ID mismatch: expected ${GOOGLE_CLIENT_ID}, received ${payload.aud}`);
          return new Response(JSON.stringify({ status: false, message: "ID Klien aplikasi tidak sesuai" }), {
            status: 403,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const googleId = String(payload.sub || "").trim();
        const email = String(payload.email || "").trim().toLowerCase();
        const name = sanitizeText(String(payload.name || email.split("@")[0] || "Pengguna Pixuplay"), 50);
        const avatar = String(payload.picture || "").trim();

        if (!googleId || !email) {
          return new Response(JSON.stringify({ status: false, message: "Data profil Google tidak lengkap" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const eHash = hashSensitive(email);
        const eEnc = encryptSensitive(email);
        const masked = maskEmail(email);
        const isSupport = email === "pixuplay.support@gmail.com";

        // Upsert user in SQLite
        const existingUser = db.query("SELECT * FROM users WHERE google_id = ? OR email_hash = ?").get(googleId, eHash) as any;
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
          // Ensure uniqueness of username
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
            tagId = isSupport ? 1 : (Math.max(1, (db.query("SELECT MAX(tag_id) as maxTag FROM users").get() as any)?.maxTag || 1) + 1);
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

        const watchSec = existingUser ? (existingUser.watch_time_seconds || 0) : 0;
        const totalExp = existingUser ? (existingUser.exp || 0) : 0;
        const levelData = calculateLevelData(totalExp);

        // Generate session token (30 days validity)
        const sessionToken = `px_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        db.query("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
          sessionToken,
          userId,
          expiresAt
        );

        // Fetch existing cloud synced data
        const syncRow = db.query("SELECT * FROM user_sync WHERE user_id = ?").get(userId) as any;
        let cloudHistory: any[] = [];
        let cloudFavorites: any[] = [];
        let cloudWatchlist: any[] = [];
        if (syncRow) {
          try { cloudHistory = JSON.parse(syncRow.history_json || "[]"); } catch {}
          try { cloudFavorites = JSON.parse(syncRow.favorites_json || "[]"); } catch {}
          try { cloudWatchlist = JSON.parse(syncRow.watchlist_json || "[]"); } catch {}
        }

        // Return user's pure cloud synced data - guest data is isolated to prevent duplicate account exploits
        return new Response(
          JSON.stringify({
            status: true,
            user: {
              id: userId,
              email: email,
              maskedEmail: masked,
              name: finalName,
              avatar: existingUser?.avatar || avatar,
              tagId: tagId,
              watchTimeSeconds: watchSec,
              exp: totalExp,
              level: levelData.level,
              currentLevelExp: levelData.currentLevelExp,
              nextLevelExp: levelData.nextLevelExp,
              progressPercent: levelData.progressPercent,
            },
            token: sessionToken,
            syncedData: {
              history: cloudHistory,
              favorites: cloudFavorites,
              watchlist: cloudWatchlist,
            },
          }),
          { headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        console.error("[Google Auth Error]", err);
        return new Response(JSON.stringify({ status: false, message: err.message || "Gagal masuk" }), {
          status: 500,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Get Current Authenticated Profile
    if (pathname === "/api/pixuplay/auth/me" && req.method === "GET") {
      const user = getSessionUser(req);
      if (!user) {
        return new Response(JSON.stringify({ status: false, message: "Sesi tidak valid atau telah berakhir" }), {
          status: 401,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ status: true, user }), {
        headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Logout
    if (pathname === "/api/pixuplay/auth/logout" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "").trim();
        if (token) {
          try {
            db.query("DELETE FROM user_sessions WHERE token = ?").run(token);
          } catch {}
        }
      }
      return new Response(JSON.stringify({ status: true, message: "Berhasil keluar" }), {
        headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Get User Cloud Sync Data
    if (pathname === "/api/pixuplay/user/data" && req.method === "GET") {
      const user = getSessionUser(req);
      if (!user) {
        return new Response(JSON.stringify({ status: false, message: "Akses ditolak" }), {
          status: 401,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }
      const syncRow = db.query("SELECT * FROM user_sync WHERE user_id = ?").get(user.id) as any;
      let history: any[] = [];
      let favorites: any[] = [];
      let watchlist: any[] = [];
      if (syncRow) {
        try { history = JSON.parse(syncRow.history_json || "[]"); } catch {}
        try { favorites = JSON.parse(syncRow.favorites_json || "[]"); } catch {}
        try { watchlist = JSON.parse(syncRow.watchlist_json || "[]"); } catch {}
      }
      return new Response(
        JSON.stringify({
          status: true,
          user,
          history,
          favorites,
          watchlist,
        }),
        { headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Push Updated History / Watchlist / Favorites to Cloud
    if (pathname === "/api/pixuplay/user/sync" && req.method === "POST") {
      const user = getSessionUser(req);
      if (!user) {
        return new Response(JSON.stringify({ status: false, message: "Akses ditolak" }), {
          status: 401,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const { data: body, error: bodyError } = await parseJsonBody(req, 1048576);
        if (bodyError || !body) {
          return new Response(JSON.stringify({ status: false, message: bodyError || "Data tidak valid" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const syncRow = db.query("SELECT * FROM user_sync WHERE user_id = ?").get(user.id) as any;
        let currentHistory = syncRow?.history_json ? JSON.parse(syncRow.history_json) : [];
        let currentFavorites = syncRow?.favorites_json ? JSON.parse(syncRow.favorites_json) : [];
        let currentWatchlist = syncRow?.watchlist_json ? JSON.parse(syncRow.watchlist_json) : [];

        if (Array.isArray(body.history)) {
          currentHistory = body.history.slice(0, 500);
        }
        if (Array.isArray(body.favorites)) {
          currentFavorites = body.favorites.slice(0, 500);
        }
        if (Array.isArray(body.watchlist)) {
          currentWatchlist = body.watchlist.slice(0, 500);
        }

        db.query(`
          INSERT INTO user_sync (user_id, history_json, favorites_json, watchlist_json, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET
            history_json = excluded.history_json,
            favorites_json = excluded.favorites_json,
            watchlist_json = excluded.watchlist_json,
            updated_at = CURRENT_TIMESTAMP
        `).run(user.id, JSON.stringify(currentHistory), JSON.stringify(currentFavorites), JSON.stringify(currentWatchlist));

        return new Response(JSON.stringify({ status: true, message: "Sinkronisasi berhasil disimpan" }), {
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ status: false, message: err.message }), {
          status: 500,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 6. Update User Avatar
    if (pathname === "/api/pixuplay/user/avatar" && req.method === "POST") {
      const user = getSessionUser(req);
      if (!user) {
        return new Response(JSON.stringify({ status: false, message: "Akses ditolak" }), {
          status: 401,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const { data: body, error: bodyError } = await parseJsonBody(req, 2097152);
        if (bodyError || !body || !body.avatar) {
          return new Response(JSON.stringify({ status: false, message: "Foto profil diperlukan" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const avatarUrl = String(body.avatar);
        db.query("UPDATE users SET avatar = ? WHERE id = ?").run(avatarUrl, user.id);

        return new Response(
          JSON.stringify({
            status: true,
            avatar: avatarUrl,
            message: "Foto profil berhasil diperbarui",
          }),
          { headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ status: false, message: err.message }), {
          status: 500,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 7. Change Display Name (Unique case-insensitive validation)
    if (pathname === "/api/pixuplay/user/change-name" && req.method === "POST") {
      const user = getSessionUser(req);
      if (!user) {
        return new Response(JSON.stringify({ status: false, message: "Akses ditolak. Silakan login terlebih dahulu." }), {
          status: 401,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const { data: body, error: bodyError } = await parseJsonBody(req, 4096);
        if (bodyError || !body) {
          return new Response(JSON.stringify({ status: false, message: bodyError || "Data tidak valid" }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        const requestedName = sanitizeText(String(body.name || ""), 30).trim();
        if (requestedName.length < 2 || requestedName.length > 30) {
          return new Response(JSON.stringify({ status: false, message: "Nama tampilan harus terdiri dari 2 hingga 30 karakter." }), {
            status: 400,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        // Case-insensitive uniqueness check against all other registered users
        const duplicate = db.query("SELECT id FROM users WHERE LOWER(name) = LOWER(?) AND id != ?").get(requestedName, user.id);
        if (duplicate) {
          return new Response(JSON.stringify({ status: false, message: "Nama tampilan tersebut sudah digunakan oleh pengguna lain. Silakan pilih nama lain." }), {
            status: 409,
            headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
          });
        }

        // Update name in users table and all comments written by this user
        db.query("UPDATE users SET name = ? WHERE id = ?").run(requestedName, user.id);
        db.query("UPDATE comments SET user_name = ? WHERE user_id = ?").run(requestedName, user.id);

        user.name = requestedName;

        return new Response(JSON.stringify({
          status: true,
          message: "Nama tampilan berhasil diperbarui",
          user,
        }), {
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ status: false, message: err.message || "Gagal mengubah nama" }), {
          status: 500,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 8. Watch Time Heartbeat & EXP / Level Progression
    if (pathname === "/api/pixuplay/user/watch-heartbeat" && req.method === "POST") {
      const user = getSessionUser(req);
      if (!user) {
        return new Response(JSON.stringify({ status: false, message: "Akses ditolak" }), {
          status: 401,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const { data: body } = await parseJsonBody(req, 2048);
        const seconds = Math.max(1, Math.min(60, Number(body?.seconds) || 15));
        const isRewatch = !!body?.isRewatch;

        const row = db.query("SELECT watch_time_seconds, exp FROM users WHERE id = ?").get(user.id) as any;
        const currentSec = Number(row?.watch_time_seconds) || 0;
        const currentExp = Number(row?.exp) || 0;

        const newSec = currentSec + seconds;
        const expGained = Math.round(seconds * (10 / 60)) + (isRewatch ? 25 : 0);
        const newExp = currentExp + expGained;

        const levelInfo = calculateLevelData(newExp);

        db.query("UPDATE users SET watch_time_seconds = ?, exp = ?, level = ? WHERE id = ?").run(
          newSec,
          newExp,
          levelInfo.level,
          user.id
        );

        user.watchTimeSeconds = newSec;
        user.exp = newExp;
        user.level = levelInfo.level;

        return new Response(JSON.stringify({
          status: true,
          user: {
            watchTimeSeconds: newSec,
            exp: newExp,
            level: levelInfo.level,
            currentLevelExp: levelInfo.currentLevelExp,
            nextLevelExp: levelInfo.nextLevelExp,
            progressPercent: levelInfo.progressPercent,
          }
        }), {
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ status: false, message: err.message }), {
          status: 500,
          headers: { ...corsHeaders, ...globalSecurityHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ============================================================
    // STATIC FILE SERVING WITH STRICT PATH CONTAINMENT & PROTECTION
    // ============================================================
    const hasDist = await Bun.file(join(BASE_DIR, "dist", "index.html")).exists();
    const staticDir = hasDist ? join(BASE_DIR, "dist") : BASE_DIR;

    // Reject path traversal attempts immediately
    if (
      pathname.includes("..") ||
      pathname.includes("%2e") ||
      pathname.includes("%2E") ||
      pathname.includes("\0")
    ) {
      return new Response("Forbidden", {
        status: 403,
        headers: { ...corsHeaders, ...globalSecurityHeaders },
      });
    }

    // Block sensitive extensions, dotfiles, and system files from being served
    const lowerPath = pathname.toLowerCase();
    const forbiddenExtensions = [
      ".db",
      ".db-shm",
      ".db-wal",
      ".ts",
      ".tsx",
      ".env",
      ".lock",
      ".sock",
      ".map",
      ".log",
    ];
    const forbiddenFiles = [
      "/package.json",
      "/tsconfig.json",
      "/bun.lock",
      "/server.ts",
      "/app.js",
      "/.ds_store",
    ];

    if (
      forbiddenExtensions.some((ext) => lowerPath.endsWith(ext)) ||
      forbiddenFiles.includes(lowerPath) ||
      lowerPath.includes("/.")
    ) {
      return new Response("Forbidden", {
        status: 403,
        headers: { ...corsHeaders, ...globalSecurityHeaders },
      });
    }

    if (pathname === "/privacy" || pathname === "/privacy/") {
      const pFile = Bun.file(join(staticDir, "privacy.html"));
      if (await pFile.exists()) {
        return new Response(pFile, {
          headers: {
            ...corsHeaders,
            ...globalSecurityHeaders,
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }

    if (pathname === "/terms" || pathname === "/terms/") {
      const tFile = Bun.file(join(staticDir, "terms.html"));
      if (await tFile.exists()) {
        return new Response(tFile, {
          headers: {
            ...corsHeaders,
            ...globalSecurityHeaders,
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }

    const safeRelPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const resolvedPath = join(staticDir, safeRelPath);

    // Strict containment verification
    if (!resolvedPath.startsWith(staticDir)) {
      return new Response("Forbidden", {
        status: 403,
        headers: { ...corsHeaders, ...globalSecurityHeaders },
      });
    }

    let file = Bun.file(resolvedPath);

    if (!(await file.exists())) {
      // Fallback to index.html for Single Page Application client-side routing
      const fallbackPath = join(staticDir, "index.html");
      file = Bun.file(fallbackPath);
    }

    const ext = pathname.substring(pathname.lastIndexOf(".")).toLowerCase();
    const contentType = MIME_TYPES[ext] || "text/html; charset=utf-8";

    // Immutable caching for hashed assets, no-cache for index.html
    const isImmutableAsset = pathname.startsWith("/assets/") && (ext === ".js" || ext === ".css" || ext === ".svg" || ext === ".webp" || ext === ".png" || ext === ".jpg");
    const cacheControl = isImmutableAsset
      ? "public, max-age=31536000, immutable"
      : "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";

    return new Response(file, {
      headers: {
        ...corsHeaders,
        ...globalSecurityHeaders,
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  },
  websocket: {
    open(ws: any) {
      const d = ws.data as any;
      ws.subscribe(d.roomId);
      const room = NOBAR_ROOMS.get(d.roomId);
      if (room) {
        const elapsed = room.isPlaying ? (Date.now() - room.lastUpdate) / 1000 : 0;
        ws.send(JSON.stringify({
          type: "room_state",
          room: {
            ...room,
            currentTime: room.currentTime + elapsed,
          },
        }));
      }
      server.publish(d.roomId, JSON.stringify({
        type: "user_joined",
        name: d.name,
        role: d.role,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      }));
    },
    message(ws: any, rawMsg: any) {
      try {
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
          ws.publish(roomId, JSON.stringify({
            type: "sync",
            currentTime: typeof msg.currentTime === "number" ? msg.currentTime : room?.currentTime || 0,
            isPlaying: typeof msg.isPlaying === "boolean" ? msg.isPlaying : room?.isPlaying || true,
            episode: msg.episode || room?.episode || 1,
            serverUrl: msg.serverUrl || room?.serverUrl || "",
            animeId: msg.animeId || room?.animeId || "",
            animeTitle: msg.animeTitle || room?.animeTitle || "",
            hostName: d.name,
            timestamp: Date.now(),
          }));
        } else if (msg.type === "disband") {
          server.publish(roomId, JSON.stringify({
            type: "room_disbanded",
            message: "Room nobar telah dibubarkan oleh host.",
          }));
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
            server.publish(roomId, JSON.stringify({
              type: "chat",
              ...chatItem,
            }));
          }
        } else if (msg.type === "reaction") {
          const emoji = sanitizeText(msg.emoji, 10);
          if (emoji) {
            server.publish(roomId, JSON.stringify({
              type: "reaction",
              emoji: emoji,
              sender: d.name,
            }));
          }
        }
      } catch (err) {
        console.warn("WS message parse error:", err);
      }
    },
    close(ws: any) {
      const d = ws.data as any;
      ws.unsubscribe(d.roomId);
      server.publish(d.roomId, JSON.stringify({
        type: "user_left",
        name: d.name,
      }));
    },
  },
});

console.log(`[Pixuplay Server] 🚀 Pixuplay Backend is live at http://localhost:${PORT}`);
console.log(`[Pixuplay Server] 📡 All-in-One Backend (API + Nobar WebSocket + Scrapers) on Port ${PORT}`);
