import clientPromise from "@/lib/mongo";

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

const QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    relations {
      edges {
        relationType
        node {
          id
          type
          format
          title { romaji english native }
          coverImage { large }
          startDate { year month day }
        }
      }
    }
    recommendations(perPage: 18, sort: RATING_DESC) {
      nodes {
        id
        type
        format
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

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("anilistId");
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
      return Response.json({ error: "AniList request failed" }, { status: 502 });
    }

    const payload = await res.json();
    if (payload.errors?.length) {
      return Response.json(
        { error: payload.errors.map((e) => e.message).join("; ") },
        { status: 404 }
      );
    }

    const media = payload?.data?.Media;
    if (!media) {
      return Response.json({ error: "Media not found" }, { status: 404 });
    }

    const seen = new Set([anilistId]);
    const candidates = [];

    const edges = media.relations?.edges;
    if (Array.isArray(edges)) {
      for (const edge of edges) {
        const node = edge?.node;
        if (!node || node.type !== "ANIME") continue;
        const nid = Number(node.id);
        if (!Number.isFinite(nid) || seen.has(nid)) continue;
        seen.add(nid);
        candidates.push({
          anilistId: nid,
          title: pickTitle(node),
          year: yearFromStart(node.startDate),
          posterPath: node.coverImage?.large || "",
          topNote: formatRelationLabel(edge.relationType),
        });
      }
    }

    const recNodes = media.recommendations?.nodes;
    if (Array.isArray(recNodes)) {
      for (const node of recNodes) {
        if (!node || node.type !== "ANIME") continue;
        const nid = Number(node.id);
        if (!Number.isFinite(nid) || seen.has(nid)) continue;
        seen.add(nid);
        candidates.push({
          anilistId: nid,
          title: pickTitle(node),
          year: yearFromStart(node.startDate),
          posterPath: node.coverImage?.large || "",
          topNote: "Similar",
        });
      }
    }

    if (candidates.length === 0) {
      return Response.json({ items: [] });
    }

    const alIds = candidates.map((c) => c.anilistId);
    const client = await clientPromise;
    const col = client.db("teavie").collection("content");
    const docs = await col
      .find(
        {
          type: "tv",
          $or: [{ anilist_id: { $in: alIds } }, { "anilist.id": { $in: alIds } }],
        },
        { projection: { id: 1, anilist_id: 1, anilist: 1 } }
      )
      .toArray();

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

    const byAni = new Map();
    for (const d of docs) {
      const k = docAnilistKey(d);
      if (k == null || !alIds.includes(k)) continue;
      if (d.id == null) continue;
      if (!byAni.has(k)) byAni.set(k, String(d.id));
    }

    const items = [];
    for (const c of candidates) {
      const catalogId = byAni.get(c.anilistId) ?? null;
      items.push({
        catalogId,
        anilistId: c.anilistId,
        title: c.title,
        year: c.year,
        posterPath: c.posterPath,
        topNote: c.topNote,
      });
    }

    return Response.json({ items });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "related failed" }, { status: 500 });
  }
}
