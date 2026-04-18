import clientPromise from "@/lib/mongo";
import {
  catalogTodayIsoUtc,
  escapeRegex,
  releasedAnimeFirstAirClause,
} from "@/lib/catalogQuery";

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

const QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    title { romaji english native }
    relations {
      edges {
        relationType
        node {
          id
          idMal
          type
          format
          siteUrl
          title { romaji english native }
          coverImage { large }
          startDate { year month day }
        }
      }
    }
    recommendations(perPage: 30, sort: RATING_DESC) {
      nodes {
        id
        idMal
        type
        format
        siteUrl
        title { romaji english native }
        coverImage { large }
        startDate { year month day }
      }
    }
  }
}
`;

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "no",
  "wo",
  "ni",
  "de",
  "ga",
  "wa",
  "ii",
  "tv",
  "ova",
  "ona",
  "sp",
  "part",
  "season",
  "movie",
  "special",
]);

function formatRelationLabel(relationType) {
  if (!relationType || typeof relationType !== "string") return "";
  return relationType
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function pickTitle(n) {
  const t = n?.title;
  if (!t || typeof t !== "object") return "Untitled";
  return t.english || t.romaji || t.native || "Untitled";
}

function yearFromStart(d) {
  if (!d || typeof d !== "object") return "—";
  const y = Number(d.year);
  return Number.isFinite(y) && y > 0 ? String(y) : "—";
}

function pickMal(node) {
  const m = Number(node?.idMal);
  return Number.isFinite(m) && m > 0 ? m : null;
}

function isRelatedMediaNode(node) {
  if (!node || typeof node !== "object") return false;
  const nid = Number(node.id);
  return Number.isFinite(nid) && nid > 0;
}

function anilistExternalUrl(node, anilistId) {
  const u = typeof node?.siteUrl === "string" ? node.siteUrl.trim() : "";
  if (u) return u;
  const t = String(node?.type || "").toUpperCase();
  const slug = t === "MANGA" ? "manga" : "anime";
  return `https://anilist.co/${slug}/${anilistId}`;
}

