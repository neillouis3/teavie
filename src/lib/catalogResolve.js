import { imdbGenresForDoc } from "@/lib/imdbGenres";
import { fetchOmdbGenreRaw } from "@/lib/omdbGenre";
import { tmdbBearerToken } from "@/lib/tmdbAuth";
import { catalogDisplayVoteAverage, parseCatalogVoteCount } from "@/lib/catalogPopularity";

function normalizeDate(dateValue) {
  if (dateValue == null) return null;
  if (typeof dateValue === "string") return dateValue;
  return dateValue.toISOString?.().split("T")[0] ?? null;
}

/**
 * @param {Record<string, unknown>} doc
 * @param {"movie" | "tv"} mediaType
 */
export async function enrichCatalogDocGenres(doc, mediaType, { persistCollection } = {}) {
  if (!doc || typeof doc !== "object") return doc;

  /** @type {Record<string, unknown>} */
  let merged = { ...doc };
  const imdbId =
    typeof merged.imdb_id === "string" && /^tt/i.test(merged.imdb_id)
      ? merged.imdb_id.trim()
      : "";

  const omdb =
    merged.omdb && typeof merged.omdb === "object"
      ? /** @type {Record<string, unknown>} */ ({ ...merged.omdb })
      : {};

  const hasOmdbGenre =
    typeof omdb.genre === "string" &&
    omdb.genre.trim() &&
    omdb.genre !== "N/A";

  if (imdbId && !hasOmdbGenre) {
    const genreRaw = await fetchOmdbGenreRaw(imdbId, mediaType);
    if (genreRaw) {
      omdb.genre = genreRaw;
      merged = { ...merged, omdb };
    }
  }

  const imdb_genres = imdbGenresForDoc(merged);
  merged = { ...merged, imdb_genres };

  if (persistCollection && merged._id && imdb_genres.length > 0) {
    /** @type {Record<string, unknown>} */
    const set = { imdb_genres };
    if (omdb.genre) set.omdb = omdb;
    await persistCollection.updateOne(
      { _id: merged._id },
      {
        $set: set,
        $unset: { genre_ids: "", genres: "", mal_genre_names: "" },
      }
    );
  }

  return merged;
}

/**
 * @param {Record<string, unknown>} doc
 * @param {"movie" | "tv"} mediaType
 */
export function normalizeCatalogResolveFallback(doc, mediaType) {
  const imdb_genres = imdbGenresForDoc(doc);
  const base =
    mediaType === "movie"
      ? {
          id: doc.id,
          title: doc.title ?? doc.name ?? "Untitled",
          release_date: normalizeDate(doc.release_date ?? doc.releaseDate ?? null),
        }
      : {
          id: doc.id,
          name: doc.name ?? doc.title ?? "Untitled",
          first_air_date: normalizeDate(doc.first_air_date ?? doc.release_date ?? null),
        };

  return {
    ...base,
    overview: doc.overview ?? "",
    poster_path: doc.poster_path ?? null,
    backdrop_path: doc.backdrop_path ?? null,
    vote_average: catalogDisplayVoteAverage(doc) ?? 0,
    status: typeof doc.status === "string" && doc.status ? doc.status : "Released",
    imdb_genres,
    omdb:
      doc.omdb && typeof doc.omdb === "object"
        ? {
            genre: /** @type {{ genre?: string }} */ (doc.omdb).genre ?? null,
            imdbRating:
              /** @type {{ imdbRating?: number }} */ (doc.omdb).imdbRating ?? null,
            imdbVotes: (() => {
              const parsed = parseCatalogVoteCount(
                /** @type {{ imdbVotes?: unknown }} */ (doc.omdb).imdbVotes
              );
              return parsed > 0 ? parsed : null;
            })(),
          }
        : null,
    origin_country: Array.isArray(doc.origin_country) ? doc.origin_country : [],
    original_language:
      typeof doc.original_language === "string" ? doc.original_language : null,
  };
}

/**
 * @param {import("mongodb").Collection} collection
 * @param {"movie" | "tv"} mediaType
 * @param {string} id
 */
export async function findCatalogDocByResolveId(collection, mediaType, id) {
  const trimmed = String(id ?? "").trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  const isNumeric = Number.isFinite(numeric) && numeric > 0;

  /** @type {Record<string, unknown>[]} */
  const or = [{ id: trimmed }];
  if (isNumeric) {
    or.push({ id: numeric }, { tmdb_id: numeric }, { "external_ids.tmdb_id": numeric });
  }

  return collection.findOne(
    { type: mediaType, $or: or },
    {
      projection: {
        _id: 1,
        id: 1,
        tmdb_id: 1,
        imdb_id: 1,
        title: 1,
        name: 1,
        title_aliases: 1,
        release_date: 1,
        releaseDate: 1,
        first_air_date: 1,
        overview: 1,
        poster_path: 1,
        backdrop_path: 1,
        vote_average: 1,
        status: 1,
        imdb_genres: 1,
        omdb: 1,
        origin_country: 1,
        original_language: 1,
        is_anime: 1,
        tags: 1,
        anilist_id: 1,
        anilist: 1,
        external_ids: 1,
        mal_id: 1,
        is_kdrama: 1,
        catalog_categories: 1,
        season_amount: 1,
        number_of_seasons: 1,
        number_of_episodes: 1,
      },
    }
  );
}

/**
 * Fetch OMDb genres for a TMDB id (uses TMDB only to resolve `imdb_id`, not genres).
 * @param {number} tmdbId
 * @param {"movie" | "tv"} mediaType
 * @returns {Promise<string[]>}
 */
export async function imdbGenresFromOmdbForTmdbId(tmdbId, mediaType) {
  const token = tmdbBearerToken();
  if (!token || !Number.isFinite(tmdbId) || tmdbId <= 0) return [];

  const res = await fetch(
    `https://api.themoviedb.org/3/${mediaType === "movie" ? "movie" : "tv"}/${tmdbId}/external_ids`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      next: { revalidate: 86400 },
    }
  );
  if (!res.ok) return [];

  const data = await res.json();
  const imdbId =
    typeof data?.imdb_id === "string" && /^tt/i.test(data.imdb_id)
      ? data.imdb_id.trim()
      : "";
  if (!imdbId) return [];

  const genreRaw = await fetchOmdbGenreRaw(imdbId, mediaType);
  if (!genreRaw) return [];

  return imdbGenresForDoc({ imdb_id: imdbId, omdb: { genre: genreRaw } });
}
