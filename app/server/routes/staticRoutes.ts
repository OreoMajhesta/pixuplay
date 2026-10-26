import { join } from "path";
import Bun from "bun";
import { APP_ROOT, DIST_DIR, PUBLIC_DIR } from "../config/env";
import { globalSecurityHeaders } from "../security/rateLimiter";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export async function handleStaticFile(pathname: string): Promise<Response> {
  const hasDist = await Bun.file(join(DIST_DIR, "index.html")).exists();
  const staticDir = hasDist ? DIST_DIR : APP_ROOT;

  // Reject path traversal attempts immediately
  if (
    pathname.includes("..") ||
    pathname.includes("%2e") ||
    pathname.includes("%2E") ||
    pathname.includes("\0")
  ) {
    return new Response("Forbidden", {
      status: 403,
      headers: globalSecurityHeaders,
    });
  }

  // Block sensitive extensions and hidden files
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
    "/.ds_store",
  ];

  if (
    forbiddenExtensions.some((ext) => lowerPath.endsWith(ext)) ||
    forbiddenFiles.includes(lowerPath) ||
    lowerPath.includes("/.")
  ) {
    return new Response("Forbidden", {
      status: 403,
      headers: globalSecurityHeaders,
    });
  }

  // Explicit /privacy route
  if (pathname === "/privacy" || pathname === "/privacy/") {
    const pFile = Bun.file(join(staticDir, "privacy.html"));
    if (await pFile.exists()) {
      return new Response(pFile, {
        headers: {
          ...globalSecurityHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  // Explicit /terms route
  if (pathname === "/terms" || pathname === "/terms/") {
    const tFile = Bun.file(join(staticDir, "terms.html"));
    if (await tFile.exists()) {
      return new Response(tFile, {
        headers: {
          ...globalSecurityHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  const safeRelPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let resolvedPath = join(staticDir, safeRelPath);

  // If not found in dist, also check public/ directory
  let file = Bun.file(resolvedPath);
  if (!(await file.exists())) {
    const publicPath = join(PUBLIC_DIR, safeRelPath);
    const pubFile = Bun.file(publicPath);
    if (await pubFile.exists()) {
      file = pubFile;
    } else {
      // Fallback to index.html for Single Page Application client-side routing
      const fallbackPath = join(staticDir, "index.html");
      file = Bun.file(fallbackPath);
    }
  }

  const ext = pathname.substring(pathname.lastIndexOf(".")).toLowerCase();
  const contentType = MIME_TYPES[ext] || "text/html; charset=utf-8";

  // Immutable caching for hashed assets, no-cache for index.html
  const isImmutableAsset =
    pathname.startsWith("/assets/") &&
    (ext === ".js" || ext === ".css" || ext === ".svg" || ext === ".webp" || ext === ".png" || ext === ".jpg");
  const cacheControl = isImmutableAsset
    ? "public, max-age=31536000, immutable"
    : "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";

  return new Response(file, {
    headers: {
      ...globalSecurityHeaders,
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    },
  });
}
