import { isSafeProxyUrl } from "../security/crypto";
import { isRateLimited, globalSecurityHeaders } from "../security/rateLimiter";

export async function handleVideoProxy(req: Request, clientIp: string): Promise<Response> {
  // Rate limit: 240 video requests per minute per IP to allow range requests & buffering
  if (isRateLimited(`videoproxy_${clientIp}`, 240, 60000)) {
    return new Response("Terlalu banyak permintaan video streaming. Mohon tunggu sebentar.", {
      status: 429,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...globalSecurityHeaders,
        "Retry-After": "30",
      },
    });
  }

  const url = new URL(req.url);
  let targetUrl = url.searchParams.get("url") || "";
  let desustreamPageUrl = url.searchParams.get("desustream") || "";

  while (targetUrl.includes("/api/pixuplay/video-proxy?url=")) {
    targetUrl = decodeURIComponent(targetUrl.split("/api/pixuplay/video-proxy?url=").pop() || "");
  }
  targetUrl = targetUrl.trim();

  // If desustream page URL is provided or target is stale, extract fresh gvideo on-the-fly
  if (desustreamPageUrl) {
    try {
      const dRes = await fetch(desustreamPageUrl, {
        headers: {
          Referer: "https://otakudesu.blog/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (dRes.ok) {
        const dHtml = await dRes.text();
        const gMatch = dHtml.match(/https?:\/\/[^"'\s<>]*googlevideo\.com\/videoplayback[^"'\s<>]*/);
        if (gMatch) {
          targetUrl = gMatch[0].replace(/&amp;/g, "&");
        }
      }
    } catch {}
  }

  if (!targetUrl) {
    return new Response("Missing video url param", {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...globalSecurityHeaders,
      },
    });
  }

  if (!isSafeProxyUrl(targetUrl)) {
    return new Response("Target video URL tidak diizinkan", {
      status: 403,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...globalSecurityHeaders,
      },
    });
  }

  try {
    // Forward Range header if present
    const upstreamHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Encoding": "identity",
    };

    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      upstreamHeaders["Range"] = rangeHeader;
    }

    if (targetUrl.includes("desustream") || targetUrl.includes("otakudesu") || targetUrl.includes("googlevideo.com")) {
      upstreamHeaders["Referer"] = "https://otakudesu.blog/";
    } else if (targetUrl.includes("googleapis.com") || targetUrl.includes("drive.google.com")) {
      upstreamHeaders["Referer"] = "https://desustream.net/";
    } else if (targetUrl.includes("oploverz")) {
      upstreamHeaders["Referer"] = "https://oploverz.org/";
    }

    const upstreamRes = await fetch(targetUrl, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers: upstreamHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });

    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type, Accept");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
    responseHeaders.set("Accept-Ranges", "bytes");

    // Copy essential media streaming headers
    const copyHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "last-modified",
      "etag",
      "cache-control",
    ];

    for (const h of copyHeaders) {
      const val = upstreamRes.headers.get(h);
      if (val) responseHeaders.set(h, val);
    }

    if (!responseHeaders.get("content-type")) {
      responseHeaders.set("content-type", "video/mp4");
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(`Video proxy stream error: ${err.message}`, {
      status: 502,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...globalSecurityHeaders,
      },
    });
  }
}
