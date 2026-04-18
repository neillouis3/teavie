import clientPromise from "@/lib/mongo";

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

const QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    recommendations(perPage: 20, sort: RATING_DESC) {
      nodes {
        id
        idMal
        type
        siteUrl
        title { romaji english native }
        coverImage { large }
        startDate { year month day }
      }
    }
  }
}
`;

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

function isMediaNode(node) {
  if (!node || typeof node !== "object") return false;
  const nid = Number(node.id);
  return Number.isFinite(nid) && nid > 0;
}

function externalUrl(node, anilistId) {
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
 * GET ?anilistId=123
 * AniList recommendations → Teavie catalog `anime_*` only (no TMDB numeric show ids).
 */
export async function GET(req) {
  try {
    const raw = new URL(req.url).searchParams.get("anilistId");
    const anilistId = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(anilistId) || anilistId <= 0) {
      return Response.json({ error: "Provide anilistId" }, { status: 400 });
    }

    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: QUERY, variables: { id: anilistId } }),
    });

    if (!res.ok) {
      return Response.json({ items: [] }, { status: 200 });
    }

    const payload = await res.json();
    if (payload.errors?.length || !payload?.data?.Media) {
      return Response.json({ items: [] }, { status: 200 });
    }

    const media = payload.data.Media;
    const seen = new Set([anilistId]);
    const candidates = [];

    const nodes = media.recommendations?.nodes;
    if (Array.isArray(nodes)) {
      for (const node of nodes) {
        if (!isMediaNode(node)) continue;
        const nid = Number(node.id);
        if (seen.has(nid)) continue;
        seen.add(nid);
        candidates.push({
          anilistId: nid,
          malId: pickMal(node),
          title: pickTitle(node),
          year: yearFromStart(node.startDate),
          posterPath: node.coverImage?.large || "",
          externalUrl: externalUrl(node, nid),
        });
      }
    }

    if (candidates.length === 0) {
      return Response.json({ items: [] });
    }

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

    const client = await clientPromise;
    const docs = await client
      .db("teavie")
      .collection("content")
      .find(
        {
          type: "tv",
          id: { $regex: "^anime_" },
          $or: orClauses,
        },
        {
          projection: {
            id: 1,
            anilist_id: 1,
            anilist: 1,
            mal_id: 1,
            title: 1,
            name: 1,
            poster_path: 1,
            first_air_date: 1,
            release_date: 1,
          },
        }
      )
      .limit(80)
      .toArray();

    /** @type {Map<number, { catalogId: string }>} */
    const byAni = new Map();
    /** @type {Map<number, { catalogId: string }>} */
    const byMal = new Map();

    for (const d of docs) {
      const ak = docAnilistKey(d);
      const cid = String(d.id);
      if (!cid.startsWith("anime_")) continue;
      if (ak != null && alIds.includes(ak) && !byAni.has(ak)) {
        byAni.set(ak, { catalogId: cid });
      }
      const m = typeof d.mal_id === "number" ? d.mal_id : null;
      if (m != null && malIds.includes(m) && !byMal.has(m)) {
        byMal.set(m, { catalogId: cid });
      }
    }

    const items = [];
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
        anilistId: c.anilistId,
        title,
        year,
        posterPath,
        externalUrl: row ? null : c.externalUrl,
      });
    }

    return Response.json({ items });
  } catch (e) {
    console.error(e);
    return Response.json({ items: [] }, { status: 200 });
  }
}
