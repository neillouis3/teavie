import clientPromise from "@/lib/mongo";
import { mapContentDocToItem } from "@/lib/mapContentDocToItem";
import { catalogMoviePolicyClause } from "@/lib/catalogQuery";
import { tmdbAuth, tmdbFetchJson } from "@/lib/tmdbAuth";

const KNOWN_FOR_LIMIT = 10;
const FILMOGRAPHY_LIMIT = 120;

/** TMDB genres that are not narrative filmography (talk / news / reality TV). */
const ACTOR_TV_EXCLUDE_GENRES = new Set([10767, 10763, 10764]);

/** Supplemental / promo titles that aren't movies or shows. */
const SUPPLEMENTAL_TITLE_PATTERNS = [
  /\bmaking of\b/i,
  /\blook back\b/i,
  /\binside the dream\b/i,
  /\bhall of fame induction\b/i,
  /^generations:\s/i,
  /\bautocomplete interview/i,
  /\bfaut voir\b/i,
  /\bl['’]hebdo cin[eé]ma\b/i,
  /\b& friends:\s/i,
  /\bred carpet\b/i,
  /\bworld premiere\b/i,
  /\bpress tour\b/i,
  /\bbecoming\b/i,
  /\buntitled\b.*\bdocumentary\b/i,
  /^30 for 30:/i,
];

function isActingFilmographyCredit(credit) {
  if (!credit || credit.adult) return false;

  const mediaType = credit.media_type;
  if (mediaType !== "movie" && mediaType !== "tv") return false;

  const genreIds = Array.isArray(credit.genre_ids) ? credit.genre_ids : [];
  if (genreIds.includes(99)) return false;
  if (mediaType === "tv" && genreIds.some((g) => ACTOR_TV_EXCLUDE_GENRES.has(g))) {
    return false;
  }

  const title = String(credit.title ?? credit.name ?? "").trim();
  if (!title) return false;
  if (SUPPLEMENTAL_TITLE_PATTERNS.some((re) => re.test(title))) return false;

  return true;
}

function uniquePositiveIds(rows) {
  const ids = (rows || [])
    .map((r) => r.id)
    .filter((id) => typeof id === "number" && id > 0);
  return [...new Set(ids)];
}

function buildTvTmdbLookupMap(docs) {
  const map = new Map();
  for (const doc of docs) {
    const keys = new Set();
    const tid = typeof doc.tmdb_id === "number" ? doc.tmdb_id : Number(doc.tmdb_id);
    if (Number.isFinite(tid) && tid > 0) keys.add(tid);
    const ext = doc.external_ids && doc.external_ids.tmdb_id;
    const extn = Number(ext);
    if (Number.isFinite(extn) && extn > 0) keys.add(extn);
    if (!String(doc.id).startsWith("anime_")) {
      const idn = Number(doc.id);
      if (Number.isFinite(idn) && idn > 0) keys.add(idn);
    }

    for (const k of keys) {
      const cur = map.get(k);
      if (!cur) {
        map.set(k, doc);
        continue;
      }
      const curAnime = String(cur.id).startsWith("anime_");
      const nextAnime = String(doc.id).startsWith("anime_");
      if (nextAnime && !curAnime) map.set(k, doc);
    }
  }
  return map;
}

async function fetchMovieDocs(col, credits) {
  const ids = uniquePositiveIds(credits);
  if (ids.length === 0) return new Map();

  const variants = [...ids, ...ids.map(String)];
  const docs = await col
    .find({
      type: "movie",
      $or: [
        { id: { $in: variants } },
        { tmdb_id: { $in: ids } },
        { "external_ids.tmdb_id": { $in: ids } },
      ],
      ...catalogMoviePolicyClause(),
    })
    .toArray();

  const byKey = new Map();
  for (const doc of docs) {
    byKey.set(Number(doc.id), doc);
    byKey.set(String(doc.id), doc);
    const tid = Number(doc.tmdb_id ?? doc.external_ids?.tmdb_id);
    if (Number.isFinite(tid) && tid > 0) {
      byKey.set(tid, doc);
    }
  }
  return byKey;
}

async function fetchTvDocs(col, credits) {
  const ids = uniquePositiveIds(credits);
  if (ids.length === 0) return new Map();

  const idVariants = [...ids, ...ids.map(String)];
  const docs = await col
    .find({
      type: "tv",
      $or: [
        { id: { $in: idVariants } },
        { tmdb_id: { $in: ids } },
        { "external_ids.tmdb_id": { $in: ids } },
      ],
    })
    .toArray();

  return buildTvTmdbLookupMap(docs);
}

function creditReleaseDate(credit) {
  const raw = credit?.release_date ?? credit?.first_air_date ?? null;
  return typeof raw === "string" && raw.length >= 4 ? raw.slice(0, 10) : null;
}

function personAge(birthday, deathday) {
  if (!birthday || typeof birthday !== "string" || birthday.length < 4) return null;
  const [y, m, d] = birthday.slice(0, 10).split("-").map(Number);
  if (!Number.isFinite(y)) return null;
  const endRaw = deathday && typeof deathday === "string" ? deathday : null;
  const [ey, em, ed] = endRaw
    ? endRaw.slice(0, 10).split("-").map(Number)
    : [
        new Date().getUTCFullYear(),
        new Date().getUTCMonth() + 1,
        new Date().getUTCDate(),
      ];
  let age = ey - y;
  if (em < m || (em === m && ed < d)) age -= 1;
  return age >= 0 ? age : null;
}

function genderLabel(gender) {
  if (gender === 1) return "Female";
  if (gender === 2) return "Male";
  if (gender === 3) return "Non-binary";
  return null;
}

function buildSocialLinks(externalIds) {
  if (!externalIds || typeof externalIds !== "object") return [];
  const links = [];
  const instagram = String(externalIds.instagram_id ?? "").trim();
  if (instagram) {
    links.push({
      label: "Instagram",
      href: `https://instagram.com/${instagram.replace(/^@/, "")}`,
    });
  }
  const facebook = String(externalIds.facebook_id ?? "").trim();
  if (facebook) {
    links.push({
      label: "Facebook",
      href: facebook.startsWith("http")
        ? facebook
        : `https://facebook.com/${facebook}`,
    });
  }
  const tiktok = String(externalIds.tiktok_id ?? "").trim();
  if (tiktok) {
    links.push({
      label: "TikTok",
      href: `https://tiktok.com/@${tiktok.replace(/^@/, "")}`,
    });
  }
  const imdb = String(externalIds.imdb_id ?? "").trim();
  if (imdb) {
    links.push({
      label: "IMDb",
      href: `https://www.imdb.com/name/nm${imdb}`,
    });
  }
  return links;
}

function mapCreditToEntry(credit, doc) {
  if (!doc) return null;
  const item = mapContentDocToItem(doc);
  return {
    ...item,
    inCatalog: true,
    character: String(credit?.character ?? "").trim() || null,
    creditPopularity: Number(credit?.popularity) || 0,
    creditReleaseDate: creditReleaseDate(credit),
  };
}

function mapCreditToTmdbEntry(credit) {
  const mediaType = credit?.media_type === "tv" ? "tv" : "movie";
  const title = String(credit?.title ?? credit?.name ?? "").trim();
  if (!title || !Number.isFinite(Number(credit?.id))) return null;

  return {
    id: String(credit.id),
    title,
    name: credit?.name ?? credit?.title ?? title,
    release_date: creditReleaseDate(credit),
    poster_path: credit?.poster_path ?? null,
    type: mediaType,
    vote_average:
      typeof credit?.vote_average === "number" ? credit.vote_average : null,
    inCatalog: false,
    character: String(credit?.character ?? "").trim() || null,
    creditPopularity: Number(credit?.popularity) || 0,
    creditReleaseDate: creditReleaseDate(credit),
  };
}

function dedupeEntries(entries) {
  const byId = new Map();
  for (const entry of entries) {
    const key = String(entry.id);
    const existing = byId.get(key);
    if (!existing || entry.creditPopularity > existing.creditPopularity) {
      byId.set(key, entry);
    }
  }
  return [...byId.values()];
}

function sortFilmography(entries) {
  return [...entries].sort((a, b) => {
    const dateA = a.release_date ?? a.creditReleaseDate ?? "";
    const dateB = b.release_date ?? b.creditReleaseDate ?? "";
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return (b.creditPopularity || 0) - (a.creditPopularity || 0);
  });
}

function sortKnownFor(entries) {
  return [...entries].sort(
    (a, b) => (b.creditPopularity || 0) - (a.creditPopularity || 0)
  );
}

function normalizePersonProfile(raw) {
  const name = String(raw?.name ?? "").trim();
  if (!name) return null;

  const alsoKnownAs = Array.isArray(raw.also_known_as)
    ? raw.also_known_as
        .map((alias) => String(alias ?? "").trim())
        .filter((alias) => alias && alias.toLowerCase() !== name.toLowerCase())
    : [];

  const birthday =
    typeof raw.birthday === "string" && raw.birthday.trim()
      ? raw.birthday.trim().slice(0, 10)
      : null;
  const deathday =
    typeof raw.deathday === "string" && raw.deathday.trim()
      ? raw.deathday.trim().slice(0, 10)
      : null;

  return {
    id: Number(raw.id),
    name,
    biography: String(raw.biography ?? "").trim(),
    profile_path: raw.profile_path ?? null,
    birthday,
    deathday,
    place_of_birth: String(raw.place_of_birth ?? "").trim() || null,
    gender: Number(raw.gender) || 0,
    genderLabel: genderLabel(Number(raw.gender) || 0),
    age: personAge(birthday, deathday),
    known_for_department: String(raw.known_for_department ?? "").trim() || null,
    also_known_as: alsoKnownAs,
    socialLinks: buildSocialLinks(raw.external_ids),
  };
}

/**
 * @param {string | number} personId TMDB person id
 */
export async function loadPersonPagePayload(personId) {
  const id = Number(personId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const auth = tmdbAuth();
  if (!auth) throw new Error("Missing TMDB auth");

  const personRaw = await tmdbFetchJson(
    `https://api.themoviedb.org/3/person/${id}?append_to_response=external_ids`,
    auth
  );
  const person = normalizePersonProfile(personRaw);
  if (!person) return null;

  const creditsRaw = await tmdbFetchJson(
    `https://api.themoviedb.org/3/person/${id}/combined_credits`,
    auth
  );

  const cast = Array.isArray(creditsRaw?.cast)
    ? creditsRaw.cast.filter(isActingFilmographyCredit)
    : [];

  const movieCredits = cast.filter((row) => row.media_type === "movie");
  const tvCredits = cast.filter((row) => row.media_type === "tv");

  const client = await clientPromise;
  const col = client.db().collection("content");

  const [movieDocs, tvDocs] = await Promise.all([
    fetchMovieDocs(col, movieCredits),
    fetchTvDocs(col, tvCredits),
  ]);

  const entries = [];
  for (const credit of cast) {
    const tmdbId = Number(credit.id);
    if (!Number.isFinite(tmdbId)) continue;
    const doc =
      credit.media_type === "movie"
        ? movieDocs.get(tmdbId) ?? movieDocs.get(String(tmdbId))
        : tvDocs.get(tmdbId);
    const entry =
      mapCreditToEntry(credit, doc) ?? mapCreditToTmdbEntry(credit);
    if (entry) entries.push(entry);
  }

  const deduped = dedupeEntries(entries);
  const knownFor = sortKnownFor(deduped).slice(0, KNOWN_FOR_LIMIT);
  const filmography = sortFilmography(deduped).slice(0, FILMOGRAPHY_LIMIT);

  return {
    person,
    knownFor,
    filmography,
  };
}
