import type { PlayableStream, StremioStream } from "./types";

const MANIFEST_TIMEOUT_MS = 12_000;
/** Stream catalogs often scrape/debrid; 8s was too aggressive. */
const STREAM_TIMEOUT_MS = 45_000;
const STREAM_FETCH_RETRIES = 1;

type AddonConfig = { manifestUrl: URL; streamBaseUrl: URL };

function configuredAddons(): AddonConfig[] {
  return [
    process.env.STREMIO_ADDON_URLS_DEFAULT ?? "",
    process.env.STREMIO_ADDON_URLS_LATEST ??
      process.env.STREMIO_ADDON_URLS_STRICT ??
      process.env.STREMIO_ADDON_URLS_PRIMARY ??
      process.env.STREMIO_ADDON_URLS ??
      "",
    process.env.STREMIO_ADDON_URLS_EXTRA ?? "",
  ]
    .join("\n")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const manifestUrl = new URL(value);
      if (
        manifestUrl.protocol !== "https:" &&
        !(manifestUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(manifestUrl.hostname))
      ) {
        throw new Error(`Stremio addon must use HTTPS: ${manifestUrl.hostname}`);
      }
      if (!manifestUrl.pathname.endsWith("/manifest.json")) {
        manifestUrl.pathname = `${manifestUrl.pathname.replace(/\/$/, "")}/manifest.json`;
      }
      const streamBaseUrl = new URL(manifestUrl);
      streamBaseUrl.pathname = streamBaseUrl.pathname.slice(0, -"manifest.json".length);
      return { manifestUrl, streamBaseUrl };
    });
}

async function getJson(url: URL, timeoutMs: number, retries = 0): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Addon returned HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
      if (!isTimeoutError(error) || attempt >= retries) throw error;
    }
  }
  throw lastError;
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "TimeoutError" || error.name === "AbortError";
  }
  if (error instanceof Error) {
    return /timeout|aborted due to timeout/i.test(error.message);
  }
  return false;
}

function addonErrorMessage(error: unknown): string {
  if (isTimeoutError(error)) {
    return "The addon took too long to respond.";
  }
  return String(error instanceof Error ? error.message : error);
}

function stremioStreamPath(type: "movie" | "series", id: string): string {
  const safeType = encodeURIComponent(type);
  const safeId = id.includes(":") ? id : encodeURIComponent(id);
  return `stream/${safeType}/${safeId}.json`;
}

