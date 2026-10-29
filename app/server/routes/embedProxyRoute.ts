import { isSafeProxyUrl } from "../security/crypto";
import { isRateLimited, globalSecurityHeaders } from "../security/rateLimiter";

export async function handleEmbedProxy(req: Request, clientIp: string): Promise<Response> {
  if (isRateLimited(`embed_${clientIp}`, 60, 60000)) {
    return new Response("Terlalu banyak permintaan embed proxy. Silakan tunggu 1 menit.", {
      status: 429,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...globalSecurityHeaders,
        "Retry-After": "60",
      },
    });
  }

  const url = new URL(req.url);
  let targetUrl = url.searchParams.get("url") || "";
  while (targetUrl.includes("/api/pixuplay/embed-proxy?url=")) {
    targetUrl = decodeURIComponent(targetUrl.split("/api/pixuplay/embed-proxy?url=").pop() || "");
  }
  targetUrl = targetUrl.trim();

  if (!targetUrl) {
    return new Response("Missing url param", {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...globalSecurityHeaders,
      },
    });
  }

  if (!isSafeProxyUrl(targetUrl)) {
    return new Response("URL tidak diizinkan atau terdeteksi tidak aman", {
      status: 403,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...globalSecurityHeaders,
      },
    });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        Referer: "https://otakudesu.blog/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });

    let html = await res.text();
    const finalTargetUrl = res.url || targetUrl;
    const baseDir = new URL("./", finalTargetUrl).href;

    // 1. Rewrite relative script and link tags to absolute URLs to guarantee Playerjs and assets load
    html = html.replace(/<script\b([^>]*)\bsrc=['"]([^'"]+)['"]([^>]*)>/gi, (match, prefix, src, suffix) => {
      try {
        const absSrc = new URL(src, finalTargetUrl).href;
        return `<script${prefix}src="${absSrc}"${suffix}>`;
      } catch {
        return match;
      }
    });

    html = html.replace(/<link\b([^>]*)\bhref=['"]([^'"]+)['"]([^>]*)>/gi, (match, prefix, href, suffix) => {
      try {
        const absHref = new URL(href, finalTargetUrl).href;
        return `<link${prefix}href="${absHref}"${suffix}>`;
      } catch {
        return match;
      }
    });

    // 2. Prevent desustream's inline script from corrupting player config with iframe's query parameters (net::ERR_INVALID_URL fix)
    html = html.replace(/location\.href\.substr\([^)]*indexOf\(['"]html\?['"]\)\s*\+\s*5\)/g, '""');

    // 3. Strip Cloudflare RUM & analytics beacon scripts to eliminate cross-origin CORS errors
    html = html.replace(/<script[^>]*cloudflareinsights[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<script[^>]*beacon\.min\.js[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<script[^>]*data-cf-beacon[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<script[^>]*cdn-cgi\/rum[^>]*>[\s\S]*?<\/script>/gi, "");

    // 4. Client-side XHR, Fetch & sendBeacon telemetry interceptor stub + keyboard shortcuts bridge
    const rumInterceptor = `<script>
(function(){
  try {
    function isTelemetryUrl(u) {
      var s = typeof u === "string" ? u : (u && u.href ? u.href : String(u || ""));
      return s.indexOf("/cdn-cgi/rum") !== -1 || s.indexOf("cloudflareinsights") !== -1 || s.indexOf("beacon.min.js") !== -1;
    }
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    var origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function(m, u) {
      try {
        if (isTelemetryUrl(u)) {
          this._isRum = true;
          return origOpen.call(this, "GET", "data:text/plain,", true);
        }
      } catch(e) {}
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function() {
      if (this._isRum) return;
      return origSetHeader.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      if (this._isRum) return;
      return origSend.apply(this, arguments);
    };
    if (window.fetch) {
      var origFetch = window.fetch;
      window.fetch = function(u, p) {
        if (isTelemetryUrl(u) || (u && typeof u === "object" && isTelemetryUrl(u.url))) {
          return Promise.resolve(new Response("", { status: 200 }));
        }
        return origFetch.apply(this, arguments);
      };
    }
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      var origBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function(u, d) {
        if (isTelemetryUrl(u)) {
          return true;
        }
        return origBeacon(u, d);
      };
    }

    function toggleIframePlay() {
      try {
        var v = document.querySelector("video");
        if (v) {
          if (v.paused) {
            v.play().catch(function(){});
          } else {
            v.pause();
          }
          return;
        }
        if (window.playerjs && typeof window.playerjs.api === "function") {
          window.playerjs.api("toggle");
          return;
        }
      } catch(err) {}
    }

    // Handle keyboard shortcuts 'f' (fullscreen) and 'Space' (play/pause) inside iframe
    window.addEventListener("keydown", function(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target || document.activeElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        if (!e.repeat && window.parent && window.parent !== window) {
          try {
            window.parent.postMessage({ type: "PIXUPLAY_TOGGLE_FULLSCREEN" }, "*");
          } catch(err) {}
        }
      } else if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        if (!e.repeat) {
          toggleIframePlay();
        }
      }
    }, true);

    // Listen for play/pause command from parent window
    window.addEventListener("message", function(e) {
      if (e.data && e.data.type === "PIXUPLAY_TOGGLE_PLAY") {
        toggleIframePlay();
      }
    });
  } catch(e) {}
})();
</script>`;

    const baseTag = `<base href="${baseDir}">`;
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${baseTag}${rumInterceptor}`);
    } else {
      html = `${baseTag}${rumInterceptor}` + html;
    }

    return new Response(html, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...globalSecurityHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    return new Response(`Embed proxy error: ${err.message}`, {
      status: 502,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...globalSecurityHeaders,
      },
    });
  }
}