function docAnilistKey(d) {
  const a = d?.anilist_id;
  if (typeof a === "number" && Number.isFinite(a) && a > 0) return a;
  if (typeof a === "string") {
    const n = parseInt(a, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const b = d?.anilist?.id;
  if (typeof b === "number" && Number.isFinite(b) && b > 0) return b;
  if (typeof b === "string") {
    const n = parseInt(b, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function yearFromDoc(d) {
  const raw = d.release_date ?? d.first_air_date ?? "";
  if (typeof raw !== "string" || raw.length < 4) return "—";
  return raw.slice(0, 4);
}

/** Titles from AniList root + optional UI seed (show name). */
function collectSeedStrings(media, seedTitleParam) {
  /** @type {string[]} */
  const out = [];
  const t = media?.title;
  if (t && typeof t === "object") {
    for (const k of ["english", "romaji", "native"]) {
      const s = t[k];
      if (typeof s === "string" && s.trim().length > 0) out.push(s.trim());
    }
  }
  if (typeof seedTitleParam === "string" && seedTitleParam.trim().length > 0) {
    out.push(seedTitleParam.trim());
  }
  return [...new Set(out)];
}

function tokenizeForSearch(strings) {
  const tokens = new Set();
  for (const s of strings) {
    const parts = String(s)
      .replace(/[''`]/g, "")
      .split(/[^\p{L}\p{N}]+/u);
    for (const p of parts) {
      const x = p.toLowerCase();
      if (x.length < 3 || STOPWORDS.has(x)) continue;
      tokens.add(x);
    }
  }
  return [...tokens].slice(0, 8);
}

/**
 * Catalog anime (`anime_*`) whose title/name/aliases overlap tokens or a long title phrase.
 * @param {import("mongodb").Collection} col
 */
async function catalogNameFallback(col, { seedStrings, excludeCatalogIds, excludeAnilistIds, cap }) {
  if (cap <= 0) return [];

  const tokens = tokenizeForSearch(seedStrings);
  /** @type {Record<string, unknown>[]} */
  const branches = [];
  for (const tok of tokens) {
    const rx = escapeRegex(tok);
    branches.push({
      $or: [
        { title: { $regex: rx, $options: "i" } },
        { name: { $regex: rx, $options: "i" } },
        { title_aliases: { $regex: rx, $options: "i" } },
        { "anilist.title.romaji": { $regex: rx, $options: "i" } },
        { "anilist.title.english": { $regex: rx, $options: "i" } },
        { "anilist.title.native": { $regex: rx, $options: "i" } },
      ],
    });
  }

  const longest = [...seedStrings].sort((a, b) => b.length - a.length)[0] || "";
  if (longest.length >= 4) {
    const phrase = escapeRegex(longest.slice(0, 48).trim());
    branches.push({
      $or: [
        { title: { $regex: phrase, $options: "i" } },
        { name: { $regex: phrase, $options: "i" } },
        { title_aliases: { $regex: phrase, $options: "i" } },
        { "anilist.title.romaji": { $regex: phrase, $options: "i" } },
        { "anilist.title.english": { $regex: phrase, $options: "i" } },
      ],
    });
  }

  if (branches.length === 0) return [];

  const todayIso = catalogTodayIsoUtc();
  const nin = [...excludeCatalogIds];
  /** @type {Record<string, unknown>[]} */
  const and = [
    { type: "tv" },
    { id: { $regex: "^anime_" } },
    releasedAnimeFirstAirClause(todayIso),
    { $or: branches },
  ];
  if (nin.length) and.push({ id: { $nin: nin } });

  const docs = await col
    .find({ $and: and }, {
      projection: {
        id: 1,
        type: 1,
        anilist_id: 1,
        anilist: 1,
        title: 1,
        name: 1,
        poster_path: 1,
        first_air_date: 1,
        release_date: 1,
        popularity: 1,
      },
    })
    .sort({ popularity: -1, _id: -1 })
    .limit(cap + 8)
    .toArray();

  /** @type {Array<{ catalogId: string; catalogType: string; anilistId: number | null; title: string; year: string; posterPath: string; topNote: string; externalUrl: string | null }>} */
  const out = [];
  for (const d of docs) {
    if (out.length >= cap) break;
    const cid = String(d.id);
    if (!cid.startsWith("anime_")) continue;
    if (excludeCatalogIds.has(cid)) continue;
    const aid = docAnilistKey(d);
    if (aid != null && excludeAnilistIds.has(aid)) continue;
    excludeCatalogIds.add(cid);
    if (aid != null) excludeAnilistIds.add(aid);
    out.push({
      catalogId: cid,
      catalogType: "tv",
      anilistId: aid,
      title: d.title ?? d.name ?? "Untitled",
      year: yearFromDoc(d),
      posterPath: d.poster_path || "",
      topNote: "Similar title",
      externalUrl: null,
    });
  }
  return out;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("anilistId");
    const anilistId = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(anilistId) || anilistId <= 0) {
      return Response.json({ error: "Provide anilistId" }, { status: 400 });
    }

    const seedTitle = (searchParams.get("seedTitle") || "").trim();
    const excludeCatalogId = (searchParams.get("excludeCatalogId") || "").trim();

    const client = await clientPromise;
    const col = client.db("teavie").collection("content");

    /** @type {Array<{ catalogId: string | null; catalogType: string | null; anilistId: number | null; title: string; year: string; posterPath: string; topNote: string; externalUrl?: string | null }>} */
    const items = [];

    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: QUERY, variables: { id: anilistId } }),
    });

    let media = null;
    if (res.ok) {
      const payload = await res.json();
      if (!payload.errors?.length && payload?.data?.Media) {
        media = payload.data.Media;
      }
    }

    const seen = new Set([anilistId]);
    const candidates = [];

    if (media) {
      const edges = media.relations?.edges;
      if (Array.isArray(edges)) {
        for (const edge of edges) {
          const node = edge?.node;
          if (!isRelatedMediaNode(node)) continue;
          const nid = Number(node.id);
          if (seen.has(nid)) continue;
          seen.add(nid);
          candidates.push({
            anilistId: nid,
            malId: pickMal(node),
            title: pickTitle(node),
            year: yearFromStart(node.startDate),
            posterPath: node.coverImage?.large || "",
            topNote: formatRelationLabel(edge.relationType) || "Related",
            externalUrl: anilistExternalUrl(node, nid),
          });
        }
      }

      const recNodes = media.recommendations?.nodes;
      if (Array.isArray(recNodes)) {
        for (const node of recNodes) {
          if (!isRelatedMediaNode(node)) continue;
          const nid = Number(node.id);
          if (seen.has(nid)) continue;
          seen.add(nid);
          candidates.push({
            anilistId: nid,
            malId: pickMal(node),
            title: pickTitle(node),
            year: yearFromStart(node.startDate),
            posterPath: node.coverImage?.large || "",
            topNote: "Similar",
            externalUrl: anilistExternalUrl(node, nid),
          });
        }
      }
    }

    if (candidates.length > 0) {
      const alIds = candidates.map((c) => c.anilistId);
      const malIds = [
        ...new Set(
          candidates.map((c) => c.malId).filter((m) => typeof m === "number" && m > 0)
        ),
      ];

      const orClauses = [
        { anilist_id: { $in: alIds } },
        { "anilist.id": { $in: alIds } },
      ];
      if (malIds.length) orClauses.push({ mal_id: { $in: malIds } });

      const docs = await col
        .find(
          {
            type: { $in: ["tv", "movie"] },
            $or: orClauses,
          },
          {
            projection: {
              id: 1,
              type: 1,
              anilist_id: 1,
              anilist: 1,
              mal_id: 1,
              title: 1,
              name: 1,
              poster_path: 1,
              release_date: 1,
              first_air_date: 1,
            },
          }
        )
        .limit(120)
        .toArray();

      /** @type {Map<number, { catalogId: string; catalogType: string }>} */
      const byAni = new Map();
      /** @type {Map<number, { catalogId: string; catalogType: string }>} */
      const byMal = new Map();

      for (const d of docs) {
        const ak = docAnilistKey(d);
        if (ak != null && alIds.includes(ak) && !byAni.has(ak)) {
          byAni.set(ak, {
            catalogId: String(d.id),
            catalogType: d.type === "movie" ? "movie" : "tv",
          });
        }
        const m = typeof d.mal_id === "number" ? d.mal_id : null;
        if (m != null && malIds.includes(m) && !byMal.has(m)) {
          byMal.set(m, {
            catalogId: String(d.id),
            catalogType: d.type === "movie" ? "movie" : "tv",
          });
        }
      }

      for (const c of candidates) {
        const row = byAni.get(c.anilistId) ?? (c.malId != null ? byMal.get(c.malId) : null);
        let title = c.title;
        let year = c.year;
        let posterPath = c.posterPath;
        if (row) {
          const doc = docs.find((x) => String(x.id) === row.catalogId);
          if (doc) {
            title = doc.title ?? doc.name ?? title;
            year = yearFromDoc(doc);
            posterPath = doc.poster_path || posterPath;
          }
        }
        items.push({
          catalogId: row?.catalogId ?? null,
          catalogType: row?.catalogType ?? null,
          anilistId: c.anilistId,
          title,
          year,
          posterPath,
          topNote: c.topNote,
          externalUrl: row ? null : c.externalUrl ?? null,
        });
      }
    }

    const excludeCatalogIds = new Set(
      [excludeCatalogId, ...items.map((i) => i.catalogId).filter(Boolean)]
    );
    const excludeAnilistIds = new Set([anilistId]);
    for (const it of items) {
      if (typeof it.anilistId === "number" && it.anilistId > 0) {
        excludeAnilistIds.add(it.anilistId);
      }
    }

    const inCatalog = items.filter((i) => i.catalogId).length;
    const room = Math.max(0, 18 - items.length);
    if (room > 0 && (items.length === 0 || inCatalog < 4)) {
      const seedStrings = collectSeedStrings(media, seedTitle);
      const extra = await catalogNameFallback(col, {
        seedStrings,
        excludeCatalogIds,
        excludeAnilistIds,
        cap: room,
      });
      items.push(...extra);
    }

    return Response.json({ items });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "related failed" }, { status: 500 });
  }
}
