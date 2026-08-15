/** VidRock iframe postMessage: MEDIA_DATA (continue-watching list) and PLAYER_EVENT. */

export type VidrockProgress = {
  tmdbId: string;
  mediaType: "movie" | "tv";
  seconds: number;
  duration?: number;
  season: number;
  episode: number;
  event?: string;
};

function parseMessageData(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

export function isVidrockPlayerOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "vidrock.ru" || host.endsWith(".vidrock.ru");
  } catch {
    return false;
  }
}

function asSeconds(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function asCoord(raw: unknown, fallback: number): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function idsMatch(left: unknown, right: string): boolean {
  const a = String(left ?? "").trim();
  const b = String(right ?? "").trim();
  return Boolean(a) && a === b;
}

type VidrockItem = {
  id?: unknown;
  type?: unknown;
  progress?: { watched?: unknown; duration?: unknown };
  last_season_watched?: unknown;
  last_episode_watched?: unknown;
  show_progress?: Record<
    string,
    {
      season?: unknown;
      episode?: unknown;
      progress?: { watched?: unknown; duration?: unknown };
    }
  >;
};

function progressFromItem(
  item: VidrockItem,
  expectedTmdbId: string,
  fallbackSeason: number,
  fallbackEpisode: number
): VidrockProgress | null {
  const tmdbId = String(item.id ?? expectedTmdbId).trim();
  const mediaType = item.type === "tv" ? "tv" : "movie";
  let watched = asSeconds(item.progress?.watched);
  let duration = asSeconds(item.progress?.duration) ?? undefined;
  let season = asCoord(item.last_season_watched, fallbackSeason);
  let episode = asCoord(item.last_episode_watched, fallbackEpisode);

  if (mediaType === "tv" && item.show_progress) {
    const key = `s${fallbackSeason}e${fallbackEpisode}`;
    const keyed = item.show_progress[key];
    const entries = Object.values(item.show_progress);
    const latest = entries.reduce<(typeof entries)[number] | null>((best, row) => {
      if (!row) return best;
      if (!best) return row;
      return Number(row.progress?.watched) > Number(best.progress?.watched) ? row : best;
    }, keyed ?? null);
    if (latest) {
      watched = asSeconds(latest.progress?.watched) ?? watched;
      duration = asSeconds(latest.progress?.duration) ?? duration;
      season = asCoord(latest.season, season);
      episode = asCoord(latest.episode, episode);
    }
  }

  if (watched == null) return null;
  return { tmdbId, mediaType, seconds: watched, duration, season, episode };
}

/**
 * Parse a VidRock parent-window message into playback seconds.
 * `expectedTmdbId` picks the matching row out of the MEDIA_DATA list.
 */
export function parseVidrockMessage(
  event: MessageEvent,
  expectedTmdbId: string,
  fallbackSeason = 1,
  fallbackEpisode = 1
): VidrockProgress | null {
  const data = parseMessageData(event.data);
  if (!data) return null;
  const type = data.type;
  if (type !== "PLAYER_EVENT" && type !== "MEDIA_DATA") return null;
  const expected = String(expectedTmdbId ?? "").trim();

  if (type === "PLAYER_EVENT") {
    const payload =
      data.data && typeof data.data === "object"
        ? (data.data as Record<string, unknown>)
        : data;
    const seconds = asSeconds(payload.currentTime);
    if (seconds == null) return null;
    const rawId = payload.mtmdbId ?? payload.tmdbId ?? payload.id;
    const parsedId = Number.isFinite(Number(rawId)) ? String(Math.trunc(Number(rawId))) : "";
    // Always attach to the title on this watch page. VidRock's mtmdbId is the
    // TMDB id, which can differ from the catalog route id (anime_*, aliases).
    return {
      tmdbId: expected || parsedId,
      mediaType: payload.mediaType === "tv" ? "tv" : "movie",
      seconds,
      duration: asSeconds(payload.duration) ?? undefined,
      season: asCoord(payload.season, fallbackSeason),
      episode: asCoord(payload.episode, fallbackEpisode),
      event: typeof payload.event === "string" ? payload.event : undefined,
    };
  }

  const list = Array.isArray(data.data) ? (data.data as VidrockItem[]) : [];
  if (list.length === 0) return null;
  if (event.origin && event.origin !== "null" && !isVidrockPlayerOrigin(event.origin)) {
    return null;
  }

  const match = expected
    ? list.find((item) => idsMatch(item.id, expected))
    : null;
  if (!match) return null;
  return progressFromItem(match, expected, fallbackSeason, fallbackEpisode);
}
