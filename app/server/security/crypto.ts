import crypto from "crypto";
import { APP_SALT, CIPHER_KEY } from "../config/env";

export function hashSensitive(val: string): string {
  return crypto.createHmac("sha256", APP_SALT).update(String(val).toLowerCase().trim()).digest("hex");
}

export function encryptSensitive(text: string): string {
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

export function decryptSensitive(ciphertext: string): string {
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

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

export interface LevelInfo {
  level: number;
  currentLevelExp: number;
  nextLevelExp: number;
  progressPercent: number;
}

export function calculateLevelData(exp: number): LevelInfo {
  let level = 1;
  let expForCurrentLevel = 0;
  while (true) {
    const expNeeded = level * 150;
    if (exp < expForCurrentLevel + expNeeded) {
      const expInCurrentLevel = exp - expForCurrentLevel;
      const progressPercent = Math.min(100, Math.max(0, Math.round((expInCurrentLevel / expNeeded) * 100)));
      return {
        level,
        currentLevelExp: expInCurrentLevel,
        nextLevelExp: expNeeded,
        progressPercent,
      };
    }
    expForCurrentLevel += expNeeded;
    level++;
    if (level >= 100) {
      return {
        level: 100,
        currentLevelExp: 15000,
        nextLevelExp: 15000,
        progressPercent: 100,
      };
    }
  }
}

export function sanitizeText(input: unknown, maxLen = 500): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/<[^>]*>?/gm, "")
    .trim()
    .slice(0, maxLen);
}

export function sanitizeSafeUrl(input: unknown): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:image/")) {
    // Allow base64 data URLs up to 2MB for user avatars
    return trimmed.length <= 2097152 ? trimmed : "";
  }
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/assets/")
  ) {
    return trimmed.slice(0, 2048);
  }
  return "";
}

export function sanitizeSlug(input: unknown, maxLen = 100): string {
  if (typeof input !== "string") return "";
  return input.trim().replace(/[^a-zA-Z0-9_\-\.]/g, "").slice(0, maxLen);
}

export function isSafeProxyUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
      return false;
    }

    const host = parsed.hostname.toLowerCase().trim();
    if (!host) return false;

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

    if (/^\d+$/.test(host) || /^0x[0-9a-fA-F]+$/.test(host)) {
      return false;
    }

    if (host.startsWith("[") || host.includes(":")) {
      return false;
    }

    const ipv4Regex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
    const ipMatch = host.match(ipv4Regex);
    if (ipMatch) {
      const p1 = parseInt(ipMatch[1], 10);
      const p2 = parseInt(ipMatch[2], 10);
      const p3 = parseInt(ipMatch[3], 10);
      const p4 = parseInt(ipMatch[4], 10);
      if (p1 > 255 || p2 > 255 || p3 > 255 || p4 > 255) return false;

      if (p1 === 0) return false;
      if (p1 === 10) return false;
      if (p1 === 127) return false;
      if (p1 === 169 && p2 === 254) return false;
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return false;
      if (p1 === 192 && p2 === 168) return false;
      if (p1 === 100 && p2 >= 64 && p2 <= 127) return false;
      if (p1 >= 224) return false;
    }

    if (!host.includes(".")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
