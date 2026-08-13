/**
 * Live AniList airing schedule — episodes that aired within a lookback window.
 */
import { unstable_cache } from "next/cache";
import { anilistPost } from "@/lib/anilistFetch";

const SCHEDULE_QUERY = `query ($after: Int, $before: Int, $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    airingSchedules(
      airingAt_greater: $after
      airingAt_lesser: $before
      sort: TIME
    ) {
      airingAt
      episode
      media {
        id
        idMal
        title { romaji english native }
        episodes
        coverImage { large extraLarge }
        bannerImage
        averageScore
      }
    }
  }
}`;

/**
 * @param {{ lookbackDays?: number; perPage?: number }} [opts]
 * @returns {Promise<Array<{ airingAt: number; episode: number; media: Record<string, unknown> }>>}
 */
export async function fetchAnilistAiredEpisodes({
  lookbackDays = 7,
  perPage = 50,
} = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const afterSec = nowSec - lookbackDays * 86400;

  const res = await anilistPost({
    query: SCHEDULE_QUERY,
    variables: {
      after: afterSec,
      before: nowSec + 120,
      perPage: Math.min(50, Math.max(1, perPage)),
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`AniList airing schedule failed (${res.status}): ${detail.slice(0, 160)}`);
  }

  const payload = await res.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join("; "));
  }

  const rows = payload?.data?.Page?.airingSchedules ?? [];
  /** @type {Map<string, { airingAt: number; episode: number; media: Record<string, unknown> }>} */
  const byShow = new Map();

  for (const row of rows) {
    const media = row?.media;
    if (!media || typeof media !== "object") continue;
    const airingAt = Number(row.airingAt);
    const episode = Number(row.episode);
    if (!Number.isFinite(airingAt) || airingAt < afterSec || airingAt > nowSec + 120) {
      continue;
    }
    const mal = Number(media.idMal);
    const ani = Number(media.id);
    const key =
      Number.isFinite(mal) && mal > 0
        ? `mal:${mal}`
        : Number.isFinite(ani) && ani > 0
          ? `ani:${ani}`
          : null;
    if (!key) continue;

    const prev = byShow.get(key);
    if (!prev || airingAt > prev.airingAt) {
      byShow.set(key, {
        airingAt,
        episode: Number.isFinite(episode) ? episode : 0,
        media: /** @type {Record<string, unknown>} */ (media),
      });
    }
  }

  return [...byShow.values()].sort((a, b) => b.airingAt - a.airingAt);
}

const ANILIST_AIRED_CACHE_SEC = 900;

/** Cached AniList aired episodes (15 min) — shared across category hub requests. */
export const getCachedAnilistAiredEpisodes = unstable_cache(
  (lookbackDays = 7, perPage = 50) =>
    fetchAnilistAiredEpisodes({ lookbackDays, perPage }),
  ["anilist-aired-episodes-7d"],
  { revalidate: ANILIST_AIRED_CACHE_SEC, tags: ["anilist-aired-episodes"] }
);

/** Build Mongo `$or` clause to resolve schedule rows against catalog docs. */
export function mongoMatchFromAiringSchedules(schedules) {
  /** @type {unknown[]} */
  const malIds = [];
  /** @type {unknown[]} */
  const anilistIds = [];
  /** @type {unknown[]} */
  const animeIds = [];

  for (const row of schedules) {
    const media = row.media;
    const mal = Number(media?.idMal);
    const ani = Number(media?.id);
    if (Number.isFinite(mal) && mal > 0) {
      malIds.push(mal);
      animeIds.push(`anime_${mal}`);
    }
    if (Number.isFinite(ani) && ani > 0) {
      anilistIds.push(ani);
    }
  }

  /** @type {Record<string, unknown>[]} */
  const or = [];
  if (malIds.length > 0) {
    or.push(
      { mal_id: { $in: malIds } },
      { "external_ids.mal_id": { $in: malIds } },
      { id: { $in: animeIds } }
    );
  }
  if (anilistIds.length > 0) {
    or.push(
      { "anilist.id": { $in: anilistIds } },
      { "external_ids.anilist_id": { $in: anilistIds } }
    );
  }
  return or.length > 0 ? { $or: or } : null;
}

/** Resolve a catalog doc for a schedule row (MAL / AniList id). */
export function catalogDocForSchedule(doc, schedule) {
  const media = schedule.media;
  const mal = Number(media?.idMal);
  const ani = Number(media?.id);
  const docMal = Number(
    doc.mal_id ?? doc.external_ids?.mal_id ?? String(doc.id ?? "").replace(/^anime_/, "")
  );
  const docAni = Number(doc.anilist?.id ?? doc.external_ids?.anilist_id);
  if (Number.isFinite(mal) && mal > 0 && docMal === mal) return true;
  if (Number.isFinite(ani) && ani > 0 && docAni === ani) return true;
  if (Number.isFinite(mal) && mal > 0 && String(doc.id) === `anime_${mal}`) return true;
  return false;
}