async function resolveStreamPlaybackUrl(url: string): Promise<string> {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return trimmed;
  } catch {
    return trimmed;
  }

  try {
    const response = await fetch(trimmed, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
      headers: {
        accept: "*/*",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    if (response.url && response.url !== trimmed) return response.url;
    if (response.ok) return response.url || trimmed;
  } catch {
    /* try GET range fallback below */
  }

  try {
    const response = await fetch(trimmed, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
      headers: {
        accept: "*/*",
        range: "bytes=0-1",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    if (response.url) return response.url;
  } catch {
    /* keep original */
  }

  return trimmed;
}

export { resolveStreamPlaybackUrl };

function playable(stream: StremioStream): stream is StremioStream & { url: string } {
  if (typeof stream.url !== "string") return false;
  try {
    const url = new URL(stream.url);
    return ["http:", "https:"].includes(url.protocol) && stream.behaviorHints?.notWebReady !== true;
  } catch {
    return false;
  }
}

export function hasStremioAddons(): boolean {
  return Boolean(
    process.env.STREMIO_ADDON_URLS_DEFAULT?.trim() ||
      process.env.STREMIO_ADDON_URLS_LATEST?.trim() ||
      process.env.STREMIO_ADDON_URLS_STRICT?.trim() ||
      process.env.STREMIO_ADDON_URLS_PRIMARY?.trim() ||
      process.env.STREMIO_ADDON_URLS?.trim() ||
      process.env.STREMIO_ADDON_URLS_EXTRA?.trim()
  );
}

export async function resolveStremioStreams(
  type: "movie" | "series",
  id: string,
  startAt = 0,
  preferSafari = false
) {
  const addons = configuredAddons().slice(startAt);
  const results = await Promise.all(
    addons.map((addon) => fetchAddonStreams(addon, type, id, preferSafari))
  );

  const errors: { addon: string; message: string }[] = [];
  let unsupported = 0;
  const merged: PlayableStream[] = [];
  const seenUrls = new Set<string>();

  for (const result of results) {
    if (result.error) errors.push(result.error);
    unsupported += result.unsupported;
    for (const stream of result.streams) {
      if (seenUrls.has(stream.url)) continue;
      seenUrls.add(stream.url);
      merged.push(stream);
    }
  }

  if (merged.length > 0) {
    return {
      streams: rankPlayableStreams(merged, preferSafari),
      unsupported,
      errors,
    };
  }

  return { streams: [], unsupported, errors };
}

async function fetchAddonStreams(
  { manifestUrl, streamBaseUrl }: AddonConfig,
  type: "movie" | "series",
  id: string,
  preferSafari: boolean
): Promise<{
  streams: PlayableStream[];
  unsupported: number;
  error: { addon: string; message: string } | null;
}> {
  try {
    const manifest = (await getJson(manifestUrl, MANIFEST_TIMEOUT_MS)) as {
      name?: unknown;
      resources?: unknown;
    };
    const addonName = typeof manifest.name === "string" ? manifest.name : manifestUrl.hostname;
    const streamUrl = new URL(stremioStreamPath(type, id), streamBaseUrl);
    const payload = (await getJson(streamUrl, STREAM_TIMEOUT_MS, STREAM_FETCH_RETRIES)) as {
      streams?: unknown;
    };
    const streams = Array.isArray(payload.streams) ? (payload.streams as StremioStream[]) : [];
    const playableStreams = streams
      .filter(playable)
      .map<PlayableStream>((stream, index) => ({
        url: stream.url,
        name: stream.name?.trim() || `${addonName} ${index + 1}`,
        title: stream.title?.trim() || stream.description?.trim() || null,
        addon: addonName,
        bingeGroup: stream.behaviorHints?.bingeGroup ?? null,
      }));
    const rankedStreams = rankPlayableStreams(playableStreams, preferSafari);
    return {
      streams: rankedStreams,
      unsupported: streams.length - playableStreams.length,
      error: null,
    };
  } catch (error) {
    return {
      streams: [],
      unsupported: 0,
      error: {
        addon: manifestUrl.hostname,
        message: addonErrorMessage(error),
      },
    };
  }
}

function rankPlayableStreams(streams: PlayableStream[], preferSafari: boolean): PlayableStream[] {
  const nonRipStreams = streams.filter((stream) => !isRip(stream));
  const safariStreams = preferSafari ? nonRipStreams.filter(isSafariDirectStream) : [];
  return (safariStreams.length > 0 ? safariStreams : nonRipStreams).sort((a, b) => {
    const resolutionOrder = resolutionRank(a) - resolutionRank(b);
    if (resolutionOrder !== 0) return resolutionOrder;
    const audioOrder = browserAudioRank(a) - browserAudioRank(b);
    if (audioOrder !== 0) return audioOrder;
    const seederOrder = seederCount(b) - seederCount(a);
    if (seederOrder !== 0) return seederOrder;
    const releaseOrder = releaseSourceRank(a) - releaseSourceRank(b);
    if (releaseOrder !== 0) return releaseOrder;
    return browserCompatibilityScore(b, preferSafari) - browserCompatibilityScore(a, preferSafari);
  });
}

function browserAudioRank(stream: PlayableStream): number {
  const label = `${stream.name} ${stream.title ?? ""}`;
  if (/\b(?:aac[ ._-]?2(?:\.0)?|2[ ._-]?0|stereo|mp3)\b/i.test(label)) return 0;
  if (/\b(?:5[ ._-]?1|7[ ._-]?1|6[ ._-]?ch|8[ ._-]?ch|surround|ddp|e[ ._-]?ac[ ._-]?3|ac[ ._-]?3|true[ ._-]?hd|dts(?:[ ._-]?hd)?|atmos)/i.test(label)) return 2;
  return 1;
}

function isSafariDirectStream(stream: PlayableStream): boolean {
  const label = `${stream.name} ${stream.title ?? ""} ${stream.url}`;
  if (/\.m3u8(?:$|[?&])/i.test(stream.url)) return true;
  const safeContainer = /\.(?:mp4|m4v)(?:$|[?&/])|\b(?:mp4|m4v)\b/i.test(label);
  const safeVideo = /\b(?:h[ ._-]?264|x264|avc)\b/i.test(label);
  const safeAudio = /\b(?:aac|mp3|stereo|2[ ._-]?0)\b/i.test(label);
  return safeContainer && safeVideo && safeAudio;
}

function isRip(stream: PlayableStream): boolean {
  const label = `${stream.name} ${stream.title ?? ""}`;
  return /\b[a-z0-9]*[ ._-]?rip\b/i.test(label);
}

function seederCount(stream: PlayableStream): number {
  const label = `${stream.name} ${stream.title ?? ""}`;
  const match = label.match(/(?:👤|seed(?:er)?s?\s*[:=-]?)\s*([\d,]+)/i);
  return match ? Number.parseInt(match[1].replaceAll(",", ""), 10) || 0 : 0;
}

function resolutionRank(stream: PlayableStream): number {
  const label = `${stream.name} ${stream.title ?? ""}`;
  if (/\b1080[pi]?\b/i.test(label)) return 0;
  if (/\b(2160p?|4k|uhd)\b/i.test(label)) return 1;
  if (/\b(1440p?|2k)\b/i.test(label)) return 2;
  if (/\b720[pi]?\b/i.test(label)) return 3;
  if (/\b(576|540|480|360|240)[pi]?\b/i.test(label)) return 5;
  return 4;
}

function releaseSourceRank(stream: PlayableStream): number {
  const label = `${stream.name} ${stream.title ?? ""}`;
  if (/\b(?:bd|blu[ ._-]?ray|br)?[ ._-]?remux\b/i.test(label)) return 0;
  if (/\bweb[ ._-]?dl\b/i.test(label)) return 1;
  if (/\bblu[ ._-]?ray\b/i.test(label)) return 2;
  if (/(?:^|[ ._\-[\]()])rar(?:$|[ ._\-[\]()])|\.rar\b|archive[ ._-]?only/i.test(label)) return 4;
  return 3;
}

function browserCompatibilityScore(stream: PlayableStream, preferSafari = false): number {
  const label = `${stream.name} ${stream.title ?? ""}`.toLowerCase();
  let score = 0;
  if (/\b(english|eng|en)\b|🇬🇧|🇺🇸/.test(label)) score += 400;
  if (/\b(multi|dual[ ._-]?audio|dubbed)\b/.test(label)) score -= 250;
  if (/\b(spanish|spa|esp|latino|castellano|español)\b|🇪🇸|🇲🇽/.test(label)) score -= 500;
  if (/\b(french|fre|fra|german|ger|deu|italian|ita|russian|rus|hindi|hin|tamil|telugu)\b/.test(label)) score -= 350;
  if (/\b(1080p?|720p?)\b/.test(label)) score += 30;
  if (/\b(aac|mp3)\b/.test(label)) score += 100;
  if (/\b(aac[ ._-]?2(?:\.0)?|2\.0|stereo)\b/.test(label)) score += 500;
  if (/\b(5\.1|7\.1|6ch|8ch|surround)\b/.test(label)) score -= 600;
  if (/\b(h264|avc)\b/.test(label)) score += 35;
  if (/\b(2160p?|4k|dolby\s*vision|\bdv\b|hdr)\b/.test(label)) score -= 15;
  if (/\b(atmos|truehd|eac3|e-ac-3|ddp|dts|ac3)\b/.test(label)) score -= 700;
  if (/\b(h265|hevc)\b/.test(label)) score -= 35;
  if (preferSafari) {
    if (/\.(mp4|m4v)\b|\bmp4\b/.test(label)) score += 500;
    if (/\.(mkv|webm|avi)\b|\b(matroska|webm)\b/.test(label)) score -= 700;
    if (/\b(h264|avc)\b/.test(label)) score += 120;
    if (/\b(aac|mp3)\b/.test(label)) score += 120;
  }
  return score;
}
