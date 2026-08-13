import { hasStremioAddons } from "@/lib/stremio/client";
import type { ClientMediaCapabilities } from "@/lib/stremio/types";

export type ParsedStreamsRequest =
  | {
      ok: true;
      type: "movie" | "series";
      imdbId: string;
      resourceId: string;
      season: number;
      episode: number;
      addonIndex: number;
      caps: ClientMediaCapabilities;
    }
  | { ok: false; status: number; error: string; code?: string };

/**
 * The player probes the real decoders and sends the answer; the user agent is
 * only a fallback for requests that predate that (or come from elsewhere).
 */
export function parseClientMediaCapabilities(request: Request): ClientMediaCapabilities {
  const params = new URL(request.url).searchParams;
  const userAgent = request.headers.get("user-agent") ?? "";
  const isSafari =
    /safari/i.test(userAgent) && !/(chrome|chromium|crios|android)/i.test(userAgent);

  const safariParam = params.get("safari");
  const ac3Param = params.get("ac3");

  return {
    preferSafari: safariParam == null ? isSafari : safariParam === "1",
    // Safari and Edge license Dolby Digital; Chrome and Firefox do not.
    ac3: ac3Param == null ? isSafari || /\bedg\//i.test(userAgent) : ac3Param === "1",
  };
}

export function parseStreamsRequest(request: Request): ParsedStreamsRequest {
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const imdbId = params.get("id")?.trim() ?? "";
  const season = Number(params.get("season"));
  const episode = Number(params.get("episode"));
  const fallback = params.get("fallback") === "1";
  const addonIndex = Math.max(
    0,
    Number.parseInt(params.get("addonIndex") ?? (fallback ? "1" : "0"), 10) || 0
  );
  const caps = parseClientMediaCapabilities(request);

  if (type !== "movie" && type !== "series") {
    return { ok: false, status: 400, error: "type must be movie or series" };
  }
  if (!/^tt\d+$/i.test(imdbId)) {
    return { ok: false, status: 400, error: "A valid IMDb id is required" };
  }
  if (!hasStremioAddons()) {
    return {
      ok: false,
      status: 503,
      error: "No Stremio addons are configured",
      code: "not_configured",
    };
  }

  let resourceId = imdbId.toLowerCase();
  if (type === "series") {
    if (
      !Number.isInteger(season) ||
      season < 0 ||
      !Number.isInteger(episode) ||
      episode < 1
    ) {
      return { ok: false, status: 400, error: "A valid season and episode are required" };
    }
    resourceId += `:${season}:${episode}`;
  }

  return {
    ok: true,
    type,
    imdbId,
    resourceId,
    season,
    episode,
    addonIndex,
    caps,
  };
}
