import clientPromise from "@/lib/mongo";
import {
  enrichCatalogDocGenres,
  findCatalogDocByResolveId,
  imdbGenresFromOmdbForTmdbId,
  normalizeCatalogResolveFallback,
} from "@/lib/catalogResolve";
import { fetchAnilistEnrichmentForCatalogDoc } from "@/lib/anilistCatalogEnrich";
import { resolveOmdbImdbIdForDoc } from "@/lib/omdbResolve";
import { resolveTmdbTvFromDoc } from "@/lib/tmdbResolveFromTitle";
import {
  fetchAnimeCatalogEpisodeTotal,
  fetchAnimeTmdbPlaybackSeasons,
} from "@/lib/animeTmdbEpisodes";
import { tmdbBearerToken } from "@/lib/tmdbAuth";
import { isValidAdminKey } from "@/lib/adminAccess";
import { shouldPruneTvAnimeWithoutAnilist, showUnavailableReasonForDoc, SHOW_UNAVAILABLE_MESSAGES } from "@/lib/tvJpAnimePrune";

function pickNumericAnilistId(doc) {
  const raw = doc?.anilist_id ?? doc?.anilist?.id;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function catalogTvSeasonCount(doc) {
  if (typeof doc.number_of_seasons === "number" && doc.number_of_seasons > 0) {
    return doc.number_of_seasons;
  }
  const eps =
    typeof doc.number_of_episodes === "number" && doc.number_of_episodes > 0
      ? doc.number_of_episodes
      : null;
  const amt =
    typeof doc.season_amount === "number" && doc.season_amount > 0
      ? doc.season_amount
      : null;
  const isAnime = Boolean(
    doc.is_anime || (Array.isArray(doc.tags) && doc.tags.includes("anime"))
  );
  // Legacy Jikan import stored episode count in `season_amount`.
  if (isAnime && amt != null && eps != null && amt === eps) return 1;
  if (amt != null) return amt;
  return null;
}

function catalogAnimeEpisodeTotal(doc) {
  const fromDoc =
    typeof doc.number_of_episodes === "number" && doc.number_of_episodes > 0
      ? doc.number_of_episodes
      : null;
  if (fromDoc != null) return fromDoc;
  const fromAni = doc.anilist?.episodes;
  if (typeof fromAni === "number" && Number.isFinite(fromAni) && fromAni > 0) {
    return fromAni;
  }
  return null;
}

function animeFallbackSeasons(doc) {
  const isAnime = Boolean(
    doc.is_anime || (Array.isArray(doc.tags) && doc.tags.includes("anime"))
  );
  if (!isAnime) return [];
  const eps = catalogAnimeEpisodeTotal(doc);
  if (eps == null || eps <= 0) return [];
  return [{ season_number: 1, episode_count: eps }];
}

/** TMDB summary for numeric ids missing from catalog (block JP animation direct URLs). */
async function tmdbTvDocForPruneCheck(tmdbId, token) {
  if (!token || !Number.isFinite(tmdbId) || tmdbId <= 0) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US`,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        next: { revalidate: 86400 },
      }
    );
    if (!res.ok) return null;
    const show = await res.json();
    if (!show || typeof show !== "object") return null;
    return {
      type: "tv",
      id: tmdbId,
      adult: show.adult === true,
      origin_country: show.origin_country,
      original_language: show.original_language,
      genre_ids: Array.isArray(show.genres)
        ? show.genres.map((g) => g?.id).filter((n) => typeof n === "number")
        : [],
      genres: show.genres,
    };
  } catch {
    return null;
  }
}

function blockedShowResponse(doc) {
  const reason = showUnavailableReasonForDoc(doc);
  return Response.json(
    {
      error: reason,
      message: SHOW_UNAVAILABLE_MESSAGES[reason] ?? SHOW_UNAVAILABLE_MESSAGES.not_found,
    },
    { status: 404 }
  );
}

function normalizeTvFallback(doc) {
  const base = normalizeCatalogResolveFallback(doc, "tv");
  const seasons = animeFallbackSeasons(doc);
  const episodeTotal = catalogAnimeEpisodeTotal(doc);
  return {
    ...base,
    genres: [],
    is_kdrama: doc.is_kdrama === true,
    catalog_categories: Array.isArray(doc.catalog_categories)
      ? doc.catalog_categories
      : [],
    mal_id: typeof doc.mal_id === "number" ? doc.mal_id : null,
    tagline: null,
    number_of_seasons: seasons.length > 0 ? 1 : catalogTvSeasonCount(doc),
    number_of_episodes: episodeTotal,
    seasons,
    is_anime: Boolean(doc.is_anime || (Array.isArray(doc.tags) && doc.tags.includes("anime"))),
    anilist_id: pickNumericAnilistId(doc),
    anilist: doc.anilist && typeof doc.anilist === "object" ? doc.anilist : null,
    external_ids: doc.external_ids && typeof doc.external_ids === "object" ? doc.external_ids : null,
    tmdb_id:
      typeof doc.tmdb_id === "number" && doc.tmdb_id > 0
        ? doc.tmdb_id
        : typeof doc.tmdb_id === "string" && /^\d+$/.test(doc.tmdb_id)
          ? Number(doc.tmdb_id)
          : typeof doc.external_ids?.tmdb_id === "number" && doc.external_ids.tmdb_id > 0
            ? doc.external_ids.tmdb_id
            : null,
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    const adminKey =
      searchParams.get("adminKey")?.trim() ||
      searchParams.get("key")?.trim() ||
      "";
    const adminBypass = isValidAdminKey(adminKey);
    if (adminKey && !adminBypass) {
      return Response.json(
        { error: "unauthorized", message: "Invalid admin key." },
        { status: 403 }
      );
    }
    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("teavie");
    const collection = db.collection("content");

    let doc = await findCatalogDocByResolveId(collection, "tv", id);

    const numeric = Number(id);
    const isNumericId = Number.isFinite(numeric) && numeric > 0;

    if (!doc && isNumericId) {
      if (adminBypass) {
        const imdb_genres = await imdbGenresFromOmdbForTmdbId(numeric, "tv");
        return Response.json({
          playerId: numeric,
          imdbId: null,
          adminBypass: true,
          fallback: imdb_genres.length
            ? {
                id: String(numeric),
                imdb_genres,
                omdb: null,
                name: `TV ${numeric}`,
                first_air_date: null,
              }
            : null,
        });
      }

      const token = tmdbBearerToken();
      const tmdbProbe = token ? await tmdbTvDocForPruneCheck(numeric, token) : null;
      if (tmdbProbe && shouldPruneTvAnimeWithoutAnilist(tmdbProbe)) {
        return blockedShowResponse(tmdbProbe);
      }

      const imdb_genres = await imdbGenresFromOmdbForTmdbId(numeric, "tv");
      const probeWithImdb = {
        type: "tv",
        id: numeric,
        ...(tmdbProbe ?? {}),
        imdb_genres,
      };
      if (shouldPruneTvAnimeWithoutAnilist(probeWithImdb)) {
        return blockedShowResponse(probeWithImdb);
      }

      return Response.json({
        playerId: numeric,
        imdbId: null,
        fallback: imdb_genres.length
          ? { id: String(numeric), imdb_genres, omdb: null }
          : null,
      });
    }

    if (!doc) {
      return Response.json({ error: "Show not found" }, { status: 404 });
    }

    let merged = await enrichCatalogDocGenres(doc, "tv", {
      persistCollection: collection,
    });

    let tmdbIdNum =
      typeof merged.tmdb_id === "number"
        ? merged.tmdb_id
        : typeof merged.tmdb_id === "string"
          ? Number(merged.tmdb_id)
          : Number(merged.id);

    const hasPlayer = Number.isFinite(tmdbIdNum) && tmdbIdNum > 0;

    const token = tmdbBearerToken();
    if (!hasPlayer && token && merged._id) {
      try {
        const isAnime = Boolean(
          merged.is_anime || (Array.isArray(merged.tags) && merged.tags.includes("anime"))
        );

        let extraTitles = [];
        if (isAnime) {
          const { anilist, titleCandidates } = await fetchAnilistEnrichmentForCatalogDoc(merged);
          if (anilist) {
            merged = {
              ...merged,
              anilist: { ...(merged.anilist && typeof merged.anilist === "object" ? merged.anilist : {}), ...anilist },
              anilist_id: merged.anilist_id ?? anilist.id ?? merged.anilist_id,
            };
            if (
              typeof anilist.episodes === "number" &&
              anilist.episodes > 0 &&
              (!merged.number_of_episodes || merged.number_of_episodes <= 0)
            ) {
              merged.number_of_episodes = anilist.episodes;
            }
          }
          extraTitles = titleCandidates;
        }

        let omdbImdbId = null;
        const hasImdb =
          (typeof merged.imdb_id === "string" && /^tt/i.test(merged.imdb_id)) ||
          (typeof merged.external_ids?.imdb_id === "string" &&
            /^tt/i.test(merged.external_ids.imdb_id));
        if (!hasImdb) {
          omdbImdbId = await resolveOmdbImdbIdForDoc(merged, "tv");
          if (omdbImdbId) {
            merged = {
              ...merged,
              imdb_id: omdbImdbId,
              external_ids: {
                ...(merged.external_ids && typeof merged.external_ids === "object"
                  ? merged.external_ids
                  : {}),
                imdb_id: omdbImdbId,
              },
            };
          }
        }

        const hit = await resolveTmdbTvFromDoc(merged, token, {
          extraTitles,
          imdbId: omdbImdbId,
        });
        if (hit) {
          const setDoc = {
            tmdb_id: hit.tmdbId,
            imdb_id: hit.imdbId,
            last_tmdb_resolved_at: new Date().toISOString(),
          };
          if (hit.poster_path) setDoc.poster_path = hit.poster_path;
          if (hit.backdrop_path) setDoc.backdrop_path = hit.backdrop_path;
          if (omdbImdbId) {
            setDoc.external_ids = {
              ...(merged.external_ids && typeof merged.external_ids === "object"
                ? merged.external_ids
                : {}),
              imdb_id: omdbImdbId,
            };
          }
          await collection.updateOne({ _id: merged._id }, { $set: setDoc });
          merged = {
            ...merged,
            tmdb_id: hit.tmdbId,
            imdb_id: hit.imdbId ?? merged.imdb_id,
            poster_path: hit.poster_path || merged.poster_path,
            backdrop_path: hit.backdrop_path || merged.backdrop_path,
          };
          tmdbIdNum = hit.tmdbId;
          if (hit.imdbId && !merged.omdb?.genre) {
            merged = await enrichCatalogDocGenres(merged, "tv", {
              persistCollection: collection,
            });
          }
        }
      } catch (e) {
        console.error("Lazy TMDB resolve failed:", e);
      }
    }

    const { _id, ...docForFallback } = merged;

    const isAnimeCatalogId = /^anime_/i.test(String(id).trim());
    const isAnimeDoc = Boolean(
      merged.is_anime || (Array.isArray(merged.tags) && merged.tags.includes("anime"))
    );

    let fallback = normalizeTvFallback(docForFallback);
    if (isAnimeCatalogId || isAnimeDoc) {
      const routeMal = isAnimeCatalogId
        ? parseInt(String(id).replace(/^anime_/i, ""), 10)
        : null;
      const mal =
        Number.isFinite(routeMal) && routeMal > 0
          ? routeMal
          : typeof merged.mal_id === "number" && merged.mal_id > 0
            ? merged.mal_id
            : null;
      if (mal != null) {
        const episodeTotal = await fetchAnimeCatalogEpisodeTotal(merged, mal);
        if (episodeTotal != null && episodeTotal > 0) {
          fallback = {
            ...fallback,
            number_of_episodes: episodeTotal,
            number_of_seasons: 1,
            seasons: [{ season_number: 1, episode_count: episodeTotal }],
          };
        }
        const playbackSeasons = await fetchAnimeTmdbPlaybackSeasons(merged, mal);
        if (playbackSeasons.length > 0) {
          fallback = { ...fallback, tmdb_playback_seasons: playbackSeasons };
        }
      }
    }

    return Response.json({
      playerId:
        isAnimeCatalogId || isAnimeDoc
          ? null
          : Number.isFinite(tmdbIdNum) && tmdbIdNum > 0
            ? tmdbIdNum
            : null,
      imdbId: typeof merged.imdb_id === "string" ? merged.imdb_id : null,
      fallback,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to resolve show id" }, { status: 500 });
  }
}
