import { omdbQueryWithKey } from "./omdbAuth.js";

const OMDB_BASE = "https://www.omdbapi.com/";

function pickYear(doc) {
  const raw = doc?.first_air_date ?? doc?.release_date ?? "";
  if (typeof raw !== "string") return null;
  const m = /^(\d{4})/.exec(raw.trim());
  return m ? m[1] : null;
}

function pickTitle(doc) {
  const candidates = [doc?.title, doc?.name];
  const al = doc?.anilist?.title;
  if (al && typeof al === "object") {
    candidates.unshift(al.english, al.romaji);
  }
  for (const c of candidates) {
    const t = typeof c === "string" ? c.trim() : "";
    if (t) return t;
  }
  return "";
}

/**
 * Resolve an IMDb id from OMDb title search (series / movie).
 * @param {Record<string, unknown>} doc catalog row
 * @param {"movie" | "tv"} mediaType
 * @returns {Promise<string|null>}
 */
export async function resolveOmdbImdbIdForDoc(doc, mediaType = "tv") {
  const title = pickTitle(doc);
  if (!title) return null;

  const typeParam = mediaType === "movie" ? "movie" : "series";
  const year = pickYear(doc);

  const attempts = [
    { t: title, type: typeParam, ...(year ? { y: year } : {}) },
    { t: title, type: typeParam },
  ];

  for (const params of attempts) {
    const qs = omdbQueryWithKey({ ...params, r: "json" });
    if (!qs.includes("apikey=")) return null;

    const res = await fetch(`${OMDB_BASE}?${qs}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) continue;

    const data = await res.json();
    if (data?.Response !== "True") continue;

    const id = String(data.imdbID ?? "").trim();
    if (/^tt\d+$/i.test(id)) return id;
  }

  return null;
}
