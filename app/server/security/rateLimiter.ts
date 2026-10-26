export const globalSecurityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

export function isRateLimited(key: string, limit: number, windowMs = 60000): boolean {
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

export function getClientIp(req: Request, srv?: any): string {
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
    if (srv && srv.requestIP) {
      const srvIp = srv.requestIP(req)?.address;
      if (srvIp) return srvIp;
    }
  } catch {}
  return "127.0.0.1";
}

export async function parseJsonBody(req: Request, maxBytes = 65536): Promise<{ data?: any; error?: string }> {
  const cl = req.headers.get("content-length");
  if (cl && parseInt(cl, 10) > maxBytes) {
    return { error: "Payload terlalu besar (Maksimal 64KB)" };
  }

  try {
    const text = await req.text();
    if (text.length > maxBytes) {
      return { error: "Payload terlalu besar (Maksimal 64KB)" };
    }
    const data = JSON.parse(text);
    return { data };
  } catch {
    return { error: "Format data JSON tidak valid" };
  }
}

export function jsonResponse(data: any, status = 200, customHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...globalSecurityHeaders,
      ...customHeaders,
    },
  });
}
