import { WAJIK_API, CACHE_TTL_SHORT } from "../config/env";
import { CACHE } from "../cache/memoryCache";
import { fetchJson } from "./animeService";

function extractMp4FromHtml(html: string): string | null {
  const isUsable = (u: string) => {
    if (!u) return false;
    const lower = u.toLowerCase();
    return !lower.includes("googlevideo.com") && !lower.includes("analytics") && !lower.includes("beacon");
  };

  let m = html.match(/const\s+videoURL\s*=\s*["']([^"']+)["']/);
  if (m && isUsable(m[1])) return m[1];

  m = html.match(/file\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/);
  if (m && isUsable(m[1])) return m[1];

  m = html.match(/<source\s+src=["']([^"']+)["']/);
  if (m) {
    const candidate = m[1].replace(/&amp;/g, "&");
    if (isUsable(candidate)) return candidate;
  }

  const allMp4s = html.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/g);
  if (allMp4s) {
    for (const raw of allMp4s) {
      const clean = raw.replace(/["']/g, "").replace(/&amp;/g, "&");
      if (isUsable(clean)) return clean;
    }
  }

  return null;
}

export async function extractDirectStream(desustreamUrl: string): Promise<string | null> {
  if (CACHE.extractedMp4.has(desustreamUrl)) {
    return CACHE.extractedMp4.get(desustreamUrl)!;
  }

  try {
    const res = await fetch(desustreamUrl, {
      headers: {
        Referer: "https://otakudesu.blog/",
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

export async function checkOdcloudResolutions(baseMp4Url: string): Promise<Array<{ quality: string; url: string }>> {
  const m = baseMp4Url.match(/(.*[_\-\. ])(1080p|720p|480p|360p)(.*)/i);
  if (!m) return [];

  const prefix = m[1];
  const suffix = m[3];
  const currentQuality = m[2].toLowerCase();

  const otherQualities = ["1080p", "720p", "480p", "360p"].filter((q) => q !== currentQuality);

  const checks = otherQualities.map(async (q) => {
    const testUrl = `${prefix}${q}${suffix}`;
    try {
      const res = await fetch(testUrl, {
        method: "HEAD",
        headers: {
          Referer: "https://otakudesu.blog/",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
        },
        signal: AbortSignal.timeout(900),
      });
      if (res.ok) {
        return { quality: q, url: testUrl };
      }
    } catch {}
    return null;
  });

  const resolved = await Promise.all(checks);
  return resolved.filter(Boolean) as Array<{ quality: string; url: string }>;
}

const CACHE_TTL_STREAM = 15 * 60 * 1000; // 15 minutes stream cache

export async function resolveStream(
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
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_STREAM) {
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
    let otakuSlug: string | null = null;
    if (animeIdOrSlug && isNaN(Number(animeIdOrSlug))) {
      otakuSlug = animeIdOrSlug;
    } else {
      const sJson = await fetchJson(`${WAJIK_API}/otakudesu/search?q=${encodeURIComponent(cleanTitle)}`);
      const sList = sJson?.data?.animeList || [];
      if (sList.length > 0) otakuSlug = sList[0].animeId;
    }

    if (otakuSlug) {
      const epJson = await fetchJson(`${WAJIK_API}/otakudesu/anime/${otakuSlug}`);
      const rawEpisodes: any[] = epJson?.data?.details?.episodeList || [];
      const validEpisodes = rawEpisodes.filter((ep: any) => !ep.episodeId?.includes("pembatas"));

      if (validEpisodes.length > 0) {
        let targetEp = validEpisodes.find((ep: any) => {
          const num = parseInt(String(ep.title).replace(/[^0-9]/g, ""), 10);
          return num === epNum || String(ep.title).trim() === String(epNum);
        });

        if (!targetEp) {
          targetEp = validEpisodes.find(
            (ep: any) =>
              ep.episodeId?.toLowerCase().includes(`-episode-${epNum}-`) ||
              ep.episodeId?.toLowerCase().endsWith(`-episode-${epNum}`)
          );
        }

        if (!targetEp) {
          targetEp = validEpisodes[validEpisodes.length - 1];
        }

        if (targetEp?.episodeId) {
          const sRes = await fetchJson(`${WAJIK_API}/otakudesu/episode/${targetEp.episodeId}`);
          const details = sRes?.data?.details;
          const directStreams: Array<{ quality: string; url: string }> = [];

          if (details?.defaultStreamingUrl) {
            const directMp4 = await extractDirectStream(details.defaultStreamingUrl);
            if (directMp4) {
              const qMatch = directMp4.match(/(1080p|720p|480p|360p)/i);
              const detectedQ = qMatch ? qMatch[1].toLowerCase() : "720p";
              directStreams.push({ quality: detectedQ, url: directMp4 });

              const altResolutions = await checkOdcloudResolutions(directMp4);
              for (const alt of altResolutions) {
                if (!directStreams.some((s) => s.url === alt.url || s.quality === alt.quality)) {
                  directStreams.push(alt);
                }
              }
            }
          }

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

          const qualityRank: Record<string, number> = { "1080p": 1, "720p": 2, "480p": 3, "360p": 4 };
          directStreams.sort((a, b) => (qualityRank[a.quality] || 9) - (qualityRank[b.quality] || 9));

          const labelMap: Record<string, string> = {
            "1080p": "1080p Full HD",
            "720p": "720p HD",
            "480p": "480p SD",
            "360p": "360p Hemat",
          };

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
