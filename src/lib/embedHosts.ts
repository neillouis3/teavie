/** Shared third-party embed player hosts. */
export const MOVIES111_EMBED_BASE = "https://player.vidlove.cc";
export const MOVIES111_THEME_QUERY = "?ds_lang=none&iconsize=0.65&chromecast=false";
/** VidFast TMDB/IMDB embed player. */
export const VIDFAST_EMBED_BASE = "https://vidfast.vc";
export const VIDFAST_THEME_QUERY =
  "?theme=22c55e&autoPlay=true&hideServer=true&chromecast=false&title=true&poster=true&iconsize=0.65&fullscreenButton=false";

/** Append VidFast resume / Tea Party sync params to an embed URL. */
export function withVidfastEmbedParams(
  url: string,
  opts?: { startAt?: number }
): string {
  const startAt = Math.floor(Number(opts?.startAt) || 0);
  if (startAt < 1) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("startAt", String(startAt));
    return parsed.toString();
  } catch {
    const join = url.includes("?") ? "&" : "?";
    return `${url}${join}startAt=${startAt}`;
  }
}
/** Viduki API 1 (multi-server). Use www — apex 301s with X-Frame-Options: SAMEORIGIN. */
export const VIDUKI_EMBED_BASE = "https://www.viduki.net";
export const VIDUKI_THEME_QUERY = "?color=22c55e";
const VIDUKI_API_MAX = 4;

/** Next Viduki API path (`/1/...` → `/2/...` … `/4/...`) after API 1 reports no stream. */
export function nextVidukiEmbedUrl(
  url: string,
  imdbId?: string | null
): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== "viduki.net" && !host.endsWith(".viduki.net")) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const api = Number(parts[0]);
    if (!Number.isInteger(api) || api < 1 || api > VIDUKI_API_MAX) return null;
    if (parts[1] !== "movie" && parts[1] !== "tv") return null;
    if (api < VIDUKI_API_MAX) {
      parts[0] = String(api + 1);
      parsed.pathname = `/${parts.join("/")}`;
      return parsed.toString();
    }
    const currentId = String(parts[2] ?? "");
    const imdb = String(imdbId ?? "").trim();
    if (!imdb || /^tt/i.test(currentId)) return null;
    if (!/^tt\d+$/i.test(imdb)) return null;
    parts[0] = "1";
    parts[2] = imdb;
    parsed.pathname = `/${parts.join("/")}`;
    return parsed.toString();
  } catch {
    return null;
  }
}
