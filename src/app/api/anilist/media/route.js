const ANILIST_GRAPHQL = "https://graphql.anilist.co";

function stripHtml(html) {
  if (typeof html !== "string") return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function startDateToIso(d) {
  if (!d || typeof d !== "object") return null;
  const y = Number(d.year);
  const m = Number(d.month);
  const day = Number(d.day);
  if (!Number.isFinite(y) || y < 1900) return null;
  const mm = Number.isFinite(m) && m >= 1 && m <= 12 ? m : 1;
  const dd = Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1;
  return `${String(y).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const anilistIdRaw = searchParams.get("anilistId");
    const idMalRaw = searchParams.get("idMal");
    const anilistId = anilistIdRaw ? parseInt(anilistIdRaw, 10) : NaN;
    const idMal = idMalRaw ? parseInt(idMalRaw, 10) : NaN;

    if (!Number.isFinite(anilistId) && !Number.isFinite(idMal)) {
      return Response.json({ error: "Provide anilistId or idMal" }, { status: 400 });
    }

    const useAnilistId = Number.isFinite(anilistId) && anilistId > 0;
    const query = useAnilistId
      ? `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          idMal
          siteUrl
          episodes
          description
          genres
          averageScore
          status
          format
          startDate { year month day }
          title { romaji english native }
        }
      }
    `
      : `
      query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) {
          id
          idMal
          siteUrl
          episodes
          description
          genres
          averageScore
          status
          format
          startDate { year month day }
          title { romaji english native }
        }
      }
    `;

    const variables = useAnilistId ? { id: anilistId } : { idMal };

    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const t = await res.text();
      return Response.json(
        { error: "AniList request failed", detail: t.slice(0, 200) },
        { status: 502 }
      );
    }

    const payload = await res.json();
    if (payload.errors?.length) {
      return Response.json(
        { error: payload.errors.map((e) => e.message).join("; ") },
        { status: 404 }
      );
    }

    const m = payload?.data?.Media;
    if (!m) {
      return Response.json({ error: "Media not found" }, { status: 404 });
    }

    const start = startDateToIso(m.startDate);
    const overview = stripHtml(m.description || "");

    return Response.json({
      id: m.id,
      idMal: m.idMal ?? null,
      siteUrl: m.siteUrl ?? null,
      episodes: Number.isFinite(Number(m.episodes)) ? Number(m.episodes) : null,
      overview,
      genres: Array.isArray(m.genres) ? m.genres : [],
      averageScore: Number.isFinite(Number(m.averageScore)) ? Number(m.averageScore) : null,
      status: m.status ?? null,
      format: m.format ?? null,
      first_air_date: start,
      title: {
        romaji: m.title?.romaji ?? null,
        english: m.title?.english ?? null,
        native: m.title?.native ?? null,
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "AniList proxy failed" }, { status: 500 });
  }
}
