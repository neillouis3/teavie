import type { ClientMediaCapabilities, PlayableStream, StremioStream } from "./types";

const MANIFEST_TIMEOUT_MS = 12_000;
/** Stream catalogs often scrape/debrid; 8s was too aggressive. */
const STREAM_TIMEOUT_MS = 45_000;
const STREAM_FETCH_RETRIES = 1;

type AddonConfig = { manifestUrl: URL; streamBaseUrl: URL };

export function clientIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || null;
}

function addonRequestHeaders(clientIp?: string | null): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (clientIp) {
    headers["X-Forwarded-For"] = clientIp;
    headers["X-Real-IP"] = clientIp;
  }
  return headers;
}

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

async function getJson(
  url: URL,
  timeoutMs: number,
  retries = 0,
  clientIp?: string | null
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        headers: addonRequestHeaders(clientIp),
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

/** Return the URL unchanged — never prefetch IP-pinned stream hosts from the server. */
function resolveStreamPlaybackUrl(url: string): string {
  return String(url ?? "").trim();
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

export function stremioAddonCount(): number {
  return configuredAddons().length;
}

export function attachStreamEndpoints(
  streams: PlayableStream[],
  opts: {
    type: "movie" | "series";
    resourceId: string;
    addonIndex: number;
    caps: ClientMediaCapabilities;
  }
): PlayableStream[] {
  return streams.map((stream, index) => {
    const endpointParams = new URLSearchParams({
      type: opts.type,
      id: opts.resourceId,
      index: String(index),
      addonIndex: String(opts.addonIndex),
      safari: opts.caps.preferSafari ? "1" : "0",
      ac3: opts.caps.ac3 ? "1" : "0",
    }).toString();
    return {
      ...stream,
      remuxUrl: `/api/streams/remux?${endpointParams}`,
      audioTracksUrl: `/api/streams/tracks?${endpointParams}`,
    };
  });
}

export type StreamSourceMeta = {
  addonIndex: number;
  hasMoreAddons: boolean;
  unsupported: number;
  errors: { addon: string; message: string }[];
};

export function streamFetchErrorMessage(
  body: Record<string, unknown>,
  streams: PlayableStream[]
): string | null {
  if (streams.length > 0) return null;
  const providerErrors = Array.isArray(body.errors)
    ? body.errors
        .map((entry) =>
          entry && typeof entry === "object" && "message" in entry
            ? String((entry as { message?: unknown }).message ?? "")
            : ""
        )
        .filter(Boolean)
    : [];
  const providerError = providerErrors[0] ?? null;
  if (providerError) {
    const allTimedOut = providerErrors.every((message) =>
      /took too long|timeout/i.test(message)
    );
    return allTimedOut
      ? "Stream addons timed out. They may be slow or overloaded — try again in a moment."
      : `The configured addon could not return streams: ${providerError}`;
  }
  if (Number(body.unsupported) > 0) {
    return `The addon returned ${body.unsupported} torrent or non-web stream${body.unsupported === 1 ? "" : "s"}. Configure it with a direct-link provider to use this browser player.`;
  }
  const detail = providerErrors.length > 0 ? providerErrors.slice(0, 3).join(" · ") : null;
  return detail
    ? `No playable streams for this IMDb id. ${detail}`
    : "No streams found for this IMDb id. Check the id, season, and episode, then try again.";
}

export async function resolveStremioStreams(
  type: "movie" | "series",
  id: string,
  addonIndex = 0,
  caps: ClientMediaCapabilities = { ac3: false, preferSafari: false },
  clientIp?: string | null
) {
  const addons = configuredAddons();
  const addon = addons[addonIndex];
  if (!addon) {
    return {
      streams: [],
      unsupported: 0,
      errors: [{ addon: "stremio", message: "No stream addon is configured for this slot." }],
    };
  }

  const result = await fetchAddonStreams(addon, type, id, caps, clientIp);
  if (result.streams.length > 0) {
    return {
      streams: rankPlayableStreams(result.streams, caps),
      unsupported: result.unsupported,
      errors: result.error ? [result.error] : [],
    };
  }

  return {
    streams: [],
    unsupported: result.unsupported,
    errors: result.error ? [result.error] : [],
  };
}

async function fetchAddonStreams(
  { manifestUrl, streamBaseUrl }: AddonConfig,
  type: "movie" | "series",
  id: string,
  caps: ClientMediaCapabilities,
  clientIp?: string | null
): Promise<{
  streams: PlayableStream[];
  unsupported: number;
  error: { addon: string; message: string } | null;
}> {
  try {
    const manifest = (await getJson(manifestUrl, MANIFEST_TIMEOUT_MS, 0, clientIp)) as {
      name?: unknown;
      resources?: unknown;
    };
    const addonName = typeof manifest.name === "string" ? manifest.name : manifestUrl.hostname;
    const streamUrl = new URL(stremioStreamPath(type, id), streamBaseUrl);
    const payload = (await getJson(streamUrl, STREAM_TIMEOUT_MS, STREAM_FETCH_RETRIES, clientIp)) as {
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
        filename: stream.behaviorHints?.filename?.trim() || null,
      }));
    const rankedStreams = rankPlayableStreams(playableStreams, caps);
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

/** Everything the addon told us about the release — the codec is often only in the filename. */
function streamLabel(stream: PlayableStream): string {
  return `${stream.name} ${stream.title ?? ""} ${stream.filename ?? ""}`.toLowerCase();
}

/** Codecs every browser can decode. Their presence makes a surround tag harmless. */
function hasBrowserSafeAudio(label: string): boolean {
  return /\b(?:aac|mp3|mpeg|opus|flac|vorbis)\b/i.test(label);
}

/** Dolby Digital / Digital Plus — decodable only where the platform licenses it. */
function hasDolbyDigitalAudio(label: string): boolean {
  return /\b(?:e[ ._-]?)?ac[ ._-]?3\b|\bddp?\b|\bdd\+|\bdd[p+]?[ ._-]?[257][ ._-]?[01]\b/i.test(
    label
  );
}

/** DTS, TrueHD and Atmos have no browser decoder at all. */
function hasUndecodableAudio(label: string): boolean {
  return /\bdts(?:[ ._-]?(?:hd|es|x))?\b|\bdts:x\b|\btrue[ ._-]?hd\b|\batmos\b/i.test(label);
}

/**
 * Chrome and Firefox ship no AC3/E-AC3 decoder, so a 1080p DDP5.1 release plays
 * as silent video. Scoring alone still let those win on resolution, so unplayable
 * audio is filtered out up front and only restored if nothing else is left.
 */
function canDecodeAudio(stream: PlayableStream, caps: ClientMediaCapabilities): boolean {
  const label = streamLabel(stream);
  if (hasBrowserSafeAudio(label)) return true;
  if (hasUndecodableAudio(label)) return false;
  if (hasDolbyDigitalAudio(label)) return caps.ac3;
  return true;
}

function rankPlayableStreams(
  streams: PlayableStream[],
  caps: ClientMediaCapabilities
): PlayableStream[] {
  const nonRipStreams = streams.filter((stream) => !isRip(stream));
  const base = nonRipStreams.length > 0 ? nonRipStreams : streams;

  const audible = base.filter((stream) => canDecodeAudio(stream, caps));
  const withAudio = audible.length > 0 ? audible : base;

  const safariStreams = caps.preferSafari ? withAudio.filter(isSafariDirectStream) : [];
  const pool = safariStreams.length > 0 ? safariStreams : withAudio;

  return [...pool].sort((a, b) => {
    const audioOrder = browserAudioRank(a, caps) - browserAudioRank(b, caps);
    if (audioOrder !== 0) return audioOrder;
    const resolutionOrder = resolutionRank(a) - resolutionRank(b);
    if (resolutionOrder !== 0) return resolutionOrder;
    const seederOrder = seederCount(b) - seederCount(a);
    if (seederOrder !== 0) return seederOrder;
    const releaseOrder = releaseSourceRank(a) - releaseSourceRank(b);
    if (releaseOrder !== 0) return releaseOrder;
    return (
      browserCompatibilityScore(b, caps.preferSafari) -
      browserCompatibilityScore(a, caps.preferSafari)
    );
  });
}

function browserAudioRank(stream: PlayableStream, caps: ClientMediaCapabilities): number {
  const label = streamLabel(stream);
  if (hasBrowserSafeAudio(label)) return 0;
  if (hasUndecodableAudio(label)) return 3;
  if (hasDolbyDigitalAudio(label)) return caps.ac3 ? 1 : 3;
  return 2;
}

function isSafariDirectStream(stream: PlayableStream): boolean {
  const label = `${streamLabel(stream)} ${stream.url}`;
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
