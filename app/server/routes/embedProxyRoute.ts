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
  const targetUrl = url.searchParams.get("url");
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

    return new Response(html, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        ...globalSecurityHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
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
