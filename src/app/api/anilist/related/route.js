import clientPromise from "@/lib/mongo";
import { tmdbBearerToken } from "@/lib/tmdbAuth";

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

/** No `type: ANIME` filter: some catalog ids resolve as plain `Media(id)`; relations still populate. */
const QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
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
    recommendations(perPage: 24, sort: RATING_DESC) {
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

/** Related `Media` nodes only (skip empty / invalid ids). */
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

/**
 * @param {import("mongodb").Collection} col
 * @param {string} token
 * @param {number} tmdbTvId
 * @param {Set<string>} excludeCatalogIds
 * @param {number} cap
 */
async function tmdbTvRelatedCatalog(col, token, tmdbTvId, excludeCatalogIds, cap) {
  const headers = {
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  const urls = [
    `https://api.themoviedb.org/3/tv/${tmdbTvId}/recommendations?language=en-US&page=1`,
    `https://api.themoviedb.org/3/tv/${tmdbTvId}/similar?language=en-US&page=1`,
  ];
  const tmdbIds = [];
  const seenT = new Set();
  for (const url of urls) {
    const res = await fetch(url, { headers });
    if (!res.ok) continue;
    const j = await res.json();
    for (const r of j.results ?? []) {
      const id = Number(r.id);
      if (!Number.isFinite(id) || id <= 0 || seenT.has(id)) continue;
      seenT.add(id);
      tmdbIds.push(id);
      if (tmdbIds.length >= 28) break;
    }
    if (tmdbIds.length >= 28) break;
  }
  if (tmdbIds.length === 0) return [];

  const variants = [...tmdbIds, ...tmdbIds.map(String)];
  const docs = await col
    .find(
      {
        $or: [
          {
            type: "tv",
            $or: [
              { id: { $in: variants } },
              { tmdb_id: { $in: tmdbIds } },
              { "external_ids.tmdb_id": { $in: tmdbIds } },
            ],
          },
          {
            type: "movie",
            $or: [{ id: { $in: variants } }, { tmdb_id: { $in: tmdbIds } }],
          },
        ],
      },
      {
        projection: {
          id: 1,
          type: 1,
          title: 1,
          name: 1,
          poster_path: 1,
          release_date: 1,
          first_air_date: 1,
          tmdb_id: 1,
        },
      }
    )
    .limit(40)
    .toArray();

  /** @type {Map<number, (typeof docs)[0]>} */
  const byTmdb = new Map();
  for (const d of docs) {
    const keys = new Set();
    const tid =
      typeof d.tmdb_id === "number"
        ? d.tmdb_id
        : typeof d.tmdb_id === "string"
          ? parseInt(d.tmdb_id, 10)
          : NaN;
    if (Number.isFinite(tid) && tid > 0) keys.add(tid);
    const idn = Number(d.id);
    if (Number.isFinite(idn) && idn > 0 && !String(d.id).startsWith("anime_")) keys.add(idn);
    for (const k of keys) {
      if (!byTmdb.has(k)) byTmdb.set(k, d);
    }
  }

  const out = [];
  for (const tid of tmdbIds) {
    if (out.length >= cap) break;
    const d = byTmdb.get(tid);
    if (!d?.id) continue;
    const cid = String(d.id);
    if (excludeCatalogIds.has(cid)) continue;
    excludeCatalogIds.add(cid);
    out.push({
      catalogId: cid,
      catalogType: d.type === "movie" ? "movie" : "tv",
      anilistId: null,
      title: d.title ?? d.name ?? "Untitled",
      year: yearFromDoc(d),
      posterPath: d.poster_path || "",
      topNote: "Similar (TMDB)",
    });
  }
  return out;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("anilistId");
    const anilistId = raw ? parseInt(raw, 10) : NaN;
    const anilistOk = Number.isFinite(anilistId) && anilistId > 0;

    const tmdbRaw = searchParams.get("tmdbTvId");
    const tmdbTvId = tmdbRaw ? parseInt(tmdbRaw, 10) : NaN;
    const tmdbTvOk = Number.isFinite(tmdbTvId) && tmdbTvId > 0;

    if (!anilistOk && !tmdbTvOk) {
      return Response.json({ error: "Provide anilistId and/or tmdbTvId" }, { status: 400 });
    }

    const client = await clientPromise;
    const col = client.db("teavie").collection("content");
    const token = tmdbBearerToken();

    /** @type {Array<{ catalogId: string | null; catalogType: string | null; anilistId: number | null; title: string; year: string; posterPath: string; topNote: string; externalUrl?: string | null }>} */
    const items = [];

    let media = null;
    if (anilistOk) {
      const res = await fetch(ANILIST_GRAPHQL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: QUERY, variables: { id: anilistId } }),
      });

      if (res.ok) {
        const payload = await res.json();
        if (!payload.errors?.length && payload?.data?.Media) {
          media = payload.data.Media;
        }
      }
    }

    const seen = new Set(anilistOk ? [anilistId] : []);
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
            topNote: formatRelationLabel(edge.relationType),
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

    const seenCatalog = new Set(items.map((i) => i.catalogId).filter(Boolean));
    if (tmdbTvOk && token) {
      const room = Math.max(0, 18 - items.length);
      if (room > 0) {
        const extra = await tmdbTvRelatedCatalog(col, token, tmdbTvId, seenCatalog, room);
        items.push(...extra);
      }
    }

    return Response.json({ items });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "related failed" }, { status: 500 });
  }
}
