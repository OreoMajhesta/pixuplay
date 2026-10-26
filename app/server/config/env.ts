import { resolve, join } from "path";
import crypto from "crypto";

export const PORT = parseInt(process.env.PORT || "15006", 10);
// Root of app/
export const APP_ROOT = resolve(import.meta.dir, "../..");
export const DIST_DIR = join(APP_ROOT, "dist");
export const PUBLIC_DIR = join(APP_ROOT, "public");
export const DB_PATH = join(APP_ROOT, "pixuplay.db");
export const SCRAPER_SOCKET = "/tmp/pixuplay_scraper.sock";

export const WAJIK_API = `http://localhost:${PORT}`;

// Security secrets & keys
export const APP_SALT = process.env.APP_SALT || "pixuplay_master_salt_key_2026_x89f";
export const CIPHER_KEY = crypto
  .createHash("sha256")
  .update(process.env.APP_CIPHER_SECRET || "pixuplay_cipher_secret_32bytes_key!")
  .digest();

export const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  process.env.VITE_GOOGLE_CLIENT_ID ||
  "1042260047227-83if5kgps15jm4e8n6ebl5rb1iiu67sh.apps.googleusercontent.com";

// Cache TTLs in milliseconds
export const CACHE_TTL_SHORT = 60 * 1000;      // 1 minute (for dynamic lists)
export const CACHE_TTL_MEDIUM = 300 * 1000;    // 5 minutes (for catalogs & schedules)
export const CACHE_TTL_LONG = 600 * 1000;      // 10 minutes (for stable details)
export const CACHE_TTL_STREAM = 1800 * 1000;   // 30 minutes (for resolved streams)
